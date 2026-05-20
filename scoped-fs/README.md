# scoped-fs

A small pi extension that blocks built-in filesystem tools outside configured directory scopes.

## Defaults

If no scope is provided, each path-based filesystem tool is limited to the current `cwd`.

The extension guards:

- `read`
- `write`
- `edit`
- `ls`
- `grep`
- `find`

`bash` is always blocked because shell commands can bypass path-level checks.

## CLI flag

Load the extension and pass per-tool directory permissions as JSON:

```bash
pi -e ./scoped-fs \
  --fs-scope '{"readTools":["src","tests"],"writeTools":[],"grep":["src"]}' \
  --tools read,grep,find,ls \
  -p "Review this code"
```

Supported keys:

- exact tool names: `read`, `write`, `edit`, `ls`, `grep`, `find`
- group aliases: `readTools`, `writeTools`
- wildcard: `*`

Values:

- `"path"` or `["path-a", "path-b"]`: allow those roots
- `true`: allow `cwd`
- `false`, `null`, or `[]`: deny the tool
- missing key: allow `cwd`

Relative paths resolve against the pi process `cwd`.

## Environment metadata

The same JSON can be supplied through environment variables:

```bash
PI_FS_SCOPE='{"readTools":["packages/api"],"writeTools":[]}' pi -e ./scoped-fs -p "Review API"
```

For subagent child processes, the extension also looks for:

- `PI_SUBAGENT_METADATA` with a nested `fsScope`, `scopedFs`, or `fs-scope` object
- `PI_SUBAGENT_FS_SCOPE` with the scope object directly

Example metadata payload:

```json
{
  "fsScope": {
    "readTools": ["packages/api", "shared/types"],
    "writeTools": []
  }
}
```

Current `pi-subagents` versions do not expose a first-class arbitrary metadata field on the public subagent API; this extension is ready to consume that metadata if a launcher passes it via one of the environment variables above.
