import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPlaywrightCliTools } from "./tools.js";

export default function (pi: ExtensionAPI) {
  registerPlaywrightCliTools(pi);
}
