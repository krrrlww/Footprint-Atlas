export type MediaKind = "image" | "video" | "unknown";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  fileName: string;
  src: string;
  thumb: string;
  takenAt: string | null;
  timestamp: number;
  latitude: number | null;
  longitude: number | null;
  width: number | null;
  height: number | null;
  dayKey: string;
  dayIndex: number;
  placeName?: string | null;
  locationSource?: "exif" | "manual" | null;
  sourcePath?: string;
};

export type MemoryCapsule = {
  poeticTitle: string;
  journalNote: string;
  mood: string;
  scene: string;
  colors: string[];
  tags: string[];
};

export type TimelineStop = {
  id: string;
  dayKey: string;
  index: number;
  title: string;
  subtitle: string;
  type: "photo" | "walk" | "sight" | "hotel" | "food" | "transit" | "memory";
  time: string;
  startAt: string | null;
  endAt: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string;
  photos: MediaItem[];
  capsule?: MemoryCapsule | null;
};

export type PeriodNarrative = {
  title: string;
  story: string;
  postcard: string;
};

export type AlbumDay = {
  id: string;
  dayKey: string;
  dateLabel: string;
  weekday: string;
  title: string;
  subtitle: string;
  summary: string;
  stops: TimelineStop[];
  photoCount: number;
  narrative?: PeriodNarrative | null;
};

export type TravelAlbum = {
  mode?: "single-trip" | "all-places";
  title: string;
  subtitle: string;
  destination: string;
  dateRange: string;
  generatedAt: string;
  stats: {
    photos: number;
    geotagged: number;
    days: number;
    stops: number;
    years?: number;
    unplaced?: number;
  };
  days: AlbumDay[];
  unplacedPhotos?: MediaItem[];
};
