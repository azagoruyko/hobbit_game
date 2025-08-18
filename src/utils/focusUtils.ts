import { PROCESSING_DELAYS } from '../constants';

export const focusElement = (elementRef: React.RefObject<HTMLInputElement>): void => {
  setTimeout(() => {
    if (elementRef.current) {
      elementRef.current.focus();
    }
  }, PROCESSING_DELAYS.FOCUS_TIMEOUT);
};