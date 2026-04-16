import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getNextPath(next: string | null) {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
