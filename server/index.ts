import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================
// TYPES & INTERFACES
// ========================

interface GameConfig {
  api: {
    anthropic: {
      apiKey: string;
      baseUrl: string;
      model: string;
    };
    embedding?: string;
  };
}

interface BilboState {
  character: string;
  characterEvolution: number; // Accumulated character changes: +good, -evil
  health: string;
  tasks: string[];
  plans: string[];
  thoughts: string[];
  emotions: string[];
}

interface Location {
  region: string;
  settlement: string;
  place: string;
}

interface Time {
  day: number;
  month: string;
  year: number;
  era: string;
  time: string;
}

interface HistoryEntry {
  content: string;
  type: 'bilbo' | 'world';
  description?: string;
  location: Location;
  time: Time;
}

interface GameState {
  bilboState: BilboState;
  location: Location;
  time: Time;
  environment: string[];
  event: string;
  history: HistoryEntry[];
}

interface ApiResponse {
  reaction: string;
  worldResponse: string;
  usage: { total: number };
  gameState: GameState;
}

interface MemoryRecord {
  id: string;
  content: string;
  embeddings: number[];
  time: string;
  location: string;
  importance: number;
  emotions: string;
  createdAt: number;
}

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

// ========================
// GLOBALS & CONFIGURATION
// ========================

const RECENT_HISTORY_SIZE = 3; // Number of recent history entries to include in prompts
const MEMORY_RELEVANCE_THRESHOLD = 0.6; // Minimum similarity threshold for memory search
const MAX_MEMORY_SEARCH_DEPTH = 3; // Maximum depth for recursive memory searches (prevents infinite loops)

// ========================
// CLAUDE API TOOLS
// ========================

function getClaudeTools() {
  return [{
    name: "search_memory",
    description: "Search Bilbo's memories for relevant past experiences, including items he has found or acquired. Use this to check what objects, weapons, tools Bilbo has with him.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string", 
          description: "Specific episode in memory, like 'I met Gandalf', 'I found ring', 'sword', 'rope', 'food', 'clothes'"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 5
        }
      },
      required: ["query"]
    }
  }];
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../dist')));

let gameConfig: GameConfig;

// Global log store for streaming
let logBuffer: string[] = [];
let logSubscribers: any[] = [];

