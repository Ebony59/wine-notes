"use client";

type SupabaseLike = {
  from: (table: string) => unknown;
};

type QueryResponse = {
  data: unknown;
  error: Error | null;
};

type QueryBuilderLike = PromiseLike<QueryResponse> & {
  select: (query: string) => QueryBuilderLike;
  insert: (values: unknown) => QueryBuilderLike;
  update: (values: unknown) => QueryBuilderLike;
  delete: () => QueryBuilderLike;
  ilike: (column: string, pattern: string) => QueryBuilderLike;
  limit: (value: number) => QueryBuilderLike;
  order: (column: string) => QueryBuilderLike;
  eq: (column: string, value: string | number) => QueryBuilderLike;
  single: () => QueryBuilderLike;
};

type QueryBuilderStartLike = {
  select: (query: string) => QueryBuilderLike;
  insert: (values: unknown) => QueryBuilderLike;
  update: (values: unknown) => QueryBuilderLike;
  delete: () => QueryBuilderLike;
};

function fromTable(supabase: SupabaseLike, table: string) {
  return supabase.from(table) as QueryBuilderStartLike;
}

type GrapeRow = {
  id: number;
  name: string;
};

type GrapeAliasRow = {
  grape_id: number;
  name: string;
  grapes: { name: string } | null;
};

export type GrapeSuggestion = {
  grapeId: number;
  canonicalName: string;
  matchedName: string;
  isAlias: boolean;
};

export type GrapeTag = {
  id: string;
  displayName: string;
  grapeId?: number;
  canonicalName?: string;
  isResolved: boolean;
  setMainName: boolean;
};

export type GrapeFilterOption = {
  value: string;
  label: string;
  searchText: string;
};

export type WineGrapeRow = {
  grape_id: number;
  display_name: string | null;
  grapes: { name: string; notes?: string | null } | null;
};

export type ResolvedWineGrape = {
  grapeId: number;
  displayName: string;
  canonicalName: string;
};

export function normalizeGrapeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeGrapeKey(value: string) {
  return normalizeGrapeName(value).toLocaleLowerCase();
}

export function sameGrapeName(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return normalizeGrapeKey(a) === normalizeGrapeKey(b);
}

