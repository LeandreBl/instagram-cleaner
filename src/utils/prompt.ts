import process from 'node:process';
import readline from 'node:readline/promises';
import { notifyUserPrompt } from './desktopNotification.js';

let promptQueue = Promise.resolve();

export async function askYesNo(message: string, defaultValue = true): Promise<boolean> {
  return queuePrompt(async () => {
    notifyUserPrompt(message);
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? 'Y/n' : 'y/N';

    try {
      while (true) {
        const answer = (await prompt.question(`${message} (${suffix}) `)).trim().toLowerCase();

        if (!answer) {
          return defaultValue;
        }

        if (['y', 'yes', 'o', 'oui'].includes(answer)) {
          return true;
        }

        if (['n', 'no', 'non'].includes(answer)) {
          return false;
        }

        process.stdout.write('Please answer yes or no.\n');
      }
    } finally {
      prompt.close();
    }
  });
}

async function queuePrompt<T>(runPrompt: () => Promise<T>): Promise<T> {
  const previousPrompt = promptQueue;
  let releasePrompt!: () => void;
  promptQueue = new Promise<void>((resolve) => {
    releasePrompt = resolve;
  });

  await previousPrompt;

  try {
    return await runPrompt();
  } finally {
    releasePrompt();
  }
}
