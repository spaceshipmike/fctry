# /fctry:stop

Stop the spec viewer server. The viewer persists across Claude Code sessions,
so this command is the way to shut it down when you're done.

## Workflow

Find `manage.sh` using the plugin-root breadcrumb and run the stop command:

```bash
plugin_root=$(cat "{project-dir}/.fctry/plugin-root")
bash "$plugin_root/src/viewer/manage.sh" stop "{project-dir}"
```

If `.fctry/plugin-root` doesn't exist, check `.fctry/viewer/viewer.pid` instead. If a
PID file exists, kill the process directly and clean up. If neither file exists,
tell the user no viewer is running.

Report the script's output to the user. The script handles:
- Detecting when no viewer is running
- Sending SIGTERM to a running viewer
- Cleaning up stale PID files

## Notes

- The viewer persists across Claude Code sessions — it does not auto-stop.
- If multiple projects have viewers running, this only stops the one for the
  current project directory.
