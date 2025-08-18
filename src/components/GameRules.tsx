import { useTranslation } from 'react-i18next';

interface GameRulesProps {
  onStartGame: () => void;
  onReturnToGame: () => void;
  onToggleLanguage: () => void;
  currentLanguage: string;
  hasExistingGame: boolean;
}

const GameRules: React.FC<GameRulesProps> = ({ onStartGame, onReturnToGame, onToggleLanguage, currentLanguage, hasExistingGame }) => {
  const { t } = useTranslation(['common', 'game', 'rules']);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-green-50 via-yellow-50 to-orange-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-100 via-green-100 to-yellow-100 border-2 border-yellow-300 rounded-xl p-6 mb-6 shadow-lg text-center">
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <h1 className="text-4xl font-bold text-emerald-800 drop-shadow-sm">
              🍃 {t('rules:title')}
            </h1>
            <button
              onClick={onToggleLanguage}
              className="px-3 py-2 bg-teal-700 text-yellow-50 rounded text-sm hover:bg-teal-800 shadow-md border border-teal-600"
              title={t('tooltips.language')}
            >
              {currentLanguage === 'ru' ? '🇷🇺 RU' : '🇺🇸 EN'}
            </button>
          </div>
          <p className="text-xl text-emerald-700 italic">
            {t('rules:subtitle')}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 shadow-lg border border-yellow-200">
          
          {/* What is this game */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-amber-800 mb-4 border-b-2 border-amber-300 pb-2">
              🎭 {t('rules:sections.what.title')}
            </h2>
            <div className="text-lg text-stone-700 leading-relaxed space-y-3">
              <p>{t('rules:sections.what.description1')}</p>
              <p>{t('rules:sections.what.description2')}</p>
            </div>
          </section>

          {/* How Bilbo reacts */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-emerald-800 mb-4 border-b-2 border-emerald-300 pb-2">
              🧙‍♂️ {t('rules:sections.bilbo.title')}
            </h2>
            <div className="bg-emerald-50 p-6 rounded-lg border-l-4 border-emerald-500 space-y-3">
              <p className="text-lg text-emerald-900">{t('rules:sections.bilbo.personality')}</p>
              <ul className="text-emerald-800 space-y-2 ml-4">
                <li>{t('rules:sections.bilbo.trait1')}</li>
                <li>{t('rules:sections.bilbo.trait2')}</li>
              </ul>
            </div>
          </section>

          {/* How to play */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-blue-800 mb-4 border-b-2 border-blue-300 pb-2">
              🎮 {t('rules:sections.howto.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-bold text-blue-900 mb-2">1. {t('rules:sections.howto.step1.title')}</h3>
                <p className="text-blue-800 mb-2">{t('rules:sections.howto.step1.description')}</p>
                <div className="bg-blue-100 p-3 rounded italic text-blue-700 text-sm">
                  "{t('rules:sections.howto.step1.example')}"
                </div>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg border-l-4 border-purple-500">
                <h3 className="font-bold text-purple-900 mb-2">2. {t('rules:sections.howto.step2.title')}</h3>
                <p className="text-purple-800 mb-2">{t('rules:sections.howto.step2.description')}</p>
                <div className="bg-purple-100 p-3 rounded italic text-purple-700 text-sm">
                  "{t('rules:sections.howto.step2.example')}"
                </div>
              </div>
            </div>
          </section>

          {/* Special features */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-orange-800 mb-4 border-b-2 border-orange-300 pb-2">
              ✨ {t('rules:sections.features.title')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-yellow-50 p-4 rounded-lg text-center border border-yellow-300">
                <div className="text-2xl mb-2">🧠</div>
                <h3 className="font-bold text-yellow-800 mb-1">{t('rules:sections.features.will.title')}</h3>
                <p className="text-yellow-700 text-sm">{t('rules:sections.features.will.description')}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center border border-red-300">
                <div className="text-2xl mb-2">💝</div>
                <h3 className="font-bold text-red-800 mb-1">{t('rules:sections.features.time.title')}</h3>
                <p className="text-red-700 text-sm">{t('rules:sections.features.time.description')}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg text-center border border-indigo-300">
                <div className="text-2xl mb-2">📖</div>
                <h3 className="font-bold text-indigo-800 mb-1">{t('rules:sections.features.memory.title')}</h3>
                <p className="text-indigo-700 text-sm">{t('rules:sections.features.memory.description')}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center border border-green-300">
                <div className="text-2xl mb-2">🌿</div>
                <h3 className="font-bold text-green-800 mb-1">{t('rules:sections.features.therapy.title')}</h3>
                <p className="text-green-700 text-sm">{t('rules:sections.features.therapy.description')}</p>
              </div>
            </div>
          </section>

          {/* Game Buttons */}
          <div className="text-center space-y-4">
            {hasExistingGame ? (
              <div className="space-y-3">
                <button
                  onClick={onReturnToGame}
                  className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xl font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg border-2 border-blue-500 transform hover:scale-105 transition-all duration-200"
                >
                  📖➡️🎮 {t('rules:returnToGame')}
                </button>
                <p className="text-sm text-stone-600 italic">
                  {t('rules:returnToGameHint')}
                </p>
                <div className="border-t border-stone-300 pt-4">
                  <button
                    onClick={() => {
                      if (confirm(t('rules:confirmNewGame'))) {
                        onStartGame();
                      }
                    }}
                    className="px-8 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-lg font-bold rounded-lg hover:from-emerald-700 hover:to-teal-700 shadow-md border border-emerald-500 opacity-75 hover:opacity-100 transition-all"
                  >
                    🆕 {t('rules:startNewGame')}
                  </button>
                  <p className="mt-2 text-xs text-red-600">
                    {t('rules:startNewGameWarning')}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={onStartGame}
                  className="px-12 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xl font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg border-2 border-emerald-500 transform hover:scale-105 transition-all duration-200"
                >
                  🎮 {t('rules:startGame')}
                </button>
                <p className="mt-4 text-sm text-stone-600 italic">
                  {t('rules:startGameHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameRules;