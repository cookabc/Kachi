#!/usr/bin/env node
/**
 * generate-audio.mjs — 用 fish.audio 预生成词头朗读（英/美双音色）。
 *
 * 为什么是预生成而不是运行时合成：系统 voice 的音质随设备而异，而词头朗读是
 * 产品的核心内容。例句朗读仍走运行时合成——它长 8 倍，全量预生成会让离线包
 * 从 7.5MB 涨到 25MB，而例句的容错度高得多。
 *
 * 网络前提（2026-10-28 实测）：本机 DNS 对 api.fish.audio 返回被污染的地址
 * （2a03:2880:…face:b00c，是 Facebook 的段）。必须用 DoH 解析真实 IP 后
 * 以 --resolve 方式请求。脚本自己做这件事，不依赖系统解析。
 *
 * 用法：
 *   node scripts/generate-audio.mjs [--pack t1-finance-news] [--force] [--dry-run]
 * 输出：public/audio/<slug>-us.mp3、<slug>-gb.mp3、content/audio-manifest.json
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, "public/audio");
const MANIFEST = path.join(ROOT, "content/audio-manifest.json");
const PACKS = [
  "t1-finance-news",
  "t2-company-earnings",
  "t3-bonds-rates",
  "t4-forex-macro",
  "t5-quant-research",
  "hedge-or-pledge",
];

// 039 项目验证过的音色，女声、清晰、适合教学。
const VOICE = "bc9e47fd83a04010ad6617ed54b92ee3";
const MODEL = "s2.1-pro-free";
const API = "api.fish.audio";
// DoH 解析出的 Cloudflare 地址；脚本每次启动重新解析，不写死。
const DOH = "https://cloudflare-dns.com/dns-query";

const slug = (id) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function parseArgs(argv) {
  const out = { pack: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--pack") out.pack = argv[++i];
    else if (argv[i] === "--force") out.force = true;
    else if (argv[i] === "--dry-run") out.dryRun = true;
  }
  return out;
}

/** 读 .env 里的 FISH_API / FISH_API_KEY。凭据不进仓。 */
function credential() {
  const candidates = [
    process.env.FISH_API_KEY,
    process.env.FISH_API,
    "/Users/advance/Documents/039_x-account/.env",
  ];
  if (candidates[0]) return candidates[0];
  if (candidates[1]) return candidates[1];
  const envFile = candidates[2];
  if (existsSync(envFile)) {
    const match = /^FISH_API(?:_KEY)?=(.*)$/m.exec(readFileSync(envFile, "utf8"));
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("No fish.audio credential (FISH_API_KEY / FISH_API)");
}

/** 用 DoH 拿真实 IP。系统解析在本机被污染，不能信。 */
async function resolveApiIp() {
  const response = await fetch(`${DOH}?name=${API}&type=A`, {
    headers: { Accept: "application/dns-json" },
  });
  const body = await response.json();
  const ip = (body.Answer ?? []).find((answer) => answer.type === 1)?.data;
  if (!ip) throw new Error("DoH returned no A record for api.fish.audio");
  return ip;
}

async function synth(text, language, key, ip) {
  const body = JSON.stringify({
    text,
    reference_id: VOICE,
    format: "mp3",
    sample_rate: 44100,
    mp3_bitrate: 128,
    language,
  });
  const { stdout } = await run(
    "curl",
    [
      "-sS",
      "--max-time",
      "45",
      "--resolve",
      `${API}:443:${ip}`,
      `https://${API}/v1/tts`,
      "-H",
      `Authorization: Bearer ${key}`,
      "-H",
      "Content-Type: application/json",
      "-H",
      `model: ${MODEL}`,
      "-d",
      body,
      "-o",
      "-",
      "-w",
      "%{http_code}",
    ],
    { maxBuffer: 8 * 1024 * 1024, encoding: "buffer" },
  );
  // -w 把状态码附在二进制之后；拆出来判断，音频部分才是 mp3。
  const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const tail = buf.subarray(-3).toString();
  const code = Number.parseInt(tail, 10);
  const audio = buf.subarray(0, buf.length - 3);
  if (code !== 200 || audio.length < 1000) {
    throw new Error(`fish ${language}: HTTP ${code} (${audio.length}B)`);
  }
  return audio;
}

/** mp3 时长（秒）。用 ffprobe，和插画管线用 cwebp 一样是外部工具依赖。 */
async function durationSeconds(file) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  return Number.parseFloat(String(stdout).trim());
}

/**
 * A single word should never run past four seconds (the longest real term here,
 * "weaken", measures 3.2s; the failure mode this catches was 47.6s). fish.audio occasionally
 * returns nearly a minute of audio for one word (measured: backtest, 47.6s) —
 * checking only the HTTP status would have shipped it.
 */
const MAX_SECONDS = 4;

/** 概念按 pack 去重收集；同一 id 在多个 pack 出现时只生成一次。 */
function concepts(options) {
  const seen = new Map();
  for (const pack of PACKS) {
    if (options.pack && pack !== options.pack) continue;
    const file = path.join(ROOT, "content/packs", pack, "zh-CN/course.json");
    if (!existsSync(file)) continue;
    for (const concept of JSON.parse(readFileSync(file, "utf8")).concepts) {
      if (!seen.has(concept.id)) seen.set(concept.id, concept.term);
    }
  }
  return [...seen.entries()].map(([id, term]) => ({ id, term }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const list = concepts(options);
  const manifest = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : {
        _comment:
          "Pre-generated term audio (fish.audio). Example sentences stay on runtime synthesis: they are ~8x longer and would take the offline bundle from 7.5MB to 25MB.",
        voice: VOICE,
        model: MODEL,
        words: {},
      };

  const pending = list.filter(({ id }) => options.force || !manifest.words[id]);
  console.log(`Pending: ${pending.length} of ${list.length} terms${options.dryRun ? " (dry run)" : ""}`);
  if (options.dryRun || !pending.length) return;

  const key = credential();
  const ip = await resolveApiIp();
  console.log(`api.fish.audio → ${ip}`);
  mkdirSync(AUDIO_DIR, { recursive: true });

  let done = 0;
  let failed = 0;
  for (const { id, term } of pending) {
    const base = slug(id);
    try {
      const files = {};
      for (const [accent, lang] of [
        ["us", "en-US"],
        ["gb", "en-GB"],
      ]) {
        const target = path.join(AUDIO_DIR, `${base}-${accent}.mp3`);
        // Retry once on an implausible duration; a second failure is a real error.
        let seconds = 0;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          writeFileSync(target, await synth(term, lang, key, ip));
          seconds = await durationSeconds(target);
          if (seconds > 0 && seconds <= MAX_SECONDS) break;
          console.warn(`  [retry] ${id} ${accent}: ${seconds.toFixed(1)}s, regenerating`);
        }
        if (!(seconds > 0 && seconds <= MAX_SECONDS)) {
          throw new Error(`${id} ${accent}: duration ${seconds.toFixed(1)}s outside (0, ${MAX_SECONDS}]`);
        }
        files[accent] = `/audio/${base}-${accent}.mp3`;
      }
      manifest.words[id] = files;
      writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
      done += 1;
      console.log(`  [${done}/${pending.length}] ${id}`);
    } catch (error) {
      failed += 1;
      console.error(`  [fail] ${id}: ${error.message}`);
    }
  }
  console.log(`\nDone ${done}, failed ${failed}.`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
