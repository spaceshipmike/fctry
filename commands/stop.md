# /fctry:stop

Stop the spec viewer server.

## Workflow

### 1. Find the PID file

Read `.fctry/viewer.pid` in the current project directory.

If the file doesn't exist:

```
No viewer is running for this project.
```

Done.

### 2. Stop the process

Send SIGTERM to the process ID from the PID file. The server's signal handler
cleans up the PID file on exit.

If the process doesn't exist (stale PID file), clean up the PID file:

```
Viewer was not running (stale PID file cleaned up).
```

### 3. Confirm

```
Spec viewer stopped.
```

## Notes

- The viewer also stops when Claude Code exits (the parent process terminates).
- If multiple projects have viewers running, this only stops the one for the
  current project directory.
