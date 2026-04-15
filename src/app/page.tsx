"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";
import { Wine, PlusCircle, BookOpen, ArrowRight } from "lucide-react";

// ── Action card ────────────────────────────────────────────────────────────────

type ActionCardProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  primary?: boolean;
};

function ActionCard({ href, icon, label, description, primary }: ActionCardProps) {
  if (primary) {
    return (
      <Link
        href={href}
        className="group flex flex-col gap-4 rounded-[28px] bg-stone-900 p-6 text-stone-50 shadow-[0_8px_32px_rgba(30,14,4,0.20)] transition hover:bg-stone-800 hover:shadow-[0_16px_48px_rgba(30,14,4,0.28)]"
      >
        <div className="flex items-start justify-between">
          <span className="rounded-2xl bg-stone-800 p-3 text-stone-300">{icon}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
        <div>
          <div className="text-lg font-semibold">{label}</div>
          <div className="mt-1 text-sm leading-relaxed text-stone-400">{description}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-[28px] border border-stone-200 bg-white/80 p-6 shadow-[0_2px_12px_rgba(88,56,34,0.06)] transition hover:border-stone-300 hover:bg-white hover:shadow-[0_12px_40px_rgba(88,56,34,0.11)]"
    >
      <div className="flex items-start justify-between">
        <span className="rounded-2xl border border-stone-100 bg-stone-50 p-3 text-stone-600">{icon}</span>
        <span className="text-stone-400"><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
      <div>
        <div className="text-lg font-semibold text-stone-900">{label}</div>
        <div className="mt-1 text-sm leading-relaxed text-stone-500">{description}</div>
      </div>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
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

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/` },
    });
    if (error) alert(error.message);
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHero>
          <Eyebrow>Wine Notes</Eyebrow>
          <PageTitle>Your personal wine journal</PageTitle>
          <PageIntro>
            Track bottles, tastings, and the knowledge behind every glass — all in one place.
          </PageIntro>
        </PageHero>

        {/* Action cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href="/wines"
            icon={<Wine className="h-7 w-7" />}
            label="My Wines"
            description="Browse your wine tasting notes"
          />
          <ActionCard
            href="/wines/new"
            icon={<PlusCircle className="h-7 w-7" />}
            label="Add New Wine"
            description="Record a new bottle or capture a fresh tasting note."
            primary
          />
          <ActionCard
            href="/knowledge"
            icon={<BookOpen className="h-7 w-7" />}
            label="My Knowledge"
            description="Manage countries, regions, sub-regions, and grape varieties."
          />
        </div>

        {/* Sign-in prompt for unauthenticated users */}
        {authLoaded && !email && (
          <div className="mt-10 flex flex-col items-start gap-4 rounded-[28px] border border-dashed border-stone-300 bg-white/60 px-6 py-7">
            <div>
              <p className="text-base font-medium text-stone-800">Ready to start?</p>
              <p className="mt-1 text-sm text-stone-500">
                Sign in with Google to save your tasting notes and build your cellar.
              </p>
            </div>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-700"
            >
              {/* Google "G" logo */}
              <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                <path fill="#fff" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                <path fill="#fff" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
                <path fill="#fff" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
              </svg>
              Sign In with Google
            </button>
          </div>
        )}

        {/* Signed-in account strip */}
        {authLoaded && email && (
          <div className="mt-8 flex items-center gap-3 rounded-[20px] border border-stone-200 bg-white/70 px-5 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold uppercase text-stone-600">
              {email[0]}
            </div>
            <p className="text-sm text-stone-600 truncate">{email}</p>
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}
