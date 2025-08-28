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
    };
  };
  game: {
    model: string;
  };
}

interface BilboState {
  character: string;
  characterEvolution: number; // Accumulated character changes: +good, -evil
  health: string;
  tasks: string;
  plans: string;
  thoughts: string;
  emotions: string;
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
  environment: string;
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
    try {
      // Try Xenova/all-MiniLM-L6-v2 which is more reliable
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      });
    } catch (error) {
      console.log('Fallback to distilbert-base-uncased...');
      // Fallback to a more basic model if the first one fails
      embedder = await pipeline('feature-extraction', 'Xenova/distilbert-base-uncased', {
        quantized: true,
      });
    }
    console.log('✅ Embedding model loaded');
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

async function findMemory(query: string, limit: number = 3): Promise<MemoryRecord[]> {
  if (!memoryTable) return [];
  
  try {
    // Create embedding for the query
    const queryEmbedding = await createEmbedding(query);
    
    // Use vector search with real embeddings
    const results = await memoryTable
      .vectorSearch(queryEmbedding)
      .limit(limit)
      .toArray();
    
    console.log(`Found ${results.length} memories for: "${query}"`);
    return results;
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

async function buildPrompt(gameState: GameState, action: string, language: string): Promise<string> {
  const promptPath = path.join(__dirname, `../public/locales/${language}/prompt.md`);
  const promptTemplate = await fs.readFile(promptPath, 'utf8');
  
  const location = `${gameState.location.region} → ${gameState.location.settlement} → ${gameState.location.place}`;
  const time = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year} ${gameState.time.era}, ${gameState.time.time}`;
  const recentHistory = (gameState.history || []).slice(-4, -1)
    .map(entry => entry.content)
    .join('\n---\n');
  
  return promptTemplate
    .replace('{{location}}', location)
    .replace('{{time}}', time)
    .replace('{{environment}}', gameState.environment)
    .replace('{{character}}', gameState.bilboState.character)
    .replace('{{characterEvolution}}', gameState.bilboState.characterEvolution.toString())
    .replace('{{plans}}', gameState.bilboState.plans || 'no special plans')
    .replace('{{health}}', gameState.bilboState.health)
    .replace('{{tasks}}', gameState.bilboState.tasks || 'resting')
    .replace('{{thoughts}}', gameState.bilboState.thoughts)
    .replace('{{emotions}}', gameState.bilboState.emotions)
    .replace('{{recentHistory}}', recentHistory)
    .replace('{{event}}', gameState.event || 'начало игры')
    .replace('{{action}}', action)
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

async function callClaudeWithTools(prompt: string): Promise<any> {
  const tools = [{
    name: "search_memory",
    description: "Search Bilbo's memories for relevant past experiences",
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
    model: gameConfig.game.model,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }],
    tools: tools
  });
}

async function handleMemorySearch(data: any, originalPrompt: string): Promise<any> {
  const toolUse = data.content.find((item: any) => item.type === 'tool_use');
  
  if (toolUse && toolUse.name === 'search_memory') {
    const { query, limit = 3 } = toolUse.input;
    console.log(`🧠 AI is searching memory for: "${query}"`);
    
    const memories = await findMemory(query, limit);
    
    const memoriesText = memories.length > 0 
      ? memories.map(m => {
          // Truncate long memories to save tokens
          const content = m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content;
          return `${content} (важность: ${m.importance})`;
        }).join('\n')
      : 'No memories found';
    
    console.log(`🧠 AI found ${memories.length} memories:`, memoriesText);
    
    // Continue conversation with tool result
    return await callClaude({
      model: gameConfig.game.model,
      max_tokens: 2000,
      messages: [
        { role: 'user', content: originalPrompt },
        { role: 'assistant', content: data.content },
        { 
          role: 'user', 
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: memoriesText
            }
          ]
        }
      ]
    });
  }
  
  return data;
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
    // Build prompt from template
    const promptContent = await buildPrompt(gameState, action, language);
    
    // Log prompt to file
    const timestamp = new Date().toISOString();
    const logEntry = `\n=== ${timestamp} ===\nPROMPT:\n${promptContent}\n\n`;
    await fs.appendFile('log.txt', logEntry, 'utf8');
    
    // Call Claude with function calling
    const data = await callClaudeWithTools(promptContent);
    let totalTokens = calculateTokens(data);
    
    // Handle memory search if needed
    let finalResponse = data;
    if (data.content && data.content.some((item: any) => item.type === 'tool_use')) {
      finalResponse = await handleMemorySearch(data, promptContent);
      totalTokens += calculateTokens(finalResponse);
    }
    
    // Parse response
    const responseText = finalResponse.content?.[0]?.text || data.content?.[0]?.text;
    if (!responseText) {
      throw new Error('Invalid response format: no text content found');
    }
    
    // Log AI response to file
    const responseLogEntry = `AI RESPONSE:\n${responseText}\n\n`;
    await fs.appendFile('log.txt', responseLogEntry, 'utf8');
    
    const parsedResponse = parseGameResponse(responseText);
    
    // Calculate new character change score
    const newCharacterEvolution = parsedResponse.newCharacterEvolution || 0;
    
    // Save memory if important enough
    if (parsedResponse.importance >= 0.1) {
      const location = `${gameState.location.region} → ${gameState.location.settlement} → ${gameState.location.place}`;
      const gameTime = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year}, ${gameState.time.time}`;
      
      await saveMemory({
        content: parsedResponse.memory,
        summary: parsedResponse.summary,
        theme: parsedResponse.theme,
        importance: parsedResponse.importance,
        emotions: parsedResponse.newEmotions
      }, gameTime, location);
    }
    
    // Update history with scene description, bilbo reaction and world response
    const updatedHistory = [...gameState.history];
    
    // Add scene description before everything
    if (parsedResponse.reaction) {
      const location = (parsedResponse.newLocation || gameState.location);
      const time = (parsedResponse.newTime || gameState.time);
      const environment = parsedResponse.newEnvironment || gameState.environment;
      
      // Add Bilbo's reaction
      updatedHistory.push({
        content: parsedResponse.reaction,
        type: 'bilbo',
        description: parsedResponse.newEmotions
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
    game: gameConfig.game
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
    const memories = await memoryTable
      .query()
      .limit(10)
      .toArray();
    
    console.log(`📋 Found ${memories.length} memories`);
    
    // Sort by createdAt descending
    memories.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json(memories);
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