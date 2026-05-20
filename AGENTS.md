# Repository Instructions

This repository contains pi extensions.

Most extensions in this repo are expected to be small, focused tool definitions that wrap simple operations. Prefer narrow, composable capabilities over broad, general-purpose abstractions.

These extensions support a broader strategy of creating many specialized agents with very specific and limited scopes of operation. When adding or changing an extension:

- Keep the tool's purpose explicit and constrained.
- Make inputs and outputs simple, predictable, and easy for an agent to use.
- Avoid hidden side effects unless the tool name and documentation make them clear.
- Favor small wrappers around concrete operations instead of large orchestration logic.
- Document any assumptions, required environment, or safety constraints near the tool definition.
- Design tools so they can be combined by higher-level agents rather than trying to solve every workflow themselves.
