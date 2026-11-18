import type { LogLevel } from './utils/logger.js';

export type CleanupMode = 'likes' | 'comments';

export type TranslationValue = string | string[];

export type TranslationDictionary = Record<string, TranslationValue>;

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface NumberRange {
  min: number;
  max: number;
}

export interface CliOptions {
  modes: CleanupMode[];
  range: DateRange;
  batchSize: NumberRange;
  clickDelay: NumberRange;
  batchDelay: NumberRange;
  limit?: number;
  profileDir?: string;
  profileName?: string;
  chromeExecutablePath?: string;
  useSystemProfile: boolean;
  loginTimeout: number;
  translationsPath?: string;
  notifyPrompts: boolean;
  notifyDone: boolean;
  dryRun: boolean;
  noSandbox: boolean;
  logLevel: LogLevel;
  recoverOnError: boolean;
}

export interface TargetConfiguration {
  mode: CleanupMode;
  url: string;
  selectLabels: string[];
  actionLabels: string[];
  confirmLabels: string[];
}

export interface CleanupOptions {
  batchSize: NumberRange;
  clickDelay: NumberRange;
  batchDelay: NumberRange;
  limit?: number;
  dryRun: boolean;
}
