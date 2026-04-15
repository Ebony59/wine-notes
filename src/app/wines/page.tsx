"use client";

import Link from "next/link";
import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MultiSearchableSelect from "@/components/MultiSearchableSelect";
import SearchableSelect from "@/components/SearchableSelect";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

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
    <Card className="border-stone-200 bg-white/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold uppercase tracking-[0.08em] text-stone-500">
          {region}
        </div>
        <Badge variant="muted">{String(producers.length)} producers</Badge>
      </div>

      <div className="mt-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search in ${region.toLowerCase()}...`}
        />
      </div>

      {filteredProducers.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">No matches found.</p>
      ) : (
        <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
          {filteredProducers.map((producerGroup) => {
            const producerKey = `${country}|${region}|${producerGroup.producer}`;
            const producerOpen = expandedProducers[producerKey] ?? false;

            return (
              <div key={producerKey} className="rounded-2xl border border-stone-200 bg-white/80">
                <button
                  type="button"
                  onClick={() => onToggleProducer(producerKey)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
                >
                  <div>
                    <div className="font-medium text-stone-900">{producerGroup.producer}</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {producerGroup.names.reduce((count, group) => count + group.wines.length, 0)} wines
                    </div>
                  </div>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 text-stone-500 transition-transform ${producerOpen ? "rotate-180" : ""}`}
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
                  <div className="space-y-2 border-t border-stone-200 px-3 py-3">
                    {producerGroup.names.map((nameGroup) => {
                      if (nameGroup.wines.length === 1) {
                        const wine = nameGroup.wines[0];
                        return (
                          <Link
                            key={wine.id}
                            href={`/wines/${wine.id}`}
                            className="block rounded-xl border border-stone-200 bg-white px-3 py-3 transition hover:bg-stone-50"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="font-medium text-stone-900">{wine.name}</div>
                              <div className="text-sm text-stone-500">{wine.vintage_year ?? "NV"}</div>
                            </div>
                            {wine.subregions?.name && (
                              <div className="mt-0.5 text-xs text-stone-500">{wine.subregions.name}</div>
                            )}
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={`${producerKey}|${nameGroup.name}`}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-stone-900">{nameGroup.name}</div>
                              {wineLocation(nameGroup.wines[0]) && (
                                <div className="mt-0.5 text-xs text-stone-500">
                                  {wineLocation(nameGroup.wines[0])}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-stone-500">
                              {nameGroup.wines.length} vintages
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {nameGroup.wines.map((wine) => (
                              <Link
                                key={wine.id}
                                href={`/wines/${wine.id}`}
                                className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition hover:bg-stone-50"
                              >
                                {wine.vintage_year ?? "NV"}
                              </Link>
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
    </Card>
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
      setWines((data as unknown as Wine[]) ?? []);
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

  function handleCountryChange(value: string) {
    setFilterCountry(value);
    setFilterRegion("");
    setFilterSubregion("");
  }

  function handleRegionChange(value: string) {
    setFilterRegion(value);
    setFilterSubregion("");
  }

  return (
    <PageShell>
      <PageContainer>
        <PageHero>
          <Eyebrow>Cellar</Eyebrow>
          <PageTitle>Browse your wines by place and producer</PageTitle>
          <PageIntro>
            Search by name, or narrow down by country, region, sub-region, and grape.
          </PageIntro>
        </PageHero>

        <Card className="mt-8">
          <div ref={searchRef} className="relative">
            <Input
          type="search"
          placeholder="Search wines..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => search.trim() && setSearchOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
        />

        {searchOpen && searchResults.length > 0 && (
          <ul className="absolute top-full z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-stone-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(88,56,34,0.14)] backdrop-blur">
            {searchResults.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/wines/${w.id}`}
                  className="flex items-baseline justify-between gap-3 rounded-xl px-4 py-2.5 transition hover:bg-stone-50"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div>
                    <div className="text-sm font-medium text-stone-900">{w.name}</div>
                    {wineLocation(w) && (
                      <div className="text-xs text-stone-500">{wineLocation(w)}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-sm text-stone-500">
                    {w.vintage_year ?? "NV"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
          </div>

          <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-stone-800">Filter</span>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterCountry("");
                setFilterRegion("");
                setFilterSubregion("");
                setFilterGrapes([]);
                setRegionOptions([]);
                setSubregionOptions([]);
              }}
                  className="text-xs text-stone-500 underline"
            >
              Clear all
            </button>
          )}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-stone-500">Country</label>
            <SearchableSelect
              value={filterCountry}
              onChange={handleCountryChange}
              options={countryOptions}
              placeholder="All countries"
            />
              </div>

              <div>
                <label className="mb-1 block text-xs text-stone-500">Region</label>
            <SearchableSelect
              value={filterRegion}
              onChange={handleRegionChange}
              options={filterCountry ? regionOptions : []}
              placeholder="All regions"
              disabled={!filterCountry || regionOptions.length === 0}
            />
              </div>

              <div>
                <label className="mb-1 block text-xs text-stone-500">Sub-region</label>
            <SearchableSelect
              value={filterSubregion}
              onChange={setFilterSubregion}
              options={filterRegion ? subregionOptions : []}
              placeholder="All sub-regions"
              disabled={!filterRegion || subregionOptions.length === 0}
            />
              </div>
            </div>

            <div className="mt-2">
              <label className="mb-1 block text-xs text-stone-500">Grape</label>
          <MultiSearchableSelect
            values={filterGrapes}
            onChange={setFilterGrapes}
            options={grapeOptions}
            placeholder="Select grapes"
          />
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <div className="divide-y divide-stone-200">
          {groupedWines.map((countryGroup) => {
            return (
              <div key={countryGroup.country} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold text-stone-900">{countryGroup.country}</div>
                  <Badge>{String(countryGroup.regions.length)} regions</Badge>
                </div>

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
            <div className="py-3 text-sm text-stone-600">
              No wines match the current filters.
            </div>
          )}

          {wines.length === 0 && (
            <div className="py-3 text-sm text-stone-600">
              No wines yet — add your first one!
            </div>
          )}
          </div>
        </Card>
      </PageContainer>
    </PageShell>
  );
}
