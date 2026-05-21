import fs from 'node:fs';
import path from 'node:path';
import type { TranslationDictionary, TranslationValue } from '../types.js';
import { defaultTranslations } from './defaultTranslations.js';

function asStringArray(value: TranslationValue | undefined, key: string): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value;
  }

  throw new Error(
    `Invalid translation value for "${key}". Expected a string or an array of strings.`,
  );
}

function readTranslationFile(filePath: string): TranslationDictionary {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The translation file must be a JSON object.');
  }

  for (const [key, value] of Object.entries(parsed)) {
    asStringArray(value as TranslationValue, key);
  }

  return parsed as TranslationDictionary;
}

export function getTranslationValues(dictionary: TranslationDictionary, keys: string[]): string[] {
  return keys.flatMap((key) => asStringArray(dictionary[key], key));
}

export function loadTranslations(filePath?: string): TranslationDictionary {
  if (!filePath) {
    return { ...defaultTranslations };
  }

  return {
    ...defaultTranslations,
    ...readTranslationFile(filePath),
  };
}
