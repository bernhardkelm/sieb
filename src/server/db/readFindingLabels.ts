import type { DatabaseSync } from 'node:sqlite'

import type { LabelsResponse } from '#core/apiTypes.ts'
import { summarizeFindingLabels } from '#core/findingLabels.ts'
import { listOpenFindings } from '#server/db/findingRepository.ts'

/**
 * Reads which optional labels the stored open findings carry.
 * @param {DatabaseSync} db - Open database
 * @returns {Pick<LabelsResponse, 'exposure' | 'owners'>} - Exposure presence and distinct owners
 */
export const readFindingLabels = (db: DatabaseSync): Pick<LabelsResponse, 'exposure' | 'owners'> =>
  summarizeFindingLabels(listOpenFindings(db))
