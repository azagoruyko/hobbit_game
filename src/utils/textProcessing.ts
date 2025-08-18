export const formatTextWithBreaks = (text: string): string => {
  return text.replace(/\n/g, '<br/>').replace(/—/g, '—&nbsp;');
};