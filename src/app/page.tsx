"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type LookupSectionProps = {
  title: string;
  emptyText: string;
  items: { id: number; label: string; detail?: string }[];
  onRename: (item: { id: number; label: string }) => Promise<void>;
  onDelete: (item: { id: number; label: string }) => Promise<void>;
};

function LookupSection({
  title,
  emptyText,
  items,
  onRename,
  onDelete,
}: LookupSectionProps) {
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
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <>
          <div className="mt-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {filteredItems.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No matches found.</p>
          ) : (
            <div className="mt-3 max-h-72 overflow-y-auto divide-y pr-1">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.detail && <div className="text-xs text-gray-500 mt-0.5">{item.detail}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onRename(item)}
                      className="text-xs text-gray-500 underline"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="text-xs text-red-500 underline"
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
    </section>
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const nextEmail = data.user?.email ?? null;
      setEmail(nextEmail);
      if (nextEmail) loadLookups();
    });
  }, [supabase]);

  async function loadLookups() {
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
  }

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
    <main className="min-h-screen max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Wine Notes</h1>

      <div className="mt-6 rounded-xl border p-4">
        {email ? (
          <>
            <p className="text-sm">
              Signed in as: <b>{email}</b>
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href="/wines"
                className="px-4 py-3 rounded-lg border text-center hover:bg-gray-50"
              >
                My Wines
              </a>
              <a
                href="/wines/new"
                className="px-4 py-3 rounded-lg bg-black text-white text-center hover:opacity-90"
              >
                Add new wine
              </a>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Manage Lookups</h2>
                  <p className="text-sm text-gray-500">
                    Rename or delete countries, regions, sub-regions, and grapes.
                  </p>
                </div>
                {busyKey && <span className="text-xs text-gray-400">Saving…</span>}
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

            <button
              onClick={signOut}
              className="mt-6 px-4 py-2 rounded border"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Sign in to start saving tasting notes.
            </p>
            <button
              onClick={signInWithGoogle}
              className="mt-3 px-4 py-2 rounded bg-black text-white"
            >
              Sign in with Google
            </button>
          </>
        )}
      </div>
    </main>
  );
}
