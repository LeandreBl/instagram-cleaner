import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer';

export interface BrowserSessionOptions {
  rootDir: string;
  profileDir?: string;
  profileName?: string;
  chromeExecutablePath?: string;
  useSystemProfile: boolean;
  noSandbox: boolean;
}

export interface BrowserSession {
  browser: Browser;
  page: Page;
  userDataDir: string;
  profileDirectory?: string;
}

interface ChromeProfileLocation {
  userDataDir: string;
  filesystemUserDataDir: string;
  profileDirectory?: string;
}

interface WindowsDrivePath {
  driveLetter: string;
  drivePath: string;
}

interface WslMountPath {
  driveLetter: string;
  mountPath: string;
}

function createChromeProfileLocation(
  userDataDir: string,
  profileDirectory?: string,
  filesystemUserDataDir = normalizePathForCurrentPlatform(userDataDir),
): ChromeProfileLocation {
  return profileDirectory === undefined
    ? { userDataDir, filesystemUserDataDir }
    : { userDataDir, filesystemUserDataDir, profileDirectory };
}

function expandHome(directory: string): string {
  if (directory === '~') {
    return os.homedir();
  }

  if (directory.startsWith('~/')) {
    return path.join(os.homedir(), directory.slice(2));
  }

  return directory;
}

function parseWindowsDrivePath(candidate: string): WindowsDrivePath | null {
  const match = /^([a-zA-Z]):[\\/](.*)$/.exec(candidate);
  if (!match) {
    return null;
  }

  const [, driveLetter, drivePath] = match;
  if (!driveLetter || drivePath === undefined) {
    return null;
  }

  return { driveLetter, drivePath };
}

function toWslMountPath(windowsPath: WindowsDrivePath): string {
  return `/mnt/${windowsPath.driveLetter.toLowerCase()}/${windowsPath.drivePath.replaceAll('\\', '/')}`;
}

function windowsDrivePathToWslMountPath(candidate: string): string | null {
  const windowsPath = parseWindowsDrivePath(candidate);
  return windowsPath ? toWslMountPath(windowsPath) : null;
}

function parseWslMountPath(candidate: string): WslMountPath | null {
  const match = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(candidate);
  if (!match) {
    return null;
  }

  const [, driveLetter, mountPath] = match;
  if (!driveLetter || mountPath === undefined) {
    return null;
  }

  return { driveLetter, mountPath };
}

function toWindowsDrivePath(wslPath: WslMountPath): string {
  return path.win32.normalize(
    `${wslPath.driveLetter.toUpperCase()}:\\${wslPath.mountPath.replaceAll('/', '\\')}`,
  );
}

