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

/**
 * The seven mix-up types, in words a twelve-year-old can use. The schema keeps
 * the precise names (opposite, coexist, …); learners see these.
 */
export interface MixTypeCopy {
  name: string;
  /** One line: what makes this kind of pair slippery. */
  tip: string;
}

export interface UiText {
  navAria: string;
  nav: Record<"learn" | "pairs" | "me", string>;
  /** Accessible name for the streak / pair-count cluster. */
  statsAria: (streak: number, pairs: number, total: number) => string;
  home: {
    upNext: string;
    playAgain: string;
    canYou: string;
    play: string;
    review: (n: number) => string;
    reviewCopy: string;
    reviewGo: string;
    unit: (id: number) => string;
    unitProgress: (done: number, total: number) => string;
    bossRound: string;
    start: string;
    locked: (title: string) => string;
    done: (title: string) => string;
    levelOf: (level: number) => string;
    nextLevel: (title: string) => string;
    allDone: string;
    disclaimer: string;
    welcomeTitle: string;
    welcomeCopy: string;
    welcomeOk: string;
  };
  levels: {
    title: string;
    copy: string;
    current: string;
    words: (n: number) => string;
    known: (n: number) => string;
    loading: string;
  };
  pairs: {
    title: string;
    copy: string;
    all: string;
    hidden: string;
    lockedHint: string;
    count: (met: number, total: number) => string;
    strength: [string, string, string, string];
    share: string;
    practice: string;
    due: string;
  };
  me: {
    title: string;
    streak: string;
    pairs: string;
    xp: string;
    lessons: string;
    weak: string;
    weakEmpty: string;
    practiceWeak: string;
    lang: string;
    langNames: Record<Lang, string>;
    motion: string;
    motionHint: (pct: number) => string;
    data: string;
    dataCopy: string;
    exportBtn: string;
    importBtn: string;
    imported: string;
    importFailed: string;
    importInvalid: string;
    about: string;
    aboutCopy: string;
    version: string;
    license: string;
    source: string;
  };
  mixTypes: Record<MixUpType, MixTypeCopy>;
  lesson: {
    close: string;
    closeConfirm: string;
    stay: string;
    newPair: string;
    recap: string;
    recapTitle: string;
    trick: string;
    inContext: string;
    gotIt: string;
    letsGo: string;
    speakAria: (term: string) => string;
    speakExampleAria: string;
    kinds: Record<ExerciseType, string>;
    tf: { means: string; true: string; false: string };
    pickWord: string;
    headlineAsk: string;
    matchAsk: string;
    listenAsk: string;
    replayAria: string;
    check: string;
    hint: string;
    hintBody: (term: string, twin: string) => string;
    hintCost: string;
    combo: (n: number) => string;
    progressAria: (done: number, total: number) => string;
    keys: string;
    practiceTitle: string;
  };
  feedback: {
    nice: string[];
    nope: string;
    auditNice: string[];
    auditNope: string;
    answer: string;
    again: string;
    continue: string;
  };
  complete: {
    flawless: string;
    great: string;
    done: string;
    practiceDone: string;
    firstTry: string;
    combo: string;
    xp: string;
    pairsTitle: string;
    watch: string;
    next: string;
    home: string;
    again: string;
    share: string;
    practiceThose: string;
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
    exportFailed: string;
    kicker: (level: number, unit: string) => string;
  };
  updateBanner: string;
  loading: string;
  courseLoadFailed: string;
  retryLoad: string;
  panelLoadFailed: string;
  reloadPage: string;
  storageUnavailable: string;
  doc: { title: string; description: string };
}

