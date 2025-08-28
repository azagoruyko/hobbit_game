# 🍃 The Hobbit: There and Back Again
<p align="center">
<img width="300" alt="gameplay" src="https://github.com/user-attachments/assets/99c82497-de5e-4fe7-979e-e95b44fb164d" /> 
</p>

> ⚠️ **Work in Progress** - everything may change at any time. The main goal is to create the most interesting and realistic textual game possible.

An interactive text-based RPG game based on J.R.R. Tolkien's works, where you control Bilbo Baggins in his journey through Middle-earth. The game uses AI (Claude) to generate dynamic narratives and character reactions.

<img width="1000" alt="gameplay" src="https://github.com/user-attachments/assets/18913931-5a17-4064-a5ff-9b29d0ef4204" />

## ✨ Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🌍 **Multilingual support** - complete support for Russian, English and Spanish
- 💾 **Auto-save** game progress
- 🧠 **Character Evolution System** - Bilbo's character develops based on actions
- 🧠 **Vector Memory System** - semantic memory storage with LanceDB
- 😃 **Fun** - incredibly fun!
- 🌿 **Therapy** - very meditative and relaxing

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
│   └── locales/                  # Translation files (ru/en/es)
│       ├── ru/                   # Russian (common.json, state.json, prompt.md)
│       ├── en/                   # English (common.json, state.json, prompt.md)
│       └── es/                   # Spanish (common.json, state.json, prompt.md)
├── memory_db/                    # LanceDB vector database
├── package.json                  # Dependencies and scripts
├── game.json.example             # Configuration template
└── start-game.bat               # Quick start script
```

### Key Technologies

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI Integration**: Claude API (Anthropic)
- **Internationalization**: react-i18next
- **Vector Database**: LanceDB with embeddings
- **Build Tools**: Vite, PostCSS

## ⚙️ Configuration

The `game.json` file contains minimal essential settings:

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

All language settings are handled by react-i18next configuration.

## 🌍 Adding New Languages

1. Create folder `public/locales/{language_code}/`
2. Copy translation files from existing language (ru/en/es)
3. Translate all content: `common.json`, `state.json`, `prompt.md`
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
- Make sure all language folders have all required files (common.json, state.json, prompt.md)

## 📝 License

This project is open source. Feel free to fork, modify, and share!

## 🙏 Acknowledgments

- **J.R.R. Tolkien** - for creating the incredible world of Middle-earth
- **Anthropic** - for providing the Claude AI that brings the world to life

---

*"In a hole in the ground there lived a hobbit..."*