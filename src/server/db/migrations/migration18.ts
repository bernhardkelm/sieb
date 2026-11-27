/**
 * Schema step 18: checks.pulled_images holds the images the worker reports it exported as a JSON
 * array of { digest, tag }, primary first. Existing rows keep NULL and read their pulled_digest
 * as a single image without tag.
 */
export const MIGRATION_18 = `
  ALTER TABLE checks ADD COLUMN pulled_images TEXT
    CHECK (pulled_images IS NULL OR json_valid(pulled_images));
`
