-- Persistent presentation controls for article featured images.
-- Review in Supabase SQL Editor and run manually before deploying the matching application code.
BEGIN;

ALTER TABLE public.posts
    ADD COLUMN featured_image_focal_x SMALLINT NOT NULL DEFAULT 50,
    ADD COLUMN featured_image_focal_y SMALLINT NOT NULL DEFAULT 50,
    ADD COLUMN featured_image_fit VARCHAR(10) NOT NULL DEFAULT 'cover',
    ADD COLUMN featured_image_zoom SMALLINT NOT NULL DEFAULT 100,
    ADD CONSTRAINT ck_posts_featured_image_focal_x_range
        CHECK (featured_image_focal_x BETWEEN 0 AND 100),
    ADD CONSTRAINT ck_posts_featured_image_focal_y_range
        CHECK (featured_image_focal_y BETWEEN 0 AND 100),
    ADD CONSTRAINT ck_posts_featured_image_fit
        CHECK (featured_image_fit IN ('cover', 'contain')),
    ADD CONSTRAINT ck_posts_featured_image_zoom_range
        CHECK (featured_image_zoom BETWEEN 100 AND 150 AND featured_image_zoom % 5 = 0);

COMMIT;
