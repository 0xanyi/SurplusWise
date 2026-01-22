import { isAuthenticated, fetchAuthAction, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type;

    const receiptData = await fetchAuthAction(api.receipts.scanReceipt, {
      base64Image,
      mimeType,
    });

    const uploadUrl = await fetchAuthMutation(api.receipts.generateUploadUrl, {});

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: "Failed to upload receipt image" },
        { status: 500 }
      );
    }

    const { storageId } = await uploadResponse.json();

    return NextResponse.json({
      ...receiptData,
      storageId,
      receiptUrl: storageId,
    });
  } catch (error: unknown) {
    console.error("Receipt scanning error:", error);
    const message = error instanceof Error ? error.message : "Failed to scan receipt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
