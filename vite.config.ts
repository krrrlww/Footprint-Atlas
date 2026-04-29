import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import Busboy from "busboy";
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const overridesPath = path.join(rootDir, "data", "manual-overrides.json");
const rawPhotosDir = path.join(rootDir, "raw", "photos");
const SUPPORTED_UPLOAD_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"]);

export default defineConfig({
  plugins: [react(), manualMetadataApi()],
  server: {
    port: 5173
  }
});

function manualMetadataApi() {
  return {
    name: "manual-metadata-api",
    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");

        try {
          if (req.method === "GET" && url.pathname === "/api/manual-overrides") {
            const overrides = await readOverrides();
            sendJson(res, 200, overrides);
            return;
          }

          if (req.method === "GET" && url.pathname === "/api/geocode") {
            const query = url.searchParams.get("query")?.trim();
            if (!query) {
              sendJson(res, 400, { error: "Missing query" });
              return;
            }

            const results = await geocode(query);
            sendJson(res, 200, { results });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/manual-overrides") {
            const payload = await readJsonBody(req);
            const payloadRecord = toRecord(payload);
            const currentOverrides = await readOverrides();
            const overrides = {
              ...currentOverrides,
              ...sanitizeOverrides(toRecord(payloadRecord.overrides ?? payloadRecord))
            };
            await fs.mkdir(path.dirname(overridesPath), { recursive: true });
            await fs.writeFile(overridesPath, `${JSON.stringify(sortObject(overrides), null, 2)}\n`);
            await execFileAsync("node", ["scripts/ingest-photos.mjs"], { cwd: rootDir });

            sendJson(res, 200, {
              ok: true,
              overrides: sortObject(overrides),
              album: await readAlbum()
            });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/upload-photos") {
            const uploaded = await saveUploadedPhotos(req);
            await execFileAsync("node", ["scripts/ingest-photos.mjs"], { cwd: rootDir });

            sendJson(res, 200, {
              ok: true,
              uploaded,
              album: await readAlbum()
            });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/ai-enrich") {
            const payload = await readJsonBody(req) as { config?: { baseURL?: string; apiKey?: string; model?: string; textBaseURL?: string; textApiKey?: string; textModel?: string } };
            const cfg = payload.config ?? {};

            const env: Record<string, string> = {
              ...process.env as Record<string, string>,
              AI_API_KEY: cfg.apiKey ?? "",
              AI_BASE_URL: cfg.baseURL ?? "",
              AI_VISION_MODEL: cfg.model ?? "",
              AI_VISION_BASE_URL: cfg.baseURL ?? "",
              AI_VISION_API_KEY: cfg.apiKey ?? "",
              AI_TEXT_MODEL: cfg.textModel || cfg.model || "",
              AI_TEXT_BASE_URL: cfg.textBaseURL || cfg.baseURL || "",
              AI_TEXT_API_KEY: cfg.textApiKey || cfg.apiKey || "",
            };

            const { stdout, stderr } = await execFileAsync("node", ["scripts/enrich-ai.mjs"], { cwd: rootDir, env, timeout: 1800000 });
            const output = (stdout + "\n" + stderr).trim();
            const lines = output.split("\n").filter(Boolean);
            const statsLine = lines.filter(l => l.includes("API calls") || l.includes("complete") || l.includes("ERROR")).slice(-2).join(" | ") || "";

            sendJson(res, 200, {
              ok: true,
              stats: statsLine || "AI enrichment complete.",
              log: lines.slice(-10),
              album: await readAlbum()
            });
            return;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const stderr = (error as { stderr?: string })?.stderr?.trim() ?? "";
          const detail = stderr ? `${msg}\n${stderr.split("\n").slice(-5).join("\n")}` : msg;
          sendJson(res, 500, { error: detail });
          return;
        }

        next();
      });
    }
  };
}

function saveUploadedPhotos(req: NodeJS.ReadableStream & { headers?: Record<string, string | string[] | undefined> }) {
  return new Promise<Array<{ fileName: string; originalName: string }>>((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers ?? {},
      limits: {
        files: 200,
        fileSize: 60 * 1024 * 1024
      }
    });
    const uploads: Array<{ fileName: string; originalName: string }> = [];
    const writes: Promise<void>[] = [];

    busboy.on("file", (_fieldName, file, info) => {
      const originalName = info.filename || "photo";
      const ext = path.extname(originalName).toLowerCase();

      if (!SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) {
        file.resume();
        return;
      }

      const write = (async () => {
        await fs.mkdir(rawPhotosDir, { recursive: true });
        const fileName = await nextUploadName(originalName);
        const target = path.join(rawPhotosDir, fileName);

        await new Promise<void>((resolveWrite, rejectWrite) => {
          const stream = createWriteStream(target, { flags: "wx" });
          file.pipe(stream);
          stream.on("finish", resolveWrite);
          stream.on("error", rejectWrite);
          file.on("error", rejectWrite);
        });

        uploads.push({ fileName, originalName });
      })();

      writes.push(write);
    });

    busboy.on("error", reject);
    busboy.on("finish", async () => {
      try {
        await Promise.all(writes);
        resolve(uploads.sort((a, b) => a.fileName.localeCompare(b.fileName)));
      } catch (error) {
        reject(error);
      }
    });

    req.pipe(busboy);
  });
}

