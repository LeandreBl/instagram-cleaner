# instagram-cleaner

Clean your Instagram likes and comments history from the existing Instagram Web UI.

The program opens a real Chrome window with Puppeteer. The user logs in manually in the opened page; the code never handles credentials and detects automatically when the session becomes active.

## Install

```sh
npm install
npm run build
```

## Usage

Clean all likes:

```sh
npm run likes
```

Clean all comments:

```sh
npm run comments
```

Process both likes and comments by starting the program twice. The safest option is to run them one after the other:

```sh
npm run likes
npm run comments
```

If you want to run both at the same time, use two terminals and two separate Chrome profiles. This avoids Chrome profile locks and prevents two Puppeteer jobs from fighting over the same visible tab:

```sh
# Terminal 1
npm start -- --likes --profile-dir .chrome-profile-likes

# Terminal 2
npm start -- --comments --profile-dir .chrome-profile-comments
```

With the WSL2 Windows Chrome setup, keep your usual Chrome executable and translations flags on both commands. Relative `--profile-dir` values are stored under Windows `%LOCALAPPDATA%\instagram-cleaner`, not under the Linux `/home/...` path, when the selected Chrome executable is a Windows `.exe`:

```sh
npm start -- --likes --profile-dir .likes --chrome-executable '/mnt/c/Program\ Files/Google/Chrome/Application/chrome.exe' --translations translations/fr.json
npm start -- --comments --profile-dir .comments --chrome-executable '/mnt/c/Program\ Files/Google/Chrome/Application/chrome.exe' --translations translations/fr.json
```

## Chrome profile

On Windows, the script looks for Chrome in the usual `Program Files` and `%LOCALAPPDATA%` locations. You can also provide it explicitly:

```sh
node ./dist/cli.js --likes --chrome-executable "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Any Chromium-based browser works. Brave is detected automatically in the usual install locations when `--chrome-executable` is omitted, and `--use-system-profile` also finds the Brave profile. To reuse an existing Brave session explicitly, point the executable and profile at Brave and keep Brave fully closed while the script runs:

```sh
node ./dist/cli.js --likes --chrome-executable "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --profile-dir "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data"
```

If Chrome is not installed inside Linux, or if you want WSL2 to launch the Windows Chrome executable, provide either the WSL mount path or the Windows path:

```sh
node ./dist/cli.js --likes --chrome-executable "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
node ./dist/cli.js --likes --chrome-executable '/mnt/c/Program\ Files/Google/Chrome/Application/chrome.exe'
node ./dist/cli.js --likes --chrome-executable 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

Quoted paths can keep spaces as-is, and shell-escaped spaces such as `Program\ Files` are tolerated. Windows drive paths such as `C:\Program Files\...\chrome.exe` are converted to their WSL mount path automatically when the script runs from WSL2. If `--chrome-executable` is omitted, the script tries common Linux Chrome/Chromium paths, Windows Chrome paths from environment variables, then common Windows Chrome paths under `/mnt/c`.

When WSL2 launches Windows Chrome, the default shared automation profile is stored under Windows `%LOCALAPPDATA%\instagram-cleaner\chrome-profile`. If `%LOCALAPPDATA%` is not imported into WSL, the script asks Windows for it through `cmd.exe`. Windows Chrome cannot reliably use a Linux-only project path such as `/home/<user>/...` as its user data directory.

By default, the script uses the same shared project Chrome profile for every command:

- `.chrome-profile`

This avoids Chrome redirecting Puppeteer to an already-open browser session, which can cause launch timeouts such as `Timed out while waiting for the WS endpoint URL`.

You can override it explicitly:

```sh
node ./dist/cli.js --comments --profile-dir .chrome-profile
```

You can opt in to the user Chrome profile:

```sh
node ./dist/cli.js --likes --use-system-profile
node ./dist/cli.js --likes --profile-dir ~/.config/google-chrome
node ./dist/cli.js --likes --profile-dir ~/.config/google-chrome/Default
node ./dist/cli.js --likes --profile-dir "~/.config/google-chrome/Profile 1"
node ./dist/cli.js --likes --use-system-profile --profile-name "Profile 1"
node ./dist/cli.js --likes --profile-dir Default
```

`--profile-dir` accepts either a Chrome user data directory, such as `~/.config/google-chrome`, or a concrete Chrome profile subdirectory, such as `~/.config/google-chrome/Default` or `~/.config/google-chrome/Profile 1`. When a profile subdirectory is provided, the script launches Chrome with the parent user data directory and the matching `--profile-directory` argument. You can also pass only `Default` or `Profile 1`; when a system Chrome user data directory exists, the script resolves it automatically.

Use `--profile-name` when you want to provide the user data directory and Chrome's internal profile directory separately.

Chrome can lock or redirect a profile when it is already open. If that happens, close every Chrome window using that profile or use `--profile-dir .chrome-profile`.

