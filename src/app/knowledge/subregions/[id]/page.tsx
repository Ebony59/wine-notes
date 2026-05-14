"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WineCard, groupWinesForCards, type WineCardWine } from "@/components/WineCard";
import { createClient } from "@/lib/supabase/client";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import { CoverPhoto } from "@/components/CoverPhoto";
import { CoverPhotoGrid } from "@/components/CoverPhotoGrid";
import { NotesEditBar } from "@/components/NotesEditBar";
import { PhotoPicker } from "@/components/PhotoPicker";
import { EntitySearchInput, type EntityOption } from "@/components/EntitySearchInput";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
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

type SubregionRegion = {
  id: number;
  name: string;
  country_id: number | null;
  countries: { id: number; name: string } | null;
};

type Subregion = {
  id: number;
  name: string;
  notes: string | null;
  cover_photo_url: string | null;
  region_id: number | null;
  regions: SubregionRegion | null;
};

type SubregionPhoto = {
  id: string;
  storage_path: string | null;
  external_url: string | null;
};

type Wine = WineCardWine;

export default function SubregionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [subregion, setSubregion] = useState<Subregion | null>(null);
  const [photos, setPhotos] = useState<SubregionPhoto[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [allRegions, setAllRegions] = useState<EntityOption[]>([]);
  const [allRegionsFull, setAllRegionsFull] = useState<SubregionRegion[]>([]);
  const [allCountries, setAllCountries] = useState<EntityOption[]>([]);
  const [editingRegion, setEditingRegion] = useState(false);
  const [regionText, setRegionText] = useState("");
  const [pendingRegion, setPendingRegion] = useState<SubregionRegion | null>(null);
  const [creatingRegionName, setCreatingRegionName] = useState<string | null>(null);
  const [newRegionCountryText, setNewRegionCountryText] = useState("");
  const [newRegionPendingCountry, setNewRegionPendingCountry] = useState<EntityOption | null>(null);
  const [savingRegion, setSavingRegion] = useState(false);

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
      const [subregionRes, photosRes, winesRes, regionsRes, countriesRes] = await Promise.all([
        supabase.from("subregions").select("id,name,notes,cover_photo_url,region_id,regions(id,name,country_id,countries(id,name))").eq("id", id).maybeSingle(),
        supabase.from("subregion_photos").select("id,storage_path,external_url").eq("subregion_id", id).order("created_at", { ascending: true }),
        supabase.from("wines").select("id,name,vintage_year,producer_id,producers(name),countries(name),regions(name),subregions(name)").eq("subregion_id", id).order("name"),
        supabase.from("regions").select("id,name,country_id,countries(id,name)").order("name"),
        supabase.from("countries").select("id,name").order("name"),
      ]);

      if (subregionRes.error) { alert(subregionRes.error.message); return; }
      if (!subregionRes.data) { setNotFound(true); return; }

      const s = subregionRes.data as unknown as Subregion;
      setSubregion(s);
      setNameText(s.name);
      setRegionText(s.regions?.name ?? "");
      setPendingRegion(s.regions ?? null);
      setNotesText(s.notes ?? "");
      setPhotos((photosRes.data ?? []) as unknown as SubregionPhoto[]);
      setWines((winesRes.data ?? []) as unknown as Wine[]);

      type RegionRow = { id: number; name: string; country_id: number | null; countries: { id: number; name: string } | null };
      const rawRegions = (regionsRes.data ?? []) as unknown as RegionRow[];
      setAllRegionsFull(rawRegions);
      setAllRegions(rawRegions.map(r => ({
        id: r.id,
        name: r.name,
        hint: r.countries?.name ? `(${r.countries.name})` : undefined,
      })));
      setAllCountries((countriesRes.data ?? []) as EntityOption[]);
    }
  }, [supabase, id]);

  const wineGroups = useMemo(() => groupWinesForCards(wines), [wines]);

  async function saveName() {
    if (!subregion || !nameText.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("subregions").update({ name: nameText.trim() }).eq("id", subregion.id);
    setSavingName(false);
    if (error) { alert(error.message); return; }
    setSubregion(s => s ? { ...s, name: nameText.trim() } : s);
    setEditingName(false);
  }

  async function saveRegion() {
    if (!subregion) return;
    setSavingRegion(true);

    let newRegion: SubregionRegion | null = null;

    if (creatingRegionName) {
      // Creating a brand-new region; resolve the country first
      let country: { id: number; name: string } | null = null;
      const countryTrimmed = newRegionCountryText.trim();
      if (countryTrimmed) {
        if (newRegionPendingCountry && newRegionPendingCountry.name.toLowerCase() === countryTrimmed.toLowerCase()) {
          country = { id: newRegionPendingCountry.id, name: newRegionPendingCountry.name };
        } else {
          const existing = allCountries.find(c => c.name.toLowerCase() === countryTrimmed.toLowerCase());
          if (existing) {
            country = { id: existing.id, name: existing.name };
          } else {
            const { data, error } = await supabase.from("countries").insert({ name: countryTrimmed }).select("id,name").single();
            if (error) { alert(error.message); setSavingRegion(false); return; }
            country = data as { id: number; name: string };
            setAllCountries(cs => [...cs, { id: country!.id, name: country!.name }].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }
      }

      const { data, error } = await supabase.from("regions").insert({ name: creatingRegionName, country_id: country?.id ?? null }).select("id,name,country_id").single();
      if (error) { alert(error.message); setSavingRegion(false); return; }
      newRegion = { id: (data as { id: number; name: string; country_id: number | null }).id, name: creatingRegionName, country_id: country?.id ?? null, countries: country ? { id: country.id, name: country.name } : null };
      setAllRegions(rs => [...rs, { id: newRegion!.id, name: newRegion!.name, hint: country ? `(${country.name})` : undefined }].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (pendingRegion) {
      newRegion = pendingRegion;
    } else if (!regionText.trim()) {
      newRegion = null;
    } else {
      setSavingRegion(false);
      alert("Please select a region from the list or create a new one.");
      return;
    }

    const { error } = await supabase.from("subregions").update({ region_id: newRegion?.id ?? null }).eq("id", subregion.id);
    setSavingRegion(false);
    if (error) { alert(error.message); return; }

    setSubregion(s => s ? { ...s, region_id: newRegion?.id ?? null, regions: newRegion } : s);
    setCreatingRegionName(null);
    setNewRegionCountryText("");
    setNewRegionPendingCountry(null);
    setEditingRegion(false);
  }

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
          {editingName ? (
            <div className="mt-3 space-y-3">
              <Input
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                className="text-base"
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={saveName} disabled={savingName || !nameText.trim()}>
                  {savingName ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" onClick={() => { setEditingName(false); setNameText(subregion.name); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <PageTitle>{subregion.name}</PageTitle>
              <button
                type="button"
                onClick={() => { setNameText(subregion.name); setEditingName(true); }}
                className="mt-4 shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                Rename
              </button>
            </div>
          )}
          {wines.length > 0 && (
            <PageIntro>{wines.length} {wines.length === 1 ? "wine" : "wines"} in your cellar</PageIntro>
          )}
        </PageHero>

        {coverUrl && (
          <CoverPhoto
            className="mt-6"
            url={coverUrl}
            alt={subregion.name}
            onExpand={() => { const p = photos.find(ph => resolveUrl(ph) === coverUrl); if (p) setExpandedPhoto(p); }}
            onReplace={() => document.getElementById("entity-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            onRemove={clearLabelPhoto}
          />
        )}

        {/* Location */}
        <Card className="mt-8">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">Location</CardTitle>
            {!editingRegion && (
              <button
                type="button"
                onClick={() => {
                  setRegionText(subregion.regions?.name ?? "");
                  setPendingRegion(subregion.regions ?? null);
                  setCreatingRegionName(null);
                  setNewRegionCountryText("");
                  setNewRegionPendingCountry(null);
                  setEditingRegion(true);
                }}
                className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
              >
                {regionName ? "Edit" : "+ Add region"}
              </button>
            )}
          </div>

          {editingRegion ? (
            <div className="mt-4 space-y-3">
              {creatingRegionName ? (
                <>
                  <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    Creating region: <span className="font-medium">{creatingRegionName}</span>
                  </div>
                  <Field>
                    <FieldLabel>Country</FieldLabel>
                    <EntitySearchInput
                      options={allCountries}
                      value={newRegionCountryText}
                      onChange={setNewRegionCountryText}
                      onSelect={(opt) => { setNewRegionPendingCountry(opt); setNewRegionCountryText(opt.name); }}
                      onCreateNew={(name) => { setNewRegionCountryText(name); setNewRegionPendingCountry(null); }}
                      placeholder="Search or create country…"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={saveRegion} disabled={savingRegion}>
                      {savingRegion ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" onClick={() => setCreatingRegionName(null)}>
                      Back
                    </Button>
                    <Button variant="secondary" onClick={() => { setEditingRegion(false); setCreatingRegionName(null); }}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel>Region</FieldLabel>
                    <EntitySearchInput
                      options={allRegions}
                      value={regionText}
                      onChange={(text) => { setRegionText(text); setPendingRegion(null); }}
                      onSelect={(opt) => {
                        const full = allRegionsFull.find(r => r.id === opt.id);
                        setPendingRegion(full ?? { id: opt.id, name: opt.name, country_id: null, countries: null });
                        setRegionText(opt.name);
                      }}
                      onCreateNew={(name) => { setCreatingRegionName(name); setRegionText(name); }}
                      placeholder="Search or create region…"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={saveRegion} disabled={savingRegion}>
                      {savingRegion ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" onClick={() => { setEditingRegion(false); setRegionText(subregion.regions?.name ?? ""); }}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Region</div>
                {regionName && regionId ? (
                  <Link href={`/knowledge/regions/${regionId}`} className="mt-1 block text-sm font-medium text-stone-900 underline-offset-2 hover:underline">
                    {regionName}
                  </Link>
                ) : (
                  <div className="mt-1 text-sm text-stone-500">—</div>
                )}
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Country</div>
                {countryName && countryId ? (
                  <Link href={`/knowledge/countries/${countryId}`} className="mt-1 block text-sm font-medium text-stone-900 underline-offset-2 hover:underline">
                    {countryName}
                  </Link>
                ) : (
                  <div className="mt-1 text-sm text-stone-500">—</div>
                )}
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
            <CoverPhotoGrid
              items={photos.map((photo) => ({
                id: photo.id,
                url: resolveUrl(photo),
                alt: subregion.name,
                isCover: subregion.cover_photo_url === resolveUrl(photo),
                photo,
              }))}
              containerClassName="mt-4"
              itemClassName="h-24 w-24 shrink-0"
              coverBadgeText="Label"
              setCoverText="Set as label"
              onOpen={(item) => setExpandedPhoto(item.photo)}
              onSetCover={(item) => setLabelPhoto(item.photo)}
              onDelete={(item) => deletePhoto(item.photo)}
            />
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
          {wineGroups.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No wines recorded for this sub-region.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {wineGroups.map((group) => (
                <WineCard
                  key={`${group[0].producer_id ?? "none"}-${group[0].name}`}
                  wines={group}
                  hideFields={["subregion"]}
                />
              ))}
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
