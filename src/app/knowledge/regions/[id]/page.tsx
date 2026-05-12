"use client";

import Link from "next/link";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WineCard, type WineCardWine } from "@/components/WineCard";
import { createClient } from "@/lib/supabase/client";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import { CoverPhoto } from "@/components/CoverPhoto";
import { NotesEditBar } from "@/components/NotesEditBar";
import { PhotoPicker } from "@/components/PhotoPicker";
import { VintageNotesList, type VintageNoteItem } from "@/components/VintageNotesList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

type Region = {
  id: number;
  name: string;
  notes: string | null;
  cover_photo_url: string | null;
  country_id: number | null;
  countries: { id: number; name: string } | null;
};

type RegionPhoto = {
  id: string;
  storage_path: string | null;
  external_url: string | null;
};

type Subregion = {
  id: number;
  name: string;
};

type Producer = {
  id: number;
  name: string;
};

type Wine = WineCardWine & {
  producers: { id: number; name: string } | null;
};

type Vintage = VintageNoteItem;

type ProducerWinesGroup = {
  producerId: number | null;
  producerName: string;
  nameGroups: { name: string; wines: Wine[] }[];
  wineCount: number;
};

function ProducerRow({ group }: { group: ProducerWinesGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/80">
      <button
        type="button"
        onClick={() => group.wineCount > 0 && setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
      >
        <div>
          {group.producerId ? (
            <Link
              href={`/knowledge/producers/${group.producerId}`}
              className="font-medium text-stone-900 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {group.producerName}
            </Link>
          ) : (
            <div className="font-medium text-stone-900">{group.producerName}</div>
          )}
          <div className="mt-0.5 text-xs text-stone-500">
            {group.wineCount} {group.wineCount === 1 ? "wine" : "wines"}
          </div>
        </div>
        {group.wineCount > 0 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M5.5 7.5 10 12l4.5-4.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="space-y-2 border-t border-stone-200 px-3 py-3">
          {group.nameGroups.map((nameGroup) => {
            return (
              <WineCard
                key={nameGroup.name}
                wines={nameGroup.wines}
                hideFields={["producer", "region", "country"]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RegionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [region, setRegion] = useState<Region | null>(null);
  const [photos, setPhotos] = useState<RegionPhoto[]>([]);
  const [subregions, setSubregions] = useState<Subregion[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [vintages, setVintages] = useState<Vintage[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [producerSearch, setProducerSearch] = useState("");

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<RegionPhoto | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadAll();
    });

    async function loadAll() {
      const [regionRes, photosRes, subregionsRes, producersRes, winesRes, vintagesRes] = await Promise.all([
        supabase.from("regions").select("id,name,notes,cover_photo_url,country_id,countries(id,name)").eq("id", id).maybeSingle(),
        supabase.from("region_photos").select("id,storage_path,external_url").eq("region_id", id).order("created_at", { ascending: true }),
        supabase.from("subregions").select("id,name").eq("region_id", id).order("name"),
        supabase.from("producers").select("id,name").eq("region_id", id).order("name"),
        supabase.from("wines").select("id,name,vintage_year,producer_id,producers(id,name),countries(name),regions(name),subregions(name)").eq("region_id", id).order("name"),
        supabase.from("vintages").select("region_id,year,notes").eq("region_id", id).order("year", { ascending: false }),
      ]);

      if (regionRes.error) { alert(regionRes.error.message); return; }
      if (!regionRes.data) { setNotFound(true); return; }

      const r = regionRes.data as unknown as Region;
      setRegion(r);
      setNotesText(r.notes ?? "");
      setPhotos((photosRes.data ?? []) as unknown as RegionPhoto[]);
      setSubregions((subregionsRes.data ?? []) as unknown as Subregion[]);
      setProducers((producersRes.data ?? []) as unknown as Producer[]);
      setWines((winesRes.data ?? []) as unknown as Wine[]);
      setVintages((vintagesRes.data ?? []) as unknown as Vintage[]);
    }
  }, [supabase, id]);

  function resolveUrl(p: RegionPhoto): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    return "";
  }

  async function saveNotes() {
    if (!region) return;
    setSavingNotes(true);
    const { error } = await supabase.from("regions").update({ notes: notesText.trim() || null }).eq("id", region.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setRegion(r => r ? { ...r, notes: notesText.trim() || null } : r);
    setEditingNotes(false);
  }

  async function deleteNotes() {
    if (!region) return;
    setSavingNotes(true);
    const { error } = await supabase.from("regions").update({ notes: null }).eq("id", region.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setRegion(r => r ? { ...r, notes: null } : r);
    setNotesText("");
    setEditingNotes(false);
  }

  async function savePhotos() {
    if (!userId || pendingPhotos.length === 0) return;
    setSavingPhotos(true);
    for (const photo of pendingPhotos) {
      if (photo.url) {
        const { data, error } = await supabase.from("region_photos").insert({ region_id: Number(id), external_url: photo.url }).select("id,storage_path,external_url").single();
        if (!error && data) setPhotos(ps => [...ps, data as RegionPhoto]);
      } else if (photo.file) {
        let converted: File;
        try { converted = await convertIfNeeded(photo.file); } catch { continue; }
        const path = `${userId}/regions/${id}/${photo.file.lastModified}_${converted.name}`;
        const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, converted);
        if (upErr) { alert(upErr.message); continue; }
        const { data, error } = await supabase.from("region_photos").insert({ region_id: Number(id), storage_path: path }).select("id,storage_path,external_url").single();
        if (!error && data) setPhotos(ps => [...ps, data as RegionPhoto]);
      }
    }
    setPendingPhotos([]);
    setSavingPhotos(false);
  }

  async function clearLabelPhoto() {
    const { error } = await supabase.from("regions").update({ cover_photo_url: null }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setRegion(prev => prev ? { ...prev, cover_photo_url: null } : prev);
  }

  async function setLabelPhoto(p: RegionPhoto) {
    const url = resolveUrl(p);
    const { error } = await supabase.from("regions").update({ cover_photo_url: url }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setRegion(prev => prev ? { ...prev, cover_photo_url: url } : prev);
  }

  async function deletePhoto(p: RegionPhoto) {
    if (!confirm("Delete this photo?")) return;
    if (p.storage_path) await supabase.storage.from("wine-photos").remove([p.storage_path]);
    await supabase.from("region_photos").delete().eq("id", p.id);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    if (expandedPhoto?.id === p.id) setExpandedPhoto(null);
    if (region?.cover_photo_url === resolveUrl(p)) {
      await supabase.from("regions").update({ cover_photo_url: null }).eq("id", Number(id));
      setRegion(prev => prev ? { ...prev, cover_photo_url: null } : prev);
    }
  }

  async function addVintage(year: number, notes: string) {
    const { error } = await supabase.from("vintages").insert({ region_id: Number(id), year, notes });
    if (error) {
      alert(error.message);
      return;
    }

    setVintages((current) =>
      [...current, { region_id: Number(id), year, notes }].sort((a, b) => b.year - a.year)
    );
  }

  async function updateVintage(year: number, notes: string) {
    const { error } = await supabase
      .from("vintages")
      .update({ notes })
      .eq("region_id", Number(id))
      .eq("year", year);
    if (error) {
      alert(error.message);
      return;
    }

    setVintages((current) =>
      current.map((item) => (item.year === year ? { ...item, notes } : item))
    );
  }

  async function deleteVintage(year: number) {
    const { error } = await supabase.from("vintages").delete().eq("region_id", Number(id)).eq("year", year);
    if (error) {
      alert(error.message);
      return;
    }

    setVintages((current) => current.filter((item) => item.year !== year));
  }

  const producerGroups = useMemo<ProducerWinesGroup[]>(() => {
    function buildNameGroups(ws: Wine[]) {
      const nameMap = new Map<string, Wine[]>();
      for (const w of ws) {
        if (!nameMap.has(w.name)) nameMap.set(w.name, []);
        nameMap.get(w.name)!.push(w);
      }
      return Array.from(nameMap.entries())
        .map(([name, nameWines]) => ({
          name,
          wines: [...nameWines].sort((a, b) => (b.vintage_year ?? -1) - (a.vintage_year ?? -1)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const winesByProducer = new Map<string, Wine[]>();
    for (const wine of wines) {
      const key = wine.producers?.name ?? "__none__";
      if (!winesByProducer.has(key)) winesByProducer.set(key, []);
      winesByProducer.get(key)!.push(wine);
    }

    const knownNames = new Set(producers.map((p) => p.name));
    const groups: ProducerWinesGroup[] = producers.map((p) => {
      const ws = winesByProducer.get(p.name) ?? [];
      const nameGroups = buildNameGroups(ws);
      return { producerId: p.id, producerName: p.name, nameGroups, wineCount: nameGroups.length };
    });

    for (const [name, ws] of winesByProducer) {
      if (name !== "__none__" && !knownNames.has(name)) {
        const nameGroups = buildNameGroups(ws);
        groups.push({ producerId: null, producerName: name, nameGroups, wineCount: nameGroups.length });
      }
    }

    groups.sort((a, b) => a.producerName.localeCompare(b.producerName));

    const unassigned = winesByProducer.get("__none__") ?? [];
    if (unassigned.length > 0) {
      const nameGroups = buildNameGroups(unassigned);
      groups.push({ producerId: null, producerName: "No Producer", nameGroups, wineCount: nameGroups.length });
    }

    return groups;
  }, [producers, wines]);

  const producerFuse = useMemo(
    () =>
      new Fuse(producerGroups, {
        keys: ["producerName", "nameGroups.name"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [producerGroups]
  );

  const filteredProducerGroups = useMemo(() => {
    const t = producerSearch.trim();
    if (!t) return producerGroups;
    return producerFuse.search(t).map((r) => r.item);
  }, [producerFuse, producerSearch, producerGroups]);

  if (notFound) return (
    <PageShell><PageContainer className="max-w-3xl"><p className="text-stone-600">Region not found.</p></PageContainer></PageShell>
  );

  if (!region) return (
    <PageShell className="py-16"><PageContainer className="max-w-3xl"><p className="text-sm text-stone-500">Loading…</p></PageContainer></PageShell>
  );

  const coverUrl = region.cover_photo_url ?? null;
  const countryName = region.countries?.name ?? null;
  const countryId = region.countries?.id ?? null;

  return (
    <PageShell>
      <PageContainer className="max-w-4xl pb-16">
        <PageHero>
          <Eyebrow>
            <span className="inline-flex items-center gap-1.5">
              <Link href="/knowledge" className="hover:text-stone-700">My Knowledge</Link>
              {countryName && countryId && (
                <>
                  <span className="text-stone-400">/</span>
                  <Link href={`/knowledge/countries/${countryId}`} className="hover:text-stone-700">{countryName}</Link>
                </>
              )}
            </span>
          </Eyebrow>
          <PageTitle>{region.name}</PageTitle>
          {wines.length > 0 && (
            <PageIntro>{wines.length} {wines.length === 1 ? "wine" : "wines"} in your cellar</PageIntro>
          )}
        </PageHero>

        {coverUrl && (
          <CoverPhoto
            className="mt-6"
            url={coverUrl}
            alt={region.name}
            onExpand={() => { const p = photos.find(ph => resolveUrl(ph) === coverUrl); if (p) setExpandedPhoto(p); }}
            onReplace={() => document.getElementById("entity-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            onRemove={clearLabelPhoto}
          />
        )}

        {/* Location */}
        {countryName && countryId && (
          <Card className="mt-8">
            <CardTitle className="text-xl">Location</CardTitle>
            <div className="mt-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Country</div>
                <Link href={`/knowledge/countries/${countryId}`} className="mt-1 block text-sm font-medium text-stone-900 underline-offset-2 hover:underline">
                  {countryName}
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">Notes</CardTitle>
            {!editingNotes && (
              <button
                type="button"
                onClick={() => { setNotesText(region.notes ?? ""); setEditingNotes(true); }}
                className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                {region.notes ? "Edit" : "+ Add note"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="mt-4 space-y-3">
              <Textarea rows={5} className="min-h-[120px]" placeholder={`Notes about ${region.name}…`} value={notesText} onChange={(e) => setNotesText(e.target.value)} />
              <NotesEditBar
                saving={savingNotes}
                onSave={saveNotes}
                onCancel={() => { setEditingNotes(false); setNotesText(region.notes ?? ""); }}
                onDelete={region.notes ? deleteNotes : undefined}
              />
            </div>
          ) : region.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{region.notes}</p>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No notes yet.</p>
          )}
        </Card>

        <Card className="mt-6" id="vintage-notes">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Vintage Notes</CardTitle>
              <CardDescription className="mt-2">
                Notes keyed to {region.name} vintages. These are managed manually and matched onto wines by region plus year.
              </CardDescription>
            </div>
            {vintages.length > 0 && (
              <Badge variant="muted">{vintages.length} vintage note{vintages.length === 1 ? "" : "s"}</Badge>
            )}
          </div>
          <div className="mt-4">
            <VintageNotesList
              regionId={region.id}
              regionName={region.name}
              vintages={vintages}
              emptyText="No vintage notes for this region yet."
              onCreate={addVintage}
              onUpdate={updateVintage}
              onDelete={deleteVintage}
            />
          </div>
        </Card>

        {/* Photos */}
        <Card className="mt-6" id="entity-photos">
          <CardTitle className="text-2xl">Photos</CardTitle>
          <CardDescription className="mt-2">Select one photo as the label photo — it will appear at the top of this page.</CardDescription>
          {photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {photos.map(p => {
                const url = resolveUrl(p);
                const isLabel = region.cover_photo_url === url;
                return (
                  <div key={p.id} className="group relative">
                    <button type="button" onClick={() => setExpandedPhoto(p)} className={`block h-24 w-24 overflow-hidden rounded-xl border-2 ${isLabel ? "border-stone-800" : "border-transparent"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                    {isLabel && <div className="absolute left-1 top-1 rounded bg-stone-800 px-1 text-[10px] font-medium text-white">label</div>}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {!isLabel && <button onClick={() => setLabelPhoto(p)} className="text-[11px] font-medium text-white underline">Set as label</button>}
                      <button onClick={() => deletePhoto(p)} className="text-[11px] text-rose-300 underline">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {photos.length === 0 && pendingPhotos.length === 0 && <p className="mt-3 text-sm text-stone-500">No photos yet.</p>}
          <div className="mt-4"><PhotoPicker onChange={setPendingPhotos} /></div>
          {pendingPhotos.length > 0 && (
            <div className="mt-3">
              <Button onClick={savePhotos} disabled={savingPhotos}>
                {savingPhotos ? "Saving…" : `Save ${pendingPhotos.length} photo${pendingPhotos.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </Card>

        {/* Sub-regions */}
        <Card className="mt-6">
          <CardTitle className="text-xl">Sub-regions</CardTitle>
          {subregions.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No sub-regions linked to this region.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {subregions.map(s => (
                <Link key={s.id} href={`/knowledge/subregions/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:bg-stone-50">
                  <div className="text-sm font-medium text-stone-900">{s.name}</div>
                  <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Producers & Wines */}
        <Card className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">Producers & Wines</CardTitle>
            {producerGroups.length > 0 && (
              <Badge variant="muted">{producerGroups.length} {producerGroups.length === 1 ? "producer" : "producers"}</Badge>
            )}
          </div>

          {producerGroups.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No producers or wines linked to this region.</p>
          ) : (
            <>
              <div className="mt-3">
                <Input
                  type="search"
                  value={producerSearch}
                  onChange={(e) => setProducerSearch(e.target.value)}
                  placeholder="Search producers or wines…"
                />
              </div>
              <div className="mt-3 space-y-2">
                {filteredProducerGroups.map((group) => (
                  <ProducerRow
                    key={`${group.producerId ?? "none"}-${group.producerName}`}
                    group={group}
                  />
                ))}
                {filteredProducerGroups.length === 0 && (
                  <p className="text-sm text-stone-500">No matches.</p>
                )}
              </div>
            </>
          )}
        </Card>
      </PageContainer>

      {expandedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setExpandedPhoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveUrl(expandedPhoto)} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setExpandedPhoto(null)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/40" aria-label="Close">✕</button>
        </div>
      )}
    </PageShell>
  );
}
