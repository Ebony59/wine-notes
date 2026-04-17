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

type Country = {
  id: number;
  name: string;
  notes: string | null;
  cover_photo_url: string | null;
};

type CountryPhoto = {
  id: string;
  storage_path: string | null;
  external_url: string | null;
};

type Region = {
  id: number;
  name: string;
};

type Wine = {
  id: string;
  name: string;
  vintage_year: number | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
};

export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [country, setCountry] = useState<Country | null>(null);
  const [photos, setPhotos] = useState<CountryPhoto[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<CountryPhoto | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadAll();
    });

    async function loadAll() {
      const [countryRes, photosRes, regionsRes, winesRes] = await Promise.all([
        supabase.from("countries").select("id,name,notes,cover_photo_url").eq("id", id).maybeSingle(),
        supabase.from("country_photos").select("id,storage_path,external_url").eq("country_id", id).order("created_at", { ascending: true }),
        supabase.from("regions").select("id,name").eq("country_id", id).order("name"),
        supabase.from("wines").select("id,name,vintage_year,regions(name),subregions(name)").eq("country_id", id).order("name"),
      ]);

      if (countryRes.error) { alert(countryRes.error.message); return; }
      if (!countryRes.data) { setNotFound(true); return; }

      const c = countryRes.data as unknown as Country;
      setCountry(c);
      setNotesText(c.notes ?? "");
      setPhotos((photosRes.data ?? []) as unknown as CountryPhoto[]);
      setRegions((regionsRes.data ?? []) as unknown as Region[]);
      setWines((winesRes.data ?? []) as unknown as Wine[]);
    }
  }, [supabase, id]);

  function resolveUrl(p: CountryPhoto): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    return "";
  }

  async function saveNotes() {
    if (!country) return;
    setSavingNotes(true);
    const { error } = await supabase.from("countries").update({ notes: notesText.trim() || null }).eq("id", country.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setCountry(c => c ? { ...c, notes: notesText.trim() || null } : c);
    setEditingNotes(false);
  }

  async function deleteNotes() {
    if (!country) return;
    setSavingNotes(true);
    const { error } = await supabase.from("countries").update({ notes: null }).eq("id", country.id);
    setSavingNotes(false);
    if (error) { alert(error.message); return; }
    setCountry(c => c ? { ...c, notes: null } : c);
    setNotesText("");
    setEditingNotes(false);
  }

  async function savePhotos() {
    if (!userId || pendingPhotos.length === 0) return;
    setSavingPhotos(true);
    for (const photo of pendingPhotos) {
      if (photo.url) {
        const { data, error } = await supabase.from("country_photos").insert({ country_id: Number(id), external_url: photo.url }).select("id,storage_path,external_url").single();
        if (!error && data) setPhotos(ps => [...ps, data as CountryPhoto]);
      } else if (photo.file) {
        let converted: File;
        try { converted = await convertIfNeeded(photo.file); } catch { continue; }
        const path = `${userId}/countries/${id}/${photo.file.lastModified}_${converted.name}`;
        const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, converted);
        if (upErr) { alert(upErr.message); continue; }
        const { data, error } = await supabase.from("country_photos").insert({ country_id: Number(id), storage_path: path }).select("id,storage_path,external_url").single();
        if (!error && data) setPhotos(ps => [...ps, data as CountryPhoto]);
      }
    }
    setPendingPhotos([]);
    setSavingPhotos(false);
  }

  async function clearLabelPhoto() {
    const { error } = await supabase.from("countries").update({ cover_photo_url: null }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setCountry(prev => prev ? { ...prev, cover_photo_url: null } : prev);
  }

  async function setLabelPhoto(p: CountryPhoto) {
    const url = resolveUrl(p);
    const { error } = await supabase.from("countries").update({ cover_photo_url: url }).eq("id", Number(id));
    if (error) { alert(error.message); return; }
    setCountry(prev => prev ? { ...prev, cover_photo_url: url } : prev);
  }

  async function deletePhoto(p: CountryPhoto) {
    if (!confirm("Delete this photo?")) return;
    if (p.storage_path) await supabase.storage.from("wine-photos").remove([p.storage_path]);
    await supabase.from("country_photos").delete().eq("id", p.id);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    if (expandedPhoto?.id === p.id) setExpandedPhoto(null);
    if (country?.cover_photo_url === resolveUrl(p)) {
      await supabase.from("countries").update({ cover_photo_url: null }).eq("id", Number(id));
      setCountry(prev => prev ? { ...prev, cover_photo_url: null } : prev);
    }
  }

  if (notFound) return (
    <PageShell><PageContainer className="max-w-3xl"><p className="text-stone-600">Country not found.</p></PageContainer></PageShell>
  );

  if (!country) return (
    <PageShell className="py-16"><PageContainer className="max-w-3xl"><p className="text-sm text-stone-500">Loading…</p></PageContainer></PageShell>
  );

  const coverUrl = country.cover_photo_url ?? null;

  return (
    <PageShell>
      <PageContainer className="max-w-4xl pb-16">
        <PageHero>
          <Eyebrow>
            <Link href="/knowledge" className="inline-flex items-center gap-1 hover:text-stone-700">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3">
                <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              My Knowledge
            </Link>
          </Eyebrow>
          <PageTitle>{country.name}</PageTitle>
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
              <img src={coverUrl} alt={country.name} className="max-h-72 object-contain" />
            </button>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => document.getElementById("entity-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="text-xs text-stone-500 underline underline-offset-2 transition hover:text-stone-800">Replace</button>
              <button type="button" onClick={clearLabelPhoto} className="text-xs text-rose-500 underline underline-offset-2 transition hover:text-rose-700">Remove</button>
            </div>
          </div>
        )}

        {/* Notes */}
        <Card className="mt-8">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">Notes</CardTitle>
            {!editingNotes && (
              <button
                type="button"
                onClick={() => { setNotesText(country.notes ?? ""); setEditingNotes(true); }}
                className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                {country.notes ? "Edit" : "+ Add note"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="mt-4 space-y-3">
              <Textarea rows={5} className="min-h-[120px]" placeholder={`Notes about ${country.name}…`} value={notesText} onChange={(e) => setNotesText(e.target.value)} />
              <div className="flex gap-2">
                <NotesEditBar
                  saving={savingNotes}
                  onSave={saveNotes}
                  onCancel={() => { setEditingNotes(false); setNotesText(country.notes ?? ""); }}
                  onDelete={country.notes ? deleteNotes : undefined}
                />
              </div>
            </div>
          ) : country.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{country.notes}</p>
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
                const isLabel = country.cover_photo_url === url;
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

        {/* Regions */}
        <Card className="mt-6">
          <CardTitle className="text-xl">Regions</CardTitle>
          {regions.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No regions linked to this country.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {regions.map(r => (
                <Link key={r.id} href={`/knowledge/regions/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:bg-stone-50">
                  <div className="text-sm font-medium text-stone-900">{r.name}</div>
                  <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Wines */}
        <Card className="mt-6">
          <CardTitle className="text-xl">Wines</CardTitle>
          {wines.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No wines recorded for this country.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {wines.map(wine => {
                const location = [wine.subregions?.name, wine.regions?.name].filter(Boolean).join(" · ");
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
