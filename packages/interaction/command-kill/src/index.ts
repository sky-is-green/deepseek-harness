/**
 * Human-facing `/kill` command to stop all agents, jobs, terminals, and loaded model servers.
 * @module @deepseek-ai/dsh-command-kill
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { LocalModelId, ModelLoadState } from '@deepseek-ai/dsh-models'
// Import for Context augmentation (module augmentation side effects)
import TerminalSessionService from '@deepseek-ai/dsh-terminal'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import JobRegistry from '@deepseek-ai/dsh-jobs'
import ModelsRuntime from '@deepseek-ai/dsh-models'

// Suppress unused import warnings for side-effect imports (module augmentation)
const _terminalService: typeof TerminalSessionService = TerminalSessionService
const _agentRegistry: typeof AgentRegistry = AgentRegistry
const _jobRegistry: typeof JobRegistry = JobRegistry
const _modelsRuntime: typeof ModelsRuntime = ModelsRuntime
void _terminalService
void _agentRegistry
void _jobRegistry
void _modelsRuntime

export const name = 'command-kill'
export const inject = ['commands', 'jobs', 'terminals', 'agents', 'models']

const USAGE = 'Usage: /kill (no arguments)'

interface KillSummary {
  agentsStopped: number
  jobsKilled: number
  terminalsClosed: number
  modelsUnloaded: number
  errors: string[]
}

async function executeKill(
  ctx: Context,
  invocation: CommandInvocation,
): Promise<CommandResult> {
  if (invocation.rawInput.trim().length > 0) {
    return { kind: 'error', text: USAGE }
  }

  const summary: KillSummary = {
    agentsStopped: 0,
    jobsKilled: 0,
    terminalsClosed: 0,
    modelsUnloaded: 0,
    errors: [],
  }

  // Stop all agents
  try {
    const agents = ctx.agents.list()
    for (const agent of agents) {
      try {
        agent.cancel({ kind: 'user' })
        summary.agentsStopped += 1
      } catch (error) {
        summary.errors.push(`agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    summary.errors.push(`listing agents: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Kill all jobs (global, unowned jobs)
  try {
    // Jobs are per-agent, but we can try to kill jobs for each agent
    const agents = ctx.agents.list()
    for (const agent of agents) {
      try {
        const jobs = ctx.jobs.list(agent)
        for (const job of jobs) {
          try {
            ctx.jobs.kill(job.id, agent, 'kill command')
            summary.jobsKilled += 1
          } catch (error) {
            summary.errors.push(`job ${job.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      } catch (error) {
        summary.errors.push(`listing jobs for agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    summary.errors.push(`killing jobs: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Close all terminals
  try {
    const agents = ctx.agents.list()
    for (const agent of agents) {
      try {
        const terminals = ctx.terminals.list(agent)
        for (const terminal of terminals) {
          try {
            await ctx.terminals.kill(agent, terminal.sessionId, 'kill command')
            summary.terminalsClosed += 1
          } catch (error) {
            summary.errors.push(`terminal ${terminal.sessionId}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      } catch (error) {
        summary.errors.push(`listing terminals for agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    summary.errors.push(`closing terminals: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Unload all loaded models
  try {
    const models: readonly { id: LocalModelId }[] = await ctx.models.listModels()
    for (const model of models) {
      try {
        const state: ModelLoadState = ctx.models.loadState(model.id)
        if (state.status === 'loaded' || state.status === 'loading') {
          await ctx.models.requestUnload(model.id)
          summary.modelsUnloaded += 1
        }
      } catch (error) {
        summary.errors.push(`model ${model.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } catch (error) {
    summary.errors.push(`unloading models: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Build result message
  const parts: string[] = []
  if (summary.agentsStopped > 0) parts.push(`${summary.agentsStopped} agent(s) stopped`)
  if (summary.jobsKilled > 0) parts.push(`${summary.jobsKilled} job(s) killed`)
  if (summary.terminalsClosed > 0) parts.push(`${summary.terminalsClosed} terminal(s) closed`)
  if (summary.modelsUnloaded > 0) parts.push(`${summary.modelsUnloaded} model(s) unloaded`)

  let text = parts.length > 0
    ? `Kill switch executed: ${parts.join(', ')}.`
    : 'Kill switch executed: nothing was running.'

  if (summary.errors.length > 0) {
    text += `\n\nErrors:\n${summary.errors.map(e => `  - ${e}`).join('\n')}`
  }

  return { kind: 'success', text }
}

/**
 * Register `/kill` for every composed human-command adapter.
 * @param ctx - context carrying the command registry and required services.
 */
export function apply(ctx: Context): void {
  const active = new Set<Promise<CommandResult>>()
  const handler = (invocation: CommandInvocation): Promise<CommandResult> => {
    const operation = executeKill(ctx, invocation)
    active.add(operation)
    const retire = (): void => { active.delete(operation) }
    void operation.then(retire, retire)
    return operation
  }

  ctx.effect(function* () {
    yield async () => { await Promise.allSettled(active) }
    yield ctx.commands.register({
      name: 'kill',
      description: 'Stop all agents, jobs, terminals, and loaded model servers',
      handler,
    })
  }, 'command-kill lifecycle')
}








