import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// ========================
// TYPES
// ========================

interface BilboState {
  character: string;
  characterEvolution: number; // Accumulated character changes: +good, -evil
  health: string;
  tasks: string;
  thoughts: string;
  emotions: string;
  plans: string;
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
  environment: string;
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

const loadInitialState = async (): Promise<GameState> => {
  const response = await fetch('/locales/ru/state.json');
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
    environment: '',
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
        const initialState = await loadInitialState();
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
    setPlayerAction('');
    setIsProcessing(true);
    setProcessingStatus('Processing action...');

    try {
      // Call API (server handles history updates now)
      const response = await processGameAction(gameState, action, language);

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
    const initialState = await loadInitialState();
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
              
              <div className="flex gap-3">
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
                  className="bg-blue-600/80 hover:bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 px-3 py-2 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 text-white"
                >
                  <option value="ru">🇷🇺 RU</option>
                  <option value="en">🇬🇧 EN</option>
                  <option value="es">🇪🇸 ES</option>
                </select>
                <button
                  onClick={() => setShowRules(true)}
                  className="bg-green-600/80 hover:bg-green-500/90 backdrop-blur-sm border border-green-400/30 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 hover:shadow-green-500/25"
                >
                  📜 {t('buttons.showRules')}
                </button>
                <button
                  onClick={startNewGame}
                  className="bg-amber-600/80 hover:bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 hover:shadow-amber-500/25"
                >
                  ✨ {t('buttons.newGame')}
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
                  <span>{gameState.time.day} {gameState.time.month} {gameState.time.time}</span>
                </div>
              </div>
              
              {gameState.environment && (
                <div className="bg-green-50 text-gray-700 italic px-3 py-1.5 rounded-xl text-sm border border-green-200 flex items-center h-full w-3/5 justify-center">
                  <span className="mr-1.5">🏕️</span>
                  {gameState.environment}
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
                <p className="text-sm text-amber-800/80 break-words">{gameState.bilboState.emotions}</p>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-amber-200">
                <h4 className="font-semibold text-amber-700 mb-2">💭 {t('sections.thoughts')}</h4>
                <p className="text-sm italic text-amber-800/80 break-words">"{gameState.bilboState.thoughts}"</p>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border border-green-200">
                <h4 className="font-semibold text-green-700 mb-2">📅 {t('sections.plans')}</h4>
                <p className="text-xs text-green-600 mb-2 font-medium">{t('descriptions.plansLongTerm')}</p>
                <div className="text-sm text-green-800/80">
                  {gameState.bilboState.plans.split(',').map((plan, index) => (
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
                  {gameState.bilboState.tasks.split(',').map((task, index) => (
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
                  <div className="h-48 overflow-y-auto space-y-2 border border-green-200 rounded-lg bg-green-50/30 p-3">
                    {memories.length === 0 ? (
                      <p className="text-xs text-green-600 italic">{t('messages.memoryEmpty')}</p>
                    ) : (
                      memories.map((memory, index) => (
                        <div key={memory.id || index} className="bg-white/80 p-3 rounded-lg text-xs shadow-sm border border-green-200/50">
                          <div className="text-green-600 mb-1 text-xs break-words font-medium">
                            {memory.time}
                          </div>
                          <div className="text-green-600 mb-1 text-xs break-words">
                            📍 {memory.location} | ⭐ {memory.importance}
                          </div>
                          <div className="text-green-800 break-words">{memory.content}</div>
                        </div>
                      ))
                    )}
                  </div>
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