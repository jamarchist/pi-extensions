import { Type, type Static } from "typebox";

export const GIT_ADD_PARAMS = Type.Object({
  files: Type.Optional(
    Type.Array(
      Type.String({ description: "A file path or git pathspec to pass to git add. Leading @ is ignored." }),
      {
        description: "Files/pathspecs to add. If omitted or empty, git_add runs git add --all.",
      },
    ),
  ),
});

export const GIT_COMMIT_PARAMS = Type.Object({
  message: Type.String({ minLength: 1, description: "Commit message to pass to git commit -m." }),
});

export type GitAddParams = Static<typeof GIT_ADD_PARAMS>;
export type GitCommitParams = Static<typeof GIT_COMMIT_PARAMS>;

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
};

export type GitOperationDetails = {
  success: boolean;
  errors: string[];
  command: string;
  cwd: string;
  exitCode?: number;
  killed?: boolean;
  output?: string;
  outputTruncated?: boolean;
};

export type ToolUpdate = (result: { content: Array<{ type: "text"; text: string }>; details?: unknown }) => void;
