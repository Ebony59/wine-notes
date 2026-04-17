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
import { Textarea } from "@/components/ui/textarea";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

type Subregion = {
  id: number;
  name: string;
  notes: string | null;
  cover_photo_url: string | null;
  region_id: number | null;
  regions: {
    id: number;
    name: string;
    country_id: number | null;
    countries: { id: number; name: string } | null;
  } | null;
};

type SubregionPhoto = {
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
};

export default function SubregionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [subregion, setSubregion] = useState<Subregion | null>(null);
  const [photos, setPhotos] = useState<SubregionPhoto[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<SubregionPhoto | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadAll();
    });

    async function loadAll() {
      const [subregionRes, photosRes, winesRes] = await Promise.all([
        supabase.from("subregions").select("id,name,notes,cover_photo_url,region_id,regions(id,name,country_id,countries(id,name))").eq("id", id).maybeSingle(),
        supabase.from("subregion_photos").select("id,storage_path,external_url").eq("subregion_id", id).order("created_at", { ascending: true }),
        supabase.from("wines").select("id,name,vintage_year,countries(name),regions(name)").eq("subregion_id", id).order("name"),
      ]);

      if (subregionRes.error) { alert(subregionRes.error.message); return; }
      if (!subregionRes.data) { setNotFound(true); return; }

      const s = subregionRes.data as unknown as Subregion;
      setSubregion(s);
      setNotesText(s.notes ?? "");
      setPhotos((photosRes.data ?? []) as unknown as SubregionPhoto[]);
      setWines((winesRes.data ?? []) as unknown as Wine[]);
    }
  }, [supabase, id]);

  function resolveUrl(p: SubregionPhoto): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    return "";
  }

  async function saveNotes() {
    if (!subregion) return;
    setSavingNotes(true);
    const { error } = await supabase.from("subregions").update({ notes: notesText.trim() || null }).eq("id", subregion.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setSubregion(s => s ? { ...s, notes: notesText.trim() || null } : s);
    setEditingNotes(false);
  }

  async function deleteNotes() {
    if (!subregion) return;
    setSavingNotes(true);
    const { error } = await supabase.from("subregions").update({ notes: null }).eq("id", subregion.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setSubregion(s => s ? { ...s, notes: null } : s);
    setNotesText("");
    setEditingNotes(false);
  }

  async function savePhotos() {
    if (!userId || pendingPhotos.length === 0) return;
    setSavingPhotos(true);
    for (const photo of pendingPhotos) {
      if (photo.url) {
        const { data, error } = await supabase.from("subregion_photos").insert({ subregion_id: Number(id), external_url: photo.url }).select("id,storage_path,external_url").single();
        if (!error && data) setPhotos(ps => [...ps, data as SubregionPhoto]);
      } else if (photo.file) {
        let converted: File;
        try { converted = await convertIfNeeded(photo.file); } catch { continue; }
        const path = `${userId}/subregions/${id}/${photo.file.lastModified}_${converted.name}`;
        const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, converted);
        if (upErr) { alert(upErr.message); continue; }
        const { data, error } = await supabase.from("subregion_photos").insert({ subregion_id: Number(id), storage_path: path }).select("id,storage_path,external_url").single();
        if (!error && data) setPhotos(ps => [...ps, data as SubregionPhoto]);
      }
    }
    setPendingPhotos([]);
    setSavingPhotos(false);
  }

  async function clearLabelPhoto() {
    const { error } = await supabase.from("subregions").update({ cover_photo_url: null }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setSubregion(prev => prev ? { ...prev, cover_photo_url: null } : prev);
  }

  async function setLabelPhoto(p: SubregionPhoto) {
    const url = resolveUrl(p);
    const { error } = await supabase.from("subregions").update({ cover_photo_url: url }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setSubregion(prev => prev ? { ...prev, cover_photo_url: url } : prev);
  }

  async function deletePhoto(p: SubregionPhoto) {
    if (!confirm("Delete this photo?")) return;
    if (p.storage_path) await supabase.storage.from("wine-photos").remove([p.storage_path]);
    await supabase.from("subregion_photos").delete().eq("id", p.id);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    if (expandedPhoto?.id === p.id) setExpandedPhoto(null);
    if (subregion?.cover_photo_url === resolveUrl(p)) {
      await supabase.from("subregions").update({ cover_photo_url: null }).eq("id", Number(id));
      setSubregion(prev => prev ? { ...prev, cover_photo_url: null } : prev);
    }
  }

  if (notFound) return (
    <PageShell><PageContainer className="max-w-3xl"><p className="text-stone-600">Sub-region not found.</p></PageContainer></PageShell>
  );

  if (!subregion) return (
    <PageShell className="py-16"><PageContainer className="max-w-3xl"><p className="text-sm text-stone-500">Loading…</p></PageContainer></PageShell>
  );

  const coverUrl = subregion.cover_photo_url ?? null;
  const regionName = subregion.regions?.name ?? null;
  const regionId = subregion.regions?.id ?? null;
  const countryName = subregion.regions?.countries?.name ?? null;
  const countryId = subregion.regions?.countries?.id ?? null;

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
              {regionName && regionId && (
                <>
                  <span className="text-stone-400">/</span>
                  <Link href={`/knowledge/regions/${regionId}`} className="hover:text-stone-700">{regionName}</Link>
                </>
              )}
            </span>
          </Eyebrow>
          <PageTitle>{subregion.name}</PageTitle>
          {wines.length > 0 && (
            <PageIntro>{wines.length} {wines.length === 1 ? "wine" : "wines"} in your cellar</PageIntro>
          )}
        </PageHero>

        {coverUrl && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => { const p = photos.find(ph => resolveUrl(ph) === coverUrl); if (p) setExpandedPhoto(p); }}
              className="block overflow-hidden rounded-2xl border border-stone-200 shadow-sm transition hover:border-stone-300"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={subregion.name} className="max-h-72 object-contain" />
            </button>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => document.getElementById("entity-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-xs text-stone-500 underline underline-offset-2 transition hover:text-stone-800">Replace</button>
              <button type="button" onClick={clearLabelPhoto} className="text-xs text-rose-500 underline underline-offset-2 transition hover:text-rose-700">Remove</button>
            </div>
          </div>
        )}

        {/* Location */}
        {(regionName || countryName) && (
          <Card className="mt-8">
            <CardTitle className="text-xl">Location</CardTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {regionName && regionId && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Region</div>
                  <Link href={`/knowledge/regions/${regionId}`} className="mt-1 block text-sm font-medium text-stone-900 underline-offset-2 hover:underline">
                    {regionName}
                  </Link>
                </div>
              )}
              {countryName && countryId && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Country</div>
                  <Link href={`/knowledge/countries/${countryId}`} className="mt-1 block text-sm font-medium text-stone-900 underline-offset-2 hover:underline">
                    {countryName}
                  </Link>
                </div>
              )}
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
                onClick={() => { setNotesText(subregion.notes ?? ""); setEditingNotes(true); }}
                className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                {subregion.notes ? "Edit" : "+ Add note"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="mt-4 space-y-3">
              <Textarea rows={5} className="min-h-[120px]" placeholder={`Notes about ${subregion.name}…`} value={notesText} onChange={(e) => setNotesText(e.target.value)} />
              <div className="flex gap-2">
                <NotesEditBar
                  saving={savingNotes}
                  onSave={saveNotes}
                  onCancel={() => { setEditingNotes(false); setNotesText(subregion.notes ?? ""); }}
                  onDelete={subregion.notes ? deleteNotes : undefined}
                />
              </div>
            </div>
          ) : subregion.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{subregion.notes}</p>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No notes yet.</p>
          )}
        </Card>

        {/* Photos */}
        <Card className="mt-6" id="entity-photos">
          <CardTitle className="text-2xl">Photos</CardTitle>
          <CardDescription className="mt-2">Select one photo as the label photo — it will appear at the top of this page.</CardDescription>
          {photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {photos.map(p => {
                const url = resolveUrl(p);
                const isLabel = subregion.cover_photo_url === url;
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

        {/* Wines */}
        <Card className="mt-6">
          <CardTitle className="text-xl">Wines</CardTitle>
          {wines.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No wines recorded for this sub-region.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {wines.map(wine => {
                const location = [wine.regions?.name, wine.countries?.name].filter(Boolean).join(" · ");
                return (
                  <Link key={wine.id} href={`/wines/${wine.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:bg-stone-50">
                    <div>
                      <div className="text-sm font-medium text-stone-900">{wine.name}</div>
                      {location && <div className="mt-0.5 text-xs text-stone-500">{location}</div>}
                    </div>
                    <div className="shrink-0 text-sm text-stone-500">{wine.vintage_year ?? "NV"}</div>
                  </Link>
                );
              })}
            </div>
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
