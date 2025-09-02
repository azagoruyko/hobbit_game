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
  theme: string;
  importance: number;
  emotions: string;
  createdAt: number;
}

// ========================
// GLOBALS & CONFIGURATION
// ========================

const RECENT_HISTORY_SIZE = 3; // Number of recent history entries to include in prompts
const MEMORY_RELEVANCE_THRESHOLD = 0.6; // Minimum similarity threshold for memory search

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../dist')));

let gameConfig: GameConfig;

// ========================
// MEMORY INTEGRATION
// ========================

let memoryDatabase: any = null;
let memoryTable: any = null;
let embedder: any = null;

async function createEmbedding(text: string): Promise<number[]> {
  if (!embedder) {
    console.log('🤖 Loading embedding model...');
    
    const embeddingModel = gameConfig.api.embedding || 'Xenova/multilingual-e5-small';
    console.log(`Loading ${embeddingModel}...`);
    
    embedder = await pipeline('feature-extraction', embeddingModel, {
      quantized: true,
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          console.log(`Downloading: ${progress.name} - ${Math.round(progress.progress || 0)}%`);
        }
      }
    });
    
    console.log(`✅ Embedding model loaded: ${embeddingModel}`);
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
      console.log('🧠 Memory database loaded with existing memories');
    } catch {
      // Table doesn't exist yet, will be created when first memory is saved
      memoryTable = null;
      console.log('🧠 Memory database ready (no existing memories)');
    }
  } catch (error) {
    console.error('Failed to initialize memory database:', error);
  }
}

async function clearMemory() {
  try {
    if (memoryDatabase) {
      await memoryDatabase.dropTable('bilbo_memories');
      console.log('🧹 Cleared all memories for new game');
    }
    memoryTable = null;
  } catch (error) {
    // Table might not exist, that's fine
    console.log('🧹 Memory already empty');
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

    console.log(`Found ${relevantMemories.length}/${searchResults.length} relevant memories for: "${query}" (threshold: ${threshold})`);
    
    if (relevantMemories.length < searchResults.length) {
      console.log(`Filtered out ${searchResults.length - relevantMemories.length} low-relevance memories`);
    }
    
    return relevantMemories.map(memory => ({
      content: memory.content,
      time: memory.time,
      location: memory.location,
      theme: memory.theme,
      importance: memory.importance,
      emotions: memory.emotions,
      createdAt: memory.createdAt,
      similarity: memory._distance ? (1 - memory._distance).toFixed(3) : 'N/A'
      // embeddings excluded
    }));
  } catch (error) {
    console.error('Error finding memories:', error);
    return [];
  }
}

