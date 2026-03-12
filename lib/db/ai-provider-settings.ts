import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiProviderSettings } from "@/db/schema";
import {
  userIdSchema,
  aiProviderSettingsSchema,
  aiProviderSettingsUpdateSchema,
} from "./validation";
import type { z } from "zod";

export type AIProvider =
  | "openai"
  | "openrouter"
  | "groq"
  | "together"
  | "ollama"
  | "custom";

export interface AIProviderSettings {
  id: string;
  userId: string;
  provider: AIProvider;
  apiEndpoint: string;
  apiKey: string | null;
  model: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInput {
  provider: AIProvider;
  apiEndpoint: string;
  apiKey?: string;
  model: string;
  isEnabled?: boolean;
}

export interface UpdateInput {
  provider?: AIProvider;
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  isEnabled?: boolean;
}

// Default configurations for popular providers
export const PROVIDER_DEFAULTS: Record<AIProvider, { endpoint: string; models: string[] }> = {
  openai: {
    endpoint: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1",
    models: [
      "meta-llama/llama-3.2-11b-vision-instruct",
      "google/gemma-3-27b-it",
      "qwen/qwen2.5-vl-72b-instruct",
      "anthropic/claude-3-haiku",
    ],
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1",
    models: [
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
      "mixtral-8x7b-32768",
    ],
  },
  together: {
    endpoint: "https://api.together.xyz/v1",
    models: [
      "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      "meta-llama/Llama-Vision-Free",
    ],
  },
  ollama: {
    endpoint: "http://localhost:11434/v1",
    models: ["llava", "llama3.2-vision"],
  },
  custom: {
    endpoint: "",
    models: [],
  },
};

function genId() {
  return crypto.randomUUID();
}

/**
 * Simple encryption for API keys (base64 + basic obfuscation)
 * In production, consider using a proper encryption service like AWS KMS or similar
 */
function encryptApiKey(key: string): string {
  // Simple obfuscation - in production use proper encryption
  const encoded = Buffer.from(key).toString("base64");
  return `enc:${encoded}`;
}

function decryptApiKey(encrypted: string | null): string | null {
  if (!encrypted) return null;
  if (!encrypted.startsWith("enc:")) return encrypted; // legacy plain text
  const encoded = encrypted.slice(4);
  try {
    return Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

export async function getOrCreateSettings(
  userId: string,
): Promise<AIProviderSettings> {
  userIdSchema.parse(userId);

  const existing = await db
    .select()
    .from(aiProviderSettings)
    .where(eq(aiProviderSettings.userId, userId))
    .limit(1);

  if (existing[0]) {
    return {
      ...existing[0],
      apiKey: decryptApiKey(existing[0].apiKey),
    } as AIProviderSettings;
  }

  // Create default settings
  const defaults = PROVIDER_DEFAULTS.openai;
  const now = new Date();

  const [row] = await db
    .insert(aiProviderSettings)
    .values({
      id: genId(),
      userId,
      provider: "openai",
      apiEndpoint: defaults.endpoint,
      apiKey: null,
      model: defaults.models[0],
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ...row,
    apiKey: null,
  } as AIProviderSettings;
}

export async function updateSettings(
  userId: string,
  input: UpdateInput,
): Promise<AIProviderSettings> {
  userIdSchema.parse(userId);
  const validInput = aiProviderSettingsUpdateSchema.parse(input);

  const [existing] = await db
    .select({ id: aiProviderSettings.id })
    .from(aiProviderSettings)
    .where(eq(aiProviderSettings.userId, userId))
    .limit(1);

  if (!existing) {
    // Create with defaults first, then update
    await getOrCreateSettings(userId);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (validInput.provider !== undefined) {
    updateData.provider = validInput.provider;
    // Auto-update endpoint if switching to a known provider
    if (validInput.provider !== "custom" && !validInput.apiEndpoint) {
      updateData.apiEndpoint = PROVIDER_DEFAULTS[validInput.provider].endpoint;
    }
  }
  if (validInput.apiEndpoint !== undefined) {
    updateData.apiEndpoint = validInput.apiEndpoint;
  }
  if (validInput.apiKey !== undefined) {
    updateData.apiKey = validInput.apiKey
      ? encryptApiKey(validInput.apiKey)
      : null;
  }
  if (validInput.model !== undefined) {
    updateData.model = validInput.model;
  }
  if (validInput.isEnabled !== undefined) {
    updateData.isEnabled = validInput.isEnabled;
  }

  const [row] = await db
    .update(aiProviderSettings)
    .set(updateData)
    .where(eq(aiProviderSettings.userId, userId))
    .returning();

  return {
    ...row,
    apiKey: decryptApiKey(row.apiKey),
  } as AIProviderSettings;
}

export async function getActiveSettings(userId: string): Promise<{
  endpoint: string;
  apiKey: string | null;
  model: string;
} | null> {
  const settings = await getOrCreateSettings(userId);

  if (!settings.isEnabled) {
    return null;
  }

  // Fall back to environment variable if no API key is set
  const apiKey = settings.apiKey || process.env.OPENAI_API_KEY || null;

  return {
    endpoint: settings.apiEndpoint,
    apiKey,
    model: settings.model,
  };
}
