import type { CleanupMode, TargetConfiguration, TranslationDictionary } from '../types.js';
import { getTranslationValues } from '../translations/loadTranslations.js';
import { uniqueStrings } from '../utils/text.js';

const activityUrls: Record<CleanupMode, string> = {
  likes: 'https://www.instagram.com/your_activity/interactions/likes/',
  comments: 'https://www.instagram.com/your_activity/interactions/comments/',
};

export function buildTarget(
  mode: CleanupMode,
  translations: TranslationDictionary,
): TargetConfiguration {
  const actionKeys = mode === 'likes' ? ['unlike'] : ['delete'];
  const confirmKeys = mode === 'likes' ? ['unlike', 'remove', 'confirm'] : ['delete', 'confirm'];

  return {
    mode,
    url: activityUrls[mode],
    selectLabels: uniqueStrings(getTranslationValues(translations, ['select'])),
    actionLabels: uniqueStrings(getTranslationValues(translations, actionKeys)),
    confirmLabels: uniqueStrings(getTranslationValues(translations, confirmKeys)),
  };
}
