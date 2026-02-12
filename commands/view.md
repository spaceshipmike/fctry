# /fctry:view

Open the spec viewer in the browser. The viewer also auto-starts via plugin
hooks on any `/fctry:` command — this command is for explicit opens and
re-opening a closed browser tab.

## Workflow

Run the lifecycle script:

```bash
bash "{plugin-root}/src/viewer/manage.sh" start "{project-dir}" "{plugin-root}"
```

Report the script's output to the user. The script handles:
- Finding the spec file (errors if none found)
- Detecting an already-running viewer (opens browser to existing URL)
- Cleaning up stale PID files
- Starting the server and opening the browser
- Printing the URL and watched file path

If the script exits non-zero, relay the error message.

## Notes

- The viewer auto-starts silently on every prompt via `hooks/hooks.json` —
  this command just opens the browser to an already-running (or freshly started) viewer.
- Auto-stops on session end via the `SessionEnd` hook.
- Stop manually with `/fctry:stop`.
