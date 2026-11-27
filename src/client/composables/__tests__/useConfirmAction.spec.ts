import { describe, expect, it, vi } from 'vitest'

import { useConfirmAction } from '@/composables/useConfirmAction'

interface Target {
  id: number
}

describe('useConfirmAction', () => {
  it('opens for the asked target and closes once the action succeeded', async () => {
    const action = vi.fn<(target: Target) => Promise<void>>().mockResolvedValue()
    const confirmAction = useConfirmAction(action)
    const target = { id: 1 }

    confirmAction.ask(target)
    expect(confirmAction.open.value).toBe(true)
    expect(confirmAction.target.value).toBe(target)

    await expect(confirmAction.confirm()).resolves.toBe(true)
    expect(action).toHaveBeenCalledWith(target)
    expect(confirmAction.open.value).toBe(false)
  })

  it('keeps the dialog open with the failure until the next ask', async () => {
    const failure = new Error('refused')
    const confirmAction = useConfirmAction<Target>(() => Promise.reject(failure))

    confirmAction.ask({ id: 1 })
    await expect(confirmAction.confirm()).resolves.toBe(false)

    expect(confirmAction.open.value).toBe(true)
    expect(confirmAction.error.value).toBe(failure)
    expect(confirmAction.busy.value).toBe(false)

    confirmAction.ask({ id: 2 })
    expect(confirmAction.error.value).toBeNull()
  })

  it('runs one action at a time and confirms nothing before an ask', async () => {
    let finish: () => void = () => {}
    const action = vi.fn<(target: Target) => Promise<void>>(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const confirmAction = useConfirmAction(action)

    await expect(confirmAction.confirm()).resolves.toBe(false)

    const first = confirmAction.run({ id: 1 })

    expect(confirmAction.busy.value).toBe(true)
    await expect(confirmAction.run({ id: 2 })).resolves.toBe(false)

    finish()
    await expect(first).resolves.toBe(true)
    expect(action).toHaveBeenCalledOnce()
  })
})
