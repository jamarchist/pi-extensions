import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, type ExecResult, type PlaywrightCliDetails } from "./types.js";

export function buildPlaywrightCliResult(details: PlaywrightCliDetails) {
  const payload = {
    success: details.success,
    sessionId: details.sessionId,
    trackedSessionIds: details.trackedSessionIds,
    errors: details.errors,
  };

  let text = JSON.stringify(payload, null, 2);
  if (details.output) {
    text += `\n\nOutput:\n${details.output}`;
  }
  if (details.outputTruncated) {
    text += `\n\n[Output truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}.]`;
  }

  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function extractErrors(operation: string, result: ExecResult, output: string) {
  const errors: string[] = [];

  if (result.killed) {
    errors.push(`${operation} was killed or cancelled.`);
  }

  const stderr = result.stderr.trim();
  if (stderr) {
    errors.push(truncateForError(stderr));
  }

  if (errors.length > 0) return errors;

  const fallback = truncateTail(output || `${operation} exited with code ${result.code}.`, {
    maxLines: 40,
    maxBytes: 8_000,
  });
  return [fallback.content.trim() || `${operation} exited with code ${result.code}.`];
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

function truncateForError(message: string) {
  const truncated = truncateTail(message, { maxLines: 40, maxBytes: 8_000 });
  if (!truncated.truncated) return truncated.content;
  return `${truncated.content}\n[Output truncated to last ${formatSize(8_000)}.]`;
}

function bufferTail(content: string, maxBytes: number) {
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length <= maxBytes) return content;
  return buffer.subarray(buffer.length - maxBytes).toString("utf8");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${Number.isInteger(kib) ? kib : kib.toFixed(1)}KB`;
  const mib = kib / 1024;
  return `${Number.isInteger(mib) ? mib : mib.toFixed(1)}MB`;
}
