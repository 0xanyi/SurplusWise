import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.openai.com https://openrouter.ai https://api.groq.com https://api.together.xyz https://api.endpoints.anyscale.com http://localhost:11434 https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isTrustedOrigin(origin: string, request: NextRequest) {
  const trustedOrigins = new Set([request.nextUrl.origin]);

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    trustedOrigins.add(process.env.NEXT_PUBLIC_SITE_URL);
  }

  return trustedOrigins.has(origin);
}

function getRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;

  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method)) {
    const hasCookies = request.headers.has("cookie");

    if (hasCookies) {
      const requestOrigin = getRequestOrigin(request);

      if (!requestOrigin || !isTrustedOrigin(requestOrigin, request)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const response = NextResponse.next();

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
