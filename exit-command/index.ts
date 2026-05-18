import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Adds common command aliases.
 * Because typing the wrong command shouldn't pollute your conversation.
 */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Exit pi (alias for /quit)",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });

  pi.registerCommand("clear", {
    description: "Start a new session (alias for /new)",
    handler: async (_args, ctx) => {
      await ctx.newSession({
        withSession: async (ctx) => {
          ctx.ui.notify("New session started", "success");
        },
      });
    },
  });
}
