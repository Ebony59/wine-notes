import type { SupabaseClient } from "@supabase/supabase-js";

type WinePhotoForDelete = {
  storage_path: string | null;
  external_url: string | null;
};

type WineGroupNoteScope = {
  userId: string;
  wineName: string;
  producerId: number | null;
  deleteGroupNote?: boolean;
};

type DeleteWineVintagesOptions = {
  supabase: SupabaseClient;
  wineIds: string[];
  groupNote?: WineGroupNoteScope | null;
};

type DeleteWineVintagesResult = {
  storageCleanupError: string | null;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function deleteWineVintages({
  supabase,
  wineIds,
  groupNote,
}: DeleteWineVintagesOptions): Promise<DeleteWineVintagesResult> {
  const uniqueWineIds = uniqueValues(wineIds);
  let photos: WinePhotoForDelete[] = [];

  if (uniqueWineIds.length > 0) {
    const { data, error } = await supabase
      .from("wine_photos")
      .select("storage_path,external_url")
      .in("wine_id", uniqueWineIds);

    if (error) throw error;
    photos = (data ?? []) as WinePhotoForDelete[];
  }

  if (groupNote) {
    let groupNoteQuery = supabase
      .from("wine_group_notes")
      .delete()
      .eq("user_id", groupNote.userId)
      .eq("wine_name", groupNote.wineName);

    groupNoteQuery =
      groupNote.producerId === null
        ? groupNoteQuery.is("producer_id", null)
        : groupNoteQuery.eq("producer_id", groupNote.producerId);

    if (groupNote.deleteGroupNote) {
      const { error } = await groupNoteQuery;
      if (error) throw error;
    } else {
      const coverUrls = uniqueValues([
        ...photos.map((photo) => photo.external_url),
        ...photos.map((photo) =>
          photo.storage_path
            ? supabase.storage.from("wine-photos").getPublicUrl(photo.storage_path).data.publicUrl
            : null
        ),
      ]);

      if (coverUrls.length > 0) {
        let clearCoverQuery = supabase
          .from("wine_group_notes")
          .update({ cover_photo_url: null })
          .eq("user_id", groupNote.userId)
          .eq("wine_name", groupNote.wineName)
          .in("cover_photo_url", coverUrls);

        clearCoverQuery =
          groupNote.producerId === null
            ? clearCoverQuery.is("producer_id", null)
            : clearCoverQuery.eq("producer_id", groupNote.producerId);

        const { error } = await clearCoverQuery;
        if (error) throw error;
      }
    }
  }

  if (uniqueWineIds.length > 0) {
    const deleteSteps = [
      supabase.from("wine_photos").delete().in("wine_id", uniqueWineIds),
      supabase.from("wine_tastings").delete().in("wine_id", uniqueWineIds),
      supabase.from("wine_grapes").delete().in("wine_id", uniqueWineIds),
      supabase.from("wines").delete().in("id", uniqueWineIds),
    ];

    for (const step of deleteSteps) {
      const { error } = await step;
      if (error) throw error;
    }
  }

  const storagePaths = uniqueValues(photos.map((photo) => photo.storage_path));
  if (storagePaths.length === 0) return { storageCleanupError: null };

  const { error } = await supabase.storage.from("wine-photos").remove(storagePaths);
  return { storageCleanupError: error?.message ?? null };
}
