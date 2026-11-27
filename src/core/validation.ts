import type { ValidationIssue } from '#core/errorApiTypes.ts'

/** Outcome of validating an input: the clean value, or the problems found */
export type Validation<T, E = ValidationIssue> = { ok: true; value: T } | { ok: false; errors: E[] }
