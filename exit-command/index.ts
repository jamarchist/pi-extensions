import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Adds an exit command alias.
 */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Exit pi (alias for /quit)",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });
}
