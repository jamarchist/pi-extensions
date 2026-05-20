import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Adds a clear command alias that starts a new session.
 */
export default function (pi: ExtensionAPI) {
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
