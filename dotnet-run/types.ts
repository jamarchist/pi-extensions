import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { Type, type Static } from "typebox";

export const MAX_OUTPUT_TAIL_BYTES = 24 * 1024;
export const STARTUP_TIMEOUT_MS = 10_000;
export const STOP_TIMEOUT_MS = 5_000;

export const RUN_PARAMS = Type.Object({
  path: Type.Optional(
    Type.String({
      description:
        "Optional path to a .NET project file or to a directory containing exactly one .NET project file. Leading @ is ignored.",
    }),
  ),
});

export const STOP_PARAMS = Type.Object({
  runId: Type.Optional(
    Type.String({ description: "The runId returned by dotnet_run_web or dotnet_run_console_daemon." }),
  ),
  processId: Type.Optional(
    Type.Integer({
      minimum: 1,
      description: "The processId returned by dotnet_run_web or dotnet_run_console_daemon.",
    }),
  ),
});

export type RunParams = Static<typeof RUN_PARAMS>;
export type StopParams = Static<typeof STOP_PARAMS>;
export type LongRunKind = "web" | "console_daemon";

export type ToolUpdate = (result: { content: Array<{ type: "text"; text: string }>; details?: unknown }) => void;

export type RunRecord = {
  kind: LongRunKind;
  runId: string;
  processId: number;
  child: ChildProcessWithoutNullStreams;
  command: string;
  cwd: string;
  projectPath: string;
  status: "starting" | "running" | "stopping" | "exited";
  startedAt: number;
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
  exitError?: string;
  outputTail: string;
  outputTruncated: boolean;
  localhostAddress?: string;
  localhostAddresses?: string[];
};

export type LongRunDetails = {
  running: boolean;
  runId?: string;
  processId?: number;
  errors: string[];
  command?: string;
  cwd?: string;
  projectPath?: string;
  kind?: LongRunKind;
  localhostAddress?: string;
  localhostAddresses?: string[];
  detection?: string;
  outputTail?: string;
  outputTruncated?: boolean;
};

export type ConsoleRunDetails = {
  success: boolean;
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
  errors: string[];
  command?: string;
  cwd?: string;
  projectPath?: string;
  outputTail?: string;
  outputTruncated?: boolean;
};

export type StopDetails = {
  success: boolean;
  stopped: boolean;
  runId?: string;
  processId?: number;
  errors: string[];
  outputTail?: string;
  outputTruncated?: boolean;
};

export const PROJECT_EXTENSIONS = new Set([".csproj", ".fsproj", ".vbproj"]);
export const DAEMON_READY_PATTERNS = [
  /Now listening on:/i,
  /Application started\. Press Ctrl\+C to shut down\./i,
  /Started\s+.+\s+in\s+\d+(?:\.\d+)?\s*(?:ms|milliseconds|s|sec|seconds)\.?/i,
];
