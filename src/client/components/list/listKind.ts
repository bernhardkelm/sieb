import type { InjectionKey } from 'vue'

/** ARIA pattern of a dense list: flat rows to pick from, or group rows expanding into nested rows */
export type ListKind = 'listbox' | 'treegrid'

export const LIST_KIND: InjectionKey<ListKind> = Symbol('listKind')
