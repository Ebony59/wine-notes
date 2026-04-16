"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/wines", label: "My Wines" },
  { href: "/knowledge", label: "My Knowledge" },
];

export function NavBar() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
      setAuthLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);
      setAuthLoaded(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    location.href = "/";
  }

  async function signIn() {
    const next = `${location.pathname}${location.search}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) alert(error.message);
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/60 bg-white/85 shadow-[0_1px_24px_rgba(88,56,34,0.07)] backdrop-blur-md">
      {/* Main row */}
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="shrink-0 font-serif text-lg text-stone-900 transition hover:text-amber-800"
        >
          Wine Notes
        </Link>

        {/* Desktop nav links */}
        <nav className="ml-4 hidden items-center gap-1 sm:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                isActive(link.href)
                  ? "bg-stone-100 text-stone-900"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side: CTA + auth */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/wines/new"
            className={cn(
              "rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
              pathname === "/wines/new"
                ? "bg-stone-700 text-white"
                : "bg-stone-900 text-stone-50 hover:bg-stone-700"
            )}
          >
            <span className="hidden sm:inline">Add New Wine</span>
            <span className="sm:hidden">+ Add</span>
          </Link>

          {authLoaded && (
            email ? (
              <button
                onClick={signOut}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={signIn}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-800"
              >
                Sign In
              </button>
            )
          )}
        </div>
      </div>

      {/* Mobile-only nav row */}
      <div className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition",
              isActive(link.href)
                ? "bg-stone-100 text-stone-900"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
