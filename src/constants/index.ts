export const API_ENDPOINTS = {
  BASE: '/api',
  CONFIG: '/api/config',
  FORMAT_ACTION: '/api/format-action',
  GENERATE_RESPONSE: '/api/generate-response',
  COMPRESS_HISTORY: '/api/compress-history',
} as const;

export const STORAGE_KEYS = {
  AUTOSAVE: 'hobbit-game-autosave',
} as const;

export const GAME_CONFIG = {
  SAVE_VERSION: '1.0',
  INITIAL_HEALTH: 100,
} as const;

export const THEMES = {
  tolkien: {
    PRIMARY: 'emerald',
    SECONDARY: 'amber',
    ACCENT: 'orange',
    BG_MAIN: 'green-50',
    BG_PANEL: 'yellow-50',
    BG_GRADIENT: 'from-green-50 via-yellow-50 to-orange-50',
    BG_HEADER: 'from-yellow-100 via-green-100 to-yellow-100',
    BORDER_MAIN: 'yellow-300',
    TEXT_PRIMARY: 'emerald-800',
    TEXT_SECONDARY: 'amber-800',
    TEXT_ACCENT: 'gray-600',
  },
  dark: {
    PRIMARY: 'green',
    SECONDARY: 'yellow',
    ACCENT: 'red',
    BG_MAIN: 'gray-800',
    BG_PANEL: 'gray-700',
    BG_GRADIENT: 'from-gray-800 via-gray-700 to-gray-800',
    BG_HEADER: 'from-gray-700 via-gray-600 to-gray-700',
    BORDER_MAIN: 'gray-600',
    TEXT_PRIMARY: 'green-300',
    TEXT_SECONDARY: 'yellow-300',
    TEXT_ACCENT: 'gray-300',
  },
  forest: {
    PRIMARY: 'green',
    SECONDARY: 'amber',
    ACCENT: 'teal',
    BG_MAIN: 'green-50',
    BG_PANEL: 'green-100',
    BG_GRADIENT: 'from-green-50 via-emerald-50 to-green-50',
    BG_HEADER: 'from-green-100 via-emerald-100 to-green-100',
    BORDER_MAIN: 'green-400',
    TEXT_PRIMARY: 'green-800',
    TEXT_SECONDARY: 'amber-700',
    TEXT_ACCENT: 'teal-700',
  },
} as const;

export type ThemeName = keyof typeof THEMES;
export const DEFAULT_THEME: ThemeName = 'tolkien';

export const getThemeClasses = (themeName: ThemeName = DEFAULT_THEME) => {
  const theme = THEMES[themeName];
  
  return {
    // History entry styles
    BILBO_ACTION: `bg-${theme.PRIMARY}-100 border-l-4 border-${theme.PRIMARY}-500 pl-3 py-2 rounded-r`,
    BILBO_STATE_TEXT: `text-${theme.TEXT_PRIMARY} font-medium text-sm mb-2`,
    BILBO_CONTENT: `text-${theme.TEXT_PRIMARY}`,
    WORLD_RESPONSE: `text-${theme.TEXT_SECONDARY}`,
    SUMMARY_CONTAINER: `bg-gray-100 border-l-4 border-gray-400 pl-3 py-2 rounded-r`,
    SUMMARY_HEADER: `text-${theme.TEXT_ACCENT} font-medium text-sm mb-2`,
    SUMMARY_CONTENT: `text-${theme.TEXT_ACCENT} text-sm`,
    
    // Main layout styles
    LOADING_CONTAINER: `max-w-4xl mx-auto p-6 bg-gradient-to-br ${theme.BG_GRADIENT} min-h-screen flex items-center justify-center`,
    LOADING_TEXT: `text-${theme.TEXT_PRIMARY} font-medium text-lg drop-shadow-sm`,
    MAIN_CONTAINER: `w-full p-6 bg-gradient-to-br ${theme.BG_GRADIENT} min-h-screen text-base`,
    HEADER_CONTAINER: `bg-gradient-to-r ${theme.BG_HEADER} border-2 border-${theme.BORDER_MAIN} rounded-xl p-4 mb-4 shadow-lg`,
    HEADER_ROW: 'flex justify-between items-center mb-3',
    GAME_TITLE: `text-2xl md:text-2xl font-bold text-${theme.TEXT_PRIMARY} drop-shadow-sm`,
    
    // Button styles
    BUTTON_PRIMARY: `bg-${theme.PRIMARY}-700 text-yellow-50 hover:bg-${theme.PRIMARY}-800 border border-${theme.PRIMARY}-600`,
    BUTTON_SECONDARY: `bg-${theme.SECONDARY}-700 text-yellow-50 hover:bg-${theme.SECONDARY}-800 border border-${theme.SECONDARY}-600`,
    BUTTON_ACCENT: `bg-${theme.ACCENT}-700 text-yellow-50 hover:bg-${theme.ACCENT}-800 border border-${theme.ACCENT}-600`,
  } as const;
};

export const CSS_CLASSES = {
  // History entry styles
  BILBO_ACTION: 'bg-emerald-100 border-l-4 border-emerald-500 pl-3 py-2 rounded-r',
  BILBO_STATE_TEXT: 'text-emerald-800 font-medium text-sm mb-2',
  BILBO_CONTENT: 'text-emerald-800',
  WORLD_RESPONSE: 'text-amber-800',
  SUMMARY_CONTAINER: 'bg-gray-100 border-l-4 border-gray-400 pl-3 py-2 rounded-r',
  SUMMARY_HEADER: 'text-gray-600 font-medium text-sm mb-2',
  SUMMARY_CONTENT: 'text-gray-700 text-sm',
  
  // Main layout styles
  LOADING_CONTAINER: 'max-w-4xl mx-auto p-6 bg-gradient-to-br from-green-50 via-yellow-50 to-orange-50 min-h-screen flex items-center justify-center',
  LOADING_TEXT: 'text-emerald-800 font-medium text-lg drop-shadow-sm',
  MAIN_CONTAINER: 'w-full p-6 bg-gradient-to-br from-green-50 via-yellow-50 to-orange-50 min-h-screen text-base',
  HEADER_CONTAINER: 'bg-gradient-to-r from-yellow-100 via-green-100 to-yellow-100 border-2 border-yellow-300 rounded-xl p-4 mb-4 shadow-lg',
  HEADER_ROW: 'flex justify-between items-center mb-3',
  GAME_TITLE: 'text-2xl md:text-2xl font-bold text-emerald-800 drop-shadow-sm',
} as const;

export const PROCESSING_DELAYS = {
  SCROLL_TIMEOUT: 100,
  FOCUS_TIMEOUT: 100,
  COMPRESSION_DELAY: 100,
  COMPRESSION_UI_DELAY: 500,
} as const;