async function nextUploadName(originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext);
  const safeBase = slugifyFileName(baseName) || "photo";
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? "" : `-${String(index + 1).padStart(3, "0")}`;
    const fileName = `${stamp}-${safeBase}${suffix}${ext}`;
    try {
      await fs.access(path.join(rawPhotosDir, fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fileName;
      throw error;
    }
  }

  throw new Error("Could not allocate upload filename");
}

function slugifyFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function readOverrides() {
  try {
    return JSON.parse(await fs.readFile(overridesPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {};
  }
}

async function readAlbum() {
  const albumPath = path.join(rootDir, "public", "album.json");
  return JSON.parse(await fs.readFile(albumPath, "utf8"));
}

async function geocode(query: string) {
  const localResults = searchLocalGazetteer(query);
  const hasExactLocal = localResults.some(
    (item) => item.placeName.replace(/ · 本地点库$/, "") === query.trim()
  );
  const onlineResults = hasExactLocal ? [] : await geocodeOnline(query).catch(() => []);
  const merged = [...localResults, ...onlineResults];
  const seen = new Set<string>();

  return merged.filter((item) => {
    const key = `${item.latitude.toFixed(2)},${item.longitude.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function geocodeOnline(query: string) {
  const queries = [query];
  if (!/[省市区县]$/.test(query) && query.length <= 4) {
    queries.push(`${query}省`, `${query}市`);
  }

  const allResults: Array<{ placeName: string; latitude: number; longitude: number; type: string; population: number }> = [];

  for (const q of queries) {
    const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
    endpoint.searchParams.set("name", q);
    endpoint.searchParams.set("count", "5");
    endpoint.searchParams.set("language", "zh");
    endpoint.searchParams.set("format", "json");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) continue;

    const raw = (await response.json()) as {
      results?: Array<{
        name?: string;
        latitude?: number;
        longitude?: number;
        country?: string;
        admin1?: string;
        admin2?: string;
        feature_code?: string;
        population?: number;
      }>;
    };

    for (const item of raw.results ?? []) {
      const lat = Number(item.latitude);
      const lon = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      allResults.push({
        placeName: [item.name, item.admin2, item.admin1, item.country].filter(Boolean).join(", "),
        latitude: lat,
        longitude: lon,
        type: item.feature_code ?? "place",
        population: item.population ?? 0
      });
    }
  }

  const seen = new Set<string>();
  return allResults
    .sort((a, b) => b.population - a.population)
    .filter((item) => {
      const key = `${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map(({ population: _, ...rest }) => rest);
}

const LOCAL_GAZETTEER = [
  // 省 / 自治区 / 直辖市
  ["北京", 39.9042, 116.4074],
  ["天津", 39.3434, 117.3616],
  ["上海", 31.2304, 121.4737],
  ["重庆", 29.563, 106.5516],
  ["河北", 38.0455, 114.5149],
  ["山西", 37.8706, 112.5489],
  ["辽宁", 41.8057, 123.4315],
  ["吉林", 43.8868, 125.3245],
  ["黑龙江", 45.7520, 126.6520],
  ["江苏", 32.0603, 118.7969],
  ["浙江", 30.2741, 120.1551],
  ["安徽", 31.8612, 117.2830],
  ["福建", 26.0753, 119.3062],
  ["江西", 28.6820, 115.8579],
  ["山东", 36.6512, 117.1201],
  ["河南", 34.7466, 113.6254],
  ["湖北", 30.5928, 114.3055],
  ["湖南", 28.2282, 112.9388],
  ["广东", 23.1291, 113.2644],
  ["广西", 22.817, 108.3669],
  ["海南", 20.0174, 110.3492],
  ["四川", 30.5728, 104.0668],
  ["贵州", 26.6470, 106.6302],
  ["云南", 25.0406, 102.7123],
  ["西藏", 29.652, 91.1721],
  ["陕西", 34.3416, 108.9398],
  ["甘肃", 36.0611, 103.8343],
  ["青海", 36.6171, 101.7782],
  ["宁夏", 38.4872, 106.2309],
  ["新疆", 43.8256, 87.6168],
  ["内蒙古", 40.8414, 111.7519],
  ["香港", 22.3193, 114.1694],
  ["澳门", 22.1987, 113.5439],
  ["台湾", 25.0330, 121.5654],
  // 主要城市 / 旅游地
  ["广州", 23.1291, 113.2644],
  ["深圳", 22.5431, 114.0579],
  ["杭州", 30.2741, 120.1551],
  ["南京", 32.0603, 118.7969],
  ["苏州", 31.2989, 120.5853],
  ["武汉", 30.5928, 114.3055],
  ["长沙", 28.2282, 112.9388],
  ["成都", 30.5728, 104.0668],
  ["西安", 34.3416, 108.9398],
  ["昆明", 24.8801, 102.8329],
  ["大理", 25.6065, 100.2676],
  ["丽江", 26.8721, 100.2296],
  ["南宁", 22.817, 108.3669],
  ["北海", 21.4811, 109.1202],
  ["柳州", 24.3264, 109.4281],
  ["桂林", 25.2736, 110.2900],
  ["阳朔", 24.7785, 110.4966],
  ["张家界", 29.1171, 110.4792],
  ["恩施", 30.2722, 109.4882],
  ["九寨沟", 33.252, 103.918],
  ["西宁", 36.6171, 101.7782],
  ["青海湖", 36.89, 100.18],
  ["张掖", 38.9259, 100.4498],
  ["敦煌", 40.1421, 94.6619],
  ["兰州", 36.0611, 103.8343],
  ["拉萨", 29.652, 91.1721],
  ["乌鲁木齐", 43.8256, 87.6168],
  ["厦门", 24.4798, 118.0894],
  ["三亚", 18.2528, 109.5119],
  ["哈尔滨", 45.7520, 126.6520],
  ["大连", 38.9140, 121.6147],
  ["青岛", 36.0671, 120.3826],
  ["郑州", 34.7466, 113.6254],
  ["合肥", 31.8612, 117.2830],
  ["福州", 26.0753, 119.3062],
  ["南昌", 28.6820, 115.8579],
  ["贵阳", 26.6470, 106.6302],
  ["沈阳", 41.8057, 123.4315],
  ["长春", 43.8868, 125.3245],
  ["呼和浩特", 40.8414, 111.7519],
  ["银川", 38.4872, 106.2309],
  ["海口", 20.0174, 110.3492],
  ["珠海", 22.2710, 113.5767],
  ["东莞", 23.0430, 113.7633],
  ["佛山", 23.0218, 113.1219],
  ["无锡", 31.4912, 120.3119],
  ["宁波", 29.8683, 121.5440],
  ["温州", 28.0006, 120.6722],
  // 常用国际目的地（中文名）
  ["东京", 35.6762, 139.6503],
  ["大阪", 34.6937, 135.5023],
  ["京都", 35.0116, 135.7681],
  ["首尔", 37.5665, 126.9780],
  ["曼谷", 13.7563, 100.5018],
  ["新加坡", 1.3521, 103.8198],
  ["吉隆坡", 3.1390, 101.6869],
  ["巴厘岛", -8.3405, 115.0920],
  ["清迈", 18.7061, 98.9817],
  ["河内", 21.0285, 105.8542],
  ["巴黎", 48.8566, 2.3522],
  ["伦敦", 51.5074, -0.1278],
  ["纽约", 40.7128, -74.0060],
  ["洛杉矶", 34.0522, -118.2437],
  ["旧金山", 37.7749, -122.4194],
  ["悉尼", -33.8688, 151.2093],
  ["墨尔本", -37.8136, 144.9631],
  ["迪拜", 25.2048, 55.2708],
  ["罗马", 41.9028, 12.4964],
  ["巴塞罗那", 41.3874, 2.1686]
] as const;

function searchLocalGazetteer(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return LOCAL_GAZETTEER.filter(([name]) => normalized.includes(name.toLowerCase()) || name.toLowerCase().includes(normalized))
    .slice(0, 5)
    .map(([name, latitude, longitude]) => ({
      placeName: `${name} · 本地点库`,
      latitude,
      longitude,
      type: "local"
    }));
}

function sanitizeOverrides(value: Record<string, unknown>) {
  const next: Record<string, unknown> = {};

  for (const [fileName, rawOverride] of Object.entries(value)) {
    if (!fileName || typeof rawOverride !== "object" || rawOverride === null) continue;
    const override = rawOverride as Record<string, unknown>;
    const latitude = Number(override.latitude);
    const longitude = Number(override.longitude);
    const takenAt = typeof override.takenAt === "string" ? override.takenAt : "";
    const placeName = typeof override.placeName === "string" ? override.placeName.trim() : "";

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    if (!takenAt || Number.isNaN(new Date(takenAt).getTime())) continue;

    next[fileName] = {
      placeName,
      latitude,
      longitude,
      takenAt,
      updatedAt: new Date().toISOString()
    };
  }

  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function sortObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function readJsonBody(req: NodeJS.ReadableStream): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void }, statusCode: number, value: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}
