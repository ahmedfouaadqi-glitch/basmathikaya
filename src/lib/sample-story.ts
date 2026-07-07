// Free preview sample. NO AI calls — pure client-side template substitution
// so the user can see the exact layout/style of their future story without
// spending any tokens or generation credits.

export type SamplePage = {
  number: number;
  text: string;
  // A CSS gradient + emoji placeholder used instead of a real image to keep
  // the preview 100% free (no image tokens, no network image fetch).
  gradient: string;
  emoji: string;
};

export type SampleStory = {
  title: string;
  cover: { gradient: string; emoji: string };
  intro: string;
  pages: SamplePage[];
  reflectiveQuestion: string;
};

type Lang = "ar" | "en" | "ku";

const SAMPLES: Record<Lang, SampleStory> = {
  ar: {
    title: "مغامرة {{hero}} في وادي {{mood}}",
    cover: { gradient: "linear-gradient(135deg,#169CA3,#D4A537)", emoji: "🌟" },
    intro: "هذه معاينة نموذجية لتصميم القصة فقط — قصتك الحقيقية ستُكتب وتُرسم خصيصاً لك بعد تأكيد الدفع.",
    pages: [
      { number: 1, gradient: "linear-gradient(135deg,#FFB86B,#FF6B9D)", emoji: "🌅",
        text: "استيقظ {{hero}} في صباحٍ ذهبي، والشمسُ ترسمُ خيوطاً دافئةً على وسادته. تمطّى بلطفٍ وقال: «اليوم سأخوضُ مغامرةً لم يخوضها أحدٌ من قبل!» ارتدى معطفه المفضل، ووضعَ في جيبه بوصلةً قديمةً ورثها عن جدّه." },
      { number: 2, gradient: "linear-gradient(135deg,#7DD3FC,#818CF8)", emoji: "🗺️",
        text: "خرجَ {{hero}} إلى الحديقة، فوجدَ خريطةً غامضةً معلّقةً على شجرةِ التوت. رسمتِ الخريطةُ طريقاً نحوَ وادٍ ساحرٍ اسمهُ «وادي {{mood}}»، حيثُ تعيشُ مخلوقاتٌ لطيفةٌ لا يراها إلا مَنْ يحملُ قلباً شجاعاً." },
      { number: 3, gradient: "linear-gradient(135deg,#A7F3D0,#34D399)", emoji: "🦋",
        text: "سارَ {{hero}} بينَ الأشجارِ العالية، فاستقبلتهُ فراشاتٌ ملوّنةٌ ترقصُ في الهواء. همسَتْ إحداهنَّ في أذنه: «تابع طريقك، فالمغامرةُ الحقيقيةُ تبدأُ حينَ تصدّقُ نفسَك». ابتسمَ {{hero}} وشعرَ بدفءٍ يملأُ صدره." },
      { number: 4, gradient: "linear-gradient(135deg,#FCA5A5,#F87171)", emoji: "🌋",
        text: "وصلَ {{hero}} إلى جسرٍ خشبيٍّ متأرجحٍ فوقَ نهرٍ متلألئ. ترددَ لحظةً، ثم تذكّرَ كلماتِ الفراشة، فخطى بثقةٍ خطوةً بعدَ خطوة. عبرَ الجسرَ، وفي الضفةِ الأخرى انتظرهُ شيءٌ رائع." },
      { number: 5, gradient: "linear-gradient(135deg,#FDE68A,#FB923C)", emoji: "🏆",
        text: "في نهايةِ الطريق، وجدَ {{hero}} صندوقاً صغيراً من الضوء. فتحهُ بلطف، فخرجَتْ منهُ كلمةٌ واحدةٌ فقط: «الشجاعة». عادَ {{hero}} إلى بيتهِ وهو يحملُ في قلبهِ كنزاً أثمنَ من الذهب: أنهُ يستطيعُ أن يفعلَ أيَّ شيءٍ يؤمنُ به." },
    ],
    reflectiveQuestion: "يا {{hero}}، ما هي المغامرةُ الصغيرةُ التي تودُّ خوضها غداً بشجاعة؟",
  },
  en: {
    title: "{{hero}}'s Adventure in the Valley of {{mood}}",
    cover: { gradient: "linear-gradient(135deg,#169CA3,#D4A537)", emoji: "🌟" },
    intro: "This is a sample layout preview only — your real story will be written and illustrated just for you after payment.",
    pages: [
      { number: 1, gradient: "linear-gradient(135deg,#FFB86B,#FF6B9D)", emoji: "🌅",
        text: "{{hero}} woke up to a golden morning, the sun painting warm stripes across the pillow. Stretching gently, they whispered, \"Today I'll begin an adventure no one has ever taken!\" They pulled on a favorite coat and tucked grandpa's old compass into a pocket." },
      { number: 2, gradient: "linear-gradient(135deg,#7DD3FC,#818CF8)", emoji: "🗺️",
        text: "In the garden, {{hero}} found a mysterious map pinned to the mulberry tree. It traced a path to a hidden place called the Valley of {{mood}}, where kind creatures live — visible only to hearts that dare to believe." },
      { number: 3, gradient: "linear-gradient(135deg,#A7F3D0,#34D399)", emoji: "🦋",
        text: "Walking between tall trees, {{hero}} was greeted by colorful butterflies dancing in the air. One whispered, \"Keep going — the real adventure begins the moment you trust yourself.\" A warm feeling filled {{hero}}'s chest." },
      { number: 4, gradient: "linear-gradient(135deg,#FCA5A5,#F87171)", emoji: "🌋",
        text: "{{hero}} reached a wooden bridge swaying over a sparkling river. A pause — then, remembering the butterfly's words, one confident step after another. Across the bridge, something wonderful was waiting." },
      { number: 5, gradient: "linear-gradient(135deg,#FDE68A,#FB923C)", emoji: "🏆",
        text: "At the end of the path, {{hero}} found a small box of light. Opening it, out floated a single word: \"Courage.\" {{hero}} came home carrying a treasure worth more than gold — the knowing that they can do anything they believe in." },
    ],
    reflectiveQuestion: "{{hero}}, what small adventure would you love to try bravely tomorrow?",
  },
  ku: {
    title: "سەرکێشیی {{hero}} لە دۆڵی {{mood}}",
    cover: { gradient: "linear-gradient(135deg,#169CA3,#D4A537)", emoji: "🌟" },
    intro: "ئەمە تەنها پێشبینینێکی نموونەییە بۆ شێوازی چیرۆکەکە — چیرۆکە ڕاستەقینەکەت پاش پارەدان تایبەت بۆ تۆ دەنووسرێت و وێنە دەکێشرێت.",
    pages: [
      { number: 1, gradient: "linear-gradient(135deg,#FFB86B,#FF6B9D)", emoji: "🌅",
        text: "{{hero}} لە بەیانییەکی زێڕینەوە بەخەبەر هات، خۆر هێڵە گەرمەکانی لەسەر سەربالشەکەی دەکێشا. بە نەرمی خۆی درێژ کرد و ووتی: «ئەمڕۆ سەرکێشییەک دەکەم کە کەس نەیکردبێ!» چاکەتە دڵخوازەکەی لەبەرکرد و پەرگاری کۆنی باپیری خستە گیرفانی." },
      { number: 2, gradient: "linear-gradient(135deg,#7DD3FC,#818CF8)", emoji: "🗺️",
        text: "{{hero}} چووە باخچەکە و نەخشەیەکی نهێنی بینی کە بە دار توویەوە هەڵواسرابوو. نەخشەکە ڕێگای پیشان دەدا بۆ دۆڵێکی جادوویی بەناوی «دۆڵی {{mood}}»، شوێنی نیشتەجێبوونی گیانلەبەرە دڵنەرمەکان کە تەنها دڵی ئازا دەیانبینێت." },
      { number: 3, gradient: "linear-gradient(135deg,#A7F3D0,#34D399)", emoji: "🦋",
        text: "{{hero}} بەناو دارە بەرزەکاندا ڕۆیشت، پەپوولە ڕەنگاوڕەنگەکان بەخێرهاتنیان کرد. یەکێکیان لە گوێی چرپاند: «بەردەوامبە، سەرکێشیی ڕاستەقینە کاتێک دەست پێدەکات کە باوەڕ بە خۆت بکەیت.» گەرمییەک سنگی {{hero}} پڕکرد." },
      { number: 4, gradient: "linear-gradient(135deg,#FCA5A5,#F87171)", emoji: "🌋",
        text: "{{hero}} گەیشتە پردێکی دارینی لەرزۆک لەسەر ڕووبارێکی بریسکەدار. کەمێک وەستا، پاشان قسەکانی پەپوولەی هاتەوە بیر و بە دڵنیاییەوە هەنگاوی نا. لەوبەری پرد، شتێکی نایاب چاوەڕوانی دەکرد." },
      { number: 5, gradient: "linear-gradient(135deg,#FDE68A,#FB923C)", emoji: "🏆",
        text: "لە کۆتایی ڕێگاکە، {{hero}} سندوقێکی بچووکی ڕووناکی دۆزییەوە. بە نەرمی کردییەوە، تەنها یەک وشە هاتە دەرەوە: «ئازایەتی». {{hero}} گەڕایەوە ماڵەوە و گەنجینەیەکی گرانبەهاتری لە زێڕی لە دڵدا هەڵگرت: ئەوەی کە دەتوانێت هەرشتێک بکات کە باوەڕی پێی هەبێت." },
    ],
    reflectiveQuestion: "ئەی {{hero}}، بەیانی چ سەرکێشییەکی بچووکت دەوێت بە ئازایەتی بیکەیت؟",
  },
};

export function buildSampleStory(opts: {
  lang: Lang;
  heroName: string;
  mood: string;
  pageCount: number;
}): SampleStory {
  const src = SAMPLES[opts.lang] ?? SAMPLES.ar;
  const hero = opts.heroName.trim() || (opts.lang === "en" ? "the hero" : opts.lang === "ku" ? "پاڵەوان" : "البطل");
  const mood = opts.mood.trim() || (opts.lang === "en" ? "wonders" : opts.lang === "ku" ? "سەرسوڕهێنەر" : "العجائب");
  const sub = (s: string) => s.replaceAll("{{hero}}", hero).replaceAll("{{mood}}", mood);
  const n = Math.max(1, Math.min(opts.pageCount, src.pages.length));
  return {
    title: sub(src.title),
    cover: src.cover,
    intro: src.intro,
    pages: src.pages.slice(0, n).map((p) => ({ ...p, text: sub(p.text) })),
    reflectiveQuestion: sub(src.reflectiveQuestion),
  };
}
