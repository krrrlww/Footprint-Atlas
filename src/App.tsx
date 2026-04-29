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
    fetch(`${import.meta.env.BASE_URL}album.json`, { cache: "no-store" })
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
        <div className="hero-micro">Footprint Atlas · A Living Archive of Everywhere</div>
        <h1>{album.destination}</h1>
        <p>{album.subtitle}</p>
        <div className="hero-meta" aria-label="album stats">
          <span>
            <CalendarDays size={15} />
            {album.dateRange || "尚无档案"}
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
            <span>Catalogue</span>
            <strong>旅程卷宗</strong>
          </div>

          <div className="day-list">
            {album.days.map((day, index) => (
              <button
                className={`day-ticket ${day.id === activeDay?.id ? "is-active" : ""}`}
                key={day.id}
                onClick={() => setActiveDayId(day.id)}
                style={{ animationDelay: `${0.3 + index * 0.06}s` }}
              >
                {day.stops[0]?.photos[0] && (
                  <img className="day-ticket__thumb" src={day.stops[0].photos[0].thumb} alt="" />
                )}
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
              展开此卷
            </button>
          )}
        </aside>
      </section>

      {album.stats.photos === 0 && (
        <section className="empty-note">
          <strong>开始建档</strong>
          <span>将照片置入 raw/photos，执行 npm run album:build 即可生成足迹地图。</span>
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
