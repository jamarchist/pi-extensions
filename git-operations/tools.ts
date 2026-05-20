import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runGitAdd, runGitCommit } from "./git.js";
import { GIT_ADD_PARAMS, GIT_COMMIT_PARAMS } from "./types.js";

export function registerGitOperationTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "git_add",
    label: "git add",
    description:
      "Stage files with git add in the current working directory. Pass files to stage specific paths, or omit files to run git add --all. Returns { success, errors } instead of throwing when git fails.",
    promptSnippet: "Stage files with git add; defaults to git add --all when no files are provided.",
    promptGuidelines: [
      "Use git_add when the user asks to stage files before committing; omit files only when the user wants all changes staged.",
    ],
    parameters: GIT_ADD_PARAMS,
    prepareArguments(args) {
      if (Array.isArray(args)) return { files: args };
      return args;
    },
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runGitAdd(pi, params, ctx.cwd, signal, onUpdate);
    },
  });

  pi.registerTool({
    name: "git_commit",
    label: "git commit",
    description:
      "Create a git commit in the current working directory using the provided commit message. Returns { success, errors } instead of throwing when git fails.",
    promptSnippet: "Create a git commit with git commit -m using the provided message.",
    promptGuidelines: [
      "Use git_commit only when the user explicitly asks to commit staged changes or has approved committing changes.",
    ],
    parameters: GIT_COMMIT_PARAMS,
    prepareArguments(args) {
      if (typeof args === "string") return { message: args };
      return args;
    },
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runGitCommit(pi, params, ctx.cwd, signal, onUpdate);
    },
  });
}
