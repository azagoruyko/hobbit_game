# The Hobbit, or There and Back Again

⚠️ **Work in Progress** - everything may change at any time. The main goal is to create the most interesting and realistic textual game possible.

An interactive text-based RPG game based on J.R.R. Tolkien's works, where you control Bilbo Baggins in his journey through Middle-earth. The game uses Ollama to run local LLMs that generate dynamic narratives and character reactions.

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
- **Ollama** installed on your system
- An active local **Ollama instance** with a downloaded model

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
   
   Edit `game.json` to ensure the `baseUrl` points to your active Ollama instance, and the `model` matches the one you downloaded.

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

### Key Technologies

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI Integration**: Local LLMs via Ollama
- **Internationalization**: react-i18next with full RU/EN/ES support
- **Vector Database**: LanceDB with multilingual embedding model
- **Real-time Communication**: Server-Sent Events for live log streaming
- **Build Tools**: Vite, PostCSS, Tailwind CSS

## ⚙️ Configuration

The `game.json` file contains minimal essential settings:

```json
{
  "api": {
    "llm": {
      "provider": "ollama",
      "model": "deepseek-v3.1:671b-cloud",
      "baseUrl": "http://localhost:11434"
    },
    "embedding": "Xenova/bge-m3"
  }
}
```

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

**"Ollama connection refused"**
- Check that your Ollama server is running.
- Ensure the `baseUrl` in `game.json` matches your Ollama instance's URL.

**Translation errors**
- Verify all files in `public/locales/` have valid JSON syntax
- Make sure all language folders have all required files (common.json, rules.json, state.json, rules.md, prompt.md)

**Save incompatibility issues**
- Save files may be incompatible between different game versions
- If you experience errors when loading saves, clear browser cookies
- Start a new game if save loading continues to fail

**LLM/Ollama issues**
- Game now includes real-time server logs showing the LLM's reasoning process
- Check the Server Logs panel in the interface to understand AI thinking and decisions
- For detailed debugging, also check `log.txt` file for complete API interactions

## 📝 License

This project is open source. Feel free to fork, modify, and share!

## 🙏 Acknowledgments

- **J.R.R. Tolkien** - for creating the incredible world of Middle-earth
- **Ollama** - for running the local LLMs that bring the world to life
- **LanceDB** - for the vector database powering the memory system

---

*"In a hole in the ground there lived a hobbit..."*