function broadcastLog(message: string) {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-GB', { hour12: false });
  const logMessage = `[${timestamp}] ${message}`;

  console.log(logMessage);
  
  // Add to buffer (keep last 100 entries)
  logBuffer.push(logMessage);
  if (logBuffer.length > 100) {
    logBuffer.shift();
  }
  
  // Send to all subscribers
  logSubscribers.forEach(res => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'log', message: logMessage })}\n\n`);
    } catch (error) {
      // Remove dead connections
      const index = logSubscribers.indexOf(res);
      if (index > -1) logSubscribers.splice(index, 1);
    }
  });
}

// ========================
// MEMORY INTEGRATION
// ========================

let memoryDatabase: any = null;
let memoryTable: any = null;
let embedder: any = null;

async function createEmbedding(text: string): Promise<number[]> {
  if (!embedder) {
    broadcastLog('🤖 Loading embedding model...');
    
    const embeddingModel = gameConfig.api.embedding || 'Xenova/multilingual-e5-small';
    broadcastLog(`Loading ${embeddingModel}...`);
    
    embedder = await pipeline('feature-extraction', embeddingModel, {
      quantized: true,
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          broadcastLog(`Downloading: ${progress.name} - ${Math.round(progress.progress || 0)}%`);
        }
      }
    });
    
    broadcastLog(`✅ Embedding model loaded: ${embeddingModel}`);
  }
  
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function initializeMemory() {
  try {
    const { connect } = await import('@lancedb/lancedb');
    memoryDatabase = await connect('./memory_db');
    
    // Try to load existing memory table
    try {
      memoryTable = await memoryDatabase.openTable('bilbo_memories');
      broadcastLog('🧠 Memory database loaded with existing memories');
    } catch {
      // Table doesn't exist yet, will be created when first memory is saved
      memoryTable = null;
      broadcastLog('🧠 Memory database ready (no existing memories)');
    }
  } catch (error) {
    broadcastLog(`❌ Failed to initialize memory database: ${error.message}`);
  }
}

async function clearMemory() {
  try {
    if (memoryDatabase) {
      await memoryDatabase.dropTable('bilbo_memories');
      broadcastLog('🧹 Cleared all memories for new game');
    }
    memoryTable = null;
  } catch (error) {
    // Table might not exist, that's fine
    broadcastLog('🧹 Memory already empty');
  }
}

async function findMemory(query: string, limit: number = 3, threshold: number = MEMORY_RELEVANCE_THRESHOLD): Promise<MemoryRecord[]> {
  if (!memoryTable) return [];
  
  try {    
    // Create embedding for search query
    const queryEmbedding = await createEmbedding(query);
    
    // Perform vector search on all memories with higher limit to filter later
    const searchResults = await memoryTable
      .vectorSearch(queryEmbedding)
      .limit(limit * 3) // Get more results to filter
      .toArray();

    // Filter by relevance threshold (LanceDB returns _distance, lower = more similar)
    const relevantMemories = searchResults.filter(result => {
      // Convert distance to similarity (distance closer to 0 = more similar)
      const similarity = 1 - (result._distance || 0);
      return similarity >= threshold;
    }).slice(0, limit); // Apply original limit after filtering

    broadcastLog(`Found ${relevantMemories.length}/${searchResults.length} relevant memories for: "${query}" (threshold: ${threshold})`);
    
    return relevantMemories.map(memory => ({
      content: memory.content,
      time: memory.time,
      location: memory.location,
      importance: memory.importance,
      emotions: memory.emotions,
      createdAt: memory.createdAt,
      similarity: memory._distance ? (1 - memory._distance).toFixed(3) : 'N/A'
      // embeddings excluded
    }));
  } catch (error) {
    broadcastLog(`❌ Error finding memories: ${error.message}`);
    return [];
  }
}

async function saveMemory(memoryData: {
  content: string;
  importance: number;
  emotions: string;
  time: string;
  location: string;
}): Promise<void> {
  try {
    // Create embedding for the memory content
    const contentEmbedding = await createEmbedding(memoryData.content);
    
    const memoryRecord = {
      id: Date.now().toString(),
      content: memoryData.content,
      embeddings: contentEmbedding,
      time: memoryData.time,
      location: memoryData.location,
      importance: memoryData.importance,
      emotions: memoryData.emotions,
      createdAt: Date.now()
    };
    
    if (!memoryTable) {
      broadcastLog('Creating memory table with vector support...');
      try {
        // Drop existing table if it exists with wrong schema
        await memoryDatabase.dropTable('bilbo_memories');
      } catch {
        // Table doesn't exist, that's fine
      }
      
      memoryTable = await memoryDatabase.createTable('bilbo_memories', [memoryRecord]);
      broadcastLog(`Created table and saved memory: ${memoryRecord.content}`);
    } else {
      await memoryTable.add([memoryRecord]);
      broadcastLog(`Saved memory: ${memoryRecord.content}`);
    }
  } catch (error) {
    broadcastLog(`❌ Error saving memory: ${error.message}`);
  }
}

// ========================
// CORE GAME LOGIC
// ========================

async function loadGameConfig(): Promise<GameConfig> {
  try {
    const configPath = path.join(__dirname, '../game.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    broadcastLog(`❌ Error loading game config: ${error.message}`);
    throw new Error('Failed to load game configuration');
  }
}

async function buildPrompt(gameState: GameState, action: string, language: string): Promise<{rulesContent: string, dynamicContent: string}> {
  let rulesPath = path.join(__dirname, `../public/locales/${language}/rules.md`);
  let promptPath = path.join(__dirname, `../public/locales/${language}/prompt.md`);
  let rulesContent: string;
  let dynamicTemplate: string;
  
  try {
    rulesContent = await fs.readFile(rulesPath, 'utf8');
    dynamicTemplate = await fs.readFile(promptPath, 'utf8');
  } catch (error) {
    broadcastLog(`⚠️ Prompt files not found for language ${language}, falling back to Russian`);
    rulesPath = path.join(__dirname, `../public/locales/ru/rules.md`);
    promptPath = path.join(__dirname, `../public/locales/ru/prompt.md`);
    rulesContent = await fs.readFile(rulesPath, 'utf8');
    dynamicTemplate = await fs.readFile(promptPath, 'utf8');
  }
  
  const location = `${gameState.location.region}, ${gameState.location.settlement}, ${gameState.location.place}`;
  const time = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year} ${gameState.time.era}, ${gameState.time.time}`;
  
  // Use recent memories instead of raw history for context
  let recentHistory = '';
  let useMemories = false;
  
  try {
    if (memoryTable) {
      // Get all memories, sort by time, and take most recent ones
      const allMemories = await memoryTable.query().toArray();
      allMemories.sort((a, b) => b.createdAt - a.createdAt);
      const recentMemories = allMemories.slice(0, RECENT_HISTORY_SIZE);
      
      // Reverse order for chronological flow in prompt (oldest first → newest last)
      recentMemories.reverse();
      
      recentHistory = recentMemories
        .map(memory => memory.content)
        .join('\n---\n');
      
      useMemories = true;
      broadcastLog(`📚 Using ${recentMemories.length} most recent memories from ${allMemories.length} total`);
    }
  } catch (error) {
    broadcastLog('📚 Memory error, falling back to raw history');
  }
  
  if (!useMemories) {
    // Fallback to raw history if no memories available or error occurred
    recentHistory = (gameState.history || []).slice(-(RECENT_HISTORY_SIZE + 1), -1)
      .map(entry => entry.content)
      .join('\n---\n');
    broadcastLog('📚 Using raw history');
  }
  
  const plansText = (gameState.bilboState.plans && gameState.bilboState.plans.length > 0) 
    ? gameState.bilboState.plans.join('; ') 
    : 'no special plans';
  const tasksText = (gameState.bilboState.tasks && gameState.bilboState.tasks.length > 0) 
    ? gameState.bilboState.tasks.join('; ') 
    : 'resting';
  const thoughtsText = (gameState.bilboState.thoughts && gameState.bilboState.thoughts.length > 0) 
    ? gameState.bilboState.thoughts.join('; ') 
    : 'no particular thoughts';
  const emotionsText = (gameState.bilboState.emotions && gameState.bilboState.emotions.length > 0) 
    ? gameState.bilboState.emotions.join('; ') 
    : 'calm';
  
  const environmentText = (gameState.environment && gameState.environment.length > 0) 
    ? gameState.environment.join('; ') 
    : 'peaceful surroundings';

  const dynamicContent = dynamicTemplate
    .replace('{{location}}', location)
    .replace('{{time}}', time)
    .replace('{{environment}}', environmentText)
    .replace('{{character}}', gameState.bilboState.character)
    .replace('{{characterEvolution}}', gameState.bilboState.characterEvolution.toString())
    .replace('{{plans}}', plansText)
    .replace('{{health}}', gameState.bilboState.health)
    .replace('{{tasks}}', tasksText)
    .replace('{{thoughts}}', thoughtsText)
    .replace('{{emotions}}', emotionsText)
    .replace('{{recentHistory}}', recentHistory)
    .replace('{{event}}', gameState.event || 'game start')
    .replace('{{action}}', action);
  
  return { rulesContent, dynamicContent };
}

