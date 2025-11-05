import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    // Initialize OpenAI client lazily to avoid build-time errors
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });

    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type;

    // Use OpenAI Vision to extract receipt data
    const response = await openai.chat.completions.create({
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
  "category": <suggested category from: Groceries, Transport, Utilities, Entertainment, Healthcare, Shopping, Dining, Education, Housing, Other>,
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
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Failed to extract receipt data" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let receiptData;
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      receiptData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      return NextResponse.json(
        { error: "Failed to parse receipt data", rawResponse: content },
        { status: 500 }
      );
    }

    // Upload file to Supabase Storage
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload receipt image" },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName);

    return NextResponse.json({
      ...receiptData,
      receiptUrl: urlData.publicUrl,
      fileName: uploadData.path,
    });
  } catch (error: any) {
    console.error("Receipt scanning error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to scan receipt" },
      { status: 500 }
    );
  }
}
