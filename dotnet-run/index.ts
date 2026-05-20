import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDotnetRunTools } from "./tools.js";

export default function (pi: ExtensionAPI) {
  registerDotnetRunTools(pi);
}
