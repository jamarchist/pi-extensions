import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { MAX_OUTPUT_TAIL_BYTES, type RunParams, type ToolUpdate } from "./types.js";
import { resolveProjectTarget } from "./project-target.js";
import { spawnDotnetRun, stopProcessId } from "./process.js";
import { appendTail, consoleRunResult, extractErrors } from "./output.js";

export async function runConsoleProject(
  cwd: string,
  params: RunParams,
  signal?: AbortSignal,
  onUpdate?: ToolUpdate,
) {
  const target = await resolveProjectTarget(cwd, params.path);
  if (!target.success) {
    return consoleRunResult({ success: false, errors: target.errors });
  }

  const launch = spawnDotnetRun(target.path, cwd);
  onUpdate?.({
    content: [{ type: "text", text: `Running ${launch.command}` }],
    details: { command: launch.command, cwd: launch.cwd, projectPath: target.path },
  });

  if (!launch.success) {
    return consoleRunResult({
      success: false,
      errors: launch.errors,
      command: launch.command,
      cwd: launch.cwd,
      projectPath: target.path,
    });
  }

  const child = launch.child;
  let outputTail = "";
  let outputTruncated = false;

  const append = (chunk: Buffer | string) => {
    const next = appendTail(outputTail, chunk, MAX_OUTPUT_TAIL_BYTES);
    outputTail = next.content;
    outputTruncated = outputTruncated || next.truncated;
  };

  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const finished = await waitForConsoleExit(child, signal, async () => {
    if (child.pid) {
      await stopProcessId(child.pid, { useProcessGroup: process.platform !== "win32", child }).catch(() => undefined);
    }
  });

  const success = finished.code === 0 && !finished.error && !finished.cancelled;
  const fallback = finished.cancelled
    ? "dotnet run was cancelled before the console app completed."
    : finished.error ?? `dotnet run exited with code ${finished.code}.`;

  return consoleRunResult({
    success,
    exitCode: finished.code,
    exitSignal: finished.signal,
    errors: success ? [] : extractErrors(outputTail, fallback),
    command: launch.command,
    cwd: launch.cwd,
    projectPath: target.path,
    outputTail: outputTail || undefined,
    outputTruncated,
  });
}

function waitForConsoleExit(
  child: ChildProcessWithoutNullStreams,
  signal: AbortSignal | undefined,
  onAbort: () => Promise<void>,
) {
  return new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    error?: string;
    cancelled?: boolean;
  }>((resolvePromise) => {
    let settled = false;

    const settle = (value: { code: number | null; signal: NodeJS.Signals | null; error?: string; cancelled?: boolean }) => {
      if (settled) return;
      settled = true;
      child.off("exit", onExit);
      child.off("error", onError);
      signal?.removeEventListener("abort", abortHandler);
      resolvePromise(value);
    };

    const onExit = (code: number | null, exitSignal: NodeJS.Signals | null) => {
      settle({ code, signal: exitSignal });
    };

    const onError = (error: Error) => {
      settle({ code: null, signal: null, error: error.message });
    };

    const abortHandler = async () => {
      await onAbort();
      settle({ code: null, signal: null, cancelled: true });
    };

    child.once("exit", onExit);
    child.once("error", onError);
    signal?.addEventListener("abort", abortHandler, { once: true });
    if (signal?.aborted) void abortHandler();
  });
}
