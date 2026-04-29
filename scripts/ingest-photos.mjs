import { exiftool } from "exiftool-vendored";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "raw", "photos");
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const FULL_DIR = path.join(PUBLIC_DIR, "media", "full");
const THUMB_DIR = path.join(PUBLIC_DIR, "media", "thumbs");
const MANUAL_OVERRIDES_PATH = path.join(DATA_DIR, "manual-overrides.json");
const GEOCODE_CACHE_PATH = path.join(DATA_DIR, "geocode-cache.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"]);
const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".m4v"]);
const SUPPORTED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

async function main() {
  await ensureDirs();

  const files = await listMediaFiles(RAW_DIR);
  const manualOverrides = await loadManualOverrides();
  if (files.length === 0) {
    await writeEmptyAlbum();
    console.log("No photos found. Put images into raw/photos and run npm run album:build again.");
    return;
  }

  const media = [];

  for (const [index, filePath] of files.entries()) {
    const tags = await safeReadExif(filePath);
    const item = await buildMediaItem(filePath, tags, index, manualOverrides);
    media.push(item);
    console.log(`Processed ${index + 1}/${files.length}: ${path.basename(filePath)}`);
  }

  const sortedMedia = media.sort((a, b) => a.timestamp - b.timestamp || a.fileName.localeCompare(b.fileName));
  const album = await buildAlbum(sortedMedia);

  await fs.writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(sortedMedia, null, 2));
  await fs.writeFile(path.join(DATA_DIR, "album.json"), JSON.stringify(album, null, 2));
  await fs.writeFile(path.join(PUBLIC_DIR, "album.json"), JSON.stringify(album, null, 2));

  await exiftool.end();

  console.log("");
  console.log(`Album ready: ${album.stats.photos} photos, ${album.stats.days} periods, ${album.stats.stops} footprint stops.`);
  console.log("Open with: npm run dev");
}

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(FULL_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });
}

async function listMediaFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMediaFiles(fullPath)));
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function safeReadExif(filePath) {
  try {
    return await exiftool.read(filePath);
  } catch (error) {
    console.warn(`Could not read EXIF for ${path.basename(filePath)}: ${error.message}`);
    return {};
  }
}

async function buildMediaItem(filePath, tags, index, manualOverrides) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const relativePath = path.relative(ROOT, filePath);
  const override = manualOverrides[fileName] ?? manualOverrides[relativePath] ?? {};
  const kind = VIDEO_EXTENSIONS.has(ext) ? "video" : IMAGE_EXTENSIONS.has(ext) ? "image" : "unknown";
  const id = `${String(index + 1).padStart(4, "0")}-${slugify(path.basename(filePath, ext))}`;
  const stat = await fs.stat(filePath);
  const overrideDate = parseManualDate(override.takenAt);
  const takenAtDate = overrideDate ?? readDate(tags) ?? stat.birthtime ?? stat.mtime;
  const takenAt = Number.isNaN(takenAtDate.getTime()) ? null : takenAtDate.toISOString();
  const timestamp = takenAtDate && !Number.isNaN(takenAtDate.getTime()) ? takenAtDate.getTime() : stat.mtimeMs;
  const exifGps = readGps(tags);
  const manualGps = readManualGps(override);
  const gps = manualGps ?? exifGps;
  const dayKey = toDayKey(new Date(timestamp));
  const dayIndex = 0;
  const output = await prepareMediaFiles(filePath, id, kind);

  return {
    id,
    kind,
    fileName,
    src: output.src,
    thumb: output.thumb,
    takenAt,
    timestamp,
    latitude: gps.latitude,
    longitude: gps.longitude,
    width: output.width ?? numberOrNull(tags.ImageWidth),
    height: output.height ?? numberOrNull(tags.ImageHeight),
    dayKey,
    dayIndex,
    placeName: typeof override.placeName === "string" && override.placeName.trim() ? override.placeName.trim() : null,
    locationSource: manualGps ? "manual" : typeof exifGps.latitude === "number" && typeof exifGps.longitude === "number" ? "exif" : null,
    sourcePath: relativePath
  };
}

