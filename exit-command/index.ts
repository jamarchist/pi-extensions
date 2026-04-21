import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Adds a `/exit` command as an alias for `/quit`.
 * Because typing the wrong exit command shouldn't pollute your conversation.
 */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("exit", {
    description: "Exit pi (alias for /quit)",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });
}
