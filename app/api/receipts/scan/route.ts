import { isAuthenticated } from "@/lib/auth-server";
import { uploadReceipt } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ---------------------------------------------------------------------------
// Magic-byte signatures for allowed image formats
// ---------------------------------------------------------------------------

/** Check the first bytes of a buffer to verify the actual image format. */
function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }

  // GIF: 47 49 46 38
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return "image/gif";
  }

  // WebP: RIFF....WEBP  (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

// ---------------------------------------------------------------------------
// OpenAI Vision – receipt OCR
// ---------------------------------------------------------------------------

async function extractReceiptData(
  base64Image: string,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this receipt image and extract the following information in JSON format:
{
  "amount": <total amount as a number>,
  "date": <date in YYYY-MM-DD format, if not visible use today's date>,
  "vendor": <merchant/vendor name>,
  "category": <suggested category from: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Personal Care, Other>,
  "items": [<list of items if visible>]
}

Only return valid JSON, no additional text.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to call OpenAI API");
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Failed to extract receipt data");
  }

  const jsonContent = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(jsonContent) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse receipt data");
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Auth check -----------------------------------------------------------
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse & validate file ------------------------------------------------
    const formData = await request.formData();
    const file = formData.get("file");

    // Runtime guard: ensure the value is an actual File (not a string etc.)
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: JPG, PNG, WebP, GIF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic-byte verification – prevents MIME spoofing ---------------------
    const detectedMime = detectImageMime(buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
      return NextResponse.json(
        {
          error:
            "File content does not match an allowed image format (JPG, PNG, WebP, GIF).",
        },
        { status: 400 },
      );
    }

    // OCR extraction -------------------------------------------------------
    const base64Image = buffer.toString("base64");
    const receiptData = await extractReceiptData(base64Image, detectedMime);

    // Upload to S3-compatible storage --------------------------------------
    const { key, url } = await uploadReceipt(buffer, detectedMime);

    // Return stable response shape -----------------------------------------
    return NextResponse.json({
      ...receiptData,
      storageId: key,
      receiptUrl: url,
    });
  } catch (error: unknown) {
    // Log full detail server-side; return generic message to client
    console.error("Receipt scanning error:", error);
    return NextResponse.json(
      { error: "Failed to process receipt. Please try again." },
      { status: 500 },
    );
  }
}
