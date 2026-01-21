import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const scanReceipt = action({
  args: {
    base64Image: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
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
                  url: `data:${args.mimeType};base64,${args.base64Image}`,
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Failed to extract receipt data");
    }

    try {
      const jsonContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(jsonContent);
    } catch {
      throw new Error("Failed to parse receipt data");
    }
  },
});
