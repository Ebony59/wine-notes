type SupabaseLikeError = {
  code?: string;
  message?: string;
};

export function isMissingRelationError(error: SupabaseLikeError | null | undefined, relationName: string) {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message?.includes(`'public.${relationName}'`) ||
    error.message?.includes(`"${relationName}"`) ||
    error.message?.includes(` ${relationName} `)
  );
}
