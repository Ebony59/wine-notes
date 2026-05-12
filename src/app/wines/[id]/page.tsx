"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getWineGroupHref } from "@/components/WineCard";
import { createClient } from "@/lib/supabase/client";
import { convertIfNeeded, type PendingPhoto } from "@/lib/photo-utils";
import { CoverPhoto } from "@/components/CoverPhoto";
import { NotesEditBar } from "@/components/NotesEditBar";
import { PhotoPicker } from "@/components/PhotoPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

function normalizeGrapeList(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export default function WineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [wine, setWine] = useState<Wine | null>(null);
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [similar, setSimilar] = useState<SimilarWine[]>([]);
  const [grapes, setGrapes] = useState<string[]>([]);
  const [grapeNotes, setGrapeNotes] = useState<{ id: number; name: string; notes: string }[]>([]);
  const [vintageNote, setVintageNote] = useState<VintageKnowledge | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
          id, name, vintage_year, cover_photo_url, producer_id, country_id, region_id, subregion_id,
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
      setGrapes(normalizeGrapeList(
        grapeRows
          .map((row) => row.grapes?.name)
          .filter((value): value is string => Boolean(value))
      ));
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
    if (p.storage_path) {
      await supabase.storage.from("wine-photos").remove([p.storage_path]);
    }
    await supabase.from("wine_photos").delete().eq("id", p.id);
    setPhotos(ps => ps.filter(x => x.id !== p.id));
    if (wine?.cover_photo_url === resolveUrl(p)) {
      await supabase.from("wines").update({ cover_photo_url: null }).eq("id", id);
      setWine(w => w ? { ...w, cover_photo_url: null } : w);
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

  const metaEntries = [
    wine.producer_id && wine.producers?.name ? { label: wine.producers.name, href: `/knowledge/producers/${wine.producer_id}` } : wine.producers?.name ? { label: wine.producers.name, href: null } : null,
    wine.subregion_id && wine.subregions?.name ? { label: wine.subregions.name, href: `/knowledge/subregions/${wine.subregion_id}` } : wine.subregions?.name ? { label: wine.subregions.name, href: null } : null,
    wine.region_id && wine.regions?.name ? { label: wine.regions.name, href: `/knowledge/regions/${wine.region_id}` } : wine.regions?.name ? { label: wine.regions.name, href: null } : null,
    wine.country_id && wine.countries?.name ? { label: wine.countries.name, href: `/knowledge/countries/${wine.country_id}` } : wine.countries?.name ? { label: wine.countries.name, href: null } : null,
  ].filter((e): e is { label: string; href: string | null } => e !== null && Boolean(e.label));

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
            <PageIntro>
              <span className="inline-flex flex-wrap items-center gap-y-0.5">
                <span>{wine.vintage_year ?? "NV"}</span>
                {metaEntries.map((entry, i) => (
                  <Fragment key={i}>
                    <span className="mx-1.5 text-stone-400">·</span>
                    {entry.href ? (
                      <Link href={entry.href} className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
                        {entry.label}
                        <svg className="h-3 w-3 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ) : (
                      <span>{entry.label}</span>
                    )}
                  </Fragment>
                ))}
              </span>
            </PageIntro>
            {grapes.length > 0 && (
              <div className="mt-3">
                <Badge>{grapes.join(", ")}</Badge>
              </div>
            )}
          </PageHero>
          <Button variant="secondary" asChild className="mt-4 shrink-0 rounded-2xl px-4">
            <Link href={`/wines/${id}/edit`}>Edit Wine</Link>
          </Button>
        </div>

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
          <div className="mt-3 flex flex-wrap gap-2">
            {generalPhotos.map(p => <PhotoThumb key={p.id} p={p} size="md" />)}
          </div>
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
