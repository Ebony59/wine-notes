"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import { NotesEditBar } from "@/components/NotesEditBar";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

// ── Types ──────────────────────────────────────────────────────────────────────

type Producer = {
  id: number;
  name: string;
  region_id: number | null;
  regions: { name: string; countries: { name: string } | null } | null;
  notes: string | null;
  cover_photo_url: string | null;
};

type ProducerPhoto = {
  id: string;
  storage_path: string | null;
  external_url: string | null;
};

type Wine = {
  id: string;
  name: string;
  vintage_year: number | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
};

type Region = {
  id: number;
  name: string;
  countries: { name: string } | null;
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProducerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [producer, setProducer] = useState<Producer | null>(null);
  const [photos, setPhotos] = useState<ProducerPhoto[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);

  // Pending photos from PhotoPicker, uploaded on "Save photos"
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);

  // Lightbox for existing photos
  const [expandedPhoto, setExpandedPhoto] = useState<ProducerPhoto | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadAll();
    });

    async function loadAll() {
      const [producerRes, photosRes, winesRes, regionsRes] = await Promise.all([
        supabase.from("producers").select("id,name,region_id,notes,cover_photo_url,regions(name,countries(name))").eq("id", id).maybeSingle(),
        supabase
          .from("producer_photos")
          .select("id,storage_path,external_url")
          .eq("producer_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("wines")
          .select("id,name,vintage_year,countries(name),regions(name),subregions(name)")
          .eq("producer_id", id)
          .order("name"),
        supabase.from("regions").select("id,name,countries(name)").order("name"),
      ]);

      if (producerRes.error) { alert(producerRes.error.message); return; }
      if (!producerRes.data) { setNotFound(true); return; }

      const p = producerRes.data as unknown as Producer;
      setProducer(p);
      setNotesText(p.notes ?? "");
      setSelectedRegionId(p.region_id?.toString() ?? "");
      setPhotos((photosRes.data ?? []) as unknown as ProducerPhoto[]);
      setWines((winesRes.data ?? []) as unknown as Wine[]);
      if (regionsRes.error) { alert(regionsRes.error.message); return; }
      setRegions((regionsRes.data ?? []) as unknown as Region[]);
    }
  }, [supabase, id]);

  function resolveUrl(p: ProducerPhoto): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) {
      return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    }
    return "";
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  async function saveNotes() {
    if (!producer) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("producers")
      .update({ notes: notesText.trim() || null })
      .eq("id", producer.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setProducer(p => p ? { ...p, notes: notesText.trim() || null } : p);
    setEditingNotes(false);
  }

  async function deleteNotes() {
    if (!producer) return;
    setSavingNotes(true);
    const { error } = await supabase.from("producers").update({ notes: null }).eq("id", producer.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setProducer(p => p ? { ...p, notes: null } : p);
    setNotesText("");
    setEditingNotes(false);
  }

  async function saveLocation() {
    if (!producer) return;

    setSavingLocation(true);
    const nextRegionId = selectedRegionId ? Number(selectedRegionId) : null;
    const { error } = await supabase
      .from("producers")
      .update({ region_id: nextRegionId })
      .eq("id", producer.id);
    setSavingLocation(false);
    if (error) { alert(error.message); return; }

    const nextRegion = nextRegionId
      ? (regions.find((region) => region.id === nextRegionId) ?? null)
      : null;

    setProducer((current) => current ? { ...current, region_id: nextRegionId, regions: nextRegion } : current);
    setEditingLocation(false);
  }

  // ── Photos ─────────────────────────────────────────────────────────────────

  async function savePhotos() {
    if (!userId || pendingPhotos.length === 0) return;
    setSavingPhotos(true);
    for (const photo of pendingPhotos) {
      if (photo.url) {
        const { data, error } = await supabase
          .from("producer_photos")
          .insert({ producer_id: Number(id), external_url: photo.url })
          .select("id,storage_path,external_url")
          .single();
        if (!error && data) setPhotos(ps => [...ps, data as ProducerPhoto]);
      } else if (photo.file) {
        let converted: File;
        try { converted = await convertIfNeeded(photo.file); } catch { continue; }
        const path = `${userId}/producers/${id}/${photo.file.lastModified}_${converted.name}`;
        const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, converted);
        if (upErr) { alert(upErr.message); continue; }
        const { data, error } = await supabase
          .from("producer_photos")
          .insert({ producer_id: Number(id), storage_path: path })
          .select("id,storage_path,external_url")
          .single();
        if (!error && data) setPhotos(ps => [...ps, data as ProducerPhoto]);
      }
    }
    setPendingPhotos([]);
    setSavingPhotos(false);
  }

  async function clearLabelPhoto() {
    const { error } = await supabase.from("producers").update({ cover_photo_url: null }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setProducer(prev => prev ? { ...prev, cover_photo_url: null } : prev);
  }

  async function setLabelPhoto(p: ProducerPhoto) {
    const url = resolveUrl(p);
    const { error } = await supabase
      .from("producers")
      .update({ cover_photo_url: url })
      .eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setProducer(prev => prev ? { ...prev, cover_photo_url: url } : prev);
  }

  async function deletePhoto(p: ProducerPhoto) {
    if (!confirm("Delete this photo?")) return;
    if (p.storage_path) {
      await supabase.storage.from("wine-photos").remove([p.storage_path]);
    }
    await supabase.from("producer_photos").delete().eq("id", p.id);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    if (expandedPhoto?.id === p.id) setExpandedPhoto(null);
    // If it was the label photo, clear cover_photo_url
    if (producer?.cover_photo_url === resolveUrl(p)) {
      await supabase.from("producers").update({ cover_photo_url: null }).eq("id", Number(id));
      setProducer(prev => prev ? { ...prev, cover_photo_url: null } : prev);
    }
  }

  // ── Early returns ──────────────────────────────────────────────────────────

  if (notFound) return (
    <PageShell>
      <PageContainer className="max-w-3xl">
        <p className="text-stone-600">Producer not found.</p>
      </PageContainer>
    </PageShell>
  );

  if (!producer) return (
    <PageShell className="py-16">
      <PageContainer className="max-w-3xl">
        <p className="text-sm text-stone-500">Loading…</p>
      </PageContainer>
    </PageShell>
  );

  const coverUrl = producer.cover_photo_url ?? null;
  const regionLabel = producer.regions?.name ?? "Unknown";
  const countryLabel = producer.regions?.countries?.name ?? "Unknown";

  return (
    <PageShell>
      <PageContainer className="max-w-4xl pb-16">
        {/* Header */}
        <PageHero>
          <Eyebrow>
            <Link href="/knowledge" className="inline-flex items-center gap-1 hover:text-stone-700">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3">
                <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              My Knowledge
            </Link>
          </Eyebrow>
          <PageTitle>{producer.name}</PageTitle>
          {wines.length > 0 && (
            <PageIntro>{wines.length} {wines.length === 1 ? "wine" : "wines"} in your cellar</PageIntro>
          )}
        </PageHero>

        {/* Label photo (cover) — displayed prominently at the top when set */}
        {coverUrl && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => { const p = photos.find(ph => resolveUrl(ph) === coverUrl); if (p) setExpandedPhoto(p); }}
              className="block overflow-hidden rounded-2xl border border-stone-200 shadow-sm transition hover:border-stone-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={producer.name} className="max-h-72 object-contain" />
            </button>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => document.getElementById("entity-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-xs text-stone-500 underline underline-offset-2 transition hover:text-stone-800">Replace</button>
              <button type="button" onClick={clearLabelPhoto} className="text-xs text-rose-500 underline underline-offset-2 transition hover:text-rose-700">Remove</button>
            </div>
          </div>
        )}

        <Card className="mt-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Region Link</CardTitle>
              <CardDescription className="mt-2">
                Producers can live under one region. Leave it blank to keep this producer in Unknown.
              </CardDescription>
            </div>
            {!editingLocation && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRegionId(producer.region_id?.toString() ?? "");
                  setEditingLocation(true);
                }}
                className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                Edit
              </button>
            )}
          </div>

          {editingLocation ? (
            <div className="mt-4 space-y-3">
              <Field>
                <FieldLabel>Region</FieldLabel>
                <select
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-500"
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                >
                  <option value="">Unknown</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.countries?.name ? `${region.name} (${region.countries.name})` : region.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-2">
                <Button onClick={saveLocation} disabled={savingLocation}>
                  {savingLocation ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedRegionId(producer.region_id?.toString() ?? "");
                    setEditingLocation(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Region</div>
                <div className="mt-1 text-sm font-medium text-stone-900">{regionLabel}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Country</div>
                <div className="mt-1 text-sm font-medium text-stone-900">{countryLabel}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">Notes</CardTitle>
            {!editingNotes && (
              <button
                type="button"
                onClick={() => { setNotesText(producer.notes ?? ""); setEditingNotes(true); }}
                className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                {producer.notes ? "Edit" : "+ Add note"}
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="mt-4 space-y-3">
              <Textarea
                rows={5}
                className="min-h-[120px]"
                placeholder={`Notes about ${producer.name}…`}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
              />
              <NotesEditBar
                saving={savingNotes}
                onSave={saveNotes}
                onCancel={() => { setEditingNotes(false); setNotesText(producer.notes ?? ""); }}
                onDelete={producer.notes ? deleteNotes : undefined}
              />
            </div>
          ) : producer.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
              {producer.notes}
            </p>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No notes yet.</p>
          )}
        </Card>

        {/* Photos */}
        <Card className="mt-6" id="entity-photos">
          <CardTitle className="text-2xl">Photos</CardTitle>
          <CardDescription className="mt-2">
            Select one photo as the label photo — it will appear at the top of this page.
          </CardDescription>

          {/* Existing photo grid */}
          {photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {photos.map(p => {
                const url = resolveUrl(p);
                const isLabel = producer.cover_photo_url === url;
                return (
                  <div key={p.id} className="group relative">
                    {/* Thumbnail */}
                    <button
                      type="button"
                      onClick={() => setExpandedPhoto(p)}
                      className={`block h-24 w-24 overflow-hidden rounded-xl border-2 ${isLabel ? "border-stone-800" : "border-transparent"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>

                    {/* Label badge */}
                    {isLabel && (
                      <div className="absolute left-1 top-1 rounded bg-stone-800 px-1 text-[10px] font-medium text-white">
                        label
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      {!isLabel && (
                        <button
                          onClick={() => setLabelPhoto(p)}
                          className="text-[11px] font-medium text-white underline"
                        >
                          Set as label
                        </button>
                      )}
                      <button
                        onClick={() => deletePhoto(p)}
                        className="text-[11px] text-rose-300 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {photos.length === 0 && pendingPhotos.length === 0 && (
            <p className="mt-3 text-sm text-stone-500">No photos yet.</p>
          )}

          {/* Add new photos */}
          <div className="mt-4">
            <PhotoPicker onChange={setPendingPhotos} />
          </div>

          {pendingPhotos.length > 0 && (
            <div className="mt-3">
              <Button onClick={savePhotos} disabled={savingPhotos}>
                {savingPhotos
                  ? "Saving…"
                  : `Save ${pendingPhotos.length} photo${pendingPhotos.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </Card>

        {/* Wines */}
        <Card className="mt-6">
          <CardTitle className="text-xl">Wines</CardTitle>
          {wines.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No wines recorded for this producer.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {wines.map((wine) => {
                const location = [wine.subregions?.name, wine.regions?.name, wine.countries?.name]
                  .filter(Boolean).join(" · ");
                return (
                  <Link
                    key={wine.id}
                    href={`/wines/${wine.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:bg-stone-50"
                  >
                    <div>
                      <div className="text-sm font-medium text-stone-900">{wine.name}</div>
                      {location && (
                        <div className="mt-0.5 text-xs text-stone-500">{location}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-sm text-stone-500">
                      {wine.vintage_year ?? "NV"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </PageContainer>

      {/* Lightbox for existing photos */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveUrl(expandedPhoto)}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setExpandedPhoto(null)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/40"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </PageShell>
  );
}
