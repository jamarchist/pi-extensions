import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { RUN_PARAMS, STOP_PARAMS, type RunRecord } from "./types.js";
import { runConsoleProject } from "./console.js";
import { startLongRunningProject } from "./long-running.js";
import { stopAllDotnetRuns, stopDotnetRun } from "./stop.js";

export function registerDotnetRunTools(pi: ExtensionAPI) {
  const runs = new Map<string, RunRecord>();
  let nextRunNumber = 1;

  pi.registerTool({
    name: "dotnet_run_web",
    label: "dotnet run web",
    description:
      "Run a .NET web project in the current directory, or at the optional path. Waits until the app reports a localhost listening URL, then returns { running, localhostAddress, processId, runId, errors }. Pass runId or processId to dotnet_stop later.",
    promptSnippet: "Start a .NET web app with dotnet run and return its localhost URL plus a stop hook.",
    promptGuidelines: [
      "Use dotnet_run_web for ASP.NET/.NET web apps when the user needs the local URL; keep the returned runId for dotnet_stop.",
    ],
    parameters: RUN_PARAMS,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return startLongRunningProject({
        kind: "web",
        cwd: ctx.cwd,
        params,
        runs,
        nextRunNumber: () => nextRunNumber++,
        signal,
        onUpdate,
      });
    },
  });

  pi.registerTool({
    name: "dotnet_run_console",
    label: "dotnet run console",
    description:
      "Run a .NET console project in the current directory, or at the optional path, and wait for it to complete. Returns { success, exitCode, errors } and an output tail.",
    promptSnippet: "Run a .NET console app to completion and return success, errors, and output.",
    promptGuidelines: [
      "Use dotnet_run_console for finite .NET console apps; do not use it for servers or daemons that keep running.",
    ],
    parameters: RUN_PARAMS,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runConsoleProject(ctx.cwd, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    name: "dotnet_run_console_daemon",
    label: "dotnet run console daemon",
    description:
      "Run a long-running .NET console/worker project in the current directory, or at the optional path. Waits until it appears to be running, then returns { running, processId, runId, errors }. There is no localhost URL. Pass runId or processId to dotnet_stop later.",
    promptSnippet: "Start a long-running .NET console/worker app and return a stop hook.",
    promptGuidelines: [
      "Use dotnet_run_console_daemon for worker services or long-running console apps that do not expose localhost; keep the returned runId for dotnet_stop.",
    ],
    parameters: RUN_PARAMS,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return startLongRunningProject({
        kind: "console_daemon",
        cwd: ctx.cwd,
        params,
        runs,
        nextRunNumber: () => nextRunNumber++,
        signal,
        onUpdate,
      });
    },
  });

  pi.registerTool({
    name: "dotnet_stop",
    label: "dotnet stop",
    description:
      "Stop a process started by dotnet_run_web or dotnet_run_console_daemon. Pass the returned runId, processId, or omit both only when there is exactly one tracked running process.",
    promptSnippet: "Stop a .NET process that was started by dotnet_run_web or dotnet_run_console_daemon.",
    promptGuidelines: [
      "Use dotnet_stop with the runId returned by dotnet_run_web or dotnet_run_console_daemon whenever possible; use processId only when runId is unavailable.",
    ],
    parameters: STOP_PARAMS,
    prepareArguments(args) {
      if (!args || typeof args !== "object") return args;
      const input = args as { runId?: unknown; processId?: unknown; pid?: unknown };
      const processId = input.processId ?? input.pid;
      if (typeof processId === "string" && /^\d+$/.test(processId)) {
        return { runId: input.runId, processId: Number(processId) };
      }
      if (typeof input.pid === "number" && input.processId === undefined) {
        return { runId: input.runId, processId: input.pid };
      }
      return args;
    },
    async execute(_toolCallId, params) {
      return stopDotnetRun(runs, params);
    },
  });

  pi.on("session_shutdown", async () => {
    await stopAllDotnetRuns(runs);
  });
}
