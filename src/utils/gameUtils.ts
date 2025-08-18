import type { GameState } from './storage';
import { GAME_CONFIG } from '../constants';
import type { TFunction } from 'i18next';

export const createInitialGameState = (t: TFunction): GameState => {
  return {
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
};

export const validateGameState = (gameState: any): gameState is GameState => {
  return (
    gameState &&
    typeof gameState === 'object' &&
    gameState.location &&
    gameState.character &&
    typeof gameState.health === 'number' &&
    gameState.state &&
    gameState.will &&
    gameState.environment &&
    gameState.time &&
    Array.isArray(gameState.history) &&
    gameState.memory
  );
};

export const getHealthColor = (health: number): string => {
  if (health > 75) return 'text-green-600';
  if (health > 50) return 'text-yellow-600';
  if (health > 25) return 'text-orange-600';
  return 'text-red-600';
};