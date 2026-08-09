import Link from "next/link";
import { getRegistrationState } from "@/lib/registration";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const registrationState = await getRegistrationState();

  if (registrationState === "closed") {
    return (
      <>
        <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Setup complete
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          This Sika instance already has an account. Registration is closed.
        </p>
        <p className="mt-7 text-[13.5px] text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-brand hover:underline">
            Sign in to Sika
          </Link>
        </p>
      </>
    );
  }

  if (registrationState === "misconfigured") {
    return (
      <>
        <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Setup unavailable
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          Ask the server operator to configure <code>SIKA_SETUP_TOKEN</code>, then reload this page.
        </p>
        <p className="mt-7 text-[13.5px] text-muted-foreground">
          Already set up?{" "}
          <Link href="/auth/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
        Set up Sika
      </h1>
      <p className="mt-2.5 text-sm text-muted-foreground">
        Create the only account for this Sika instance.
      </p>
      <SignupForm />

      <p className="mt-7 text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
