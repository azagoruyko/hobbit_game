# 🍃 The Hobbit: There and Back Again

An interactive text-based RPG game based on J.R.R. Tolkien's works, where you control Bilbo Baggins in his journey through Middle-earth. The game uses AI (Claude) to generate dynamic narratives and character reactions in Tolkien's style.

## ✨ Features

- 🎮 **Interactive RPG** with full immersion in Tolkien's world
- 🤖 **AI-generated content** via Claude API for dynamic narratives
- 🌍 **Multilingual support** - complete support for Russian and English
- 💾 **Auto-save** game progress with manual save/load options
- 🧠 **Will System** - Bilbo's will affects how accurately he follows your intentions
- ❤️ **Physical and mental condition** - Bilbo has emotions and health which affect his reactions
- 📖 **Rules page** with navigation between rules and game
- 📜 **Dynamic history** with automatic compression for long games
- ⚡ **Key events** highlighting important story moments
- 📱 **Responsive interface** with hobbit-themed design

## 🎯 How It Works

1. **Describe your intention** - Write what you want Bilbo to do
2. **AI formats your action** - Claude transforms your input into Tolkien's style
3. **World responds** - The AI generates narrative responses and updates game state
4. **Story evolves** - Characters remember your actions, time passes realistically

Example:
- **Your input**: "want to greet the guest"
- **AI formats**: "Bilbo politely bows and says: — Welcome to Bag End!"
- **World responds**: "Gandalf smiles beneath his wide-brimmed hat and replies in a low voice..."

## 🚀 Quick Start

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

## 🎮 Game Controls

- **Type your intentions** in the input field (e.g., "look around", "talk to Gandalf")
- **Press Enter** or click the arrow button to submit
- **Save/Load** games using the buttons in the top panel
- **Switch languages** between Russian and English
- **View rules** anytime using the 📖 button

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

## 🎭 Game Mechanics

### Will System
Bilbo's **will** affects how well he follows your intentions:
- **High will**: Precise execution of your plans
- **Low will**: Panic, hesitation, or deviation from instructions
- **Dynamic**: Changes based on your actions and story events

### Time & Memory
- **Realistic time flow**: Conversations take minutes, journeys take days
- **Character memory**: NPCs remember your previous interactions
- **Auto-compression**: Long game histories are automatically summarized

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
- **The Tolkien community** - for inspiration and love of these stories

---

*"In a hole in the ground there lived a hobbit..."*
