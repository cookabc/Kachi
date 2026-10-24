import type { ChangeEvent } from "react";
import { version } from "../../package.json";
import type { Lang, UiText } from "../ui";

export function Settings({
  t,
  lang,
  motion,
  onLang,
  onMotion,
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
        <div className="motion-row">
          <label htmlFor="motion-range">{t.settings.motionLabel}</label>
          <input
            id="motion-range"
            className="motion-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={motion}
            onChange={(event) => onMotion(Number(event.target.value))}
            aria-valuetext={t.settings.motionHint(motion)}
          />
          <p className="fine">{t.settings.motionHint(motion)}</p>
        </div>
        <button type="button" className="btn btn-green" onClick={onExport}>
          {t.settings.exportBtn}
        </button>
        <label className="file-button">
          {t.settings.importBtn}
          <input type="file" accept="application/json" onChange={onImport} />
        </label>
        <p className="fine">{t.settings.contentNote}</p>
        <dl className="colophon">
          <div>
            <dt>{t.settings.colophonVersion}</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>{t.settings.colophonLicense}</dt>
            <dd>AGPL-3.0 / CC BY-SA 4.0</dd>
          </div>
          <div>
            <dt>{t.settings.colophonSource}</dt>
            <dd>
              <a href="https://github.com/cookabc/Kachi" target="_blank" rel="noreferrer">
                github.com/cookabc/Kachi
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
