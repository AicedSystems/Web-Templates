-- Home Page CMS foundation for PostgreSQL / Supabase.
-- Review this file in Supabase SQL Editor before running it manually.
-- It does not change public rendering, existing content tables, or Storage objects.

BEGIN;

CREATE TABLE public.home_page_content (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    hero JSONB NOT NULL,
    blog JSONB NOT NULL,
    service_directory JSONB NOT NULL,
    clients JSONB NOT NULL,
    about JSONB NOT NULL,
    agents JSONB NOT NULL,
    reviews JSONB NOT NULL,
    final_cta JSONB NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    CONSTRAINT ck_home_page_content_singleton CHECK (id = 1),
    CONSTRAINT ck_home_page_content_hero_object CHECK (jsonb_typeof(hero) = 'object'),
    CONSTRAINT ck_home_page_content_blog_object CHECK (jsonb_typeof(blog) = 'object'),
    CONSTRAINT ck_home_page_content_service_directory_object CHECK (jsonb_typeof(service_directory) = 'object'),
    CONSTRAINT ck_home_page_content_clients_object CHECK (jsonb_typeof(clients) = 'object'),
    CONSTRAINT ck_home_page_content_about_object CHECK (jsonb_typeof(about) = 'object'),
    CONSTRAINT ck_home_page_content_agents_object CHECK (jsonb_typeof(agents) = 'object'),
    CONSTRAINT ck_home_page_content_reviews_object CHECK (jsonb_typeof(reviews) = 'object'),
    CONSTRAINT ck_home_page_content_final_cta_object CHECK (jsonb_typeof(final_cta) = 'object')
);

INSERT INTO public.home_page_content (
    id, schema_version, hero, blog, service_directory, clients, about, agents, reviews, final_cta
)
VALUES (
    1,
    1,
    '{
        "eyebrow": "Real estate. Real connections. Real results.",
        "headingLine1": "Guiding clients forward.",
        "headingLine2": "Empowering agents to grow.",
        "description": "Helping buyers and sellers make confident moves throughout the Antelope Valley while mentoring agents to build the business and life they deserve.",
        "image": null
    }'::jsonb,
    '{
        "previewLabel": "From the Blog",
        "eyebrow": "From the Blog",
        "heading": "Latest insights",
        "filterType": "all",
        "filterValue": null,
        "articleCount": 3
    }'::jsonb,
    '{
        "items": [
            {"heading": "For Buyers or Sellers", "description": "Buying, selling, and everything in between. I''m here for you."},
            {"heading": "About Stephanie", "description": "Your realtor. Your mentor. Your advocate."},
            {"heading": "For Agents", "description": "Mentorship, training, and support to help you build and grow."}
        ]
    }'::jsonb,
    '{
        "eyebrow": "For Buyers or Sellers",
        "headingLine1": "Buy with clarity.",
        "headingLine2": "Sell with confidence.",
        "description": "Whether you''re buying your first home, upgrading, downsizing, or selling a property you''ve outgrown, I provide expert guidance and a seamless experience from start to finish.",
        "serviceArea": "Proudly serving the Antelope Valley & surrounding areas",
        "serviceLabels": ["Buying a Home", "Selling a Home"],
        "image": null
    }'::jsonb,
    '{
        "eyebrow": "About / Stephanie",
        "heading": "Guidance grounded in real connection.",
        "description": "Stephanie helps clients move forward with clarity while supporting agents as they build confident, sustainable businesses. Replace this short biography with the realtor''s approved story before launch.",
        "buttonLabel": "Read Client Stories",
        "image": null
    }'::jsonb,
    '{
        "eyebrow": "For Agents",
        "headingLine1": "Build more than a business.",
        "headingLine2": "Build something that''s yours.",
        "description": "Through mentorship, training, and a supportive community, I help agents grow their skills, strengthen their confidence, and create the freedom they''re working for.",
        "buttonLabel": "Explore Mentorship",
        "benefits": [
            {"heading": "Mentorship", "description": "One-on-one guidance from someone who''s been there."},
            {"heading": "Training", "description": "Practical tools and strategies to sharpen your skills."},
            {"heading": "Community", "description": "A network of motivated agents who support each other."},
            {"heading": "Growth", "description": "Build a business and a life you''re proud of."}
        ],
        "image": null
    }'::jsonb,
    '{
        "eyebrow": "Kind Words",
        "heading": "What clients are saying",
        "linkLabel": "Read More Reviews"
    }'::jsonb,
    '{
        "eyebrow": "Ready When You Are",
        "heading": "Let''s create your next chapter.",
        "description": "Whether you''re buying, selling, or ready to grow your business—I''d love to help.",
        "buttonLabel": "Let''s Connect"
    }'::jsonb
);

-- Flask remains the database access layer. No direct anon/authenticated Data API
-- policies are created for Home Page editor content.
ALTER TABLE public.home_page_content ENABLE ROW LEVEL SECURITY;

COMMIT;
