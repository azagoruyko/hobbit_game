# 🍃 The Hobbit: There and Back Again
<p align="center">
<img width="300" alt="gameplay" src="https://github.com/user-attachments/assets/99c82497-de5e-4fe7-979e-e95b44fb164d" /> 
</p>
An interactive text-based RPG game based on J.R.R. Tolkien's works, where you control Bilbo Baggins in his journey through Middle-earth to help dwarves get their treasures. The game uses AI (Claude) to generate dynamic narratives and character reactions.

<img width="1000" alt="gameplay" src="https://github.com/user-attachments/assets/18913931-5a17-4064-a5ff-9b29d0ef4204" />

## ✨ Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🌍 **Multilingual support** - complete support for Russian, English and Spanish
- 💾 **Auto-save** game progress with manual save/load options for experiments
- 🧠 **Will System** - Bilbo's will affects how accurately he follows your intentions
- ❤️ **Physical and mental condition** - Bilbo has emotions and health which affect his reactions
- 📜 **Dynamic history** with automatic compression for long stories
- 🎵 **Atmospheric background music** - immersive audio experience with mute control
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
npm run lint         # Check code with ESLint
```

### Project Structure

```
/
├── src/
│   ├── App.tsx                   # Main game component
│   ├── components/
│   │   └── GameRules.tsx         # Rules page component
│   ├── i18n/                     # Internationalization setup
│   └── types.ts                  # TypeScript type definitions
├── server/
│   └── index.ts                  # Express server with API endpoints
├── public/
│   └── locales/                  # Translation files (ru/en)
├── package.json                  # Dependencies and scripts
├── game.json.example             # Configuration template
└── start-game.bat               # Quick start script
```

### Key Technologies

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI Integration**: Claude API (Anthropic)
- **Internationalization**: react-i18next
- **Build Tools**: Vite, ESLint, PostCSS

## ⚙️ Configuration

The `game.json` file contains all game settings:

```json
{
  "api": {
    "anthropic": {
      "apiKey": "your-claude-api-key-here",
      "baseUrl": "https://api.anthropic.com/v1/messages"
    }
  },
  "game": {
    "model": "claude-3-5-sonnet-20241022",
    "maxTokens": {
      "formatAction": 300,
      "generateResponse": 2000
    },
    "historyLength": 5,
    "summaryParagraphLength": 3,
    "language": "ru"
  }
}
```

## 🌍 Adding New Languages

1. Create folder `public/locales/{language_code}/`
2. Copy translation files from existing language (ru or en)
3. Translate all JSON content
4. The game will automatically detect and support the new language

## 🐛 Troubleshooting

**"game.json not found"**
- Make sure you copied `game.json.example` to `game.json`

**"API key not configured"**
- Check that your Claude API key is properly set in `game.json`
- Ensure you have sufficient credits in your Anthropic account

**Translation errors**
- Verify all files in `public/locales/` have valid JSON syntax
- Make sure both `ru/` and `en/` folders have all required files

## 📝 License

This project is open source. Feel free to fork, modify, and share!

## 🙏 Acknowledgments

- **J.R.R. Tolkien** - for creating the incredible world of Middle-earth
- **Anthropic** - for providing the Claude AI that brings the world to life

---

*"In a hole in the ground there lived a hobbit..."*
