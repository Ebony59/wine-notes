import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRelationError } from "@/lib/supabase-errors";

type RegionRow = {
  id: number;
  name: string;
  country_id: number | null;
};

type CountryRow = {
  id: number;
  name: string;
};

type SubregionRow = {
  id: number;
  name: string;
  region_id: number | null;
};

type ProducerRow = {
  id: number;
  name: string;
  region_id: number | null;
};

type ProducerRegionRow = {
  producer_id: number;
  region_id: number;
};

type RegionCandidate = {
  id: number;
  name: string;
  countryId: number | null;
  countryName: string | null;
};

export type RegionHierarchy = {
  regionName: string;
  countryName: string | null;
};

export type SubregionHierarchy = {
  subregionName: string;
  regionName: string;
  countryName: string | null;
};

export type ProducerHierarchy = {
  producerName: string;
  regionName: string | null;
  countryName: string | null;
};

function uniqueNumbers(values: Array<number | null>) {
  return Array.from(new Set(values.filter((value): value is number => value !== null)));
}

async function loadCountryMap(client: SupabaseClient, ids: number[]) {
  if (ids.length === 0) return new Map<number, string>();

  const { data, error } = await client
    .from("countries")
    .select("id,name")
    .in("id", ids);

  if (error) throw error;

  return new Map<number, string>(
    ((data ?? []) as CountryRow[]).map((country) => [country.id, country.name])
  );
}

async function findRegionCandidates(
  client: SupabaseClient,
  regionName: string,
) {
  const { data, error } = await client
    .from("regions")
    .select("id,name,country_id")
    .eq("name", regionName)
    .limit(10);

  if (error) throw error;

  const regions = (data ?? []) as RegionRow[];
  const countryMap = await loadCountryMap(client, uniqueNumbers(regions.map((region) => region.country_id)));

  return regions.map<RegionCandidate>((region) => ({
    id: region.id,
    name: region.name,
    countryId: region.country_id,
    countryName: region.country_id ? (countryMap.get(region.country_id) ?? null) : null,
  }));
}

export async function findRegionHierarchy(
  client: SupabaseClient,
  regionName: string,
  countryName?: string | null,
): Promise<RegionHierarchy | null> {
  const candidates = await findRegionCandidates(client, regionName);
  const matches = countryName
    ? candidates.filter((candidate) => candidate.countryName === countryName)
    : candidates;

  if (matches.length !== 1) return null;

  return {
    regionName: matches[0].name,
    countryName: matches[0].countryName,
  };
}

export async function findSubregionHierarchy(
  client: SupabaseClient,
  subregionName: string,
  regionName?: string | null,
  countryName?: string | null,
): Promise<SubregionHierarchy | null> {
  const { data, error } = await client
    .from("subregions")
    .select("id,name,region_id")
    .eq("name", subregionName)
    .limit(10);

  if (error) throw error;

  const subregions = (data ?? []) as SubregionRow[];
  const regionIds = uniqueNumbers(subregions.map((subregion) => subregion.region_id));

  if (regionIds.length === 0) return null;

  const { data: regionData, error: regionError } = await client
    .from("regions")
    .select("id,name,country_id")
    .in("id", regionIds);

  if (regionError) throw regionError;

  const regions = (regionData ?? []) as RegionRow[];
  const countryMap = await loadCountryMap(client, uniqueNumbers(regions.map((region) => region.country_id)));
  const regionMap = new Map(
    regions.map((region) => [
      region.id,
      {
        name: region.name,
        countryName: region.country_id ? (countryMap.get(region.country_id) ?? null) : null,
      },
    ])
  );

  const matches = subregions
    .map((subregion) => {
      const region = subregion.region_id ? regionMap.get(subregion.region_id) : null;
      if (!region) return null;

      return {
        subregionName: subregion.name,
        regionName: region.name,
        countryName: region.countryName,
      };
    })
    .filter((candidate): candidate is SubregionHierarchy => candidate !== null)
    .filter((candidate) => !regionName || candidate.regionName === regionName)
    .filter((candidate) => !countryName || candidate.countryName === countryName);

  if (matches.length !== 1) return null;

  return matches[0];
}

export async function findProducerHierarchy(
  client: SupabaseClient,
  producerName: string,
  regionName?: string | null,
  countryName?: string | null,
): Promise<ProducerHierarchy | null> {
  const { data, error } = await client
    .from("producers")
    .select("id,name,region_id")
    .eq("name", producerName)
    .limit(10);

  if (error) throw error;

  const producers = (data ?? []) as ProducerRow[];
  const producerIds = producers.map((producer) => producer.id);

  const { data: producerRegionData, error: producerRegionError } = producerIds.length > 0
    ? await client
        .from("producer_regions")
        .select("producer_id,region_id")
        .in("producer_id", producerIds)
    : { data: [], error: null };

  if (producerRegionError && !isMissingRelationError(producerRegionError, "producer_regions")) {
    throw producerRegionError;
  }

  const producerRegions = (producerRegionError ? [] : producerRegionData ?? []) as ProducerRegionRow[];
  const regionIds = uniqueNumbers([
    ...producers.map((producer) => producer.region_id),
    ...producerRegions.map((producerRegion) => producerRegion.region_id),
  ]);

  const regionMap = new Map<number, { name: string; countryName: string | null }>();
  if (regionIds.length > 0) {
    const { data: regionData, error: regionError } = await client
      .from("regions")
      .select("id,name,country_id")
      .in("id", regionIds);

    if (regionError) throw regionError;

    const regions = (regionData ?? []) as RegionRow[];
    const countryMap = await loadCountryMap(client, uniqueNumbers(regions.map((entry) => entry.country_id)));

    regions.forEach((entry) => {
      regionMap.set(entry.id, {
        name: entry.name,
        countryName: entry.country_id ? (countryMap.get(entry.country_id) ?? null) : null,
      });
    });
  }

  const matches = producers
    .flatMap((entry) => {
      const linkedRegionIds = new Set<number>();
      if (entry.region_id) linkedRegionIds.add(entry.region_id);
      producerRegions
        .filter((producerRegion) => producerRegion.producer_id === entry.id)
        .forEach((producerRegion) => linkedRegionIds.add(producerRegion.region_id));

      if (linkedRegionIds.size === 0) {
        return [{
          producerName: entry.name,
          regionName: null,
          countryName: null,
        }];
      }

      return Array.from(linkedRegionIds).map((regionId) => {
        const region = regionMap.get(regionId) ?? null;

        return {
          producerName: entry.name,
          regionName: region?.name ?? null,
          countryName: region?.countryName ?? null,
        };
      });
    })
    .filter((candidate) => !regionName || candidate.regionName === regionName)
    .filter((candidate) => !countryName || candidate.countryName === countryName);

  if (matches.length !== 1) return null;

  return matches[0];
}
