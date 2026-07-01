"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findProducerHierarchy, findRegionHierarchy, findSubregionHierarchy } from "@/lib/location-autofill";
import { isMissingRelationError } from "@/lib/supabase-errors";
import { deleteWineVintages } from "@/lib/wine-delete";
import AutocompleteInput from "@/components/AutocompleteInput";
import GrapeTagInput from "@/components/GrapeTagInput";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
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

function normalizeField(v: string) {
  const t = v.trim();
  if (!t || t.toUpperCase() === "NA") return null;
  return t;
}

function normalizeVintage(v: string): number | null | typeof NaN {
  const t = v.trim();
  if (!t || t.toUpperCase() === "NV" || t.toUpperCase() === "NA") return null;
  const year = Number(t);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return NaN;
  return year;
}

type EditableWine = {
  name: string | null;
  vintage_year: number | null;
  producers: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
};

export default function EditWinePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [wineForDelete, setWineForDelete] = useState<{ name: string; producerId: number | null } | null>(null);

  const [name, setName] = useState("");
  const [vintage, setVintage] = useState("");
  const [wineType, setWineType] = useState("");
  const [country, setCountry] = useState("NA");
  const [region, setRegion] = useState("NA");
  const [subregion, setSubregion] = useState("NA");
  const [producer, setProducer] = useState("NA");
  const [grapes, setGrapes] = useState<GrapeTag[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadWine();
    });

    async function loadWine() {
      const { data, error } = await supabase
        .from("wines")
        .select(`
          id, name, vintage_year, wine_type, producer_id,
          producers(name), countries(name), regions(name), subregions(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) { alert(error.message); return; }
      if (!data) { setNotFound(true); return; }

      setName(data.name ?? "");
      setWineForDelete({
        name: data.name ?? "",
        producerId: (data as unknown as { producer_id: number | null }).producer_id ?? null,
      });
      setVintage(data.vintage_year?.toString() ?? "");
      setWineType((data as unknown as { wine_type: string | null }).wine_type ?? "");
      const typed = data as unknown as EditableWine;
      setCountry(typed.countries?.name ?? "NA");
      setRegion(typed.regions?.name ?? "NA");
      setSubregion(typed.subregions?.name ?? "NA");
      setProducer(typed.producers?.name ?? "NA");

      const { data: grapeLinks, error: grapeError } = await supabase
        .from("wine_grapes")
        .select("grape_id,display_name,grapes(name)")
        .eq("wine_id", id);

      if (grapeError) { alert(grapeError.message); return; }
      setGrapes(
        ((grapeLinks ?? []) as unknown as WineGrapeRow[])
          .filter((row) => row.grapes?.name)
          .map((row) => grapeTagFromWineRow(row))
      );
      setLoaded(true);
    }
  }, [supabase, id]);

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

  // Lookup-table helpers (same as add-wine page)
  async function ensureCountryId(n: string): Promise<number> {
    const { data: ex } = await supabase.from("countries").select("id").eq("name", n).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("countries").insert({ name: n }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureRegionId(countryId: number, n: string): Promise<number> {
    const { data: ex } = await supabase.from("regions").select("id").eq("country_id", countryId).eq("name", n).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("regions").insert({ country_id: countryId, name: n }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureSubregionId(regionId: number, n: string): Promise<number> {
    const { data: ex } = await supabase.from("subregions").select("id").eq("region_id", regionId).eq("name", n).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("subregions").insert({ region_id: regionId, name: n }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureProducerId(n: string, regionId: number | null): Promise<number> {
    const { data: ex, error: selectError } = await supabase.from("producers").select("id,region_id").eq("name", n).maybeSingle();
    if (selectError) throw selectError;
    if (ex?.id) {
      if (ex.region_id === null && regionId !== null) {
        const { error: updateError } = await supabase.from("producers").update({ region_id: regionId }).eq("id", ex.id);
        if (updateError) throw updateError;
      }
      if (regionId !== null) {
        const { error: linkError } = await supabase
          .from("producer_regions")
          .upsert({ producer_id: ex.id, region_id: regionId }, { onConflict: "producer_id,region_id" });
        if (linkError && !isMissingRelationError(linkError, "producer_regions")) throw linkError;
      }
      return ex.id;
    }
    const { data: ins, error } = await supabase.from("producers").insert({ name: n, region_id: regionId }).select("id").single();
    if (error) throw error;
    if (regionId !== null) {
      const { error: linkError } = await supabase
        .from("producer_regions")
        .upsert({ producer_id: ins.id, region_id: regionId }, { onConflict: "producer_id,region_id" });
      if (linkError && !isMissingRelationError(linkError, "producer_regions")) throw linkError;
    }
    return ins.id;
  }

  async function deleteWine() {
    if (!userId || !wineForDelete) return;

    try {
      const { storageCleanupError } = await deleteWineVintages({
        supabase,
        wineIds: [id],
        groupNote: {
          userId,
          wineName: wineForDelete.name,
          producerId: wineForDelete.producerId,
        },
      });

      if (storageCleanupError) {
        alert(`This wine entry was deleted, but some uploaded photo files could not be removed: ${storageCleanupError}`);
      }

      location.href = "/wines";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete.";
      alert(message);
    }
  }

  async function save() {
    const wineName = name.trim();
    if (!wineName) return alert("Name is required.");

    const vintageYear = normalizeVintage(vintage);
    if (Number.isNaN(vintageYear)) return alert("Vintage must be a year like 2019, or NV, or NA.");

    const countryName = normalizeField(country);
    const regionName = normalizeField(region);
    const subregionName = normalizeField(subregion);
    const producerName = normalizeField(producer);

    let country_id: number | null = null;
    let region_id: number | null = null;
    let subregion_id: number | null = null;
    let producer_id: number | null = null;

    try {
      if (countryName) country_id = await ensureCountryId(countryName);
      if (regionName && country_id) region_id = await ensureRegionId(country_id, regionName);
      if (subregionName && region_id) subregion_id = await ensureSubregionId(region_id, subregionName);
      if (producerName) producer_id = await ensureProducerId(producerName, region_id);

      const { error } = await supabase
        .from("wines")
        .update({ name: wineName, vintage_year: vintageYear ?? null, wine_type: wineType || null, country_id, region_id, subregion_id, producer_id })
        .eq("id", id);

      if (error) return alert(error.message);

      const { error: deleteGrapesError } = await supabase.from("wine_grapes").delete().eq("wine_id", id);
      if (deleteGrapesError) return alert(deleteGrapesError.message);

      if (grapes.length > 0) {
        const resolvedGrapes = await Promise.all(grapes.map((grape) => resolveGrapeTagForSave(supabase, grape)));
        const { error: insertGrapesError } = await supabase.from("wine_grapes").insert(
          resolvedGrapes.map((grape) => ({
            wine_id: id,
            grape_id: grape.grapeId,
            display_name: grape.displayName,
          }))
        );
        if (insertGrapesError) return alert(insertGrapesError.message);
      }

      location.href = `/wines/${id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save.";
      alert(message);
    }
  }

  if (notFound) return (
    <PageShell>
      <PageContainer className="max-w-xl">
        <p>Wine not found.</p>
      </PageContainer>
    </PageShell>
  );

  if (!loaded) return (
    <PageShell className="py-16">
      <PageContainer className="max-w-xl">
        <p className="text-sm text-stone-500">Loading...</p>
      </PageContainer>
    </PageShell>
  );

  return (
    <PageShell>
      <PageContainer className="max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <PageHero>
            <Eyebrow>Edit Wine</Eyebrow>
            <PageTitle>Edit bottle details</PageTitle>
            <PageIntro>
              Update any fields below — grape links are replaced on save.
            </PageIntro>
          </PageHero>
          <Button asChild variant="secondary" className="mt-4 shrink-0 rounded-2xl px-4">
            <Link href={`/wines/${id}`}>Cancel</Link>
          </Button>
        </div>

        <Card className="mt-8">
          <CardTitle>Wine Details</CardTitle>

          <div className="mt-6 grid gap-4">
            <Field>
              <FieldLabel>Name *</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
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
              onSelect={autofillFromRegion}
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
              fetchSuggestions={async (q) => {
                const qb = supabase
                  .from("producers")
                  .select("name")
                  .ilike("name", `%${q}%`);
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

            <div className="pt-2 flex items-center justify-between">
              <Button onClick={save}>Save Changes</Button>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete Wine</Button>
            </div>
          </div>
        </Card>
      </PageContainer>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_60px_rgba(88,56,34,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-serif text-2xl text-stone-900">Delete this wine?</p>
            <p className="mt-2 text-sm text-stone-600">
              This will remove this wine entry. Grapes, regions, countries, and other knowledge you&apos;ve added will remain. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" onClick={deleteWine}>Yes, delete</Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
