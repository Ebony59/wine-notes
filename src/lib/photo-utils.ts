// ── Shared photo types ────────────────────────────────────────────────────────

export type PendingPhoto = {
  id: string;
  file: File | null; // null = URL-based
  url: string;       // empty = file-based
  preview: string | null; // blob URL or external URL for display
  converting: boolean;
};

// ── HEIC detection & conversion ───────────────────────────────────────────────

type DetectedImageFormat = "heic" | "jpeg" | "png" | "gif" | "webp" | "unknown";
type HeicConverter = (options: { blob: Blob; type: string; quality: number }) => Promise<Blob | Blob[]>;
type HeicModule = { heicTo?: HeicConverter; default?: HeicConverter };

async function detectImageFormat(file: File): Promise<DetectedImageFormat> {
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = Array.from(header, byte => String.fromCharCode(byte)).join("");

  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return "png";
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

export async function convertIfNeeded(file: File): Promise<File> {
  const detectedFormat = await detectImageFormat(file);
  const looksLikeHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (detectedFormat !== "heic") {
    if (looksLikeHeic && detectedFormat === "jpeg") {
      return new File([file], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
    }
    if (looksLikeHeic && detectedFormat === "png") {
      return new File([file], file.name.replace(/\.hei[cf]$/i, ".png"), { type: "image/png" });
    }
    return file;
  }

  const jpegName = file.name.replace(/\.hei[cf]$/i, ".jpg");

  // Stage 1: native canvas decode (Safari supports HEIC natively)
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
    // fall through to bundled decoder
  }

  // Stage 2: heic-to bundled decoder
  const mod = (await import("heic-to")) as unknown as HeicModule;
  const converter =
    typeof mod.heicTo === "function"
      ? mod.heicTo
      : typeof mod.default === "function"
        ? mod.default
        : null;
  if (!converter) throw new Error("HEIC converter failed to load");
  const result = await converter({ blob: file, type: "image/jpeg", quality: 0.85 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], jpegName, { type: "image/jpeg" });
}