export const UI: Record<Lang, UiText> = {
  "zh-CN": {
    navAria: "主导航",
    nav: { learn: "学习", pairs: "词对", me: "我的" },
    statsAria: (streak, pairs, total) => `连续学习 ${streak} 天，已认识 ${pairs}/${total} 组词对`,
    home: {
      upNext: "下一组",
      playAgain: "再玩一次",
      canYou: "你分得清吗？",
      play: "开始",
      review: (n) => `${n} 组词对该复习了`,
      reviewCopy: "隔几天再见一次，才记得牢。",
      reviewGo: "复习",
      unit: (id) => `第 ${id} 单元`,
      unitProgress: (done, total) => `${done}/${total}`,
      bossRound: "单元挑战",
      start: "开始",
      locked: (title) => `${title}（未解锁）`,
      done: (title) => `${title}（已完成）`,
      levelOf: (level) => `第 ${level} 级`,
      nextLevel: (title) => `全部通关！下一级：${title}`,
      allDone: "这一级通关了，去复习巩固一下吧。",
      disclaimer: "只讲词语，不构成投资建议。",
      welcomeTitle: "每个词都有个双胞胎",
      welcomeCopy: "财经新闻里错一个词，整条消息就读反了。所以 Kachi 一次教一对。",
      welcomeOk: "明白了",
    },
    levels: {
      title: "六个等级",
      copy: "每升一级，你就能自己读懂一种新的财经材料。",
      current: "正在学",
      words: (n) => `${n} 个词`,
      known: (n) => `已认识 ${n} 个`,
      loading: "正在打开…",
    },
    pairs: {
      title: "我的词对",
      copy: "每个词都有一个容易搞混的「双胞胎」。学过的会在这里点亮。",
      all: "全部",
      hidden: "?",
      lockedHint: "学到这一课就会解锁这组词对。",
      count: (met, total) => `${met}/${total}`,
      strength: ["新认识", "有点熟", "很熟了", "牢牢记住"],
      share: "做成卡片",
      practice: "练这一组",
      due: "该复习",
    },
    me: {
      title: "我的",
      streak: "连续天数",
      pairs: "认识的词对",
      xp: "经验值",
      lessons: "完成课程",
      weak: "最容易搞混",
      weakEmpty: "还没有错过的词对，继续保持。",
      practiceWeak: "专门练这些",
      lang: "语言",
      langNames: { "zh-CN": "中文", "en-US": "English" },
      motion: "动效与音效",
      motionHint: (pct) =>
        pct === 0 ? "动画、彩纸、音效和振动都已关闭。" : `强度 ${pct}%：动画、彩纸、答题音效和振动`,
      data: "学习数据",
      dataCopy: "记录只存在这台设备上。没有账号、广告或追踪。",
      exportBtn: "导出",
      importBtn: "导入",
      imported: "学习数据已导入。",
      importFailed: "导入失败。",
      importInvalid: "这不是兼容的 Kachi 学习数据文件。",
      about: "关于 Kachi",
      aboutCopy: "每个词都在真实财经新闻里出现过，才会被收进课程。",
      version: "版本",
      license: "许可",
      source: "源码",
    },
    mixTypes: {
      opposite: { name: "反义词", tip: "放在句子同一个位置，意思却正好相反。" },
      direction: { name: "往哪走", tip: "一个往上，一个往下。" },
      timing: { name: "哪个时候", tip: "同一件事，发生在不同的时间点。" },
      scope: { name: "整体与部分", tip: "一个是总数，一个是比例或一部分。" },
      hierarchy: { name: "一家人", tip: "一个是另一个的一种。" },
      form: { name: "长得像", tip: "拼写很像，意思不同。" },
      coexist: { name: "总在一起", tip: "常常出现在同一句话里，最容易换错。" },
    },
    lesson: {
      close: "退出",
      closeConfirm: "现在退出，这一课的进度不会保存。确定吗？",
      stay: "继续上课",
      newPair: "新词对",
      recap: "单元挑战",
      recapTitle: "这些词对又见面了",
      trick: "窍门",
      inContext: "在新闻里",
      gotIt: "懂了！",
      letsGo: "来吧",
      speakAria: (term) => `朗读 ${term}`,
      speakExampleAria: "朗读例句",
      kinds: {
        meaning: "选意思",
        truefalse: "对还是错",
        fill: "填空",
        scenario: "是哪个词",
        match: "连一连",
        headline: "读新闻",
        audit: "挑毛病",
        listen: "听一听",
      },
      tf: { means: "的意思是……", true: "对", false: "错" },
      pickWord: "选出合适的词",
      headlineAsk: "哪个词让这条新闻说得通？",
      matchAsk: "先点一个词，再点它的意思。",
      listenAsk: "你听到的是哪个词？",
      replayAria: "再听一次",
      check: "检查",
      hint: "提示",
      hintBody: (term, twin) => `这道题考的是 ${term}，小心别和 ${twin} 搞混。`,
      hintCost: "用了提示，这题本轮不计入掌握度。",
      combo: (n) => `${n} 连对`,
      progressAria: (done, total) => `已完成 ${done}/${total}`,
      keys: "按 1–4 选择，Enter 确认",
      practiceTitle: "复习",
    },
    feedback: {
      nice: ["答对了！", "真棒！", "眼力不错！", "就是它！"],
      nope: "差一点！",
      auditNice: ["抓到了！", "就是这句站不住。"],
      auditNope: "这句其实站得住。",
      answer: "答案：",
      again: "懂了，待会儿再考我",
      continue: "继续",
    },
    complete: {
      flawless: "满分！",
      great: "太棒了！",
      done: "完成！",
      practiceDone: "复习完成！",
      firstTry: "一次答对",
      combo: "最高连对",
      xp: "经验值",
      pairsTitle: "你能分清这些了",
      watch: "多留意这几组",
      next: "下一课",
      home: "回到首页",
      again: "再来一轮",
      share: "做成卡片",
      practiceThose: "练练这几组",
    },
    share: {
      open: "词对卡片",
      saveImage: "保存图片",
      saveHint: "如果没有自动保存，长按图片存到相册。",
      shareBtn: "分享…",
      close: "关闭",
      cardAlt: (termA, termB) => `词对卡：${termA} 和 ${termB} 的区别`,
      prevCard: "上一张",
      nextCard: "下一张",
      position: (index, total) => `${index} / ${total}`,
      exportFailed: "卡片生成失败，请关闭后重试。",
      kicker: (level, unit) => `KACHI · 第 ${level} 级 · ${unit}`,
    },
    updateBanner: "新版本准备好了，点这里更新",
    loading: "正在准备…",
    courseLoadFailed: "暂时打不开这一级。当前课程和进度都还在，联网后再试。",
    retryLoad: "重试",
    panelLoadFailed: "暂时打不开这个页面。联网后刷新，进度不会丢。",
    reloadPage: "刷新页面",
    storageUnavailable: "这台设备暂时读不到学习记录，这次的进度可能存不下来。",
    doc: {
      title: "Kachi — 分清财经英语里的双胞胎词",
      description: "一次学一对容易搞混的财经英语词。每天五分钟，离线可用，无需账号。",
    },
  },
  "en-US": {
    navAria: "Main navigation",
    nav: { learn: "Learn", pairs: "Pairs", me: "Me" },
    statsAria: (streak, pairs, total) => `${streak}-day streak, ${pairs} of ${total} pairs met`,
    home: {
      upNext: "Up next",
      playAgain: "Play again",
      canYou: "Can you tell them apart?",
      play: "Let’s play",
      review: (n) => (n === 1 ? "1 pair is ready for review" : `${n} pairs are ready for review`),
      reviewCopy: "Seeing them again a few days later is what makes them stick.",
      reviewGo: "Review",
      unit: (id) => `Unit ${id}`,
      unitProgress: (done, total) => `${done}/${total}`,
      bossRound: "Boss round",
      start: "Start",
      locked: (title) => `${title} (locked)`,
      done: (title) => `${title} (done)`,
      levelOf: (level) => `Level ${level}`,
      nextLevel: (title) => `Level cleared! Next: ${title}`,
      allDone: "You cleared this level. Keep the pairs fresh with a review.",
      disclaimer: "Words only. Not investment advice.",
      welcomeTitle: "Every word has a twin",
      welcomeCopy: "In finance news, one wrong word flips the whole story. So Kachi teaches words in pairs.",
      welcomeOk: "Got it",
    },
    levels: {
      title: "Six levels",
      copy: "Each level unlocks a new kind of finance writing you can read on your own.",
      current: "Current",
      words: (n) => `${n} words`,
      known: (n) => `${n} known`,
      loading: "Opening…",
    },
    pairs: {
      title: "Your pairs",
      copy: "Every word here has a twin that trips people up. The ones you’ve met light up.",
      all: "All",
      hidden: "?",
      lockedHint: "Reach the lesson with this pair to unlock it.",
      count: (met, total) => `${met}/${total}`,
      strength: ["Just met", "Getting there", "Solid", "Locked in"],
      share: "Make a card",
      practice: "Practice this pair",
      due: "Review",
    },
    me: {
      title: "Me",
      streak: "Day streak",
      pairs: "Pairs met",
      xp: "XP",
      lessons: "Lessons",
      weak: "Easiest to mix up",
      weakEmpty: "No slip-ups yet. Keep it going.",
      practiceWeak: "Practice these",
      lang: "Language",
      langNames: { "zh-CN": "中文", "en-US": "English" },
      motion: "Effects",
      motionHint: (pct) =>
        pct === 0
          ? "Animations, confetti, sounds and vibration are off."
          : `${pct}%: animations, confetti, answer sounds and vibration`,
      data: "Your data",
      dataCopy: "Progress lives on this device only. No account, ads or tracking.",
      exportBtn: "Export",
      importBtn: "Import",
      imported: "Learning data imported.",
      importFailed: "Import failed.",
      importInvalid: "This file is not a Kachi learning record.",
      about: "About Kachi",
      aboutCopy: "A word only joins the course after it was found in real finance news.",
      version: "Version",
      license: "License",
      source: "Source",
    },
    mixTypes: {
      opposite: { name: "Opposites", tip: "Same spot in a sentence, flipped meaning." },
      direction: { name: "Which way?", tip: "One goes up, one goes down." },
      timing: { name: "Which moment?", tip: "The same thing, at a different time." },
      scope: { name: "Whole vs. slice", tip: "One is the total, one is a share of it." },
      hierarchy: { name: "Family", tip: "One is a kind of the other." },
      form: { name: "Look-alikes", tip: "Spelled alike, mean different things." },
      coexist: { name: "Sentence buddies", tip: "Always in the same sentence, so easy to swap." },
    },
    lesson: {
      close: "Quit lesson",
      closeConfirm: "Leave now? Progress in this lesson won’t be saved.",
      stay: "Keep going",
      newPair: "New pair",
      recap: "Boss round",
      recapTitle: "These pairs are back",
      trick: "The trick",
      inContext: "In the news",
      gotIt: "Got it!",
      letsGo: "Let’s go",
      speakAria: (term) => `Hear ${term}`,
      speakExampleAria: "Hear the example",
      kinds: {
        meaning: "What does it mean?",
        truefalse: "True or false?",
        fill: "Fill the gap",
        scenario: "Which word?",
        match: "Match them up",
        headline: "Read the news",
        audit: "Spot the flaw",
        listen: "Listen closely",
      },
      tf: { means: "means…", true: "True", false: "False" },
      pickWord: "Pick the word that fits.",
      headlineAsk: "Which word makes this headline true?",
      matchAsk: "Tap a word, then what it means.",
      listenAsk: "Which word did you hear?",
      replayAria: "Play it again",
      check: "Check",
      hint: "Hint",
      hintBody: (term, twin) => `This one is about ${term}. Don’t mix it up with ${twin}.`,
      hintCost: "With a hint, this answer won’t count toward mastery.",
      combo: (n) => `${n} in a row`,
      progressAria: (done, total) => `${done} of ${total} done`,
      keys: "Keys 1–4 to choose, Enter to check",
      practiceTitle: "Review",
    },
    feedback: {
      nice: ["Nailed it!", "You got it!", "Sharp eyes!", "Exactly!"],
      nope: "Not quite!",
      auditNice: ["Caught it!", "That’s the one that doesn’t hold."],
      auditNope: "That one actually holds up.",
      answer: "Answer:",
      again: "Got it — ask me again later",
      continue: "Continue",
    },
    complete: {
      flawless: "Flawless!",
      great: "Brilliant!",
      done: "Lesson done!",
      practiceDone: "Review done!",
      firstTry: "First try",
      combo: "Best combo",
      xp: "XP",
      pairsTitle: "Pairs you can tell apart",
      watch: "Keep an eye on",
      next: "Next lesson",
      home: "Home",
      again: "Another round",
      share: "Make a card",
      practiceThose: "Practice these",
    },
    share: {
      open: "Pair cards",
      saveImage: "Save image",
      saveHint: "If it doesn’t save, long-press the image.",
      shareBtn: "Share…",
      close: "Close",
      cardAlt: (termA, termB) => `Pair card: ${termA} vs ${termB}`,
      prevCard: "Previous card",
      nextCard: "Next card",
      position: (index, total) => `${index} / ${total}`,
      exportFailed: "Couldn’t render the card. Close and try again.",
      kicker: (level, unit) => `KACHI · LEVEL ${level} · ${unit.toUpperCase()}`,
    },
    updateBanner: "A new version is ready. Tap to update.",
    loading: "Getting ready…",
    courseLoadFailed:
      "Couldn’t open that level. Your current course and progress are kept — try again online.",
    retryLoad: "Try again",
    panelLoadFailed: "This view couldn’t load. Reload online — your progress is safe.",
    reloadPage: "Reload page",
    storageUnavailable: "Can’t read saved progress on this device. This session may not be saved.",
    doc: {
      title: "Kachi — Tell finance English twins apart",
      description:
        "Learn confusable finance-English words in pairs. Five minutes a day, offline, no account.",
    },
  },
};
