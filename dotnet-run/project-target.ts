import { access, readdir, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { PROJECT_EXTENSIONS } from "./types.js";
import { formatExtensions, normalizePath } from "./format.js";

export async function resolveProjectTarget(cwd: string, inputPath?: string) {
  const normalizedPath = normalizePath(inputPath);
  const basePath = normalizedPath ? resolve(cwd, normalizedPath) : cwd;

  try {
    await access(basePath);
  } catch {
    return {
      success: false as const,
      errors: [`Project path does not exist: ${basePath}`],
    };
  }

  const info = await stat(basePath);
  if (info.isFile()) {
    const extension = extname(basePath).toLowerCase();
    if (!PROJECT_EXTENSIONS.has(extension)) {
      return {
        success: false as const,
        errors: [`Expected a .NET project file (${formatExtensions(PROJECT_EXTENSIONS)}), but got: ${basePath}`],
      };
    }

    return { success: true as const, path: basePath };
  }

  if (!info.isDirectory()) {
    return {
      success: false as const,
      errors: [`Expected a .NET project file or directory, but got: ${basePath}`],
    };
  }

  const candidates = await findDirectChildrenWithExtensions(basePath, PROJECT_EXTENSIONS);
  if (candidates.length === 0) {
    return {
      success: false as const,
      errors: [`No .NET project file (${formatExtensions(PROJECT_EXTENSIONS)}) found in directory: ${basePath}`],
    };
  }

  if (candidates.length > 1) {
    return {
      success: false as const,
      errors: [
        `Multiple .NET project files found in directory: ${basePath}. Pass path to the one to run: ${candidates
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
