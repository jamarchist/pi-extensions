# playwright-cli

Focused pi tools that wrap the Playwright agent CLI through `npx playwright-cli`.

## Tools

- `playwright_open` — runs `npx playwright-cli -s=<sessionId> open <url>`.
  - Generates a unique `sessionId` like `pi-browser-m4abc123-1` when omitted.
  - Returns `sessionId` and `trackedSessionIds` so callers can target that browser later.
- `playwright_goto` — runs `npx playwright-cli -s=<sessionId> goto <url>`.
  - `sessionId` may be omitted only when exactly one session is tracked.
- `playwright_close` — runs `npx playwright-cli -s=<sessionId> close`.
  - `sessionId` may be omitted only when exactly one session is tracked.

## Assumptions and safety

- Requires Node.js and a local/global Playwright CLI installation that is usable via `npx playwright-cli`.
- Separate browser sessions use Playwright CLI's named session flag: `-s=<sessionId>`.
- The extension tracks ids it opened during the current pi extension runtime; Playwright CLI owns the actual browser process/session state.
- Tool output is truncated to 2000 lines or 50KB to keep agent context bounded.
- Use `playwright_close` with the `sessionId` returned by `playwright_open` to close a specific page/browser session when finished.
