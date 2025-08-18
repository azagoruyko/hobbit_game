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

export const CSS_CLASSES = {
  BILBO_ACTION: 'bg-emerald-100 border-l-4 border-emerald-500 pl-3 py-2 rounded-r',
  BILBO_STATE_TEXT: 'text-emerald-800 font-medium text-sm mb-2',
  BILBO_CONTENT: 'text-emerald-800',
  WORLD_RESPONSE: 'text-amber-800',
  SUMMARY_CONTAINER: 'bg-gray-100 border-l-4 border-gray-400 pl-3 py-2 rounded-r',
  SUMMARY_HEADER: 'text-gray-600 font-medium text-sm mb-2',
  SUMMARY_CONTENT: 'text-gray-700 text-sm',
} as const;

export const PROCESSING_DELAYS = {
  SCROLL_TIMEOUT: 100,
  FOCUS_TIMEOUT: 100,
  COMPRESSION_DELAY: 100,
  COMPRESSION_UI_DELAY: 500,
} as const;