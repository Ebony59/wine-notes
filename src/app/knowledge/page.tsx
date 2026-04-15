"use client";

import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

// ── Types ──────────────────────────────────────────────────────────────────────

type Country = {
  id: number;
  name: string;
  notes: string | null;
};

type Region = {
  id: number;
  name: string;
  country_id: number | null;
  countries: { name: string } | null;
  notes: string | null;
};

type Subregion = {
  id: number;
  name: string;
  region_id: number | null;
  regions: { name: string } | null;
  notes: string | null;
};

type Grape = {
  id: number;
  name: string;
  notes: string | null;
};

type LookupItem = {
  id: number;
  label: string;
  detail?: string;
  notes?: string | null;
};

type LookupSectionProps = {
  title: string;
  emptyText: string;
  items: LookupItem[];
  onRename: (item: { id: number; label: string }) => Promise<void>;
  onDelete: (item: { id: number; label: string }) => Promise<void>;
  onSaveNote: (item: { id: number }, notes: string) => Promise<void>;
};

// ── LookupSection component ────────────────────────────────────────────────────

function LookupSection({ title, emptyText, items, onRename, onDelete, onSaveNote }: LookupSectionProps) {
  const [query, setQuery] = useState("");
  const [noteEditId, setNoteEditId] = useState<number | null>(null);
  const [noteEditText, setNoteEditText] = useState("");

  const fuse = useMemo(
    () => new Fuse(items, { keys: ["label", "detail"], threshold: 0.35, ignoreLocation: true }),
    [items]
  );

  const filteredItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return items;
    return fuse.search(trimmed).map((result) => result.item);
  }, [fuse, items, query]);

  function openNoteEdit(item: LookupItem) {
    setNoteEditId(item.id);
    setNoteEditText(item.notes ?? "");
  }

  async function commitNote(item: LookupItem) {
    await onSaveNote(item, noteEditText);
    setNoteEditId(null);
  }

  return (
    <Card className="border-stone-300/80">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
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
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-stone-900">{item.label}</div>
                      {item.detail ? (
                        <div className="mt-0.5 text-xs text-stone-500">{item.detail}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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

                  {noteEditId === item.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={3}
                        className="w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
                        placeholder={`Notes about ${item.label}…`}
                        value={noteEditText}
                        onChange={(e) => setNoteEditText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => commitNote(item)}
                          className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white transition hover:bg-stone-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoteEditId(null)}
                          className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:bg-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      {item.notes ? (
                        <p className="text-xs leading-relaxed text-stone-600 whitespace-pre-wrap">{item.notes}</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openNoteEdit(item)}
                        className="mt-1 text-xs text-stone-400 underline underline-offset-2 transition hover:text-stone-600"
                      >
                        {item.notes ? "Edit note" : "+ Add note"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const supabase = useMemo(() => createClient(), []);
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [subregions, setSubregions] = useState<Subregion[]>([]);
  const [grapes, setGrapes] = useState<Grape[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    const [countryRes, regionRes, subregionRes, grapeRes] = await Promise.all([
      supabase.from("countries").select("id,name,notes").order("name"),
      supabase.from("regions").select("id,name,country_id,notes,countries(name)").order("name"),
      supabase.from("subregions").select("id,name,region_id,notes,regions(name)").order("name"),
      supabase.from("grapes").select("id,name,notes").order("name"),
    ]);

    if (countryRes.error) return alert(countryRes.error.message);
    if (regionRes.error) return alert(regionRes.error.message);
    if (subregionRes.error) return alert(subregionRes.error.message);
    if (grapeRes.error) return alert(grapeRes.error.message);

    setCountries((countryRes.data as unknown as Country[]) ?? []);
    setRegions((regionRes.data as unknown as Region[]) ?? []);
    setSubregions((subregionRes.data as unknown as Subregion[]) ?? []);
    setGrapes((grapeRes.data as unknown as Grape[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        location.href = "/";
      } else {
        loadLookups();
      }
    });
  }, [supabase, loadLookups]);

  // ── Mutations ──────────────────────────────────────────────────────────────

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

    const regionIds = regions.filter((r) => r.country_id === item.id).map((r) => r.id);
    const subregionIds = subregions
      .filter((s) => regionIds.includes(s.region_id ?? -1))
      .map((s) => s.id);

    if (subregionIds.length > 0) {
      const { error } = await supabase.from("wines").update({ subregion_id: null }).in("subregion_id", subregionIds);
      if (error) { setBusyKey(null); return alert(error.message); }
    }

    if (regionIds.length > 0) {
      const { error } = await supabase.from("wines").update({ region_id: null }).in("region_id", regionIds);
      if (error) { setBusyKey(null); return alert(error.message); }
    }

    {
      const { error } = await supabase.from("wines").update({ country_id: null }).eq("country_id", item.id);
      if (error) { setBusyKey(null); return alert(error.message); }
    }

    if (subregionIds.length > 0) {
      const { error } = await supabase.from("subregions").delete().in("id", subregionIds);
      if (error) { setBusyKey(null); return alert(error.message); }
    }

    if (regionIds.length > 0) {
      const { error } = await supabase.from("regions").delete().in("id", regionIds);
      if (error) { setBusyKey(null); return alert(error.message); }
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

    const subregionIds = subregions.filter((s) => s.region_id === item.id).map((s) => s.id);

    if (subregionIds.length > 0) {
      const { error } = await supabase.from("wines").update({ subregion_id: null }).in("subregion_id", subregionIds);
      if (error) { setBusyKey(null); return alert(error.message); }
    }

    {
      const { error } = await supabase.from("wines").update({ region_id: null }).eq("region_id", item.id);
      if (error) { setBusyKey(null); return alert(error.message); }
    }

    if (subregionIds.length > 0) {
      const { error } = await supabase.from("subregions").delete().in("id", subregionIds);
      if (error) { setBusyKey(null); return alert(error.message); }
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
      const { error } = await supabase.from("wines").update({ subregion_id: null }).eq("subregion_id", item.id);
      if (error) { setBusyKey(null); return alert(error.message); }
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

  async function saveCountryNote(item: { id: number }, notes: string) {
    setBusyKey(`country-note-${item.id}`);
    const { error } = await supabase.from("countries").update({ notes: notes.trim() || null }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function saveRegionNote(item: { id: number }, notes: string) {
    setBusyKey(`region-note-${item.id}`);
    const { error } = await supabase.from("regions").update({ notes: notes.trim() || null }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function saveSubregionNote(item: { id: number }, notes: string) {
    setBusyKey(`subregion-note-${item.id}`);
    const { error } = await supabase.from("subregions").update({ notes: notes.trim() || null }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function saveGrapeNote(item: { id: number }, notes: string) {
    setBusyKey(`grape-note-${item.id}`);
    const { error } = await supabase.from("grapes").update({ notes: notes.trim() || null }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  // ── Derived items ──────────────────────────────────────────────────────────

  const countryItems = countries.map((c) => ({ id: c.id, label: c.name, notes: c.notes }));
  const regionItems = regions.map((r) => ({
    id: r.id,
    label: r.name,
    detail: r.countries?.name ? `Country: ${r.countries.name}` : "Country: NA",
    notes: r.notes,
  }));
  const subregionItems = subregions.map((s) => ({
    id: s.id,
    label: s.name,
    detail: s.regions?.name ? `Region: ${s.regions.name}` : "Region: NA",
    notes: s.notes,
  }));
  const grapeItems = grapes.map((g) => ({ id: g.id, label: g.name, notes: g.notes }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <PageContainer>
        <PageHero>
          <Eyebrow>Knowledge Base</Eyebrow>
          <PageTitle>My Knowledge</PageTitle>
          <PageIntro>
            Rename or delete countries, regions, sub-regions, and grape varieties.
            Changes apply immediately across all your wine records.
          </PageIntro>
        </PageHero>

        {busyKey && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Saving…
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <LookupSection
            title="Countries"
            emptyText="No countries yet."
            items={countryItems}
            onRename={renameCountry}
            onDelete={deleteCountry}
            onSaveNote={saveCountryNote}
          />
          <LookupSection
            title="Regions"
            emptyText="No regions yet."
            items={regionItems}
            onRename={renameRegion}
            onDelete={deleteRegion}
            onSaveNote={saveRegionNote}
          />
          <LookupSection
            title="Sub-regions"
            emptyText="No sub-regions yet."
            items={subregionItems}
            onRename={renameSubregion}
            onDelete={deleteSubregion}
            onSaveNote={saveSubregionNote}
          />
          <LookupSection
            title="Grapes"
            emptyText="No grapes yet."
            items={grapeItems}
            onRename={renameGrape}
            onDelete={deleteGrape}
            onSaveNote={saveGrapeNote}
          />
        </div>
      </PageContainer>
    </PageShell>
  );
}
