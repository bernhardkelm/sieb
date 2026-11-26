import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROMPT_LINK_LIMIT } from '#core/handoffLinks.ts'
import { useHandoffOpen } from '@/composables/useHandoffOpen'
import { notifySuccess, notifyWithAction, type ToastActionChoice } from '@/toast/toastManager'

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: ToastActionChoice) => void>(),
}))

const PROMPTS = { chat: 'Chat it', code: 'Triage it' }

const writeText = vi.fn<(text: string) => Promise<void>>()
const assign = vi.fn<(url: string) => void>()

beforeEach(() => {
  writeText.mockReset().mockResolvedValue()
  assign.mockReset()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('location', { ...window.location, assign })
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyWithAction).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useHandoffOpen', () => {
  it.each([
    ['desktop-code', 'claude://code/new?q=Triage%20it', 'Triage it'],
    ['desktop-chat', 'claude://claude.ai/new?q=Chat%20it', 'Chat it'],
    ['cli', 'claude-cli://open?q=Triage%20it', 'Triage it'],
    ['vscode', 'vscode://anthropic.claude-code/open?prompt=Triage%20it', 'Triage it'],
  ] as const)('opens %s through its deep link and offers copying', async (target, link, prompt) => {
    useHandoffOpen().open(target, PROMPTS)

    expect(assign).toHaveBeenCalledWith(link)
    expect(writeText).not.toHaveBeenCalled()
    expect(notifyWithAction).toHaveBeenCalledWith(
      'handoff-open',
      'Opening Claude…',
      'If nothing happens, copy the prompt instead.',
      expect.objectContaining({ label: 'Copy prompt' }),
    )

    vi.mocked(notifyWithAction).mock.calls[0]![3].onClick()
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(prompt)
    expect(notifySuccess).toHaveBeenCalledWith('Copied for Claude', 'Paste the prompt into Claude.')
  })

  it('copies the chat prompt for the copy preference without a link', async () => {
    useHandoffOpen().open('copy', PROMPTS)
    await flushPromises()

    expect(assign).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('Chat it')
    expect(notifySuccess).toHaveBeenCalledWith('Copied for Claude', 'Paste the prompt into Claude.')
  })

  it('copies a prompt too long for the link instead of cutting it', async () => {
    const prompt = 'a'.repeat(PROMPT_LINK_LIMIT)

    useHandoffOpen().open('cli', { chat: 'Chat it', code: prompt })
    await flushPromises()

    expect(assign).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith(prompt)
    expect(notifySuccess).toHaveBeenCalledWith(
      'Too long for a link, copied',
      'Paste the prompt into Claude.',
    )
  })
})