async function saveMemory(memoryData: {
  content: string;
  summary: string;
  theme: string;
  importance: number;
  emotions: string;
}, time: string, location: string): Promise<void> {
  try {
    // Create embedding for the memory content
    const contentEmbedding = await createEmbedding(memoryData.content);
    
    const memoryRecord = {
      id: Date.now().toString(),
      content: memoryData.content,
      embeddings: contentEmbedding,
      time,
      location,
      theme: memoryData.theme,
      importance: memoryData.importance,
      emotions: memoryData.emotions,
      createdAt: Date.now()
    };
    
    if (!memoryTable) {
      console.log('Creating memory table with vector support...');
      try {
        // Drop existing table if it exists with wrong schema
        await memoryDatabase.dropTable('bilbo_memories');
      } catch {
        // Table doesn't exist, that's fine
      }
      
      memoryTable = await memoryDatabase.createTable('bilbo_memories', [memoryRecord]);
      console.log(`Created table and saved memory: ${memoryRecord.content}`);
    } else {
      await memoryTable.add([memoryRecord]);
      console.log(`Saved memory: ${memoryRecord.content}`);
    }
  } catch (error) {
    console.error('Error saving memory:', error);
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
    console.error('Error loading game config:', error);
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
    console.warn(`Prompt files not found for language ${language}, falling back to Russian`);
    rulesPath = path.join(__dirname, `../public/locales/ru/rules.md`);
    promptPath = path.join(__dirname, `../public/locales/ru/prompt.md`);
    rulesContent = await fs.readFile(rulesPath, 'utf8');
    dynamicTemplate = await fs.readFile(promptPath, 'utf8');
  }
  
  const location = `${gameState.location.region} → ${gameState.location.settlement} → ${gameState.location.place}`;
  const time = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year} ${gameState.time.era}, ${gameState.time.time}`;
  const recentHistory = (gameState.history || []).slice(-(RECENT_HISTORY_SIZE + 1), -1)
    .map(entry => entry.content)
    .join('\n---\n');
  
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
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(gameConfig.api.anthropic.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': gameConfig.api.anthropic.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 529 && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Claude API overloaded (529), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Claude API failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Claude API error, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function callClaudeWithTools(rulesContent: string, dynamicContent: string): Promise<any> {
  const tools = [{
    name: "search_memory",
    description: "Search Bilbo's memories for relevant past experiences. You can call this multiple times for different topics.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string", 
          description: "What to search for in memories"
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

  return await callClaude({
    model: gameConfig.api.anthropic.model,
    max_tokens: 3000,
    messages: [
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
    ],
    tools: tools
  });
}

async function handleMemorySearch(data: any, rulesContent: string, dynamicContent: string): Promise<any> {
  // Find all memory search tool uses (support multiple searches)
  const toolUses = data.content.filter((item: any) => item.type === 'tool_use' && item.name === 'search_memory');
  
  if (toolUses.length === 0) {
    return data;
  }
  
  // Execute all memory searches and collect results
  const toolResults = [];
  for (const toolUse of toolUses) {
    const { query, limit = 3 } = toolUse.input;
    console.log(`🧠 AI is searching memory for: "${query}"`);
    
    const memories = await findMemory(query, limit);
    
    const memoriesText = memories.length > 0 ? memories.map(m => `${m.content} (importance: ${m.importance})`).join('\n') : 'No relevant memories found';
    
    console.log(`🧠 AI found ${memories.length} memories for "${query}"`);
    
    toolResults.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: memoriesText
    });
  }
  
  // Continue the same conversation - NO tools, NO rules repetition
  const followupResponse = await callClaude({
    model: gameConfig.api.anthropic.model,
    max_tokens: 2500,
    messages: [
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
      },
      { role: 'assistant', content: data.content },
      { 
        role: 'user', 
        content: toolResults
      },
      { 
        role: 'user', 
        content: 'Now provide your complete JSON game response based on the search results above.'
      }
    ]
    // NO tools array = AI knows to give final JSON response
  });
  
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
    console.error('JSON parse error:', parseError);
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
    
    // Call Claude with function calling and cache control
    const data = await callClaudeWithTools(rulesContent, dynamicContent);
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
      console.error('Empty response from Claude:', finalResponse);
      throw new Error('Claude returned empty response. This may be due to content filtering or API issues.');
    }

    // Log AI response to file
    const responseLogEntry = `AI RESPONSE:\n${responseText}\n\n`;
    await fs.appendFile('log.txt', responseLogEntry, 'utf8');
    
    const parsedResponse = parseGameResponse(responseText);
    
    // Log AI thinking to console only
    if (parsedResponse.ai_thinking) {
      console.log('🤖 AI thinking:', parsedResponse.ai_thinking);
    }
    
    // Calculate new character change score
    const newCharacterEvolution = parsedResponse.newCharacterEvolution || 0;
    
    // Save memory if important enough
    if (parsedResponse.importance >= 0.1) {
      const location = `${gameState.location.region} → ${gameState.location.settlement} → ${gameState.location.place}`;
      const gameTime = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year}, ${gameState.time.time}`;
      
      // Add time and location prefix to memory content
      const timePrefix = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year}`;
      const locationPrefix = `${gameState.location.region}, ${gameState.location.settlement}`;
      const memoryWithLocation = `${timePrefix}, ${locationPrefix}: ${parsedResponse.memory}`;
      
      await saveMemory({
        content: memoryWithLocation,
        summary: parsedResponse.summary,
        theme: parsedResponse.theme,
        importance: parsedResponse.importance,
        emotions: parsedResponse.newEmotions
      }, gameTime, location);
    } else {
      console.log(`🧠 Memory not saved - importance too low: ${parsedResponse.importance}`);
    }
    
    // Update history with scene description, bilbo reaction and world response
    const updatedHistory = [...gameState.history];
    
    // Add scene description before everything
    if (parsedResponse.reaction) {
      // Add Bilbo's reaction
      updatedHistory.push({
        content: parsedResponse.reaction,
        type: 'bilbo',
        description: parsedResponse.newEmotions.join(', '),
      });
      
      // Add World response
      updatedHistory.push({
        content: parsedResponse.worldResponse,
        type: 'world' as const,
        description: ''
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
    console.error('Error processing game action:', error);
    throw error;
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
    console.error('Error in process-game-action:', error);
    res.status(500).json({
      error: 'Failed to process game action',
      message: "Error processing action. Please try again.",
      usage: { total: 0 }
    });
  }
});

app.get('/api/memories', async (req, res) => {
  try {
    console.log('📋 Memory request received');
    
    if (!memoryTable) {
      console.log('📋 No memory table, returning empty array');
      return res.json([]);
    }
    
    const { query, threshold = 0 } = req.query;
    
    if (query) {
      // Search memories
      const searchThreshold = parseFloat(threshold as string);
      console.log(`📋 Searching memories: "${query}" (threshold: ${searchThreshold})`);
      
      const memories = await findMemory(query as string, 100, searchThreshold);
      res.json(memories);
    } else {
      // Return all memories
      const memories = await memoryTable
        .query()
        .toArray();
      
      console.log(`📋 Found ${memories.length} memories`);
      
      // Sort by createdAt descending
      memories.sort((a, b) => b.createdAt - a.createdAt);
      
      res.json(memories);
    }
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/clear-memories', async (req, res) => {
  try {
    await clearMemory();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing memories:', error);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

app.post('/api/save-memory', async (req, res) => {
  try {
    const memoryData = req.body;
    
    // Create embeddings if they don't exist (for loaded saves)
    if (!memoryData.embeddings) {
      console.log('Creating embeddings for loaded memory:', memoryData.content.substring(0, 50) + '...');
      memoryData.embeddings = await createEmbedding(memoryData.content);
    }
    
    if (!memoryTable) {
      memoryTable = await memoryDatabase.createTable('bilbo_memories', [memoryData]);
    } else {
      await memoryTable.add([memoryData]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving memory:', error);
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
    
    console.log(`💾 Saved game state and ${memories.length} memories to ${saveName}.json`);
    res.json({ 
      success: true, 
      message: `Saved game state and ${memories.length} memories`,
      files: [`${saveName}.json`]
    });
    
  } catch (error) {
    console.error('Error saving state:', error);
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
      console.log(`💾 Loaded game state and ${saveData.memories.length} memories from ${saveName}.json`);
      
      res.json({
        success: true,
        gameState: saveData.gameState,
        message: `Loaded game state and ${saveData.memories.length} memories`,
        timestamp: saveData.timestamp
      });
    } else {
      console.log(`💾 Loaded game state from ${saveName}.json (no memories)`);
      res.json({
        success: true,
        gameState: saveData.gameState,
        message: 'Loaded game state (no memories)',
        timestamp: saveData.timestamp
      });
    }
    
  } catch (error) {
    console.error('Error loading state:', error);
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
    console.log('✅ Game configuration loaded');

    await initializeMemory();
    console.log('✅ Memory database initialized');
    
    // Clear log file on startup
    await fs.writeFile('log.txt', `=== GAME SESSION STARTED ${new Date().toISOString()} ===\n\n`, 'utf8');
    console.log('✅ Log file initialized');

    const server = app.listen(PORT, () => {
      console.log(`🚀 Hobbit Game Server running on http://localhost:${PORT}`);
      console.log('🎮 Game ready with unified API and memory integration!');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();