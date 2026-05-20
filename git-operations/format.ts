export function normalizePath(path: string) {
  return path.startsWith("@") ? path.slice(1) : path;
}

export function formatCommand(command: string, args: string[]) {
  return [command, ...args.map(quoteArg)].join(" ");
}

function quoteArg(arg: string) {
  return /\s/.test(arg) ? JSON.stringify(arg) : arg;
}
