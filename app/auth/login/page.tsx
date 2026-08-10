import Link from "next/link";
import { getRegistrationState } from "@/lib/registration";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const registrationState = await getRegistrationState();

  return (
    <>
      <LoginForm />

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
