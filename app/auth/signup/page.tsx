import Link from "next/link";
import { getRegistrationState } from "@/lib/registration";
import { SignupForm } from "./signup-form";
import { getValidInvitation } from "@/lib/db/workspace-members";
import { getSession } from "@/lib/auth-server";
import { AcceptInvitation } from "./accept-invitation";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const invitation = invite ? await getValidInvitation(invite) : null;
  const registrationState = await getRegistrationState();

  if (invitation && invite) {
    const session = await getSession();
    const loginHref = `/auth/login?callbackUrl=${encodeURIComponent(`/auth/signup?invite=${invite}`)}`;
    return (
      <>
        <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Join {invitation.workspaceName}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          Create your Sika identity to join as {invitation.role === "editor" ? "an editor" : "a viewer"}.
        </p>
        {session ? (
          <AcceptInvitation token={invite} />
        ) : (
          <>
            <SignupForm invitation={{ token: invite, email: invitation.email }} />
            <p className="mt-7 text-[13.5px] text-muted-foreground">
              Already have an account?{" "}
              <Link href={loginHref} className="font-medium text-brand hover:underline">
                Sign in to accept
              </Link>
            </p>
          </>
        )}
      </>
    );
  }

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
