import React from 'react';
import { useTranslation } from 'react-i18next';
import type { HistoryEntry as HistoryEntryType } from '../../types';
import { formatTextWithBreaks } from '../../utils/textProcessing';
import { useTheme } from '../../hooks/useTheme';

interface HistoryEntryProps {
  entry: HistoryEntryType;
  index: number;
}

export const HistoryEntry: React.FC<HistoryEntryProps> = ({ entry }) => {
  const { t } = useTranslation(['common', 'state']);
  const { themeClasses } = useTheme();
  
  const text = entry.text;
  const bilboState = entry.bilboState;
  const type = entry.type;

  if (type === 'bilbo-action') {
    return (
      <div className={themeClasses.BILBO_ACTION}>
        <div className={themeClasses.BILBO_STATE_TEXT}>
          {t('bilboStates.action', { state: bilboState })}
        </div>
        <div
          className={themeClasses.BILBO_CONTENT}
          dangerouslySetInnerHTML={{
            __html: formatTextWithBreaks(text)
          }}
        />
      </div>
    );
  }

  if (type === 'world-response') {
    return (
      <div>
        <div
          className={themeClasses.WORLD_RESPONSE}
          dangerouslySetInnerHTML={{
            __html: formatTextWithBreaks(text)
          }}
        />
        {entry.keyEvent && (
          <div className="mt-2 text-gray-600 text-sm italic">
            ⚡ {entry.keyEvent}
          </div>
        )}
      </div>
    );
  }

  if (type === 'summary') {
    return (
      <div className={themeClasses.SUMMARY_CONTAINER}>
        <div className={themeClasses.SUMMARY_HEADER}>
          {t('bilboStates.summary')}
        </div>
        <div
          className={themeClasses.SUMMARY_CONTENT}
          dangerouslySetInnerHTML={{
            __html: formatTextWithBreaks(text)
          }}
        />
      </div>
    );
  }

  // For old entries without type - use the old splitting logic
  const parts = text.split('\n\n');

  if (parts.length >= 2) {
    const bilboAction = parts[0];
    const worldReaction = parts.slice(1).join('\n\n');

    return (
      <div className="space-y-3">
        <div className={themeClasses.BILBO_ACTION}>
          <div className={themeClasses.BILBO_STATE_TEXT}>
            {t('bilboStates.action', { state: bilboState }).replace('🎭 ', '🎭 ')}
          </div>
          <div
            className={themeClasses.BILBO_CONTENT}
            dangerouslySetInnerHTML={{
              __html: formatTextWithBreaks(bilboAction)
            }}
          />
        </div>
        <div
          className={themeClasses.WORLD_RESPONSE}
          dangerouslySetInnerHTML={{
            __html: formatTextWithBreaks(worldReaction)
          }}
        />
      </div>
    );
  } else {
    // If there's no split (e.g., initial entry)
    return (
      <div
        className={themeClasses.WORLD_RESPONSE}
        dangerouslySetInnerHTML={{
          __html: formatTextWithBreaks(text)
        }}
      />
    );
  }
};