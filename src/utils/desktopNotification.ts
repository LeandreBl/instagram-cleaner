import { spawn } from 'node:child_process';
import process from 'node:process';

let promptNotificationsEnabled = false;
let doneNotificationsEnabled = false;

export function configureDesktopNotifications(options: { prompts: boolean; done: boolean }): void {
  promptNotificationsEnabled = options.prompts;
  doneNotificationsEnabled = options.done;
}

function runDetached(command: string, args: string[]): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.on('error', () => {
    // Desktop notifications are best-effort. Missing system tools should not block the prompt.
  });
  child.unref();
}

function escapeAppleScriptText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function truncate(value: string): string {
  return value.length > 180 ? `${value.slice(0, 177)}...` : value;
}

function notifyDesktop(title: string, message: string): void {
  const body = truncate(message);

  if (process.platform === 'linux') {
    runDetached('notify-send', [title, body]);
    return;
  }

  if (process.platform === 'darwin') {
    runDetached('osascript', [
      '-e',
      `display notification "${escapeAppleScriptText(body)}" with title "${escapeAppleScriptText(title)}"`,
    ]);
    return;
  }

  if (process.platform === 'win32') {
    runDetached('powershell.exe', [
      '-NoProfile',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.BalloonTipTitle = '${title.replace(/'/g, "''")}'; $n.BalloonTipText = '${body.replace(/'/g, "''")}'; $n.Visible = $true; $n.ShowBalloonTip(5000); Start-Sleep -Seconds 6; $n.Dispose();`,
    ]);
  }
}

export function notifyUserPrompt(message: string): void {
  if (!promptNotificationsEnabled) {
    return;
  }

  notifyDesktop('instagram-cleaner needs input', message);
}

export function notifyCleanupDone(message: string): void {
  if (!doneNotificationsEnabled) {
    return;
  }

  notifyDesktop('instagram-cleaner', message);
}