function unescapePosixShellPath(candidate: string): string {
  return candidate.replaceAll(/\\([\s()[\]{}'"$&;|<>?*\\])/g, '$1');
}

function normalizePathForCurrentPlatform(inputPath: string): string {
  const expandedPath = unescapePosixShellPath(expandHome(inputPath.trim()));
  const windowsPath = parseWindowsDrivePath(expandedPath);
  const wslPath = parseWslMountPath(expandedPath);

  if (windowsPath) {
    return process.platform === 'win32'
      ? path.win32.normalize(expandedPath)
      : toWslMountPath(windowsPath);
  }

  if (wslPath && process.platform === 'win32') {
    return toWindowsDrivePath(wslPath);
  }

  return path.isAbsolute(expandedPath) ? expandedPath : path.resolve(expandedPath);
}

function hasPathSeparator(value: string): boolean {
  return /[\\/]/.test(value);
}

function existingEnvPath(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? normalizePathForCurrentPlatform(value) : undefined;
}

function readWindowsEnvironmentPath(name: string): string | undefined {
  if (process.platform === 'win32') {
    return undefined;
  }

  try {
    const value = execFileSync('cmd.exe', ['/c', 'echo', `%${name}%`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .replaceAll('\r', '');

    if (!value || value === `%${name}%`) {
      return undefined;
    }

    return value;
  } catch {
    return undefined;
  }
}

function fromWindowsEnvironmentPath(name: string, ...segments: string[]): string | undefined {
  const directory = readWindowsEnvironmentPath(name);
  return directory ? path.win32.join(directory, ...segments) : undefined;
}

function getWslFilesystemPathForWindowsPath(windowsPath: string): string | undefined {
  return windowsDrivePathToWslMountPath(windowsPath) ?? undefined;
}

function fromEnvPath(name: string, ...segments: string[]): string | undefined {
  const directory = existingEnvPath(name);
  return directory ? path.join(directory, ...segments) : undefined;
}

function findSystemUserDataDir(): string | undefined {
  const systemProfileCandidates = [
    path.join(os.homedir(), '.config/google-chrome'),
    path.join(os.homedir(), '.config/chromium'),
    fromEnvPath('LOCALAPPDATA', 'Google', 'Chrome', 'User Data'),
    fromEnvPath('LOCALAPPDATA', 'Chromium', 'User Data'),
  ];

  return systemProfileCandidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function findWindowsLocalAppDataDir(): string | undefined {
  const localAppData = fromEnvPath('LOCALAPPDATA');
  if (localAppData && fs.existsSync(localAppData)) {
    const wslPath = parseWslMountPath(localAppData);
    return wslPath ? toWindowsDrivePath(wslPath) : localAppData;
  }

  const windowsLocalAppData = fromWindowsEnvironmentPath('LOCALAPPDATA');
  const windowsLocalAppDataFilesystemPath = windowsLocalAppData
    ? getWslFilesystemPathForWindowsPath(windowsLocalAppData)
    : undefined;

  if (windowsLocalAppDataFilesystemPath && fs.existsSync(windowsLocalAppDataFilesystemPath)) {
    return windowsLocalAppData;
  }

  return undefined;
}

function isWslWindowsExecutable(executablePath: string | undefined): boolean {
  return Boolean(
    executablePath &&
    process.platform !== 'win32' &&
    /^\/mnt\/[a-z]\//i.test(executablePath) &&
    executablePath.toLowerCase().endsWith('.exe'),
  );
}

function getDefaultProfileLocation(
  rootDir: string,
  executablePath: string | undefined,
  profileName: string | undefined,
): ChromeProfileLocation {
  const localAppData = findWindowsLocalAppDataDir();

  if (isWslWindowsExecutable(executablePath) && localAppData) {
    const userDataDir = path.win32.join(localAppData, 'instagram-cleaner', 'chrome-profile');
    const filesystemUserDataDir = getWslFilesystemPathForWindowsPath(userDataDir);

    if (filesystemUserDataDir) {
      return createChromeProfileLocation(userDataDir, profileName, filesystemUserDataDir);
    }
  }

  return createChromeProfileLocation(path.join(rootDir, '.chrome-profile'), profileName);
}

function isRelativeProfileDir(profileDir: string): boolean {
  const directory = unescapePosixShellPath(expandHome(profileDir.trim()));
  return (
    !path.isAbsolute(directory) &&
    !parseWindowsDrivePath(directory) &&
    !parseWslMountPath(directory)
  );
}

function getWslWindowsRelativeProfileLocation(
  profileDir: string,
  executablePath: string | undefined,
  profileName: string | undefined,
): ChromeProfileLocation | null {
  if (!isWslWindowsExecutable(executablePath) || !isRelativeProfileDir(profileDir)) {
    return null;
  }

  const localAppData = findWindowsLocalAppDataDir();
  if (!localAppData) {
    return null;
  }

  const relativeDirectory = path.win32.normalize(
    unescapePosixShellPath(profileDir.trim()).replaceAll('/', '\\'),
  );

  if (relativeDirectory === '.' || relativeDirectory.startsWith('..')) {
    throw new Error(
      '--profile-dir must point to a profile directory name when using Windows Chrome from WSL2.',
    );
  }

  const userDataDir = path.win32.join(localAppData, 'instagram-cleaner', relativeDirectory);
  const filesystemUserDataDir = getWslFilesystemPathForWindowsPath(userDataDir);

  if (!filesystemUserDataDir) {
    return null;
  }

  return createChromeProfileLocation(userDataDir, profileName, filesystemUserDataDir);
}

function isChromeProfileDirectoryName(profileName: string): boolean {
  return (
    profileName === 'Default' ||
    profileName === 'Guest Profile' ||
    profileName === 'System Profile' ||
    /^Profile \d+$/.test(profileName)
  );
}

function isChromeProfileSubdirectory(directory: string): boolean {
  const profileName = path.basename(directory);
  const parentDirectory = path.dirname(directory);

  return (
    isChromeProfileDirectoryName(profileName) &&
    fs.existsSync(path.join(parentDirectory, 'Local State'))
  );
}

function resolveChromeProfileLocation(
  rootDir: string,
  profileDir: string | undefined,
  profileName: string | undefined,
  useSystemProfile: boolean,
  executablePath: string | undefined,
): ChromeProfileLocation {
  if (profileDir) {
    const systemUserDataDir = findSystemUserDataDir();
    if (
      !hasPathSeparator(profileDir) &&
      isChromeProfileDirectoryName(profileDir) &&
      systemUserDataDir
    ) {
      return createChromeProfileLocation(systemUserDataDir, profileDir);
    }

    const wslWindowsProfileLocation = getWslWindowsRelativeProfileLocation(
      profileDir,
      executablePath,
      profileName,
    );

    if (wslWindowsProfileLocation) {
      return wslWindowsProfileLocation;
    }

    const resolvedProfileDir = normalizePathForCurrentPlatform(profileDir);

    if (isChromeProfileSubdirectory(resolvedProfileDir)) {
      return createChromeProfileLocation(
        path.dirname(resolvedProfileDir),
        path.basename(resolvedProfileDir),
      );
    }

    return createChromeProfileLocation(resolvedProfileDir, profileName);
  }

  if (useSystemProfile) {
    const systemUserDataDir = findSystemUserDataDir();
    return systemUserDataDir
      ? createChromeProfileLocation(systemUserDataDir, profileName)
      : getDefaultProfileLocation(rootDir, executablePath, profileName);
  }

  return getDefaultProfileLocation(rootDir, executablePath, profileName);
}

function findSystemChromeExecutable(): string | undefined {
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    fromEnvPath('LOCALAPPDATA', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    fromEnvPath('PROGRAMFILES', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    fromEnvPath('PROGRAMFILES(X86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].find((candidate) => candidate && fs.existsSync(candidate));
}

function resolveChromeExecutablePath(chromeExecutablePath?: string): string | undefined {
  if (!chromeExecutablePath) {
    return findSystemChromeExecutable();
  }

  const resolvedPath = normalizePathForCurrentPlatform(chromeExecutablePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Chrome executable was not found: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function launchBrowser(options: BrowserSessionOptions): Promise<BrowserSession> {
  const executablePath = resolveChromeExecutablePath(options.chromeExecutablePath);
  const { filesystemUserDataDir, profileDirectory, userDataDir } = resolveChromeProfileLocation(
    options.rootDir,
    options.profileDir,
    options.profileName,
    options.useSystemProfile,
    executablePath,
  );
  fs.mkdirSync(filesystemUserDataDir, { recursive: true });

  const browser = await puppeteer
    .launch({
      headless: false,
      defaultViewport: null,
      ...(executablePath ? { executablePath } : {}),
      userDataDir,
      args: [
        '--start-maximized',
        '--disable-dev-shm-usage',
        '--lang=en-US,fr-FR',
        ...(profileDirectory ? [`--profile-directory=${profileDirectory}`] : []),
        ...(options.noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      ],
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);

      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('singleton') || lowerMessage.includes('ws endpoint')) {
        throw new Error(
          `Chrome could not be controlled with profile: ${userDataDir}. This usually happens when the system Chrome profile is already open and Chrome redirects Puppeteer to the existing browser session. Close every Chrome window using this profile, or run with --profile-dir .chrome-profile.`,
        );
      }

      throw error;
    });

  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  page.setDefaultTimeout(30_000);

  return profileDirectory === undefined
    ? { browser, page, userDataDir }
    : { browser, page, userDataDir, profileDirectory };
}
