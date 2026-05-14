"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WineCard, groupWinesForCards, type WineCardWine } from "@/components/WineCard";
import { Input } from "@/components/ui/input";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

type Wine = WineCardWine;

type VintageNote = {
  region_id: number;
  year: number;
  notes: string | null;
  regions: { id: number; name: string; countries: { name: string } | null } | null;
};

export default function VintageYearPage() {
  const { year } = useParams<{ year: string }>();
  const yearNum = Number(year);
  const supabase = useMemo(() => createClient(), []);

  const [wines, setWines] = useState<Wine[]>([]);
  const [vintageNotes, setVintageNotes] = useState<VintageNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user?.id) { location.href = "/"; return; }
      loadAll();
    });

    async function loadAll() {
      const [winesRes, notesRes] = await Promise.all([
        supabase
          .from("wines")
          .select("id,name,vintage_year,producer_id,producers(name),countries(name),regions(name),subregions(name)")
          .eq("vintage_year", yearNum)
          .order("name"),
        supabase
          .from("vintages")
          .select("region_id,year,notes,regions(id,name,countries(name))")
          .eq("year", yearNum),
      ]);

      if (winesRes.error) { alert(winesRes.error.message); return; }
      if (notesRes.error) { alert(notesRes.error.message); return; }

      setWines((winesRes.data ?? []) as unknown as Wine[]);
      setVintageNotes((notesRes.data ?? []) as unknown as VintageNote[]);
      setLoading(false);
    }
  }, [supabase, yearNum]);

  const wineGroups = useMemo(() => groupWinesForCards(wines), [wines]);

  const fuse = useMemo(
    () =>
      new Fuse(wineGroups, {
        keys: ["0.name", "0.producers.name", "0.regions.name", "0.countries.name", "0.subregions.name"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [wineGroups]
  );

  const filteredGroups = useMemo(() => {
    const t = search.trim();
    if (!t) return wineGroups;
    return fuse.search(t).map((r) => r.item);
  }, [fuse, search, wineGroups]);

  if (loading) {
    return (
      <PageShell className="py-16">
        <PageContainer className="max-w-3xl">
          <p className="text-sm text-stone-500">Loading…</p>
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContainer className="max-w-3xl pb-16">
        <PageHero>
          <Eyebrow>
            <Link href="/knowledge" className="hover:text-stone-700">My Knowledge</Link>
          </Eyebrow>
          <PageTitle>{yearNum} Vintage</PageTitle>
          {wines.length > 0 && (
            <PageIntro>
              {wines.length} {wines.length === 1 ? "wine" : "wines"} in your cellar
            </PageIntro>
          )}
        </PageHero>

        {/* Vintage notes by region */}
        {vintageNotes.length > 0 && (
          <Card className="mt-8">
            <CardTitle className="text-xl">Vintage Notes</CardTitle>
            <CardDescription className="mt-2">
              Region notes for the {yearNum} vintage from your knowledge base.
            </CardDescription>
            <div className="mt-4 space-y-3">
              {vintageNotes.map((note) => {
                const regionName = note.regions?.name ?? "Unknown region";
                const countryName = note.regions?.countries?.name ?? null;
                const regionId = note.regions?.id ?? note.region_id;
                return (
                  <div
                    key={note.region_id}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4"
                  >
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/knowledge/regions/${regionId}#vintage-notes`}
                        className="text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                      >
                        {regionName}
                      </Link>
                      {countryName && (
                        <span className="text-xs text-stone-400">· {countryName}</span>
                      )}
                    </div>
                    {note.notes ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
                        {note.notes}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">No notes.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Wines */}
        <Card className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">Wines</CardTitle>
          </div>

          {wines.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              No wines from the {yearNum} vintage in your cellar.
            </p>
          ) : (
            <>
              <div className="mt-3">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search wines…"
                />
              </div>
              <div className="mt-3 space-y-2">
                {filteredGroups.length === 0 ? (
                  <p className="text-sm text-stone-500">No wines match your search.</p>
                ) : (
                  filteredGroups.map((group) => (
                    <WineCard key={`${group[0].producer_id ?? "none"}-${group[0].name}`} wines={group} />
                  ))
                )}
              </div>
            </>
          )}
        </Card>
      </PageContainer>
    </PageShell>
  );
}
