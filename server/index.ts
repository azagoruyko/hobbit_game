import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

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
    maxTokens: {
      formatAction: number;
      generateResponse: number;
    };
    historyLength: number;
    summaryParagraphLength: number;
    language: string;
  };
}

interface GameState {
  location: {
    region: string;
    settlement: string;
    place: string;
  };
  character: string;
  state: string;
  will: string;
  environment: string;
  time: {
    day: number;
    month: string;
    year: number;
    era: string;
    timeOfDay: string;
    season: string;
  };
  history: any[];
  memory: any;
  lastSummaryLength?: number;
}

interface ApiResponse {
  formattedAction?: string;
  narration?: string;
  keyEvent?: string | null;
  usage: { total: number };
  gameState?: GameState;
  error?: string;
}

interface CompressionResult {
  compressionNeeded: boolean;
  historySummary?: string;
  lastSummaryLength?: number;
  usage?: { total: number };
}

// ========================
// GLOBALS & CONFIGURATION
// ========================

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let gameConfig: GameConfig;
let translations: {
  [language: string]: {
    prompts: {
      formatAction: string;
      gamemasterSystem: string;
      historySummary: string;
    }
  }
};

// ========================
// MIDDLEWARE SETUP
// ========================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// ========================
// CONFIGURATION & SETUP FUNCTIONS
// ========================

/**
 * Loads game configuration from game.json file
 */
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

/**
 * Loads translations from JSON files
 */
async function loadTranslations() {
  try {
    const localesDir = path.join(__dirname, '../public/locales');
    const languages = ['ru', 'en'];
    const result: any = {};

    for (const lang of languages) {
      const promptsPath = path.join(localesDir, lang, 'prompts.json');
      const promptsData = await fs.readFile(promptsPath, 'utf-8');
      result[lang] = {
        prompts: JSON.parse(promptsData)
      };
    }

    return result;
  } catch (error) {
    console.error('Error loading translations:', error);
    throw new Error('Failed to load translations');
  }
}

/**
 * Writes log entry to log.txt file for debugging
 */
async function writeLogEntry(prompt: string): Promise<void> {
  const logEntry = `\n=== ${new Date().toLocaleString()} - ${prompt.length} chars ===\n` +
    `${prompt}\n` +
    `=== END ===\n\n`;

  try {
    await fs.appendFile('log.txt', logEntry, 'utf8');
  } catch (error) {
    console.log('Failed to write log:', error);
  }
}

// ========================
// API UTILITY FUNCTIONS
// ========================

/**
 * Retry mechanism for Claude API calls with exponential backoff
 */
