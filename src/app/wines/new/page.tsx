"use client";

import Fuse from "fuse.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AutocompleteInput from "@/components/AutocompleteInput";
import TagAutocompleteInput from "@/components/TagAutocompleteInput";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";

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
  producers: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
  wine_grapes?: { grapes: { name: string } | null }[] | null;
};

function formatVintage(year: number | null) {
  return year ?? "NV";
}

export default function AddWinePage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [existingWines, setExistingWines] = useState<ExistingWine[]>([]);

  const [name, setName] = useState("");
  const [vintage, setVintage] = useState("");
  const [country, setCountry] = useState("NA");
  const [region, setRegion] = useState("NA");
  const [subregion, setSubregion] = useState("NA");
  const [producer, setProducer] = useState("NA");
  const [grapes, setGrapes] = useState<string[]>([]);
  const [tastedOn, setTastedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [nameOpen, setNameOpen] = useState(false);

  const loadExistingWines = useCallback(async () => {
    const { data, error } = await supabase
      .from("wines")
      .select(`
        id, name, vintage_year,
        producers(name), countries(name), regions(name), subregions(name),
        wine_grapes(grapes(name))
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
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
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

  function applyExistingWine(wine: ExistingWine) {
    setName(wine.name);
    setNameSearch(wine.name);
    setVintage(wine.vintage_year?.toString() ?? "NV");
    setCountry(wine.countries?.name ?? "NA");
    setRegion(wine.regions?.name ?? "NA");
    setSubregion(wine.subregions?.name ?? "NA");
    setProducer(wine.producers?.name ?? "NA");
    setGrapes(
      Array.from(
        new Set(
          (wine.wine_grapes ?? [])
            .map((entry) => entry.grapes?.name)
            .filter((value): value is string => Boolean(value))
        )
      )
    );
    setNameOpen(false);
  }

  async function ensureCountryId(countryName: string): Promise<number> {
    // countries.name is unique
    const { data: existing, error: selErr } = await supabase
      .from("countries")
      .select("id")
      .eq("name", countryName)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing?.id) return existing.id;

    const { data: inserted, error: insErr } = await supabase
      .from("countries")
      .insert({ name: countryName })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return inserted.id;
  }

  async function ensureProducerId(producerName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("producers")
      .select("id")
      .eq("name", producerName)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing?.id) return existing.id;

    const { data: inserted, error: insErr } = await supabase
      .from("producers")
      .insert({ name: producerName })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return inserted.id;
  }

  async function ensureRegionId(countryId: number, regionName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("regions")
      .select("id")
      .eq("country_id", countryId)
      .eq("name", regionName)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing?.id) return existing.id;

    const { data: inserted, error: insErr } = await supabase
      .from("regions")
      .insert({ country_id: countryId, name: regionName })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return inserted.id;
  }

  async function ensureSubregionId(regionId: number, subregionName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("subregions")
      .select("id")
      .eq("region_id", regionId)
      .eq("name", subregionName)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing?.id) return existing.id;

    const { data: inserted, error: insErr } = await supabase
      .from("subregions")
      .insert({ region_id: regionId, name: subregionName })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return inserted.id;
  }

  async function ensureGrapeId(grapeName: string): Promise<number> {
    const { data: existing, error: selErr } = await supabase
      .from("grapes")
      .select("id")
      .eq("name", grapeName)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing?.id) return existing.id;

    const { data: inserted, error: insErr } = await supabase
      .from("grapes")
      .insert({ name: grapeName })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return inserted.id;
  }

  async function saveWine() {
    if (!userId) return;

    const wineName = name.trim();
    if (!wineName) return alert("Name is required.");

    const vintageYear = normalizeVintage(vintage);
    if ((vintage.trim() && vintage.trim().toUpperCase() !== "NV" && vintage.trim().toUpperCase() !== "NA") && Number.isNaN(vintageYear)) {
      return alert("Vintage must be a year like 2019, or NV, or NA.");
    }

    const countryName = normalizeField(country);
    const regionName = normalizeField(region);
    const subregionName = normalizeField(subregion);
    const producerName = normalizeField(producer);

    // Build IDs only when provided
    let country_id: number | null = null;
    let region_id: number | null = null;
    let subregion_id: number | null = null;
    let producer_id: number | null = null;

    try {
      if (countryName) {
        country_id = await ensureCountryId(countryName);
      }

      // If region is set but country is NA, we still allow saving wine (just won't create region)
      if (regionName && country_id) {
        region_id = await ensureRegionId(country_id, regionName);
      }

      // If subregion is set but region/country missing, we allow saving (just won't create subregion)
      if (subregionName && region_id) {
        subregion_id = await ensureSubregionId(region_id, subregionName);
      }

      if (producerName) {
        producer_id = await ensureProducerId(producerName);
      }

      // Check for an existing wine with identical details before creating a new one
      let dupQuery = supabase.from("wines").select("id").eq("name", wineName);
      if (vintageYear === null || vintageYear === undefined) {
        dupQuery = dupQuery.is("vintage_year", null);
      } else {
        dupQuery = dupQuery.eq("vintage_year", vintageYear as number);
      }
      if (country_id === null) {
        dupQuery = dupQuery.is("country_id", null);
      } else {
        dupQuery = dupQuery.eq("country_id", country_id);
      }
      if (region_id === null) {
        dupQuery = dupQuery.is("region_id", null);
      } else {
        dupQuery = dupQuery.eq("region_id", region_id);
      }
      if (subregion_id === null) {
        dupQuery = dupQuery.is("subregion_id", null);
      } else {
        dupQuery = dupQuery.eq("subregion_id", subregion_id);
      }
      if (producer_id === null) {
        dupQuery = dupQuery.is("producer_id", null);
      } else {
        dupQuery = dupQuery.eq("producer_id", producer_id);
      }

      const { data: existingMatch, error: dupError } = await dupQuery.maybeSingle();
      if (dupError) return alert(dupError.message);

      if (existingMatch) {
        // Wine already exists — add the tasting note to it and redirect
        if (notes.trim() || tastedOn) {
          const { error: tastingError } = await supabase.from("wine_tastings").insert({
            wine_id: existingMatch.id,
            tasted_on: tastedOn || null,
            notes: notes.trim() || null,
          });
          if (tastingError) return alert(tastingError.message);
        }
        location.href = `/wines/${existingMatch.id}`;
        return;
      }

      // No match — create a new wine entry
      const { data: newWine, error } = await supabase.from("wines").insert({
        user_id: userId,
        name: wineName,
        vintage_year: vintageYear ?? null,
        country_id,
        region_id,
        subregion_id,
        producer_id,
      }).select("id").single();

      if (error) return alert(error.message);

      if (grapes.length > 0) {
        const grapeIds = await Promise.all(grapes.map((grape) => ensureGrapeId(grape)));
        const { error: grapeError } = await supabase.from("wine_grapes").insert(
          grapeIds.map((grapeId) => ({ wine_id: newWine.id, grape_id: grapeId }))
        );
        if (grapeError) return alert(grapeError.message);
      }

      // Save first tasting note if provided
      if (notes.trim() || tastedOn) {
        await supabase.from("wine_tastings").insert({
          wine_id: newWine.id,
          tasted_on: tastedOn || null,
          notes: notes.trim() || null,
        });
      }

      location.href = `/wines/${newWine.id}`;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to save wine.";
      alert(message);
    }
  }

  return (
    <PageShell>
      <PageContainer className="max-w-2xl">
        <PageHero>
          <Eyebrow>Add Wine</Eyebrow>
          <PageTitle>Log a new bottle to your cellar</PageTitle>
          <PageIntro>
            Fill in what you know — leave unknown fields as NA. You can add more notes and photos after saving.
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
                              .filter(Boolean)
                              .join(" · ")}
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
              <FieldLabel>Country (or NA)</FieldLabel>
              <AutocompleteInput
                value={country}
                onChange={setCountry}
                placeholder="e.g. France"
                fetchSuggestions={async (q) => {
                  const { data } = await supabase
                    .from("countries")
                    .select("name")
                    .ilike("name", `%${q}%`)
                    .limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Region (or NA)</FieldLabel>
              <AutocompleteInput
                value={region}
                onChange={setRegion}
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
              <TagAutocompleteInput
                values={grapes}
                onChange={setGrapes}
                placeholder="e.g. Cabernet Sauvignon"
                fetchSuggestions={async (q) => {
                  const { data } = await supabase
                    .from("grapes")
                    .select("name")
                    .ilike("name", `%${q}%`)
                    .limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

            <Field>
              <FieldLabel>Producer (or NA)</FieldLabel>
              <AutocompleteInput
                value={producer}
                onChange={setProducer}
                placeholder="e.g. Domaine de la Romanée-Conti"
                fetchSuggestions={async (q) => {
                  const { data } = await supabase
                    .from("producers")
                    .select("name")
                    .ilike("name", `%${q}%`)
                    .limit(8);
                  return data?.map((d) => d.name) ?? [];
                }}
              />
            </Field>

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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={saveWine}>Save Wine</Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    </PageShell>
  );
}
