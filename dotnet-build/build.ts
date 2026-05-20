import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, type BuildKind, type BuildParams, type BuildDetails, type ExecResult } from "./types.js";
import { formatCommand } from "./format.js";
import { buildToolResult, extractErrors, joinOutput, truncateTail } from "./output.js";
import { resolveBuildTarget } from "./target.js";

export async function runDotnetBuild(
  pi: ExtensionAPI,
  kind: BuildKind,
  params: BuildParams,
  cwd: string,
  signal?: AbortSignal,
  onUpdate?: (result: { content: Array<{ type: "text"; text: string }>; details?: unknown }) => void,
) {
  const target = await resolveBuildTarget(kind, cwd, params.path);
  if (!target.success) {
    const details: BuildDetails = {
      success: false,
      errors: target.errors,
      command: "dotnet build",
      cwd,
    };
    return buildToolResult(details);
  }

  const args = ["build", target.path];
  const command = formatCommand("dotnet", args);

  onUpdate?.({
    content: [{ type: "text", text: `Running ${command}` }],
    details: { command, cwd, targetPath: target.path },
  });

  let result: ExecResult;
  try {
    result = await pi.exec("dotnet", args, { cwd, signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details: BuildDetails = {
      success: false,
      errors: [message],
      command,
      cwd,
      targetPath: target.path,
    };
    return buildToolResult(details);
  }

  const success = result.code === 0 && !result.killed;
  const output = joinOutput(result.stdout, result.stderr);
  const errors = success ? [] : extractErrors(result, output);
  const truncated = truncateTail(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  const details: BuildDetails = {
    success,
    errors,
    command,
    cwd,
    targetPath: target.path,
    exitCode: result.code,
    killed: result.killed,
  };

  if (!success || truncated.truncated) {
    details.output = truncated.content;
    details.outputTruncated = truncated.truncated;
  }

  return buildToolResult(details);
}
