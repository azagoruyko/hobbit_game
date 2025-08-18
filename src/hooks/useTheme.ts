import { useState, useCallback } from 'react';
import { ThemeName, DEFAULT_THEME, getThemeClasses } from '../constants';

export const useTheme = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(DEFAULT_THEME);

  const changeTheme = useCallback((theme: ThemeName) => {
    setCurrentTheme(theme);
    localStorage.setItem('hobbit-game-theme', theme);
  }, []);

  const themeClasses = getThemeClasses(currentTheme);

  return {
    currentTheme,
    changeTheme,
    themeClasses,
  };
};