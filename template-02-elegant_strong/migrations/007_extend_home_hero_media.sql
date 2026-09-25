-- Home Page Hero managed-video extension for PostgreSQL / Supabase.
-- Review this file in Supabase SQL Editor and run it manually.
-- It preserves the current image, all Hero text, and every other Home section.

BEGIN;

UPDATE public.home_page_content
SET
    hero = hero || jsonb_build_object(
        'mediaType', 'image',
        'video', NULL,
        'videoPoster', NULL
    ),
    schema_version = 2,
    updated_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
WHERE id = 1
  AND schema_version < 2;

COMMIT;
