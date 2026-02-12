# /fctry:stop

Stop the spec viewer server. The viewer also auto-stops on session end via
the `SessionEnd` plugin hook — this command is for explicit manual stops.

## Workflow

Run the lifecycle script:

```bash
bash "{plugin-root}/src/viewer/manage.sh" stop "{project-dir}"
```

Report the script's output to the user. The script handles:
- Detecting when no viewer is running
- Sending SIGTERM to a running viewer
- Cleaning up stale PID files

## Notes

- The viewer auto-stops when the Claude Code session ends.
- If multiple projects have viewers running, this only stops the one for the
  current project directory.
