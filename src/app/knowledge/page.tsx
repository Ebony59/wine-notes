"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SearchableSelect from "@/components/SearchableSelect";
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

type Producer = {
  id: number;
  name: string;
  region_id: number | null;
  regions: { name: string } | null;
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
  getItemHref?: (item: LookupItem) => string;
  onAdd?: (name: string) => Promise<void>;
  addExtra?: (name: string) => React.ReactNode;
};

type ProducerGroup = {
  label: string;
  items: Producer[];
};

type ProducerKnowledgeCardProps = {
  producers: Producer[];
  groups: ProducerGroup[];
  regionsById: Map<number, Region>;
  onRename: (item: { id: number; label: string }) => Promise<void>;
  onDelete: (item: { id: number; label: string }) => Promise<void>;
  onSaveNote: (item: { id: number }, notes: string) => Promise<void>;
  onReassignRegion: (item: Producer) => void;
  onAdd: (name: string) => Promise<void>;
  addExtra: () => React.ReactNode;
};

// ── LookupSection component ────────────────────────────────────────────────────

function LookupSection({ title, emptyText, items, onRename, onDelete, onSaveNote, getItemHref, onAdd, addExtra }: LookupSectionProps) {
  const [query, setQuery] = useState("");
  const [noteEditId, setNoteEditId] = useState<number | null>(null);
  const [noteEditText, setNoteEditText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  async function commitAdd() {
    const name = addName.trim();
    if (!name || !onAdd) return;
    setAddBusy(true);
    await onAdd(name);
    setAddBusy(false);
    setAddName("");
    setAdding(false);
  }

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
        <div className="flex items-center gap-2">
          <Badge>{String(items.length)}</Badge>
          {onAdd && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-stone-500 transition hover:border-stone-500 hover:bg-white hover:text-stone-800"
              aria-label={`Add ${title.toLowerCase()}`}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="mt-4 space-y-2 rounded-2xl border border-stone-200 bg-stone-50 p-3">
          <input
            autoFocus
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-500"
            placeholder={`New ${title.slice(0, -1).toLowerCase()} name…`}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") { setAdding(false); setAddName(""); } }}
          />
          {addExtra?.(addName)}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={commitAdd}
              disabled={addBusy || !addName.trim()}
              className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white transition hover:bg-stone-700 disabled:opacity-50"
            >
              {addBusy ? "Saving…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setAddName(""); }}
              className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding ? (
        <p className="mt-4 text-sm text-stone-500">{emptyText}</p>
      ) : items.length > 0 ? (
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
                      {getItemHref ? (
                        <Link
                          href={getItemHref(item)}
                          className="text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-stone-900">{item.label}</div>
                      )}
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
      ) : null}
    </Card>
  );
}

function ProducerKnowledgeCard({
  producers,
  groups,
  regionsById,
  onRename,
  onDelete,
  onSaveNote,
  onReassignRegion,
  onAdd,
  addExtra,
}: ProducerKnowledgeCardProps) {
  const [query, setQuery] = useState("");
  const [regionQueries, setRegionQueries] = useState<Record<string, string>>({});
  const [noteEditId, setNoteEditId] = useState<number | null>(null);
  const [noteEditText, setNoteEditText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  async function commitAdd() {
    const name = addName.trim();
    if (!name) return;
    setAddBusy(true);
    await onAdd(name);
    setAddBusy(false);
    setAddName("");
    setAdding(false);
  }

  function openNoteEdit(item: Producer) {
    setNoteEditId(item.id);
    setNoteEditText(item.notes ?? "");
  }

  async function commitNote(item: Producer) {
    await onSaveNote(item, noteEditText);
    setNoteEditId(null);
  }

  const normalizedQuery = query.trim().toLowerCase();

  const visibleGroups = groups
    .map((group) => {
      const normalizedRegionQuery = (regionQueries[group.label] ?? "").trim().toLowerCase();
      const items = group.items.filter((producer) => {
        const matchesGlobal =
          !normalizedQuery ||
          producer.name.toLowerCase().includes(normalizedQuery) ||
          group.label.toLowerCase().includes(normalizedQuery);
        const matchesRegion = !normalizedRegionQuery || producer.name.toLowerCase().includes(normalizedRegionQuery);
        return matchesGlobal && matchesRegion;
      });

      return { ...group, items };
    })
    .filter((group) => group.items.length > 0 || group.label.toLowerCase().includes(normalizedQuery));

  return (
    <Card className="border-stone-300/80">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-stone-900">Producers</h2>
        <div className="flex items-center gap-2">
          <Badge>{String(producers.length)}</Badge>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 text-stone-500 transition hover:border-stone-500 hover:bg-white hover:text-stone-800"
              aria-label="Add producers"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="mt-4 space-y-2 rounded-2xl border border-stone-200 bg-stone-50 p-3">
          <input
            autoFocus
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-stone-500"
            placeholder="New producer name…"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") { setAdding(false); setAddName(""); } }}
          />
          {addExtra()}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={commitAdd}
              disabled={addBusy || !addName.trim()}
              className="rounded-full bg-stone-900 px-3 py-1 text-xs text-white transition hover:bg-stone-700 disabled:opacity-50"
            >
              {addBusy ? "Saving…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setAddName(""); }}
              className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search producers..."
        />
      </div>

      {visibleGroups.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">No producers match the current search.</p>
      ) : (
        <div className="mt-4 max-h-[44rem] space-y-4 overflow-y-auto pr-1">
          {visibleGroups.map((group) => (
            <div key={group.label} className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-stone-900">{group.label}</div>
                  <div className="mt-0.5 text-xs text-stone-500">
                    {group.label === "Unknown" ? "Producers without a linked region" : `${group.items.length} producer${group.items.length === 1 ? "" : "s"}`}
                  </div>
                </div>
                <Badge>{String(group.items.length)}</Badge>
              </div>

              <div className="mt-3">
                <Input
                  type="search"
                  value={regionQueries[group.label] ?? ""}
                  onChange={(e) => setRegionQueries((current) => ({ ...current, [group.label]: e.target.value }))}
                  placeholder={`Search in ${group.label}`}
                />
              </div>

              <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
                {group.items.map((producer) => {
                  const linkedRegion = producer.region_id ? (regionsById.get(producer.region_id) ?? null) : null;
                  const detail = linkedRegion
                    ? linkedRegion.countries?.name
                      ? `${linkedRegion.name} · ${linkedRegion.countries.name}`
                      : linkedRegion.name
                    : "Unknown";

                  return (
                    <div key={producer.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/knowledge/producers/${producer.id}`}
                            className="text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                          >
                            {producer.name}
                          </Link>
                          <div className="mt-0.5 text-xs text-stone-500">{detail}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReassignRegion(producer)}
                            className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
                          >
                            Set region
                          </button>
                          <button
                            type="button"
                            onClick={() => onRename({ id: producer.id, label: producer.name })}
                            className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete({ id: producer.id, label: producer.name })}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {noteEditId === producer.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={3}
                            className="w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
                            placeholder={`Notes about ${producer.name}…`}
                            value={noteEditText}
                            onChange={(e) => setNoteEditText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => commitNote(producer)}
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
                          {producer.notes ? (
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600">{producer.notes}</p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openNoteEdit(producer)}
                            className="mt-1 text-xs text-stone-400 underline underline-offset-2 transition hover:text-stone-600"
                          >
                            {producer.notes ? "Edit note" : "+ Add note"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
  const [producers, setProducers] = useState<Producer[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [regionModalProducer, setRegionModalProducer] = useState<Producer | null>(null);
  const [regionModalValue, setRegionModalValue] = useState("");
  const [savingProducerRegion, setSavingProducerRegion] = useState(false);
  const [modalNewRegionName, setModalNewRegionName] = useState("");
  const [modalNewRegionCountry, setModalNewRegionCountry] = useState("");
  const [addingModalRegion, setAddingModalRegion] = useState(false);

  const loadLookups = useCallback(async () => {
    const [countryRes, regionRes, subregionRes, grapeRes, producerRes] = await Promise.all([
      supabase.from("countries").select("id,name,notes").order("name"),
      supabase.from("regions").select("id,name,country_id,notes,countries(name)").order("name"),
      supabase.from("subregions").select("id,name,region_id,notes,regions(name)").order("name"),
      supabase.from("grapes").select("id,name,notes").order("name"),
      supabase.from("producers").select("id,name,region_id,notes,regions(name)").order("name"),
    ]);

    if (countryRes.error) alert(countryRes.error.message);
    else setCountries((countryRes.data as unknown as Country[]) ?? []);

    if (regionRes.error) alert(regionRes.error.message);
    else setRegions((regionRes.data as unknown as Region[]) ?? []);

    if (subregionRes.error) alert(subregionRes.error.message);
    else setSubregions((subregionRes.data as unknown as Subregion[]) ?? []);

    if (grapeRes.error) alert(grapeRes.error.message);
    else setGrapes((grapeRes.data as unknown as Grape[]) ?? []);

    if (producerRes.error) alert(producerRes.error.message);
    else setProducers((producerRes.data as unknown as Producer[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
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

  async function renameProducer(item: { id: number; label: string }) {
    const nextName = prompt("Rename producer", item.label)?.trim();
    if (!nextName || nextName === item.label) return;
    setBusyKey(`producer-rename-${item.id}`);
    const { error } = await supabase.from("producers").update({ name: nextName }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function deleteProducer(item: { id: number; label: string }) {
    if (!confirm(`Delete producer "${item.label}"? Wines using it will lose the producer.`)) return;
    setBusyKey(`producer-delete-${item.id}`);
    {
      const { error } = await supabase.from("wines").update({ producer_id: null }).eq("producer_id", item.id);
      if (error) { setBusyKey(null); return alert(error.message); }
    }
    const { error } = await supabase.from("producers").delete().eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function saveProducerNote(item: { id: number }, notes: string) {
    setBusyKey(`producer-note-${item.id}`);
    const { error } = await supabase.from("producers").update({ notes: notes.trim() || null }).eq("id", item.id);
    setBusyKey(null);
    if (error) return alert(error.message);
    await loadLookups();
  }

  function openProducerRegionModal(item: Producer) {
    const currentRegion = item.region_id ? (regions.find((region) => region.id === item.region_id) ?? null) : null;
    setRegionModalProducer(item);
    setRegionModalValue(currentRegion ? formatRegionOption(currentRegion) : "");
    setModalNewRegionName("");
    setModalNewRegionCountry(currentRegion?.countries?.name ?? "");
  }

  function closeProducerRegionModal() {
    if (savingProducerRegion || addingModalRegion) return;
    setRegionModalProducer(null);
    setRegionModalValue("");
    setModalNewRegionName("");
    setModalNewRegionCountry("");
  }

  async function saveProducerRegionAssignment() {
    if (!regionModalProducer) return;

    const nextRegion = regionOptionMap.get(regionModalValue) ?? null;
    setSavingProducerRegion(true);
    setBusyKey(`producer-region-${regionModalProducer.id}`);
    const { error } = await supabase
      .from("producers")
      .update({ region_id: nextRegion?.id ?? null })
      .eq("id", regionModalProducer.id);
    setBusyKey(null);
    setSavingProducerRegion(false);
    if (error) return alert(error.message);
    await loadLookups();
    closeProducerRegionModal();
  }

  async function addRegionFromModal() {
    const name = modalNewRegionName.trim();
    if (!name) return;

    setAddingModalRegion(true);
    const country = countries.find((entry) => entry.name === modalNewRegionCountry);
    const { data, error } = await supabase
      .from("regions")
      .insert({ name, country_id: country?.id ?? null })
      .select("id,name,country_id,countries(name),notes")
      .single();
    setAddingModalRegion(false);
    if (error) return alert(error.message);

    const insertedRegion = data as unknown as Region;
    await loadLookups();
    setRegionModalValue(formatRegionOption(insertedRegion));
    setModalNewRegionName("");
  }

  // ── Add handlers ───────────────────────────────────────────────────────────

  const [newRegionCountry, setNewRegionCountry] = useState("");
  const [newSubregionRegion, setNewSubregionRegion] = useState("");
  const [newProducerCountry, setNewProducerCountry] = useState("");
  const [newProducerRegion, setNewProducerRegion] = useState("");

  async function addCountry(name: string) {
    const { error } = await supabase.from("countries").insert({ name });
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function addRegion(name: string) {
    const country = countries.find((c) => c.name === newRegionCountry);
    const { error } = await supabase
      .from("regions")
      .insert({ name, country_id: country?.id ?? null });
    if (error) return alert(error.message);
    setNewRegionCountry("");
    await loadLookups();
  }

  async function addSubregion(name: string) {
    const region = regions.find((r) => r.name === newSubregionRegion);
    const { error } = await supabase
      .from("subregions")
      .insert({ name, region_id: region?.id ?? null });
    if (error) return alert(error.message);
    setNewSubregionRegion("");
    await loadLookups();
  }

  async function addGrape(name: string) {
    const { error } = await supabase.from("grapes").insert({ name });
    if (error) return alert(error.message);
    await loadLookups();
  }

  async function addProducer(name: string) {
    const country = countries.find((entry) => entry.name === newProducerCountry);
    const region = regions.find((entry) => {
      if (entry.name !== newProducerRegion) return false;
      if (!country) return true;
      return entry.country_id === country.id;
    });

    const { error } = await supabase.from("producers").insert({ name, region_id: region?.id ?? null });
    if (error) return alert(error.message);
    setNewProducerCountry("");
    setNewProducerRegion("");
    await loadLookups();
  }

  // ── Derived items ──────────────────────────────────────────────────────────

  const regionLookup = new Map(regions.map((region) => [region.id, region] as const));
  const sortedRegions = regions.slice().sort((a, b) => formatRegionOption(a).localeCompare(formatRegionOption(b)));
  const regionOptions = sortedRegions.map((region) => formatRegionOption(region));
  const regionOptionMap = new Map(sortedRegions.map((region) => [formatRegionOption(region), region] as const));
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
  const groupedProducerItems = Array.from(
    producers.reduce((map, producer) => {
      const linkedRegion = producer.region_id ? (regionLookup.get(producer.region_id) ?? null) : null;
      const groupLabel = linkedRegion
        ? linkedRegion.countries?.name
          ? `${linkedRegion.name} · ${linkedRegion.countries.name}`
          : linkedRegion.name
        : "Unknown";

      const nextItems = map.get(groupLabel) ?? [];
      nextItems.push(producer);
      map.set(groupLabel, nextItems);
      return map;
    }, new Map<string, Producer[]>()).entries()
  )
    .sort(([left], [right]) => {
      if (left === "Unknown") return 1;
      if (right === "Unknown") return -1;
      return left.localeCompare(right);
    })
    .map(([label, items]) => ({
      label,
      items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <PageContainer>
        <PageHero>
          <Eyebrow>Knowledge Base</Eyebrow>
          <PageTitle>My Knowledge</PageTitle>
          <PageIntro>
            Rename or delete countries, regions, sub-regions, grape varieties, and producers.
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
            onAdd={addCountry}
          />
          <LookupSection
            title="Regions"
            emptyText="No regions yet."
            items={regionItems}
            onRename={renameRegion}
            onDelete={deleteRegion}
            onSaveNote={saveRegionNote}
            onAdd={addRegion}
            addExtra={() => (
              <select
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-500"
                value={newRegionCountry}
                onChange={(e) => setNewRegionCountry(e.target.value)}
              >
                <option value="">Country (optional)</option>
                {countries.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
          />
          <LookupSection
            title="Sub-regions"
            emptyText="No sub-regions yet."
            items={subregionItems}
            onRename={renameSubregion}
            onDelete={deleteSubregion}
            onSaveNote={saveSubregionNote}
            onAdd={addSubregion}
            addExtra={() => (
              <select
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-500"
                value={newSubregionRegion}
                onChange={(e) => setNewSubregionRegion(e.target.value)}
              >
                <option value="">Region (optional)</option>
                {regions.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            )}
          />
          <LookupSection
            title="Grapes"
            emptyText="No grapes yet."
            items={grapeItems}
            onRename={renameGrape}
            onDelete={deleteGrape}
            onSaveNote={saveGrapeNote}
            onAdd={addGrape}
          />
          <div className="lg:col-span-2">
            <ProducerKnowledgeCard
              producers={producers}
              groups={groupedProducerItems}
              regionsById={regionLookup}
              onRename={renameProducer}
              onDelete={deleteProducer}
              onSaveNote={saveProducerNote}
              onReassignRegion={openProducerRegionModal}
              onAdd={addProducer}
              addExtra={() => (
                <div className="space-y-2">
                  <select
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-500"
                    value={newProducerCountry}
                    onChange={(e) => {
                      setNewProducerCountry(e.target.value);
                      setNewProducerRegion("");
                    }}
                  >
                    <option value="">Country (optional)</option>
                    {countries.map((country) => <option key={country.id} value={country.name}>{country.name}</option>)}
                  </select>
                  <select
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-500"
                    value={newProducerRegion}
                    onChange={(e) => setNewProducerRegion(e.target.value)}
                  >
                    <option value="">Region (optional)</option>
                    {regions
                      .filter((region) => !newProducerCountry || region.countries?.name === newProducerCountry)
                      .map((region) => (
                        <option key={region.id} value={region.name}>
                          {region.countries?.name ? `${region.name} (${region.countries.name})` : region.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            />
          </div>
        </div>
      </PageContainer>

      {regionModalProducer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4 backdrop-blur-sm"
          onClick={closeProducerRegionModal}
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_60px_rgba(88,56,34,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-serif text-2xl text-stone-900">Set Producer Region</p>
                <p className="mt-2 text-sm text-stone-600">
                  Link <span className="font-medium text-stone-800">{regionModalProducer.name}</span> to an existing region, or add a new one here.
                </p>
              </div>
              <button
                type="button"
                onClick={closeProducerRegionModal}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-400 hover:text-stone-800"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-stone-600">Region</label>
                <SearchableSelect
                  value={regionModalValue}
                  onChange={setRegionModalValue}
                  options={regionOptions}
                  placeholder="Search regions"
                  allLabel="Unknown"
                />
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
                <div className="text-sm font-medium text-stone-800">Add a New Region</div>
                <div className="mt-3 space-y-3">
                  <Input
                    value={modalNewRegionName}
                    onChange={(e) => setModalNewRegionName(e.target.value)}
                    placeholder="New region name"
                  />
                  <select
                    className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-500"
                    value={modalNewRegionCountry}
                    onChange={(e) => setModalNewRegionCountry(e.target.value)}
                  >
                    <option value="">Country (optional)</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={addRegionFromModal}
                      disabled={addingModalRegion || !modalNewRegionName.trim()}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:border-stone-500 hover:bg-white disabled:opacity-50"
                    >
                      {addingModalRegion ? "Adding…" : "Add Region"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeProducerRegionModal}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProducerRegionAssignment}
                disabled={savingProducerRegion}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white transition hover:bg-stone-700 disabled:opacity-50"
              >
                {savingProducerRegion ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function formatRegionOption(region: Region) {
  return region.countries?.name ? `${region.name} (${region.countries.name})` : region.name;
}