async function callClaude(requestBody: any, retries = 3): Promise<any> {
  // Add default model and max_tokens if not provided
  const fullRequestBody = {
    model: gameConfig.api.anthropic.model,
    max_tokens: 3000,
    ...requestBody
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(gameConfig.api.anthropic.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': gameConfig.api.anthropic.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(fullRequestBody)
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 529 && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        broadcastLog(`Claude API overloaded (529), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Claude API failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      broadcastLog(`Claude API error, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function buildGameRequest(rulesContent: string, dynamicContent: string, includeTools: boolean = true, additionalMessages: any[] = []): any {
  const baseMessages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: rulesContent,
          cache_control: {
            type: 'ephemeral'
          }
        },
        {
          type: 'text',
          text: dynamicContent
        }
      ]
    }
  ];

  return {
    tools: includeTools ? getClaudeTools() : undefined,
    messages: [...baseMessages, ...additionalMessages]
  };
}

// Helper function to execute memory searches
async function executeMemorySearches(toolUses: any[], depth: number): Promise<ToolResult[]> {
  const toolResults: ToolResult[] = [];
  for (const toolUse of toolUses) {
    const { query, limit = 3 } = toolUse.input;
    broadcastLog(`🧠 AI is searching memory for: "${query}" (depth: ${depth})`);
    
    const memories = await findMemory(query, limit);
    const memoriesText = memories.length > 0 ? 
      memories.map(m => `${m.time}: ${m.content}`).join('\n') : 
      'No relevant memories found';
    
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: memoriesText
    });
  }
  return toolResults;
}

