import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  getRegistrationDenial,
  hasRegisteredUser,
  INVITATION_TOKEN_HEADER,
  SETUP_TOKEN_HEADER,
} from "@/lib/registration";
import * as workspaceMembers from "@/lib/db/workspace-members";

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

      const accountExists = await hasRegisteredUser();
      if (accountExists) {
        const invitationToken = ctx.headers?.get(INVITATION_TOKEN_HEADER) ?? "";
        const invitation = await workspaceMembers.getValidInvitation(invitationToken);
        const email = typeof ctx.body?.email === "string"
          ? ctx.body.email.trim().toLowerCase()
          : "";
        if (!invitation || invitation.email !== email) {
          throw new APIError("FORBIDDEN", {
            code: "INVALID_INVITATION",
            message: "This invitation is invalid or has expired.",
          });
        }
        return;
      }

      const denial = getRegistrationDenial({
        accountExists,
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
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const invitationToken = ctx.headers?.get(INVITATION_TOKEN_HEADER);
      const user = ctx.context.newSession?.user;
      if (!invitationToken || !user) return;
      await workspaceMembers.acceptInvitation(invitationToken, user.id, user.email);
    }),
  },
  plugins: [nextCookies()],
});
