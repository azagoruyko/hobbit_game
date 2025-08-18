# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React application for a text RPG game based on Tolkien's works, where the player controls Bilbo Baggins in Middle-earth. The game uses Claude API to generate narrative responses and supports multilingual functionality.

## Key Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🤖 **AI-generated content** via Claude API for narratives
- 🌍 **Multilingual support** - full support for Russian and English languages
- 💾 **Auto-save** game progress
- 🧠 **Will System** - affects accuracy of player intention execution
- 📖 **Rules page** with navigation between rules and game
- 📱 **Responsive interface** with Tailwind CSS

## Architecture

### Unified Server Architecture
- **Single Express.js server** (TypeScript)
  - `server/index.ts` - main server file with complete game logic
  - Port: 5000 (production), 3000 (development with Vite)
  - Serves frontend static files from `dist/` folder
  - API endpoints available at `/api/*` route
  - Automatic configuration loading from `game.json`
  - Translation loading from `public/locales/`
  - Retry logic for API calls with exponential backoff
  - Logging all prompts to `log.txt`
- **Frontend**: React application (SPA)
  - `src/App.tsx` - main game component
  - Modular architecture with separated concerns:
    - `src/components/` - React components (GameRules, HistoryEntry)
    - `src/services/` - API integration (gameApi)
    - `src/utils/` - utility functions (storage, textProcessing, gameUtils)
    - `src/constants/` - centralized constants and configuration
  - State management via React useState
  - Integration with react-i18next for multilingual support
  - Build: TypeScript + Vite + Tailwind CSS → `dist/`

### Game State Management
- Client side: React useState for game state management
- Server side: handling API requests to Claude
- Main gameState object contains:
  - `location` - current location (region, settlement, place)
  - `character` - character name ("Bilbo Baggins")
  - `state` - character's emotional state
  - `will` - character's will (ability to maintain self-control, follow player intentions)
  - `environment` - environment description
  - `time` - game time (day, month, year, era, time of day, season)
  - `history` - game event history (array of HistoryEntry objects)
  - `memory` - long-term game memory (mainly historySummary for history compression)

### AI Integration (Server-Side)
- **Two-stage action processing**:
  1. `formatPlayerAction()` - formatting user input in Tolkien's style
  2. `generateNarratorResponse()` - generating game response with state updates
- **API Endpoints**:
  - `GET /api/config` - public configuration (without API keys)
  - `POST /api/format-action` - format player action (with language)
  - `POST /api/generate-response` - full response generation with gameState update (with language)
  - `POST /api/compress-history` - compress game history when limit exceeded (with language)
- **Prompt translation system**:
  - `public/locales/{lang}/prompts.json` - prompt translations for each language
  - Dynamic prompt loading based on selected language
  - Variable substitution in prompts with `{{variable}}` templates
- **Claude API integration**:
  - Model: claude-3-5-sonnet-20241022 (configurable in game.json)
  - **Requires Claude Sonnet 3.5 minimum** - older models may not work properly
  - Retry logic with 3 attempts and exponential delay
  - Error handling for 529 (API overloaded)
  - Logging all prompts to log.txt for debugging
- **JSON response parsing**:
  - Extract JSON from Claude response text
  - Clean trailing commas and fix quotes
  - Fallback to basic response on parsing errors

### Internationalization (i18n)
- **Library**: react-i18next with multi-language support
- **Translation structure**:
  ```
  public/locales/
  ├── ru/
  │   ├── common.json    # UI elements, buttons, messages
  │   ├── state.json     # Game texts, initial state
  │   ├── rules.json     # Rules page in Russian
  │   └── prompts.json   # AI prompts in Russian
  └── en/
      ├── common.json    # UI elements in English
      ├── state.json     # Game texts in English
      ├── rules.json     # Rules page in English
      └── prompts.json   # AI prompts in English
  ```
- **Configuration**: `src/i18n/index.ts` with i18next settings
- **Language switching**: RU/EN button in interface
- **API integration**: Language passed in server requests
- **AI multilingual**: Claude prompts loaded in appropriate language
- **Persistence**: Selected language saved in localStorage

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
npm run lint         # Code check
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
npm run lint         # ESLint code check
```

### Quick Start
```bash
start-game.bat       # Automatic start (dependency check + launch)
```

## Project Structure
```
/
├── src/
│   ├── App.tsx                   # Main game component
│   ├── components/
│   │   ├── GameRules.tsx         # Rules page component
│   │   ├── BackgroundMusic.tsx   # Background music component
│   │   └── game/
│   │       └── HistoryEntry.tsx  # History entry processing component
│   ├── services/
│   │   └── gameApi.ts           # API calls with error handling
│   ├── utils/
│   │   ├── storage.ts           # Save/load game functionality
│   │   ├── textProcessing.ts    # Text formatting utilities
│   │   ├── gameUtils.ts         # Game logic utilities
│   │   ├── tokenUsage.ts        # Token tracking utilities
│   │   ├── historyManager.ts    # History compression management
│   │   ├── gameStateUpdater.ts  # Game state update logic
│   │   └── focusUtils.ts        # Focus management utilities
│   ├── constants/
│   │   └── index.ts             # Centralized constants and CSS classes
│   ├── i18n/
│   │   └── index.ts             # react-i18next configuration
│   └── types.ts                 # TypeScript types
├── server/
│   └── index.ts                 # Express server with API endpoints
├── public/
│   └── locales/                 # i18n translations
│       ├── ru/                  # Russian translations
│       └── en/                  # English translations
├── dist/                        # Built static files
├── package.json                 # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── game.json.example           # Configuration template
├── game.json                   # Game configuration with API keys
└── start-game.bat             # Launch script
```

## TypeScript Types

Key types defined in `src/types.ts`:

- **GameState**: main game state structure
- **Location**: location structure (region/settlement/place)
- **Time**: detailed time structure
- **HistoryEntry**: game history record
- **GameMemory**: simplified memory system
- **NarratorResponse**: API response format

## Development Notes

### Modular Architecture
- **Services layer**: `src/services/gameApi.ts` centralizes all API calls
- **Utils layer**: Utility functions organized by purpose (storage, text processing, game logic)
- **Components**: React components separated into logical modules
- **Constants**: All hardcoded values centralized in `src/constants/index.ts`
- **Type safety**: Strict TypeScript typing throughout the application

### Working with Game State
- GameState is passed completely between client and server
- State changes occur only on server via Claude API
- Game history is limited by `historyLength` parameter from configuration
- Memory system is cumulative - supplements, not overwrites data
- State updates handled by `gameStateUpdater.ts` utilities

### API Integration
- All Claude API calls go through `gameApi` service in `src/services/gameApi.ts`
- Language is passed in each API request for correct prompt selection
- Retry logic with exponential delay on errors
- JSON responses are cleaned and validated
- Fallback to basic responses on parsing errors
- Token usage tracking handled by `tokenUsage.ts` utilities

### Component Organization
- **HistoryEntry**: Extracted history processing logic from main App component
- **GameRules**: Separate rules page component with navigation
- **BackgroundMusic**: Audio functionality as independent component
- All components follow consistent TypeScript patterns and use centralized constants

### Working with Translations
- All user texts should use `t()` function from react-i18next
- AI prompts are loaded by server from JSON files
- When adding new texts, always add translations for all languages
- Use interpolation for dynamic values: `t('key', { variable: value })`

### Code Organization Best Practices
- Prefer editing existing files over creating new ones
- Extract utilities for reusable logic
- Use centralized constants for consistency
- Maintain TypeScript types for all interfaces
- Follow modular patterns for better maintainability