import { gameApi } from '../services/gameApi';
import { PROCESSING_DELAYS } from '../constants';
import type { GameState } from './storage';
import type { TokenUsage } from './tokenUsage';
import { updateTokenUsage } from './tokenUsage';

export interface HistoryCompressionResult {
  compressionNeeded: boolean;
  newGameState?: GameState;
  tokenUsageUpdate?: { total: number };
}

export const handleHistoryCompression = async (
  gameState: GameState,
  language: string,
  setProcessingStatus: (status: string) => void,
  setTokenUsage: (updater: (prev: TokenUsage) => TokenUsage) => void,
  setGameState: (updater: (currentState: GameState) => GameState) => void,
  t: (key: string) => string
): Promise<void> => {
  setTimeout(async () => {
    try {
      const compressionResult = await gameApi.compressHistory(gameState, language);
        
      if (compressionResult.compressionNeeded) {
        setProcessingStatus(t('status.compressing'));
        
        // Account for history summarization tokens
        if (compressionResult.usage) {
          setTokenUsage(prev => updateTokenUsage(prev, compressionResult.usage));
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
};