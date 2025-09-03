# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application for a text RPG game based on Tolkien's works, where the player controls Bilbo Baggins in Middle-earth. The game uses Claude API to generate narrative responses and supports multilingual functionality.

## Key Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🤖 **AI-generated content** via Claude API for narratives with **cache_control optimization**
- 🌍 **Multilingual support** - full support for Russian, English, and Spanish languages
- 💾 **Auto-save** game progress + **Manual Save/Load** system
- 🧠 **Character Evolution System** - Bilbo's character develops based on actions
- 📱 **Clean dual-column interface** with fixed 50/50 layout
- 🏕️ **Scene Context System** - location, time, and environment display
- 🧠 **Advanced Memory System** - multilingual vector search with threshold controls and manual search UI
- 📁 **Save/Load System** - File-based saves for debugging and state management
- ⚡ **Token Optimization** - ~70% token savings through cached game rules
- 📋 **Real-time Server Log Streaming** - SSE-based log display with auto-scroll and amber theme
- 🎯 **Clickable Task System** - Direct interaction with game tasks for better UX

## Architecture

### Unified Server Architecture
- **Single Express.js server** (TypeScript)
  - `server/index.ts` - main server file with complete game logic
  - Port: 5000 (all modes)
  - Serves frontend static files from `dist/` folder
  - API endpoints available at `/api/*` route
  - Automatic configuration loading from `game.json`
  - Translation loading from `public/locales/`
  - Retry logic for API calls with exponential backoff
  - Logging all prompts to `log.txt`
  - **Real-time log streaming** via Server-Sent Events to frontend
- **Frontend**: React application (SPA)
  - `src/App.tsx` - single main game component with all logic
  - `src/main.tsx` - React root initialization with i18n
  - `src/i18n/index.ts` - react-i18next configuration
  - State management via React useState
  - Build: TypeScript + Vite + Tailwind CSS → `dist/`

### Game State Management
- Client side: React useState for game state management
- Server side: handling API requests to Claude
- **Vector Memory System**: LanceDB integration for semantic memory storage and retrieval
- Main gameState object contains:
  - `location` - current location (region, settlement, place)
  - `bilboState.character` - Bilbo's fundamental character traits
  - `bilboState.characterEvolution` - numeric character development (-100 to +100 relative to base personality)
  - `bilboState.emotions` - current emotional state
  - `bilboState.health` - physical health status
  - `bilboState.tasks` - current short-term tasks (displayed as bullet list)
  - `bilboState.plans` - long-term plans (displayed as bullet list)
  - `bilboState.thoughts` - internal thoughts
  - `environment` - current environment description
  - `time` - game time (day, month, year, era, time of day)
  - `history` - game event history with types: 'bilbo', 'world'

### AI Integration (Server-Side)
- **Single unified endpoint**: `POST /api/process-game-action` - handles complete game action processing
- **API Endpoints**:
  - `GET /api/config` - public configuration (without API keys)
  - `POST /api/process-game-action` - process player action and return updated game state
  - `GET /api/memories` - fetch stored memories (up to 50)
  - `POST /api/clear-memories` - clear all memories (for new game)
  - `POST /api/save-memory` - save individual memory (creates embeddings if missing)
  - `POST /api/save-state` - save complete game state and memories to server file
  - `POST /api/load-state` - load complete game state and memories from server file
  - `GET /api/logs/stream` - Server-Sent Events endpoint for real-time log streaming
- **Optimized Prompt System with Cache Control**:
  - `public/locales/{lang}/rules.md` - static game rules (cached with cache_control for ~70% token savings)
  - `public/locales/{lang}/prompt.md` - dynamic content (current game state, not cached)
  - Variable substitution in prompts with `{{variable}}` templates
  - Fallback to Russian prompt if language file not found
  - **Strict JSON enforcement** with `ai_thinking` field for debugging and transparency
  - **Unified logging system** with `broadcastLog()` for streaming to frontend
- **Claude API integration**:
  - Model: claude-3-7-sonnet-20250219 (configurable in game.json)
  - **Requires Claude Sonnet 3.5 minimum** - older models may not work properly
  - Function calling support for memory search
  - Retry logic with 3 attempts and exponential delay
  - Error handling for 529 (API overloaded)
  - Logging all prompts to log.txt for debugging
  - **Real-time log broadcasting** to connected clients via SSE
- **Enhanced JSON response parsing**:
  - Structured JSON format with mandatory `ai_thinking` field for transparency  
  - AI thinking streamed to frontend logs in real-time
  - Extract JSON from Claude response text with improved error handling  
  - Clean trailing commas and fix quotes
  - Fallback to basic response on parsing errors

