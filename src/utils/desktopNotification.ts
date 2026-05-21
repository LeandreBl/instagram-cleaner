import { spawn } from 'node:child_process';
import process from 'node:process';

let desktopNotificationsEnabled = false;

export function configureDesktopNotifications(enabled: boolean): void {
  desktopNotificationsEnabled = enabled;
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

export function notifyUserPrompt(message: string): void {
  if (!desktopNotificationsEnabled) {
    return;
  }

  const title = 'instagram-cleaner needs input';
  const body = message.length > 180 ? `${message.slice(0, 177)}...` : message;

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
