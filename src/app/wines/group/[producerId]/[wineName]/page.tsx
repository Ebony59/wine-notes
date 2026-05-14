"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WineMetaBar, type WineMetaBarItem } from "@/components/WineMetaBar";
import { createClient } from "@/lib/supabase/client";
import { findRegionHierarchy, findSubregionHierarchy } from "@/lib/location-autofill";
import { formatGrapeDisplayName, type WineGrapeRow } from "@/lib/grape-utils";
import AutocompleteInput from "@/components/AutocompleteInput";
import { CoverPhoto } from "@/components/CoverPhoto";
import { CoverPhotoGrid } from "@/components/CoverPhotoGrid";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

type WineVintage = {
  id: string;
  name: string;
  vintage_year: number | null;
  wine_type: string | null;
  producer_id: number | null;
  country_id: number | null;
  region_id: number | null;
  subregion_id: number | null;
  producers: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
};

function normalizeField(v: string) {
  const t = v.trim();
  if (!t || t.toUpperCase() === "NA") return null;
  return t;
}

type Photo = {
  id: string;
  wine_id: string;
  tasting_id: string | null;
  storage_path: string | null;
  external_url: string | null;
};

type WineGroupNote = {
  id: string;
  notes: string | null;
  cover_photo_url: string | null;
};

