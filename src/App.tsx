import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Camera, Compass, ImagePlus, Images, MapPin, MapPinned, Sparkles } from "lucide-react";
import { AiConfigModal } from "./components/AiConfigModal";
import { DayModal } from "./components/DayModal";
import { MapStage } from "./components/MapStage";
import { PhotoUploader } from "./components/PhotoUploader";
import { UnplacedEditor } from "./components/UnplacedEditor";
import { sampleAlbum } from "./sampleAlbum";
import type { AlbumDay, TimelineStop, TravelAlbum } from "./types/album";

export default function App() {
  const [album, setAlbum] = useState<TravelAlbum>(sampleAlbum);
  const [activeDayId, setActiveDayId] = useState<string | null>(sampleAlbum.days[0]?.id ?? null);
  const [activeModalDay, setActiveModalDay] = useState<AlbumDay | null>(null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [isUnplacedEditorOpen, setIsUnplacedEditorOpen] = useState(false);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);

  useEffect(() => {
    fetch("/album.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("No generated album yet");
        return response.json() as Promise<TravelAlbum>;
      })
      .then((nextAlbum) => {
        setAlbum(nextAlbum);
        setActiveDayId(nextAlbum.days[0]?.id ?? null);
      })
      .catch(() => {
        setAlbum(sampleAlbum);
        setActiveDayId(sampleAlbum.days[0]?.id ?? null);
      });
  }, []);

  const activeDay = useMemo(
    () => album.days.find((day) => day.id === activeDayId) ?? album.days[0],
    [album.days, activeDayId]
  );

  const openStop = (stop: TimelineStop) => {
    const day = album.days.find((candidate) => candidate.dayKey === stop.dayKey);
    if (day) {
      setActiveStopId(stop.id);
      setActiveModalDay(day);
    }
  };

  return (
    <main className="album-shell">
      <header className="album-hero">
        <div className="hero-micro">PERSONAL FOOTPRINT ATLAS · ALL PLACES MEMORY</div>
        <h1>{album.destination}</h1>
        <p>{album.subtitle}</p>
        <div className="hero-meta" aria-label="album stats">
          <span>
            <CalendarDays size={15} />
            {album.dateRange || "No archive dates"}
          </span>
          <span>
            <Images size={15} />
            {album.stats.photos} photos
          </span>
          <span>
            <MapPinned size={15} />
            {album.stats.geotagged} GPS
          </span>
          <span>
            <MapPin size={15} />
            {album.stats.unplaced ?? 0} unplaced
          </span>
          <span>
            <Compass size={15} />
            {album.stats.stops} places
          </span>
          <span>
            <CalendarDays size={15} />
            {album.stats.years ?? 0} years
          </span>
        </div>
        <div className="hero-actions">
          <button className="missing-editor-button" onClick={() => setIsAiConfigOpen(true)}>
            <Sparkles size={15} />
            AI 记忆解析
          </button>
          <button className="missing-editor-button" onClick={() => setIsUploaderOpen(true)}>
            <ImagePlus size={15} />
            上传照片
          </button>
          <button className="missing-editor-button" onClick={() => setIsUnplacedEditorOpen(true)}>
            <MapPin size={15} />
            补充未定位照片 · {album.stats.unplaced ?? 0}
          </button>
        </div>
      </header>

      <section className="journal-frame" aria-label="travel album">
        <MapStage
          album={album}
          activeDayId={activeDay?.id ?? null}
          onSelectDay={setActiveDayId}
          onOpenDay={(day) => {
            setActiveStopId(null);
            setActiveModalDay(day);
          }}
          onOpenStop={openStop}
        />

        <aside className="itinerary-panel" aria-label="Footprint archive">
          <div className="panel-heading">
            <span>Archive</span>
            <strong>足迹 · 时期</strong>
          </div>

          <div className="day-list">
            {album.days.map((day, index) => (
              <button
                className={`day-ticket ${day.id === activeDay?.id ? "is-active" : ""}`}
                key={day.id}
                onClick={() => setActiveDayId(day.id)}
              >
                <span className="day-ticket__index">VOL {String(index + 1).padStart(2, "0")}</span>
                <span className="day-ticket__title">{day.title}</span>
                <span className="day-ticket__route">{day.subtitle}</span>
                <span className="day-ticket__stats">
                  <Camera size={13} />
                  {day.photoCount} photos · {day.stops.length} places
                </span>
              </button>
            ))}
          </div>

          {activeDay && (
            <button className="open-day-button" onClick={() => setActiveModalDay(activeDay)}>
              Open Archive Log
            </button>
          )}
        </aside>
      </section>

      {album.stats.photos === 0 && (
        <section className="empty-note">
          <strong>照片入口</strong>
          <span>把照片放到 raw/photos，然后运行 npm run album:build，再刷新页面。</span>
        </section>
      )}

      {activeModalDay && (
        <DayModal
          day={activeModalDay}
          initialStopId={activeStopId}
          onClose={() => {
            setActiveModalDay(null);
            setActiveStopId(null);
          }}
        />
      )}

      {isUnplacedEditorOpen && (
        <UnplacedEditor
          photos={album.unplacedPhotos ?? []}
          onClose={() => setIsUnplacedEditorOpen(false)}
          onSaved={(nextAlbum) => {
            setAlbum(nextAlbum);
            setActiveDayId(nextAlbum.days[0]?.id ?? null);
          }}
        />
      )}

      {isUploaderOpen && (
        <PhotoUploader
          onClose={() => setIsUploaderOpen(false)}
          onUploaded={(nextAlbum) => {
            setAlbum(nextAlbum);
            setActiveDayId(nextAlbum.days[0]?.id ?? null);
          }}
        />
      )}

      {isAiConfigOpen && (
        <AiConfigModal
          onClose={() => setIsAiConfigOpen(false)}
          onAlbumUpdated={(nextAlbum) => {
            setAlbum(nextAlbum);
            setActiveDayId(nextAlbum.days[0]?.id ?? null);
          }}
        />
      )}
    </main>
  );
}
