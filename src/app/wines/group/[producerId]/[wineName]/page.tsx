"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CoverPhoto } from "@/components/CoverPhoto";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Eyebrow,
  PageContainer,
  PageHero,
  PageIntro,
  PageShell,
  PageTitle,
} from "@/components/ui/page-shell";

type WineVintage = {
  id: string;
  name: string;
  vintage_year: number | null;
  cover_photo_url: string | null;
  producers: { name: string } | null;
  countries: { name: string } | null;
  regions: { name: string } | null;
  subregions: { name: string } | null;
};

type Photo = {
  id: string;
  wine_id: string;
  tasting_id: string | null;
  storage_path: string | null;
  external_url: string | null;
};

export default function WineGroupPage() {
  const { producerId, wineName } = useParams<{ producerId: string; wineName: string }>();
  const decodedName = decodeURIComponent(wineName);
  const numericProducerId = producerId === "0" ? null : Number(producerId);

  const supabase = useMemo(() => createClient(), []);
  const [vintages, setVintages] = useState<WineVintage[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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
        .select("id, name, vintage_year, cover_photo_url, producers(name), countries(name), regions(name), subregions(name)")
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
        const { data: photosData } = await supabase
          .from("wine_photos")
          .select("id, wine_id, tasting_id, storage_path, external_url")
          .in("wine_id", wineIds)
          .order("created_at", { ascending: true });
        setPhotos((photosData ?? []) as Photo[]);
      }

      // Load general notes
      let notesQuery = supabase
        .from("wine_group_notes")
        .select("notes")
        .eq("user_id", uid)
        .eq("wine_name", decodedName);

      if (numericProducerId !== null) {
        notesQuery = notesQuery.eq("producer_id", numericProducerId);
      } else {
        notesQuery = notesQuery.is("producer_id", null);
      }

      const { data: notesData } = await notesQuery.maybeSingle();
      const existing = notesData?.notes ?? "";
      setNotes(existing);
      setSavedNotes(existing);
      setLoading(false);
    }
  }, [supabase, decodedName, numericProducerId]);

  function resolvePhotoUrl(p: Photo): string {
    if (p.external_url) return p.external_url;
    if (p.storage_path) {
      return supabase.storage.from("wine-photos").getPublicUrl(p.storage_path).data.publicUrl;
    }
    return "";
  }

  async function setCoverPhoto(p: Photo) {
    const url = resolvePhotoUrl(p);
    const { error } = await supabase
      .from("wines")
      .update({ cover_photo_url: url })
      .eq("id", p.wine_id);
    if (error) { alert(error.message); return; }
    setVintages((vs) =>
      vs.map((v) => (v.id === p.wine_id ? { ...v, cover_photo_url: url } : v))
    );
  }

  async function removeCover() {
    const vintage = vintages.find((v) => v.cover_photo_url !== null);
    if (!vintage) return;
    const { error } = await supabase.from("wines").update({ cover_photo_url: null }).eq("id", vintage.id);
    if (error) { alert(error.message); return; }
    setVintages((vs) => vs.map((v) => (v.id === vintage.id ? { ...v, cover_photo_url: null } : v)));
  }

  async function saveNotes() {
    if (!userId) return;

    let selectQuery = supabase
      .from("wine_group_notes")
      .select("id")
      .eq("user_id", userId)
      .eq("wine_name", decodedName);

    if (numericProducerId !== null) {
      selectQuery = selectQuery.eq("producer_id", numericProducerId);
    } else {
      selectQuery = selectQuery.is("producer_id", null);
    }

    const { data: existing } = await selectQuery.maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("wine_group_notes")
        .update({ notes: notes.trim() || null })
        .eq("id", existing.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase
        .from("wine_group_notes")
        .insert({
          user_id: userId,
          wine_name: decodedName,
          producer_id: numericProducerId,
          notes: notes.trim() || null,
        });
      if (error) { alert(error.message); return; }
    }

    setSavedNotes(notes.trim());
    setEditing(false);
  }

  function isCover(p: Photo): boolean {
    const url = resolvePhotoUrl(p);
    return vintages.some((v) => v.id === p.wine_id && v.cover_photo_url === url);
  }

  const firstVintage = vintages[0];
  const producerName = firstVintage?.producers?.name;
  const location = [
    firstVintage?.countries?.name,
    firstVintage?.regions?.name,
    firstVintage?.subregions?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  // Show the first cover photo found across any vintage
  const coverUrl = vintages.find((v) => v.cover_photo_url)?.cover_photo_url ?? null;

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
          <PageTitle>{decodedName}</PageTitle>
          {(producerName || location) && (
            <PageIntro>{[producerName, location].filter(Boolean).join(" · ")}</PageIntro>
          )}
        </PageHero>

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

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => {
                const url = resolvePhotoUrl(p);
                const cover = isCover(p);
                const vintageYear = vintages.find((v) => v.id === p.wine_id)?.vintage_year;

                return (
                  <Link
                    key={p.id}
                    href={`/wines/${p.wine_id}`}
                    className="group relative block aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                  >
                    {/* Photo */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                    />

                    {/* Dark scrim on hover */}
                    <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/40" />

                    {/* Vintage label slides up from bottom on hover */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-xs font-semibold text-white transition-transform duration-300 group-hover:translate-y-0">
                      {vintageYear ?? "NV"} →
                    </div>

                    {/* Cover badge — always visible */}
                    {cover && (
                      <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-lg bg-stone-900/85 px-2 py-1 text-[11px] font-semibold text-white shadow-md">
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="14" height="10" rx="2" />
                          <circle cx="8" cy="9" r="2.5" />
                          <path d="M5.5 4l1-2h3l1 2" />
                        </svg>
                        Cover
                      </div>
                    )}

                    {/* Set cover button — always visible, clearly tappable */}
                    {!cover && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCoverPhoto(p);
                        }}
                        className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold text-stone-800 shadow-md transition hover:bg-white active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
                      >
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="14" height="10" rx="2" />
                          <circle cx="8" cy="9" r="2.5" />
                          <path d="M5.5 4l1-2h3l1 2" />
                        </svg>
                        Cover
                      </button>
                    )}
                  </Link>
                );
              })}
            </div>
          </Card>
        )}
      </PageContainer>
    </PageShell>
  );
}
