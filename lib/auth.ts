import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

const publicOrigin = process.env.PUBLIC_URL
  ? new URL(process.env.PUBLIC_URL).origin
  : undefined;

export const auth = betterAuth({
  baseURL: publicOrigin ?? process.env.NEXT_PUBLIC_SITE_URL,
  trustedOrigins: publicOrigin ? [publicOrigin] : undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  plugins: [nextCookies()],
});
