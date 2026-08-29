import type { ExerciseType } from "@kachi/domain";

export type Lang = "zh-CN" | "en-US";

const LANG_KEY = "kachi-lang";

export function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "en-US" ? "en-US" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: language resets to the default, nothing else breaks */
  }
}

export interface UiText {
  navAria: string;
  nav: Record<"learn" | "practice" | "glossary" | "settings", { label: string; aria: string }>;
  home: {
    tagline: string;
    unit: (id: number) => string;
    upNext: string;
    missedNote: (n: number) => string;
    unitNote: string;
  };
  practice: {
    brand: string;
    title: string;
    missCopy: (n: number) => string;
    noMissCopy: string;
    start: (n: number) => string;
  };
  glossary: {
    brand: string;
    placeholder: string;
    searchAria: string;
    seenTitle: string;
    forExample: string;
    mix: string;
    empty: (q: string) => string;
    emptyHint: string;
    footer: string;
  };
  settings: {
    brand: string;
    title: string;
    copy: string;
    exportBtn: string;
    importBtn: string;
    contentNote: string;
    langLabel: string;
    langNames: Record<Lang, string>;
    imported: string;
    importFailed: string;
  };
  lesson: {
    close: string;
    learnTag: string;
    kickers: Record<ExerciseType, string>;
    matchHint: string;
    check: string;
    continue: string;
    heartsAria: (n: number, max: number) => string;
    teachKicker: (termZh: string | null) => string;
    recapKicker: string;
    recapTitle: string;
    recapSub: string;
    recapGo: string;
    teachContinue: string;
    teachStart: string;
    practiceTitle: string;
  };
  verdicts: { nice: string[]; nope: string[] };
  complete: {
    flawless: string;
    done: string;
    practiceDone: string;
    accuracy: (pct: number, correct: number, total: number) => string;
    xpCorrect: string;
    xpLesson: string;
    xpPerfect: string;
    xpTotal: string;
    mixTitle: string;
    nextLesson: (title: string) => string;
    practiceThose: string;
    backToPath: string;
    practiceAgain: string;
  };
  fail: {
    title: string;
    copy: string;
    retryLesson: string;
    retryPractice: string;
    backToPath: string;
  };
  updateBanner: string;
  loading: string;
}

