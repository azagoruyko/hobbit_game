export interface TokenUsage {
  total: number;
}

export const updateTokenUsage = (
  currentUsage: TokenUsage, 
  newTokens: { total: number } | undefined
): TokenUsage => {
  if (!newTokens) return currentUsage;
  
  return {
    total: currentUsage.total + newTokens.total
  };
};