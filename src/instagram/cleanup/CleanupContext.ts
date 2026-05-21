import type { Page } from 'puppeteer';
import type { CleanupOptions, TargetConfiguration, TranslationDictionary } from '../../types.js';
import { controlTranslationKeys } from '../../translations/defaultTranslations.js';
import { getTranslationValues } from '../../translations/loadTranslations.js';
import { logger } from '../../utils/logger.js';
import { normalizeText } from '../../utils/text.js';
import type { CleanupToastResult, InstagramMutationResult, SelectionResult } from './types.js';

const throttleCooldownStepMs = 60_000;
const maxThrottleCooldownMs = 600_000;

export class CleanupContext {
  public totalProcessed = 0;
  public emptyPasses = 0;
  public currentSelection: SelectionResult = {
    count: 0,
    confirmedCount: null,
    attemptedCount: 0,
    signatures: [],
  };
  public lastToast: CleanupToastResult | null = null;
  public lastMutation: InstagramMutationResult | null = null;
  private throttleCooldownMs = 0;
  private pendingThrottleCooldownWaitMs = 0;

  public constructor(
    public readonly page: Page,
    public readonly target: TargetConfiguration,
    public readonly translations: TranslationDictionary,
    public readonly options: CleanupOptions,
  ) {}

  public get controlText(): string[] {
    return getTranslationValues(this.translations, controlTranslationKeys).map(normalizeText);
  }

  public get batchSize(): number {
    const remaining = this.options.limit
      ? Math.max(0, this.options.limit - this.totalProcessed)
      : this.options.batchSize;

    return Math.min(this.options.batchSize, remaining || this.options.batchSize);
  }

  public get hasReachedLimit(): boolean {
    return Boolean(this.options.limit && this.totalProcessed >= this.options.limit);
  }

  public setSelection(selection: SelectionResult): void {
    this.currentSelection = selection;
  }

  public markEmptyPass(): void {
    this.emptyPasses += 1;
  }

  public resetEmptyPasses(): void {
    this.emptyPasses = 0;
  }

  public addProcessed(count: number): void {
    this.totalProcessed += count;
  }

  public get currentThrottleCooldownMs(): number {
    return this.throttleCooldownMs;
  }

  public consumeThrottleCooldownWait(): number {
    const cooldown = this.pendingThrottleCooldownWaitMs;
    this.pendingThrottleCooldownWaitMs = 0;

    return cooldown;
  }

  public increaseThrottleCooldown(): number {
    this.throttleCooldownMs = Math.min(
      maxThrottleCooldownMs,
      this.throttleCooldownMs + throttleCooldownStepMs,
    );
    this.pendingThrottleCooldownWaitMs = this.throttleCooldownMs;

    return this.throttleCooldownMs;
  }

  public reduceThrottleCooldownAfterSuccess(): number {
    this.throttleCooldownMs = Math.max(0, this.throttleCooldownMs - throttleCooldownStepMs);
    this.pendingThrottleCooldownWaitMs = Math.min(
      this.pendingThrottleCooldownWaitMs,
      this.throttleCooldownMs,
    );

    return this.throttleCooldownMs;
  }

  public debug(message: string): void {
    logger.debug(this.formatLogMessage(message));
  }

  public info(message: string): void {
    logger.info(this.formatLogMessage(message));
  }

  public warn(message: string): void {
    logger.warn(this.formatLogMessage(message));
  }

  private formatLogMessage(message: string): string {
    return `[${this.target.mode}] ${message}`;
  }
}
