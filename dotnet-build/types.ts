import { Type, type Static } from "typebox";

export const DEFAULT_MAX_BYTES = 50 * 1024;
export const DEFAULT_MAX_LINES = 2000;

export const BUILD_PARAMS = Type.Object({
  path: Type.Optional(
    Type.String({
      description:
        "Optional path to a solution/project file or to a directory containing exactly one solution/project file. Leading @ is ignored.",
    }),
  ),
});

export type BuildParams = Static<typeof BUILD_PARAMS>;
export type BuildKind = "solution" | "project";

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
};

export type BuildDetails = {
  success: boolean;
  errors: string[];
  command: string;
  cwd: string;
  targetPath?: string;
  exitCode?: number;
  killed?: boolean;
  output?: string;
  outputTruncated?: boolean;
};

export const SOLUTION_EXTENSIONS = new Set([".sln", ".slnx", ".slnf"]);
export const PROJECT_EXTENSIONS = new Set([".csproj", ".fsproj", ".vbproj"]);
