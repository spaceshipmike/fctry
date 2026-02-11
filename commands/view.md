# /fctry:view

Start the spec viewer as a standalone browser interface. No other fctry command
needs to be running.

## When to Use

The user wants to read their spec in the browser without running init, evolve,
or execute. They may have closed their browser tab and want to re-open the
viewer, or they may be starting a new session just to read.

## Workflow

### 1. Find the spec

Look for `*-spec.md` in the current project directory. If not found:

```
No spec found in this project.
(1) Run `/fctry:init` to create one
(2) Specify a different directory
```

### 2. Check for existing viewer

Read `.fctry/viewer-port.json`. If the file exists and the process is alive
(check the PID), the viewer is already running:

```
Spec viewer is already running at http://localhost:{port}.
Opening in browser…
```

Open the browser and done. If the PID is stale, clean up both
`.fctry/viewer.pid` and `.fctry/viewer-port.json` and proceed to step 3.

### 3. Start the viewer

Run the viewer server:

```bash
node {fctry-plugin-dir}/src/viewer/server.js {project-dir}
```

The server:
- Finds a free port starting at 3850
- Writes PID to `.fctry/viewer.pid`
- Auto-opens the browser
- Watches the spec and changelog for live updates

### 4. Confirm

```
Spec viewer running at http://localhost:{port}
Watching: {spec-file-path}
Stop with `/fctry:stop` or Ctrl+C.
```

## Notes

- The viewer runs in the background. The user can continue using Claude Code.
- If the viewer was started by another command (init, evolve, execute), this
  command detects it and just opens the browser — no duplicate server.
- The server stops on SIGTERM, SIGINT, or `/fctry:stop`.
