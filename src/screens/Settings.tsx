import type { ChangeEvent } from "react";
import { version } from "../../package.json";
import type { Lang, UiText } from "../ui";

export interface PackChoice {
  id: string;
  level: number;
  title: string;
  goal: string;
  conceptCount: number;
  /** False when the pack is registered but its content is not written yet. */
  ready: boolean;
  legacy?: boolean;
}

export function Settings({
  t,
  lang,
  motion,
  packs,
  packId,
  onLang,
  onMotion,
  onPack,
  onExport,
  onImport,
}: {
  t: UiText;
  lang: Lang;
  motion: number;
  packs: PackChoice[];
  packId: string;
  onLang: (lang: Lang) => void;
  onMotion: (level: number) => void;
  onPack: (id: string) => void;
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
        <fieldset className="pack-switch" aria-label={lang === "zh-CN" ? "课程包" : "Course packs"}>
          {packs.map((pack) => (
            <button
              type="button"
              key={pack.id}
              className={`pack-choice${packId === pack.id ? " on" : ""}${pack.ready ? "" : " is-pending"}`}
              aria-pressed={packId === pack.id}
              disabled={!pack.ready}
              title={pack.goal}
              onClick={() => onPack(pack.id)}
            >
              <span className="pack-level">T{pack.level}</span>
              <span className="pack-title">{pack.title}</span>
              <span className="pack-count">
                {pack.ready
                  ? `${pack.conceptCount} ${lang === "zh-CN" ? "个词" : "terms"}`
                  : lang === "zh-CN"
                    ? "准备中"
                    : "in progress"}
              </span>
            </button>
          ))}
        </fieldset>
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
