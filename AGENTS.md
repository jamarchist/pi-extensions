# Repository Instructions

This repository contains pi extensions.

Most extensions in this repo are expected to be small, focused tool definitions that wrap simple operations. Prefer narrow, composable capabilities over broad, general-purpose abstractions.

These extensions support a broader strategy of creating many specialized agents with very specific and limited scopes of operation.

## Extension and Tool Guidelines

When adding or changing an extension:

- Keep the extension's purpose explicit and constrained.
- Prefer one directory per extension with `index.ts` as the default export entrypoint: `export default function (pi: ExtensionAPI) { ... }`.
- For multi-tool extensions, keep `index.ts` thin and delegate registration to `tools.ts`; move schemas/types into `types.ts` and implementation helpers into focused files.
- Register commands directly when the extension is only a command alias, as in `clear-command` and `exit-command`.
- Register flags and hook-based behavior in the extension entrypoint when the extension modifies tool/session behavior, as in `scoped-fs`.
- Keep state extension-local and clean it up with lifecycle hooks when needed, especially for long-running processes.

When writing tools:

- Keep each tool's purpose narrow and composable; avoid broad orchestration logic.
- Use predictable Typebox parameter schemas in `types.ts`; keep inputs minimal and document optional paths clearly.
- Resolve user-provided paths relative to `ctx.cwd`; accept pi-style leading `@` path prefixes where path inputs are expected.
- Validate targets before invoking external commands and return structured failure results instead of throwing for expected user/configuration errors.
- Return a concise JSON payload in `content[0].text` plus richer diagnostic data in `details`.
- Include `success`/`running`/`stopped` booleans and an `errors: string[]` field in tool results where applicable.
- Capture and truncate long command output, returning only useful tails and an explicit truncation marker.
- Use `onUpdate` to report long-running command startup/progress and honor `AbortSignal` when provided.
- Provide `description`, `promptSnippet`, and `promptGuidelines` that teach agents exactly when to use the tool.
- Add `prepareArguments` only for small compatibility normalizations, such as accepting numeric strings for process IDs.
- Avoid hidden side effects unless the tool name and documentation make them clear.
- Document assumptions, required environment, cleanup behavior, and safety constraints near the tool definition or in a README for the extension.

## Extension Index

- `clear-command` — Adds `/clear` as an alias for starting a new pi session (`/new`).
  - Tools: none
  - Commands: `clear`
- `exit-command` — Adds `/exit` as an alias for shutting down pi (`/quit`).
  - Tools: none
  - Commands: `exit`
- `dotnet-build` — Provides focused wrappers around `dotnet build` for solutions and projects, returning structured success/error results.
  - Tools: `dotnet_build_solution`, `dotnet_build_project`
- `dotnet-run` — Provides focused wrappers around `dotnet run` for web apps, finite console apps, long-running console/worker apps, and stopping tracked runs.
  - Tools: `dotnet_run_web`, `dotnet_run_console`, `dotnet_run_console_daemon`, `dotnet_stop`
- `git-operations` — Provides focused wrappers around simple git staging and committing operations.
  - Tools: `git_add`, `git_commit`
- `playwright-cli` — Provides focused wrappers around `npx playwright-cli` page/session commands.
  - Tools: `playwright_open`, `playwright_goto`, `playwright_close`
- `scoped-fs` — Restricts built-in filesystem tools to configured directory scopes and blocks `bash` to prevent scope bypasses.
  - Tools: none
  - Guards built-in tools: `read`, `write`, `edit`, `ls`, `grep`, `find`
