import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { formatCommand } from "./format.js";
import { buildPlaywrightCliResult, extractErrors, joinOutput, truncateTail } from "./output.js";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  type ExecResult,
  type PlaywrightCliCommand,
  type PlaywrightCliDetails,
  type ToolUpdate,
} from "./types.js";

export async function runPlaywrightCliCommand(
  pi: ExtensionAPI,
  playwrightCommand: PlaywrightCliCommand,
  commandArgs: string[],
  options: {
    cwd: string;
    sessionId?: string;
    trackedSessionIds?: string[];
    signal?: AbortSignal;
    onUpdate?: ToolUpdate;
  },
) {
  const args = ["playwright-cli", ...formatSessionArgs(options.sessionId), playwrightCommand, ...commandArgs];
  const command = formatCommand("npx", args);

  options.onUpdate?.({
    content: [{ type: "text", text: `Running ${command}` }],
    details: {
      command,
      cwd: options.cwd,
      playwrightCommand,
      sessionId: options.sessionId,
      trackedSessionIds: options.trackedSessionIds,
    },
  });

  let result: ExecResult;
  try {
    result = await pi.exec("npx", args, { cwd: options.cwd, signal: options.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details: PlaywrightCliDetails = {
      success: false,
      errors: [message],
      command,
      cwd: options.cwd,
      playwrightCommand,
      sessionId: options.sessionId,
      trackedSessionIds: options.trackedSessionIds,
    };
    return buildPlaywrightCliResult(details);
  }

  const success = result.code === 0 && !result.killed;
  const output = joinOutput(result.stdout, result.stderr).trim();
  const truncated = truncateTail(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  const details: PlaywrightCliDetails = {
    success,
    errors: success ? [] : extractErrors(`playwright-cli ${playwrightCommand}`, result, output),
    command,
    cwd: options.cwd,
    playwrightCommand,
    sessionId: options.sessionId,
    trackedSessionIds: options.trackedSessionIds,
    exitCode: result.code,
    killed: result.killed,
  };

  if (truncated.content) {
    details.output = truncated.content;
    details.outputTruncated = truncated.truncated;
  }

  return buildPlaywrightCliResult(details);
}

export function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

export function buildInvalidUrlResult(playwrightCommand: PlaywrightCliCommand, cwd: string, sessionId?: string, trackedSessionIds?: string[]) {
  const command = formatCommand("npx", ["playwright-cli", ...formatSessionArgs(sessionId), playwrightCommand, "<url>"]);
  const details: PlaywrightCliDetails = {
    success: false,
    errors: ["url must not be empty."],
    command,
    cwd,
    playwrightCommand,
    sessionId,
    trackedSessionIds,
  };
  return buildPlaywrightCliResult(details);
}

export function buildSessionSelectionResult(
  playwrightCommand: PlaywrightCliCommand,
  cwd: string,
  error: string,
  trackedSessionIds: string[],
) {
  const command = formatCommand("npx", ["playwright-cli", `-s=<sessionId>`, playwrightCommand]);
  const details: PlaywrightCliDetails = {
    success: false,
    errors: [error],
    command,
    cwd,
    playwrightCommand,
    trackedSessionIds,
  };
  return buildPlaywrightCliResult(details);
}

function formatSessionArgs(sessionId: string | undefined) {
  return sessionId ? [`-s=${sessionId}`] : [];
}
