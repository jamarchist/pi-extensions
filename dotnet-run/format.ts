export function normalizePath(path?: string) {
  if (!path) return undefined;
  return path.startsWith("@") ? path.slice(1) : path;
}

export function formatExtensions(extensions: Set<string>) {
  return [...extensions].join("/");
}

export function formatCommand(command: string, args: string[]) {
  return [command, ...args.map(quoteArg)].join(" ");
}

function quoteArg(arg: string) {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${Math.round(kib)}KB`;
  return `${(kib / 1024).toFixed(1)}MB`;
}
