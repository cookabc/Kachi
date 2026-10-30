import type { Lang } from "./course";
import type { ExerciseType, MixUpType } from "./domain";

// The UI language is the course language — one definition lives in course.ts.
export type { Lang };

const LANG_KEY = "kachi-lang";

export function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "zh-CN" ? "zh-CN" : "en-US";
  } catch {
    return "en-US";
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: language resets to the default, nothing else breaks */
  }
}

function joinUnitIds(ids: number[], lang: Lang): string {
  if (ids.length <= 1) return String(ids[0] ?? "");
  if (lang === "zh-CN") {
    if (ids.length === 2) return `${ids[0]} 和 ${ids[1]}`;
    return `${ids.slice(0, -1).join("、")} 和 ${ids[ids.length - 1]}`;
  }
  if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")}, and ${ids[ids.length - 1]}`;
}

export interface UiText {
  navAria: string;
  /** Accessible name for the XP and streak cluster. */
  statsAria: (xp: number, streak: number) => string;
  nav: Record<"learn" | "practice" | "glossary" | "graph" | "settings", { label: string; aria: string }>;
  home: {
    tagline: string;
    unit: (id: number) => string;
    upNext: string;
    missedNote: (n: number) => string;
    /** Names the units that are actually open, not a fixed list. */
    unitNote: (unlocked: number[], total: number) => string;
    lockedLesson: (title: string) => string;
    labKicker: string;
    courseMark: string;
    pairKicker: (blurb: string) => string;
    progressLabel: string;
    progressAria: string;
    continueLearning: string;
    studyAgain: string;
    fieldNotes: (count: number) => string;
    pathTitle: string;
    conceptCount: (n: number) => string;
  };
  practice: {
    brand: string;
    title: string;
    missCopy: (n: number) => string;
    noMissCopy: string;
    start: (n: number) => string;
    targetsTitle: string;
    missBookTitle: string;
    missCountCopy: (n: number) => string;
    unitLabel: (n: number) => string;
    moreCount: (n: number) => string;
    listSep: string;
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
  bench: {
    ariaLabel: string;
    kicker: string;
    sliderLabel: string;
    hint: string;
    splitText: (termA: string, pctA: number, termB: string, pctB: number) => string;
  };
  graph: {
    brand: string;
    hint: string;
    stats: (terms: number, links: number) => string;
    mapAria: string;
    legendSeen: string;
    legendLearning: string;
    legendMastered: string;
    legendUnseen: string;
    masteryTitle: (streak: number) => string;
    legendMix: string;
    legendPrereq: string;
    legendSibling: string;
    relLabels: Record<"confusable" | "prereq" | "sibling", string>;
    openGlossary: string;
    weakTitle: string;
    weakExplore: string;
    weakUnlocks: (n: number) => string;
    weakItemAria: (term: string, unlocks: number) => string;
    cardMeta: (unit: string, title: string) => string;
  };
  settings: {
    brand: string;
    title: string;
    copy: string;
    exportBtn: string;
    importBtn: string;
    contentNote: string;
    colophonVersion: string;
    colophonLicense: string;
    colophonSource: string;
    langLabel: string;
    langNames: Record<Lang, string>;
    motionLabel: string;
    motionHint: (pct: number) => string;
    imported: string;
    importFailed: string;
    importInvalid: string;
    packsAria: string;
    packTerms: (n: number) => string;
    packPending: string;
  };
  lesson: {
    close: string;
    learnTag: string;
    kickers: Record<ExerciseType, string>;
    matchHint: string;
    replayAria: string;
    speakTermAria: string;
    speakExampleAria: string;
    tfLabels: { true: string; false: string };
    /** Why the pair confuses, per the pack's mixUpType taxonomy. */
    mixTypes: Record<MixUpType, string>;
    check: string;
    continue: string;
    /** Ask for a hint. Costs mastery credit, so it is always offered plainly. */
    hint: string;
    /** Shown after asking: names the confusable partner without revealing the answer. */
    hintBody: (term: string, mixUp: string) => string;
    hintCost: string;
    heartsAria: (n: number, max: number) => string;
    teachKicker: (termZh: string | null) => string;
    recapKicker: string;
    recapTitle: string;
    recapSub: string;
    recapGo: string;
    teachContinue: string;
    teachStart: string;
    practiceTitle: string;
    mixCue: (label: string | null) => string;
    mixColon: string;
    mixStop: string;
  };
  desktop: {
    edition: string;
    eyebrow: string;
    titleLead: string;
    titleBefore: string;
    titleEm: string;
    copy: string;
    hedge: string;
    pledge: string;
    hedgeMark: string;
    pledgeMark: string;
    start: string;
    footer: string;
  };
  verdicts: {
    nice: string[];
    nope: string[];
    /** For audit items only: "a pair mix-up" makes no sense when auditing a claim. */
    auditNice: string[];
    auditNope: string[];
  };
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
  share: {
    open: string;
    saveImage: string;
    saveHint: string;
    shareBtn: string;
    close: string;
    cardAlt: (termA: string, termB: string) => string;
    prevCard: string;
    nextCard: string;
    position: (index: number, total: number) => string;
    /** Shown in the sheet when the PNG export itself failed. */
    exportFailed: string;
  };
  updateBanner: string;
  loading: string;
  courseLoadFailed: string;
  retryLoad: string;
  panelLoadFailed: string;
  reloadPage: string;
  /** Shown when IndexedDB could not be read at startup. */
  storageUnavailable: string;
  /** Document shell metadata — synced onto <html> whenever the language changes. */
  doc: { title: string; description: string };
}

export const UI: Record<Lang, UiText> = {
  "zh-CN": {
    navAria: "主导航",
    statsAria: (xp, streak) => `经验值 ${xp}，连续学习 ${streak} 天`,
    nav: {
      learn: { label: "学习", aria: "学习路径" },
      practice: { label: "复习", aria: "复习练习" },
      glossary: { label: "词汇", aria: "词汇表" },
      graph: { label: "图谱", aria: "知识图谱" },
      settings: { label: "设置", aria: "设置" },
    },
    home: {
      tagline: "分清易混的财经英语。五分钟，没有投资建议。",
      unit: (id) => `单元 ${id}`,
      upNext: "接下来，",
      missedNote: (n) => `${n} 个术语需要复习。`,
      unitNote: (unlocked, total) => {
        if (unlocked.length === 0 || total === 0) return "完成前面的课程后，单元会依次开放。";
        const names =
          unlocked.length === 1 ? `单元 ${unlocked[0]}` : `单元 ${joinUnitIds(unlocked, "zh-CN")}`;
        if (unlocked.length >= total) return `${names} 已全部解锁。`;
        return `${names} 已解锁，其余单元完成前面的课程后开放。`;
      },
      lockedLesson: (title) => `${title}（未解锁）`,
      labKicker: "概念对照实验室",
      courseMark: "课程 / 01",
      pairKicker: (blurb) => `第一组：${blurb}`,
      progressLabel: "课程进度",
      progressAria: "课程进度",
      continueLearning: "继续学习",
      studyAgain: "重新学习",
      fieldNotes: (count) => `田野笔记 / 01—${String(count).padStart(2, "0")}`,
      pathTitle: "学习路径",
      conceptCount: (n) => `${n} 个概念`,
    },
    practice: {
      brand: "今日复习",
      title: "练掉混淆。",
      missCopy: (n) => `有 ${n} 个术语等着复习。复习不会解锁路径。`,
      noMissCopy: "还没有错题。先练第 1 单元。",
      start: (n) => `开始 ${n} 题复习`,
      targetsTitle: "今天轮到这些",
      missBookTitle: "最近错过",
      missCountCopy: (n) => `错过 ${n} 次`,
      unitLabel: (n) => `第 ${n} 单元`,
      moreCount: (n) => `另有 ${n} 个`,
      listSep: "、",
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
      footer: "不构成投资建议。只讲词语，不作推荐。",
    },
    bench: {
      ariaLabel: "两个易混词的对照",
      kicker: "对照台",
      sliderLabel: "拖动分隔线，比较两个词",
      hint: "拖动分隔线，或者用方向键移动。",
      splitText: (termA, pctA, termB, pctB) => `${termA} ${pctA}% / ${termB} ${pctB}%`,
    },
    graph: {
      brand: "知识图谱",
      hint: "点一个词，看它连着谁。",
      stats: (terms, links) => `${terms} 个术语，${links} 条关系`,
      mapAria: "术语关系图：每个点是术语，每条线是关系",
      legendSeen: "已学",
      legendLearning: "在练",
      legendMastered: "已掌握",
      legendUnseen: "未学",
      masteryTitle: (streak) => `已连对 ${streak} 次`,
      legendMix: "易混",
      legendPrereq: "先学",
      legendSibling: "同族",
      relLabels: { confusable: "易混", prereq: "先学", sibling: "同族" },
      openGlossary: "在词汇表中查看",
      weakTitle: "卡住你的是这些",
      weakExplore: "还没有先修关系——按课程顺序学就好",
      weakUnlocks: (n) => `会解锁 ${n} 个词`,
      weakItemAria: (term, unlocks) => (unlocks > 0 ? `${term}，会解锁 ${unlocks} 个词` : term),
      cardMeta: (unit, title) => `${unit}，${title}`,
    },
    settings: {
      brand: "设置",
      title: "数据归你。",
      copy: "学习记录只存在这台设备的浏览器里。没有账号、广告或第三方分析。可随时导出或导入。",
      exportBtn: "导出学习数据",
      importBtn: "导入学习数据",
      contentNote: "课程以 Git 内容包发布；涉及税务、法规与金融工具的条目会标注适用范围与复核状态。",
      colophonVersion: "版本",
      colophonLicense: "许可",
      colophonSource: "源码",
      langLabel: "界面与课程语言",
      langNames: { "zh-CN": "中文", "en-US": "English" },
      motionLabel: "动效强度",
      motionHint: (pct) => (pct === 0 ? "彩纸与动画已关闭。" : `彩纸密度 ${pct}%；0% 关闭彩纸与动画。`),
      imported: "学习数据已导入。",
      importFailed: "导入失败。",
      importInvalid: "这不是兼容的 Kachi 学习数据文件。",
      packsAria: "课程包",
      packTerms: (n) => `${n} 个词`,
      packPending: "准备中",
    },
    lesson: {
      close: "退出课程",
      learnTag: "学习",
      kickers: {
        meaning: "词义辨析",
        truefalse: "判断正误",
        fill: "补全句子",
        scenario: "真实情境",
        match: "配对练习",
        headline: "读真标题",
        audit: "挑出站不住的那句",
        listen: "听音辨词",
      },
      matchHint: "先点术语，再点解释。",
      replayAria: "重新朗读",
      speakTermAria: "朗读术语",
      speakExampleAria: "朗读例句",
      tfLabels: { true: "正确", false: "错误" },
      mixTypes: {
        opposite: "义反",
        coexist: "同场",
        hierarchy: "层级",
        form: "形近",
        timing: "时序",
        scope: "范围",
        direction: "方向",
      },
      check: "检查",
      continue: "继续",
      hint: "要提示吗？",
      hintBody: (term, mixUp) => `这道题考的是 ${term}，别和 ${mixUp} 混了。`,
      hintCost: "用了提示，这个词本轮不算掌握。",
      heartsAria: (n, max) => `剩余爱心 ${n}/${max}`,
      teachKicker: (termZh) => (termZh ? `新术语，${termZh}` : "新术语"),
      recapKicker: "单元回顾",
      recapTitle: "这些词又见面了。",
      recapSub: "本单元的简短练习，没有新词。",
      recapGo: "该你了",
      teachContinue: "继续",
      teachStart: "开始练习",
      practiceTitle: "今日复习",
      mixCue: (label) => (label ? `别混淆 · ${label}` : "别混淆"),
      mixColon: "：",
      mixStop: "。",
    },
    desktop: {
      edition: "财经英语实验室 / 001",
      eyebrow: "学会看清词语背后的动作",
      titleLead: "别背单词。",
      titleBefore: "学会",
      titleEm: "分辨。",
      copy: "Hedge 是保护风险，Pledge 是拿资产作抵押。一个词的差别，可能让整段财经新闻的意思反过来。",
      hedge: "对冲风险",
      pledge: "抵押资产",
      hedgeMark: "01 / HEDGE",
      pledgeMark: "02 / PLEDGE",
      start: "开始下一课",
      footer: "本地保存，无账户，无投资建议",
    },
    verdicts: {
      nice: ["不错。", "正是。", "答对了。", "漂亮。"],
      nope: ["还差一点。", "混淆了。", "又是这一对。", "岔路走反了。"],
      // The default verdicts talk about mixing up a pair, which is nonsense for
      // an audit item — there the mistake is letting a bad argument through.
      auditNice: ["抓住了。", "对，这句站不住。", "正是这句。"],
      auditNope: ["这句其实站得住。", "放过了真正的问题。", "再读一遍那句结论。"],
    },
    complete: {
      flawless: "完美。",
      done: "课程完成。",
      practiceDone: "这轮复习完成。",
      accuracy: (pct, correct, total) => `${pct}% 正确率，${correct}/${total}`,
      xpCorrect: "答对的题",
      xpLesson: "完成课程",
      xpPerfect: "全对奖励",
      xpTotal: "合计",
      mixTitle: "你容易混淆",
      nextLesson: (title) => `下一课：${title}`,
      practiceThose: "练一练这些",
      backToPath: "回到路径",
      practiceAgain: "再来一轮",
    },
    fail: {
      title: "爱心用完了。",
      copy: "这一课的混淆坑了你。重试，爱心立刻补满。",
      retryLesson: "重试本课",
      retryPractice: "再来一轮",
      backToPath: "回到路径",
    },
    share: {
      open: "保存词对卡",
      saveImage: "保存图片",
      saveHint: "如果没有自动保存，长按图片存到相册。",
      shareBtn: "分享…",
      close: "关闭",
      cardAlt: (termA, termB) => `词对卡：${termA} 和 ${termB} 的区别`,
      prevCard: "上一张",
      nextCard: "下一张",
      position: (index, total) => `${index} / ${total}`,
      exportFailed: "卡片生成失败，请关闭后重试。",
    },
    updateBanner: "新版本已准备好，完成当前学习后点击更新",
    loading: "正在准备离线学习空间…",
    courseLoadFailed: "暂时无法载入所选课程。当前课程和学习记录已保留，请联网后重试。",
    retryLoad: "重新载入",
    panelLoadFailed: "暂时无法打开此界面。请联网后刷新页面，已保存的进度会保留。",
    reloadPage: "刷新页面",
    storageUnavailable: "这台设备暂时读不到学习记录，本次进度可能无法保存。",
    doc: {
      title: "Kachi — 财经英语学习",
      description: "Kachi：面向中文用户的财经英语学习。",
    },
  },
  "en-US": {
    navAria: "Main navigation",
    statsAria: (xp, streak) => `XP ${xp}, streak ${streak}`,
    nav: {
      learn: { label: "Learn", aria: "Learning path" },
      practice: { label: "Practice", aria: "Practice rounds" },
      glossary: { label: "Glossary", aria: "Glossary" },
      graph: { label: "Map", aria: "Knowledge map" },
      settings: { label: "Settings", aria: "Settings" },
    },
    home: {
      tagline: "Tell the mix-ups apart. Five minutes. No advice.",
      unit: (id) => `Unit ${id}`,
      upNext: "Up next, ",
      missedNote: (n) => `${n} term${n === 1 ? "" : "s"} to review.`,
      unitNote: (unlocked, total) => {
        if (unlocked.length === 0 || total === 0) return "Units unlock as you finish the ones before them.";
        if (unlocked.length >= total) return "Every unit is open.";
        const rest = "The rest unlock as you finish the ones before them.";
        if (unlocked.length === 1) return `Unit ${unlocked[0]} is open. ${rest}`;
        return `Units ${joinUnitIds(unlocked, "en-US")} are open. ${rest}`;
      },
      lockedLesson: (title) => `${title} (locked)`,
      labKicker: "The contrast lab",
      courseMark: "Course / 01",
      pairKicker: (blurb) => `Pair 01 / ${blurb.toUpperCase()}`,
      progressLabel: "Your progress",
      progressAria: "Course progress",
      continueLearning: "Continue learning",
      studyAgain: "Study again",
      fieldNotes: (count) => `Field notes / 01—${String(count).padStart(2, "0")}`,
      pathTitle: "Learning path",
      conceptCount: (n) => `${n} concept${n === 1 ? "" : "s"}`,
    },
    practice: {
      brand: "Practice",
      title: "Drill the mix-up.",
      missCopy: (n) => `${n} term${n === 1 ? "" : "s"} to review. Practice never unlocks the path.`,
      noMissCopy: "No misses yet — we'll drill Unit 1.",
      start: (n) => `Start a ${n}-prompt round`,
      targetsTitle: "Up today",
      missBookTitle: "Missed recently",
      missCountCopy: (n) => `missed ${n}${n === 1 ? " time" : " times"}`,
      unitLabel: (n) => `Unit ${n}`,
      moreCount: (n) => `${n} more`,
      listSep: ", ",
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
      footer: "Not investment advice. Words, not recommendations.",
    },
    bench: {
      ariaLabel: "Two confusable words, side by side",
      kicker: "Contrast bench",
      sliderLabel: "Drag the divider to compare the two words",
      hint: "Drag the divider, or move it with the arrow keys.",
      splitText: (termA, pctA, termB, pctB) => `${termA} ${pctA}% / ${termB} ${pctB}%`,
    },
    graph: {
      brand: "The map",
      hint: "Tap a word to see what it connects to.",
      stats: (terms, links) => `${terms} terms, ${links} links`,
      mapAria: "Concept map: each dot is a term, each line a relationship",
      legendSeen: "seen",
      legendLearning: "learning",
      legendMastered: "mastered",
      legendUnseen: "new",
      masteryTitle: (streak) => `${streak} correct in a row`,
      legendMix: "mix-up",
      legendPrereq: "prereq",
      legendSibling: "family",
      relLabels: { confusable: "mix-up", prereq: "prereq", sibling: "family" },
      openGlossary: "Open in the glossary",
      weakTitle: "What's holding you up",
      weakExplore: "No prereq chain yet — just follow the course order",
      weakUnlocks: (n) => `unlocks ${n} term${n === 1 ? "" : "s"}`,
      weakItemAria: (term, unlocks) =>
        unlocks > 0 ? `${term}, unlocks ${unlocks} term${unlocks === 1 ? "" : "s"}` : term,
      cardMeta: (unit, title) => `${unit}, ${title}`,
    },
    settings: {
      brand: "Settings",
      title: "Your data stays yours.",
      copy: "Your record lives in this browser. No account, no ads, no analytics. Export or import any time.",
      exportBtn: "Export learning data",
      importBtn: "Import learning data",
      contentNote:
        "Courses ship as Git content packs; entries touching tax, regulation, and instruments carry scope and review status.",
      colophonVersion: "Version",
      colophonLicense: "License",
      colophonSource: "Source",
      langLabel: "Interface & course language",
      langNames: { "zh-CN": "中文", "en-US": "English" },
      motionLabel: "Motion",
      motionHint: (pct) =>
        pct === 0 ? "Confetti and animation are off." : `Confetti density ${pct}%; 0% turns it all off.`,
      imported: "Learning data imported.",
      importFailed: "Import failed.",
      importInvalid: "This file is not a Kachi learning record.",
      packsAria: "Course packs",
      packTerms: (n) => `${n} term${n === 1 ? "" : "s"}`,
      packPending: "In progress",
    },
    lesson: {
      close: "Close lesson",
      learnTag: "Learn",
      kickers: {
        meaning: "Meaning",
        truefalse: "True or false",
        fill: "Fill the blank",
        scenario: "Scenario",
        match: "Match the pairs",
        headline: "Read the headline",
        audit: "Find the claim that does not hold",
        listen: "Listen and choose",
      },
      matchHint: "Tap a term, then its match.",
      replayAria: "Play it again",
      speakTermAria: "Say the term",
      speakExampleAria: "Say the example",
      tfLabels: { true: "True", false: "False" },
      mixTypes: {
        opposite: "Opposites",
        coexist: "Same context",
        hierarchy: "Subset",
        form: "Look-alike",
        timing: "Timing",
        scope: "Scope",
        direction: "Direction",
      },
      check: "Check",
      continue: "Continue",
      hint: "Need a hint?",
      hintBody: (term, mixUp) => `This one is about ${term} — don't confuse it with ${mixUp}.`,
      hintCost: "A hinted answer doesn't count toward mastery.",
      heartsAria: (n, max) => `Hearts ${n}/${max}`,
      teachKicker: (_termZh) => "New word",
      recapKicker: "Unit recap",
      recapTitle: "These words again.",
      recapSub: "A short practice of this unit. No new words.",
      recapGo: "Your turn",
      teachContinue: "Continue",
      teachStart: "Let's practice",
      practiceTitle: "Practice",
      mixCue: (label) => (label ? `Don't mix up · ${label}` : "Don't mix up"),
      mixColon: ": ",
      mixStop: ". ",
    },
    desktop: {
      edition: "FINANCIAL ENGLISH LAB / 001",
      eyebrow: "SEE THE ACTION BEHIND THE WORD",
      titleLead: "Less memorizing.",
      titleBefore: "",
      titleEm: "More meaning.",
      copy: "Hedge protects against risk. Pledge puts an asset up as collateral. One word can change the meaning of a financial story.",
      hedge: "Protect",
      pledge: "Collateral",
      hedgeMark: "01 / HEDGE",
      pledgeMark: "02 / PLEDGE",
      start: "Start the next lesson",
      footer: "LOCAL FIRST, NO ACCOUNT, NO INVESTMENT ADVICE",
    },
    verdicts: {
      nice: ["Nice.", "Exactly.", "You got it.", "Clean."],
      nope: ["Not quite.", "Mix-up.", "That pair again.", "Close, wrong fork."],
      auditNice: ["Caught it.", "Yes — that one does not hold.", "That is the sentence."],
      auditNope: [
        "That one actually holds.",
        "You let the real problem through.",
        "Read that conclusion again.",
      ],
    },
    complete: {
      flawless: "Flawless.",
      done: "Lesson done.",
      practiceDone: "Practice done.",
      accuracy: (pct, correct, total) => `${pct}% accuracy, ${correct}/${total}`,
      xpCorrect: "Correct answers",
      xpLesson: "Lesson complete",
      xpPerfect: "No-mistake bonus",
      xpTotal: "Total",
      mixTitle: "You mix these up",
      nextLesson: (title) => `Next: ${title}`,
      practiceThose: "Practice those",
      backToPath: "Back to the path",
      practiceAgain: "Practice again",
    },
    fail: {
      title: "Out of hearts.",
      copy: "That mix-up got you. Retry — hearts refill now.",
      retryLesson: "Retry lesson",
      retryPractice: "Retry practice",
      backToPath: "Back to the path",
    },
    share: {
      open: "Save pair card",
      saveImage: "Save image",
      saveHint: "If nothing downloads, long-press the image to save it.",
      shareBtn: "Share…",
      close: "Close",
      cardAlt: (termA, termB) => `Pair card: ${termA} vs ${termB}`,
      prevCard: "Previous card",
      nextCard: "Next card",
      position: (index, total) => `${index} of ${total}`,
      exportFailed: "Couldn't build the card — close this and try again.",
    },
    updateBanner: "A new version is ready — update after this session",
    loading: "Preparing your offline study space…",
    courseLoadFailed:
      "The selected course could not load. Your current course and progress are kept. Reconnect and try again.",
    retryLoad: "Try again",
    panelLoadFailed: "This view could not load. Reconnect and reload the page. Saved progress is kept.",
    reloadPage: "Reload page",
    storageUnavailable: "This device can't read saved progress right now. This visit may not be saved.",
    doc: {
      title: "Kachi — Finance English, without the mix-ups",
      description: "Tell confusable finance-English terms apart. Five minutes a day, no investment advice.",
    },
  },
};
