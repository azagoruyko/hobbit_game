import type { HistoryEntry } from '../types';
import { STORAGE_KEYS, GAME_CONFIG } from '../constants';

export interface GameState {
  location: { region: string; settlement: string; place: string };
  character: string;
  health: number;
  state: string;
  will: string;
  environment: string;
  time: { day: number | string; month: string; year: number | string; era: string; timeOfDay: string; season: string };
  history: HistoryEntry[];
  memory: any;
  lastSummaryLength?: number;
}

export interface SaveData {
  gameState: GameState;
  timestamp: string;
  version: string;
}

export const saveGameToFile = (gameState: GameState, t: (key: string) => string): void => {
  const saveData: SaveData = {
    gameState,
    timestamp: new Date().toLocaleString('ru-RU'),
    version: GAME_CONFIG.SAVE_VERSION
  };

  const saveString = JSON.stringify(saveData, null, 2);
  const blob = new Blob([saveString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tolkien-rpg-save-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(t('messages.gameSaved'));
};

export const loadGameFromFile = (
  file: File,
  t: (key: string, options?: any) => string,
  onSuccess: (gameState: GameState, timestamp: string) => void,
  onError: (errorKey: string) => void
): void => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const saveData = JSON.parse(e.target?.result as string) as SaveData;
      if (saveData.gameState && saveData.version === GAME_CONFIG.SAVE_VERSION) {
        onSuccess(saveData.gameState, saveData.timestamp);
      } else {
        onError('messages.invalidFile');
      }
    } catch (error) {
      onError('messages.loadError');
    }
  };
  reader.readAsText(file);
};

export const saveToLocalStorage = (gameState: GameState): void => {
  try {
    const saveData: SaveData = {
      gameState,
      timestamp: new Date().toISOString(),
      version: GAME_CONFIG.SAVE_VERSION
    };
    localStorage.setItem(STORAGE_KEYS.AUTOSAVE, JSON.stringify(saveData));
  } catch (error) {
    console.error('Autosave error:', error);
  }
};

export const loadFromLocalStorage = (): GameState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTOSAVE);
    if (saved) {
      const saveData = JSON.parse(saved) as SaveData;
      if (saveData.gameState && saveData.version === GAME_CONFIG.SAVE_VERSION) {
        return saveData.gameState;
      }
    }
  } catch (error) {
    console.error('Autosave loading error:', error);
  }
  return null;
};