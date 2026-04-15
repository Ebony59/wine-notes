"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AutocompleteInput from "@/components/AutocompleteInput";
import TagAutocompleteInput from "@/components/TagAutocompleteInput";

function normalizeField(v: string) {
  const t = v.trim();
  if (!t || t.toUpperCase() === "NA") return null;
  return t;
}

function normalizeGrapeList(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizeVintage(v: string): number | null | typeof NaN {
  const t = v.trim();
  if (!t || t.toUpperCase() === "NV" || t.toUpperCase() === "NA") return null;
  const year = Number(t);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return NaN;
  return year;
}

export default function EditWinePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [vintage, setVintage] = useState("");
  const [country, setCountry] = useState("NA");
  const [region, setRegion] = useState("NA");
  const [subregion, setSubregion] = useState("NA");
  const [producer, setProducer] = useState("NA");
  const [grapes, setGrapes] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { location.href = "/"; return; }
      loadWine();
    });

    async function loadWine() {
      const { data, error } = await supabase
        .from("wines")
        .select(`
          id, name, vintage_year,
          producers(name), countries(name), regions(name), subregions(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) { alert(error.message); return; }
      if (!data) { setNotFound(true); return; }

      setName(data.name ?? "");
      setVintage(data.vintage_year?.toString() ?? "");
      setCountry((data.countries as any)?.name ?? "NA");
      setRegion((data.regions as any)?.name ?? "NA");
      setSubregion((data.subregions as any)?.name ?? "NA");
      setProducer((data.producers as any)?.name ?? "NA");

      const { data: grapeLinks, error: grapeError } = await supabase
        .from("wine_grapes")
        .select("grapes(name)")
        .eq("wine_id", id);

      if (grapeError) { alert(grapeError.message); return; }
      setGrapes(normalizeGrapeList(
        (grapeLinks ?? [])
          .map((row: any) => row.grapes?.name)
          .filter((value: string | null | undefined): value is string => Boolean(value))
      ));
      setLoaded(true);
    }
  }, [supabase, id]);

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

  async function ensureProducerId(n: string): Promise<number> {
    const { data: ex } = await supabase.from("producers").select("id").eq("name", n).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("producers").insert({ name: n }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureGrapeId(n: string): Promise<number> {
    const { data: ex } = await supabase.from("grapes").select("id").eq("name", n).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("grapes").insert({ name: n }).select("id").single();
    if (error) throw error;
    return ins.id;
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
      if (producerName) producer_id = await ensureProducerId(producerName);

      const { error } = await supabase
        .from("wines")
        .update({ name: wineName, vintage_year: vintageYear ?? null, country_id, region_id, subregion_id, producer_id })
        .eq("id", id);

      if (error) return alert(error.message);

      const { error: deleteGrapesError } = await supabase.from("wine_grapes").delete().eq("wine_id", id);
      if (deleteGrapesError) return alert(deleteGrapesError.message);

      if (grapes.length > 0) {
        const grapeIds = await Promise.all(grapes.map((grape) => ensureGrapeId(grape)));
        const { error: insertGrapesError } = await supabase.from("wine_grapes").insert(
          grapeIds.map((grapeId) => ({ wine_id: id, grape_id: grapeId }))
        );
        if (insertGrapesError) return alert(insertGrapesError.message);
      }

      location.href = `/wines/${id}`;
    } catch (e: any) {
      alert(e?.message ?? "Failed to save.");
    }
  }

  if (notFound) return (
    <main className="min-h-screen p-4 max-w-xl mx-auto">
      <p>Wine not found.</p>
      <a href="/wines" className="text-sm underline">← My wines</a>
    </main>
  );

  if (!loaded) return (
    <main className="min-h-screen p-4 max-w-xl mx-auto">
      <p className="text-sm text-gray-400">Loading…</p>
    </main>
  );

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Edit wine</h1>
        <a href={`/wines/${id}`} className="text-sm underline">Cancel</a>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <div className="grid gap-3">
          <label className="text-sm">
            <div className="mb-1 font-medium">Name *</div>
            <input
              className="border rounded px-3 py-2 w-full"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium">Vintage (year / NV / NA)</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="e.g. 2019 or NV"
              value={vintage}
              onChange={e => setVintage(e.target.value)}
            />
          </label>

          <div className="text-sm">
            <div className="mb-1 font-medium">Country (or NA)</div>
            <AutocompleteInput
              value={country}
              onChange={setCountry}
              fetchSuggestions={async (q) => {
                const { data } = await supabase
                  .from("countries")
                  .select("name")
                  .ilike("name", `%${q}%`)
                  .limit(8);
                return data?.map(d => d.name) ?? [];
              }}
            />
          </div>

          <div className="text-sm">
            <div className="mb-1 font-medium">Region (or NA)</div>
            <AutocompleteInput
              value={region}
              onChange={setRegion}
              fetchSuggestions={async (q) => {
                const countryName = country.trim().toUpperCase() !== "NA" ? country.trim() : null;
                let qb = supabase.from("regions").select("name").ilike("name", `%${q}%`);
                if (countryName) {
                  const { data: c } = await supabase.from("countries").select("id").eq("name", countryName).maybeSingle();
                  if (c?.id) qb = qb.eq("country_id", c.id);
                }
                const { data } = await qb.limit(8);
                return data?.map(d => d.name) ?? [];
              }}
            />
          </div>

          <div className="text-sm">
            <div className="mb-1 font-medium">Sub-region (or NA)</div>
            <AutocompleteInput
              value={subregion}
              onChange={setSubregion}
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
                return data?.map(d => d.name) ?? [];
              }}
            />
          </div>

          <div className="text-sm">
            <div className="mb-1 font-medium">Grapes</div>
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
          </div>

          <div className="text-sm">
            <div className="mb-1 font-medium">Producer (or NA)</div>
            <AutocompleteInput
              value={producer}
              onChange={setProducer}
              fetchSuggestions={async (q) => {
                const { data } = await supabase
                  .from("producers")
                  .select("name")
                  .ilike("name", `%${q}%`)
                  .limit(8);
                return data?.map(d => d.name) ?? [];
              }}
            />
          </div>

          <button
            onClick={save}
            className="mt-2 px-4 py-3 rounded-lg bg-black text-white hover:opacity-90"
          >
            Save changes
          </button>
        </div>
      </div>
    </main>
  );
}