export const UI: Record<Lang, UiText> = {
  "zh-CN": {
    navAria: "主导航",
    nav: {
      learn: { label: "学习", aria: "学习路径" },
      practice: { label: "复习", aria: "复习练习" },
      glossary: { label: "词汇", aria: "词汇表" },
      settings: { label: "设置", aria: "设置" }
    },
    home: {
      tagline: "分清易混的财经英语。五分钟，没有投资建议。",
      unit: (id) => `单元 ${id}`,
      upNext: "接下来 · ",
      missedNote: (n) => `有 ${n} 个术语等着复习——它们在「复习」页。`,
      unitNote: "第 1–2 单元是正在进行的对话；3–5 单元在路径上等你。"
    },
    practice: {
      brand: "今日复习",
      title: "练掉混淆。",
      missCopy: (n) => `有 ${n} 个术语等着复习。复习不会解锁路径。`,
      noMissCopy: "还没有错题。先练第 1 单元。",
      start: (n) => `开始 ${n} 题复习`
    },
    glossary: {
      brand: "词汇表",
      placeholder: "搜索术语，如 hedge、put",
      searchAria: "搜索术语",
      seenTitle: "已在课程中见过",
      forExample: "例如：",
      mix: "混淆：",
      empty: (q) => `没有匹配「${q}」的术语。`,
      emptyHint: "试试 hedge、put、swap、margin call。",
      footer: "不构成投资建议。只讲词语，不作推荐。"
    },
    settings: {
      brand: "设置",
      title: "数据归你。",
      copy: "学习记录只存在这台设备的浏览器里。没有账号、广告或第三方分析。可随时导出或导入。",
      exportBtn: "导出学习数据",
      importBtn: "导入学习数据",
      contentNote: "课程以 Git 内容包发布；涉及税务、法规与金融工具的条目会标注适用范围与复核状态。",
      langLabel: "界面与课程语言",
      langNames: { "zh-CN": "中文", "en-US": "English" },
      imported: "学习数据已导入。",
      importFailed: "导入失败。"
    },
    lesson: {
      close: "退出课程",
      learnTag: "学习",
      kickers: { meaning: "词义辨析", truefalse: "判断正误", fill: "补全句子", scenario: "真实情境", match: "配对练习" },
      matchHint: "先点术语，再点解释。",
      check: "检查",
      continue: "继续",
      heartsAria: (n, max) => `剩余爱心 ${n}/${max}`,
      teachKicker: (termZh) => (termZh ? `新术语 · ${termZh}` : "新术语"),
      recapKicker: "单元回顾",
      recapTitle: "这些词又见面了。",
      recapSub: "本单元的简短练习，没有新词。",
      recapGo: "该你了",
      teachContinue: "继续",
      teachStart: "开始练习",
      practiceTitle: "今日复习"
    },
    verdicts: {
      nice: ["不错。", "正是。", "答对了。", "漂亮。"],
      nope: ["还差一点。", "混淆了。", "又是这一对。", "岔路走反了。"]
    },
    complete: {
      flawless: "完美。",
      done: "课程完成。",
      practiceDone: "这轮复习完成。",
      accuracy: (pct, correct, total) => `${pct}% 正确率 · ${correct}/${total}`,
      xpCorrect: "答对的题",
      xpLesson: "完成课程",
      xpPerfect: "全对奖励",
      xpTotal: "合计",
      mixTitle: "你容易混淆",
      nextLesson: (title) => `下一课：${title}`,
      practiceThose: "练一练这些",
      backToPath: "回到路径",
      practiceAgain: "再来一轮"
    },
    fail: {
      title: "爱心用完了。",
      copy: "这一课的混淆坑了你。重试，爱心立刻补满。",
      retryLesson: "重试本课",
      retryPractice: "再来一轮",
      backToPath: "回到路径"
    },
    updateBanner: "新版本已准备好，完成当前学习后点击更新",
    loading: "正在准备离线学习空间…"
  },
  "en-US": {
    navAria: "Main navigation",
    nav: {
      learn: { label: "Learn", aria: "Learning path" },
      practice: { label: "Practice", aria: "Practice rounds" },
      glossary: { label: "Glossary", aria: "Glossary" },
      settings: { label: "Settings", aria: "Settings" }
    },
    home: {
      tagline: "Tell the mix-ups apart. Five minutes. No advice.",
      unit: (id) => `Unit ${id}`,
      upNext: "Up next · ",
      missedNote: (n) => `${n} term${n === 1 ? "" : "s"} waiting to be reviewed — they live in Practice.`,
      unitNote: "Units 1–2 are the conversation. 3–5 wait on the path."
    },
    practice: {
      brand: "Practice",
      title: "Drill the mix-up.",
      missCopy: (n) => `${n} term${n === 1 ? "" : "s"} to review. Practice never unlocks the path.`,
      noMissCopy: "No misses yet — we'll drill Unit 1.",
      start: (n) => `Start a ${n}-prompt round`
    },
    glossary: {
      brand: "Glossary",
      placeholder: "Search terms, e.g. hedge, put",
      searchAria: "Search terms",
      seenTitle: "Seen in a lesson",
      forExample: "e.g. ",
      mix: "Mix-up: ",
      empty: (q) => `No terms match "${q}".`,
      emptyHint: "Try hedge, put, swap, margin call.",
      footer: "Not investment advice. Words, not recommendations."
    },
    settings: {
      brand: "Settings",
      title: "Your data stays yours.",
      copy: "Your record lives in this browser. No account, no ads, no analytics. Export or import any time.",
      exportBtn: "Export learning data",
      importBtn: "Import learning data",
      contentNote: "Courses ship as Git content packs; entries touching tax, regulation, and instruments carry scope and review status.",
      langLabel: "Interface & course language",
      langNames: { "zh-CN": "中文", "en-US": "English" },
      imported: "Learning data imported.",
      importFailed: "Import failed."
    },
    lesson: {
      close: "Close lesson",
      learnTag: "Learn",
      kickers: { meaning: "Meaning", truefalse: "True or false", fill: "Fill the blank", scenario: "Scenario", match: "Match the pairs" },
      matchHint: "Tap a term, then its match.",
      check: "Check",
      continue: "Continue",
      heartsAria: (n, max) => `Hearts ${n}/${max}`,
      teachKicker: (termZh) => "New word",
      recapKicker: "Unit recap",
      recapTitle: "These words again.",
      recapSub: "A short practice of this unit. No new words.",
      recapGo: "Your turn",
      teachContinue: "Continue",
      teachStart: "Let's practice",
      practiceTitle: "Practice"
    },
    verdicts: {
      nice: ["Nice.", "Exactly.", "You got it.", "Clean."],
      nope: ["Not quite.", "Mix-up.", "That pair again.", "Close, wrong fork."]
    },
    complete: {
      flawless: "Flawless.",
      done: "Lesson done.",
      practiceDone: "Practice done.",
      accuracy: (pct, correct, total) => `${pct}% accuracy · ${correct}/${total}`,
      xpCorrect: "Correct answers",
      xpLesson: "Lesson complete",
      xpPerfect: "No-mistake bonus",
      xpTotal: "Total",
      mixTitle: "You mix these up",
      nextLesson: (title) => `Next: ${title}`,
      practiceThose: "Practice those",
      backToPath: "Back to the path",
      practiceAgain: "Practice again"
    },
    fail: {
      title: "Out of hearts.",
      copy: "That mix-up got you. Retry — hearts refill now.",
      retryLesson: "Retry lesson",
      retryPractice: "Retry practice",
      backToPath: "Back to the path"
    },
    updateBanner: "A new version is ready — update after this session",
    loading: "Preparing your offline study space…"
  }
};
