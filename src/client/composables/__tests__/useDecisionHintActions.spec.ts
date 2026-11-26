import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'

import type { DecisionView } from '#core/findingView.ts'
import { buildDecision } from '#core/__tests__/coreBuilders.ts'
import { reopenedEffective } from '@/__tests__/reopenedEffective'
import type { DecisionEditing } from '@/composables/useDecisionEditing'
import { useDecisionHintActions } from '@/composables/useDecisionHintActions'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { useHintActionsStore } from '@/stores/hintActionsStore'

let scope: EffectScope
const currentKey = ref<string | null>(null)
const view = ref<DecisionView | null>(null)
const openFinding = ref(true)
const editing = {
  edit: vi.fn<DecisionEditing['edit']>(),
  askRevoke: vi.fn<DecisionEditing['askRevoke']>(),
  reconfirm: vi.fn<DecisionEditing['reconfirm']>(async () => {}),
  reconfirming: ref(false),
} as unknown as DecisionEditing
const openFirst = vi.fn<(view: DecisionView) => boolean>(() => true)
const select = vi.fn<(key: string) => void>()

beforeEach(() => {
  setActivePinia(createPinia())
  currentKey.value = groupRowKey(1)
  view.value = { decision: buildDecision(), effective: { state: 'active' }, openFindings: 1 }
  openFinding.value = true
  vi.clearAllMocks()
  scope = effectScope()
  scope.run(() => {
    useDecisionHintActions({
      currentKey,
      decisionOf: () => view.value,
      editing,
      openFirst,
      hasOpenFinding: () => openFinding.value,
      select,
      focusSearch: () => {},
      refocus: async () => {},
    })
  })
})

afterEach(() => {
  scope.stop()
})

describe('useDecisionHintActions', () => {
  it('blocks every decision action without a cursor decision', () => {
    const hints = useHintActionsStore()

    view.value = null

    for (const id of ['openFinding', 'edit', 'revoke', 'reconfirm'] as const) {
      expect(hints.reasonOf(id)).toBe('No decision under the cursor')
    }
  })

  it('runs edit, revoke and open on an active decision and blocks re-confirm', async () => {
    const hints = useHintActionsStore()

    await hints.run('edit')
    await hints.run('revoke')
    await hints.run('openFinding')

    expect(editing.edit).toHaveBeenCalledWith(view.value)
    expect(editing.askRevoke).toHaveBeenCalledWith(view.value)
    expect(openFirst).toHaveBeenCalledWith(view.value)
    expect(hints.reasonOf('reconfirm')).toBe('Only re-opened decisions need re-confirming')
    expect(await hints.run('reconfirm')).toBe(false)
  })

  it('re-confirms a re-opened decision unless one is running', async () => {
    const hints = useHintActionsStore()

    view.value = { ...view.value!, effective: reopenedEffective() }

    expect(await hints.run('reconfirm')).toBe(true)
    expect(editing.reconfirm).toHaveBeenCalledOnce()

    editing.reconfirming.value = true
    expect(hints.reasonOf('reconfirm')).toBe('Re-confirming')
    editing.reconfirming.value = false
  })

  it('blocks edit and revoke on a revoked decision', () => {
    const hints = useHintActionsStore()

    view.value = {
      decision: buildDecision({ revokedAt: '2026-05-02T00:00:00.000Z' }),
      effective: { state: 'revoked', revokedAt: '2026-05-02T00:00:00.000Z' },
      openFindings: 0,
    }

    expect(hints.reasonOf('edit')).toBe('Decision is revoked')
    expect(hints.reasonOf('revoke')).toBe('Decision is revoked')
  })

  it('opens the finding row under the cursor and blocks a decision without open findings', async () => {
    const hints = useHintActionsStore()

    openFinding.value = false
    expect(hints.reasonOf('openFinding')).toBe('No open finding')

    currentKey.value = findingRowKey(7)
    expect(hints.reasonOf('openFinding')).toBeNull()
    await hints.run('openFinding')

    expect(select).toHaveBeenCalledWith(findingRowKey(7))
    expect(openFirst).not.toHaveBeenCalled()
  })
})
