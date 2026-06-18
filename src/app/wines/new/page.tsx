"use client";

import Link from "next/link";
import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { findProducerHierarchy, findRegionHierarchy, findSubregionHierarchy } from "@/lib/location-autofill";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import { isMissingRelationError } from "@/lib/supabase-errors";
import { PhotoPicker } from "@/components/PhotoPicker";
import AutocompleteInput from "@/components/AutocompleteInput";
import GrapeTagInput from "@/components/GrapeTagInput";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  grapeTagFromWineRow,
  resolveGrapeTagForSave,
  searchGrapeSuggestions,
  type GrapeTag,
  type WineGrapeRow,
} from "@/lib/grape-utils";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeField(v: string) {
  const t = v.trim();
  if (!t) return null;
  if (t.toUpperCase() === "NA") return null;
  return t;
}

function normalizeVintage(v: string): number | null | typeof Number.NaN {
  const t = v.trim();
  if (!t) return null;
  if (t.toUpperCase() === "NV") return null;
  if (t.toUpperCase() === "NA") return null;

  const year = Number(t);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return Number.NaN;
  return year;
}

type ExistingWine = {
  id: string;
  name: string;
  vintage_year: number | null;
  producer_id: number | null;
  producers: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
  wine_grapes?: WineGrapeRow[] | null;
};

