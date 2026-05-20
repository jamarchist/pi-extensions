import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BUILD_PARAMS } from "./types.js";
import { runDotnetBuild } from "./build.js";

export function registerDotnetBuildTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "dotnet_build_solution",
    label: "dotnet build solution",
    description:
      "Build the .NET solution in the current directory, or at the optional path. If path is a directory, it must contain exactly one .sln/.slnx/.slnf file. Returns { success, errors } instead of throwing when the build fails.",
    promptSnippet: "Build a .NET solution with dotnet build and return success plus build errors.",
    promptGuidelines: [
      "Use dotnet_build_solution when the user asks to build a .NET solution; pass path only when building a specific solution file or directory.",
    ],
    parameters: BUILD_PARAMS,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runDotnetBuild(pi, "solution", params, ctx.cwd, signal, onUpdate);
    },
  });

  pi.registerTool({
    name: "dotnet_build_project",
    label: "dotnet build project",
    description:
      "Build the .NET project in the current directory, or at the optional path. If path is a directory, it must contain exactly one .csproj/.fsproj/.vbproj file. Returns { success, errors } instead of throwing when the build fails.",
    promptSnippet: "Build a .NET project with dotnet build and return success plus build errors.",
    promptGuidelines: [
      "Use dotnet_build_project when the user asks to build a .NET project; pass path only when building a specific project file or directory.",
    ],
    parameters: BUILD_PARAMS,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runDotnetBuild(pi, "project", params, ctx.cwd, signal, onUpdate);
    },
  });
}
