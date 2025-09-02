import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// ========================
// TYPES
// ========================

interface BilboState {
  character: string;
  characterEvolution: number; // Accumulated character changes: +good, -evil
  health: string;
  tasks: string[];
  thoughts: string[];
  emotions: string[];
  plans: string[];
}

interface Location {
  region: string;
  settlement: string;
  place: string;
}

interface Time {
  day: number;
  month: string;
  year: number;
  era: string;
  time: string;
}

interface HistoryEntry {
  content: string;
  type: 'bilbo' | 'world';
  description?: string;
}

interface GameState {
  bilboState: BilboState;
  location: Location;
  time: Time;
  environment: string[];
  event: string;
  history: HistoryEntry[];
}

interface ApiResponse {
  reaction: string;
  worldResponse: string;
  usage: { total: number };
  gameState: GameState;
}

// ========================
// INITIAL STATE
// ========================

const loadInitialState = async (language: string = 'ru'): Promise<GameState> => {
  const response = await fetch(`/locales/${language}/state.json`);
  const gameState = await response.json();
  
  // Add initial event to history
  if (gameState.event) {
    gameState.history = [{
      content: gameState.event,
      type: 'world',
      description: ''
    }];
  }
  
  return gameState;
};

// ========================
// API CALLS
// ========================

async function processGameAction(gameState: GameState, action: string, language: string = 'ru'): Promise<ApiResponse> {
  const response = await fetch('/api/process-game-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gameState, action, language })
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.message || 'API returned error');
  }

  return data;
}

async function fetchMemories(): Promise<any[]> {
  const response = await fetch('/api/memories');
  if (!response.ok) {
    throw new Error(`Failed to fetch memories: ${response.status}`);
  }
  return await response.json();
}

async function clearMemories(): Promise<void> {
  const response = await fetch('/api/clear-memories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to clear memories: ${response.status}`);
  }
}

async function searchMemories(query: string, threshold: number): Promise<any[]> {
  if (!query.trim()) {
    return fetchMemories(); // Return all memories if no search query
  }
  
  const response = await fetch(`/api/memories?query=${encodeURIComponent(query)}&threshold=${threshold}`);
  if (!response.ok) {
    throw new Error(`Failed to search memories: ${response.status}`);
  }
  return await response.json();
}

// ========================
// STORAGE
// ========================

const saveGameState = (gameState: GameState) => {
  try {
    localStorage.setItem('hobbit_game_state', JSON.stringify(gameState));
  } catch (error) {
    console.error('Failed to save game state:', error);
  }
};

const loadGameState = (): GameState | null => {
  try {
    const saved = localStorage.getItem('hobbit_game_state');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Failed to load game state:', error);
    return null;
  }
};

// ========================
// MAIN COMPONENT
// ========================

