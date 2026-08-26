# @deepseek-ai/dsh-command-kill

English | [中文](README.zh.md)

Human-facing `/kill` command to stop all agents, jobs, terminals, and loaded model servers with one confirm.

## Usage

```
/kill
```

No arguments accepted.

## What it stops

| Target | Service | Action |
|--------|---------|--------|
| Agents | `ctx.agents` | `agent.cancel({ kind: 'user' })` |
| Jobs | `ctx.jobs` | `ctx.jobs.kill(id, agent, 'kill command')` |
| Terminals | `ctx.terminals` | `ctx.terminals.kill(agent, id, 'kill command')` |
| Loaded models | `ctx.models` | `ctx.models.requestUnload(modelId)` |

## Behavior

- Iterates all live agents and cancels each one
- For each agent, lists and kills their owned jobs
- For each agent, lists and closes their terminal sessions
- Unloads all models in `loaded` or `loading` state
- Reports a summary of everything stopped
- Reports any errors encountered per-target

## Registration

Load the plugin in your `cordis.yml`:

```yaml
plugins:
  - '@deepseek-ai/dsh-command-kill'
```

The command appears in the command palette (Ctrl/Cmd+K) and can be invoked by typing `/kill`.

## Known Limitations

- Jobs are per-agent; there is no global job list. The command kills jobs for each known agent.
- Models in `failed` state are not unloaded (they're already stopped).
- The command does not wait for agents/jobs/terminals/models to fully settle — it issues the stop requests and reports immediately.
- Requires `ctx.jobs`, `ctx.terminals`, `ctx.agents`, and `ctx.models` services to be composed.