async function retryApiCall(apiCall: () => Promise<Response>, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await apiCall();
      if (response.status === 529 && attempt < maxRetries) {
        console.log(`API overloaded (529), retrying in ${attempt * 2}s... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`API error, retrying in ${attempt * 2}s... (attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Makes a Claude API request with the given prompt and token limit
 */
async function makeClaudeApiRequest(prompt: string, maxTokens: number): Promise<any> {
  const response = await retryApiCall(() => fetch(gameConfig.api.anthropic.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': gameConfig.api.anthropic.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: gameConfig.game.model,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  }));

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Calculates total token usage from Claude API response
 */
function calculateTokenUsage(data: any): number {
  return (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
}

// ========================
// PROMPT PROCESSING FUNCTIONS
// ========================

/**
 * Builds context for action formatting
 */
function buildActionContext(gameState: GameState) {
  const recentHistoryEntries = (gameState.history || []).slice(-3);
  const recentHistory = recentHistoryEntries
    .map(entry => typeof entry === 'string' ? entry : entry.text)
    .join('\n\n---\n\n');

  const location = `${gameState.location?.region || ''} → ${gameState.location?.settlement || ''} → ${gameState.location?.place || ''}`;
  const timeInfo = `${gameState.time.day} ${gameState.time.month} ${gameState.time.year} ${gameState.time.era}, ${gameState.time.timeOfDay}, ${gameState.time.season}`;

  return {
    recentHistory: recentHistory,
    currentState: gameState.state,
    will: gameState.will,
    location,
    timeInfo
  };
}

/**
 * Builds full game master prompt with all template variables
 */
function buildGameMasterPrompt(gameState: GameState, formattedAction: string, language: string = 'ru'): string {
  const historySummary = gameState.memory?.historySummary || null;
  const lastSummaryLength = gameState.lastSummaryLength || 0;
  
  // If history is short - use all of it
  if (gameState.history.length <= gameConfig.game.historyLength) {
    const recentHistory = gameState.history
      .map(entry => typeof entry === 'string' ? entry : entry.text)
      .join('\n\n---\n\n');
    
    const promptTemplate = Array.isArray(translations[language].prompts.gamemasterSystem)
      ? translations[language].prompts.gamemasterSystem.join('\n')
      : translations[language].prompts.gamemasterSystem;
      
    return promptTemplate
      .replace('{{currentState.location.region}}', gameState.location.region)
      .replace('{{currentState.location.settlement}}', gameState.location.settlement)
      .replace('{{currentState.location.place}}', gameState.location.place)
      .replace('{{currentState.health}}', String(gameState.health))
      .replace('{{currentState.state}}', gameState.state)
      .replace('{{currentState.will}}', gameState.will)
      .replace('{{currentState.environment}}', gameState.environment)
      .replace('{{currentState.time.day}}', String(gameState.time.day))
      .replace('{{currentState.time.month}}', gameState.time.month)
      .replace('{{currentState.time.year}}', String(gameState.time.year))
      .replace('{{currentState.time.era}}', gameState.time.era)
      .replace('{{currentState.time.timeOfDay}}', gameState.time.timeOfDay)
      .replace('{{currentState.time.season}}', gameState.time.season)
      .replace('{{recentHistory}}', recentHistory)
      .replace('{{action}}', formattedAction);
  }
  
  // If history is long - use summary + new entries after lastSummaryLength
  const newEntriesAfterSummary = gameState.history.slice(lastSummaryLength);
  const recentHistory = [
    ...(historySummary ? [historySummary] : []),
    ...newEntriesAfterSummary.map(entry => typeof entry === 'string' ? entry : entry.text)
  ].join('\n\n---\n\n');

  const promptTemplate = Array.isArray(translations[language].prompts.gamemasterSystem)
    ? translations[language].prompts.gamemasterSystem.join('\n')
    : translations[language].prompts.gamemasterSystem;

  return promptTemplate
    .replace('{{currentState.location.region}}', gameState.location.region)
    .replace('{{currentState.location.settlement}}', gameState.location.settlement)
    .replace('{{currentState.location.place}}', gameState.location.place)
    .replace('{{currentState.health}}', String(gameState.health))
    .replace('{{currentState.state}}', gameState.state)
    .replace('{{currentState.will}}', gameState.will)
    .replace('{{currentState.environment}}', gameState.environment)
    .replace('{{currentState.time.day}}', String(gameState.time.day))
    .replace('{{currentState.time.month}}', gameState.time.month)
    .replace('{{currentState.time.year}}', String(gameState.time.year))
    .replace('{{currentState.time.era}}', gameState.time.era)
    .replace('{{currentState.time.timeOfDay}}', gameState.time.timeOfDay)
    .replace('{{currentState.time.season}}', gameState.time.season)
    .replace('{{recentHistory}}', recentHistory)
    .replace('{{action}}', formattedAction);
}

/**
 * Cleans and parses JSON response from Claude API
 */
function parseClaudeJsonResponse(responseText: string, gameState: GameState): any {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in response:', responseText);
    throw new Error('No JSON found in response');
  }

  let jsonStr = jsonMatch[0];

  // Clean up common JSON issues
  jsonStr = jsonStr
    .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
    .replace(/([{,]\s*)"([^"]+)"\s*:\s*"([^"]*)"([^,}\]]*)/g, (match, prefix, key, value, suffix) => {
      // Fix unescaped quotes in values
      const cleanValue = value.replace(/"/g, '\\"');
      return `${prefix}"${key}": "${cleanValue}"${suffix}`;
    });

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Problematic JSON string:', jsonStr);
    console.error('Original response:', responseText);

    // Fallback: create minimal valid response
    return {
      newSituation: responseText.substring(0, 500) + "...",
      location: gameState.location,
      state: gameState.state,
      environment: gameState.environment,
      time: gameState.time,
      memory: gameState.memory
    };
  }
}

// ========================
// CORE AI FUNCTIONS
// ========================

/**
 * Formats player action using Claude API with game context
 */
async function formatPlayerAction(action: string, gameState: GameState, language: string = 'ru'): Promise<ApiResponse> {
  try {
    const context = buildActionContext(gameState);
    
    const promptTemplate = Array.isArray(translations[language].prompts.formatAction) 
      ? translations[language].prompts.formatAction.join('\n')
      : translations[language].prompts.formatAction;
    
    const promptWithContext = promptTemplate
      .replace('{{action}}', action)
      .replace('{{recentHistory}}', context.recentHistory)
      .replace('{{currentState}}', context.currentState)
      .replace('{{will}}', context.will)
      .replace('{{location}}', context.location)
      .replace('{{timeInfo}}', context.timeInfo);

    const data = await makeClaudeApiRequest(promptWithContext, gameConfig.game.maxTokens.formatAction);
    
    return {
      formattedAction: data.content[0].text || action,
      usage: { total: calculateTokenUsage(data) }
    };
  } catch (error) {
    console.error('Error formatting action:', error);
    return {
      formattedAction: action,
      usage: { total: 0 }
    };
  }
}

/**
 * Summarizes game history using Claude API
 */
async function summarizeHistory(historyToSummarize: any[], language: string = 'ru'): Promise<{ summary: string; usage: { total: number } }> {
  try {
    const historyText = historyToSummarize
      .map(entry => typeof entry === 'string' ? entry : entry.text)
      .join('\n\n---\n\n');
    
    const promptTemplate = Array.isArray(translations[language].prompts.historySummary)
      ? translations[language].prompts.historySummary.join('\n') 
      : translations[language].prompts.historySummary;
      
    const prompt = promptTemplate
      .replace('{{historyText}}', historyText)
      .replace('{{summaryParagraphLength}}', String(gameConfig.game.summaryParagraphLength));
    const data = await makeClaudeApiRequest(prompt, 500); // Short summary
    
    return {
      summary: `SUMMARY: ${data.content[0].text}`,
      usage: { total: calculateTokenUsage(data) }
    };
  } catch (error) {
    console.error('Error summarizing history:', error);
    return {
      summary: 'SUMMARY:',
      usage: { total: 0 }
    };
  }
}

/**
 * Generates narrator response using Claude API with full game context
 */
async function generateNarratorResponse(gameState: GameState, formattedAction: string, language: string = 'ru'): Promise<ApiResponse> {
  try {
    const fullPrompt = buildGameMasterPrompt(gameState, formattedAction, language);
    
    // Log the prompt for debugging
    await writeLogEntry(fullPrompt);
    
    const data = await makeClaudeApiRequest(fullPrompt, gameConfig.game.maxTokens.generateResponse);
    const responseText = data.content[0].text;
    
    // Log the AI response for debugging
    await writeLogEntry(`AI RESPONSE: ${responseText}`);
    
    // Parse JSON response with fallback handling
    const parsedResponse = parseClaudeJsonResponse(responseText, gameState);
    
    return buildClientResponse(parsedResponse, gameState, calculateTokenUsage(data));
  } catch (error) {
    console.error('Error generating response:', error);
    return {
      narration: "Произошла ошибка при генерации ответа. Попробуйте еще раз.",
      usage: { total: 0 },
      gameState: gameState,
      error: error.message
    };
  }
}

/**
 * Builds client response from parsed AI response
 */
function buildClientResponse(parsedResponse: any, gameState: GameState, totalTokens: number): ApiResponse {
  const historySummary = gameState.memory?.historySummary || null;
  
  const updatedMemory = {
    historySummary: historySummary || gameState.memory?.historySummary
  };
  
  return {
    narration: parsedResponse.newSituation || parsedResponse.narration || "Что-то произошло...",
    keyEvent: parsedResponse.keyEvent || null,
    usage: { total: totalTokens },
    gameState: {
      location: parsedResponse.location || gameState.location,
      character: gameState.character,
      health: parsedResponse.health !== undefined ? parsedResponse.health : gameState.health,
      state: parsedResponse.state || gameState.state,
      will: parsedResponse.will || gameState.will,
      environment: parsedResponse.environment || gameState.environment,
      time: parsedResponse.time || gameState.time,
      memory: updatedMemory
    }
  };
}

/**
 * Handles history compression logic
 */
async function processHistoryCompression(gameState: GameState, language: string = 'ru'): Promise<CompressionResult> {
  const lastSummaryLength = gameState.lastSummaryLength || 0;
  
  // Check condition: len(history) > lastSummaryLength + historyLength
  if (gameState.history.length <= lastSummaryLength + gameConfig.game.historyLength) {
    return { compressionNeeded: false };
  }

  console.log(`🗜️ History compression: ${gameState.history.length} entries, lastSummaryLength: ${lastSummaryLength}...`);
  
  // Take history[lastSummaryLength:-1] elements (all except the last one)
  const entriesToCompress = gameState.history.slice(lastSummaryLength, -1);
  
  // Text to compress: old_summary + new entries
  const oldSummary = gameState.memory?.historySummary || '';
  const newEntriesText = entriesToCompress
    .map(entry => typeof entry === 'string' ? entry : entry.text)
    .join('\n\n---\n\n');
  
  const textToSummarize = [oldSummary, newEntriesText]
    .filter(text => text.trim().length > 0)
    .join('\n\n---\n\n');
  
  const summaryResult = await summarizeHistory([textToSummarize], language);
  
  console.log(`✅ History compression completed, tokens used: ${summaryResult.usage.total}`);
  
  return {
    compressionNeeded: true,
    historySummary: summaryResult.summary,
    lastSummaryLength: gameState.history.length, // lastSummaryLength = history length
    usage: summaryResult.usage
  };
}

// ========================
// API ROUTES
// ========================

/**
 * Get public game configuration (excluding API keys)
 */
app.get('/api/config', (req, res) => {
  const publicConfig = {
    game: gameConfig.game,
    ui: gameConfig.ui
  };
  res.json(publicConfig);
});


/**
 * Format player action with AI context
 */
app.post('/api/format-action', async (req, res) => {
  try {
    const { action, gameState, language = 'ru' } = req.body;
    const result = await formatPlayerAction(action, gameState, language);
    res.json(result);
  } catch (error) {
    console.error('Error in format-action:', error);
    res.status(500).json({ error: 'Failed to format action' });
  }
});

/**
 * Generate AI narrator response
 */
app.post('/api/generate-response', async (req, res) => {
  try {
    const { gameState, formattedAction, language = 'ru' } = req.body;
    const response = await generateNarratorResponse(gameState, formattedAction, language);
    res.json(response);
  } catch (error) {
    console.error('Error in generate-response:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      message: "Произошла ошибка при генерации ответа. Попробуйте еще раз.",
      usage: { total: 0 }
    });
  }
});

/**
 * Compress game history when it becomes too long
 */
app.post('/api/compress-history', async (req, res) => {
  try {
    const { gameState, language = 'ru' } = req.body;
    const result = await processHistoryCompression(gameState, language);
    res.json(result);
  } catch (error) {
    console.error('Error in compress-history:', error);
    res.status(500).json({ error: 'Failed to compress history' });
  }
});
/**
 * Serve React app for all other routes (SPA fallback)
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ========================
// SERVER INITIALIZATION
// ========================

/**
 * Initialize and start the server
 */
async function startServer(): Promise<void> {
  try {
    // Clear log file on startup
    await clearLogFile();
    
    // Load configuration and prompts
    gameConfig = await loadGameConfig();
    console.log('Game configuration loaded successfully');

    translations = await loadTranslations();
    console.log('Translations loaded successfully');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Hobbit RPG Server running on http://localhost:${PORT}`);
      console.log('🎮 Game is ready to play!');
      console.log('📁 Serving static files from dist/');
      console.log('🤖 Claude API endpoints ready');
      console.log('🌍 Translations loaded from public/locales/ directory');
    });

    server.on('error', handleServerError);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Clear log file on server startup
 */
async function clearLogFile(): Promise<void> {
  try {
    await fs.writeFile('log.txt', '', 'utf8');
    console.log('🗑️ Log file cleared');
  } catch (error) {
    console.log('Failed to clear log file:', error);
  }
}

/**
 * Handle server startup errors
 */
function handleServerError(err: any): void {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is already in use`);
    console.log('💡 Try a different port or close other applications');
    process.exit(1);
  } else {
    throw err;
  }
}

// Start the server
startServer();