async function prepareMediaFiles(filePath, id, kind) {
  if (kind !== "image") {
    const ext = path.extname(filePath).toLowerCase();
    const target = `${id}${ext}`;
    await fs.copyFile(filePath, path.join(FULL_DIR, target));
    return {
      src: `media/full/${target}`,
      thumb: `media/full/${target}`,
      width: null,
      height: null
    };
  }

  try {
    const image = sharp(filePath, { limitInputPixels: false }).rotate();
    const metadata = await image.metadata();
    const fullName = `${id}.jpg`;
    const thumbName = `${id}.jpg`;

    await image
      .clone()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(path.join(FULL_DIR, fullName));

    await image
      .clone()
      .resize({ width: 640, height: 420, fit: "cover", position: "attention" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(THUMB_DIR, thumbName));

    return {
      src: `media/full/${fullName}`,
      thumb: `media/thumbs/${thumbName}`,
      width: metadata.width ?? null,
      height: metadata.height ?? null
    };
  } catch (error) {
    const ext = path.extname(filePath).toLowerCase();
    const target = `${id}${ext}`;
    await fs.copyFile(filePath, path.join(FULL_DIR, target));
    console.warn(`Could not optimize ${path.basename(filePath)}; copied original. ${error.message}`);

    return {
      src: `media/full/${target}`,
      thumb: `media/full/${target}`,
      width: null,
      height: null
    };
  }
}

async function loadGeocodeCache() {
  try {
    const raw = await fs.readFile(GEOCODE_CACHE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveGeocodeCache(cache) {
  await fs.writeFile(GEOCODE_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function reverseGeocode(latitude, longitude, cache) {
  const lat = latitude.toFixed(3);
  const lon = longitude.toFixed(3);
  const key = `${lat},${lon}`;
  
  if (cache[key] !== undefined) return cache[key];
  
  try {
    console.log(`[Geocoding] Resolving ${lat}, ${lon}...`);
    await new Promise(r => setTimeout(r, 1100)); // Respect Nominatim rate limit
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=zh-CN,en`, {
      headers: { "User-Agent": "FootprintAtlas/1.0" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (data && data.address) {
      const state = data.address.state || data.address.province || "";
      let city = data.address.city || data.address.town || data.address.county || "";
      
      // Keep the full location name intact for better readability
      
      let name = "";
      if (state && city && state !== city && !state.includes(city)) {
        name = `${state} · ${city}`;
      } else if (state || city) {
        name = state || city;
      } else if (data.address.country) {
        name = data.address.country;
      }
      
      if (name) {
        cache[key] = name;
        await saveGeocodeCache(cache);
        return name;
      }
    }
  } catch (error) {
    console.warn(`[Geocoding] Failed for ${lat},${lon}: ${error.message}`);
  }
  
  cache[key] = "";
  await saveGeocodeCache(cache);
  return "";
}

async function buildAlbum(media) {
  const placedMedia = media.filter(hasGps);
  const unplacedPhotos = media.filter((item) => !hasGps(item));
  const periodKeys = [...new Set(placedMedia.map((item) => toPeriodKey(new Date(item.timestamp))))].sort();
  
  const geocodeCache = await loadGeocodeCache();
  const days = [];

  for (let periodIndex = 0; periodIndex < periodKeys.length; periodIndex++) {
    const periodKey = periodKeys[periodIndex];
    const periodMedia = placedMedia
      .filter((item) => toPeriodKey(new Date(item.timestamp)) === periodKey)
      .map((item) => ({ ...item, dayIndex: periodIndex + 1 }));
      
    const stops = await buildStops(periodMedia, periodKey, geocodeCache);
    const date = parsePeriodKey(periodKey);
    const title = inferPeriodTitle(date, stops);
    const subtitle = `${stops.length} 处足迹 · ${periodMedia.length} 帧底片`;

    days.push({
      id: `period-${String(periodIndex + 1).padStart(2, "0")}`,
      dayKey: periodKey,
      dateLabel: formatPeriodLabel(date),
      weekday: "ARCHIVE",
      title,
      subtitle,
      summary: buildPeriodSummary(periodMedia, stops),
      stops,
      photoCount: periodMedia.length
    });
  }

  const allStops = days.flatMap((day) => day.stops);
  const geotagged = placedMedia.length;

  return {
    mode: "all-places",
    title: "FOOTPRINT ATLAS",
    subtitle: "每一张照片都是一枚坐标，钉在时间的地图上",
    destination: "ALL PLACES",
    dateRange: buildDateRange(days),
    generatedAt: new Date().toISOString(),
    stats: {
      photos: media.length,
      geotagged,
      days: days.length,
      stops: allStops.length,
      years: countYears(placedMedia),
      unplaced: unplacedPhotos.length
    },
    days,
    unplacedPhotos
  };
}

async function buildStops(dayMedia, dayKey, geocodeCache) {
  const groupedStops = [];
  let current = [];

  for (const item of dayMedia) {
    if (current.length === 0) {
      current.push(item);
      continue;
    }

    const previous = current[current.length - 1];
    const gapMinutes = Math.abs(item.timestamp - previous.timestamp) / 60000;
    const distanceKm = gpsDistanceKm(previous, item);
    const shouldSplit =
      gapMinutes > 360 ||
      (distanceKm !== null && distanceKm > 12) ||
      (current.length >= 8 && gapMinutes > 45);

    if (shouldSplit) {
      groupedStops.push(current);
      current = [item];
    } else {
      current.push(item);
    }
  }

  if (current.length > 0) groupedStops.push(current);

  const resolvedStops = [];
  for (let index = 0; index < groupedStops.length; index++) {
    const photos = groupedStops[index];
    resolvedStops.push(await buildStop(photos, dayKey, index, geocodeCache));
  }
  
  return resolvedStops;
}

async function buildStop(photos, dayKey, index, geocodeCache) {
  const first = photos[0];
  const last = photos[photos.length - 1];
  const center = averageGps(photos);
  
  let locationName = "";
  if (typeof center.latitude === "number" && typeof center.longitude === "number") {
    locationName = await reverseGeocode(center.latitude, center.longitude, geocodeCache);
  }

  const time = formatStopTime(first.timestamp, last.timestamp);
  const type = inferStopType(photos, index);
  const title = inferStopTitle(type, index, photos, locationName);
  const subtitle = first.placeName || (photos.length > 1 ? `${photos.length} 张照片` : first.fileName);

  return {
    id: `${dayKey}-stop-${String(index + 1).padStart(2, "0")}`,
    dayKey,
    index,
    title,
    subtitle,
    type,
    time,
    startAt: first.takenAt,
    endAt: last.takenAt,
    latitude: center.latitude,
    longitude: center.longitude,
    description: buildStopDescription(photos, center, locationName),
    photos
  };
}

function inferStopType(photos, index) {
  if (index === 0 && photos.length <= 2) return "transit";
  if (photos.some((photo) => /hotel|resort|room|stay/i.test(photo.fileName))) return "hotel";
  if (photos.some((photo) => /food|cafe|coffee|restaurant|bar|dinner|lunch/i.test(photo.fileName))) return "food";
  if (photos.length >= 5) return "walk";
  return "sight";
}

function inferStopTitle(type, index, photos = [], locationName = "") {
  const manualPlaceName = photos.find((photo) => photo.placeName)?.placeName;
  if (manualPlaceName) return manualPlaceName;
  
  if (locationName) return locationName;

  const number = String(index + 1).padStart(2, "0");
  const titles = {
    transit: "途经",
    hotel: "驻留",
    food: "食记",
    walk: "漫步",
    sight: "到访",
    photo: "留影",
    memory: "印迹"
  };

  return `${titles[type] ?? "足迹"} ${number}`;
}

function buildStopDescription(photos, center, locationName) {
  const gpsText =
    typeof center.latitude === "number" && typeof center.longitude === "number"
      ? (locationName ? `${locationName} · 坐标 ${center.latitude.toFixed(4)}, ${center.longitude.toFixed(4)}` : `坐标 ${center.latitude.toFixed(4)}, ${center.longitude.toFixed(4)}`)
      : "暂无 GPS，已按拍摄时间归档";

  return `${gpsText}，共 ${photos.length} 张照片。`;
}

function inferPeriodTitle(date, stops) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const suffix = stops.length > 1 ? "FOOTPRINTS" : "FOOTPRINT";
  return `${year} · ${month} ${suffix}`;
}

function buildPeriodSummary(periodMedia, stops) {
  const gpsCount = periodMedia.filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number").length;
  return `${stops.length} 处足迹，${periodMedia.length} 张底片，${gpsCount} 张定位于经纬之上。`;
}

function buildDateRange(days) {
  if (days.length === 0) return "";
  const first = days[0].dateLabel;
  const last = days[days.length - 1].dateLabel;
  return first === last ? first : `${first} - ${last}`;
}

async function writeEmptyAlbum() {
  const emptyAlbum = {
    title: "FOOTPRINT ATLAS",
    subtitle: "将照片置入 raw/photos 开始建档",
    destination: "ALL PLACES",
    dateRange: "",
    generatedAt: new Date().toISOString(),
    stats: {
      photos: 0,
      geotagged: 0,
      days: 0,
      stops: 0,
      years: 0,
      unplaced: 0
    },
    days: [],
    unplacedPhotos: []
  };

  await fs.writeFile(path.join(DATA_DIR, "album.json"), JSON.stringify(emptyAlbum, null, 2));
  await fs.writeFile(path.join(PUBLIC_DIR, "album.json"), JSON.stringify(emptyAlbum, null, 2));
}

function readDate(tags) {
  const candidates = [
    tags.DateTimeOriginal,
    tags.CreateDate,
    tags.MediaCreateDate,
    tags.TrackCreateDate,
    tags.ModifyDate
  ];

  for (const value of candidates) {
    const parsed = parseExifDate(value);
    if (parsed) return parsed;
  }

  return null;
}

function parseExifDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.toISOString === "function") return new Date(value.toISOString());
  if (typeof value?.rawValue === "string") return parseExifDateString(value.rawValue);
  if (typeof value === "string") return parseExifDateString(value);
  return null;
}

function parseExifDateString(value) {
  const normalized = value
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
    .replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readGps(tags) {
  const latitude = numberOrNull(tags.GPSLatitude ?? tags.Composite?.GPSLatitude);
  const longitude = numberOrNull(tags.GPSLongitude ?? tags.Composite?.GPSLongitude);

  if (latitude !== null && longitude !== null) {
    return { latitude, longitude };
  }

  const gpsPosition = tags.GPSPosition ?? tags.Composite?.GPSPosition;
  if (typeof gpsPosition === "string") {
    const match = gpsPosition.match(/(-?\d+(?:\.\d+)?)\D+(-?\d+(?:\.\d+)?)/);
    if (match) {
      return {
        latitude: Number(match[1]),
        longitude: Number(match[2])
      };
    }
  }

  return { latitude: null, longitude: null };
}

async function loadManualOverrides() {
  try {
    const raw = await fs.readFile(MANUAL_OVERRIDES_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read manual overrides: ${error.message}`);
    }
    return {};
  }
}

function readManualGps(override) {
  const latitude = numberOrNull(override.latitude);
  const longitude = numberOrNull(override.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseManualDate(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function averageGps(photos) {
  const gps = photos.filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number");
  if (gps.length === 0) return { latitude: null, longitude: null };

  return {
    latitude: gps.reduce((sum, item) => sum + item.latitude, 0) / gps.length,
    longitude: gps.reduce((sum, item) => sum + item.longitude, 0) / gps.length
  };
}

function gpsDistanceKm(a, b) {
  if (
    typeof a.latitude !== "number" ||
    typeof a.longitude !== "number" ||
    typeof b.latitude !== "number" ||
    typeof b.longitude !== "number"
  ) {
    return null;
  }

  const radiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatStopTime(startTimestamp, endTimestamp) {
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);
  const startText = start.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const endText = end.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

  return startText === endText ? startText : `${startText}-${endText}`;
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toPeriodKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parsePeriodKey(periodKey) {
  return new Date(`${periodKey}-01T12:00:00`);
}

function formatPeriodLabel(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}.${month}`;
}

function countYears(media) {
  if (media.length === 0) return 0;
  return new Set(media.map((item) => new Date(item.timestamp).getFullYear())).size;
}

function hasGps(item) {
  return typeof item.latitude === "number" && typeof item.longitude === "number";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return slug || "photo";
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

main().catch(async (error) => {
  console.error(error);
  await exiftool.end();
  process.exit(1);
});
