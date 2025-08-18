export interface Location {
  region: string;
  settlement: string;
  place: string;
}

export interface Time {
  day: number;
  month: string;
  year: number;
  era: string;
  timeOfDay: string;
  season: string;
}

export interface GameMemory {
  historySummary?: string | null;
}

export interface HistoryEntry {
  text: string;
  bilboState: string | null;
  type: string;
  keyEvent?: string;
}

export interface GameState {
  location: Location;
  character: string;
  health: number;
  state: string;
  will: string;
  environment: string;
  time: Time;
  history: HistoryEntry[];
  memory: GameMemory;
  lastSummaryLength?: number;
}

export interface NarratorResponse {
  narration: string;
  usage: { total: number };
  historySummary?: string;
  gameState: GameState;
}

export interface GameConfig {
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
