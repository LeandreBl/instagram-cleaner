import path from 'node:path';
import process from 'node:process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CleanupMode, CliOptions } from '../types.js';
import { isLogLevel, logLevels, type LogLevel } from '../utils/logger.js';
import { parseRange } from '../utils/time.js';

interface RawArguments {
  likes?: boolean;
  comments?: boolean;
  range?: string;
  from?: string;
  to?: string;
  batchSize: number;
  clickDelay: string;
  limit?: number;
  profileDir?: string;
  profileName?: string;
  chromeExecutable?: string;
  useSystemProfile: boolean;
  loginTimeout: number;
  translations?: string;
  notifyPrompts: boolean;
  dryRun: boolean;
  noSandbox: boolean;
  logLevel: LogLevel;
  recoverOnError: boolean;
}

const defaultTranslationsArgument = './translations/en.json';

function resolveTranslationsPath(rootDirectory: string, translationsArgument: string): string {
  if (translationsArgument === defaultTranslationsArgument) {
    return path.join(rootDirectory, 'translations/en.json');
  }

  return path.resolve(translationsArgument);
}

function parseClickDelay(value: string): { min: number; max: number } {
  const parts = value.split(':');
  if (parts.length > 2 || parts.some((part) => part.trim() === '')) {
    throw new Error('--click-delay must use min:max milliseconds, for example 80:240.');
  }

  const [minValue, maxValue] = parts;
  const min = Number(minValue);
  const max = Number(maxValue ?? minValue);

  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error('--click-delay must use integer milliseconds, for example 80:240.');
  }

  if (min < 0 || max < 0) {
    throw new Error('--click-delay values must be non-negative millisecond values.');
  }

  if (min > max) {
    throw new Error('--click-delay min must be lower than or equal to max.');
  }

  if (max > 60_000) {
    throw new Error('--click-delay max must be lower than or equal to 60000 milliseconds.');
  }

  return { min, max };
}

function buildModes(argv: Pick<RawArguments, 'likes' | 'comments'>): CleanupMode[] {
  return [
    ...(argv.likes ? (['likes'] as const) : []),
    ...(argv.comments ? (['comments'] as const) : []),
  ];
}

function buildCliOptions(rootDirectory: string, argv: RawArguments): CliOptions {
  const options: CliOptions = {
    modes: buildModes(argv),
    range: parseRange(argv.range, argv.from, argv.to),
    batchSize: argv.batchSize,
    clickDelay: parseClickDelay(argv.clickDelay),
    useSystemProfile: argv.useSystemProfile,
    loginTimeout: argv.loginTimeout,
    translationsPath: resolveTranslationsPath(
      rootDirectory,
      argv.translations ?? defaultTranslationsArgument,
    ),
    notifyPrompts: argv.notifyPrompts,
    dryRun: argv.dryRun,
    noSandbox: argv.noSandbox,
    logLevel: argv.logLevel,
    recoverOnError: argv.recoverOnError,
  };

  if (argv.limit !== undefined) {
    options.limit = argv.limit;
  }
  if (argv.profileDir !== undefined) {
    options.profileDir = argv.profileDir;
  }
  if (argv.profileName !== undefined) {
    options.profileName = argv.profileName;
  }
  if (argv.chromeExecutable !== undefined) {
    options.chromeExecutablePath = argv.chromeExecutable;
  }

  return options;
}

export function parseCliOptions(rootDirectory: string): CliOptions {
  const argv = yargs(hideBin(process.argv))
    .scriptName('instagram-cleaner')
    .usage('$0 (--likes|--comments) [options]')
    .option('likes', {
      type: 'boolean',
      describe: 'Clean the likes history.',
    })
    .option('comments', {
      type: 'boolean',
      describe: 'Clean the comments history.',
    })
    .option('range', {
      type: 'string',
      describe:
        'Optional min:max interval. Accepts ISO dates, second timestamps, or millisecond timestamps.',
    })
    .option('from', {
      type: 'string',
      describe: 'Optional minimum date.',
    })
    .option('to', {
      type: 'string',
      describe: 'Optional maximum date.',
    })
    .option('batch-size', {
      type: 'number',
      default: 20,
      describe: 'Maximum number of items selected per batch.',
    })
    .option('click-delay', {
      type: 'string',
      default: '150:150',
      describe:
        'Min:max milliseconds to wait between each like/comment checkbox click. A random value is used for every click.',
    })
    .option('limit', {
      type: 'number',
      describe: 'Maximum number of items to process during this run.',
    })
    .option('profile-dir', {
      type: 'string',
      describe: 'Chrome profile directory. Defaults to the shared project profile .chrome-profile.',
    })
    .option('profile-name', {
      type: 'string',
      describe:
        'Chrome profile directory name inside a user data directory, for example Default or Profile 1.',
    })
    .option('chrome-executable', {
      type: 'string',
      describe:
        'Path to the Chrome executable. Useful from WSL2, for example /mnt/c/Program Files/Google/Chrome/Application/chrome.exe.',
    })
    .option('use-system-profile', {
      type: 'boolean',
      default: false,
      describe:
        'Use the user Chrome profile when available. Chrome must be fully closed for Puppeteer to control it.',
    })
    .option('login-timeout', {
      type: 'number',
      default: 600_000,
      describe: 'Maximum time in milliseconds to wait for manual login detection.',
    })
    .option('translations', {
      type: 'string',
      default: defaultTranslationsArgument,
      describe: 'Path to a JSON translation file. Values can be strings or arrays of strings.',
    })
    .option('notify-prompts', {
      type: 'boolean',
      default: false,
      describe: 'Send a desktop notification whenever the script needs terminal input.',
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Select one batch without confirming the cleanup action.',
    })
    .option('no-sandbox', {
      type: 'boolean',
      default: false,
      describe: 'Add --no-sandbox to Chrome.',
    })
    .option('log-level', {
      type: 'string',
      choices: [...logLevels],
      default: 'info',
      describe: 'Minimum log level to print: silent, error, warn, info, or debug.',
    })
    .option('recover-on-error', {
      type: 'boolean',
      default: true,
      describe:
        'Recover from cleanup errors by refreshing the activity page and retrying. Use --no-recover-on-error to stop on the first unrecovered error.',
    })
    .strict()
    .check((args) => {
      if (!args.likes && !args.comments) {
        throw new Error('Use one flag: --likes or --comments.');
      }

      if (args.likes && args.comments) {
        throw new Error(
          'Use only one cleanup flag per run. Start the program twice if you want to process likes and comments.',
        );
      }

      const batchSize = Number(args['batchSize']);
      if (batchSize < 1 || batchSize > 100) {
        throw new Error('--batch-size must be between 1 and 100.');
      }

      if (args.limit !== undefined && args.limit < 1) {
        throw new Error('--limit must be greater than 0.');
      }

      if (
        args['chromeExecutable'] !== undefined &&
        String(args['chromeExecutable']).trim() === ''
      ) {
        throw new Error('--chrome-executable must not be empty.');
      }

      if (Number(args['loginTimeout']) < 10_000) {
        throw new Error('--login-timeout must be at least 10000 milliseconds.');
      }

      if (!isLogLevel(String(args['logLevel']))) {
        throw new Error('--log-level must be one of: silent, error, warn, info, debug.');
      }

      parseClickDelay(String(args['clickDelay']));

      return true;
    })
    .parseSync() as RawArguments;

  return buildCliOptions(rootDirectory, argv);
}
