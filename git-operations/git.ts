import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { formatCommand, normalizePath } from "./format.js";
import { buildGitToolResult, extractGitErrors, joinOutput, truncateError } from "./output.js";
import type { ExecResult, GitAddParams, GitCommitParams, GitOperationDetails, ToolUpdate } from "./types.js";

export async function runGitAdd(
  pi: ExtensionAPI,
  params: GitAddParams,
  cwd: string,
  signal?: AbortSignal,
  onUpdate?: ToolUpdate,
) {
  const files = (params.files ?? []).map(normalizePath).filter((file) => file.length > 0);
  const args = files.length === 0 ? ["add", "--all"] : ["add", "--", ...files];
  return runGitCommand(pi, "git add", args, cwd, signal, onUpdate);
}

export async function runGitCommit(
  pi: ExtensionAPI,
  params: GitCommitParams,
  cwd: string,
  signal?: AbortSignal,
  onUpdate?: ToolUpdate,
) {
  const message = params.message.trim();
  const args = ["commit", "-m", params.message];
  const command = formatCommand("git", args);

  if (!message) {
    const details: GitOperationDetails = {
      success: false,
      errors: ["Commit message must not be empty."],
      command,
      cwd,
    };
    return buildGitToolResult(details);
  }

  return runGitCommand(pi, "git commit", args, cwd, signal, onUpdate);
}

async function runGitCommand(
  pi: ExtensionAPI,
  operation: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
  onUpdate?: ToolUpdate,
) {
  const command = formatCommand("git", args);

  onUpdate?.({
    content: [{ type: "text", text: `Running ${command}` }],
    details: { command, cwd },
  });

  let result: ExecResult;
  try {
    result = await pi.exec("git", args, { cwd, signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details: GitOperationDetails = {
      success: false,
      errors: [message],
      command,
      cwd,
    };
    return buildGitToolResult(details);
  }

  const success = result.code === 0 && !result.killed;
  const details: GitOperationDetails = {
    success,
    errors: success ? [] : extractGitErrors(operation, result),
    command,
    cwd,
    exitCode: result.code,
    killed: result.killed,
  };

  const output = joinOutput(result.stdout, result.stderr).trim();
  if (!success && output) {
    details.output = truncateError(output);
    details.outputTruncated = details.output !== output;
  }

  return buildGitToolResult(details);
}
