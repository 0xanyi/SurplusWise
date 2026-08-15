import Link from "next/link";
import { getRegistrationState } from "@/lib/registration";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const registrationState = await getRegistrationState();
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/dashboard";

  return (
    <>
      <LoginForm callbackUrl={safeCallbackUrl} />

      {registrationState === "available" && (
        <p className="mt-7 text-[13.5px] text-muted-foreground">
          New here?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-brand transition-colors hover:text-foreground"
          >
            Create an account
          </Link>
        </p>
      )}
    </>
  );
}
