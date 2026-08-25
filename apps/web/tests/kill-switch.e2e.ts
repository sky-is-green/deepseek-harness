// Web e2e scenario: kill switch. The `kill-switch` command contribution is
// a client-only surface: it must appear in the assembled slash catalog, its
// single option must gate settlement behind the shared risk confirmation,
// and confirming must fan the cancel out to every listed session and report
// the tally through the composer notice channel.
//
// Zero model calls: no replay fixture mounts, and the fan-out does not need
// a running turn — `session.cancel` accepts idle sessions, which is exactly
// what lets this lane prove the wiring without a provider key. The runtime's
// own cancel semantics (quiescence, queued-message retention) are covered by
// dsh-client-runtime and apiproxy suites, not here.
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { launchWebScaffold, seedSession, watchConsole, type WebScaffold } from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, saveFailureShot } from './support.ts'

const SEED_ID = 'kill-switch-web-e2e'

/**
 * A settled one-turn session: the roster needs a second entry so the
 * confirmation's live count proves the fan-out targets more than the blank
 * session the workspace connect produced.
 *
 * Values are serialized through `JSON.stringify` rather than `{{cwd}}`
 * templating so Windows backslash paths stay valid JSON (the scaffold's
 * token replacement is literal).
 * @param workspaceCwd - the scaffold's workspace root.
 * @returns a tokenized session log ending on a closed turn.
 */
function seedLog(workspaceCwd: string): string {
  const time = 1784974200000
  const line = (index: number, event: Record<string, unknown>): string =>
    JSON.stringify({ ...event, seq: index, time: time + index })
  return [
    JSON.stringify({ type: 'session', version: 0, id: '{{sessionId}}', createdAt: time, cwd: `${workspaceCwd}/workspace` }),
    line(0, { type: 'turn/start', data: { turn: 1, trigger: { kind: 'message', source: { kind: 'user', rpcId: 'seed' } } } }),
    line(1, {
      type: 'user/message',
      data: { content: [{ type: 'text', text: 'Seeded turn.' }], source: { kind: 'user', rpcId: 'seed' } },
      surfaceOp: 'append',
    }),
    line(2, { type: 'session/title', data: { title: 'Kill switch target', messageSeqs: [1], source: { kind: 'fallback' } } }),
    line(3, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }),
  ].join('\n')
}

/** Every option label the slash menu currently lists. */
async function menuOptions(page: Page): Promise<string[]> {
  const menu = page.getByRole('listbox', { name: 'Trigger suggestions' })
  await menu.waitFor({ timeout: 10_000 })
  return await menu.getByRole('option').allTextContents()
}

describe('web e2e: kill switch', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    await seedSession(scaffold, seedLog(scaffold.workspaceCwd), SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    void tripwire
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspace(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('lists kill-switch in the assembled slash catalog', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-kill-switch-catalog'))
    const composer = page.locator('textarea:enabled').last()
    await composer.fill('/kill')
    await expect.poll(() => menuOptions(page), { timeout: 15_000 })
      .toEqual([expect.stringContaining('kill-switch')])
    await composer.fill('')
  })

  it('gates the action behind the risk confirmation naming both sessions', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-kill-switch-confirm'))
    const composer = page.locator('textarea:enabled').last()
    await composer.fill('/kill')
    await expect.poll(() => menuOptions(page), { timeout: 15_000 })
      .toEqual([expect.stringContaining('kill-switch')])

    // Picking the command opens the popupSelect shell over its single option.
    await page.getByRole('listbox', { name: 'Trigger suggestions' })
      .getByRole('option').first().click()
    const option = page.getByRole('button', { name: /Stop everything/ })
    await option.waitFor({ timeout: 10_000 })

    // The option opens the shared risk gate; confirm stays disabled until
    // the acknowledgement is checked, and names the live roster size.
    await option.click()
    const dialog = page.getByRole('dialog', { name: 'Stop all sessions?' })
    await dialog.waitFor({ timeout: 10_000 })
    const confirm = dialog.getByRole('button', { name: /Stop all/ })
    expect(await confirm.isEnabled()).toBe(false)

    await dialog.getByRole('checkbox').check()
    expect(await confirm.isEnabled()).toBe(true)
    expect(confirm.textContent()).toContain('(2)')
  })

  it('fans the cancel out and reports the tally through the composer notice', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-kill-switch-fanout'))
    // Continue the previous case: the acknowledgement is checked and the
    // confirm button enabled — pressing it is the whole point of the row.
    const dialog = page.getByRole('dialog', { name: 'Stop all sessions?' })
    await dialog.getByRole('button', { name: /Stop all/ }).click()

    // The tally notice renders through the opening session's composer notice
    // channel: both listed sessions accepted, out of two targeted.
    await page.getByText('Sent stop to 2/2 sessions').waitFor({ timeout: 15_000 })
  }, 60_000)
})
