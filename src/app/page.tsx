"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eyebrow, PageContainer, PageHero, PageIntro, PageShell, PageTitle } from "@/components/ui/page-shell";

type Country = {
  id: number;
  name: string;
};

type Region = {
  id: number;
  name: string;
  country_id: number | null;
  countries: { name: string } | null;
};

type Subregion = {
  id: number;
  name: string;
  region_id: number | null;
  regions: { name: string } | null;
};

type Grape = {
  id: number;
  name: string;
};

type LookupItem = {
  id: number;
  label: string;
  detail?: string;
};

type LookupSectionProps = {
  title: string;
  emptyText: string;
  items: LookupItem[];
  onRename: (item: { id: number; label: string }) => Promise<void>;
  onDelete: (item: { id: number; label: string }) => Promise<void>;
};

function LookupSection({ title, emptyText, items, onRename, onDelete }: LookupSectionProps) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () => new Fuse(items, { keys: ["label", "detail"], threshold: 0.35, ignoreLocation: true }),
    [items]
  );

  const filteredItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return items;
    return fuse.search(trimmed).map((result) => result.item);
  }, [fuse, items, query]);

  return (
    <Card className="border-stone-300/80">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        </div>
        <Badge>{String(items.length)}</Badge>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">{emptyText}</p>
      ) : (
        <>
          <div className="mt-4">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
            />
          </div>

          {filteredItems.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">No matches found.</p>
          ) : (
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-stone-900">{item.label}</div>
                    {item.detail ? (
                      <div className="mt-1 text-xs text-stone-500">{item.detail}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onRename(item)}
                      className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [subregions, setSubregions] = useState<Subregion[]>([]);
  const [grapes, setGrapes] = useState<Grape[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    const [countryRes, regionRes, subregionRes, grapeRes] = await Promise.all([
      supabase.from("countries").select("id,name").order("name"),
      supabase.from("regions").select("id,name,country_id,countries(name)").order("name"),
      supabase.from("subregions").select("id,name,region_id,regions(name)").order("name"),
      supabase.from("grapes").select("id,name").order("name"),
    ]);

    if (countryRes.error) return alert(countryRes.error.message);
    if (regionRes.error) return alert(regionRes.error.message);
    if (subregionRes.error) return alert(subregionRes.error.message);
    if (grapeRes.error) return alert(grapeRes.error.message);

    setCountries((countryRes.data as Country[]) ?? []);
    setRegions((regionRes.data as Region[]) ?? []);
    setSubregions((subregionRes.data as Subregion[]) ?? []);
    setGrapes((grapeRes.data as Grape[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const nextEmail = data.user?.email ?? null;
      setEmail(nextEmail);
      if (nextEmail) loadLookups();
    });
  }, [supabase, loadLookups]);

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/` },
    });
    if (error) alert(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEmail(null);
  }

  async function renameCountry(item: { id: number; label: string }) {
    const nextName = prompt("Rename country", item.label)?.trim();
    if (!nextName || nextName === item.label) return;
    setBusyKey(`country-rename-${item.id}`);
    const { error } = await supabase.from("countries").update({ name: nextName }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function deleteCountry(item: { id: number; label: string }) {
    if (!confirm(`Delete country "${item.label}"? Wines using it will revert to NA.`)) return;
    setBusyKey(`country-delete-${item.id}`);

    const regionIds = regions.filter((region) => region.country_id === item.id).map((region) => region.id);
    const subregionIds = subregions
      .filter((subregion) => regionIds.includes(subregion.region_id ?? -1))
      .map((subregion) => subregion.id);

    if (subregionIds.length > 0) {
      const { error } = await supabase
        .from("wines")
        .update({ subregion_id: null })
        .in("subregion_id", subregionIds);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    if (regionIds.length > 0) {
      const { error } = await supabase
        .from("wines")
        .update({ region_id: null })
        .in("region_id", regionIds);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    {
      const { error } = await supabase
        .from("wines")
        .update({ country_id: null })
        .eq("country_id", item.id);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    if (subregionIds.length > 0) {
      const { error } = await supabase.from("subregions").delete().in("id", subregionIds);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    if (regionIds.length > 0) {
      const { error } = await supabase.from("regions").delete().in("id", regionIds);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    const { error } = await supabase.from("countries").delete().eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function renameRegion(item: { id: number; label: string }) {
    const nextName = prompt("Rename region", item.label)?.trim();
    if (!nextName || nextName === item.label) return;
    setBusyKey(`region-rename-${item.id}`);
    const { error } = await supabase.from("regions").update({ name: nextName }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function deleteRegion(item: { id: number; label: string }) {
    if (!confirm(`Delete region "${item.label}"? Wines using it will revert to NA.`)) return;
    setBusyKey(`region-delete-${item.id}`);

    const subregionIds = subregions
      .filter((subregion) => subregion.region_id === item.id)
      .map((subregion) => subregion.id);

    if (subregionIds.length > 0) {
      const { error } = await supabase
        .from("wines")
        .update({ subregion_id: null })
        .in("subregion_id", subregionIds);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    {
      const { error } = await supabase
        .from("wines")
        .update({ region_id: null })
        .eq("region_id", item.id);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    if (subregionIds.length > 0) {
      const { error } = await supabase.from("subregions").delete().in("id", subregionIds);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }

    const { error } = await supabase.from("regions").delete().eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function renameSubregion(item: { id: number; label: string }) {
    const nextName = prompt("Rename sub-region", item.label)?.trim();
    if (!nextName || nextName === item.label) return;
    setBusyKey(`subregion-rename-${item.id}`);
    const { error } = await supabase.from("subregions").update({ name: nextName }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function deleteSubregion(item: { id: number; label: string }) {
    if (!confirm(`Delete sub-region "${item.label}"? Wines using it will revert to NA.`)) return;
    setBusyKey(`subregion-delete-${item.id}`);
    {
      const { error } = await supabase
        .from("wines")
        .update({ subregion_id: null })
        .eq("subregion_id", item.id);
      if (error) {
        setBusyKey(null);
        return alert(error.message);
      }
    }
    const { error } = await supabase.from("subregions").delete().eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function renameGrape(item: { id: number; label: string }) {
    const nextName = prompt("Rename grape", item.label)?.trim();
    if (!nextName || nextName === item.label) return;
    setBusyKey(`grape-rename-${item.id}`);
    const { error } = await supabase.from("grapes").update({ name: nextName }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function deleteGrape(item: { id: number; label: string }) {
    if (!confirm(`Delete grape "${item.label}"? Wines using it will lose that grape.`)) return;
    setBusyKey(`grape-delete-${item.id}`);
    const { error } = await supabase.from("grapes").delete().eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  const countryItems = countries.map((country) => ({
    id: country.id,
    label: country.name,
  }));

  const regionItems = regions.map((region) => ({
    id: region.id,
    label: region.name,
    detail: region.countries?.name ? `Country: ${region.countries.name}` : "Country: NA",
  }));

  const subregionItems = subregions.map((subregion) => ({
    id: subregion.id,
    label: subregion.name,
    detail: subregion.regions?.name ? `Region: ${subregion.regions.name}` : "Region: NA",
  }));

  const grapeItems = grapes.map((grape) => ({
    id: grape.id,
    label: grape.name,
  }));

  return (
    <PageShell>
      <PageContainer>
        <PageHero>
          <Eyebrow>Wine Notes</Eyebrow>
          <PageTitle>Wine Notes</PageTitle>
          <PageIntro>
            Track bottles, tastings, and lookup data in one place.
          </PageIntro>
        </PageHero>

        <section className="mt-8 rounded-[32px] border border-[#d4c3ae] bg-[radial-gradient(circle_at_top,#fffdf8,transparent_38%),linear-gradient(180deg,#fff7ed_0%,#f7ecdf_100%)] p-4">
          <Card className="border-[#e7d8c5] bg-white/75 shadow-[0_24px_70px_rgba(102,60,28,0.12)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge className="mb-3">Dashboard</Badge>
                <CardTitle>Manage your cellar and the lookup tables behind it.</CardTitle>
                <CardDescription className="mt-2 max-w-xl">
                  Browse wines, add new bottles, and keep countries, regions, sub-regions, and grapes tidy.
                </CardDescription>
              </div>
              {busyKey ? (
                <Badge variant="muted" className="bg-amber-100 text-amber-800">Saving...</Badge>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/wines"
                className="inline-flex items-center justify-center rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-800 transition hover:border-stone-500"
              >
                My Wines
              </Link>
              <Link
                href="/wines/new"
                className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
              >
                Add New Wine
              </Link>
            </div>

            {email ? (
              <>
                <div className="mt-6 rounded-[24px] border border-stone-200 bg-white/80 p-4">
                  <p className="text-sm text-stone-600">Signed in as</p>
                  <p className="mt-1 text-base font-semibold text-stone-900">{email}</p>
                </div>

                <div className="mt-6">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl text-stone-900">Manage Knowledges</h3>
                      <p className="mt-1 text-sm text-stone-600">
                        Rename or delete countries, regions, sub-regions, and grapes.
                      </p>
                    </div>
                    <Badge>4 groups</Badge>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <LookupSection
                      title="Countries"
                      emptyText="No countries yet."
                      items={countryItems}
                      onRename={renameCountry}
                      onDelete={deleteCountry}
                    />
                    <LookupSection
                      title="Regions"
                      emptyText="No regions yet."
                      items={regionItems}
                      onRename={renameRegion}
                      onDelete={deleteRegion}
                    />
                    <LookupSection
                      title="Sub-regions"
                      emptyText="No sub-regions yet."
                      items={subregionItems}
                      onRename={renameSubregion}
                      onDelete={deleteSubregion}
                    />
                    <LookupSection
                      title="Grapes"
                      emptyText="No grapes yet."
                      items={grapeItems}
                      onRename={renameGrape}
                      onDelete={deleteGrape}
                    />
                  </div>
                </div>

                <Button type="button" variant="secondary" onClick={signOut} className="mt-6 rounded-full">
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-white/70 p-5">
                <p className="text-sm text-stone-600">Sign in to start saving tasting notes.</p>
                <Button type="button" onClick={signInWithGoogle} className="mt-4">
                  Sign In with Google
                </Button>
              </div>
            )}
          </Card>
        </section>
      </PageContainer>
    </PageShell>
  );
}
