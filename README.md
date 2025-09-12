# The Hobbit, or There and Back Again

⚠️ **Work in Progress** - everything may change at any time. The main goal is to create the most interesting and realistic textual game possible.

An interactive text-based RPG game based on J.R.R. Tolkien's works, where you control Bilbo Baggins in his journey through Middle-earth. The game uses Claude AI to generate dynamic narratives and character reactions.

🎭 **Living Character System**: Bilbo has his own personality, emotions, plans, and thoughts that evolve based on your actions. Your decisions shape his character development, while his current state influences how he perceives and reacts to the world around him, just like in real life!
<table>
   <tr>
      <td><img width="500" alt="screenshot" src="https://github.com/user-attachments/assets/51e50426-a92d-4db0-b724-3c4b582435ca" /></td>
      <td><img width="500" alt="localhost_5000_ (1)" src="https://github.com/user-attachments/assets/d74d3e7c-7532-4a6a-b3b7-4559119599af" /></td>
   </tr>
</table>

## ✨ Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🎭 **Living Character System** - Bilbo has personality, emotions, plans and thoughts that evolve
- 🧠 **Advanced Memory System** - Proactive memory search with semantic similarity and inventory tracking
- 🌍 **Multilingual support** - complete support for Russian, English and Spanish
- 💾 **Manual/automatic saves** - play with it to get the desirable setting
- 📋 **Real-time Server Logs** - live streaming of AI thinking and system operations
- 😃 **Fun** - incredibly fun!

### Requirements

- **Node.js** (version 18 or higher)
- **Claude API key** from [Anthropic](https://console.anthropic.com/)
- **Claude Sonnet 3.5 or newer model** (required for proper game functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/hobbit_game.git
   cd hobbit_game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the game**
   ```bash
   cp game.json.example game.json
   ```
   
   Edit `game.json` and replace `"your-claude-api-key-here"` with your actual Claude API key.

4. **Run the game**
   
   **Option A - Automatic (Windows):**
   ```bash
   start-game.bat
   ```
   
   **Option B - Manual:**
   ```bash
   npm run dev          # Development mode
   # OR
   npm run build        # Build for production
   npm run start        # Run production server
   ```

5. **Open your browser** and go to: http://localhost:5000

## 🛠️ Development

### Commands

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
```

### Project Structure

```
/
├── src/
│   ├── App.tsx                   # Main game component
│   ├── main.tsx                  # React initialization with i18n
│   ├── i18n/
│   │   └── index.ts              # react-i18next configuration
│   └── index.css                 # Tailwind CSS imports
├── server/
│   └── index.ts                  # Express server with API endpoints
├── public/
│   ├── locales/                  # Translation files (ru/en/es)
│   │   ├── ru/                   # Russian (common.json, rules.json, state.json, rules.md, prompt.md)
│   │   ├── en/                   # English (common.json, rules.json, state.json, rules.md, prompt.md)
│   │   └── es/                   # Spanish (common.json, rules.json, state.json, rules.md, prompt.md)
│   ├── bilbo.png                 # Game icon (large)
│   ├── bilbo_small.png           # Game icon (small)
│   └── main_theme.mp3           # Background music
├── memory_db/                    # LanceDB vector database
│   └── bilbo_memories.lance/     # Memory database files
├── dist/                         # Built static files (production)
├── package.json                  # Dependencies and scripts
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── game.json.example            # Configuration template
├── game.json                    # Game configuration with API keys
├── log.txt                      # Server operation logs
├── CLAUDE.md                    # Project instructions for Claude Code
└── start-game.bat              # Launch script
```

### Key Technologies

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI Integration**: Claude API (Anthropic) with cache_control optimization
- **Internationalization**: react-i18next with full RU/EN/ES support
- **Vector Database**: LanceDB with multilingual embedding model (Xenova/multilingual-e5-small)
- **Real-time Communication**: Server-Sent Events for live log streaming
- **Build Tools**: Vite, PostCSS, Tailwind CSS

## ⚙️ Configuration

The `game.json` file contains minimal essential settings:

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

**New in v0.3.4**: Bug fixes & optimizations, memory system improvements, logging enhancements.

**New in v0.3.1**: Real-time server log streaming with Server-Sent Events - see AI thinking and system operations live in the game interface.

**New in v0.3.0**: Configurable embedding model with better multilingual support for improved memory search.

All language settings are handled by react-i18next configuration.

## 🌍 Adding New Languages

1. Create folder `public/locales/{language_code}/`
2. Copy translation files from existing language (ru/en/es)
3. Translate all content: `common.json`, `rules.json`, `state.json`, `rules.md`, `prompt.md`
4. Add language to `src/i18n/index.ts` supportedLngs array
5. Add option to language switcher in `src/App.tsx`

## 🐛 Troubleshooting

**"game.json not found"**
- Make sure you copied `game.json.example` to `game.json`

**"API key not configured"**
- Check that your Claude API key is properly set in `game.json`
- Ensure you have sufficient credits in your Anthropic account

**Translation errors**
- Verify all files in `public/locales/` have valid JSON syntax
- Make sure all language folders have all required files (common.json, rules.json, state.json, rules.md, prompt.md)

**Save incompatibility issues**
- Save files may be incompatible between different game versions
- If you experience errors when loading saves, clear browser cookies
- Start a new game if save loading continues to fail

**Claude API issues**
- Game now includes real-time server logs showing Claude's reasoning process
- Check the Server Logs panel in the interface to understand AI thinking and decisions
- For detailed debugging, also check `log.txt` file for complete API interactions

## 📝 License

This project is open source. Feel free to fork, modify, and share!

## 🙏 Acknowledgments

- **J.R.R. Tolkien** - for creating the incredible world of Middle-earth
- **Anthropic** - for providing the Claude AI that brings the world to life
- **LanceDB** - for the vector database powering the memory system

---

*"In a hole in the ground there lived a hobbit..."*
