import { requireAuth } from "@/lib/auth-server";
import {
  getOrCreateSettings,
  updateSettings,
  PROVIDER_DEFAULTS,
} from "@/lib/db/ai-provider-settings";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function GET() {
  try {
    const userId = await requireAuth();
    const settings = await getOrCreateSettings(userId);

    return NextResponse.json({
      settings: {
        id: settings.id,
        provider: settings.provider,
        apiEndpoint: settings.apiEndpoint,
        // Don't return the actual API key, just whether it's set
        hasApiKey: !!settings.apiKey,
        model: settings.model,
        isEnabled: settings.isEnabled,
      },
      defaults: PROVIDER_DEFAULTS,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch AI provider settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const settings = await updateSettings(userId, {
      provider: body.provider,
      apiEndpoint: body.apiEndpoint,
      apiKey: body.apiKey,
      model: body.model,
      isEnabled: body.isEnabled,
    });

    return NextResponse.json({
      settings: {
        id: settings.id,
        provider: settings.provider,
        apiEndpoint: settings.apiEndpoint,
        hasApiKey: !!settings.apiKey,
        model: settings.model,
        isEnabled: settings.isEnabled,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    console.error("Failed to update AI provider settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
