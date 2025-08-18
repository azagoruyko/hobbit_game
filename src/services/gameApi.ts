import { API_ENDPOINTS } from '../constants';
import type { GameState } from '../utils/storage';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FormatActionResponse {
  formattedAction: string;
  usage?: {
    total: number;
  };
}

export interface GenerateResponseData {
  narration: string;
  gameState: GameState;
  keyEvent?: string;
  usage?: {
    total: number;
  };
}

export interface CompressionResponse {
  compressionNeeded: boolean;
  historySummary?: string;
  lastSummaryLength?: number;
  usage?: {
    total: number;
  };
}

const handleApiResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.message || 'API returned error');
  }
  
  return data;
};

export const gameApi = {
  async getConfig(): Promise<any> {
    const response = await fetch(API_ENDPOINTS.CONFIG);
    return handleApiResponse(response);
  },

  async formatAction(action: string, gameState: GameState, language: string): Promise<FormatActionResponse> {
    const response = await fetch(API_ENDPOINTS.FORMAT_ACTION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, gameState, language })
    });
    return handleApiResponse(response);
  },

  async generateResponse(gameState: GameState, formattedAction: string, language: string): Promise<GenerateResponseData> {
    const response = await fetch(API_ENDPOINTS.GENERATE_RESPONSE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameState, formattedAction, language })
    });
    return handleApiResponse(response);
  },

  async compressHistory(gameState: GameState, language: string): Promise<CompressionResponse> {
    const response = await fetch(API_ENDPOINTS.COMPRESS_HISTORY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameState, language })
    });
    return handleApiResponse(response);
  }
};