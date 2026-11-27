/**
 * Schema step 21: image_pull_probes caches the anonymous pull probe per image repository,
 * public, restricted or failed with a short reason. decision_proposals.source_access becomes
 * image_access with entries { imageRef, imageVisibility, ownership }: a private entry was an own
 * image, a public one a public third-party image, everything else unknown. checks.source gains
 * refKind and ref: label for a stored commit, else default_branch.
 */
export const MIGRATION_21 = `
  CREATE TABLE image_pull_probes (
    image_ref TEXT PRIMARY KEY CHECK (length(image_ref) BETWEEN 1 AND 300),
    result TEXT NOT NULL CHECK (result IN ('public', 'restricted', 'failed')),
    reason TEXT CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 100),
    probed_at TEXT NOT NULL
  );

  ALTER TABLE decision_proposals RENAME COLUMN source_access TO image_access;

  UPDATE decision_proposals SET image_access = (
    SELECT json_group_array(json_object(
      'imageRef', json_extract(entry.value, '$.imageRef'),
      'imageVisibility',
        CASE json_extract(entry.value, '$.access') WHEN 'public' THEN 'public' ELSE 'unknown' END,
      'ownership',
        CASE json_extract(entry.value, '$.access') WHEN 'private' THEN 'own' ELSE 'third_party' END
    ))
    FROM json_each(decision_proposals.image_access) AS entry
  );

  UPDATE checks SET source = json_set(source,
    '$.refKind', CASE WHEN json_extract(source, '$.revision') IS NULL
      THEN 'default_branch' ELSE 'label' END,
    '$.ref', json('null'))
  WHERE source IS NOT NULL;
`
