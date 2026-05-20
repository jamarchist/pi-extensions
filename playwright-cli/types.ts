import { Type, type Static } from "typebox";

export const DEFAULT_MAX_BYTES = 50 * 1024;
export const DEFAULT_MAX_LINES = 2000;

export const URL_PARAMS = Type.Object({
  url: Type.String({ minLength: 1, description: "URL to open or navigate to with playwright-cli." }),
  sessionId: Type.Optional(
    Type.String({
      minLength: 1,
      description:
        "Optional Playwright CLI session id. playwright_open generates one when omitted; playwright_goto uses this to target a specific browser session.",
    }),
  ),
});

export const CLOSE_PARAMS = Type.Object({
  sessionId: Type.Optional(
    Type.String({
      minLength: 1,
      description:
        "Playwright CLI session id returned by playwright_open. May be omitted only when exactly one session is tracked.",
    }),
  ),
});

export type UrlParams = Static<typeof URL_PARAMS>;
export type CloseParams = Static<typeof CLOSE_PARAMS>;
export type PlaywrightCliCommand = "open" | "goto" | "close";

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
};

export type PlaywrightCliDetails = {
  success: boolean;
  errors: string[];
  command: string;
  cwd: string;
  playwrightCommand: PlaywrightCliCommand;
  sessionId?: string;
  trackedSessionIds?: string[];
  exitCode?: number;
  killed?: boolean;
  output?: string;
  outputTruncated?: boolean;
};

export type TrackedSession = {
  sessionId: string;
  openedAt: number;
  lastUrl?: string;
};

export type ToolUpdate = (result: { content: Array<{ type: "text"; text: string }>; details?: unknown }) => void;
