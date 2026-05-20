import { access, readdir, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import {
  PROJECT_EXTENSIONS,
  SOLUTION_EXTENSIONS,
  type BuildKind,
} from "./types.js";
import { capitalize, formatExtensions, normalizePath } from "./format.js";

export async function resolveBuildTarget(kind: BuildKind, cwd: string, inputPath?: string) {
  const extensions = kind === "solution" ? SOLUTION_EXTENSIONS : PROJECT_EXTENSIONS;
  const label = kind === "solution" ? "solution" : "project";
  const normalizedPath = normalizePath(inputPath);
  const basePath = normalizedPath ? resolve(cwd, normalizedPath) : cwd;

  try {
    await access(basePath);
  } catch {
    return {
      success: false as const,
      errors: [`${capitalize(label)} path does not exist: ${basePath}`],
    };
  }

  const info = await stat(basePath);
  if (info.isFile()) {
    const extension = extname(basePath).toLowerCase();
    if (!extensions.has(extension)) {
      return {
        success: false as const,
        errors: [
          `Expected a ${label} file (${formatExtensions(extensions)}), but got: ${basePath}`,
        ],
      };
    }

    return { success: true as const, path: basePath };
  }

  if (!info.isDirectory()) {
    return {
      success: false as const,
      errors: [`Expected a ${label} file or directory, but got: ${basePath}`],
    };
  }

  const candidates = await findDirectChildrenWithExtensions(basePath, extensions);
  if (candidates.length === 0) {
    return {
      success: false as const,
      errors: [
        `No ${label} file (${formatExtensions(extensions)}) found in directory: ${basePath}`,
      ],
    };
  }

  if (candidates.length > 1) {
    return {
      success: false as const,
      errors: [
        `Multiple ${label} files found in directory: ${basePath}. Pass path to the one to build: ${candidates
          .map((candidate) => basename(candidate))
          .join(", ")}`,
      ],
    };
  }

  return { success: true as const, path: candidates[0] };
}

async function findDirectChildrenWithExtensions(directory: string, extensions: Set<string>) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.has(extname(entry.name).toLowerCase()))
    .map((entry) => resolve(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}