const HobbitGame = () => {
  const { t, i18n } = useTranslation();
  const [gameState, setGameState] = useState<GameState>({
    bilboState: {} as BilboState,
    location: {} as Location,
    time: {} as Time,
    environment: [],
    event: '',
    history: []
  });
  const [playerAction, setPlayerAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [tokenUsage, setTokenUsage] = useState({ total: 0 });
  const [language, setLanguage] = useState(i18n.language || 'ru');
  const [showRules, setShowRules] = useState(true);
  const [memories, setMemories] = useState<any[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryThreshold, setMemoryThreshold] = useState(0.3);
  
  const historyRef = useRef<HTMLDivElement>(null);
  const actionInputRef = useRef<HTMLInputElement>(null);

  // Load saved game or initial state on start
  useEffect(() => {
    const initGame = async () => {
      const savedState = loadGameState();
      if (savedState) {
        setGameState(savedState);
        setShowRules(false);
      } else {
        const initialState = await loadInitialState(language);
        setGameState(initialState);
      }
      // Load memories on game start
      await loadMemories();
    };
    initGame();
  }, []);

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      setTimeout(() => {
        if (historyRef.current) {
          historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [gameState.history]);

  // Save game state when it changes
  useEffect(() => {
    if (gameState.history.length > 0) {
      saveGameState(gameState);
    }
  }, [gameState]);

  const handleSubmitAction = async () => {
    if (!playerAction.trim() || isProcessing) return;

    const action = playerAction.trim();
    setIsProcessing(true);
    setProcessingStatus('Processing action...');

    try {
      // Call API (server handles history updates now)
      const response = await processGameAction(gameState, action, language);

      // Only clear input if successful
      setPlayerAction('');

      // Update token usage
      setTokenUsage(prev => ({ total: prev.total + response.usage.total }));

      // Update game state (server already updated history)
      setGameState(response.gameState);

      // Auto-refresh memory always
      console.log('🔄 Refreshing memories after action...');
      await loadMemories();
      console.log('✅ Memories refreshed');

    } catch (error) {
      console.error('Error processing action:', error);
      // Don't add API errors to game history - they break immersion
      // Don't clear input on error so user can retry
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      
      // Focus input
      setTimeout(() => {
        actionInputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAction();
    }
  };

  const startNewGame = async () => {
    const initialState = await loadInitialState(language);
    setGameState(initialState);
    setTokenUsage({ total: 0 });
    localStorage.removeItem('hobbit_game_state');
    
    // Clear memories for new game
    try {
      await clearMemories();
      setMemories([]);
      console.log('🧹 Memories cleared for new game');
    } catch (error) {
      console.error('Failed to clear memories:', error);
    }
    
    setShowRules(false);
  };

  const loadMemories = async () => {
    try {
      console.log('🔍 Loading memories...');
      const fetchedMemories = await fetchMemories();
      console.log('🔍 Fetched memories:', fetchedMemories);
      setMemories(fetchedMemories);
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
  };

  const handleMemorySearch = async () => {
    try {
      console.log('🔍 Searching memories:', memorySearch, 'threshold:', memoryThreshold);
      const searchResults = await searchMemories(memorySearch, memoryThreshold);
      console.log('🔍 Search results:', searchResults);
      setMemories(searchResults);
    } catch (error) {
      console.error('Failed to search memories:', error);
    }
  };

  const handleSaveState = async () => {
    try {
      // Get memories from API
      const memories = await fetch('/api/memories').then(res => res.json());
      
      // Remove embeddings from memories for human readability
      const memoriesForSave = memories.map((memory: any) => {
        const { embeddings, ...memoryWithoutEmbeddings } = memory;
        return memoryWithoutEmbeddings;
      });
      
      // Prepare save data
      const saveData = {
        gameState,
        memories: memoriesForSave,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      // Create downloadable file
      const blob = new Blob([JSON.stringify(saveData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hobbit_save_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(t('messages.saveSuccess') || 'Game saved to file successfully!');
    } catch (error) {
      console.error('Failed to save state:', error);
      alert(t('messages.saveError') || 'Failed to save game');
    }
  };

  const handleLoadState = async () => {
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const saveData = JSON.parse(text);
          
          // Clear existing memories
          await fetch('/api/clear-memories', { method: 'POST' });
          
          // Load memories if they exist
          if (saveData.memories && saveData.memories.length > 0) {
            // Recreate memories through API
            for (const memory of saveData.memories) {
              await fetch('/api/save-memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memory)
              });
            }
          }
          
          // Set game state
          setGameState(saveData.gameState);
          await loadMemories(); // Refresh memories display
          
          alert(t('messages.loadSuccess') || `Loaded game from ${file.name}`);
        } catch (error) {
          console.error('Failed to parse save file:', error);
          alert(t('messages.loadError') || 'Invalid save file format');
        }
      };
      
      input.click();
    } catch (error) {
      console.error('Failed to load state:', error);
      alert(t('messages.loadError') || 'Failed to load game');
    }
  };


  if (showRules) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-amber-50 to-yellow-100 p-4">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border-2 border-green-200/80 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-800 to-green-700 text-white p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-4 text-6xl">🍃</div>
              <div className="absolute top-8 right-6 text-4xl">🌿</div>
              <div className="absolute bottom-4 left-1/3 text-3xl">🌱</div>
              <div className="absolute bottom-2 right-1/4 text-5xl">🍂</div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 relative z-10">
              {t('gameTitle')}
            </h1>
            <p className="text-green-100/90 text-lg">{t('subtitle')}</p>
          </div>
          
          {/* Rules Content */}
          <div className="p-8">
            <div className="bg-gradient-to-br from-green-50 to-amber-50 border-l-4 border-amber-500 rounded-lg p-6 mb-8 shadow-md">
              <h2 className="text-2xl font-bold text-amber-800 mb-4 flex items-center">
                <span className="bg-amber-100 p-2 rounded-full mr-3">📜</span>
                {t('rules.title')}
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1 mr-3">1</div>
                  <div>
                    <h3 className="font-semibold text-green-800">{t('rules.rule1.title')}</h3>
                    <p className="text-gray-700">{t('rules.rule1.text')}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1 mr-3">2</div>
                  <div>
                    <h3 className="font-semibold text-green-800">{t('rules.rule2.title')}</h3>
                    <p className="text-gray-700">{t('rules.rule2.text')}</p>
                    <p className="text-sm text-gray-500 mt-1 italic">{t('rules.rule2.example')}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1 mr-3">3</div>
                  <div>
                    <h3 className="font-semibold text-green-800">{t('rules.rule3.title')}</h3>
                    <p className="text-gray-700">{t('rules.rule3.text')}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1 mr-3">4</div>
                  <div>
                    <h3 className="font-semibold text-green-800">{t('rules.rule4.title')}</h3>
                    <p className="text-gray-700">{t('rules.rule4.text')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-8 space-y-4">
              <button
                onClick={() => setShowRules(false)}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-10 py-4 rounded-xl font-medium text-lg shadow-lg transition-all duration-200 hover:shadow-amber-500/30"
              >
                🚀 {t('buttons.startAdventure')}
              </button>
              
              <p className="text-sm text-gray-500 mt-6">
                {t('rules.footer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-green-50 via-amber-50 to-yellow-100 flex justify-center overflow-hidden">
      <div className="max-w-6xl w-full bg-gradient-to-r from-green-50/30 to-yellow-50/50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-green-800 via-green-700 to-green-600 text-white p-6 shadow-xl overflow-hidden rounded-t-lg">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-2 left-4 text-6xl">🍃</div>
            <div className="absolute top-8 right-6 text-4xl">🌿</div>
            <div className="absolute bottom-4 left-1/3 text-3xl">🌱</div>
            <div className="absolute bottom-2 right-1/4 text-5xl">🍂</div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold drop-shadow-lg bg-gradient-to-r from-white via-green-100 to-white bg-clip-text text-transparent">
                {t('title')}
              </h1>
              
              <div className="flex gap-2">
                <select
                  value={language}
                  onChange={(e) => {
                    const newLanguage = e.target.value;
                    setLanguage(newLanguage);
                    i18n.changeLanguage(newLanguage).then(() => {
                      // Show notification after language change
                      alert(t('messages.languageChanged'));
                    });
                  }}
                  className="bg-blue-600/80 hover:bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 px-2 py-1 rounded-lg text-xs font-medium shadow-lg transition-all duration-300 text-white"
                >
                  <option value="ru">🇷🇺 RU</option>
                  <option value="en">🇬🇧 EN</option>
                  <option value="es">🇪🇸 ES</option>
                </select>
                <button
                  onClick={() => setShowRules(true)}
                  className="bg-green-600/80 hover:bg-green-500/90 backdrop-blur-sm border border-green-400/30 px-2 py-1 rounded-lg text-xs font-medium shadow-lg transition-all duration-300 hover:shadow-green-500/25"
                >
                  📜 {t('buttons.showRules')}
                </button>
                <button
                  onClick={startNewGame}
                  className="bg-amber-600/80 hover:bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 px-2 py-1 rounded-lg text-xs font-medium shadow-lg transition-all duration-300 hover:shadow-amber-500/25"
                >
                  ✨ {t('buttons.newGame')}
                </button>
                <button
                  onClick={handleSaveState}
                  className="bg-purple-600/80 hover:bg-purple-500/90 backdrop-blur-sm border border-purple-400/30 px-2 py-1 rounded-lg text-xs font-medium shadow-lg transition-all duration-300 hover:shadow-purple-500/25"
                >
                  💾 {t('buttons.save')}
                </button>
                <button
                  onClick={handleLoadState}
                  className="bg-indigo-600/80 hover:bg-indigo-500/90 backdrop-blur-sm border border-indigo-400/30 px-2 py-1 rounded-lg text-xs font-medium shadow-lg transition-all duration-300 hover:shadow-indigo-500/25"
                >
                  📂 {t('buttons.load')}
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Main Content - Two Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - History and Input */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ width: '50%' }}>
            {/* Compact Info Header */}
            <div className="sticky top-0 z-10 backdrop-blur-sm border-b border-green-200 px-4 py-2 text-sm text-gray-700 flex items-start">
              <div className="w-2/5 pr-5">
                <div className="flex items-center mb-0.5">
                  <span className="text-green-600 mr-2">📍</span>
                  <span className="font-medium">
                    {gameState.location.region} → {gameState.location.settlement} → {gameState.location.place}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="text-green-600 mr-2 ml-1">⏰</span>
                  <span>{gameState.time.day} {gameState.time.month} {gameState.time.year}, {gameState.time.era}, {gameState.time.time}</span>
                </div>
              </div>
              
              {gameState.environment && gameState.environment.length > 0 && (
                <div className="bg-green-50 text-gray-700 italic px-3 py-1.5 rounded-xl text-sm border border-green-200 flex items-center h-full w-3/5 justify-center">
                  <span className="mr-1.5">🏕️</span>
                  {gameState.environment.join(', ')}
                </div>
              )}
            </div>
            
            {/* History */}            
            <div 
              ref={historyRef}
              className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-green-50/20 to-yellow-50/30"
            >
              {gameState.history.length === 0 ? (
                <div className="text-gray-500 text-center italic">
                  {t('messages.historyEmpty')}
                </div>
              ) : (
                <div className="space-y-3">
                  {gameState.history.map((entry, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-xl shadow-sm border ${
                        entry.type === 'bilbo' ? 'bg-gradient-to-r from-orange-100/80 to-amber-100/80 border-l-4 border-orange-400' :
                        'bg-gradient-to-r from-green-100/60 to-yellow-100/80 border-l-4 border-green-500'
                      }`}
                    >
                      {entry.type === 'bilbo' && (
                        <div>
                          {entry.description && (
                            <div className="text-xs text-orange-600 mb-1 font-medium">
                              {t('messages.bilbo')} ({entry.description})
                            </div>
                          )}
                          <div className="text-sm">
                            🧑 {entry.content}
                          </div>
                        </div>
                      )}
                      
                      {entry.type === 'world' && (
                        <div>
                          <div className="text-sm">
                            🌍 {entry.content}
                          </div>
                          {entry.description && (
                            <div className="text-xs text-gray-500 mt-2 italic bg-gray-50/50 px-2 py-1 rounded border-l-2 border-gray-300">
                              {entry.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-gradient-to-r from-green-50/30 to-yellow-50/50 border-t border-green-200 shadow-inner">
              {isProcessing && (
                <div className="mb-3 text-center">
                  <div className="text-green-700 font-medium flex items-center justify-center gap-2">
                    <span>{t('processing.text')}</span>
                    <div className="animate-spin w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <input
                  ref={actionInputRef}
                  type="text"
                  value={playerAction}
                  onChange={(e) => setPlayerAction(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={t('placeholders.playerAction')}
                  className="flex-1 px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/90 shadow-inner"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSubmitAction}
                  disabled={isProcessing || !playerAction.trim()}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 text-white px-6 py-3 rounded-xl font-medium shadow-lg transition-all duration-200"
                >
                  {isProcessing ? t('processing.action') : t('buttons.send')}
                </button>
              </div>
            </div>
          </div>


          {/* Right Column - Bilbo State */}
          <div 
            className="bg-gradient-to-b from-green-50/40 to-yellow-50/60 p-4 overflow-y-auto flex-shrink-0 overflow-hidden shadow-inner"
            style={{ width: '50%' }}
          >            
            <div className="space-y-4">
              <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border-2 border-green-300">
                <h4 className="font-semibold text-green-800 mb-1">🗿 {t('sections.character')}</h4>
                <p className="text-xs text-green-600 mb-2 font-medium">{t('descriptions.characterBase')}</p>
                <p className="text-sm text-green-800/90 break-words font-medium">{gameState.bilboState.character}</p>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-green-200">
                <h4 className="font-semibold text-green-700 mb-2">❤️ {t('sections.health')}</h4>
                <p className="text-xs text-green-600 mb-2 font-medium">{t('descriptions.healthStatus')}</p>
                <p className="text-sm text-green-800/80 break-words">{gameState.bilboState.health}</p>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-amber-200">
                <h4 className="font-semibold text-amber-700 mb-1">😊 {t('sections.emotions')}</h4>
                <div className="text-sm text-amber-800/80">
                  {gameState.bilboState.emotions.map((emotion, index) => (
                    <div key={index} className="mb-1 break-words">
                      <span className="text-amber-600">•</span> {emotion.trim()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-amber-200">
                <h4 className="font-semibold text-amber-700 mb-2">💭 {t('sections.thoughts')}</h4>
                <div className="text-sm italic text-amber-800/80">
                  {gameState.bilboState.thoughts.map((thought, index) => (
                    <div key={index} className="mb-1 break-words">
                      "{thought.trim()}"
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-green-200">
                <h4 className="font-semibold text-green-700 mb-2">📅 {t('sections.plans')}</h4>
                <p className="text-xs text-green-600 mb-2 font-medium">{t('descriptions.plansLongTerm')}</p>
                <div className="text-sm text-green-800/80">
                  {gameState.bilboState.plans.map((plan, index) => (
                    <div key={index} className="mb-1 break-words">
                      <span className="text-green-600">•</span> {plan.trim()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-green-200">
                <h4 className="font-semibold text-green-700 mb-2">⚡ {t('sections.tasks')}</h4>
                <p className="text-xs text-green-600 mb-2 font-medium">{t('descriptions.tasksShortTerm')}</p>
                <div className="text-sm text-green-800/80">
                  {gameState.bilboState.tasks.map((task, index) => (
                    <div key={index} className="mb-1 break-words">
                      <span className="text-green-600">•</span> {task.trim()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-green-200">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-green-700">🧠 {t('sections.memory')}</h4>
                  <button
                    onClick={() => setShowMemories(!showMemories)}
                    className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded-lg bg-green-100/50 transition-colors duration-200"
                  >
                    {showMemories ? t('buttons.hide') : t('buttons.show')}
                  </button>
                </div>
                {showMemories && (
                  <>
                    {/* Memory Search Controls */}
                    <div className="mb-3 space-y-2 p-3 bg-green-50/50 rounded-lg border border-green-200/50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t('placeholders.memorySearch')}
                          value={memorySearch}
                          onChange={(e) => setMemorySearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleMemorySearch();
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-green-300 rounded bg-white/80 focus:outline-none focus:ring-2 focus:ring-green-200"
                        />
                        <button
                          onClick={loadMemories}
                          className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                          title={t('buttons.resetMemories')}
                        >
                          ↻
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-green-700">{t('memory.threshold')}</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={memoryThreshold}
                          onChange={(e) => setMemoryThreshold(parseFloat(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-xs text-green-600 w-8">{memoryThreshold}</span>
                      </div>
                    </div>
                    
                    <div className="h-48 overflow-y-auto space-y-2 border border-green-200 rounded-lg bg-green-50/30 p-3">
                      {memories.length === 0 ? (
                        <p className="text-xs text-green-600 italic">{t('messages.memoryEmpty')}</p>
                      ) : (
                      memories.map((memory, index) => (
                        <div key={memory.id || index} className="bg-white/80 p-3 rounded-lg text-xs shadow-sm border border-green-200/50">
                          <div className="text-green-600 mb-1 text-xs break-words flex justify-between">
                            <span>⭐ {memory.importance}</span>
                            {memory.similarity && <span className="text-blue-600">📊 {memory.similarity}</span>}
                          </div>
                          <div className="text-green-800 break-words">{memory.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="bg-gradient-to-r from-green-100/50 to-yellow-100/50 border-t border-green-200 p-3 shadow-inner">
          <div className="text-center text-xs text-green-700">
            {t('stats.tokensUsed', { count: tokenUsage.total })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HobbitGame;