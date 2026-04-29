import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const AI_CACHE_PATH = path.join(DATA_DIR, "ai-cache.json");
const ALBUM_PATH = path.join(PUBLIC_DIR, "album.json");

const API_KEY = process.env.AI_API_KEY || "";
const BASE_URL = process.env.AI_BASE_URL || "https://api.deepseek.com";

const VISION_MODEL = process.env.AI_VISION_MODEL || "deepseek-chat";
const VISION_BASE_URL = process.env.AI_VISION_BASE_URL || BASE_URL;
const VISION_API_KEY = process.env.AI_VISION_API_KEY || API_KEY;

const TEXT_MODEL = process.env.AI_TEXT_MODEL || VISION_MODEL;
const TEXT_BASE_URL = process.env.AI_TEXT_BASE_URL || VISION_BASE_URL;
const TEXT_API_KEY = process.env.AI_TEXT_API_KEY || VISION_API_KEY;

async function main() {
  const album = JSON.parse(await fs.readFile(ALBUM_PATH, "utf8"));
  if (!album.days || album.days.length === 0) {
    console.log("No album data. Run npm run album:build first.");
    return;
  }

  const cache = await loadCache();
  const hasCachedData = Object.keys(cache).length > 0;

  if (!API_KEY && !hasCachedData) {
    console.log("No AI_API_KEY set. Skipping AI enrichment.");
    console.log("To enable: AI_API_KEY=sk-xxx npm run album:ai");
    return;
  }

  if (API_KEY) {
    console.log(`[AI] Vision model: ${VISION_MODEL} @ ${VISION_BASE_URL}`);
    if (TEXT_MODEL !== VISION_MODEL || TEXT_BASE_URL !== VISION_BASE_URL) {
      console.log(`[AI] Text model: ${TEXT_MODEL} @ ${TEXT_BASE_URL}`);
    }
  }

  let cacheHits = 0;
  let apiCalls = 0;
  let failures = 0;

  const totalStops = album.days.reduce((n, d) => n + d.stops.length, 0);
  const totalItems = totalStops + album.days.length;
  let processed = 0;

  for (const day of album.days) {
    for (const stop of day.stops) {
      if (cache[stop.id]?.capsule) {
        stop.capsule = cache[stop.id].capsule;
        cacheHits++;
        processed++;
        continue;
      }

      if (!API_KEY) { processed++; continue; }
      console.log(`[AI] (${processed + 1}/${totalItems}) Capsule: ${stop.title} (${stop.photos.length} photos)`);
      const capsule = await generateCapsule(stop);
      if (capsule) {
        stop.capsule = capsule;
        cache[stop.id] = { capsule, generatedAt: new Date().toISOString() };
        apiCalls++;
        failures = 0;
        await saveCache(cache);
      } else {
        failures++;
        console.warn(`[AI] Failed (${failures} consecutive). Will abort at 5.`);
        if (failures >= 5) {
          throw new Error(`API calls keep failing (${failures} consecutive failures). Please check: 1) API key is valid 2) Model "${VISION_MODEL}" supports vision 3) API URL "${VISION_BASE_URL}" is correct`);
        }
      }
      processed++;
    }

    if (cache[day.id]?.narrative) {
      day.narrative = cache[day.id].narrative;
      cacheHits++;
      processed++;
      continue;
    }

    if (!API_KEY) { processed++; continue; }
    console.log(`[AI] (${processed + 1}/${totalItems}) Narrative: ${day.title}`);
    const narrative = await generateNarrative(day);
    if (narrative) {
      day.narrative = narrative;
      cache[day.id] = { narrative, generatedAt: new Date().toISOString() };
      apiCalls++;
      await saveCache(cache);
      failures = 0;
    } else {
      failures++;
    }
    processed++;
  }

  await fs.writeFile(ALBUM_PATH, JSON.stringify(album, null, 2));
  await fs.writeFile(path.join(DATA_DIR, "album.json"), JSON.stringify(album, null, 2));

  const summary = `AI enrichment complete: ${apiCalls} API calls, ${cacheHits} cache hits${failures > 0 ? `, ${failures} failures` : ""}.`;
  console.log("");
  console.log(summary);
}