export function makeGrapeTagId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `grape-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGrapeTag({
  displayName,
  grapeId,
  canonicalName,
  isResolved = false,
  setMainName = false,
}: {
  displayName: string;
  grapeId?: number;
  canonicalName?: string;
  isResolved?: boolean;
  setMainName?: boolean;
}) {
  return {
    id: makeGrapeTagId(),
    displayName: normalizeGrapeName(displayName),
    grapeId,
    canonicalName,
    isResolved,
    setMainName,
  } satisfies GrapeTag;
}

export function grapeTagFromWineRow(row: WineGrapeRow) {
  return createGrapeTag({
    displayName: row.display_name ?? row.grapes?.name ?? "",
    grapeId: row.grape_id,
    canonicalName: row.grapes?.name ?? undefined,
    isResolved: Boolean(row.grapes?.name),
  });
}

export function dedupeGrapeTags(tags: GrapeTag[]) {
  const byKey = new Map<string, GrapeTag>();

  for (const tag of tags) {
    const displayName = normalizeGrapeName(tag.displayName);
    if (!displayName) continue;

    const key = tag.grapeId
      ? `${tag.grapeId}:${normalizeGrapeKey(displayName)}`
      : `free:${normalizeGrapeKey(displayName)}`;

    byKey.set(key, {
      ...tag,
      displayName,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function formatGrapeDisplayName(displayName: string, canonicalName?: string | null) {
  const normalizedDisplayName = normalizeGrapeName(displayName);
  const normalizedCanonicalName = canonicalName ? normalizeGrapeName(canonicalName) : "";

  if (!normalizedCanonicalName || sameGrapeName(normalizedDisplayName, normalizedCanonicalName)) {
    return normalizedDisplayName;
  }

  return `${normalizedDisplayName} (${normalizedCanonicalName})`;
}

async function queryCanonicalByExactName(supabase: SupabaseLike, name: string) {
  const { data, error } = await fromTable(supabase, "grapes")
    .select("id,name")
    .ilike("name", name)
    .limit(5);

  if (error) throw error;

  return ((data ?? []) as GrapeRow[]).find((row) => sameGrapeName(row.name, name)) ?? null;
}

async function queryAliasByExactName(supabase: SupabaseLike, name: string) {
  const { data, error } = await fromTable(supabase, "grape_aliases")
    .select("grape_id,name,grapes(name)")
    .ilike("name", name)
    .limit(5);

  if (error) throw error;

  return ((data ?? []) as GrapeAliasRow[]).find((row) => sameGrapeName(row.name, name)) ?? null;
}

export async function findExactGrapeSuggestion(supabase: SupabaseLike, rawName: string): Promise<GrapeSuggestion | null> {
  const name = normalizeGrapeName(rawName);
  if (!name) return null;

  const canonical = await queryCanonicalByExactName(supabase, name);
  if (canonical) {
    return {
      grapeId: canonical.id,
      canonicalName: canonical.name,
      matchedName: canonical.name,
      isAlias: false,
    };
  }

  const alias = await queryAliasByExactName(supabase, name);
  if (!alias) return null;

  return {
    grapeId: alias.grape_id,
    canonicalName: alias.grapes?.name ?? alias.name,
    matchedName: alias.name,
    isAlias: true,
  };
}

export async function searchGrapeSuggestions(supabase: SupabaseLike, rawQuery: string): Promise<GrapeSuggestion[]> {
  const query = normalizeGrapeName(rawQuery);
  if (!query) return [];

  const pattern = `%${query}%`;
  const [{ data: grapeData, error: grapeError }, { data: aliasData, error: aliasError }] = await Promise.all([
    fromTable(supabase, "grapes").select("id,name").ilike("name", pattern).order("name").limit(8),
    fromTable(supabase, "grape_aliases")
      .select("grape_id,name,grapes(name)")
      .ilike("name", pattern)
      .order("name")
      .limit(8),
  ]);

  if (grapeError) throw grapeError;
  if (aliasError) throw aliasError;

  const suggestions = new Map<string, GrapeSuggestion>();

  for (const row of (grapeData ?? []) as GrapeRow[]) {
    suggestions.set(`canonical:${row.id}`, {
      grapeId: row.id,
      canonicalName: row.name,
      matchedName: row.name,
      isAlias: false,
    });
  }

  for (const row of (aliasData ?? []) as GrapeAliasRow[]) {
    const canonicalName = row.grapes?.name ?? row.name;
    suggestions.set(`alias:${row.grape_id}:${normalizeGrapeKey(row.name)}`, {
      grapeId: row.grape_id,
      canonicalName,
      matchedName: row.name,
      isAlias: true,
    });
  }

  return Array.from(suggestions.values()).sort((a, b) => {
    const aExact = sameGrapeName(a.matchedName, query) ? 0 : 1;
    const bExact = sameGrapeName(b.matchedName, query) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    if (a.isAlias !== b.isAlias) return a.isAlias ? 1 : -1;
    return a.matchedName.localeCompare(b.matchedName);
  });
}

export async function loadCanonicalGrapeFilterOptions(supabase: SupabaseLike): Promise<GrapeFilterOption[]> {
  const { data, error } = await fromTable(supabase, "grapes")
    .select("id,name,grape_aliases(name)")
    .order("name");

  if (error) throw error;

  type GrapeWithAliases = {
    id: number;
    name: string;
    grape_aliases?: { name: string }[] | null;
  };

  return ((data ?? []) as GrapeWithAliases[]).map((row) => ({
    value: String(row.id),
    label: row.name,
    searchText: [row.name, ...(row.grape_aliases ?? []).map((alias) => alias.name)].join(" "),
  }));
}

async function assertNameAvailableForGrape(supabase: SupabaseLike, rawName: string, grapeId: number) {
  const existing = await findExactGrapeSuggestion(supabase, rawName);
  if (existing && existing.grapeId !== grapeId) {
    throw new Error(`"${normalizeGrapeName(rawName)}" already belongs to ${existing.canonicalName}.`);
  }
}

async function ensureAliasForGrape(
  supabase: SupabaseLike,
  grapeId: number,
  canonicalName: string,
  rawAliasName: string,
) {
  const aliasName = normalizeGrapeName(rawAliasName);
  if (!aliasName || sameGrapeName(aliasName, canonicalName)) return;

  await assertNameAvailableForGrape(supabase, aliasName, grapeId);

  const alias = await queryAliasByExactName(supabase, aliasName);
  if (alias?.grape_id === grapeId) return;

  const { error } = await fromTable(supabase, "grape_aliases").insert({ grape_id: grapeId, name: aliasName });
  if (error) throw error;
}

async function renameCanonicalGrape(
  supabase: SupabaseLike,
  grapeId: number,
  oldCanonicalName: string,
  rawNewCanonicalName: string,
) {
  const newCanonicalName = normalizeGrapeName(rawNewCanonicalName);
  if (!newCanonicalName || sameGrapeName(oldCanonicalName, newCanonicalName)) {
    return oldCanonicalName;
  }

  await assertNameAvailableForGrape(supabase, newCanonicalName, grapeId);

  const { error: deleteAliasError } = await fromTable(supabase, "grape_aliases")
    .delete()
    .eq("grape_id", grapeId)
    .ilike("name", newCanonicalName);
  if (deleteAliasError) throw deleteAliasError;

  const { error: updateError } = await fromTable(supabase, "grapes")
    .update({ name: newCanonicalName })
    .eq("id", grapeId);
  if (updateError) throw updateError;

  await ensureAliasForGrape(supabase, grapeId, newCanonicalName, oldCanonicalName);

  return newCanonicalName;
}

export async function resolveGrapeTagForSave(
  supabase: SupabaseLike,
  tag: GrapeTag,
): Promise<ResolvedWineGrape> {
  const displayName = normalizeGrapeName(tag.displayName);
  if (!displayName) {
    throw new Error("Grape names cannot be empty.");
  }

  if (tag.grapeId && tag.canonicalName) {
    const canonicalName = tag.setMainName
      ? await renameCanonicalGrape(supabase, tag.grapeId, tag.canonicalName, displayName)
      : tag.canonicalName;

    if (!tag.setMainName) {
      await ensureAliasForGrape(supabase, tag.grapeId, canonicalName, displayName);
    }

    return {
      grapeId: tag.grapeId,
      displayName,
      canonicalName,
    };
  }

  const exactMatch = await findExactGrapeSuggestion(supabase, displayName);
  if (exactMatch) {
    if (!sameGrapeName(displayName, exactMatch.canonicalName)) {
      await ensureAliasForGrape(supabase, exactMatch.grapeId, exactMatch.canonicalName, displayName);
    }

    return {
      grapeId: exactMatch.grapeId,
      displayName,
      canonicalName: exactMatch.canonicalName,
    };
  }

  const { data, error } = await fromTable(supabase, "grapes")
    .insert({ name: displayName })
    .select("id,name")
    .single();
  if (error) throw error;

  return {
    grapeId: (data as GrapeRow).id,
    displayName,
    canonicalName: (data as GrapeRow).name,
  };
}
