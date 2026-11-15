import { NextResponse, type NextRequest } from "next/server";

import { callApi } from "@/lib/api/fetch";
import { forwardedFor } from "@/lib/forwarded-for";
import { sessionFromTokens, writeSession, type TokenPair } from "@/lib/session";

/**
 * The end of a signup on the website: a one-time code becomes a session here.
 *
 * The website is a separate, static site and cannot set this app's cookies,
 * so after the password step it sends the browser to
 * `/auth/handoff?code=…`. The code works once, for two minutes; the API
 * swaps it for a token pair, which is written as the session cookie exactly
 * as a password sign-in writes it. Then on to paying.
 *
 * A dead code is not an error page: the account exists either way, so the
 * person is sent to sign in with the password they just chose.
 */
/**
 * A redirect to a path on this app, with a relative `Location`.
 *
 * `NextResponse.redirect` needs an absolute URL, and the one a route handler
 * can build is the server's own bind address — `http://0.0.0.0:3000` behind
 * `next dev --hostname 0.0.0.0` — which no browser can open. A relative
 * location is resolved by the browser against the address it actually used.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code") ?? "";

  let tokens: TokenPair | null = null;
  if (code) {
    try {
      tokens = await callApi<TokenPair>("/public/signup/handoff", {
        method: "POST",
        body: { code },
        headers: forwardedFor(request.headers),
      });
    } catch {
      tokens = null;
    }
  }

  if (!tokens) return redirectTo("/login?handoff=failed");

  const response = redirectTo("/get-started");
  writeSession(
    {
      set: (options) => response.cookies.set(options),
      delete: (name) => response.cookies.delete(name),
    },
    sessionFromTokens(tokens),
  );
  return response;
}
