import Link from "next/link";
import { SikaLogo } from "@/components/sika-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[352px]">
          <Link href="/" className="mb-11 inline-flex">
            <SikaLogo />
          </Link>
          {children}
        </div>
      </div>

      {/* Marketing panel. Hidden on small screens, where the form is the page. */}
      <div className="hidden flex-col justify-end bg-hero p-14 lg:flex">
        <p className="max-w-[16ch] font-display text-[34px] font-semibold leading-[1.15] tracking-[-0.03em] text-hero-ink">
          Three years of records you can still sit down and read.
        </p>
        <p className="mt-6 max-w-[40ch] text-sm text-hero-muted">
          Sika is Twi for money. It stays on your server, and it stays legible.
        </p>
      </div>
    </main>
  );
}