### Memory & Vector Database
- **LanceDB integration** with configurable embedding model (default: Xenova/multilingual-e5-small)
- **Multilingual support** optimized for Russian, English, and Spanish languages
- **Memory storage** in `./memory_db/bilbo_memories.lance`
- **Automatic memory creation** for important events (importance >= 0.1)
- **Search functionality** via Claude function calling with relevance threshold filtering
- **Manual search UI** with threshold slider (0-1) and Enter key support
- **Similarity scores** displayed for all memory search results
- **Memory display** auto-updates after each action
- **Constants**: `RECENT_HISTORY_SIZE = 3`, `MEMORY_RELEVANCE_THRESHOLD = 0.6`
- **Save/Load integration**: Memories saved without embeddings, regenerated on load

### Internationalization (i18n)
- **React-i18next** integration for multilingual support
- **Translation structure**:
  ```
  public/locales/
  ├── ru/
  │   ├── common.json    # UI elements, buttons, messages
  │   ├── rules.json     # Game rules translations
  │   ├── state.json     # Game texts, initial state
  │   ├── prompt.md      # AI prompt in Russian
  │   └── rules.md       # Game rules in Markdown
  ├── en/
  │   ├── common.json    # UI elements in English  
  │   ├── rules.json     # Game rules translations
  │   ├── state.json     # Game texts in English
  │   ├── prompt.md      # AI prompt in English
  │   └── rules.md       # Game rules in Markdown
  └── es/
      ├── common.json    # UI elements in Spanish
      ├── rules.json     # Game rules translations
      ├── state.json     # Game texts in Spanish
      ├── prompt.md      # AI prompt in Spanish
      └── rules.md       # Game rules in Markdown
  ```
- **Language support**: RU (primary), EN, ES - full support for all three languages
- **Language switcher**: RU/EN/ES selector in header with alert notification
- **API integration**: Language passed in server requests for correct prompt selection
- **AI multilingual**: Claude prompts loaded in appropriate language with fallback
- **Configuration**: `src/i18n/index.ts` with supportedLngs: ['ru', 'en', 'es'] and namespaces: ['common', 'rules', 'state']

## Setup Instructions

### 1. Requirements
- Node.js (version 18 or higher)
- npm (usually installed with Node.js)
- Claude API key from Anthropic
- **Claude Sonnet 3.5 or newer model** (required for proper game functionality)

### 2. Installation
```bash
npm install
```

### 3. Configuration
1. Create `game.json` from `game.json.example`
2. Get Claude API key from https://console.anthropic.com/
3. Replace `"your-claude-api-key-here"` with your actual API key

### 4. Running
```bash
npm run dev          # Development mode
npm run start        # Production mode (requires npm run build first)
npm run build        # Build for production
```

Or use the launcher script:
```bash
start-game.bat       # Automatic setup and launch
```

Game opens at: http://localhost:5000

## Commands

### Development
```bash
npm run dev          # Start server in development mode (nodemon + tsx)
npm run build        # Build frontend to static files
npm run start        # Start production server
```

### Quick Start
```bash
start-game.bat       # Automatic start (dependency check + launch)
```

## Project Structure
```
/
├── src/
│   ├── App.tsx                   # Main game component (all UI logic)
│   ├── main.tsx                  # React initialization with i18n import
│   ├── i18n/
│   │   └── index.ts              # react-i18next configuration
│   └── index.css                 # Tailwind CSS imports
├── server/
│   └── index.ts                  # Express server with API endpoints
├── public/
│   ├── locales/                  # i18n translations
│   │   ├── ru/                   # Russian translations (common.json, state.json, prompt.md)
│   │   ├── en/                   # English translations (common.json, state.json, prompt.md)
│   │   └── es/                   # Spanish translations (common.json, state.json, prompt.md)
│   ├── bilbo.png                 # Game icon
│   └── main_theme.mp3           # Background music
├── memory_db/                    # LanceDB vector database
├── dist/                         # Built static files
├── package.json                  # Dependencies and scripts
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── game.json.example            # Configuration template
├── game.json                    # Game configuration with API keys
└── start-game.bat              # Launch script
```

## Game Configuration (game.json)

Minimal configuration contains only essential settings:

```json
{
  "api": {
    "anthropic": {
      "apiKey": "your-claude-api-key-here",
      "baseUrl": "https://api.anthropic.com/v1/messages",
      "model": "claude-3-7-sonnet-20250219"
    },
    "embedding": "Xenova/multilingual-e5-small"
  }
}
```

**Optional embedding model configuration** - defaults to multilingual-e5-small for better multilingual support.

All language settings are handled by react-i18next, not game configuration.

## TypeScript Types

Key types defined in `src/App.tsx` and `server/index.ts`:

- **GameState**: main game state structure
- **BilboState**: character state including character, characterEvolution, health, tasks, plans, thoughts, emotions
- **Location**: location structure (region/settlement/place)
- **Time**: detailed time structure
- **HistoryEntry**: game history record with types 'bilbo' | 'world'
- **ApiResponse**: response from game processing API
- **MemoryRecord**: vector database memory structure

### History Entry Types
- **'bilbo'**: Player actions with emotional descriptions
- **'world'**: Game world responses with environment context

## Current UI Features

