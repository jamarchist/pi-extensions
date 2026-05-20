import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerGitOperationTools } from "./tools.js";

export default function (pi: ExtensionAPI) {
  registerGitOperationTools(pi);
}
