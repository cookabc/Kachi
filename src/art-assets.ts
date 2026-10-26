// Art asset manifest. The rebuild moves term art out of inline SVG strings
// (art.tsx) and into generated image files, because 231 concepts is not a
// hand-drawing scale. Legacy hand-drawn entries stay in art.tsx and win when
// both exist, so the current pack keeps its exact look.
//
// Resolution order in artForSize: asset manifest → legacy SVG → joke placeholder.
// Tests assert no *published concept* falls through to the placeholder.
import artManifest from "../content/art-manifest.json";

export type ArtSize = "xs" | "sm" | "lg" | "hero";

interface ArtEntry {
  /** Square source image, 512px. */
  file: string;
  /** Dominant background, so the card can match before the image decodes. */
  bg: string;
}

const MANIFEST = artManifest as { concepts: Record<string, ArtEntry> };

export function assetFor(id: string): ArtEntry | undefined {
  return MANIFEST.concepts[id];
}

export function hasAsset(id: string): boolean {
  return Boolean(MANIFEST.concepts[id]);
}

/** Pixel size per art slot; xs/sm are chips, lg is an answer tile, hero is the teach stage. */
const SIZE_PX: Record<ArtSize, number> = { xs: 28, sm: 40, lg: 72, hero: 168 };

export function artAssetElement(id: string, size: ArtSize): string | null {
  const entry = assetFor(id);
  if (!entry) return null;
  const px = SIZE_PX[size];
  return `<img class="term-art-img ${size}" src="${entry.file}" width="${px}" height="${px}" alt="" decoding="async" loading="lazy" />`;
}

export { SIZE_PX };
