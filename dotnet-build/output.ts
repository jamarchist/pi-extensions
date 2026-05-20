import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, type BuildDetails, type ExecResult } from "./types.js";
import { formatSize, unique } from "./format.js";

export function buildToolResult(details: BuildDetails) {
  const payload = {
    success: details.success,
    errors: details.errors,
  };

  let text = JSON.stringify(payload, null, 2);
  if (!details.success && details.output) {
    text += `\n\nOutput tail:\n${details.output}`;
  }
  if (details.outputTruncated) {
    text += `\n\n[Output truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.]`;
  }

  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function extractErrors(result: ExecResult, output: string) {
  const errors = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      if (/^\s*0\s+Error\(s\)/i.test(line)) return false;
      return /(^|\s)(error\s+[A-Z]+\d+|error\s*:|:\s*error\s+|Build FAILED\.)/i.test(line);
    });

  if (result.killed) {
    errors.unshift("dotnet build was killed or cancelled.");
  }

  if (errors.length > 0) return unique(errors);

  const fallback = truncateTail(output || `dotnet build exited with code ${result.code}.`, {
    maxLines: 40,
    maxBytes: 8_000,
  });
  return [fallback.content.trim() || `dotnet build exited with code ${result.code}.`];
}

export function joinOutput(stdout: string, stderr: string) {
  if (!stdout) return stderr;
  if (!stderr) return stdout;
  return `${stdout}\n${stderr}`;
}

export function truncateTail(content: string, options: { maxLines: number; maxBytes: number }) {
  const allLines = content.split(/\r?\n/);
  let lines = allLines.slice(-options.maxLines);
  let truncated = lines.length < allLines.length;
  let next = lines.join("\n");

  while (Buffer.byteLength(next, "utf8") > options.maxBytes && lines.length > 1) {
    lines = lines.slice(1);
    next = lines.join("\n");
    truncated = true;
  }

  if (Buffer.byteLength(next, "utf8") > options.maxBytes) {
    next = bufferTail(next, options.maxBytes);
    truncated = true;
  }

  return { content: next, truncated };
}

function bufferTail(content: string, maxBytes: number) {
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length <= maxBytes) return content;
  return buffer.subarray(buffer.length - maxBytes).toString("utf8");
}