async function handleMemorySearch(data: any, rulesContent: string, dynamicContent: string, depth: number = 0): Promise<any> {
  // Find all memory search tool uses (support multiple searches)
  const toolUses = data.content.filter((item: any) => item.type === 'tool_use' && item.name === 'search_memory');
  
  if (toolUses.length === 0) {
    return data;
  }
  
  // Execute memory searches
  const toolResults = await executeMemorySearches(toolUses, depth);
  
  // Collect found memories and add to dynamic content
  const foundMemories: string[] = [];
  for (const toolResult of toolResults) {
    if (toolResult.content && !toolResult.content.includes('No relevant memories found')) {
      foundMemories.push(toolResult.content);
    }
  }
  
  // Add memories section to end of dynamic content if memories were found
  let updatedDynamicContent = dynamicContent;
  if (foundMemories.length > 0) {
    const memoriesSection = `\nRELEVANT MEMORIES:\n${foundMemories.join('\n---\n')}\n`;
    updatedDynamicContent = dynamicContent + memoriesSection;
  }
  
  // Allow tools only if we haven't reached maximum depth AND we have enough memories
  const allMemories = memoryTable ? await memoryTable.query().toArray() : [];
  const includeTools = depth < (MAX_MEMORY_SEARCH_DEPTH - 1) && allMemories.length > MAX_MEMORY_SEARCH_DEPTH;
  
  // Broadcast found memories to Server Logs and log to file
  if (foundMemories.length > 0) {
    // Log memories to file
    const memoriesLogEntry = `RELEVANT MEMORIES:\n${foundMemories.join('\n')}\n\n`;
    await fs.appendFile('log.txt', memoriesLogEntry, 'utf8');
  }
  
  // Continue the conversation
  const additionalMessages = [
    { role: 'assistant', content: data.content },
    { role: 'user', content: toolResults }
  ];
  
  const followupRequest = buildGameRequest(rulesContent, updatedDynamicContent, includeTools, additionalMessages);
  const followupResponse = await callClaude(followupRequest);
  
  // Check if AI used more tools and handle recursively (with depth limit)
  if (includeTools && followupResponse.content && followupResponse.content.some((item: any) => item.type === 'tool_use')) {
    return await handleMemorySearch(followupResponse, rulesContent, updatedDynamicContent, depth + 1);
  }
  
  return followupResponse;
}

function parseGameResponse(responseText: string): any {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  let jsonStr = jsonMatch[0];
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    broadcastLog(`❌ JSON parse error: ${parseError.message}`);
    throw parseError;
  }
}

