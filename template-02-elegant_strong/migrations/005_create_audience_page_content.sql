-- Buyers and Sellers Page CMS foundation for PostgreSQL / Supabase.
-- Review this file in Supabase SQL Editor before running it manually.
-- It creates content records only; it does not change public rendering or create Storage objects.

BEGIN;

CREATE TABLE public.audience_page_content (
    id SMALLINT PRIMARY KEY,
    page_type VARCHAR(20) NOT NULL UNIQUE,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    hero JSONB NOT NULL,
    guide JSONB NOT NULL,
    form_intro JSONB NOT NULL,
    resources JSONB NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT ck_audience_page_content_page_type CHECK (page_type IN ('buyers', 'sellers')),
    CONSTRAINT ck_audience_page_content_hero_object CHECK (jsonb_typeof(hero) = 'object'),
    CONSTRAINT ck_audience_page_content_guide_object CHECK (jsonb_typeof(guide) = 'object'),
    CONSTRAINT ck_audience_page_content_form_intro_object CHECK (jsonb_typeof(form_intro) = 'object'),
    CONSTRAINT ck_audience_page_content_resources_object CHECK (jsonb_typeof(resources) = 'object')
);

INSERT INTO public.audience_page_content (
    id, page_type, schema_version, hero, guide, form_intro, resources
)
VALUES
(
    1,
    'buyers',
    1,
    '{
        "eyebrow": "For Home Buyers",
        "heading": "Your Next Chapter Starts Here.",
        "description": "Buying a home is a big step, and you don’t have to do it alone. Stephanie will guide you through every step with clarity, strategy, and personalized support so you can move forward with confidence.",
        "benefits": ["Expert Guidance", "Local Insights", "Ongoing Support"],
        "image": null
    }'::jsonb,
    '{
        "eyebrow": "Free Resource",
        "heading": "The Home Buyer''s Guide",
        "description": "Get expert insights, step-by-step guidance, and practical tips to help you feel prepared and confident throughout your home-buying journey.",
        "image": null,
        "cardTitle": "The Complete Home Buyer''s Guide",
        "cardSummary": "Everything you need to know before buying your next home—from financing to closing, all in one comprehensive guide.",
        "pdf": null
    }'::jsonb,
    '{
        "eyebrow": "Interested in taking the next step?",
        "heading": "Let''s Talk About Your Home Goals",
        "description": "Fill out the form and Stephanie will be in touch to learn more about your goals and how she can help with your next move."
    }'::jsonb,
    '{
        "heading": "Helpful Resources for Buyers",
        "filterType": "tag",
        "filterValue": "buyers",
        "articleCount": 3
    }'::jsonb
),
(
    2,
    'sellers',
    1,
    '{
        "eyebrow": "For Home Sellers",
        "heading": "Your Best Move Starts with a Strong Strategy.",
        "description": "Selling your home is a meaningful decision. Stephanie brings thoughtful preparation, local market knowledge, and a personalized strategy designed to help you move forward with clarity and confidence.",
        "benefits": ["Thoughtful Preparation", "Market Strategy", "Ongoing Support"],
        "image": null
    }'::jsonb,
    '{
        "eyebrow": "Free Resource",
        "heading": "The Home Seller''s Guide",
        "description": "Get expert insights, step-by-step guidance, and practical tips to help you feel prepared and confident throughout your home-selling journey.",
        "image": null,
        "cardTitle": "The Complete Home Seller''s Guide",
        "cardSummary": "Everything you need to know before selling your home—from thoughtful preparation and pricing to marketing and closing, all in one comprehensive guide.",
        "pdf": null
    }'::jsonb,
    '{
        "eyebrow": "Interested in taking the next step?",
        "heading": "Let''s Talk About Your Home Goals",
        "description": "Fill out the form and Stephanie will be in touch to learn more about your goals and how she can help with your next move."
    }'::jsonb,
    '{
        "heading": "Helpful Resources for Sellers",
        "filterType": "tag",
        "filterValue": "sellers",
        "articleCount": 3
    }'::jsonb
);

-- Flask remains the database access layer. No direct anon/authenticated Data API
-- policies are created for Buyers or Sellers page-editor content.
ALTER TABLE public.audience_page_content ENABLE ROW LEVEL SECURITY;

COMMIT;
