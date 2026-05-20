import {
  DAEMON_READY_PATTERNS,
  STARTUP_TIMEOUT_MS,
  type LongRunKind,
  type RunParams,
  type RunRecord,
  type ToolUpdate,
} from "./types.js";
import { resolveProjectTarget } from "./project-target.js";
import { attachRecordListeners, spawnDotnetRun, stopRecord } from "./process.js";
import { extractExitErrors, extractLocalhostAddresses, longRunResult } from "./output.js";

export async function startLongRunningProject(options: {
  kind: LongRunKind;
  cwd: string;
  params: RunParams;
  runs: Map<string, RunRecord>;
  nextRunNumber: () => number;
  signal?: AbortSignal;
  onUpdate?: ToolUpdate;
}) {
  const target = await resolveProjectTarget(options.cwd, options.params.path);
  if (!target.success) {
    return longRunResult({ running: false, errors: target.errors, kind: options.kind });
  }

  const launch = spawnDotnetRun(target.path, options.cwd);
  options.onUpdate?.({
    content: [{ type: "text", text: `Starting ${launch.command}` }],
    details: { command: launch.command, cwd: launch.cwd, projectPath: target.path, kind: options.kind },
  });

  if (!launch.success) {
    return longRunResult({
      running: false,
      errors: launch.errors,
      command: launch.command,
      cwd: launch.cwd,
      projectPath: target.path,
      kind: options.kind,
    });
  }

  const child = launch.child;
  if (!child.pid) {
    return longRunResult({
      running: false,
      errors: ["dotnet run started without a process id."],
      command: launch.command,
      cwd: launch.cwd,
      projectPath: target.path,
      kind: options.kind,
    });
  }

  const runId = `dotnet-${options.kind}-${Date.now()}-${options.nextRunNumber()}`;
  const record: RunRecord = {
    kind: options.kind,
    runId,
    processId: child.pid,
    child,
    command: launch.command,
    cwd: launch.cwd,
    projectPath: target.path,
    status: "starting",
    startedAt: Date.now(),
    outputTail: "",
    outputTruncated: false,
  };

  options.runs.set(runId, record);
  attachRecordListeners(record);

  const started = options.kind === "web"
    ? await waitUntilWebRunning(record, options.signal)
    : await waitUntilDaemonRunning(record, options.signal);

  if (!started.running) {
    options.runs.delete(runId);
    await stopRecord(record).catch(() => undefined);
    return longRunResult({
      running: false,
      runId,
      processId: record.processId,
      errors: started.errors,
      command: launch.command,
      cwd: launch.cwd,
      projectPath: target.path,
      kind: options.kind,
      detection: started.detection,
      outputTail: record.outputTail || undefined,
      outputTruncated: record.outputTruncated,
    });
  }

  record.status = "running";
  return longRunResult({
    running: true,
    runId,
    processId: record.processId,
    errors: [],
    command: launch.command,
    cwd: launch.cwd,
    projectPath: target.path,
    kind: options.kind,
    localhostAddress: started.localhostAddress,
    localhostAddresses: started.localhostAddresses,
    detection: started.detection,
    outputTail: record.outputTail || undefined,
    outputTruncated: record.outputTruncated,
  });
}

async function waitUntilWebRunning(record: RunRecord, signal?: AbortSignal) {
  return new Promise<{
    running: boolean;
    errors: string[];
    detection: string;
    localhostAddress?: string;
    localhostAddresses?: string[];
  }>((resolvePromise) => {
    let settled = false;

    const settle = (value: {
      running: boolean;
      errors: string[];
      detection: string;
      localhostAddress?: string;
      localhostAddresses?: string[];
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      record.child.stdout.off("data", onData);
      record.child.stderr.off("data", onData);
      record.child.off("error", onError);
      record.child.off("exit", onExit);
      signal?.removeEventListener("abort", onAbort);
      resolvePromise(value);
    };

    const inspectOutput = (text: string) => {
      const addresses = extractLocalhostAddresses(text);
      if (addresses.length > 0) {
        record.localhostAddress = addresses[0];
        record.localhostAddresses = addresses;
        settle({
          running: true,
          errors: [],
          detection: "matched localhost listening address",
          localhostAddress: addresses[0],
          localhostAddresses: addresses,
        });
      }
    };

    const onData = () => inspectOutput(record.outputTail);

    const onError = (error: Error) => {
      settle({ running: false, errors: [error.message], detection: "spawn error" });
    };

    const onExit = (code: number | null, exitSignal: NodeJS.Signals | null) => {
      settle({
        running: false,
        errors: extractExitErrors(record, "dotnet run exited before a localhost web address was detected", code, exitSignal),
        detection: "exited before localhost address",
      });
    };

    const onAbort = () => {
      settle({ running: false, errors: ["dotnet run was cancelled before startup completed."], detection: "cancelled" });
    };

    const timer = setTimeout(() => {
      inspectOutput(record.outputTail);
      if (!settled) {
        settle({
          running: false,
          errors: [`No localhost listening address was detected within ${STARTUP_TIMEOUT_MS}ms.`],
          detection: "timed out waiting for localhost address",
        });
      }
    }, STARTUP_TIMEOUT_MS);

    record.child.stdout.on("data", onData);
    record.child.stderr.on("data", onData);
    record.child.once("error", onError);
    record.child.once("exit", onExit);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    inspectOutput(record.outputTail);
  });
}

async function waitUntilDaemonRunning(record: RunRecord, signal?: AbortSignal) {
  return new Promise<{ running: boolean; errors: string[]; detection: string }>((resolvePromise) => {
    let settled = false;

    const settle = (value: { running: boolean; errors: string[]; detection: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      record.child.stdout.off("data", onData);
      record.child.stderr.off("data", onData);
      record.child.off("error", onError);
      record.child.off("exit", onExit);
      signal?.removeEventListener("abort", onAbort);
      resolvePromise(value);
    };

    const onData = () => {
      const matched = DAEMON_READY_PATTERNS.find((pattern) => pattern.test(record.outputTail));
      if (matched) {
        settle({ running: true, errors: [], detection: `matched readiness output: ${matched}` });
      }
    };

    const onError = (error: Error) => {
      settle({ running: false, errors: [error.message], detection: "spawn error" });
    };

    const onExit = (code: number | null, exitSignal: NodeJS.Signals | null) => {
      settle({
        running: false,
        errors: extractExitErrors(record, "dotnet run exited before it was considered running", code, exitSignal),
        detection: "exited before readiness",
      });
    };

    const onAbort = () => {
      settle({ running: false, errors: ["dotnet run was cancelled before startup completed."], detection: "cancelled" });
    };

    const timer = setTimeout(() => {
      if (record.child.exitCode === null && !record.child.killed && record.status !== "exited") {
        settle({ running: true, errors: [], detection: `still running after ${STARTUP_TIMEOUT_MS}ms` });
      } else {
        settle({
          running: false,
          errors: extractExitErrors(record, "dotnet run exited before startup completed", record.exitCode, record.exitSignal),
          detection: "exited before timeout",
        });
      }
    }, STARTUP_TIMEOUT_MS);

    record.child.stdout.on("data", onData);
    record.child.stderr.on("data", onData);
    record.child.once("error", onError);
    record.child.once("exit", onExit);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    onData();
  });
}
