"use client";

import Fuse from "fuse.js";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AutocompleteInput from "@/components/AutocompleteInput";
import TagAutocompleteInput from "@/components/TagAutocompleteInput";

function normalizeField(v: string) {
  const t = v.trim();
  if (!t) return null;
  if (t.toUpperCase() === "NA") return null;
  return t;
}

function normalizeVintage(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (t.toUpperCase() === "NV") return null;
  if (t.toUpperCase() === "NA") return null;

  const year = Number(t);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return NaN as any;
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) location.href = "/";
      else loadExistingWines();
    });
  }, [supabase]);

  async function loadExistingWines() {
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

    setExistingWines((data as ExistingWine[]) ?? []);
  }

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
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to save wine.");
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Add new wine</h1>
        <a href="/wines" className="text-sm underline">
          My wines
        </a>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <div className="grid gap-3">
          <label className="text-sm">
            <div className="mb-1 font-medium">Name *</div>
            <div className="relative" data-wine-name-picker>
              <input
                className="border rounded px-3 py-2 w-full"
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
                <ul className="absolute z-20 top-full mt-1 w-full overflow-auto rounded-lg border bg-white shadow-lg max-h-64">
                  {wineNameSuggestions.map((wine) => (
                    <li key={wine.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-gray-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyExistingWine(wine);
                        }}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium">{wine.name}</span>
                          <span className="text-xs text-gray-500">{formatVintage(wine.vintage_year)}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
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
          </label>

          <label className="text-sm">
            <div className="mb-1 font-medium">Vintage (year / NV / NA)</div>
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="e.g. 2019 or NV"
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
            />
          </label>

          <div className="text-sm">
            <div className="mb-1 font-medium">Country (or NA)</div>
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
                return data?.map(d => d.name) ?? [];
              }}
            />
          </div>

          <div className="text-sm">
            <div className="mb-1 font-medium">Region (or NA)</div>
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
                return data?.map(d => d.name) ?? [];
              }}
            />
          </div>

          <div className="text-sm">
            <div className="mb-1 font-medium">Sub-region (or NA)</div>
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
              placeholder="e.g. Domaine de la Romanée-Conti"
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

          <div className="border-t pt-3 mt-1">
            <div className="text-sm font-medium mb-2">First tasting note <span className="text-gray-400 font-normal">(optional)</span></div>

            <div className="grid gap-3">
              <label className="text-sm">
                <div className="mb-1 font-medium">Date tasted</div>
                <input
                  type="date"
                  className="border rounded px-3 py-2 w-full"
                  value={tastedOn}
                  onChange={(e) => setTastedOn(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium">Notes</div>
                <textarea
                  className="border rounded px-3 py-2 w-full min-h-[140px]"
                  placeholder="What did you taste/smell? Structure? Pairing? Thoughts..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
          </div>

          <button
            onClick={saveWine}
            className="mt-2 px-4 py-3 rounded-lg bg-black text-white hover:opacity-90"
          >
            Save
          </button>

          <div className="text-xs text-gray-500">
            Tip: Type <b>NA</b> for unknown fields. Vintage accepts <b>NV</b>. You can add more tasting notes and photos after saving.
          </div>
        </div>
      </div>
    </main>
  );
}