function calculateTokens(data: any): number {
  return (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
}

async function processGameAction(gameState: GameState, action: string, language: string = 'ru'): Promise<ApiResponse> {
  try {
    // Build prompt from templates with cache control
    const { rulesContent, dynamicContent } = await buildPrompt(gameState, action, language);
        
    // Log prompt to file
    const timestamp = new Date().toISOString();
    const logEntry = `\n=== ${timestamp} ===\nRULES (CACHED):\n${rulesContent}\n\nDYNAMIC CONTENT:\n${dynamicContent}\n\n`;
    await fs.appendFile('log.txt', logEntry, 'utf8');
    
    // Check if we have enough memories to justify search function
    const allMemories = memoryTable ? await memoryTable.query().toArray() : [];
    const hasEnoughMemories = allMemories.length > MAX_MEMORY_SEARCH_DEPTH;
    
    // Call Claude with or without tools based on memory count
    const request = buildGameRequest(rulesContent, dynamicContent, hasEnoughMemories);
    const data = await callClaude(request);
    let totalTokens = calculateTokens(data);
    
    // Handle memory search if needed
    let finalResponse = data;
    if (data.content && data.content.some((item: any) => item.type === 'tool_use')) {
      finalResponse = await handleMemorySearch(data, rulesContent, dynamicContent);
      totalTokens += calculateTokens(finalResponse);
    }
    
    // Parse response
    const responseText = finalResponse.content?.[0]?.text || data.content?.[0]?.text;
    if (!responseText) {
      throw new Error('Claude returned empty response. This may be due to content filtering or API issues.');
    }

    // Log AI response to file
    const responseLogEntry = `AI RESPONSE:\n${responseText}\n\n`;
    await fs.appendFile('log.txt', responseLogEntry, 'utf8');
    
    const parsedResponse = parseGameResponse(responseText);
    
    // Log AI thinking to console only
    if (parsedResponse.ai_thinking) {
      broadcastLog('🤖 AI thinking: ' + (parsedResponse.ai_thinking || ''));
    }
    
    // Calculate new character change score
    const newCharacterEvolution = parsedResponse.newCharacterEvolution || 0;
    
    // Save memory if important enough
    if (parsedResponse.importance >= 0.1) {
      const location = `${gameState.location.region}, ${gameState.location.settlement}, ${gameState.location.place}`;
      const gameTime = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year}, ${gameState.time.time}`;
      
      await saveMemory({
        content: parsedResponse.memory,
        importance: parsedResponse.importance,
        emotions: parsedResponse.newEmotions,
        time: gameTime,
        location: location
      });
    } else {
      broadcastLog(`🧠 Memory not saved - importance too low: ${parsedResponse.importance}`);
    }
    
    // Update history with scene description, bilbo reaction and world response
    const updatedHistory = [...gameState.history];
    
    // Add scene description before everything
    if (parsedResponse.reaction) {
      // Get current location and time for history entries
      const currentLocation = parsedResponse.newLocation || gameState.location;
      const currentTime = parsedResponse.newTime || gameState.time;
      
      // Add Bilbo's reaction
      updatedHistory.push({
        content: parsedResponse.reaction,
        type: 'bilbo',
        description: parsedResponse.newEmotions.join(', '),
        location: currentLocation,
        time: currentTime
      });
      
      // Add World response
      updatedHistory.push({
        content: parsedResponse.worldResponse,
        type: 'world' as const,
        description: '',
        location: currentLocation,
        time: currentTime
      });
    }

    // Build response
    return {
      reaction: parsedResponse.reaction,
      worldResponse: parsedResponse.worldResponse,
      usage: { total: totalTokens },
      gameState: {
        bilboState: {
          character: parsedResponse.newCharacter || gameState.bilboState.character,
          characterEvolution: newCharacterEvolution,
          health: parsedResponse.newHealth || gameState.bilboState.health,
          tasks: parsedResponse.newTask || gameState.bilboState.tasks,
          plans: parsedResponse.newPlans || gameState.bilboState.plans,
          thoughts: parsedResponse.newThoughts || gameState.bilboState.thoughts,
          emotions: parsedResponse.newEmotions || gameState.bilboState.emotions
        },
        location: parsedResponse.newLocation || gameState.location,
        time: parsedResponse.newTime || gameState.time,
        environment: parsedResponse.newEnvironment || gameState.environment,
        event: parsedResponse.worldResponse,
        history: updatedHistory
      }
    };
  } catch (error) {
    throw error; // Let the API endpoint handle logging
  }
}

// ========================
// API ROUTES
// ========================

app.get('/api/config', (req, res) => {
  const publicConfig = {
    model: gameConfig.api.anthropic.model
  };
  res.json(publicConfig);
});

app.post('/api/process-game-action', async (req, res) => {
  try {
    const { gameState, action, language = 'ru' } = req.body;
    const response = await processGameAction(gameState, action, language);
    res.json(response);
  } catch (error) {
    broadcastLog(`❌ API Error in process-game-action: ${error.message}`);
    res.status(500).json({
      error: 'Failed to process game action',
      message: "Error processing action. Please try again.",
      usage: { total: 0 }
    });
  }
});

// Server-Sent Events endpoint for log streaming
app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Send buffer history
  logBuffer.forEach(message => {
    res.write(`data: ${JSON.stringify({ type: 'log', message })}\n\n`);
  });
  
  // Add to subscribers
  logSubscribers.push(res);
  
  // Clean up on disconnect
  req.on('close', () => {
    const index = logSubscribers.indexOf(res);
    if (index > -1) logSubscribers.splice(index, 1);
  });
});

app.get('/api/memories', async (req, res) => {
  try {
    if (!memoryTable) {
      broadcastLog('📋 No memory table, returning empty array');
      return res.json([]);
    }
    
    const { query, threshold = 0 } = req.query;
    
    if (query) {
      // Search memories
      const searchThreshold = parseFloat(threshold as string);
      broadcastLog(`📋 Searching memories: "${query}" (threshold: ${searchThreshold})`);
      
      const memories = await findMemory(query as string, 100, searchThreshold);
      res.json(memories);
    } else {
      // Return all memories
      const memories = await memoryTable
        .query()
        .toArray();
      
      broadcastLog(`📋 Found ${memories.length} memories`);
      
      // Sort by createdAt descending
      memories.sort((a, b) => b.createdAt - a.createdAt);
      
      res.json(memories);
    }
  } catch (error) {
    broadcastLog(`❌ Error fetching memories: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/clear-memories', async (req, res) => {
  try {
    await clearMemory();
    res.json({ success: true });
  } catch (error) {
    broadcastLog(`❌ Error clearing memories: ${error.message}`);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

app.post('/api/save-memory', async (req, res) => {
  try {
    const rawMemoryData = req.body;
    
    // Clean memory data - keep only expected fields
    const memoryData = {
      id: rawMemoryData.id || Date.now().toString(),
      content: rawMemoryData.content,
      time: rawMemoryData.time,
      location: rawMemoryData.location,
      importance: rawMemoryData.importance,
      emotions: rawMemoryData.emotions,
      createdAt: rawMemoryData.createdAt || Date.now(),
      embeddings: rawMemoryData.embeddings
    };
    
    // Create embeddings if they don't exist (for loaded saves)
    if (!memoryData.embeddings) {
      broadcastLog('Creating embeddings for loaded memory: ' + memoryData.content.substring(0, 50) + '...');
      memoryData.embeddings = await createEmbedding(memoryData.content);
    }
    
    if (!memoryTable) {
      memoryTable = await memoryDatabase.createTable('bilbo_memories', [memoryData]);
    } else {
      await memoryTable.add([memoryData]);
    }
    
    res.json({ success: true });
  } catch (error) {
    broadcastLog(`❌ Error saving memory: ${error.message}`);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

// Save game state and memory
app.post('/api/save-state', async (req, res) => {
  try {
    const { gameState, saveName = 'savegame' } = req.body;
    
    // Get memories if they exist
    let memories = [];
    if (memoryTable) {
      memories = await memoryTable
        .query()
        .toArray();
    }
    
    // Save game state and memories in one JSON file
    const saveData = {
      gameState,
      memories,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    const savePath = path.join(__dirname, '..', `${saveName}.json`);
    await fs.writeFile(savePath, JSON.stringify(saveData, null, 2), 'utf8');
    
    broadcastLog(`💾 Saved game state and ${memories.length} memories to ${saveName}.json`);
    res.json({ 
      success: true, 
      message: `Saved game state and ${memories.length} memories`,
      files: [`${saveName}.json`]
    });
    
  } catch (error) {
    broadcastLog(`❌ Error saving state: ${error.message}`);
    res.status(500).json({ error: 'Failed to save state', details: error.message });
  }
});

// Load game state and memory
app.post('/api/load-state', async (req, res) => {
  try {
    const { saveName = 'savegame' } = req.body;
    
    // Load game state from JSON file
    const savePath = path.join(__dirname, '..', `${saveName}.json`);
    const saveData = JSON.parse(await fs.readFile(savePath, 'utf8'));
    
    // Clear existing memory
    await clearMemory();
    
    // Load memories from save data if they exist
    if (saveData.memories && saveData.memories.length > 0) {
      // Recreate memory table with loaded data
      memoryTable = await memoryDatabase.createTable('bilbo_memories', saveData.memories);
      broadcastLog(`💾 Loaded game state and ${saveData.memories.length} memories from ${saveName}.json`);
      
      res.json({
        success: true,
        gameState: saveData.gameState,
        message: `Loaded game state and ${saveData.memories.length} memories`,
        timestamp: saveData.timestamp
      });
    } else {
      broadcastLog(`💾 Loaded game state from ${saveName}.json (no memories)`);
      res.json({
        success: true,
        gameState: saveData.gameState,
        message: 'Loaded game state (no memories)',
        timestamp: saveData.timestamp
      });
    }
    
  } catch (error) {
    broadcastLog(`❌ Error loading state: ${error.message}`);
    res.status(500).json({ error: 'Failed to load state', details: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ========================
// SERVER INITIALIZATION
// ========================

async function startServer() {
  try {
    gameConfig = await loadGameConfig();
    broadcastLog('✅ Game configuration loaded');

    await initializeMemory();
    broadcastLog('✅ Memory database initialized');
    
    // Clear log file on startup
    await fs.writeFile('log.txt', `=== GAME SESSION STARTED ${new Date().toISOString()} ===\n\n`, 'utf8');
    broadcastLog('✅ Log file initialized');

    const server = app.listen(PORT, () => {
      broadcastLog(`🚀 Hobbit Game Server running on http://localhost:${PORT}`);
      broadcastLog('🎮 Game ready with unified API and memory integration!');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        broadcastLog(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (error) {
    broadcastLog(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();