# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application for a text RPG game based on Tolkien's works, where the player controls Bilbo Baggins in Middle-earth. The game uses Claude API to generate narrative responses and supports multilingual functionality.

## Key Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🤖 **AI-generated content** via Claude API for narratives
- 🌍 **Multilingual support** - full support for Russian and English languages
- 💾 **Auto-save** game progress
- 🧠 **Character Evolution System** - Bilbo's character develops based on actions
- 📱 **Clean dual-column interface** with fixed 50/50 layout
- 🏕️ **Scene Context System** - location, time, and environment display
- 🧠 **Vector Memory System** - LanceDB integration for semantic memory storage

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
  - `src/main.tsx` - React root initialization
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
  - `GET /api/memories` - fetch stored memories (up to 10)
  - `POST /api/clear-memories` - clear all memories (for new game)
- **Prompt system**:
  - `public/locales/ru/prompt.md` - main Russian prompt template
  - Variable substitution in prompts with `{{variable}}` templates
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
- **Search functionality** via Claude function calling
- **Memory display** auto-updates after each action
- **Optimizations**: 3 results max, 100 char truncation for token efficiency

### Internationalization (i18n)
- **React-i18next** integration for multilingual support
- **Translation structure**:
  ```
  public/locales/
  ├── ru/
  │   ├── common.json    # UI elements, buttons, messages
  │   ├── state.json     # Game texts, initial state
  │   ├── rules.json     # Rules page in Russian
  │   └── prompt.md      # AI prompt in Russian
  └── en/
      ├── common.json    # UI elements in English
      ├── state.json     # Game texts in English
      └── rules.json     # Rules page in English
  ```
- **Language support**: RU (primary), EN (secondary)
- **API integration**: Language passed in server requests
- **AI multilingual**: Claude prompts loaded in appropriate language

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
│   ├── main.tsx                  # React initialization
│   └── index.css                 # Tailwind CSS imports
├── server/
│   └── index.ts                  # Express server with API endpoints
├── public/
│   ├── locales/                  # i18n translations
│   │   ├── ru/                   # Russian translations
│   │   └── en/                   # English translations
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
- **Header**: Game title with rules and new game buttons
- **Input area**: Player action input with Russian processing indicator

### History Display
- **Scene context**: Environment, location, and time shown in header
- **Character emotions**: Bilbo's emotional state displayed with actions  
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

### Working with Game State
- GameState is passed completely between client and server
- State changes occur only on server via Claude API
- Memory system is cumulative and auto-updating
- characterEvolution represents deviation from Bilbo's base personality

### API Integration
- Single endpoint handles all game actions
- Language is passed in each API request for correct prompt selection
- Retry logic with exponential delay on errors
- JSON responses are cleaned and validated
- Token usage tracking for monitoring

### Code Organization Best Practices
- Prefer editing existing files over creating new ones
- Maintain TypeScript types for all interfaces
- Use Tailwind CSS for consistent styling
- Follow React patterns for state management
- Keep server logic separate from client logic