import { z } from 'zod'

export const exposureNoteSchema = z
  .string()
  .nullable()
  .describe(
    'meaning of the exposure tiers in this result plus what exposure does not cover, null when nothing carries an exposure label',
  )
