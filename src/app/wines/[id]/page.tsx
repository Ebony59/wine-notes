"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getWineGroupHref } from "@/components/WineCard";
import { WineMetaBar, type WineMetaBarItem } from "@/components/WineMetaBar";
import { createClient } from "@/lib/supabase/client";
import { findRegionHierarchy, findSubregionHierarchy } from "@/lib/location-autofill";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import AutocompleteInput from "@/components/AutocompleteInput";
import { CoverPhoto } from "@/components/CoverPhoto";
import { CoverPhotoGrid } from "@/components/CoverPhotoGrid";
import { NotesEditBar } from "@/components/NotesEditBar";
import { PhotoPicker } from "@/components/PhotoPicker";
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


type Wine = {
  id: string;
  name: string;
  vintage_year: number | null;
  wine_type: string | null;
  cover_photo_url: string | null;
  producer_id: number | null;
  country_id: number | null;
  region_id: number | null;
  subregion_id: number | null;
  producers: { name: string } | null;
  countries: { name: string; notes: string | null } | null;
  regions: { name: string; notes: string | null } | null;
  subregions: { name: string; notes: string | null } | null;
};

type GrapeLink = {
  grape_id: number;
  grapes: { name: string; notes: string | null } | null;
};

type Tasting = {
  id: string;
  tasted_on: string | null;
  notes: string | null;
};

type Photo = {
  id: string;
  tasting_id: string | null;
  storage_path: string | null;
  external_url: string | null;
};

type SimilarWine = {
  id: string;
  name: string;
  vintage_year: number | null;
};