If you start two cleaner processes at the same time, do not reuse the same profile directory. Use distinct values such as `--profile-dir .likes` and `--profile-dir .comments`. You may need to log in once in each profile.

After a successful run, Chrome stays open so you can verify the page state. If the Node process stops before completion, for example after `Ctrl+C`, `SIGTERM`, or an unrecoverable error, the script closes the Chrome instance it launched.

Login is automatic from the script point of view: if the profile already has an Instagram session, it continues immediately. If not, log in in the opened Chrome window and the script continues as soon as it detects the active session.

## Date range

Use `--range min:max`, `--from`, or `--to`. Values can be ISO dates, second timestamps, or millisecond timestamps.

```sh
node ./dist/cli.js --likes --range 2024-01-01:2024-12-31
node ./dist/cli.js --comments --from 2023-01-01
node ./dist/cli.js --likes --to 1704067200
```

If no date range is provided, the script tries to clean everything visible in the selected activity page.

## Translation files

Translation files live in [translations](translations). English is selected by default through `--translations ./translations/en.json`.

Available files:

- [translations/en.json](translations/en.json)
- [translations/fr.json](translations/fr.json)
- [translations/es.json](translations/es.json)

For another language, add a JSON file with `key => value` entries. A value can be a string or an array of strings (just in case).

```sh
node ./dist/cli.js --likes --translations ./translations/fr.json
```

Use [translations/en.json](translations/en.json) as a template for another language.

## Useful options

```sh
node ./dist/cli.js --likes --batch-size 90:99 --limit 50
node ./dist/cli.js --likes --click-delay 120:350 --confirm-delay 600:1800
node ./dist/cli.js --comments --dry-run
node ./dist/cli.js --likes --profile-dir .chrome-profile
node ./dist/cli.js --likes --use-system-profile
node ./dist/cli.js --likes --chrome-executable "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
node ./dist/cli.js --likes --login-timeout 900000
node ./dist/cli.js --comments --notify-prompts
node ./dist/cli.js --comments --notify-done
node ./dist/cli.js --comments --close-on-finish
node ./dist/cli.js --likes --toast-timeout 4000 --error-dialog-timeout 4000
node ./dist/cli.js --comments --no-sandbox
node ./dist/cli.js --likes --log-level debug
node ./dist/cli.js --comments --no-recover-on-error
```

`--notify-prompts` sends a desktop notification whenever the script needs input in the terminal, for example after an unexpected navigation confirmation.

`--notify-done` sends a desktop notification when the cleanup finishes. The text comes from the `doneNotification` translation, so it follows the selected language.

`--close-on-finish` closes the browser when the cleanup finishes instead of leaving it open for verification. This is useful when several runs are chained in one command or script.

`--toast-timeout` (default 12000 ms) and `--error-dialog-timeout` (default 30000 ms) control how long the script waits for Instagram's confirmation toast and, after that, for an error dialog. Lower values make long cleanups faster, at the cost of relying more on the network and visibility checks to detect throttling.

`--batch-size min:max` selects a random number of items per batch inside the range: never below 20 and never above 99, because Instagram caps a cleanup action at 100. A fixed value such as `--batch-size 99` disables the random count. The default is `90:99`, which keeps the number of confirmation round-trips low.

`--click-delay min:max` controls the wait between each like/comment checkbox click, in milliseconds. The script chooses a random value inside the range for every click, for example `--click-delay 120:350`. The default is `120:350`, which keeps the selection burst fast.

`--confirm-delay min:max` controls the wait between the cleanup action click (for example `Eliminar`) and its confirmation click. The script chooses a random value per batch; the default is `600:1800` ms, which keeps a human-like pause before confirming.

`--batch-delay min:max` controls the wait between batches, in milliseconds. The script chooses a random value inside the range after every processed batch, for example `--batch-delay 8000:25000`. The default is `8000:25000`.

If Instagram appears to throttle a cleanup batch, the script waits longer, refreshes the page, and checks whether the same likes/comments are still visible. When the same items reappear after refresh, or when Instagram opens an error dialog with an OK button after confirmation, it automatically backs off: 1 minute, then 2 minutes, then 3 minutes, up to 10 minutes, until batches start succeeding again.

`--log-level` controls terminal verbosity. The default is `info`; use `debug` to see detailed selection, scrolling, button lookup, and network verification logs. Available values are `silent`, `error`, `warn`, `info`, and `debug`.

`--recover-on-error` is enabled by default. When cleanup loses track of Instagram, the script refreshes the activity page and retries instead of stopping. Use `--no-recover-on-error` if you prefer the program to stop on the first unrecovered cleanup error.

## Notes

- Instagram changes its UI often, so the script uses visible text and accessibility labels, we do not know nor want to know the real Instagram private API.
- If a button or filter cannot be found automatically, the script fails clearly instead of asking for manual UI actions.
- Use small `--batch-size` values first if you want to verify the behavior safely.
