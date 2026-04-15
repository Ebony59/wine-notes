"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DetectedImageFormat = "heic" | "jpeg" | "png" | "gif" | "webp" | "unknown";

async function detectImageFormat(file: File): Promise<DetectedImageFormat> {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = Array.from(header, byte => String.fromCharCode(byte)).join("");

  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) return "png";
  if (ascii.startsWith("GIF8")) return "gif";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "webp";

  const brand = ascii.slice(8, 12);
  if (
    ascii.slice(4, 8) === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)
  ) {
    return "heic";
  }

  return "unknown";
}

async function convertIfNeeded(file: File): Promise<File> {
  const detectedFormat = await detectImageFormat(file);
  const looksLikeHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (detectedFormat !== "heic") {
    // Some device/share targets preserve a .heic name even when the payload is already JPEG/PNG.
    // In that case, skip conversion and upload the bytes we actually have.
    if (looksLikeHeic && detectedFormat === "jpeg") {
      return new File([file], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
    }
    if (looksLikeHeic && detectedFormat === "png") {
      return new File([file], file.name.replace(/\.hei[cf]$/i, ".png"), { type: "image/png" });
    }
    return file;
  }

  const jpegName = file.name.replace(/\.hei[cf]$/i, ".jpg");

  // Stage 1: native canvas decode — works on Safari (which supports HEIC natively)
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Canvas toBlob failed")), "image/jpeg", 0.85)
    );
    return new File([blob], jpegName, { type: "image/jpeg" });
  } catch {
    // Browser can't natively decode HEIC — fall through to the bundled decoder
  }

  // Stage 2: heic-to ships a newer libheif build than heic2any.
  const mod = await import("heic-to");
  const converter =
    typeof (mod as any).heicTo === "function"
      ? (mod as any).heicTo
      : typeof (mod as any).default === "function"
        ? (mod as any).default
        : null;
  if (!converter) {
    throw new Error("HEIC converter failed to load");
  }
  const result = await converter({ blob: file, type: "image/jpeg", quality: 0.85 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], jpegName, { type: "image/jpeg" });
}

type Wine = {
  id: string;
  name: string;
  vintage_year: number | null;
  cover_photo_url: string | null;
  producer_id: number | null;
  subregion_id: number | null;
  producers: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
};

