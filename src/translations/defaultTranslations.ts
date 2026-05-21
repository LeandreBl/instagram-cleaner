import type { TranslationDictionary } from '../types.js';

export const defaultTranslations = {
  select: ['Select'],
  unlike: ['Unlike'],
  delete: ['Delete'],
  confirm: ['Confirm'],
  remove: ['Remove'],
  sort: ['Sort'],
  filter: ['Filter'],
  sortFilter: ['Sort & filter', 'Sort and filter'],
  apply: ['Apply'],
  done: ['Done'],
  cancel: ['Cancel'],
  likesCleanupToast: ['You unliked {{count}} post', 'You unliked {{count}} posts'],
  commentsCleanupToast: [
    'You deleted {{count}} comment',
    'You deleted {{count}} comments',
    'You removed {{count}} comment',
    'You removed {{count}} comments',
  ],
} satisfies TranslationDictionary;

export const controlTranslationKeys = [
  'select',
  'unlike',
  'delete',
  'confirm',
  'remove',
  'sort',
  'filter',
  'sortFilter',
  'apply',
  'done',
  'cancel',
] satisfies Array<keyof typeof defaultTranslations>;
