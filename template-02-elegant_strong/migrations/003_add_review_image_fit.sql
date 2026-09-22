-- Adds a locked image-fit choice to existing review cards.
-- Review this file in Supabase SQL Editor and run it manually before restarting Flask.
-- Existing review images keep their current full-frame crop through the default value.

BEGIN;

ALTER TABLE public.reviews
    ADD COLUMN client_image_fit VARCHAR(10) NOT NULL DEFAULT 'cover',
    ADD CONSTRAINT ck_reviews_image_fit
        CHECK (client_image_fit IN ('cover', 'contain'));

COMMIT;