type GrapeLink = {
  grapes: { name: string } | null;
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
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Add tasting
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addNotes, setAddNotes] = useState("");

  // Edit tasting
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Photo add — tracks which tasting (or "general") has the add-photo form open
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      if (!uid) { location.href = "/"; return; }
      setUserId(uid);
      loadAll();
    });

    async function loadAll() {
      const { data: w, error: wErr } = await supabase
        .from("wines")
        .select(`
          id, name, vintage_year, cover_photo_url, producer_id, subregion_id,
          producers(name), countries(name), regions(name), subregions(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (wErr) { alert(wErr.message); return; }
      if (!w) { setNotFound(true); return; }
      setWine(w as Wine);

      const [{ data: ts }, { data: ps }, { data: grapeLinks, error: grapeError }] = await Promise.all([
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
          .select("grapes(name)")
          .eq("wine_id", id),
      ]);

      setTastings((ts ?? []) as Tasting[]);
      setPhotos((ps ?? []) as Photo[]);
      if (grapeError) { alert(grapeError.message); return; }
      setGrapes(normalizeGrapeList(
        ((grapeLinks ?? []) as GrapeLink[])
          .map((row) => row.grapes?.name)
          .filter((value): value is string => Boolean(value))
      ));

      // Similar wines
      const wTyped = w as Wine;
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
    setAddDate(""); setAddNotes(""); setShowAdd(false);
  }

  function beginEdit(t: Tasting) {
    setEditId(t.id);
    setEditDate(t.tasted_on ?? "");
    setEditNotes(t.notes ?? "");
  }

  async function saveEdit() {
    if (!editId) return;
    const { data, error } = await supabase
      .from("wine_tastings")
      .update({ tasted_on: editDate || null, notes: editNotes.trim() || null })
      .eq("id", editId)
      .select("id, tasted_on, notes")
      .single();
    if (error) { alert(error.message); return; }
    setTastings(ts => ts.map(t => t.id === editId ? data as Tasting : t));
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
    } catch (err: any) {
      setUploading(false);
      alert(`Could not convert this HEIC image: ${err?.message ?? "unknown error"}. Some newer HEIC variants are not decoded by the current browser converter yet.`);
      return;
    }
    const path = `${userId}/${id}/${Date.now()}_${file.name}`;
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

  // ── Render helpers ───────────────────────────────────────────────────────────

  function PhotoAddForm({ target }: { target: string }) {
    return (
      <div
        className="mt-2 p-3 bg-gray-50 rounded-lg border space-y-2"
        onPaste={e => handlePaste(e, target)}
      >
        <div className="flex gap-2">
          <input
            type="text"
            className="border rounded px-2 py-1 text-sm flex-1"
            placeholder="Paste image URL from the web…"
            value={photoUrl}
            onChange={e => setPhotoUrl(e.target.value)}
          />
          <button
            onClick={() => addPhotoByUrl(target)}
            className="px-2 py-1 text-sm rounded bg-black text-white whitespace-nowrap"
          >
            Add
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">paste an image with Cmd/Ctrl+V or upload from device</span>
          <label className="cursor-pointer px-2 py-1 border rounded text-xs hover:bg-gray-100">
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
            className="text-xs text-gray-400 underline ml-auto"
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
    <main className="min-h-screen p-4 max-w-xl mx-auto">
      <p className="text-gray-600">Wine not found.</p>
      <a href="/wines" className="mt-2 inline-block text-sm underline">← My wines</a>
    </main>
  );

  if (!wine) return (
    <main className="min-h-screen p-4 max-w-xl mx-auto">
      <p className="text-sm text-gray-400">Loading…</p>
    </main>
  );

  const generalPhotos = photos.filter(p => p.tasting_id === null);
  const meta = [wine.producers?.name, wine.subregions?.name, wine.regions?.name, wine.countries?.name]
    .filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-xl mx-auto pb-16">

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <a href="/wines" className="text-sm underline">← My wines</a>
        <a href={`/wines/${id}/edit`} className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50">
          Edit wine
        </a>
      </div>

      {/* Cover photo */}
      {wine.cover_photo_url && (
        <div className="mt-4 rounded-xl overflow-hidden aspect-video bg-gray-100">
          <img src={wine.cover_photo_url} alt={wine.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Title */}
      <div className="mt-4">
        <h1 className="text-2xl font-semibold">
          {wine.name}
          <span className="ml-2 text-lg text-gray-500 font-normal">{wine.vintage_year ?? "NV"}</span>
        </h1>
        {meta && <p className="text-sm text-gray-500 mt-0.5">{meta}</p>}
        {grapes.length > 0 && (
          <p className="mt-2 text-sm text-gray-700">
            <span className="font-medium">Grapes:</span>{" "}
            {grapes.join(", ")}
          </p>
        )}
      </div>

      {/* ── Tasting Notes ── */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Tasting Notes</h2>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 text-sm rounded-lg bg-black text-white hover:opacity-90"
            >
              + Add
            </button>
          )}
        </div>

        {showAdd && (
          <div className="rounded-xl border p-3 mb-3 bg-gray-50 space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Date tasted</label>
              <input
                type="date"
                className="border rounded px-2 py-1.5 text-sm w-full"
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
              <textarea
                className="border rounded px-2 py-1.5 text-sm w-full min-h-[120px]"
                placeholder="What did you taste, smell, feel…"
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveTasting} className="px-3 py-1.5 text-sm rounded bg-black text-white">
                Save
              </button>
              <button
                onClick={() => { setShowAdd(false); setAddDate(""); setAddNotes(""); }}
                className="px-3 py-1.5 text-sm rounded border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {tastings.length === 0 && !showAdd && (
          <p className="text-sm text-gray-400">No tasting notes yet.</p>
        )}

        <div className="space-y-3">
          {tastings.map(t => {
            const tastingPhotos = photos.filter(p => p.tasting_id === t.id);
            const isEditing = editId === t.id;
            const isAddingPhoto = photoTarget === t.id;

            return (
              <div key={t.id} className="rounded-xl border p-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="date"
                      className="border rounded px-2 py-1.5 text-sm w-full"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                    />
                    <textarea
                      className="border rounded px-2 py-1.5 text-sm w-full min-h-[120px]"
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1.5 text-sm rounded bg-black text-white">
                        Save
                      </button>
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-sm rounded border">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-medium text-gray-500 mb-2">{fmtDate(t.tasted_on)}</div>

                    {t.notes && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{t.notes}</p>
                    )}

                    {tastingPhotos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tastingPhotos.map(p => <PhotoThumb key={p.id} p={p} size="sm" />)}
                      </div>
                    )}

                    {isAddingPhoto && <PhotoAddForm target={t.id} />}

                    <div className="mt-3 flex items-center gap-3">
                      {!isAddingPhoto && (
                        <button
                          onClick={() => { setPhotoTarget(t.id); setPhotoUrl(""); }}
                          className="text-xs text-gray-500 underline"
                        >
                          + Photo
                        </button>
                      )}
                      <button onClick={() => beginEdit(t)} className="text-xs text-gray-500 underline">
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTasting(t.id)}
                        className="text-xs text-red-400 underline ml-auto"
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
      </section>

      {/* ── General Photos ── */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-lg">Photos</h2>
            <p className="text-xs text-gray-500">Not tied to a specific tasting</p>
          </div>
          {photoTarget !== "general" && (
            <button
              onClick={() => { setPhotoTarget("general"); setPhotoUrl(""); }}
              className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
            >
              + Add photo
            </button>
          )}
        </div>

        {photoTarget === "general" && <PhotoAddForm target="general" />}

        {generalPhotos.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {generalPhotos.map(p => <PhotoThumb key={p.id} p={p} size="md" />)}
          </div>
        ) : (
          photoTarget !== "general" && (
            <p className="text-sm text-gray-400">No general photos yet.</p>
          )
        )}
      </section>

      {/* ── Similar Wines ── */}
      {similar.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-lg mb-1">Similar Wines</h2>
          <p className="text-xs text-gray-500 mb-3">Same producer / sub-region / vintage</p>
          <div className="space-y-2">
            {similar.map(w => (
              <a
                key={w.id}
                href={`/wines/${w.id}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border px-3 py-2 hover:bg-gray-50"
              >
                <span className="font-medium text-sm">{w.name}</span>
                <span className="text-sm text-gray-500 flex-shrink-0">{w.vintage_year ?? "NV"}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
