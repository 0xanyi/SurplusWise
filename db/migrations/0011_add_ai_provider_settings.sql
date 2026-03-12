-- Migration: Add AI provider settings table
-- Created: 2026-03-12

CREATE TABLE IF NOT EXISTS "ai_provider_settings" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "provider" text NOT NULL DEFAULT 'openai',
    "api_endpoint" text NOT NULL DEFAULT 'https://api.openai.com/v1',
    "api_key" text,
    "model" text NOT NULL DEFAULT 'gpt-4o-mini',
    "is_enabled" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone NOT NULL DEFAULT NOW(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_ai_provider_settings_user" ON "ai_provider_settings"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ai_provider_settings_user_unique" ON "ai_provider_settings"("user_id");

-- Add comment
COMMENT ON TABLE "ai_provider_settings" IS 'Stores user AI provider configuration for receipt scanning and other AI features';
