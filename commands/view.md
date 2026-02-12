# /fctry:view

Open the spec viewer in the browser. The viewer also auto-starts via plugin
hooks on any `/fctry:` command — this command is for explicit opens and
re-opening a closed browser tab.

## Workflow

### 1. Check if the viewer is already running

Look for `.fctry/viewer-port.json` in the project directory. If it exists, read
the port and check if the process is alive (`.fctry/viewer.pid`). If alive, open
`http://localhost:{port}/viewer` and report the URL. Done.

### 2. Start the viewer via manage.sh

If the viewer isn't running, find `manage.sh` using the plugin-root breadcrumb:

```bash
plugin_root=$(cat "{project-dir}/.fctry/plugin-root")
bash "$plugin_root/src/viewer/manage.sh" start "{project-dir}" "$plugin_root"
```

Report the script's output to the user. The script handles:
- Finding the spec file (errors if none found)
- Installing npm dependencies on first launch
- Detecting an already-running viewer (opens browser to existing URL)
- Cleaning up stale PID files
- Starting the server and opening the browser
- Printing the URL and watched file path

If the script exits non-zero, relay the error message.

### 3. If plugin-root breadcrumb is missing

If `.fctry/plugin-root` doesn't exist, tell the user:

> Viewer can't start — run any `/fctry:` command first to initialize, then try
> `/fctry:view` again.

## Notes

- The viewer auto-starts silently on every prompt via `hooks/hooks.json` —
  this command just opens the browser to an already-running (or freshly started) viewer.
- Auto-stops on session end via the `SessionEnd` hook.
- Stop manually with `/fctry:stop`.
