"use client";

import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MultiSearchableSelect from "@/components/MultiSearchableSelect";
import SearchableSelect from "@/components/SearchableSelect";

type Wine = {
  id: string;
  name: string;
  vintage_year: number | null;
  producers?: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
  wine_grapes?: { grapes: { name: string } | null }[] | null;
};

function wineLocation(w: Wine) {
  return [w.countries?.name, w.regions?.name, w.subregions?.name]
    .filter(Boolean)
    .join(" · ");
}

type RegionSectionProps = {
  country: string;
  region: string;
  producers: {
    producer: string;
    names: {
      name: string;
      wines: Wine[];
    }[];
  }[];
  expandedProducers: Record<string, boolean>;
  onToggleProducer: (key: string) => void;
};

function RegionSection({
  country,
  region,
  producers,
  expandedProducers,
  onToggleProducer,
}: RegionSectionProps) {
  const [query, setQuery] = useState("");

  const searchableProducers = useMemo(
    () =>
      producers.map((producer) => ({
        ...producer,
        searchText: [
          producer.producer,
          ...producer.names.flatMap((group) => [
            group.name,
            ...group.wines.map((wine) => [
              wine.subregions?.name,
              wine.vintage_year?.toString() ?? "NV",
            ].filter(Boolean).join(" ")),
          ]),
        ].join(" "),
      })),
    [producers]
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchableProducers, {
        keys: ["producer", "searchText"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [searchableProducers]
  );

  const filteredProducers = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return searchableProducers;
    return fuse.search(trimmed).map((result) => result.item);
  }, [fuse, query, searchableProducers]);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
        {region}
      </div>

      <div className="mt-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search in ${region.toLowerCase()}...`}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      {filteredProducers.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No matches found.</p>
      ) : (
        <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
          {filteredProducers.map((producerGroup) => {
            const producerKey = `${country}|${region}|${producerGroup.producer}`;
            const producerOpen = expandedProducers[producerKey] ?? false;

            return (
              <div key={producerKey} className="rounded-xl border">
                <button
                  type="button"
                  onClick={() => onToggleProducer(producerKey)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">{producerGroup.producer}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {producerGroup.names.reduce((count, group) => count + group.wines.length, 0)} wines
                    </div>
                  </div>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 text-gray-500 transition-transform ${producerOpen ? "rotate-180" : ""}`}
                  >
                    <path
                      d="M5.5 7.5 10 12l4.5-4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>

                {producerOpen && (
                  <div className="space-y-2 border-t px-3 py-3">
                    {producerGroup.names.map((nameGroup) => {
                      if (nameGroup.wines.length === 1) {
                        const wine = nameGroup.wines[0];
                        return (
                          <a
                            key={wine.id}
                            href={`/wines/${wine.id}`}
                            className="block rounded-lg border px-3 py-3 hover:bg-gray-50"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="font-medium">{wine.name}</div>
                              <div className="text-sm text-gray-500">{wine.vintage_year ?? "NV"}</div>
                            </div>
                            {wine.subregions?.name && (
                              <div className="text-xs text-gray-400 mt-0.5">{wine.subregions.name}</div>
                            )}
                          </a>
                        );
                      }

                      return (
                        <div key={`${producerKey}|${nameGroup.name}`} className="rounded-lg border px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{nameGroup.name}</div>
                              {wineLocation(nameGroup.wines[0]) && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {wineLocation(nameGroup.wines[0])}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              {nameGroup.wines.length} vintages
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {nameGroup.wines.map((wine) => (
                              <a
                                key={wine.id}
                                href={`/wines/${wine.id}`}
                                className="rounded-full border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                {wine.vintage_year ?? "NV"}
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WinesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [wines, setWines] = useState<Wine[]>([]);
  const [expandedProducers, setExpandedProducers] = useState<Record<string, boolean>>({});

  // Filter options loaded from DB
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [regionOptions, setRegionOptions] = useState<string[]>([]);
  const [subregionOptions, setSubregionOptions] = useState<string[]>([]);
  const [grapeOptions, setGrapeOptions] = useState<string[]>([]);

  // Filter state
  const [filterCountry, setFilterCountry] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterSubregion, setFilterSubregion] = useState("");
  const [filterGrapes, setFilterGrapes] = useState<string[]>([]);

  // Search dropdown state
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) location.href = "/";
      else {
        loadWines();
        loadCountries();
        loadGrapes();
      }
    });

    async function loadWines() {
      const { data, error } = await supabase
        .from("wines")
        .select("id,name,vintage_year,producers(name),countries(name),regions(name),subregions(name),wine_grapes(grapes(name))")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) alert(error.message);
      setWines((data as Wine[]) ?? []);
    }

    async function loadCountries() {
      const { data } = await supabase
        .from("countries")
        .select("name")
        .order("name");
      setCountryOptions(data?.map((d) => d.name) ?? []);
    }

    async function loadGrapes() {
      const { data } = await supabase
        .from("grapes")
        .select("name")
        .order("name");
      setGrapeOptions(data?.map((d) => d.name) ?? []);
    }
  }, [supabase]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load regions when country filter changes
  useEffect(() => {
    setFilterRegion("");
    setFilterSubregion("");
    setRegionOptions([]);
    setSubregionOptions([]);

    if (!filterCountry) return;

    async function loadRegions() {
      const { data: countryRow } = await supabase
        .from("countries")
        .select("id")
        .eq("name", filterCountry)
        .maybeSingle();

      if (!countryRow?.id) return;

      const { data } = await supabase
        .from("regions")
        .select("name")
        .eq("country_id", countryRow.id)
        .order("name");
      setRegionOptions(data?.map((d) => d.name) ?? []);
    }

    loadRegions();
  }, [filterCountry, supabase]);

  // Load subregions when region filter changes
  useEffect(() => {
    setFilterSubregion("");
    setSubregionOptions([]);

    if (!filterRegion) return;

    async function loadSubregions() {
      let qb = supabase.from("regions").select("id").eq("name", filterRegion);
      if (filterCountry) {
        const { data: countryRow } = await supabase
          .from("countries")
          .select("id")
          .eq("name", filterCountry)
          .maybeSingle();
        if (countryRow?.id) qb = qb.eq("country_id", countryRow.id);
      }
      const { data: regionRow } = await qb.maybeSingle();
      if (!regionRow?.id) return;

      const { data } = await supabase
        .from("subregions")
        .select("name")
        .eq("region_id", regionRow.id)
        .order("name");
      setSubregionOptions(data?.map((d) => d.name) ?? []);
    }

    loadSubregions();
  }, [filterRegion, filterCountry, supabase]);

  const fuse = useMemo(
    () => new Fuse(wines, { keys: ["name"], threshold: 0.4 }),
    [wines]
  );

  const searchResults = useMemo(
    () => (search.trim() ? fuse.search(search.trim(), { limit: 8 }).map((r) => r.item) : []),
    [fuse, search]
  );

  const filteredWines = useMemo(
    () =>
      wines.filter((w) => {
        if (filterCountry && w.countries?.name !== filterCountry) return false;
        if (filterRegion && w.regions?.name !== filterRegion) return false;
        if (filterSubregion && w.subregions?.name !== filterSubregion) return false;
        if (
          filterGrapes.length > 0 &&
          !(w.wine_grapes ?? []).some((entry) =>
            entry.grapes?.name ? filterGrapes.includes(entry.grapes.name) : false
          )
        ) return false;
        return true;
      }),
    [wines, filterCountry, filterRegion, filterSubregion, filterGrapes]
  );

  const groupedWines = useMemo(() => {
    const countryMap = new Map<string, Wine[]>();

    for (const wine of filteredWines) {
      const key = wine.countries?.name ?? "NA";
      const group = countryMap.get(key) ?? [];
      group.push(wine);
      countryMap.set(key, group);
    }

    return Array.from(countryMap.entries())
      .map(([country, countryWines]) => {
        const regionMap = new Map<string, Wine[]>();

        for (const wine of countryWines) {
          const key = wine.regions?.name ?? "NA";
          const group = regionMap.get(key) ?? [];
          group.push(wine);
          regionMap.set(key, group);
        }

        const regions = Array.from(regionMap.entries())
          .map(([region, regionWines]) => {
            const producerMap = new Map<string, Wine[]>();

            for (const wine of regionWines) {
              const key = wine.producers?.name ?? "NA";
              const group = producerMap.get(key) ?? [];
              group.push(wine);
              producerMap.set(key, group);
            }

            const producers = Array.from(producerMap.entries())
              .map(([producer, producerWines]) => {
                const nameMap = new Map<string, Wine[]>();

                for (const wine of producerWines) {
                  const group = nameMap.get(wine.name) ?? [];
                  group.push(wine);
                  nameMap.set(wine.name, group);
                }

                const names = Array.from(nameMap.entries())
                  .map(([name, wines]) => ({
                    name,
                    wines: [...wines].sort((a, b) => {
                      const aYear = a.vintage_year ?? -1;
                      const bYear = b.vintage_year ?? -1;
                      return bYear - aYear;
                    }),
                  }))
                  .sort((a, b) => a.name.localeCompare(b.name));

                return { producer, names };
              })
              .sort((a, b) => a.producer.localeCompare(b.producer));

            return { region, producers };
          })
          .sort((a, b) => a.region.localeCompare(b.region));

        return { country, regions };
      })
      .sort((a, b) => a.country.localeCompare(b.country));
  }, [filteredWines]);

  const hasFilters = filterCountry || filterRegion || filterSubregion || filterGrapes.length > 0;

  function toggleProducer(key: string) {
    setExpandedProducers((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My Wines</h1>

        <div className="flex items-center gap-3">
          <a href="/" className="text-sm underline">Home</a>
          <a
            href="/wines/new"
            className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90"
          >
            Add new wine
          </a>
        </div>
      </div>

      {/* Search with dropdown */}
      <div ref={searchRef} className="mt-4 relative">
        <input
          type="search"
          className="border rounded-lg px-4 py-2 w-full text-sm"
          placeholder="Search wines…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => search.trim() && setSearchOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
        />

        {searchOpen && searchResults.length > 0 && (
          <ul className="absolute z-20 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-72 overflow-auto">
            {searchResults.map((w) => (
              <li key={w.id}>
                <a
                  href={`/wines/${w.id}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-2.5 hover:bg-gray-50"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div>
                    <div className="text-sm font-medium">{w.name}</div>
                    {wineLocation(w) && (
                      <div className="text-xs text-gray-400">{wineLocation(w)}</div>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 shrink-0">
                    {w.vintage_year ?? "NV"}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      <div className="mt-3 rounded-xl border p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Filter</span>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterCountry("");
                setFilterRegion("");
                setFilterSubregion("");
                setFilterGrapes([]);
              }}
              className="text-xs text-gray-500 underline"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Country</label>
            <SearchableSelect
              value={filterCountry}
              onChange={setFilterCountry}
              options={countryOptions}
              placeholder="All countries"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Region</label>
            <SearchableSelect
              value={filterRegion}
              onChange={setFilterRegion}
              options={regionOptions}
              placeholder="All regions"
              disabled={!filterCountry || regionOptions.length === 0}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sub-region</label>
            <SearchableSelect
              value={filterSubregion}
              onChange={setFilterSubregion}
              options={subregionOptions}
              placeholder="All sub-regions"
              disabled={!filterRegion || subregionOptions.length === 0}
            />
          </div>
        </div>

        <div className="mt-2">
          <label className="text-xs text-gray-500 mb-1 block">Grape</label>
          <MultiSearchableSelect
            values={filterGrapes}
            onChange={setFilterGrapes}
            options={grapeOptions}
            placeholder="Select grapes"
          />
        </div>
      </div>

      {/* Wine list — only affected by dropdown filters */}
      <section className="rounded-xl border p-4 mt-4">
        <div className="divide-y">
          {groupedWines.map((countryGroup) => {
            return (
              <div key={countryGroup.country} className="py-4 first:pt-0 last:pb-0">
                <div className="text-lg font-semibold">{countryGroup.country}</div>

                <div className="mt-4 space-y-4">
                  {countryGroup.regions.map((regionGroup) => (
                    <RegionSection
                      key={`${countryGroup.country}|${regionGroup.region}`}
                      country={countryGroup.country}
                      region={regionGroup.region}
                      producers={regionGroup.producers}
                      expandedProducers={expandedProducers}
                      onToggleProducer={toggleProducer}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filteredWines.length === 0 && wines.length > 0 && (
            <div className="text-sm text-gray-600 py-3">
              No wines match the current filters.
            </div>
          )}

          {wines.length === 0 && (
            <div className="text-sm text-gray-600 py-3">
              No wines yet — add your first one!
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
