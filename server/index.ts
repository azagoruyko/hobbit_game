import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { pipeline } from '@xenova/transformers';
import { generateText, tool } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================
// TYPES & INTERFACES
// ========================

interface GameConfig {
  api: {
    llm: {
      provider: 'ollama';
      model: string;
      baseUrl?: string;
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



// ========================
// GLOBALS & CONFIGURATION
// ========================

const RECENT_HISTORY_SIZE = 6;
const MEMORY_RELEVANCE_THRESHOLD = 0.5;
const MAX_MEMORY_SEARCH_DEPTH = 5;

// ========================
// AI TOOLS
// ========================

function getTools() {
  return {
    search_memory: tool({
      description: "Search Bilbo's memories for relevant past experiences, including items he has found or acquired. Use this to check what objects, weapons, tools Bilbo has with him.",
      parameters: z.object({
        query: z.string().describe("Specific episode in memory, like 'I met Gandalf', 'I found ring', 'sword', 'rope', 'food', 'clothes'"),
        limit: z.number().optional().describe("Maximum number of results to return")
      }),
      execute: async ({ query, limit = 5 }: any) => {
        broadcastLog(`🧠 AI is searching memory for: "${query}"`);
        const memories = await findMemory(query, limit);
        const memoriesText = memories.length > 0 ?
          memories.map((m: any) => `${m.time}: ${m.content}`).join('\n') :
          'No relevant memories found';

        if (memories.length > 0) {
          const memoriesLogEntry = `RELEVANT MEMORIES:\n${memoriesText}\n\n`;
          await fs.appendFile('log.txt', memoriesLogEntry, 'utf8');
        }

        return memoriesText;
      }
    } as any)
  };
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
  // Ensure text is a string to avoid tokenization errors (e.g. text.split is not a function)
  const safeText = typeof text === 'string' ? text :
    Array.isArray(text) ? (text as any[]).join('\n') :
      String(text || '');

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

  const output = await embedder(safeText, { pooling: 'mean', normalize: true });
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
  } catch (error: any) {
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
    const relevantMemories = searchResults.filter((result: any) => {
      // Convert distance to similarity (distance closer to 0 = more similar)
      const similarity = 1 - (result._distance || 0);
      return similarity >= threshold;
    }).slice(0, limit); // Apply original limit after filtering

    broadcastLog(`Found ${relevantMemories.length}/${searchResults.length} relevant memories for: "${query}" (threshold: ${threshold})`);

    return relevantMemories.map((memory: any) => ({
      content: memory.content,
      time: memory.time,
      location: memory.location,
      importance: memory.importance,
      emotions: memory.emotions,
      createdAt: memory.createdAt,
      similarity: memory._distance ? (1 - memory._distance).toFixed(3) : 'N/A'
      // embeddings excluded
    }));
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
    broadcastLog(`❌ Error loading game config: ${error.message}`);
    throw new Error('Failed to load game configuration');
  }
}

async function buildPrompt(gameState: GameState, action: string, language: string): Promise<{ rulesContent: string, dynamicContent: string }> {
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
      allMemories.sort((a: any, b: any) => b.createdAt - a.createdAt);
      const recentMemories = allMemories.slice(0, RECENT_HISTORY_SIZE);

      // Reverse order for chronological flow in prompt (oldest first → newest last)
      recentMemories.reverse();

      recentHistory = recentMemories
        .map((memory: any) => memory.content)
        .join('\n---\n');

      useMemories = true;
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


function parseGameResponse(responseText: string): any {
  // Extract JSON block from markdown/text
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const jsonStr = jsonMatch[0];

  try {
    // Rely exclusively on jsonrepair to handle any formatting quirks
    const repairedJson = jsonrepair(jsonStr);
    return JSON.parse(repairedJson);
  } catch (error: any) {
    broadcastLog(`❌ JSON parse error: ${error.message}\nRaw JSON: ${jsonStr.substring(0, 100)}...`);
    throw error;
  }
}



async function processGameAction(gameState: GameState, action: string, language: string = 'ru'): Promise<ApiResponse> {
  try {
    // Build prompt from templates
    const { rulesContent, dynamicContent } = await buildPrompt(gameState, action, language);

    // Log prompt to file
    const timestamp = new Date().toISOString();
    const logEntry = `\n=== ${timestamp} ===\nRULES:\n${rulesContent}\n\nDYNAMIC CONTENT:\n${dynamicContent}\n\n`;
    await fs.appendFile('log.txt', logEntry, 'utf8');

    // Check if we have enough memories to justify search function
    const allMemories = memoryTable ? await memoryTable.query().toArray() : [];
    const hasEnoughMemories = allMemories.length > MAX_MEMORY_SEARCH_DEPTH;

    // Initialize Ollama model
    const ollamaInstance = createOllama({
      baseURL: gameConfig.api.llm.baseUrl
    });
    const model = ollamaInstance(gameConfig.api.llm.model);

    // Call LLM using Vercel AI SDK
    const { text: responseText, usage } = await generateText({
      model,
      system: rulesContent,
      prompt: dynamicContent,
      tools: hasEnoughMemories ? getTools() : undefined,
      maxSteps: MAX_MEMORY_SEARCH_DEPTH,
      onStepFinish: ({ toolResults }: any) => {
        if (toolResults && toolResults.length > 0) {
          broadcastLog(`🛠️ Tool execution finished: ${toolResults.map((r: any) => r.toolName).join(', ')}`);
        }
      }
    } as any);

    if (!responseText) {
      throw new Error('LLM returned empty response. This may be due to content filtering or API issues.');
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
      usage: { total: (usage as any).totalTokens || ((usage as any).inputTokens || 0) + ((usage as any).outputTokens || 0) || ((usage as any).promptTokens || 0) + ((usage as any).completionTokens || 0) },
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
    broadcastLog(`❌ Error in processGameAction: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ========================
// API ROUTES
// ========================

app.get('/api/config', (req: express.Request, res: express.Response) => {
  const publicConfig = {
    model: gameConfig.api.llm.model
  };
  res.json(publicConfig);
});

app.post('/api/process-game-action', async (req: express.Request, res: express.Response) => {
  try {
    const { gameState, action, language = 'ru' } = req.body;
    const response = await processGameAction(gameState, action, language);
    res.json(response);
  } catch (error: any) {
    broadcastLog(`❌ API Error in process-game-action: ${error.message}`);
    res.status(500).json({
      error: 'Failed to process game action',
      message: "Error processing action. Please try again.",
      usage: { total: 0 }
    });
  }
});

// Server-Sent Events endpoint for log streaming
app.get('/api/logs/stream', (req: express.Request, res: express.Response) => {
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

app.get('/api/memories', async (req: express.Request, res: express.Response) => {
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
      memories.sort((a: any, b: any) => b.createdAt - a.createdAt);

      res.json(memories);
    }
  } catch (error: any) {
    broadcastLog(`❌ Error fetching memories: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/clear-memories', async (req: express.Request, res: express.Response) => {
  try {
    await clearMemory();
    res.json({ success: true });
  } catch (error: any) {
    broadcastLog(`❌ Error clearing memories: ${error.message}`);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

app.post('/api/save-memory', async (req: express.Request, res: express.Response) => {
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
  } catch (error: any) {
    broadcastLog(`❌ Error saving memory: ${error.message}`);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});



app.get('*', (req: express.Request, res: express.Response) => {
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
  } catch (error: any) {
    broadcastLog(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();