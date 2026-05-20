import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { realpath } from "node:fs/promises";
import path from "node:path";

type ScopeValue = string | string[] | boolean | null | undefined;
type ScopePolicy = Record<string, ScopeValue>;

const PATH_TOOLS = new Set(["read", "write", "edit", "ls", "grep", "find"]);
const READ_TOOLS = new Set(["read", "ls", "grep", "find"]);
const WRITE_TOOLS = new Set(["write", "edit"]);

const FLAG_NAME = "fs-scope";
const ENV_NAME = "PI_FS_SCOPE";
const SUBAGENT_ENV_NAME = "PI_SUBAGENT_FS_SCOPE";
const SUBAGENT_METADATA_ENV_NAME = "PI_SUBAGENT_METADATA";

function stripAtPrefix(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function parseJsonObject(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw?.trim()) return undefined;

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("scope metadata must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function scopeFromMetadata(raw: string | undefined): ScopePolicy | undefined {
  const parsed = parseJsonObject(raw);
  if (!parsed) return undefined;

  const scoped = parsed.fsScope ?? parsed.scopedFs ?? parsed["fs-scope"];
  if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) return undefined;

  return scoped as ScopePolicy;
}

function scopeFromRaw(raw: string | undefined): ScopePolicy | undefined {
  const parsed = parseJsonObject(raw);
  return parsed as ScopePolicy | undefined;
}

function pickScopeValue(policy: ScopePolicy | undefined, toolName: string): ScopeValue {
  if (!policy) return undefined;
  if (Object.prototype.hasOwnProperty.call(policy, toolName)) return policy[toolName];
  if (READ_TOOLS.has(toolName) && Object.prototype.hasOwnProperty.call(policy, "readTools")) return policy.readTools;
  if (WRITE_TOOLS.has(toolName) && Object.prototype.hasOwnProperty.call(policy, "writeTools")) return policy.writeTools;
  if (Object.prototype.hasOwnProperty.call(policy, "*")) return policy["*"];
  return undefined;
}

function normalizeScopeValue(value: ScopeValue, cwd: string): string[] | false {
  // Missing entries default to the current process cwd.
  if (value === undefined || value === true) return [cwd];
  if (value === false || value === null) return false;
  if (typeof value === "string") return value.trim() ? [value] : false;
  if (Array.isArray(value)) {
    const paths = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return paths.length > 0 ? paths : false;
  }
  return false;
}

async function canonicalize(candidate: string, cwd: string): Promise<string> {
  const absolute = path.resolve(cwd, stripAtPrefix(candidate));

  try {
    return await realpath(absolute);
  } catch {
    // New files or not-yet-created directories cannot be realpathed. Resolve the
    // nearest existing parent instead so symlink escapes in parent paths are still
    // caught where possible.
    const root = path.parse(absolute).root;
    let current = path.dirname(absolute);

    while (current && current !== root) {
      try {
        const realParent = await realpath(current);
        return path.resolve(realParent, path.relative(current, absolute));
      } catch {
        current = path.dirname(current);
      }
    }

    try {
      const realRoot = await realpath(root);
      return path.resolve(realRoot, path.relative(root, absolute));
    } catch {
      return absolute;
    }
  }
}

function comparePath(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isInside(root: string, target: string): boolean {
  const comparableRoot = comparePath(root);
  const comparableTarget = comparePath(target);
  const relative = path.relative(comparableRoot, comparableTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function getToolPath(toolName: string, input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;

  if (toolName === "ls" || toolName === "grep" || toolName === "find") {
    return typeof record.path === "string" && record.path.trim() ? record.path : ".";
  }

  return typeof record.path === "string" ? record.path : undefined;
}

function hasParentTraversal(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.split(/[\\/]+/).includes("..");
}

function hasAbsolutePath(value: unknown): boolean {
  return typeof value === "string" && path.isAbsolute(value);
}

function getDangerousSearchPattern(toolName: string, input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;

  // grep's glob is path-like and can be abused to try to escape the scoped root.
  if (toolName === "grep" && (hasParentTraversal(record.glob) || hasAbsolutePath(record.glob))) {
    return "glob";
  }

  // find's pattern is usually a filename/glob pattern. Block explicit path escapes.
  if (toolName === "find" && (hasParentTraversal(record.pattern) || hasAbsolutePath(record.pattern))) {
    return "pattern";
  }

  return undefined;
}

function loadPolicy(pi: ExtensionAPI): { policy?: ScopePolicy; source: string } {
  const isSubagent = process.env.PI_SUBAGENT_CHILD === "1";

  if (isSubagent) {
    const fromMetadata = scopeFromMetadata(process.env[SUBAGENT_METADATA_ENV_NAME]);
    if (fromMetadata) return { policy: fromMetadata, source: SUBAGENT_METADATA_ENV_NAME };

    const fromSubagentEnv = scopeFromRaw(process.env[SUBAGENT_ENV_NAME]);
    if (fromSubagentEnv) return { policy: fromSubagentEnv, source: SUBAGENT_ENV_NAME };
  }

  const fromEnv = scopeFromRaw(process.env[ENV_NAME]);
  if (fromEnv) return { policy: fromEnv, source: ENV_NAME };

  const fromFlag = scopeFromRaw(pi.getFlag(FLAG_NAME) as string | undefined);
  if (fromFlag) return { policy: fromFlag, source: `--${FLAG_NAME}` };

  return { source: "cwd default" };
}

export default function (pi: ExtensionAPI) {
  pi.registerFlag(FLAG_NAME, {
    description:
      'Filesystem scope JSON. Example: {"readTools":["src"],"writeTools":[],"grep":["src","tests"]}',
    type: "string",
  });

  let activePolicy: ScopePolicy | undefined;
  let activeSource = "cwd default";

  pi.on("session_start", async (_event, ctx) => {
    try {
      const loaded = loadPolicy(pi);
      activePolicy = loaded.policy;
      activeSource = loaded.source;
      ctx.ui.setStatus("scoped-fs", `fs scope: ${activeSource}`);
    } catch (error) {
      activePolicy = { "*": false };
      activeSource = "invalid policy";
      ctx.ui.notify(`Invalid filesystem scope policy: ${(error as Error).message}`, "error");
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash") {
      return {
        block: true,
        reason: "scoped-fs blocks bash because shell commands can bypass path-level filesystem scope checks.",
      };
    }

    if (!PATH_TOOLS.has(event.toolName)) return;

    const dangerousSearchField = getDangerousSearchPattern(event.toolName, event.input);
    if (dangerousSearchField) {
      return {
        block: true,
        reason: `scoped-fs blocked ${event.toolName}: ${dangerousSearchField} must not contain an absolute path or '..'.`,
      };
    }

    const rawPath = getToolPath(event.toolName, event.input);
    if (!rawPath) {
      return {
        block: true,
        reason: `scoped-fs could not determine a path for ${event.toolName}.`,
      };
    }

    const scopeValue = pickScopeValue(activePolicy, event.toolName);
    const allowedDirs = normalizeScopeValue(scopeValue, ctx.cwd);
    if (allowedDirs === false) {
      return {
        block: true,
        reason: `scoped-fs denies ${event.toolName}; no directories are allowed for this tool.`,
      };
    }

    const target = await canonicalize(rawPath, ctx.cwd);
    const roots = await Promise.all(allowedDirs.map((dir) => canonicalize(dir, ctx.cwd)));

    if (!roots.some((root) => isInside(root, target))) {
      return {
        block: true,
        reason: `scoped-fs denied ${event.toolName} on ${target}; allowed roots: ${roots.join(", ")}`,
      };
    }
  });
}
