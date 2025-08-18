import type { GameState } from './storage';
import type { GenerateResponseData } from '../services/gameApi';

export const createHistoryEntries = (
  formattedAction: string,
  narratorResponse: GenerateResponseData,
  bilboState: string
) => {
  const bilboActionEntry = {
    text: formattedAction,
    bilboState: bilboState,
    type: 'bilbo-action' as const
  };

  const worldResponseEntry = {
    text: narratorResponse.narration,
    bilboState: null,
    type: 'world-response' as const,
    keyEvent: narratorResponse.keyEvent || null
  };

  return { bilboActionEntry, worldResponseEntry };
};

export const updateGameStateWithResponse = (
  previousState: GameState,
  narratorResponse: GenerateResponseData,
  finalHistory: any[]
): GameState => {
  return {
    ...previousState,
    location: narratorResponse.gameState.location || previousState.location,
    health: narratorResponse.gameState.health !== undefined 
      ? narratorResponse.gameState.health 
      : previousState.health,
    state: narratorResponse.gameState.state || previousState.state,
    will: narratorResponse.gameState.will || previousState.will,
    environment: narratorResponse.gameState.environment || previousState.environment,
    time: narratorResponse.gameState.time || previousState.time,
    lastSummaryLength: narratorResponse.gameState.lastSummaryLength !== undefined 
      ? narratorResponse.gameState.lastSummaryLength 
      : previousState.lastSummaryLength,
    memory: {
      historySummary: narratorResponse.gameState.memory?.historySummary || previousState.memory.historySummary
    },
    history: finalHistory
  };
};