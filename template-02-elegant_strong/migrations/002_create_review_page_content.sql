-- Reviews Page CMS foundation for PostgreSQL / Supabase.
-- Review this file in Supabase SQL Editor before running it manually.
-- It preserves all existing reviews and does not create a Storage bucket.

BEGIN;

ALTER TABLE public.reviews
    ADD COLUMN client_image_path TEXT NULL,
    ADD COLUMN client_image_focal_x SMALLINT NOT NULL DEFAULT 50,
    ADD COLUMN client_image_focal_y SMALLINT NOT NULL DEFAULT 50,
    ADD CONSTRAINT ck_reviews_image_focal_x_range
        CHECK (client_image_focal_x BETWEEN 0 AND 100),
    ADD CONSTRAINT ck_reviews_image_focal_y_range
        CHECK (client_image_focal_y BETWEEN 0 AND 100);

CREATE TABLE public.review_page_content (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    hero JSONB NOT NULL,
    about JSONB NOT NULL,
    featured_story JSONB NOT NULL,
    featured_review_id INTEGER NULL,
    final_cta JSONB NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT ck_review_page_content_singleton CHECK (id = 1),
    CONSTRAINT ck_review_page_content_hero_object CHECK (jsonb_typeof(hero) = 'object'),
    CONSTRAINT ck_review_page_content_about_object CHECK (jsonb_typeof(about) = 'object'),
    CONSTRAINT ck_review_page_content_featured_story_object CHECK (jsonb_typeof(featured_story) = 'object'),
    CONSTRAINT ck_review_page_content_final_cta_object CHECK (jsonb_typeof(final_cta) = 'object'),
    CONSTRAINT fk_review_page_content_featured_review
        FOREIGN KEY (featured_review_id)
        REFERENCES public.reviews(id)
        ON DELETE SET NULL
);

INSERT INTO public.review_page_content (
    id,
    schema_version,
    hero,
    about,
    featured_story,
    featured_review_id,
    final_cta
)
VALUES (
    1,
    1,
    '{
        "eyebrow": "Client stories",
        "titleLine1": "A partner in",
        "titleEmphasis": "your next chapter.",
        "description": "Buying, selling, or investing—every move deserves clear guidance, genuine care, and a trusted advocate by your side.",
        "cta": {"label": "Let''s Connect", "href": "/#contact"},
        "values": [
            {"title": "Local", "subtitle": "Expertise"},
            {"title": "Client-first", "subtitle": "Approach"},
            {"title": "Lasting", "subtitle": "Relationships"}
        ],
        "reelUrl": "https://www.instagram.com/reel/DZoKC98JdbR/"
    }'::jsonb,
    '{
        "eyebrow": "About Stephanie",
        "titleLine1": "Helping You Find",
        "titleLine2": "More Than a House",
        "body": "I''m Stephanie Mendoza, a local realtor that is warm but authorative with a passion for helping individuals and families find the right place to call home. Whether you''re buying, selling, or just exploring your options, I''m here to make the process clear, simple, and even exciting.",
        "values": [
            {"title": "Local", "subtitle": "Expertise"},
            {"title": "Client-first", "subtitle": "Approach"},
            {"title": "Trusted", "subtitle": "Guidance"},
            {"title": "Lasting", "subtitle": "Relationships"}
        ],
        "cta": {"label": "Get to Know Me", "href": "/#about"},
        "image": null
    }'::jsonb,
    '{
        "eyebrow": "Featured story",
        "titleLine1": "A Client Who",
        "titleLine2": "Became a Friend",
        "image": null
    }'::jsonb,
    NULL,
    '{
        "eyebrow": "Ready for what''s next?",
        "title": "Let''s Make It Happen Together.",
        "cta": {"label": "Contact Me", "href": "/#contact"},
        "image": null
    }'::jsonb
);

-- Flask remains the database access layer. No anon/authenticated Data API
-- policies are created for page-editor content.
ALTER TABLE public.review_page_content ENABLE ROW LEVEL SECURITY;

COMMIT;
