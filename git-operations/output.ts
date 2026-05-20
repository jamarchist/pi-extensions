import { Buffer } from "node:buffer";
import type { ExecResult, GitOperationDetails } from "./types.js";

const MAX_ERROR_BYTES = 8_000;

export function buildGitToolResult(details: GitOperationDetails) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: details.success,
            error: details.errors[0],
            errors: details.errors,
          },
          null,
          2,
        ),
      },
    ],
    details,
  };
}

export function extractGitErrors(operation: string, result: ExecResult) {
  const errors: string[] = [];

  if (result.killed) {
    errors.push(`${operation} was killed or cancelled.`);
  }

  const stderr = result.stderr.trim();
  if (stderr) {
    errors.push(truncateError(stderr));
  }

  if (errors.length > 0) return errors;

  const stdout = result.stdout.trim();
  if (stdout) return [truncateError(stdout)];

  return [`${operation} exited with code ${result.code}.`];
}

export function joinOutput(stdout: string, stderr: string) {
  if (!stdout) return stderr;
  if (!stderr) return stdout;
  return `${stdout}\n${stderr}`;
}

export function truncateError(message: string) {
  const buffer = Buffer.from(message, "utf8");
  if (buffer.length <= MAX_ERROR_BYTES) return message;
  return `${buffer.subarray(buffer.length - MAX_ERROR_BYTES).toString("utf8")}\n[Output truncated to last ${MAX_ERROR_BYTES} bytes.]`;
}