function normalizeGrapes(values: { id: number; displayName: string; canonicalName: string }[]) {
  return Array.from(
    new Map(values.map((value) => [`${value.id}:${value.displayName}`, value] as const)).values()
  ).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default function WineGroupPage() {
  const { producerId, wineName } = useParams<{ producerId: string; wineName: string }>();
  const decodedName = decodeURIComponent(wineName);
  const numericProducerId = producerId === "0" ? null : Number(producerId);

  const supabase = useMemo(() => createClient(), []);
  const [vintages, setVintages] = useState<WineVintage[]>([]);
  const [grapes, setGrapes] = useState<{ id: number; displayName: string; canonicalName: string }[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState<string | null>(null);
  const [groupCoverUrl, setGroupCoverUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [redirectHref, setRedirectHref] = useState<string | null>(null);

  // Inline wine detail editing
  const [editingWine, setEditingWine] = useState(false);
  const [editName, setEditName] = useState("");
  const [editWineType, setEditWineType] = useState("");
  const [editCountry, setEditCountry] = useState("NA");
  const [editRegion, setEditRegion] = useState("NA");
  const [editSubregion, setEditSubregion] = useState("NA");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { window.location.href = "/"; return; }
      setUserId(uid);
      loadAll(uid);
    });

    async function loadAll(uid: string) {
      // Load all vintages of this wine (same name + producer)
      let winesQuery = supabase
        .from("wines")
        .select("id, name, vintage_year, wine_type, producer_id, country_id, region_id, subregion_id, producers(name), countries(name), regions(name), subregions(name)")
        .eq("name", decodedName);

      if (numericProducerId !== null) {
        winesQuery = winesQuery.eq("producer_id", numericProducerId);
      } else {
        winesQuery = winesQuery.is("producer_id", null);
      }

      const { data: winesData } = await winesQuery.order("vintage_year", { ascending: false });
      const loadedVintages = (winesData ?? []) as unknown as WineVintage[];
      setVintages(loadedVintages);

      // Load all photos for these vintages
      const wineIds = loadedVintages.map((v) => v.id);
      if (wineIds.length > 0) {
        const [{ data: photosData }, { data: grapeData, error: grapeError }] = await Promise.all([
          supabase
            .from("wine_photos")
            .select("id, wine_id, tasting_id, storage_path, external_url")
            .in("wine_id", wineIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("wine_grapes")
            .select("grape_id,display_name,grapes(name)")
            .in("wine_id", wineIds),
        ]);
        setPhotos((photosData ?? []) as Photo[]);
        if (grapeError) {
          alert(grapeError.message);
        } else {
          const grapeRows = (grapeData ?? []) as unknown as WineGrapeRow[];
          setGrapes(
            normalizeGrapes(
              grapeRows
                .filter((row) => row.grapes?.name)
                .map((row) => ({
                  id: row.grape_id,
                  displayName: row.display_name ?? row.grapes!.name,
                  canonicalName: row.grapes!.name,
                }))
            )
          );
        }
      } else {
        setPhotos([]);
        setGrapes([]);
      }

      // Load general notes
      let notesQuery = supabase
        .from("wine_group_notes")
        .select("id,notes,cover_photo_url")
        .eq("user_id", uid)
        .eq("wine_name", decodedName);

      if (numericProducerId !== null) {
        notesQuery = notesQuery.eq("producer_id", numericProducerId);
      } else {
        notesQuery = notesQuery.is("producer_id", null);
      }

      const { data: notesData } = await notesQuery.maybeSingle();
      const existingNote = (notesData as WineGroupNote | null) ?? null;
      const existing = existingNote?.notes ?? "";
      setNotes(existing);
      setSavedNotes(existing);
      setGroupCoverUrl(existingNote?.cover_photo_url ?? null);
      setLoading(false);
    }
  }, [supabase, decodedName, numericProducerId]);

  useEffect(() => {
    if (!redirectHref) return;
    location.href = redirectHref;
  }, [redirectHref]);

  function resolvePhotoUrl(p: Photo): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) {
      return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    }
    return "";
  }

  async function upsertGroupNote(
    uid: string,
    values: Partial<Pick<WineGroupNote, "notes" | "cover_photo_url">>
  ) {
    let selectQuery = supabase
      .from("wine_group_notes")
      .select("id")
      .eq("user_id", uid)
      .eq("wine_name", decodedName);

    if (numericProducerId !== null) {
      selectQuery = selectQuery.eq("producer_id", numericProducerId);
    } else {
      selectQuery = selectQuery.is("producer_id", null);
    }

    const { data: existing, error: selectError } = await selectQuery.maybeSingle();
    if (selectError) return { error: selectError };

    if (existing?.id) {
      return supabase.from("wine_group_notes").update(values).eq("id", existing.id);
    }

    const payload: {
      user_id: string;
      wine_name: string;
      producer_id: number | null;
      notes?: string | null;
      cover_photo_url?: string | null;
    } = {
      user_id: uid,
      wine_name: decodedName,
      producer_id: numericProducerId,
    };

    if ("notes" in values) payload.notes = values.notes ?? null;
    if ("cover_photo_url" in values) payload.cover_photo_url = values.cover_photo_url ?? null;

    return supabase.from("wine_group_notes").insert(payload);
  }

  async function setCoverPhoto(p: Photo) {
    if (!userId) return;
    const url = resolvePhotoUrl(p);
    const { error } = await upsertGroupNote(userId, { cover_photo_url: url });
    if (error) { alert(error.message); return; }
    setGroupCoverUrl(url);
  }

  async function removeCover() {
    if (!userId) return;
    const { error } = await upsertGroupNote(userId, { cover_photo_url: null });
    if (error) { alert(error.message); return; }
    setGroupCoverUrl(null);
  }

  async function saveNotes() {
    if (!userId) return;
    const { error } = await upsertGroupNote(userId, { notes: notes.trim() || null });
    if (error) { alert(error.message); return; }

    setSavedNotes(notes.trim());
    setEditing(false);
  }

  function openEditWine() {
    const first = vintages[0];
    if (!first) return;
    setEditName(first.name);
    setEditWineType(first.wine_type ?? "");
    setEditCountry(first.countries?.name ?? "NA");
    setEditRegion(first.regions?.name ?? "NA");
    setEditSubregion(first.subregions?.name ?? "NA");
    setEditingWine(true);
  }

  async function ensureCountryId(name: string): Promise<number> {
    const { data: ex } = await supabase.from("countries").select("id").eq("name", name).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("countries").insert({ name }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureRegionId(countryId: number, name: string): Promise<number> {
    const { data: ex } = await supabase.from("regions").select("id").eq("country_id", countryId).eq("name", name).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("regions").insert({ country_id: countryId, name }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function ensureSubregionId(regionId: number, name: string): Promise<number> {
    const { data: ex } = await supabase.from("subregions").select("id").eq("region_id", regionId).eq("name", name).maybeSingle();
    if (ex?.id) return ex.id;
    const { data: ins, error } = await supabase.from("subregions").insert({ region_id: regionId, name }).select("id").single();
    if (error) throw error;
    return ins.id;
  }

  async function saveWineDetails() {
    const wineName = editName.trim();
    if (!wineName) return alert("Name is required.");

    const countryName = normalizeField(editCountry);
    const regionName = normalizeField(editRegion);
    const subregionName = normalizeField(editSubregion);

    let country_id: number | null = null;
    let region_id: number | null = null;
    let subregion_id: number | null = null;

    try {
      if (countryName) country_id = await ensureCountryId(countryName);
      if (regionName && country_id) region_id = await ensureRegionId(country_id, regionName);
      if (subregionName && region_id) subregion_id = await ensureSubregionId(region_id, subregionName);

      const wineIds = vintages.map((v) => v.id);
      const { error } = await supabase
        .from("wines")
        .update({
          name: wineName,
          wine_type: editWineType || null,
          country_id,
          region_id,
          subregion_id,
        })
        .in("id", wineIds);

      if (error) return alert(error.message);

      if (userId && wineName !== decodedName) {
        let noteUpdate = supabase
          .from("wine_group_notes")
          .update({ wine_name: wineName })
          .eq("user_id", userId)
          .eq("wine_name", decodedName);

        if (numericProducerId !== null) {
          noteUpdate = noteUpdate.eq("producer_id", numericProducerId);
        } else {
          noteUpdate = noteUpdate.is("producer_id", null);
        }

        const { error: noteError } = await noteUpdate;
        if (noteError) return alert(noteError.message);
      }

      setVintages((vs) =>
        vs.map((v) => ({
          ...v,
          name: wineName,
          wine_type: editWineType || null,
          country_id,
          region_id,
          subregion_id,
          countries: countryName ? { name: countryName } : null,
          regions: regionName ? { name: regionName } : null,
          subregions: subregionName ? { name: subregionName } : null,
        }))
      );
      setEditingWine(false);
      if (wineName !== decodedName) {
        setRedirectHref(`/wines/group/${numericProducerId ?? 0}/${encodeURIComponent(wineName)}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  async function autofillFromRegion(regionName: string) {
    const normalized = normalizeField(regionName);
    if (!normalized) return;
    try {
      const match = await findRegionHierarchy(supabase, normalized, normalizeField(editCountry));
      if (match?.countryName) setEditCountry(match.countryName);
    } catch { /* best-effort */ }
  }

  async function autofillFromSubregion(subregionName: string) {
    const normalized = normalizeField(subregionName);
    if (!normalized) return;
    try {
      const match = await findSubregionHierarchy(supabase, normalized, normalizeField(editRegion), normalizeField(editCountry));
      if (!match) return;
      setEditRegion(match.regionName);
      if (match.countryName) setEditCountry(match.countryName);
    } catch { /* best-effort */ }
  }

  function isCover(p: Photo): boolean {
    const url = resolvePhotoUrl(p);
    return groupCoverUrl === url;
  }

  const firstVintage = vintages[0];
  const producerName = firstVintage?.producers?.name;
  const rawMetaItems: Array<WineMetaBarItem | null> = [
    firstVintage?.wine_type
      ? { label: firstVintage.wine_type === "rose" ? "Rosé" : firstVintage.wine_type.charAt(0).toUpperCase() + firstVintage.wine_type.slice(1) }
      : null,
    firstVintage?.producer_id && producerName
      ? { label: producerName, href: `/knowledge/producers/${firstVintage.producer_id}` }
      : producerName
        ? { label: producerName }
        : null,
    firstVintage?.subregion_id && firstVintage.subregions?.name
      ? { label: firstVintage.subregions.name, href: `/knowledge/subregions/${firstVintage.subregion_id}` }
      : firstVintage?.subregions?.name
        ? { label: firstVintage.subregions.name }
        : null,
    firstVintage?.region_id && firstVintage.regions?.name
      ? { label: firstVintage.regions.name, href: `/knowledge/regions/${firstVintage.region_id}` }
      : firstVintage?.regions?.name
        ? { label: firstVintage.regions.name }
        : null,
    firstVintage?.country_id && firstVintage.countries?.name
      ? { label: firstVintage.countries.name, href: `/knowledge/countries/${firstVintage.country_id}` }
      : firstVintage?.countries?.name
        ? { label: firstVintage.countries.name }
        : null,
  ];
  const metaItems = rawMetaItems.filter(
    (item): item is WineMetaBarItem => item !== null && Boolean(item.label)
  );
  const grapeItems: WineMetaBarItem[] = grapes.map((grape) => ({
    label: formatGrapeDisplayName(grape.displayName, grape.canonicalName),
    href: `/knowledge/grapes/${grape.id}`,
  }));

  // Show the first cover photo found across any vintage
  const coverUrl = groupCoverUrl;

  if (loading) {
    return (
      <PageShell className="py-16">
        <PageContainer className="max-w-3xl">
          <p className="text-sm text-stone-500">Loading...</p>
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageContainer className="max-w-3xl pb-16">
        <div className="flex items-start justify-between gap-4">
          <PageHero>
            <Eyebrow>
              <Link href="/wines" className="inline-flex items-center gap-1 hover:text-stone-700">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3">
                  <path
                    d="M10 3L5 8l5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                My Wines
              </Link>
            </Eyebrow>
            <PageTitle>{vintages[0]?.name ?? decodedName}</PageTitle>
            <WineMetaBar items={metaItems} />
            <WineMetaBar items={grapeItems} className="mt-2" />
          </PageHero>
          {vintages.length > 0 && (
            <Button
              variant="secondary"
              className="mt-4 shrink-0 rounded-2xl px-4"
              onClick={() => (editingWine ? setEditingWine(false) : openEditWine())}
            >
              {editingWine ? "Cancel" : "Edit Wine"}
            </Button>
          )}
        </div>

        {editingWine && (
          <Card className="mt-6">
            <CardTitle>Edit Wine Details</CardTitle>
            <div className="mt-5 grid gap-4">
              <Field>
                <FieldLabel>Name *</FieldLabel>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </Field>

              <Field>
                <FieldLabel>Wine Type</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {(["sparkling", "white", "rose", "red", "fortified"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditWineType(editWineType === type ? "" : type)}
                      className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${
                        editWineType === type
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
                  value={editCountry}
                  onChange={setEditCountry}
                  fetchSuggestions={async (q) => {
                    const { data } = await supabase.from("countries").select("name").ilike("name", `%${q}%`).limit(8);
                    return data?.map((d) => d.name) ?? [];
                  }}
                />
              </Field>

              <Field>
                <FieldLabel>Region (or NA)</FieldLabel>
                <AutocompleteInput
                  value={editRegion}
                  onChange={setEditRegion}
                  onSelect={autofillFromRegion}
                  fetchSuggestions={async (q) => {
                    const countryName = editCountry.trim().toUpperCase() !== "NA" ? editCountry.trim() : null;
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
                  value={editSubregion}
                  onChange={setEditSubregion}
                  onSelect={autofillFromSubregion}
                  fetchSuggestions={async (q) => {
                    const regionName = editRegion.trim().toUpperCase() !== "NA" ? editRegion.trim() : null;
                    let qb = supabase.from("subregions").select("name").ilike("name", `%${q}%`);
                    if (regionName) {
                      const { data: r } = await supabase.from("regions").select("id").eq("name", regionName).maybeSingle();
                      if (r?.id) qb = qb.eq("region_id", r.id);
                    }
                    const { data } = await qb.limit(8);
                    return data?.map((d) => d.name) ?? [];
                  }}
                />
              </Field>

              <div className="flex gap-3 pt-1">
                <Button onClick={saveWineDetails}>Save Changes</Button>
                <Button variant="secondary" onClick={() => setEditingWine(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Cover photo */}
        {coverUrl && (
          <CoverPhoto
            className="mt-6"
            url={coverUrl}
            alt={decodedName}
            onReplace={() =>
              document.getElementById("wine-group-photos")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            onRemove={removeCover}
          />
        )}

        {/* General Notes */}
        <Card className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">General Notes</CardTitle>
              <CardDescription className="mt-1">
                Notes about this wine across all vintages.
              </CardDescription>
            </div>
            {!editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {savedNotes ? "Edit" : "Add Notes"}
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <Textarea
                className="min-h-[140px]"
                placeholder="General notes about this wine — style, aging potential, food pairings…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={saveNotes}>Save</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setNotes(savedNotes ?? "");
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : savedNotes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{savedNotes}</p>
          ) : (
            <p className="text-sm text-stone-500">
              No general notes yet. Click &ldquo;Add Notes&rdquo; to get started.
            </p>
          )}
        </Card>

        {/* Vintages — scrollable when tall */}
        <Card className="mt-6">
          <div className="mb-4">
            <CardTitle className="text-2xl">Vintages Tasted</CardTitle>
            <CardDescription className="mt-1">
              {vintages.length === 0
                ? "No vintages recorded yet."
                : `${vintages.length} vintage${vintages.length !== 1 ? "s" : ""} in your collection.`}
            </CardDescription>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {vintages.map((w) => (
              <Link
                key={w.id}
                href={`/wines/${w.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:bg-stone-50"
              >
                <span className="font-medium text-stone-900">
                  {w.vintage_year ?? "NV"}
                </span>
                <svg
                  className="h-4 w-4 shrink-0 text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}

            {vintages.length === 0 && (
              <p className="text-sm text-stone-500">No vintages found.</p>
            )}
          </div>
        </Card>

        {/* Photo grid — all photos from all tasting notes */}
        {photos.length > 0 && (
          <Card className="mt-6" id="wine-group-photos">
            <div className="mb-4">
              <CardTitle className="text-2xl">Photos</CardTitle>
              <CardDescription className="mt-1">
                From all your tasting notes — click to view the full entry.
              </CardDescription>
            </div>

            <CoverPhotoGrid
              items={photos.map((photo) => {
                const vintageYear = vintages.find((v) => v.id === photo.wine_id)?.vintage_year;
                return {
                  id: photo.id,
                  url: resolvePhotoUrl(photo),
                  alt: `${decodedName} ${vintageYear ?? "NV"}`,
                  href: `/wines/${photo.wine_id}`,
                  footerLabel: `${vintageYear ?? "NV"} →`,
                  isCover: isCover(photo),
                  photo,
                };
              })}
              containerClassName="grid grid-cols-3 gap-2 sm:grid-cols-4"
              itemClassName="aspect-square w-full"
              onSetCover={(item) => setCoverPhoto(item.photo)}
            />
          </Card>
        )}
      </PageContainer>
    </PageShell>
  );
}
