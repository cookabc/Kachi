import type { ChangeEvent } from "react";
import type { Lang, UiText } from "../ui";

export function Settings({
  t,
  lang,
  onLang,
  onExport,
  onImport,
}: {
  t: UiText;
  lang: Lang;
  motion: number;
  onLang: (lang: Lang) => void;
  onMotion: (level: number) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <header className="top">
        <div className="brand">{t.settings.brand}</div>
      </header>
      <div className="prac-hero">
        <h1>{t.settings.title}</h1>
        <p className="sub">{t.settings.copy}</p>
        <fieldset className="lang-switch" aria-label={t.settings.langLabel}>
          {(Object.entries(t.settings.langNames) as Array<[Lang, string]>).map(([value, name]) => (
            <button
              type="button"
              key={value}
              className={lang === value ? "on" : ""}
              aria-pressed={lang === value}
              onClick={() => onLang(value)}
            >
              {name}
            </button>
          ))}
        </fieldset>
        <button type="button" className="btn btn-green" onClick={onExport}>
          {t.settings.exportBtn}
        </button>
        <label className="file-button">
          {t.settings.importBtn}
          <input type="file" accept="application/json" onChange={onImport} />
        </label>
        <p className="fine">{t.settings.contentNote}</p>
      </div>
    </>
  );
}
