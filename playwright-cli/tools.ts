import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildPlaywrightCliResult } from "./output.js";
import { buildInvalidUrlResult, buildSessionSelectionResult, normalizeText, runPlaywrightCliCommand } from "./runner.js";
import { CLOSE_PARAMS, URL_PARAMS, type TrackedSession } from "./types.js";

export function registerPlaywrightCliTools(pi: ExtensionAPI) {
  const sessions = new Map<string, TrackedSession>();
  const sessionPrefix = `pi-browser-${Date.now().toString(36)}`;
  let nextSessionNumber = 1;

  const trackedSessionIds = () => [...sessions.keys()];

  const allocateSessionId = (requestedSessionId: string | undefined) => {
    const sessionId = normalizeText(requestedSessionId);
    return sessionId || `${sessionPrefix}-${nextSessionNumber++}`;
  };

  const resolveSessionId = (requestedSessionId: string | undefined, command: "goto" | "close", cwd: string) => {
    const sessionId = normalizeText(requestedSessionId);
    if (sessionId) return { success: true as const, sessionId };

    const ids = trackedSessionIds();
    if (ids.length === 1) return { success: true as const, sessionId: ids[0] };

    const error =
      ids.length === 0
        ? `No tracked Playwright CLI sessions. Call playwright_open first or pass sessionId to target an existing playwright-cli session.`
        : `Multiple Playwright CLI sessions are tracked (${ids.join(", ")}). Pass sessionId to choose one.`;

    return {
      success: false as const,
      result: buildSessionSelectionResult(command, cwd, error, ids),
    };
  };

  pi.registerTool({
    name: "playwright_open",
    label: "playwright-cli open",
    description:
      "Run `npx playwright-cli -s=<sessionId> open <url>` in the current directory. Opens a separate Playwright CLI browser session, generating sessionId when omitted, and returns { success, sessionId, trackedSessionIds, errors } plus CLI output/snapshot.",
    promptSnippet:
      "Open a URL in a separate Playwright CLI browser session and return its sessionId plus CLI output/snapshot.",
    promptGuidelines: [
      "Use playwright_open when the user wants to start a Playwright CLI browser session at a URL; keep the returned sessionId for later playwright_goto or playwright_close calls.",
      "Pass playwright_open sessionId only when the user asks for a specific browser/session id; otherwise omit it and use the generated id returned by the tool.",
    ],
    parameters: URL_PARAMS,
    prepareArguments(args) {
      if (typeof args === "string") return { url: args };
      return args;
    },
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const sessionId = allocateSessionId(params.sessionId);
      const url = normalizeText(params.url);
      const ids = trackedSessionIds();
      if (!url) return buildInvalidUrlResult("open", ctx.cwd, sessionId, ids);

      const result = await runPlaywrightCliCommand(pi, "open", [url], {
        cwd: ctx.cwd,
        sessionId,
        trackedSessionIds: ids,
        signal,
        onUpdate,
      });

      if (result.details?.success) {
        sessions.set(sessionId, { sessionId, openedAt: Date.now(), lastUrl: url });
        result.details.trackedSessionIds = trackedSessionIds();
        return buildPlaywrightCliResult(result.details);
      }

      return result;
    },
  });

  pi.registerTool({
    name: "playwright_goto",
    label: "playwright-cli goto",
    description:
      "Run `npx playwright-cli -s=<sessionId> goto <url>` in the current directory. Navigates a specific Playwright CLI browser session and returns { success, sessionId, trackedSessionIds, errors } plus CLI output/snapshot. If sessionId is omitted, exactly one tracked session must exist.",
    promptSnippet: "Navigate a tracked Playwright CLI browser session by sessionId with `goto <url>`.",
    promptGuidelines: [
      "Use playwright_goto only after a Playwright CLI page/session exists; pass sessionId when multiple sessions may be open.",
    ],
    parameters: URL_PARAMS,
    prepareArguments(args) {
      if (typeof args === "string") return { url: args };
      return args;
    },
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const resolution = resolveSessionId(params.sessionId, "goto", ctx.cwd);
      if (!resolution.success) return resolution.result;

      const url = normalizeText(params.url);
      const ids = trackedSessionIds();
      if (!url) return buildInvalidUrlResult("goto", ctx.cwd, resolution.sessionId, ids);

      const result = await runPlaywrightCliCommand(pi, "goto", [url], {
        cwd: ctx.cwd,
        sessionId: resolution.sessionId,
        trackedSessionIds: ids,
        signal,
        onUpdate,
      });

      if (result.details?.success) {
        const current = sessions.get(resolution.sessionId);
        sessions.set(
          resolution.sessionId,
          current ? { ...current, lastUrl: url } : { sessionId: resolution.sessionId, openedAt: Date.now(), lastUrl: url },
        );
        result.details.trackedSessionIds = trackedSessionIds();
        return buildPlaywrightCliResult(result.details);
      }

      return result;
    },
  });

  pi.registerTool({
    name: "playwright_close",
    label: "playwright-cli close",
    description:
      "Run `npx playwright-cli -s=<sessionId> close` in the current directory. Closes a specific Playwright CLI browser session and returns { success, sessionId, trackedSessionIds, errors } plus any CLI output. If sessionId is omitted, exactly one tracked session must exist.",
    promptSnippet: "Close a tracked Playwright CLI browser session by sessionId.",
    promptGuidelines: [
      "Use playwright_close with the sessionId returned by playwright_open whenever possible; omit sessionId only when exactly one session is tracked.",
    ],
    parameters: CLOSE_PARAMS,
    prepareArguments(args) {
      if (typeof args === "string") return { sessionId: args };
      return args;
    },
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const resolution = resolveSessionId(params.sessionId, "close", ctx.cwd);
      if (!resolution.success) return resolution.result;

      const result = await runPlaywrightCliCommand(pi, "close", [], {
        cwd: ctx.cwd,
        sessionId: resolution.sessionId,
        trackedSessionIds: trackedSessionIds(),
        signal,
        onUpdate,
      });

      if (result.details?.success) {
        sessions.delete(resolution.sessionId);
        result.details.trackedSessionIds = trackedSessionIds();
        return buildPlaywrightCliResult(result.details);
      }

      return result;
    },
  });
}