function formatVintage(year: number | null) {
  return year ?? "NV";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddWinePage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [existingWines, setExistingWines] = useState<ExistingWine[]>([]);

  // Wine fields
  const [name, setName] = useState("");
  const [vintage, setVintage] = useState("");
  const [wineType, setWineType] = useState("");
  const [country, setCountry] = useState("NA");
  const [region, setRegion] = useState("NA");
  const [subregion, setSubregion] = useState("NA");
  const [producer, setProducer] = useState("NA");
  const [grapes, setGrapes] = useState<GrapeTag[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  // Tasting fields
  const [tastedOn, setTastedOn] = useState("");
  const [notes, setNotes] = useState("");

  // Pending photos (kept in sync by PhotoPicker via onChange)
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  // Name autocomplete
  const [nameSearch, setNameSearch] = useState("");
  const [nameOpen, setNameOpen] = useState(false);

  const loadExistingWines = useCallback(async () => {
    const { data, error } = await supabase
      .from("wines")
      .select(`
        id, name, vintage_year, producer_id,
        producers(name), countries(name), regions(name), subregions(name),
        wine_grapes(grape_id,display_name,grapes(name))
      `)
      .order("name")
      .limit(500);

    if (error) {
      alert(error.message);
      return;
    }

    setExistingWines((data as unknown as ExistingWine[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) location.href = "/";
      else loadExistingWines();
    });
  }, [supabase, loadExistingWines]);

  const wineNameFuse = useMemo(
    () =>
      new Fuse(existingWines, {
        keys: ["name"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [existingWines]
  );

  const wineNameSuggestions = useMemo(() => {
    const trimmed = nameSearch.trim();
    if (!trimmed) return [];
    return wineNameFuse.search(trimmed, { limit: 8 }).map((result) => result.item);
  }, [nameSearch, wineNameFuse]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-wine-name-picker]")) return;
      setNameOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const regionName = normalizeField(region);
    if (!regionName) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const match = await findRegionHierarchy(supabase, regionName, normalizeField(country));
        if (!cancelled && match?.countryName && match.countryName !== country) {
          setCountry(match.countryName);
        }
      } catch (error) {
        console.error("Failed to autofill country from region", error);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [country, region, supabase]);

  useEffect(() => {
    const subregionName = normalizeField(subregion);
    if (!subregionName) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const match = await findSubregionHierarchy(
          supabase,
          subregionName,
          normalizeField(region),
          normalizeField(country),
        );

        if (cancelled || !match) return;
        if (match.regionName !== region) setRegion(match.regionName);
        if (match.countryName && match.countryName !== country) setCountry(match.countryName);
      } catch (error) {
        console.error("Failed to autofill parent regions from sub-region", error);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [country, region, subregion, supabase]);

  useEffect(() => {
    const producerName = normalizeField(producer);
    if (!producerName) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const match = await findProducerHierarchy(
          supabase,
          producerName,
          normalizeField(region),
          normalizeField(country),
        );

        if (cancelled || !match) return;
        if (match.regionName && match.regionName !== region) setRegion(match.regionName);
        if (match.countryName && match.countryName !== country) setCountry(match.countryName);
      } catch (error) {
        console.error("Failed to autofill location from producer", error);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [country, producer, region, supabase]);

  async function autofillFromRegion(regionName: string) {
    const normalizedRegion = normalizeField(regionName);
    if (!normalizedRegion) return;

    try {
      const match = await findRegionHierarchy(supabase, normalizedRegion, normalizeField(country));
      if (match?.countryName) setCountry(match.countryName);
    } catch (error) {
      console.error("Failed to autofill country from region selection", error);
    }
  }

  async function autofillFromSubregion(subregionName: string) {
    const normalizedSubregion = normalizeField(subregionName);
    if (!normalizedSubregion) return;

    try {
      const match = await findSubregionHierarchy(
        supabase,
        normalizedSubregion,
        normalizeField(region),
        normalizeField(country),
      );

      if (!match) return;
      setRegion(match.regionName);
      if (match.countryName) setCountry(match.countryName);
    } catch (error) {
      console.error("Failed to autofill parent regions from sub-region selection", error);
    }
  }

  async function autofillFromProducer(producerName: string) {
    const normalizedProducer = normalizeField(producerName);
    if (!normalizedProducer) return;

    try {
      const match = await findProducerHierarchy(
        supabase,
        normalizedProducer,
        normalizeField(region),
        normalizeField(country),
      );

      if (!match) return;
      if (match.regionName) setRegion(match.regionName);
      if (match.countryName) setCountry(match.countryName);
    } catch (error) {
      console.error("Failed to autofill location from producer selection", error);
    }
  }

  function applyExistingWine(wine: ExistingWine) {
    setName(wine.name);
    setNameSearch(wine.name);
    setVintage(wine.vintage_year?.toString() ?? "NV");
    setCountry(wine.countries?.name ?? "NA");
    setRegion(wine.regions?.name ?? "NA");
    setSubregion(wine.subregions?.name ?? "NA");
    setProducer(wine.producers?.name ?? "NA");
    setGrapes(
      (wine.wine_grapes ?? [])
        .filter((entry) => entry.grapes?.name)
        .map((entry) => grapeTagFromWineRow(entry))
    );
    void loadGeneralNotes(wine.name, wine.producer_id);
    setNameOpen(false);
  }

  async function loadGeneralNotes(wineName: string, producerId: number | null) {
    if (!userId) return;

    let noteQuery = supabase
      .from("wine_group_notes")
      .select("notes")
      .eq("user_id", userId)
      .eq("wine_name", wineName);

    if (producerId === null) noteQuery = noteQuery.is("producer_id", null);
    else noteQuery = noteQuery.eq("producer_id", producerId);

    const { data, error } = await noteQuery.maybeSingle();
    if (error) {
      alert(error.message);
      return;
    }

    setGeneralNotes(data?.notes ?? "");
  }

  // ── DB helpers ────────────────────────────────────────────────────────────────

  async function ensureCountryId(countryName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("countries").select("id").eq("name", countryName).maybeSingle();
    if (selErr) throw selErr;
    if (existing?.id) return existing.id;
    const { data: inserted, error: insErr } = await supabase
      .from("countries").insert({ name: countryName }).select("id").single();
    if (insErr) throw insErr;
    return inserted.id;
  }

  async function ensureProducerId(producerName: string, regionId: number | null): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("producers").select("id,region_id").eq("name", producerName).maybeSingle();
    if (selErr) throw selErr;
    if (existing?.id) {
      if (existing.region_id === null && regionId !== null) {
        const { error: updateError } = await supabase
          .from("producers")
          .update({ region_id: regionId })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      }
      if (regionId !== null) {
        const { error: linkError } = await supabase
          .from("producer_regions")
          .upsert({ producer_id: existing.id, region_id: regionId }, { onConflict: "producer_id,region_id" });
        if (linkError && !isMissingRelationError(linkError, "producer_regions")) throw linkError;
      }
      return existing.id;
    }
    const { data: inserted, error: insErr } = await supabase
      .from("producers").insert({ name: producerName, region_id: regionId }).select("id").single();
    if (insErr) throw insErr;
    if (regionId !== null) {
      const { error: linkError } = await supabase
        .from("producer_regions")
        .upsert({ producer_id: inserted.id, region_id: regionId }, { onConflict: "producer_id,region_id" });
      if (linkError && !isMissingRelationError(linkError, "producer_regions")) throw linkError;
    }
    return inserted.id;
  }

  async function ensureRegionId(countryId: number, regionName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("regions").select("id").eq("country_id", countryId).eq("name", regionName).maybeSingle();
    if (selErr) throw selErr;
    if (existing?.id) return existing.id;
    const { data: inserted, error: insErr } = await supabase
      .from("regions").insert({ country_id: countryId, name: regionName }).select("id").single();
    if (insErr) throw insErr;
    return inserted.id;
  }

  async function ensureSubregionId(regionId: number, subregionName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("subregions").select("id").eq("region_id", regionId).eq("name", subregionName).maybeSingle();
    if (selErr) throw selErr;
    if (existing?.id) return existing.id;
    const { data: inserted, error: insErr } = await supabase
      .from("subregions").insert({ region_id: regionId, name: subregionName }).select("id").single();
    if (insErr) throw insErr;
    return inserted.id;
  }

  // Upload a single pending photo (file or URL) linked to a tasting or as general.
  // All values passed explicitly — avoids stale-closure issues with the React Compiler.
  async function savePendingPhoto(
    wineId: string,
    tastingId: string | null,
    photo: PendingPhoto,
    uid: string,
  ) {
    if (photo.url) {
      const { error } = await supabase.from("wine_photos").insert({
        wine_id: wineId, tasting_id: tastingId, external_url: photo.url,
      });
      if (error) alert(`Photo could not be saved: ${error.message}`);
      return;
    }

    if (photo.file) {
      let convertedFile: File;
      try {
        convertedFile = await convertIfNeeded(photo.file);
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        alert(`Could not convert image: ${message}.`);
        return;
      }
      const path = `${uid}/${wineId}/${photo.file.lastModified}_${convertedFile.name}`;
      const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, convertedFile);
      if (upErr) { alert(upErr.message); return; }
      const { error: insertErr } = await supabase.from("wine_photos").insert({
        wine_id: wineId, tasting_id: tastingId, storage_path: path,
      });
      if (insertErr) alert(`Photo uploaded but could not be linked: ${insertErr.message}`);
    }
  }

  async function saveWine() {
    if (!userId) return;

    const wineName = name.trim();
    if (!wineName) return alert("Name is required.");

    const vintageYear = normalizeVintage(vintage);
    if (
      vintage.trim() &&
      vintage.trim().toUpperCase() !== "NV" &&
      vintage.trim().toUpperCase() !== "NA" &&
      Number.isNaN(vintageYear)
    ) {
      return alert("Vintage must be a year like 2019, or NV, or NA.");
    }

    const countryName = normalizeField(country);
    const regionName = normalizeField(region);
    const subregionName = normalizeField(subregion);
    const producerName = normalizeField(producer);

    const hasTasting = notes.trim() || tastedOn;
    const hasGeneralNotes = generalNotes.trim().length > 0;
    const photosSnapshot = pendingPhotos; // capture before any async work

    let country_id: number | null = null;
    let region_id: number | null = null;
    let subregion_id: number | null = null;
    let producer_id: number | null = null;

    try {
      if (countryName) country_id = await ensureCountryId(countryName);
      if (regionName && country_id) region_id = await ensureRegionId(country_id, regionName);
      if (subregionName && region_id) subregion_id = await ensureSubregionId(region_id, subregionName);
      if (producerName) producer_id = await ensureProducerId(producerName, region_id);

      // Check for an existing wine with identical details
      let dupQuery = supabase.from("wines").select("id").eq("name", wineName);
      if (vintageYear === null || vintageYear === undefined) { dupQuery = dupQuery.is("vintage_year", null); }
      else { dupQuery = dupQuery.eq("vintage_year", vintageYear as number); }
      if (country_id === null) { dupQuery = dupQuery.is("country_id", null); }
      else { dupQuery = dupQuery.eq("country_id", country_id); }
      if (region_id === null) { dupQuery = dupQuery.is("region_id", null); }
      else { dupQuery = dupQuery.eq("region_id", region_id); }
      if (subregion_id === null) { dupQuery = dupQuery.is("subregion_id", null); }
      else { dupQuery = dupQuery.eq("subregion_id", subregion_id); }
      if (producer_id === null) { dupQuery = dupQuery.is("producer_id", null); }
      else { dupQuery = dupQuery.eq("producer_id", producer_id); }

      const { data: existingMatch, error: dupError } = await dupQuery.maybeSingle();
      if (dupError) return alert(dupError.message);

      if (existingMatch) {
        if (hasGeneralNotes) {
          let groupNoteQuery = supabase
            .from("wine_group_notes")
            .select("id")
            .eq("user_id", userId)
            .eq("wine_name", wineName);

          if (producer_id === null) groupNoteQuery = groupNoteQuery.is("producer_id", null);
          else groupNoteQuery = groupNoteQuery.eq("producer_id", producer_id);

          const { data: existingGroupNote, error: groupNoteSelectError } = await groupNoteQuery.maybeSingle();
          if (groupNoteSelectError) return alert(groupNoteSelectError.message);

          if (existingGroupNote?.id) {
            const { error: updateGroupNoteError } = await supabase
              .from("wine_group_notes")
              .update({ notes: generalNotes.trim() })
              .eq("id", existingGroupNote.id);
            if (updateGroupNoteError) return alert(updateGroupNoteError.message);
          } else {
            const { error: insertGroupNoteError } = await supabase
              .from("wine_group_notes")
              .insert({
                user_id: userId,
                wine_name: wineName,
                producer_id,
                notes: generalNotes.trim(),
              });
            if (insertGroupNoteError) return alert(insertGroupNoteError.message);
          }
        }

        // Wine already exists — add tasting + photos, then redirect
        let savedTastingId: string | null = null;
        if (hasTasting) {
          const { data: td, error: te } = await supabase.from("wine_tastings")
            .insert({ wine_id: existingMatch.id, tasted_on: tastedOn || null, notes: notes.trim() || null })
            .select("id").single();
          if (te) return alert(te.message);
          savedTastingId = td.id;
        }
        if (photosSnapshot.length > 0) {
          setUploading(true);
          const tastingId = hasTasting ? savedTastingId : null;
          for (const photo of photosSnapshot) {
            await savePendingPhoto(existingMatch.id, tastingId, photo, userId);
          }
          setUploading(false);
        }
        location.href = `/wines/${existingMatch.id}`;
        return;
      }

      // No match — create a new wine entry
      const { data: newWine, error } = await supabase.from("wines").insert({
        user_id: userId,
        name: wineName,
        vintage_year: vintageYear ?? null,
        wine_type: wineType || null,
        country_id, region_id, subregion_id, producer_id,
      }).select("id").single();
      if (error) return alert(error.message);

      if (grapes.length > 0) {
        const resolvedGrapes = await Promise.all(grapes.map((grape) => resolveGrapeTagForSave(supabase, grape)));
        const { error: grapeError } = await supabase.from("wine_grapes").insert(
          resolvedGrapes.map((grape) => ({
            wine_id: newWine.id,
            grape_id: grape.grapeId,
            display_name: grape.displayName,
          }))
        );
        if (grapeError) return alert(grapeError.message);
      }

      if (hasGeneralNotes) {
        const { error: generalNotesError } = await supabase
          .from("wine_group_notes")
          .insert({
            user_id: userId,
            wine_name: wineName,
            producer_id,
            notes: generalNotes.trim(),
          });
        if (generalNotesError) return alert(generalNotesError.message);
      }

      let savedTastingId: string | null = null;
      if (hasTasting) {
        const { data: td, error: te } = await supabase.from("wine_tastings")
          .insert({ wine_id: newWine.id, tasted_on: tastedOn || null, notes: notes.trim() || null })
          .select("id").single();
        if (te) return alert(te.message);
        savedTastingId = td.id;
      }

      if (photosSnapshot.length > 0) {
        setUploading(true);
        const tastingId = hasTasting ? savedTastingId : null;
        for (const photo of photosSnapshot) {
          await savePendingPhoto(newWine.id, tastingId, photo, userId);
        }
        setUploading(false);
      }

      location.href = `/wines/${newWine.id}`;
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to save wine.");
    }
  }

  return (
    <PageShell>
      <PageContainer className="max-w-2xl">
        <PageHero>
          <Eyebrow>
            <Link href="/wines" className="inline-flex items-center gap-1 hover:text-stone-700">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3">
                <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cancel
            </Link>
          </Eyebrow>
          <PageTitle>Log a new bottle to your cellar</PageTitle>
          <PageIntro>
            Fill in what you know. Leave unknown fields as NA, and add wine-level notes separately from your first tasting note.
          </PageIntro>
        </PageHero>

        <Card className="mt-8">
          <CardTitle>Wine Details</CardTitle>

          <div className="mt-6 grid gap-4">
            <Field>
              <FieldLabel>Name *</FieldLabel>
              <div className="relative" data-wine-name-picker>
                <Input
                  placeholder="e.g. Chateau Lafite"
                  value={nameSearch}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNameSearch(nextValue);
                    setName(nextValue);
                    setNameOpen(true);
                  }}
                  onFocus={() => nameSearch.trim() && setNameOpen(true)}
                  onKeyDown={(e) => e.key === "Escape" && setNameOpen(false)}
                  autoComplete="off"
                />

                {nameOpen && wineNameSuggestions.length > 0 && (
                  <ul className="absolute top-full z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
                    {wineNameSuggestions.map((wine) => (
                      <li key={wine.id}>
                        <button
                          type="button"
                          className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-stone-50"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyExistingWine(wine);
                          }}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium text-stone-900">{wine.name}</span>
                            <span className="text-xs text-stone-500">{formatVintage(wine.vintage_year)}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-stone-500">
                            {[wine.producers?.name, wine.countries?.name, wine.regions?.name, wine.subregions?.name]
                              .filter(Boolean).join(" · ")}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel>Vintage (year / NV / NA)</FieldLabel>
              <Input
                placeholder="e.g. 2019 or NV"
                value={vintage}
                onChange={(e) => setVintage(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel>Wine Type</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(["sparkling", "white", "rose", "red", "fortified"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setWineType(wineType === type ? "" : type)}
                    className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${
                      wineType === type
                        ? "border-stone-800 bg-stone-800 text-white"
                        : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                    }`}
                  >
                    {type === "rose" ? "Rosé" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel>Country (or NA)</FieldLabel>
              <AutocompleteInput
                value={country}
                onChange={setCountry}
                placeholder="e.g. France"
                fetchSuggestions={async (q) => {
                  const { data } = await supabase.from("countries").select("name").ilike("name", `%${q}%`).limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Region (or NA)</FieldLabel>
              <AutocompleteInput
                value={region}
                onChange={setRegion}
                onSelect={autofillFromRegion}
                placeholder="e.g. Burgundy"
                fetchSuggestions={async (q) => {
                  const countryName = country.trim().toUpperCase() !== "NA" ? country.trim() : null;
                  let qb = supabase.from("regions").select("name").ilike("name", `%${q}%`);
                  if (countryName) {
                    const { data: c } = await supabase.from("countries").select("id").eq("name", countryName).maybeSingle();
                    if (c?.id) qb = qb.eq("country_id", c.id);
                  }
                  const { data } = await qb.limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Sub-region (or NA)</FieldLabel>
              <AutocompleteInput
                value={subregion}
                onChange={setSubregion}
                onSelect={autofillFromSubregion}
                placeholder="e.g. Côte de Nuits"
                fetchSuggestions={async (q) => {
                  const regionName = region.trim().toUpperCase() !== "NA" ? region.trim() : null;
                  let qb = supabase.from("subregions").select("name").ilike("name", `%${q}%`);
                  if (regionName) {
                    const countryName = country.trim().toUpperCase() !== "NA" ? country.trim() : null;
                    let rqb = supabase.from("regions").select("id").eq("name", regionName);
                    if (countryName) {
                      const { data: c } = await supabase.from("countries").select("id").eq("name", countryName).maybeSingle();
                      if (c?.id) rqb = rqb.eq("country_id", c.id);
                    }
                    const { data: r } = await rqb.maybeSingle();
                    if (r?.id) qb = qb.eq("region_id", r.id);
                  }
                  const { data } = await qb.limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Grapes</FieldLabel>
              <GrapeTagInput
                value={grapes}
                onChange={setGrapes}
                placeholder="e.g. Cabernet Sauvignon"
                fetchSuggestions={(q) => searchGrapeSuggestions(supabase, q)}
              />
            </Field>

            <Field>
              <FieldLabel>Producer (or NA)</FieldLabel>
              <AutocompleteInput
                value={producer}
                onChange={setProducer}
                onSelect={autofillFromProducer}
                placeholder="e.g. Domaine de la Romanée-Conti"
                fetchSuggestions={async (q) => {
                  const qb = supabase.from("producers").select("name").ilike("name", `%${q}%`);
                  const regionName = region.trim().toUpperCase() !== "NA" ? region.trim() : null;
                  if (regionName) {
                    const countryName = country.trim().toUpperCase() !== "NA" ? country.trim() : null;
                    let regionQuery = supabase.from("regions").select("id").eq("name", regionName);
                    if (countryName) {
                      const { data: countryRow } = await supabase.from("countries").select("id").eq("name", countryName).maybeSingle();
                      if (countryRow?.id) regionQuery = regionQuery.eq("country_id", countryRow.id);
                    }
                    const { data: regionRow } = await regionQuery.maybeSingle();
                    if (regionRow?.id) {
                      const [mainRes, linkedRes] = await Promise.all([
                        qb.eq("region_id", regionRow.id).limit(8),
                        supabase
                          .from("producer_regions")
                          .select("producers!inner(name)")
                          .eq("region_id", regionRow.id)
                          .ilike("producers.name", `%${q}%`)
                          .limit(8),
                      ]);
                      const names = new Set<string>();
                      (mainRes.data ?? []).forEach((entry) => names.add(entry.name));
                      ((linkedRes.data ?? []) as unknown as { producers: { name: string } | null }[])
                        .forEach((entry) => {
                          if (entry.producers?.name) names.add(entry.producers.name);
                        });
                      return Array.from(names).slice(0, 8);
                    }
                  }
                  const { data } = await qb.limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

            <div className="border-t border-stone-200 pt-5">
              <CardTitle className="text-xl">General Wine Notes</CardTitle>
              <CardDescription className="mt-2">
                Notes about the wine overall across all vintages: style, aging, producer context, food pairings.
              </CardDescription>

              <div className="mt-4">
                <Field>
                  <FieldLabel>General notes</FieldLabel>
                  <Textarea
                    className="min-h-[140px]"
                    placeholder="What should you remember about this wine overall?"
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* ── First Tasting Note ────────────────────────────────────────── */}
            <div className="border-t border-stone-200 pt-5">
              <CardTitle className="text-xl">First Tasting Note</CardTitle>
              <CardDescription className="mt-2">Optional, but useful if you are entering a bottle after tasting it.</CardDescription>

              <div className="mt-4 grid gap-4">
                <Field>
                  <FieldLabel>Date tasted</FieldLabel>
                  <Input type="date" value={tastedOn} onChange={(e) => setTastedOn(e.target.value)} />
                </Field>

                <Field>
                  <FieldLabel>Notes</FieldLabel>
                  <Textarea
                    className="min-h-[140px]"
                    placeholder="What did you taste, smell, pair it with, or want to remember?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>Photos</FieldLabel>
                  <PhotoPicker
                    onChange={setPendingPhotos}
                    hintText={
                      tastedOn || notes.trim()
                        ? "Attached to this tasting note."
                        : "Will be saved as general wine photos (no tasting note filled in)."
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={saveWine} disabled={uploading}>
                {uploading ? "Uploading photos…" : "Save Wine"}
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    </PageShell>
  );
}
