import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname } from "node:path";
import { STOP_TIMEOUT_MS, type RunRecord } from "./types.js";
import { formatCommand } from "./format.js";
import { appendOutput } from "./output.js";

export function spawnDotnetRun(projectPath: string, callerCwd: string) {
  const args = ["run", "--project", projectPath];
  const command = formatCommand("dotnet", args);
  const cwd = dirname(projectPath) || callerCwd;

  try {
    const child = spawn("dotnet", args, {
      cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    return { success: true as const, child, command, cwd };
  } catch (error) {
    return {
      success: false as const,
      errors: [error instanceof Error ? error.message : String(error)],
      command,
      cwd,
    };
  }
}

export function attachRecordListeners(record: RunRecord) {
  record.child.stdout.on("data", (chunk) => appendOutput(record, chunk));
  record.child.stderr.on("data", (chunk) => appendOutput(record, chunk));
  record.child.once("error", (error) => {
    record.status = "exited";
    record.exitError = error.message;
  });
  record.child.once("exit", (code, exitSignal) => {
    record.status = "exited";
    record.exitCode = code;
    record.exitSignal = exitSignal;
  });
}

export async function stopRecord(record: RunRecord) {
  record.status = "stopping";
  const stopped = await stopProcessId(record.processId, {
    useProcessGroup: process.platform !== "win32",
    child: record.child,
  });
  if (stopped.success) record.status = "exited";
  return stopped;
}

export async function stopProcessId(
  processId: number,
  options: { useProcessGroup?: boolean; child?: ChildProcessWithoutNullStreams } = {},
) {
  if (options.child && options.child.exitCode !== null) {
    return { success: true, errors: [] };
  }

  if (process.platform === "win32") {
    const taskkill = spawn("taskkill", ["/PID", String(processId), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    const code = await waitForExitCode(taskkill, STOP_TIMEOUT_MS);
    if (code === 0) return { success: true, errors: [] };
    return { success: false, errors: [`taskkill failed for process ${processId} with exit code ${code}.`] };
  }

  try {
    process.kill(options.useProcessGroup ? -processId : processId, "SIGTERM");
  } catch (error) {
    if (options.child && options.child.exitCode !== null) return { success: true, errors: [] };
    return { success: false, errors: [error instanceof Error ? error.message : String(error)] };
  }

  if (options.child) {
    const exited = await waitForChildExit(options.child, STOP_TIMEOUT_MS);
    if (exited) return { success: true, errors: [] };

    try {
      process.kill(options.useProcessGroup ? -processId : processId, "SIGKILL");
    } catch {
      options.child.kill("SIGKILL");
    }
    await waitForChildExit(options.child, 1000);
  }

  return { success: true, errors: [] };
}

function waitForExitCode(child: ReturnType<typeof spawn>, timeoutMs: number) {
  return new Promise<number | null>((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(null), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolvePromise(code);
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolvePromise(null);
    });
  });
}

export function waitForChildExit(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolvePromise) => {
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolvePromise(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolvePromise(true);
    };
    child.once("exit", onExit);
  });
}
