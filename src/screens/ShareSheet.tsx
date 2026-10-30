import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { buildPairCardSvg, CARD_HEIGHT, CARD_WIDTH, type PairCardInput } from "../share-card";
import type { UiText } from "../ui";

function cardFileName(card: PairCardInput): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `kachi-${slug(card.termA)}-vs-${slug(card.termB)}.png`;
}

async function svgToPngBlob(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg decode failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png encode failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ShareSheet({
  cards,
  t,
  onClose,
}: {
  cards: PairCardInput[];
  t: UiText;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [png, setPng] = useState<{ url: string; blob: Blob } | null>(null);
  const [failed, setFailed] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const card = cards[index];
  const fileName = cardFileName(card);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    setPng(null);
    setFailed(false);
    // Chained, not called inline: a pair that does not fit at the floor size
    // makes buildPairCardSvg throw, and a throw inside the effect body would
    // crash the whole screen instead of degrading to a failed export.
    Promise.resolve()
      .then(() => svgToPngBlob(buildPairCardSvg(card)))
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPng({ url, blob });
      })
      .catch((error) => {
        if (!alive) return;
        setFailed(true);
        console.warn("pair card export failed", error);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [card]);

  useEffect(() => {
    // Move focus into the dialog while it is open and hand it back on close.
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    sheetRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const cycleFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const save = () => {
    if (!png) return;
    const anchor = document.createElement("a");
    anchor.href = png.url;
    anchor.download = fileName;
    anchor.click();
  };

  const shareOut = async () => {
    if (!png) return;
    const file = new File([png.blob], fileName, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else save();
    } catch {
      /* user cancelled the share sheet: nothing to do */
    }
  };

  return (
    <dialog
      className="share-backdrop"
      ref={dialogRef}
      onKeyDown={cycleFocus}
      aria-label={t.share.open}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="share-sheet" ref={sheetRef} tabIndex={-1}>
        <div className="share-preview">
          {png ? <img src={png.url} alt={t.share.cardAlt(card.termA, card.termB)} /> : null}
        </div>
        {cards.length > 1 && (
          <div className="share-pager">
            <button
              type="button"
              aria-label={t.share.prevCard}
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              ‹
            </button>
            <span>{t.share.position(index + 1, cards.length)}</span>
            <button
              type="button"
              aria-label={t.share.nextCard}
              disabled={index === cards.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              ›
            </button>
          </div>
        )}
        <button type="button" className="btn btn-gold" disabled={!png} onClick={save}>
          {t.share.saveImage}
        </button>
        {"share" in navigator && (
          <button type="button" className="btn btn-green" disabled={!png} onClick={() => void shareOut()}>
            {t.share.shareBtn}
          </button>
        )}
        {failed && <p className="share-hint">{t.share.exportFailed}</p>}
        <p className="share-hint">{t.share.saveHint}</p>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t.share.close}
        </button>
      </div>
    </dialog>
  );
}
