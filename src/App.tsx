import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { HistoryEntry } from './types';
import GameRules from './components/GameRules';
import { BackgroundMusic } from './components/BackgroundMusic';
import { GAME_CONFIG, PROCESSING_DELAYS } from './constants';
import { formatTextWithBreaks } from './utils/textProcessing';
import { getHealthColor } from './utils/gameUtils';
import { saveGameToFile, loadGameFromFile, saveToLocalStorage, loadFromLocalStorage, type GameState } from './utils/storage';
import { gameApi } from './services/gameApi';

interface GameConfig {
  game: {
    model: string;
    maxTokens: {
      formatAction: number;
      generateResponse: number;
    };
    historyLength: number;
    language: string;
  };
}


// API calls now handled by gameApi service

const TolkienRPG = () => {
  const { t, i18n } = useTranslation(['common', 'state']);
  const [showRules, setShowRules] = useState(true);
  const [tokenUsage, setTokenUsage] = useState({ total: 0 });
  const [gameState, setGameState] = useState<GameState>({
    location: { region: "", settlement: "", place: "" },
    character: "",
    health: 100,
    state: "",
    will: "",
    environment: "",
    time: { day: 1, month: "", year: 2941, era: "", timeOfDay: "", season: "" },
    history: [],
    memory: { historySummary: null },
    lastSummaryLength: 0
  });

  const [playerAction, setPlayerAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isCompressingHistory, setIsCompressingHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const actionInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll history down on change
  useEffect(() => {
    if (historyRef.current) {
      setTimeout(() => {
        if (historyRef.current) {
          historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
      }, PROCESSING_DELAYS.SCROLL_TIMEOUT);
    }
  }, [gameState.history]);

  // Save game
  const saveGame = () => {
    saveGameToFile(gameState, t);
  };

  // Load game
  const loadGame = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    loadGameFromFile(
      file,
      t,
      (gameState, timestamp) => {
        setIsInitialLoad(false); // Enable autosave
        setGameState(gameState);
        alert(t('messages.gameLoaded', { timestamp }));
      },
      (errorKey) => {
        alert(t(errorKey));
      }
    );
    event.target.value = '';
  };

  // New game
  const newGame = () => {
    setIsInitialLoad(false); // Enable autosave
    setGameState({
      location: {
        region: t('state:initialState.location.region'),
        settlement: t('state:initialState.location.settlement'),
        place: t('state:initialState.location.place')
      },
      character: t('state:character'),
      health: GAME_CONFIG.INITIAL_HEALTH,
      state: t('state:initialState.state'),
      will: t('state:initialState.will'),
      environment: t('state:initialState.environment'),
      time: {
        day: t('state:initialState.time.day'),
        month: t('state:initialState.time.month'),
        year: t('state:initialState.time.year'),
        era: t('state:initialState.time.era'),
        timeOfDay: t('state:initialState.time.timeOfDay'),
        season: t('state:initialState.time.season')
      },
      history: [{
        text: t('state:initialState.history'),
        bilboState: t('state:initialState.state'),
        type: "initial" // Initial entry
      }],
      memory: {
        historySummary: null
      },
      lastSummaryLength: 0
    });

    setPlayerAction('');
  };

  // Change language
  const changeLanguage = (newLang: string) => {
    i18n.changeLanguage(newLang).then(() => {
      alert(t('messages.languageChanged'));
    });
  };

  // Return to existing game from rules page
  const returnToGame = () => {
    setShowRules(false);
  };

  // Start new game from rules page
  const startNewGame = () => {
    newGame(); // This will reset the game state
    setShowRules(false);
  };

  // Return to rules page
  const showRulesPage = () => {
    setShowRules(true);
  };


  const processAction = async (action: string | null = null) => {
    const actionToProcess = action || playerAction;
    if (!actionToProcess.trim()) return;

    setIsProcessing(true);
    setProcessingStatus(t('status.processing'));

    try {
      // Format player's action
      const formatData = await gameApi.formatAction(actionToProcess, gameState, i18n.language);
      const { formattedAction } = formatData;

      // Account for action formatting tokens
      if (formatData.usage) {
        setTokenUsage(prev => ({
          total: prev.total + formatData.usage!.total
        }));
      }

      setProcessingStatus(t('status.generating'));

      // Generate game master's response
      const narratorResponse = await gameApi.generateResponse(gameState, formattedAction, i18n.language);

      // Reset compression state
      setIsCompressingHistory(false);

      setProcessingStatus(t('status.formatting'));

      // Update token statistics
      if (narratorResponse.usage) {
        setTokenUsage(prev => ({
          total: prev.total + narratorResponse.usage!.total
        }));
      }


      // Use server history (may include summary) and add current response
      const serverHistory = narratorResponse.gameState.history || [];

      setGameState(prev => {
        // Add formatted Bilbo action first
        const bilboActionEntry = {
          text: formattedAction,
          bilboState: prev.state,
          type: 'bilbo-action' // Mark as Bilbo's action
        };

        // Add AI response as a separate entry
        const worldResponseEntry = {
          text: narratorResponse.narration,
          bilboState: null, // No Bilbo state for world response
          type: 'world-response', // Mark as world response
          keyEvent: narratorResponse.keyEvent || null // Key event
        };

        // Add both Bilbo action and world response to history
        const finalHistory = [...(prev.history || []), bilboActionEntry, worldResponseEntry];

        const newState = {
          ...prev,
          location: narratorResponse.gameState.location || prev.location,
          health: narratorResponse.gameState.health !== undefined ? narratorResponse.gameState.health : prev.health,
          state: narratorResponse.gameState.state || prev.state,
          will: narratorResponse.gameState.will || prev.will,
          environment: narratorResponse.gameState.environment || prev.environment,
          time: narratorResponse.gameState.time || prev.time,
          lastSummaryLength: narratorResponse.gameState.lastSummaryLength !== undefined 
            ? narratorResponse.gameState.lastSummaryLength 
            : prev.lastSummaryLength,
          memory: {
            // Add summary to memory if it exists
            historySummary: narratorResponse.gameState.memory?.historySummary || prev.memory.historySummary
          },
          history: finalHistory
        };

        // CREATE SUMMARY AFTER ADDING AI RESPONSE
        setTimeout(async () => {
          try {
            const compressionResult = await gameApi.compressHistory(newState, i18n.language);
              
            if (compressionResult.compressionNeeded) {
              setProcessingStatus(t('status.compressing'));
              
              // Account for history summarization tokens
              if (compressionResult.usage) {
                setTokenUsage(prev => ({
                  total: prev.total + compressionResult.usage!.total
                }));
              }
              
              // Small delay so the user can see the process
              setTimeout(() => {
                setGameState(currentState => ({
                  ...currentState,
                  memory: {
                    ...currentState.memory,
                    historySummary: compressionResult.historySummary
                  },
                  lastSummaryLength: compressionResult.lastSummaryLength
                }));
                
                setProcessingStatus('');
              }, PROCESSING_DELAYS.COMPRESSION_UI_DELAY);
            } else {
              setProcessingStatus('');
            }
          } catch (error) {
            console.error('History compression error:', error);
            setProcessingStatus('');
          }
        }, PROCESSING_DELAYS.COMPRESSION_DELAY);

        return newState;
      });
    } catch (error) {
      console.error('Action processing error:', error);
      alert(t('messages.actionError'));
    } finally {
      setPlayerAction(''); // Clear input field after response or error
      setIsProcessing(false);
      setProcessingStatus('');
    }

    // Set focus to action input field
    setTimeout(() => {
      if (actionInputRef.current) {
        actionInputRef.current.focus();
      }
    }, PROCESSING_DELAYS.FOCUS_TIMEOUT);
  };


  // Autosave  
  const [isInitialLoad, setIsInitialLoad] = useState(true);



  // Function for processing and styling history
  const processHistoryEntry = (entry: any, index: number) => {
    const text = entry.text;
    const bilboState = entry.bilboState;
    const type = entry.type;

    // If it's Bilbo's action - show in green
    if (type === 'bilbo-action') {
      return (
        <div
          className="bg-emerald-100 border-l-4 border-emerald-500 pl-3 py-2 rounded-r"
        >
          <div className="text-emerald-800 font-medium text-sm mb-2">
            {t('bilboStates.action', { state: bilboState })}
          </div>
          <div
            className="text-emerald-800"
            dangerouslySetInnerHTML={{
              __html: formatTextWithBreaks(text)
            }}
          />
        </div>
      );
    }

    // If it's a world response - show in default color + key event
    if (type === 'world-response') {
      return (
        <div>
          <div
            className="text-amber-800"
            dangerouslySetInnerHTML={{
              __html: formatTextWithBreaks(text)
            }}
          />
          {(entry as any).keyEvent && (
            <div className="mt-2 text-gray-600 text-sm italic">
              ⚡ {(entry as any).keyEvent}
            </div>
          )}
        </div>
      );
    }

    // If it's a summary - show with special styling
    if (type === 'summary') {
      return (
        <div className="bg-gray-100 border-l-4 border-gray-400 pl-3 py-2 rounded-r">
          <div className="text-gray-600 font-medium text-sm mb-2">
            {t('bilboStates.summary')}
          </div>
          <div
            className="text-gray-700 text-sm"
            dangerouslySetInnerHTML={{
              __html: formatTextWithBreaks(text)
            }}
          />
        </div>
      );
    }

    // For old entries without type - use the old splitting logic
    const parts = text.split('\n\n');

    if (parts.length >= 2) {
      const bilboAction = parts[0]; // First part is Bilbo's action (AI-generated)
      const worldReaction = parts.slice(1).join('\n\n'); // The rest is the world's reaction

      return (
        <div className="space-y-3">
          {/* Bilbo's action - AI-generated text */}
          <div
            className="bg-emerald-100 border-l-4 border-emerald-500 pl-3 py-2 rounded-r"
          >
            <div className="text-emerald-800 font-medium text-sm mb-2">
              {t('bilboStates.action', { state: bilboState }).replace('🎭 ', '🎭 ')}
            </div>
            <div
              className="text-emerald-800"
              dangerouslySetInnerHTML={{
                __html: formatTextWithBreaks(bilboAction)
              }}
            />
          </div>

          {/* World reaction */}
          <div
            className="text-amber-800"
            dangerouslySetInnerHTML={{
              __html: formatTextWithBreaks(worldReaction)
            }}
          />
        </div>
      );
    } else {
      // If there's no split (e.g., initial entry)
      return (
        <div
          className="text-amber-800"
          dangerouslySetInnerHTML={{
            __html: formatTextWithBreaks(text)
          }}
        />
      );
    }
  };


  // Autosave functions (now using utilities)
  const saveGameToLocalStorage = (state: any) => saveToLocalStorage(state);
  
  const loadGameFromLocalStorage = () => {
    const savedState = loadFromLocalStorage();
    if (savedState) {
      setGameState(savedState);
      return true;
    }
    return false;
  };


  // Load configuration on startup
  const [config, setConfig] = useState<GameConfig | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Load configuration
        const config = await gameApi.getConfig();
        setConfig(config);

        // Initialize with default state using translations
        const defaultState = {
          location: {
            region: t('state:initialState.location.region'),
            settlement: t('state:initialState.location.settlement'),
            place: t('state:initialState.location.place')
          },
          character: t('state:character'),
          health: GAME_CONFIG.INITIAL_HEALTH,
          state: t('state:initialState.state'),
          will: t('state:initialState.will'),
          environment: t('state:initialState.environment'),
          time: {
            day: t('state:initialState.time.day'),
            month: t('state:initialState.time.month'),
            year: t('state:initialState.time.year'),
            era: t('state:initialState.time.era'),
            timeOfDay: t('state:initialState.time.timeOfDay'),
            season: t('state:initialState.time.season')
          },
          history: [{
            text: t('state:initialState.history'),
            bilboState: t('state:initialState.state'),
            type: "initial"
          }],
          memory: {
            historySummary: null
          },
          lastSummaryLength: 0
        };

        setGameState(defaultState);
        
        // Try to overwrite with autosave if available
        loadGameFromLocalStorage();
        
        setIsInitialLoad(false);
      } catch (error) {
        console.error('Failed to initialize game:', error);
      }
    };

    initializeGame();
  }, [t]); // Added t as dependency

  // Autosave on game state change
  useEffect(() => {
    if (config && !isInitialLoad) { // Save only after initial load
      saveGameToLocalStorage(gameState);
    }
  }, [gameState, config, isInitialLoad]);


  if (!config || gameState.character === "") {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-green-50 via-yellow-50 to-orange-50 min-h-screen flex items-center justify-center">
        <div className="text-emerald-800 font-medium text-lg drop-shadow-sm">{t('loading')}</div>
      </div>
    );
  }

  // Show rules page first
  if (showRules) {
    const hasExistingGame = gameState.history && gameState.history.length > 1;
    
    return (
      <GameRules 
        onStartGame={startNewGame}
        onReturnToGame={returnToGame}
        onChangeLanguage={changeLanguage}
        currentLanguage={i18n.language}
        hasExistingGame={hasExistingGame}
      />
    );
  }

  return (
    <div className="w-full p-6 bg-gradient-to-br from-green-50 via-yellow-50 to-orange-50 min-h-screen text-base">
      <div className="bg-gradient-to-r from-yellow-100 via-green-100 to-yellow-100 border-2 border-yellow-300 rounded-xl p-4 mb-4 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl md:text-2xl font-bold text-emerald-800 drop-shadow-sm">
            <span className="hidden md:inline">{t('title')}</span>
            <span className="md:hidden">🍃 Хоббит</span>
          </h1>

          <div className="flex gap-1 items-center">
            <button
              onClick={newGame}
              className="px-2 py-1 bg-emerald-700 text-yellow-50 rounded text-xs hover:bg-emerald-800 shadow-md border border-emerald-600"
              title={t('tooltips.newGame')}
            >
              🆕
            </button>
            <button
              onClick={saveGame}
              className="px-2 py-1 bg-amber-700 text-yellow-50 rounded text-xs hover:bg-amber-800 shadow-md border border-amber-600"
              title={t('tooltips.saveGame')}
            >
              💾
            </button>
            <label className="px-2 py-1 bg-orange-700 text-yellow-50 rounded text-xs hover:bg-orange-800 cursor-pointer shadow-md border border-orange-600" title={t('tooltips.loadGame')}>
              📁
              <input type="file" accept=".json" onChange={loadGame} className="hidden" />
            </label>
            <button
              onClick={showRulesPage}
              className="px-2 py-1 bg-purple-700 text-yellow-50 rounded text-xs hover:bg-purple-800 shadow-md border border-purple-600"
              title={t('tooltips.rules')}
            >
              📖
            </button>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="px-2 py-1 bg-teal-700 text-yellow-50 rounded text-xs hover:bg-teal-800 shadow-md border border-teal-600"
              title={t('tooltips.language')}
            >
              <option value="ru">🇷🇺 RU</option>
              <option value="en">🇺🇸 EN</option>
              <option value="es">🇪🇸 ES</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 text-sm">
          <div className="flex gap-4 items-start">
            <div className="hidden md:block">
              <img src="/bilbo.png" alt="Bilbo Baggins" className="w-20 h-20 shadow-lg" />
            </div>
            <div className="space-y-1">
              <div><strong>{t('gameInfo.location')} </strong>
                <span className="text-amber-700">
                  {gameState.location.region} → {gameState.location.settlement} → {gameState.location.place}
                </span>
              </div>
              <div><strong>{t('gameInfo.environment')} </strong>
                <span className="text-blue-700 italic">
                  {gameState.environment}
                </span>
              </div>
              <div><strong>{t('gameInfo.time')} </strong>
                <span className="text-purple-700">
                  {gameState.time.day} {gameState.time.month} {gameState.time.year} {gameState.time.era}, {gameState.time.timeOfDay}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1 md:ml-6">
            <div><strong>{t('gameInfo.state')} </strong>
              <span className={`font-bold italic ${getHealthColor(gameState.health)}`}>
                {gameState.state}
              </span>
            </div>
            <div><strong>{t('gameInfo.will')} </strong>
              <span className="text-indigo-700 italic">
                {gameState.will}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid: left and right columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Left column: History + What Bilbo Says */}
        <div className="lg:col-span-2 space-y-4">
          {/* History */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-amber-600 shadow-lg rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 pb-3">
              <h3 className="font-bold text-amber-900 text-lg drop-shadow-sm">
                {t('sections.history')}
                {isCompressingHistory && (
                  <span className="text-orange-600 text-sm ml-2 animate-pulse">{t('status.compressing')}</span>
                )}
              </h3>
            </div>
            <div ref={historyRef} className="h-80 overflow-y-auto bg-white/30 backdrop-blur-sm custom-scrollbar mx-4 mb-4 rounded-md">
              <div className="p-2">
                {!gameState.history || gameState.history.length === 0 ? (
                  <p className="text-amber-700 italic text-sm">{t('messages.noHistory')}</p>
                ) : (
                  <div className="space-y-4">
                  {gameState.history.map((entry, index) => (
                    <div key={index} className="text-base leading-relaxed">
                      {processHistoryEntry(entry, index)}
                      {index < gameState.history.length - 1 && (
                        <hr className="my-4 border-amber-300" />
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>
          </div>

          {/* Player action input */}
          <div className="bg-gradient-to-br from-green-50 to-teal-50 border-l-4 border-emerald-600 p-4 shadow-lg rounded-lg">
            <h3 className="font-bold text-emerald-900 mb-3 text-lg drop-shadow-sm">{t('sections.playerAction')}</h3>
            <div className="flex gap-3">
              <input
                ref={actionInputRef}
                type="text"
                value={playerAction}
                onChange={(e) => setPlayerAction(e.target.value)}
                placeholder={t('placeholders.action')}
                className="flex-1 p-3 border border-amber-300 rounded-lg text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white/80 backdrop-blur-sm"
                onKeyPress={(e) => e.key === 'Enter' && !isProcessing && processAction()}
                disabled={isProcessing}
              />
              <button
                onClick={() => processAction()}
                disabled={isProcessing || !playerAction.trim()}
                className="px-6 py-3 bg-emerald-700 text-yellow-50 rounded-lg hover:bg-emerald-800 disabled:bg-stone-400 disabled:cursor-not-allowed text-base font-medium shadow-md border border-emerald-600"
              >
                {isProcessing ? '⏳' : '➤'}
              </button>
            </div>
            {processingStatus && (
              <div className="mt-2 text-emerald-700 text-sm font-medium animate-pulse">
                {processingStatus}
              </div>
            )}
          </div>

        </div>

        {/* Right column: Summary */}
        <div className="bg-gradient-to-br from-stone-50 to-yellow-50 border-l-4 border-stone-500 p-4 max-h-[calc(100vh-200px)] overflow-y-auto shadow-lg rounded-lg custom-scrollbar">
          <h3 className="font-bold text-stone-800 text-lg mb-4 drop-shadow-sm">{t('sections.summary')}</h3>
          {gameState.memory.historySummary ? (
            <div className="bg-white/70 p-4 rounded-lg shadow-md backdrop-blur-sm border border-stone-200">
              <div className="text-stone-800 leading-relaxed text-sm"
                dangerouslySetInnerHTML={{
                  __html: gameState.memory.historySummary.replace(/\n/g, '<br/>').replace(/SUMMARY:\s*/, '')
                }}
              />
            </div>
          ) : (
            <div className="bg-white/70 p-4 rounded-lg shadow-md backdrop-blur-sm border border-stone-200">
              <p className="text-stone-600 italic text-sm">{t('messages.noSummary')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Token usage statistics at the bottom */}
      <div className="mt-6 pt-4 border-t-2 border-amber-400 text-center bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg p-3 shadow-md">
        <div className="text-base text-amber-900 font-medium drop-shadow-sm">
          {t('status.tokens')} <span className="font-mono">{tokenUsage.total.toLocaleString()}</span> {t('status.total')}
        </div>
      </div>

      {/* Background Music Component */}
      <BackgroundMusic autoPlay={true} volume={0.3} />

    </div>
  );
};

export default TolkienRPG;