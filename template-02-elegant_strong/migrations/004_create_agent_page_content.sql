-- Agents Page CMS foundation for PostgreSQL / Supabase.
-- Review this file in Supabase SQL Editor before running it manually.
-- It does not modify the public Agents page or create a Storage bucket.

BEGIN;

CREATE TABLE public.agent_page_content (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    hero JSONB NOT NULL,
    spotlight JSONB NOT NULL,
    application JSONB NOT NULL,
    resources JSONB NOT NULL,
    final_cta JSONB NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT ck_agent_page_content_singleton CHECK (id = 1),
    CONSTRAINT ck_agent_page_content_hero_object CHECK (jsonb_typeof(hero) = 'object'),
    CONSTRAINT ck_agent_page_content_spotlight_object CHECK (jsonb_typeof(spotlight) = 'object'),
    CONSTRAINT ck_agent_page_content_application_object CHECK (jsonb_typeof(application) = 'object'),
    CONSTRAINT ck_agent_page_content_resources_object CHECK (jsonb_typeof(resources) = 'object'),
    CONSTRAINT ck_agent_page_content_final_cta_object CHECK (jsonb_typeof(final_cta) = 'object')
);

INSERT INTO public.agent_page_content (
    id,
    schema_version,
    hero,
    spotlight,
    application,
    resources,
    final_cta
)
VALUES (
    1,
    1,
    '{
        "eyebrow": "For Real Estate Agents",
        "heading": "A Mentor for Your Next Chapter.",
        "description": "Real estate is more than a career—it is a journey. I mentor agents with the tools, guidance, and support to build a business they are proud of and a life they love.",
        "benefits": ["One-on-one mentorship", "Actionable strategies", "A supportive community"],
        "media": null
    }'::jsonb,
    '{
        "heading": "She truly invests in her agents.",
        "quote": "Stephanie has been an incredible mentor. Her guidance, encouragement, and industry knowledge have given me the confidence to grow my business and better serve my clients.",
        "agentName": "Marissa R.",
        "attribution": "Real Estate Agent",
        "rating": 5,
        "image": null
    }'::jsonb,
    '{
        "heading": "Let''s build what''s next.",
        "description": "Your next chapter in real estate starts with a conversation.",
        "benefits": ["Mentorship", "Collaboration", "Growth opportunities"]
    }'::jsonb,
    '{
        "heading": "Insights for Your Next Chapter.",
        "filterType": "category",
        "filterValue": "recruiting",
        "articleCount": 3
    }'::jsonb,
    '{
        "heading": "You don''t have to do it alone.",
        "button": {"label": "Let''s Talk", "href": "#agent-application"},
        "image": null
    }'::jsonb
);

-- Flask remains the database access layer. No anon/authenticated Data API
-- policies are created for Agents Page content.
ALTER TABLE public.agent_page_content ENABLE ROW LEVEL SECURITY;

COMMIT;
