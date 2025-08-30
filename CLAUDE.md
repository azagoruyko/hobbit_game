# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application for a text RPG game based on Tolkien's works, where the player controls Bilbo Baggins in Middle-earth. The game uses Claude API to generate narrative responses and supports multilingual functionality.

## Key Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🤖 **AI-generated content** via Claude API for narratives
- 🌍 **Multilingual support** - full support for Russian, English, and Spanish languages
- 💾 **Auto-save** game progress + **Manual Save/Load** system
- 🧠 **Character Evolution System** - Bilbo's character develops based on actions
- 📱 **Clean dual-column interface** with fixed 50/50 layout
- 🏕️ **Scene Context System** - location, time, and environment display
- 🧠 **Vector Memory System** - LanceDB integration for semantic memory storage with optimized search
- 📁 **Save/Load System** - File-based saves for debugging and state management

## Architecture

### Unified Server Architecture
- **Single Express.js server** (TypeScript)
  - `server/index.ts` - main server file with complete game logic
  - Port: 5000 (production), 3000 (development)
  - Serves frontend static files from `dist/` folder
  - API endpoints available at `/api/*` route
  - Automatic configuration loading from `game.json`
  - Translation loading from `public/locales/`
  - Retry logic for API calls with exponential backoff
  - Logging all prompts to `log.txt`
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
- **Prompt system**:
  - `public/locales/{lang}/prompt.md` - prompt templates for each language
  - Variable substitution in prompts with `{{variable}}` templates
  - Fallback to Russian prompt if language file not found
- **Claude API integration**:
  - Model: claude-3-5-sonnet-20241022 (configurable in game.json)
  - **Requires Claude Sonnet 3.5 minimum** - older models may not work properly
  - Function calling support for memory search
  - Retry logic with 3 attempts and exponential delay
  - Error handling for 529 (API overloaded)
  - Logging all prompts to log.txt for debugging
- **JSON response parsing**:
  - Extract JSON from Claude response text
  - Clean trailing commas and fix quotes
  - Fallback to basic response on parsing errors

### Memory & Vector Database
- **LanceDB integration** with embedding model (Xenova/all-MiniLM-L6-v2)
- **Memory storage** in `./memory_db/bilbo_memories.lance`
- **Automatic memory creation** for important events (importance >= 0.1)
- **Search functionality** via Claude function calling with optimized performance
- **Memory display** auto-updates after each action
- **Smart filtering**: Excludes 3 most recent memories from search (already in recent history)
- **Performance optimization**: O(log n) search with timestamp filtering
- **Constants**: `RECENT_HISTORY_SIZE = 3` for maintainable configuration
- **Save/Load integration**: Memories saved without embeddings, regenerated on load

### Internationalization (i18n)
- **React-i18next** integration for multilingual support
- **Translation structure**:
  ```
  public/locales/
  ├── ru/
  │   ├── common.json    # UI elements, buttons, messages
  │   ├── state.json     # Game texts, initial state
  │   └── prompt.md      # AI prompt in Russian
  ├── en/
  │   ├── common.json    # UI elements in English  
  │   ├── state.json     # Game texts in English
  │   └── prompt.md      # AI prompt in English
  └── es/
      ├── common.json    # UI elements in Spanish
      ├── state.json     # Game texts in Spanish
      └── prompt.md      # AI prompt in Spanish
  ```
- **Language support**: RU (primary), EN, ES - full support for all three languages
- **Language switcher**: RU/EN/ES selector in header with alert notification
- **API integration**: Language passed in server requests for correct prompt selection
- **AI multilingual**: Claude prompts loaded in appropriate language with fallback
- **Configuration**: `src/i18n/index.ts` with supportedLngs: ['ru', 'en', 'es']

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
      "baseUrl": "https://api.anthropic.com/v1/messages"
    }
  },
  "game": {
    "model": "claude-3-5-sonnet-20241022"
  }
}
```

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
- **Task/Plan lists**: Comma-separated items displayed as bullet lists
- **Memory system**: Auto-updating expandable memory display
- **Contextual descriptions**: Each state element has explanatory subtitles

### Memory System
- **Auto-refresh**: Updates automatically after each action
- **Expandable display**: Show/hide toggle for memory entries
- **Chronological order**: Latest memories first
- **Rich display**: Shows time, location, importance, and content

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

### Working with Translations
- All user-facing texts use `t()` function from react-i18next
- AI prompts are loaded by server from markdown files
- When adding new texts, always add translations for all languages (ru/en/es)
- Use interpolation for dynamic values: `t('key', { variable: value })`
- Bilbo's emotional state is displayed as: `{t('messages.bilbo')} ({entry.description})`

### Memory System Development
- Use `RECENT_HISTORY_SIZE` constant for maintainable recent history configuration
- Memory search performs semantic similarity search across all stored memories
- Vector database uses LanceDB with embedding model (Xenova/all-MiniLM-L6-v2)
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