### Visual Design
- **Warm color scheme**: Amber/green/yellow palette inspired by Tolkien's Shire
- **Fixed dual-column layout**: 50/50 split between history and character state
- **Rounded header**: Subtle top corners on main banner
- **Clean animations**: Hover effects without scaling glitches

### Interface Layout
- **Left column**: Game history with scene context header
- **Right column**: Bilbo's character state and memory system
- **Header**: Game title with language switcher (RU/EN/ES), rules and new game buttons
- **Input area**: Player action input with processing indicator

### Language Features
- **Language switcher**: Dropdown with flag emojis (🇷🇺 RU, 🇬🇧 EN, 🇪🇸 ES)
- **Alert notification**: Simple alert() message when language changes
- **Immediate UI update**: All interface texts change immediately
- **Game state preservation**: Current game continues in new language

### Save/Load System
- **Manual save/load buttons**: Compact UI buttons with multilingual labels
- **File-based saves**: Downloads JSON files for external storage and editing
- **Human-readable format**: Saves exclude embeddings for manual editing
- **Smart restore**: Auto-generates embeddings when loading saves without them
- **Complete state**: Includes game state and all memories in single file
- **Error handling**: Input field preserved on API errors for retry convenience

### History Display
- **Scene context**: Environment, location, and time shown in header
- **Character emotions**: Bilbo's emotional state displayed with actions using t('messages.bilbo') + emotions
- **World responses**: Environment changes shown after world events
- **Visual distinction**: Different colors for different event types

### Character State Panel
- **Character vs Emotions**: Clear distinction between fundamental personality and current feelings
- **Task/Plan lists**: Comma-separated items displayed as bullet lists with **clickable functionality**
- **Memory system**: Auto-updating expandable memory display
- **Contextual descriptions**: Each state element has explanatory subtitles

### Memory System UI
- **Auto-refresh**: Updates automatically after each action
- **Manual search**: Text input with Enter key support for targeted searches
- **Threshold control**: Slider (0-1) for relevance filtering with real-time updates
- **Similarity scores**: Displayed for all search results for transparency
- **Reset functionality**: Button to clear search and show all memories
- **Expandable display**: Show/hide toggle for memory entries
- **Chronological order**: Latest memories first (or by relevance in search)
- **Rich display**: Shows time, location, importance, similarity, and content

### Real-time Logging System
- **Server-Sent Events**: Live streaming of all server logs to frontend
- **Auto-scroll**: Logs automatically scroll to show latest entries
- **Visual integration**: Amber-themed design matching game aesthetics
- **Toggle visibility**: Collapsible log panel to reduce interface clutter
- **Comprehensive coverage**: AI thinking, memory searches, API calls, and system events
- **Performance optimized**: Circular buffer with 100-entry limit for memory efficiency

## Development Notes

### Code Organization
- **Monolithic App component**: All game logic consolidated in single component
- **Server-side logic**: Complete game processing on backend
- **Type safety**: Strict TypeScript typing throughout application
- **Vector Memory**: LanceDB integration for semantic memory storage and retrieval
- **Internationalization**: Full i18n support with react-i18next

### Working with Game State
- GameState is passed completely between client and server
- State changes occur only on server via Claude API
- Memory system is cumulative and auto-updating
- characterEvolution represents deviation from Bilbo's base personality

### API Integration
- Single endpoint handles all game actions
- Language is passed in each API request for correct prompt selection
- Server has fallback logic for missing language prompt files
- Retry logic with exponential delay on errors
- JSON responses are cleaned and validated
- Token usage tracking for monitoring
- Input preservation on API errors (529 overloaded, timeouts) for user retry convenience
- **Real-time logging**: All server operations broadcast via SSE to frontend logs

### Working with Translations
- All user-facing texts use `t()` function from react-i18next
- AI prompts are loaded by server from markdown files
- When adding new texts, always add translations for all languages (ru/en/es)
- Use interpolation for dynamic values: `t('key', { variable: value })`
- Bilbo's emotional state is displayed as: `{t('messages.bilbo')} ({entry.description})`

### Memory System Development
- Use `RECENT_HISTORY_SIZE` constant for maintainable recent history configuration
- Memory search performs semantic similarity search across all stored memories
- Vector database uses LanceDB with configurable embedding model
- **Multilingual embedding support** with Xenova/multilingual-e5-small model
- **Relevance threshold filtering** with `MEMORY_RELEVANCE_THRESHOLD = 0.6`
- **Manual search functionality** via `/api/memories?query=...&threshold=...`
- **Multiple memory searches** per AI response for comprehensive context retrieval
- Embeddings created automatically when missing (save/load compatibility)
- Human-readable saves without embeddings for manual editing and debugging
- All memories returned via `/api/memories` endpoint for complete memory access

### Code Organization Best Practices
- Prefer editing existing files over creating new ones
- Maintain TypeScript types for all interfaces
- Use Tailwind CSS for consistent styling
- Follow React patterns for state management
- Keep server logic separate from client logic
- All languages must have complete translation files (common.json, state.json, prompt.md)
- Use constants for configuration values (RECENT_HISTORY_SIZE, limits, etc.)