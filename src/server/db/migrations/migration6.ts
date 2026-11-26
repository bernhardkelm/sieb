/**
 * Schema step 6: the optional OpenVEX justification of a not_affected decision. Existing rows get
 * NULL, which satisfies both checks, so no data is rewritten.
 */
export const MIGRATION_6 = `
  ALTER TABLE decisions ADD COLUMN justification TEXT
    CHECK (justification IS NULL OR justification IN ('component_not_present',
      'vulnerable_code_not_present', 'vulnerable_code_not_in_execute_path',
      'vulnerable_code_cannot_be_controlled_by_adversary', 'inline_mitigations_already_exist'))
    CHECK (justification IS NULL OR status = 'not_affected');
`
