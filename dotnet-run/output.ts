import { MAX_OUTPUT_TAIL_BYTES, type ConsoleRunDetails, type LongRunDetails, type RunRecord, type StopDetails } from "./types.js";
import { formatSize } from "./format.js";

export function longRunResult(details: LongRunDetails) {
  const payload = {
    running: details.running,
    localhostAddress: details.localhostAddress,
    localhostAddresses: details.localhostAddresses,
    processId: details.processId,
    runId: details.runId,
    errors: details.errors,
  };

  let text = JSON.stringify(payload, null, 2);
  if (!details.running && details.outputTail) {
    text += `\n\nOutput tail:\n${details.outputTail}`;
  }
  if (details.outputTruncated) {
    text += `\n\n[Output truncated to last ${formatSize(MAX_OUTPUT_TAIL_BYTES)}.]`;
  }

  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function consoleRunResult(details: ConsoleRunDetails) {
  const payload = {
    success: details.success,
    exitCode: details.exitCode,
    errors: details.errors,
  };

  let text = JSON.stringify(payload, null, 2);
  if (details.outputTail) {
    text += `\n\nOutput tail:\n${details.outputTail}`;
  }
  if (details.outputTruncated) {
    text += `\n\n[Output truncated to last ${formatSize(MAX_OUTPUT_TAIL_BYTES)}.]`;
  }

  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function stopResult(details: StopDetails) {
  const payload = {
    success: details.success,
    stopped: details.stopped,
    processId: details.processId,
    runId: details.runId,
    errors: details.errors,
  };

  let text = JSON.stringify(payload, null, 2);
  if (details.outputTruncated) {
    text += `\n\n[Output truncated to last ${formatSize(MAX_OUTPUT_TAIL_BYTES)}.]`;
  }

  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export function extractLocalhostAddresses(output: string) {
  const addresses: string[] = [];
  const listeningPattern = /Now listening on:\s*(https?:\/\/[^\s]+)/gi;
  const localPattern = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::\])(?::\d+)?(?:\/[^\s'"<>]*)?/gi;

  for (const pattern of [listeningPattern, localPattern]) {
    for (const match of output.matchAll(pattern)) {
      const raw = (match[1] ?? match[0]).replace(/[),.;]+$/, "");
      const normalized = normalizeLocalhostAddress(raw);
      if (normalized && !addresses.includes(normalized)) {
        addresses.push(normalized);
      }
    }
  }

  return addresses;
}

function normalizeLocalhostAddress(raw: string) {
  try {
    const url = new URL(raw);
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!["localhost", "127.0.0.1", "0.0.0.0", "::1", "::"].includes(hostname)) {
      return undefined;
    }

    url.hostname = "localhost";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function extractExitErrors(
  record: RunRecord,
  baseMessage: string,
  code?: number | null,
  exitSignal?: NodeJS.Signals | null,
) {
  const codeText = code === undefined || code === null ? "null" : String(code);
  const signalText = exitSignal ? `, signal ${exitSignal}` : "";
  const fallback = `${baseMessage} (code ${codeText}${signalText}).`;
  return extractErrors(record.outputTail, record.exitError ?? fallback);
}

export function extractErrors(output: string, fallback: string) {
  const errors = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => /(^|\s)(error\s+[A-Z]+\d+|error\s*:|:\s*error\s+|The build failed\.)/i.test(line));

  return errors.length > 0 ? [...new Set(errors)] : [fallback];
}

export function appendOutput(record: RunRecord, chunk: Buffer | string) {
  const next = appendTail(record.outputTail, chunk, MAX_OUTPUT_TAIL_BYTES);
  record.outputTail = next.content;
  record.outputTruncated = record.outputTruncated || next.truncated;
}

export function appendTail(current: string, chunk: Buffer | string, maxBytes: number) {
  const combined = current + String(chunk);
  const truncated = Buffer.byteLength(combined, "utf8") > maxBytes;
  return { content: bufferTail(combined, maxBytes), truncated };
}

function bufferTail(content: string, maxBytes: number) {
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length <= maxBytes) return content;
  return buffer.subarray(buffer.length - maxBytes).toString("utf8");
}
