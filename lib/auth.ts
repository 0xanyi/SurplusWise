import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  getRegistrationDenial,
  hasRegisteredUser,
  SETUP_TOKEN_HEADER,
} from "@/lib/registration";

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
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const denial = getRegistrationDenial({
        accountExists: await hasRegisteredUser(),
        configuredToken: process.env.SIKA_SETUP_TOKEN,
        suppliedToken: ctx.headers?.get(SETUP_TOKEN_HEADER),
      });

      if (denial === "closed") {
        throw new APIError("FORBIDDEN", {
          code: "REGISTRATION_CLOSED",
          message: "This Sika instance has already been set up.",
        });
      }

      if (denial === "misconfigured") {
        throw new APIError("SERVICE_UNAVAILABLE", {
          code: "SETUP_TOKEN_NOT_CONFIGURED",
          message: "Instance setup is unavailable. Ask the server operator to configure SIKA_SETUP_TOKEN.",
        });
      }

      if (denial === "invalid-token") {
        throw new APIError("FORBIDDEN", {
          code: "INVALID_SETUP_TOKEN",
          message: "The setup token is invalid.",
        });
      }
    }),
  },
  plugins: [nextCookies()],
});