async function generateCapsule(stop) {
  const images = await loadStopImages(stop.photos.slice(0, 4));

  const locationName = stop.title || "unknown";
  const timeRange = stop.time || "";
  const startDate = stop.startAt ? new Date(stop.startAt).toLocaleDateString("zh-CN") : "";

  const textPrompt = `你是一本复古旅行手账的灵魂代笔人。你要为旅行者写下他们感受到但来不及记录的文字。

这是一个足迹点的信息：
- 地点：${locationName}
- 日期：${startDate}
- 时间段：${timeRange}
- 照片数量：${stop.photos.length}
${images.length > 0 ? "（上面的图片就是旅行者在这个地点拍的照片，请仔细观察画面内容）" : ""}

请返回以下 JSON（不要包含其他任何文字）：
{
  "poeticTitle": "8字以内的诗意标题，像手账封面的字，比如'洱海晨光'、'古城黄昏散步'、'深巷里的咖啡香'",
  "journalNote": "50-80字的第一人称手账旁注。像写给未来自己的私密备忘录，带有当下的感官细节——光线、温度、气味、声音。不要泛泛而谈，要具体到这个地点这个时刻。",
  "mood": "一个精准的氛围词，比如'慵懒午后'、'雨后清透'、'人潮涌动'、'万籁俱寂'",
  "scene": "15字以内的场景速写，像电影分镜描述",
  "colors": ["#hex1", "#hex2", "#hex3"],
  "tags": ["标签1", "标签2", "标签3", "标签4"]
}

要求：
- 仔细看照片里的画面细节，你的描述要基于你真正看到的内容
- poeticTitle 要有文学感和画面感，不要直白的"XX游览"
- journalNote 核心是感受和细节，不是流水账。要让人读了之后能回到那个瞬间
- colors 根据照片画面的实际色调提取3个hex值
- tags 混合具体元素和抽象感受，4-6个`;

  const content = [];
  for (const img of images) {
    content.push(img);
  }
  content.push({ type: "text", text: textPrompt });

  return callVisionAPI(content);
}

async function generateNarrative(day) {
  const stopSummaries = day.stops.map((s, i) => {
    const capsuleTitle = s.capsule?.poeticTitle || s.title;
    const capsuleMood = s.capsule?.mood || "";
    const capsuleScene = s.capsule?.scene || "";
    return `${i + 1}. ${capsuleTitle}${capsuleMood ? ` [${capsuleMood}]` : ""}${capsuleScene ? ` — ${capsuleScene}` : ""} (${s.photos.length}张照片)`;
  }).join("\n");

  const prompt = `你是一本复古旅行手账的灵魂代笔人。现在你需要为一整段旅行时期写一篇叙事摘要和一张明信片。

时期信息：
- 时间：${day.dateLabel}
- 足迹点数量：${day.stops.length}
- 照片总数：${day.photoCount}
- 各足迹点：
${stopSummaries}

请返回以下 JSON（不要包含其他任何文字）：
{
  "title": "这段旅程的诗意总标题，10字以内，比如'青甘线上的七天'、'被云南收留的春天'",
  "story": "80-120字的旅程叙事。用第一人称把所有足迹点串成一个有起承转合的故事。像旅行杂志的卷首语，有画面感和节奏感。",
  "postcard": "50-70字的明信片文案。写给未来的自己，语气亲密、温暖、略带怀旧。以'亲爱的未来的我'开头。"
}

要求：
- story 要有叙事弧线，不是简单罗列地点
- postcard 要真诚动人，像真的会寄出去的明信片`;

  return callTextAPI(prompt);
}

async function loadStopImages(photos) {
  const images = [];
  for (const photo of photos) {
    const thumbPath = path.join(ROOT, "public", photo.thumb);
    try {
      const buf = await fs.readFile(thumbPath);
      const ext = path.extname(photo.thumb).slice(1).toLowerCase();
      const mime = ext === "jpg" ? "jpeg" : ext;
      images.push({
        type: "image_url",
        image_url: { url: `data:image/${mime};base64,${buf.toString("base64")}` }
      });
    } catch {
      continue;
    }
  }
  return images;
}

async function callVisionAPI(content) {
  try {
    const payload = {
      model: VISION_MODEL,
      messages: [{ role: "user", content }]
    };

    const resp = await fetch(`${VISION_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VISION_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`[AI] Vision API error ${resp.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    let result = data.choices?.[0]?.message?.content?.trim() || "";
    result = result.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(result);
  } catch (err) {
    console.warn(`[AI] Vision parse error: ${err.message}`);
    return null;
  }
}

async function callTextAPI(prompt) {
  try {
    const payload = {
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }]
    };

    const resp = await fetch(`${TEXT_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TEXT_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn(`[AI] Text API error ${resp.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(content);
  } catch (err) {
    console.warn(`[AI] Text parse error: ${err.message}`);
    return null;
  }
}

async function loadCache() {
  try {
    return JSON.parse(await fs.readFile(AI_CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(AI_CACHE_PATH, JSON.stringify(cache, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
