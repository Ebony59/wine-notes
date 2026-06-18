"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WineCard, groupWinesForCards, type WineCardWine } from "@/components/WineCard";
import { createClient } from "@/lib/supabase/client";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import { isMissingRelationError } from "@/lib/supabase-errors";
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

type Wine = WineCardWine;

type Region = {
  id: number;
  name: string;
  country_id: number | null;
  countries: { id: number; name: string } | null;
};

type ProducerRegion = {
  region_id: number;
  regions: Region | null;
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
  const [producerRegions, setProducerRegions] = useState<Region[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [allCountries, setAllCountries] = useState<EntityOption[]>([]);
  const [editingLocation, setEditingLocation] = useState(false);
  const [regionText, setRegionText] = useState("");
  const [pendingRegion, setPendingRegion] = useState<Region | null>(null);
  const [creatingRegionName, setCreatingRegionName] = useState<string | null>(null);
  const [newRegionCountryText, setNewRegionCountryText] = useState("");
  const [newRegionPendingCountry, setNewRegionPendingCountry] = useState<EntityOption | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [addingActiveRegion, setAddingActiveRegion] = useState(false);
  const [activeRegionText, setActiveRegionText] = useState("");
  const [pendingActiveRegion, setPendingActiveRegion] = useState<Region | null>(null);
  const [creatingActiveRegionName, setCreatingActiveRegionName] = useState<string | null>(null);
  const [activeRegionCountryText, setActiveRegionCountryText] = useState("");
  const [activeRegionPendingCountry, setActiveRegionPendingCountry] = useState<EntityOption | null>(null);
  const [savingActiveRegion, setSavingActiveRegion] = useState(false);

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
      const [producerRes, photosRes, winesRes, regionsRes, countriesRes, producerRegionsRes] = await Promise.all([
        supabase.from("producers").select("id,name,region_id,notes,cover_photo_url,regions(name,countries(name))").eq("id", id).maybeSingle(),
        supabase
          .from("producer_photos")
          .select("id,storage_path,external_url")
          .eq("producer_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("wines")
          .select("id,name,vintage_year,producer_id,producers(name),countries(name),regions(name),subregions(name)")
          .eq("producer_id", id)
          .order("name"),
        supabase.from("regions").select("id,name,country_id,countries(id,name)").order("name"),
        supabase.from("countries").select("id,name").order("name"),
        supabase.from("producer_regions").select("region_id,regions(id,name,country_id,countries(id,name))").eq("producer_id", id),
      ]);

      if (producerRes.error) { alert(producerRes.error.message); return; }
      if (!producerRes.data) { setNotFound(true); return; }
      if (producerRegionsRes.error && !isMissingRelationError(producerRegionsRes.error, "producer_regions")) {
        alert(producerRegionsRes.error.message);
        return;
      }

      const p = producerRes.data as unknown as Producer;
      setProducer(p);
      setNameText(p.name);
      setNotesText(p.notes ?? "");
      const currentRegion = p.region_id && regionsRes.data
        ? (regionsRes.data as unknown as Region[]).find(r => r.id === p.region_id) ?? null
        : null;
      setRegionText(currentRegion?.name ?? p.regions?.name ?? "");
      setPendingRegion(currentRegion);
      setPhotos((photosRes.data ?? []) as unknown as ProducerPhoto[]);
      setWines((winesRes.data ?? []) as unknown as Wine[]);
      if (regionsRes.error) { alert(regionsRes.error.message); return; }
      setRegions((regionsRes.data ?? []) as unknown as Region[]);
      setAllCountries((countriesRes.data ?? []) as EntityOption[]);
      const linkedRegions = ((producerRegionsRes.error ? [] : producerRegionsRes.data ?? []) as unknown as ProducerRegion[])
        .map((entry) => entry.regions)
        .filter((entry): entry is Region => entry !== null);
      if (currentRegion && !linkedRegions.some((entry) => entry.id === currentRegion.id)) {
        linkedRegions.push(currentRegion);
      }
      setProducerRegions(linkedRegions.sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [supabase, id]);

  const wineGroups = useMemo(() => groupWinesForCards(wines), [wines]);

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

  async function saveName() {
    if (!producer || !nameText.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("producers").update({ name: nameText.trim() }).eq("id", producer.id);
    setSavingName(false);
    if (error) { alert(error.message); return; }
    setProducer(p => p ? { ...p, name: nameText.trim() } : p);
    setEditingName(false);
  }

  async function saveLocation() {
    if (!producer) return;
    setSavingLocation(true);

    let newRegion: Region | null = null;

    if (creatingRegionName) {
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
            if (error) { alert(error.message); setSavingLocation(false); return; }
            country = data as { id: number; name: string };
            setAllCountries(cs => [...cs, { id: country!.id, name: country!.name }].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }
      }

      const { data, error } = await supabase.from("regions").insert({ name: creatingRegionName, country_id: country?.id ?? null }).select("id,name,country_id").single();
      if (error) { alert(error.message); setSavingLocation(false); return; }
      const newId = (data as { id: number }).id;
      newRegion = { id: newId, name: creatingRegionName, country_id: country?.id ?? null, countries: country ? { id: country.id, name: country.name } : null };
      setRegions(rs => [...rs, newRegion!].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (pendingRegion) {
      newRegion = pendingRegion;
    } else if (!regionText.trim()) {
      newRegion = null;
    } else {
      setSavingLocation(false);
      alert("Please select a region from the list or create a new one.");
      return;
    }

    const { error } = await supabase.from("producers").update({ region_id: newRegion?.id ?? null }).eq("id", producer.id);
    if (error) { setSavingLocation(false); alert(error.message); return; }
    if (newRegion) {
      const { error: linkError } = await supabase
        .from("producer_regions")
        .upsert({ producer_id: producer.id, region_id: newRegion.id }, { onConflict: "producer_id,region_id" });
      if (linkError && !isMissingRelationError(linkError, "producer_regions")) { setSavingLocation(false); alert(linkError.message); return; }
      setProducerRegions(current => (
        current.some((entry) => entry.id === newRegion!.id)
          ? current
          : [...current, newRegion!].sort((a, b) => a.name.localeCompare(b.name))
      ));
    }
    setSavingLocation(false);

    setProducer(current => current ? {
      ...current,
      region_id: newRegion?.id ?? null,
      regions: newRegion ? { name: newRegion.name, countries: newRegion.countries ? { name: newRegion.countries.name } : null } : null,
    } : current);
    setCreatingRegionName(null);
    setNewRegionCountryText("");
    setNewRegionPendingCountry(null);
    setEditingLocation(false);
  }

  async function createRegion(name: string, countryText: string, pendingCountry: EntityOption | null): Promise<Region | null> {
    let country: { id: number; name: string } | null = null;
    const countryTrimmed = countryText.trim();
    if (countryTrimmed) {
      if (pendingCountry && pendingCountry.name.toLowerCase() === countryTrimmed.toLowerCase()) {
        country = { id: pendingCountry.id, name: pendingCountry.name };
      } else {
        const existing = allCountries.find(c => c.name.toLowerCase() === countryTrimmed.toLowerCase());
        if (existing) {
          country = { id: existing.id, name: existing.name };
        } else {
          const { data, error } = await supabase.from("countries").insert({ name: countryTrimmed }).select("id,name").single();
          if (error) { alert(error.message); return null; }
          country = data as { id: number; name: string };
          setAllCountries(cs => [...cs, { id: country!.id, name: country!.name }].sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    }

    const { data, error } = await supabase.from("regions").insert({ name, country_id: country?.id ?? null }).select("id,name,country_id").single();
    if (error) { alert(error.message); return null; }
    const newRegion = { id: (data as { id: number }).id, name, country_id: country?.id ?? null, countries: country ? { id: country.id, name: country.name } : null };
    setRegions(current => [...current, newRegion].sort((a, b) => a.name.localeCompare(b.name)));
    return newRegion;
  }

  function beginAddActiveRegion() {
    setAddingActiveRegion(true);
    setActiveRegionText("");
    setPendingActiveRegion(null);
    setCreatingActiveRegionName(null);
    setActiveRegionCountryText("");
    setActiveRegionPendingCountry(null);
  }

  async function saveActiveRegion() {
    if (!producer) return;
    setSavingActiveRegion(true);

    let nextRegion: Region | null = null;
    if (creatingActiveRegionName) {
      nextRegion = await createRegion(creatingActiveRegionName, activeRegionCountryText, activeRegionPendingCountry);
      if (!nextRegion) { setSavingActiveRegion(false); return; }
    } else if (pendingActiveRegion) {
      nextRegion = pendingActiveRegion;
    } else {
      setSavingActiveRegion(false);
      alert("Please select a region from the list or create a new one.");
      return;
    }

    const { error } = await supabase
      .from("producer_regions")
      .upsert({ producer_id: producer.id, region_id: nextRegion.id }, { onConflict: "producer_id,region_id" });
    setSavingActiveRegion(false);
    if (error && !isMissingRelationError(error, "producer_regions")) { alert(error.message); return; }

    setProducerRegions(current => (
      current.some((entry) => entry.id === nextRegion!.id)
        ? current
        : [...current, nextRegion!].sort((a, b) => a.name.localeCompare(b.name))
    ));
    setAddingActiveRegion(false);
    setCreatingActiveRegionName(null);
  }

  async function setMainRegion(region: Region) {
    if (!producer) return;
    const { error } = await supabase.from("producers").update({ region_id: region.id }).eq("id", producer.id);
    if (error) { alert(error.message); return; }
    const { error: linkError } = await supabase.from("producer_regions").upsert({ producer_id: producer.id, region_id: region.id }, { onConflict: "producer_id,region_id" });
    if (linkError && !isMissingRelationError(linkError, "producer_regions")) { alert(linkError.message); return; }
    setProducer(current => current ? {
      ...current,
      region_id: region.id,
      regions: { name: region.name, countries: region.countries ? { name: region.countries.name } : null },
    } : current);
  }

  async function removeActiveRegion(region: Region) {
    if (!producer) return;
    if (producer.region_id === region.id) {
      alert("Choose a different main region before removing this one.");
      return;
    }

    const { error } = await supabase
      .from("producer_regions")
      .delete()
      .eq("producer_id", producer.id)
      .eq("region_id", region.id);
    if (error && !isMissingRelationError(error, "producer_regions")) { alert(error.message); return; }
    setProducerRegions(current => current.filter((entry) => entry.id !== region.id));
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
  const mainRegionId = producer.region_id;
  const displayedRegions = producerRegions.length > 0
    ? producerRegions
    : regions.filter((region) => region.id === mainRegionId);

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
                <Button variant="secondary" onClick={() => { setEditingName(false); setNameText(producer.name); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <PageTitle>{producer.name}</PageTitle>
              <button
                type="button"
                onClick={() => { setNameText(producer.name); setEditingName(true); }}
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

        {/* Label photo (cover) — displayed prominently at the top when set */}
        {coverUrl && (
          <CoverPhoto
            className="mt-6"
            url={coverUrl}
            alt={producer.name}
            onExpand={() => { const p = photos.find(ph => resolveUrl(ph) === coverUrl); if (p) setExpandedPhoto(p); }}
            onReplace={() => document.getElementById("entity-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            onRemove={clearLabelPhoto}
          />
        )}

        <Card className="mt-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Regions</CardTitle>
              <CardDescription className="mt-2">
                The main region controls where this producer is grouped in My Knowledge.
              </CardDescription>
            </div>
            {!editingLocation && (
              <button
                type="button"
                onClick={() => {
                  const current = producer.region_id ? regions.find(r => r.id === producer.region_id) ?? null : null;
                  setRegionText(current?.name ?? producer.regions?.name ?? "");
                  setPendingRegion(current);
                  setCreatingRegionName(null);
                  setNewRegionCountryText("");
                  setNewRegionPendingCountry(null);
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
                    <Button onClick={saveLocation} disabled={savingLocation}>
                      {savingLocation ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" onClick={() => setCreatingRegionName(null)}>
                      Back
                    </Button>
                    <Button variant="secondary" onClick={() => { setEditingLocation(false); setCreatingRegionName(null); }}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel>Main region</FieldLabel>
                    <EntitySearchInput
                      options={regions.map(r => ({ id: r.id, name: r.name, hint: r.countries?.name ? `(${r.countries.name})` : undefined }))}
                      value={regionText}
                      onChange={(text) => { setRegionText(text); setPendingRegion(null); }}
                      onSelect={(opt) => {
                        const full = regions.find(r => r.id === opt.id) ?? null;
                        setPendingRegion(full);
                        setRegionText(opt.name);
                      }}
                      onCreateNew={(name) => { setCreatingRegionName(name); setRegionText(name); }}
                      placeholder="Search or create region…"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={saveLocation} disabled={savingLocation}>
                      {savingLocation ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setEditingLocation(false); setCreatingRegionName(null); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {displayedRegions.length === 0 ? (
                <p className="text-sm text-stone-500">No regions assigned.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {displayedRegions.map((region) => {
                    const isMain = mainRegionId === region.id;
                    return (
                      <div key={region.id} className={`rounded-2xl border px-4 py-3 ${isMain ? "border-amber-300 bg-amber-50/70" : "border-stone-200 bg-stone-50/80"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-[0.18em] text-stone-500">Region</div>
                            <Link href={`/knowledge/regions/${region.id}`} className="mt-1 block text-sm font-medium text-stone-900 underline-offset-2 hover:underline">
                              {region.name}
                            </Link>
                            <div className="mt-0.5 text-xs text-stone-500">{region.countries?.name ?? "Country: NA"}</div>
                          </div>
                          {isMain && (
                            <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">Main</span>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {!isMain && (
                            <>
                              <button type="button" onClick={() => setMainRegion(region)} className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white">
                                Make main
                              </button>
                              <button type="button" onClick={() => removeActiveRegion(region)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50">
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {addingActiveRegion ? (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                  {creatingActiveRegionName ? (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-white px-3 py-2 text-sm text-stone-700">
                        Creating region: <span className="font-medium">{creatingActiveRegionName}</span>
                      </div>
                      <Field>
                        <FieldLabel>Country</FieldLabel>
                        <EntitySearchInput
                          options={allCountries}
                          value={activeRegionCountryText}
                          onChange={setActiveRegionCountryText}
                          onSelect={(opt) => { setActiveRegionPendingCountry(opt); setActiveRegionCountryText(opt.name); }}
                          onCreateNew={(name) => { setActiveRegionCountryText(name); setActiveRegionPendingCountry(null); }}
                          placeholder="Search or create country..."
                        />
                      </Field>
                    </div>
                  ) : (
                    <Field>
                      <FieldLabel>Additional region</FieldLabel>
                      <EntitySearchInput
                        options={regions.map(r => ({ id: r.id, name: r.name, hint: r.countries?.name ? `(${r.countries.name})` : undefined }))}
                        value={activeRegionText}
                        onChange={(text) => { setActiveRegionText(text); setPendingActiveRegion(null); }}
                        onSelect={(opt) => {
                          const full = regions.find(r => r.id === opt.id) ?? null;
                          setPendingActiveRegion(full);
                          setActiveRegionText(opt.name);
                        }}
                        onCreateNew={(name) => { setCreatingActiveRegionName(name); setActiveRegionText(name); }}
                        placeholder="Search or create region..."
                      />
                    </Field>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button onClick={saveActiveRegion} disabled={savingActiveRegion}>
                      {savingActiveRegion ? "Saving..." : "Save"}
                    </Button>
                    {creatingActiveRegionName && (
                      <Button variant="secondary" onClick={() => setCreatingActiveRegionName(null)}>
                        Back
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setAddingActiveRegion(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={beginAddActiveRegion}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-700 transition hover:border-stone-500 hover:bg-white"
                >
                  + Add region
                </button>
              )}
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
            <CoverPhotoGrid
              items={photos.map((photo) => ({
                id: photo.id,
                url: resolveUrl(photo),
                alt: producer.name,
                isCover: producer.cover_photo_url === resolveUrl(photo),
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
          {wineGroups.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No wines recorded for this producer.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {wineGroups.map((group) => (
                <WineCard
                  key={`${group[0].producer_id ?? "none"}-${group[0].name}`}
                  wines={group}
                  hideFields={["producer"]}
                />
              ))}
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
