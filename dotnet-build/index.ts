import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDotnetBuildTools } from "./tools.js";

export default function (pi: ExtensionAPI) {
  registerDotnetBuildTools(pi);
}