type VintageKnowledge = {
  region_id: number;
  year: number;
  notes: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return "Date unknown";
  // date-only strings (YYYY-MM-DD) would shift timezone if passed to `new Date` directly
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeGrapes(values: { id: number; name: string }[]) {
  return Array.from(
    new Map(values.map((value) => [value.id, value] as const)).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
}

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

export default function WineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [wine, setWine] = useState<Wine | null>(null);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [similar, setSimilar] = useState<SimilarWine[]>([]);
  const [grapes, setGrapes] = useState<{ id: number; name: string }[]>([]);
  const [grapeNotes, setGrapeNotes] = useState<{ id: number; name: string; notes: string }[]>([]);
  const [vintageNote, setVintageNote] = useState<VintageKnowledge | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Inline wine detail editing
  const [editingWine, setEditingWine] = useState(false);
  const [editName, setEditName] = useState("");
  const [editVintage, setEditVintage] = useState("");
  const [editWineType, setEditWineType] = useState("");
  const [editCountry, setEditCountry] = useState("NA");
  const [editRegion, setEditRegion] = useState("NA");
  const [editSubregion, setEditSubregion] = useState("NA");

  // Add tasting
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addTastingPhotos, setAddTastingPhotos] = useState<PendingPhoto[]>([]);

  // Edit tasting
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Photo add — tracks which tasting (or "general") has the add-photo form open
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCoverLightbox, setShowCoverLightbox] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadAll();
    });

    async function loadAll() {
      const { data: w, error: wErr } = await supabase
        .from("wines")
        .select(`
          id, name, vintage_year, wine_type, cover_photo_url, producer_id, country_id, region_id, subregion_id,
          producers(name), countries(name,notes), regions(name,notes), subregions(name,notes)
        `)
        .eq("id", id)
        .maybeSingle();

      if (wErr) { alert(wErr.message); return; }
      if (!w) { setNotFound(true); return; }
      setWine(w as unknown as Wine);

      const wTyped = w as unknown as Wine;

      const [{ data: ts }, { data: ps }, { data: grapeLinks, error: grapeError }, vintageRes] = await Promise.all([
        supabase
          .from("wine_tastings")
          .select("id, tasted_on, notes")
          .eq("wine_id", id)
          .order("tasted_on", { ascending: false }),
        supabase
          .from("wine_photos")
          .select("id, tasting_id, storage_path, external_url")
          .eq("wine_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("wine_grapes")
          .select("grape_id, grapes(name,notes)")
          .eq("wine_id", id),
        wTyped.region_id && wTyped.vintage_year !== null
          ? supabase
              .from("vintages")
              .select("region_id,year,notes")
              .eq("region_id", wTyped.region_id)
              .eq("year", wTyped.vintage_year)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      setTastings((ts ?? []) as Tasting[]);
      setPhotos((ps ?? []) as Photo[]);
      if (grapeError) { alert(grapeError.message); return; }
      const grapeRows = (grapeLinks ?? []) as unknown as GrapeLink[];
      setGrapes(
        normalizeGrapes(
          grapeRows
            .filter((row) => row.grapes?.name)
            .map((row) => ({ id: row.grape_id, name: row.grapes!.name }))
        )
      );
      setGrapeNotes(
        grapeRows
          .filter((row) => row.grapes?.name && row.grapes?.notes)
          .map((row) => ({ id: row.grape_id, name: row.grapes!.name, notes: row.grapes!.notes! }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      if (vintageRes.error) { alert(vintageRes.error.message); return; }
      setVintageNote((vintageRes.data as VintageKnowledge | null) ?? null);

      // Similar wines
      const filters: string[] = [];
      if (wTyped.producer_id) filters.push(`producer_id.eq.${wTyped.producer_id}`);
      if (wTyped.subregion_id) filters.push(`subregion_id.eq.${wTyped.subregion_id}`);
      if (wTyped.vintage_year) filters.push(`vintage_year.eq.${wTyped.vintage_year}`);
      if (filters.length > 0) {
        const { data: sim } = await supabase
          .from("wines")
          .select("id, name, vintage_year")
          .or(filters.join(","))
          .neq("id", id)
          .order("name")
          .limit(8);
        setSimilar((sim ?? []) as SimilarWine[]);
      }
    }
  }, [supabase, id]);

  function openEditWine() {
    if (!wine) return;
    setEditName(wine.name);
    setEditVintage(wine.vintage_year?.toString() ?? "");
    setEditWineType(wine.wine_type ?? "");
    setEditCountry(wine.countries?.name ?? "NA");
    setEditRegion(wine.regions?.name ?? "NA");
    setEditSubregion(wine.subregions?.name ?? "NA");
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
    const vintageYear = normalizeVintage(editVintage);
    if (Number.isNaN(vintageYear)) return alert("Vintage must be a year like 2019, or NV.");

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

      const { error } = await supabase
        .from("wines")
        .update({
          name: wineName,
          vintage_year: vintageYear ?? null,
          wine_type: editWineType || null,
          country_id,
          region_id,
          subregion_id,
        })
        .eq("id", id);

      if (error) return alert(error.message);

      setWine((w) =>
        w
          ? {
              ...w,
              name: wineName,
              vintage_year: vintageYear ?? null,
              wine_type: editWineType || null,
              country_id,
              region_id,
              subregion_id,
              countries: countryName ? { name: countryName, notes: w.countries?.notes ?? null } : null,
              regions: regionName ? { name: regionName, notes: w.regions?.notes ?? null } : null,
              subregions: subregionName ? { name: subregionName, notes: w.subregions?.notes ?? null } : null,
            }
          : w
      );
      setEditingWine(false);
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

  function resolveUrl(p: Photo): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) {
      return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    }
    return "";
  }

  // ── Tasting CRUD ────────────────────────────────────────────────────────────

  async function saveTasting() {
    if (!addNotes.trim() && !addDate) return;
    const { data, error } = await supabase
      .from("wine_tastings")
      .insert({ wine_id: id, tasted_on: addDate || null, notes: addNotes.trim() || null })
      .select("id, tasted_on, notes")
      .single();
    if (error) { alert(error.message); return; }
    setTastings(ts => [data as Tasting, ...ts]);

    // Upload any photos that were added alongside this tasting note
    const photosToUpload = addTastingPhotos;
    if (photosToUpload.length > 0) {
      await uploadPendingPhotos((data as Tasting).id, photosToUpload);
    }

    setAddDate(""); setAddNotes(""); setAddTastingPhotos([]); setShowAdd(false);
  }

  // Upload pending photos from the add-tasting form, linking them to the given tasting.
  async function uploadPendingPhotos(tastingId: string, photos: PendingPhoto[]) {
    for (const photo of photos) {
      if (photo.url) {
        const { data, error } = await supabase
          .from("wine_photos")
          .insert({ wine_id: id, tasting_id: tastingId, external_url: photo.url })
          .select("id, tasting_id, storage_path, external_url")
          .single();
        if (!error && data) setPhotos(ps => [...ps, data as Photo]);
      } else if (photo.file && userId) {
        let converted: File;
        try { converted = await convertIfNeeded(photo.file); } catch { continue; }
        const path = `${userId}/${id}/${photo.file.lastModified}_${converted.name}`;
        const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, converted);
        if (upErr) { alert(upErr.message); continue; }
        const { data, error } = await supabase
          .from("wine_photos")
          .insert({ wine_id: id, tasting_id: tastingId, storage_path: path })
          .select("id, tasting_id, storage_path, external_url")
          .single();
        if (!error && data) setPhotos(ps => [...ps, data as Photo]);
      }
    }
  }

  function beginEdit(t: Tasting) {
    setEditId(t.id);
    setEditDate(t.tasted_on ?? "");
    setEditNotes(t.notes ?? "");
  }

  async function saveEdit() {
    if (!editId) return;
    const oldEditId = editId;
    const { data, error } = await supabase
      .from("wine_tastings")
      .insert({ wine_id: id, tasted_on: editDate || null, notes: editNotes.trim() || null })
      .select("id, tasted_on, notes")
      .single();
    if (error) { alert(error.message); return; }

    const { error: photoError } = await supabase
      .from("wine_photos")
      .update({ tasting_id: data.id })
      .eq("tasting_id", oldEditId);
    if (photoError) {
      await supabase.from("wine_tastings").delete().eq("id", data.id);
      alert(photoError.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine_tastings")
      .delete()
      .eq("id", oldEditId);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    setTastings(ts => ts.map(t => t.id === oldEditId ? data as Tasting : t));
    setPhotos(ps => ps.map(p => p.tasting_id === oldEditId ? { ...p, tasting_id: data.id } : p));
    setEditId(null);
  }

  async function deleteTasting(tid: string) {
    if (!confirm("Delete this tasting note and its photos?")) return;
    await supabase.from("wine_tastings").delete().eq("id", tid);
    setTastings(ts => ts.filter(t => t.id !== tid));
    setPhotos(ps => ps.filter(p => p.tasting_id !== tid));
  }

  // ── Photo CRUD ───────────────────────────────────────────────────────────────

  async function addPhotoByUrl(target: string) {
    if (!photoUrl.trim()) return;
    const tastingId = target === "general" ? null : target;
    const { data, error } = await supabase
      .from("wine_photos")
      .insert({ wine_id: id, tasting_id: tastingId, external_url: photoUrl.trim() })
      .select("id, tasting_id, storage_path, external_url")
      .single();
    if (error) { alert(error.message); return; }
    setPhotos(ps => [...ps, data as Photo]);
    setPhotoUrl(""); setPhotoTarget(null);
  }

  async function uploadPhotoFile(rawFile: File, target: string) {
    if (!rawFile || !userId) return;
    setUploading(true);
    let file: File;
    try {
      file = await convertIfNeeded(rawFile);
    } catch (error) {
      setUploading(false);
      const message = error instanceof Error ? error.message : "unknown error";
      alert(`Could not convert this HEIC image: ${message}. Some newer HEIC variants are not decoded by the current browser converter yet.`);
      return;
    }
    const path = `${userId}/${id}/${rawFile.lastModified}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, file);
    if (upErr) { alert(upErr.message); setUploading(false); return; }
    const tastingId = target === "general" ? null : target;
    const { data, error } = await supabase
      .from("wine_photos")
      .insert({ wine_id: id, tasting_id: tastingId, storage_path: path })
      .select("id, tasting_id, storage_path, external_url")
      .single();
    setUploading(false);
    if (error) { alert(error.message); return; }
    setPhotos(ps => [...ps, data as Photo]);
    setPhotoTarget(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, target: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadPhotoFile(file, target);
    e.target.value = "";
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLDivElement>, target: string) {
    const imageItem = Array.from(e.clipboardData.items).find(item =>
      item.type.startsWith("image/")
    );
    const file = imageItem?.getAsFile();
    if (!file) return;
    e.preventDefault();
    const extension = file.type.split("/")[1] || "png";
    const namedFile = new File([file], `pasted-image.${extension}`, { type: file.type });
    await uploadPhotoFile(namedFile, target);
  }

  async function deletePhoto(p: Photo) {
    if (!confirm("Delete this photo?")) return;
    const url = resolveUrl(p);
    if (p.storage_path) {
      await supabase.storage.from("wine-photos").remove([p.storage_path]);
    }
    await supabase.from("wine_photos").delete().eq("id", p.id);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    if (wine?.cover_photo_url === url) {
      await supabase.from("wines").update({ cover_photo_url: null }).eq("id", id);
      setWine(w => w ? { ...w, cover_photo_url: null } : w);
    }
    if (wine && userId) {
      let groupCoverQuery = supabase
        .from("wine_group_notes")
        .update({ cover_photo_url: null })
        .eq("user_id", userId)
        .eq("wine_name", wine.name)
        .eq("cover_photo_url", url);

      groupCoverQuery =
        wine.producer_id === null
          ? groupCoverQuery.is("producer_id", null)
          : groupCoverQuery.eq("producer_id", wine.producer_id);

      const { error } = await groupCoverQuery;
      if (error) {
        alert(error.message);
      }
    }
  }

  async function setCover(p: Photo) {
    const url = resolveUrl(p);
    const { error } = await supabase.from("wines").update({ cover_photo_url: url }).eq("id", id);
    if (error) { alert(error.message); return; }
    setWine(w => w ? { ...w, cover_photo_url: url } : w);
  }

  async function clearCover() {
    const { error } = await supabase.from("wines").update({ cover_photo_url: null }).eq("id", id);
    if (error) { alert(error.message); return; }
    setWine(w => w ? { ...w, cover_photo_url: null } : w);
  }

  function replaceCover() {
    setPhotoTarget("general");
    setPhotoUrl("");
    document.getElementById("wine-photos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderPhotoAddForm(target: string) {
    return (
      <div
        className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3"
        onPaste={e => handlePaste(e, target)}
      >
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Paste image URL from the web…"
            value={photoUrl}
            onChange={e => setPhotoUrl(e.target.value)}
          />
          <Button onClick={() => addPhotoByUrl(target)} className="shrink-0">Add</Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span>Paste with Cmd/Ctrl+V · or</span>
          <label className="cursor-pointer rounded-xl border border-stone-200 bg-white px-3 py-1.5 font-medium transition hover:bg-stone-50">
            {uploading ? "Uploading…" : "Choose file"}
            <input
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={e => handleFileUpload(e, target)}
            />
          </label>
          <button
            onClick={() => { setPhotoTarget(null); setPhotoUrl(""); }}
            className="ml-auto text-stone-400 transition hover:text-stone-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function PhotoThumb({ p, size = "sm" }: { p: Photo; size?: "sm" | "md" }) {
    const url = resolveUrl(p);
    const isCover = wine?.cover_photo_url === url;
    const dim = size === "sm" ? "w-20 h-20" : "w-24 h-24";
    return (
      <div className="relative group">
        <img
          src={url}
          alt=""
          className={`${dim} object-cover rounded-xl border-2 ${isCover ? "border-black" : "border-transparent"}`}
        />
        {isCover && (
          <div className="absolute top-1 left-1 bg-black text-white text-[10px] px-1 rounded">cover</div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-xl flex flex-col items-center justify-center gap-1 transition-opacity">
          {!isCover && (
            <button onClick={() => setCover(p)} className="text-white text-xs underline">
              Set cover
            </button>
          )}
          <button onClick={() => deletePhoto(p)} className="text-red-300 text-xs underline">
            Delete
          </button>
        </div>
      </div>
    );
  }

  // ── Early returns ────────────────────────────────────────────────────────────

  if (notFound) return (
    <PageShell>
      <PageContainer className="max-w-3xl">
        <p className="text-stone-600">Wine not found.</p>
      </PageContainer>
    </PageShell>
  );

  if (!wine) return (
    <PageShell className="py-16">
      <PageContainer className="max-w-3xl">
        <p className="text-sm text-stone-500">Loading...</p>
      </PageContainer>
    </PageShell>
  );

  const generalPhotos = photos.filter(p => p.tasting_id === null);

  const rawMetaItems: Array<WineMetaBarItem | null> = [
    wine.vintage_year !== null
      ? { label: String(wine.vintage_year), href: `/knowledge/vintages/${wine.vintage_year}` }
      : { label: "NV" },
    wine.wine_type
      ? { label: wine.wine_type === "rose" ? "Rosé" : wine.wine_type.charAt(0).toUpperCase() + wine.wine_type.slice(1) }
      : null,
    wine.producer_id && wine.producers?.name
      ? { label: wine.producers.name, href: `/knowledge/producers/${wine.producer_id}` }
      : wine.producers?.name
        ? { label: wine.producers.name }
        : null,
    wine.subregion_id && wine.subregions?.name
      ? { label: wine.subregions.name, href: `/knowledge/subregions/${wine.subregion_id}` }
      : wine.subregions?.name
        ? { label: wine.subregions.name }
        : null,
    wine.region_id && wine.regions?.name
      ? { label: wine.regions.name, href: `/knowledge/regions/${wine.region_id}` }
      : wine.regions?.name
        ? { label: wine.regions.name }
        : null,
    wine.country_id && wine.countries?.name
      ? { label: wine.countries.name, href: `/knowledge/countries/${wine.country_id}` }
      : wine.countries?.name
        ? { label: wine.countries.name }
        : null,
  ];
  const metaItems = rawMetaItems.filter(
    (item): item is WineMetaBarItem => item !== null && Boolean(item.label)
  );
  const grapeItems: WineMetaBarItem[] = grapes.map((grape) => ({
    label: grape.name,
    href: `/knowledge/grapes/${grape.id}`,
  }));

  return (
    <PageShell>
      <PageContainer className="max-w-4xl pb-16">
        <div className="flex items-start justify-between gap-4">
          <PageHero>
            <Eyebrow>
              <Link href="/wines" className="inline-flex items-center gap-1 hover:text-stone-700">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3">
                  <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                My Wines
              </Link>
            </Eyebrow>
            <PageTitle>
              <Link href={getWineGroupHref(wine)} className="underline-offset-4 hover:underline">
                {wine.name}
              </Link>
            </PageTitle>
            <WineMetaBar items={metaItems} />
            <WineMetaBar items={grapeItems} className="mt-2" />
          </PageHero>
          <Button
            variant="secondary"
            className="mt-4 shrink-0 rounded-2xl px-4"
            onClick={() => (editingWine ? setEditingWine(false) : openEditWine())}
          >
            {editingWine ? "Cancel" : "Edit Wine"}
          </Button>
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
                <FieldLabel>Vintage (year / NV)</FieldLabel>
                <Input
                  placeholder="e.g. 2019 or NV"
                  value={editVintage}
                  onChange={(e) => setEditVintage(e.target.value)}
                />
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

        {wine.cover_photo_url && (
          <CoverPhoto
            className="mt-8"
            url={wine.cover_photo_url}
            alt={wine.name}
            onExpand={() => setShowCoverLightbox(true)}
            onReplace={replaceCover}
            onRemove={clearCover}
          />
        )}

        <Card className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Tasting Notes</CardTitle>
              <CardDescription className="mt-2">
                Track how this wine evolves across different tastings.
              </CardDescription>
            </div>
          {!showAdd && (
              <Button onClick={() => setShowAdd(true)}>Add Note</Button>
          )}
          </div>

        {showAdd && (
          <div className="mb-3 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Date tasted</label>
              <Input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Notes</label>
              <Textarea
                className="min-h-[120px]"
                placeholder="What did you taste, smell, feel…"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Photos</label>
              <PhotoPicker onChange={setAddTastingPhotos} />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveTasting}>Save</Button>
              <Button
                variant="secondary"
                onClick={() => { setShowAdd(false); setAddDate(""); setAddNotes(""); setAddTastingPhotos([]); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {tastings.length === 0 && !showAdd && (
            <p className="text-sm text-stone-500">No tasting notes yet.</p>
        )}

        <div className="space-y-3">
          {tastings.map(t => {
            const tastingPhotos = photos.filter(p => p.tasting_id === t.id);
            const isEditing = editId === t.id;
            const isAddingPhoto = photoTarget === t.id;

            return (
                <div key={t.id} className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                {isEditing ? (
                  <div className="space-y-2">
                      <Input
                      type="date"
                      value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                    />
                      <Textarea
                        className="min-h-[120px]"
                      value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                    />
                    <NotesEditBar
                      onSave={saveEdit}
                      onCancel={() => setEditId(null)}
                      onDelete={() => { setEditId(null); deleteTasting(editId!); }}
                    />
                  </div>
                ) : (
                  <>
                      <div className="mb-2 text-xs font-medium text-stone-500">{fmtDate(t.tasted_on)}</div>

                    {t.notes && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{t.notes}</p>
                    )}

                    {tastingPhotos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tastingPhotos.map(p => <PhotoThumb key={p.id} p={p} size="sm" />)}
                      </div>
                    )}

                    {isAddingPhoto && renderPhotoAddForm(t.id)}

                    <div className="mt-3 flex items-center gap-3">
                      {!isAddingPhoto && (
                        <button
                          onClick={() => { setPhotoTarget(t.id); setPhotoUrl(""); }}
                            className="text-xs text-stone-500 underline"
                        >
                          + Photo
                        </button>
                      )}
                        <button onClick={() => beginEdit(t)} className="text-xs text-stone-500 underline">
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTasting(t.id)}
                          className="ml-auto text-xs text-rose-500 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        </Card>

        <Card className="mt-8" id="wine-photos">
          <div className="mb-3 flex items-center justify-between">
          <div>
              <CardTitle className="text-2xl">Photos</CardTitle>
              <CardDescription className="mt-2">General photos, not linked to a tasting.</CardDescription>
          </div>
          {photoTarget !== "general" && (
              <Button
                variant="secondary"
              onClick={() => { setPhotoTarget("general"); setPhotoUrl(""); }}
            >
              + Add photo
              </Button>
          )}
          </div>

        {photoTarget === "general" && renderPhotoAddForm("general")}

        {generalPhotos.length > 0 ? (
          <CoverPhotoGrid
            items={generalPhotos.map((photo) => ({
              id: photo.id,
              url: resolveUrl(photo),
              alt: wine.name,
              isCover: wine.cover_photo_url === resolveUrl(photo),
              photo,
            }))}
            containerClassName="mt-3"
            itemClassName="h-24 w-24 shrink-0"
            onSetCover={(item) => setCover(item.photo)}
            onDelete={(item) => deletePhoto(item.photo)}
          />
        ) : (
          photoTarget !== "general" && (
              <p className="text-sm text-stone-500">No general photos yet.</p>
          )
        )}
        </Card>

      {(wine.countries?.notes || wine.regions?.notes || wine.subregions?.notes || grapeNotes.length > 0 || vintageNote?.notes) && (
        <Card className="mt-8">
          <CardTitle className="text-xl">Knowledge Notes</CardTitle>
          <CardDescription className="mt-1">Notes about this wine&apos;s origin, vintage, and grapes.</CardDescription>
          <div className="mt-4 space-y-4">
            {wine.countries?.notes && (
              <div>
                {wine.country_id ? (
                  <Link href={`/knowledge/countries/${wine.country_id}`} className="mb-1 inline-flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                    {wine.countries.name}
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ) : (
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{wine.countries.name}</div>
                )}
                <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">{wine.countries.notes}</p>
              </div>
            )}
            {wine.regions?.notes && (
              <div>
                {wine.region_id ? (
                  <Link href={`/knowledge/regions/${wine.region_id}`} className="mb-1 inline-flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                    {wine.regions.name}
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ) : (
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{wine.regions.name}</div>
                )}
                <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">{wine.regions.notes}</p>
              </div>
            )}
            {vintageNote?.notes && wine.regions?.name && (
              <div>
                {wine.region_id ? (
                  <Link href={`/knowledge/regions/${wine.region_id}#vintage-notes`} className="mb-1 inline-flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                    {wine.regions.name} {vintageNote.year}
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ) : (
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    {wine.regions.name} {vintageNote.year}
                  </div>
                )}
                <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">{vintageNote.notes}</p>
              </div>
            )}
            {wine.subregions?.notes && (
              <div>
                {wine.subregion_id ? (
                  <Link href={`/knowledge/subregions/${wine.subregion_id}`} className="mb-1 inline-flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                    {wine.subregions.name}
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ) : (
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">{wine.subregions.name}</div>
                )}
                <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">{wine.subregions.notes}</p>
              </div>
            )}
            {grapeNotes.map(({ id: grapeId, name, notes }) => (
              <div key={name}>
                <Link href={`/knowledge/grapes/${grapeId}`} className="mb-1 inline-flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                  {name}
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </Link>
                <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">{notes}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {similar.length > 0 && (
          <Card className="mt-8">
            <CardTitle className="text-2xl">Similar Wines</CardTitle>
            <CardDescription className="mt-2">Same producer, sub-region, or vintage.</CardDescription>
            <div className="mt-4 space-y-2">
            {similar.map(w => (
                <Link
                key={w.id}
                href={`/wines/${w.id}`}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 transition hover:bg-stone-50"
              >
                  <span className="text-sm font-medium text-stone-900">{w.name}</span>
                  <span className="shrink-0 text-sm text-stone-500">{w.vintage_year ?? "NV"}</span>
                </Link>
            ))}
            </div>
          </Card>
      )}
      </PageContainer>

      {wine.cover_photo_url && showCoverLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowCoverLightbox(false)}
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowCoverLightbox(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-stone-900 transition hover:bg-white"
            >
              Close
            </button>
            <div className="overflow-hidden rounded-[28px] bg-stone-950 shadow-2xl">
              <img src={wine.cover_photo_url} alt={wine.name} className="max-h-[85vh] w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
