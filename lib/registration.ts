import { createHash, timingSafeEqual } from "node:crypto";

export const SETUP_TOKEN_HEADER = "x-sika-setup-token";

export type RegistrationState = "available" | "closed" | "misconfigured";
export type RegistrationDenial = "closed" | "misconfigured" | "invalid-token" | null;

type RegistrationRequest = {
  accountExists: boolean;
  configuredToken: string | undefined;
  suppliedToken: string | null | undefined;
};

function tokensMatch(configuredToken: string, suppliedToken: string): boolean {
  const configuredDigest = createHash("sha256").update(configuredToken).digest();
  const suppliedDigest = createHash("sha256").update(suppliedToken).digest();
  return timingSafeEqual(configuredDigest, suppliedDigest);
}

export function getRegistrationDenial({
  accountExists,
  configuredToken,
  suppliedToken,
}: RegistrationRequest): RegistrationDenial {
  if (accountExists) return "closed";
  if (!configuredToken) return "misconfigured";
  if (!suppliedToken || !tokensMatch(configuredToken, suppliedToken)) {
    return "invalid-token";
  }
  return null;
}

export async function hasRegisteredUser(): Promise<boolean> {
  const [{ db }, { users }] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
  ]);
  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  return Boolean(user);
}

export async function getRegistrationState(): Promise<RegistrationState> {
  if (await hasRegisteredUser()) return "closed";
  return process.env.SIKA_SETUP_TOKEN ? "available" : "misconfigured";
}
