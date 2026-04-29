import { useEffect, useMemo, useRef } from "react";
import { X, Feather, Mail } from "lucide-react";
import { formatStopCounter } from "../lib/album";
import type { AlbumDay, TimelineStop } from "../types/album";

type DayModalProps = {
  day: AlbumDay;
  initialStopId: string | null;
  onClose: () => void;
};

export function DayModal({ day, initialStopId, onClose }: DayModalProps) {
  const stopRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dateParts = day.dateLabel.split(".");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!initialStopId) return;
    requestAnimationFrame(() => {
      stopRefs.current[initialStopId]?.scrollIntoView({ block: "center" });
    });
  }, [initialStopId]);

  const featuredPhotos = useMemo(
    () => day.stops.flatMap((stop) => stop.photos.slice(0, 2)).slice(0, 8),
    [day.stops]
  );

  const narrative = day.narrative;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${day.title} detail`}>
      <div className="day-paper">
        <button className="modal-close" onClick={onClose}>
          <X size={13} />
          Close · Esc
        </button>

        <div className="day-paper__stamp">
          <span>{dateParts[0] || "YEAR"}</span>
          <strong>{dateParts[1] || day.dateLabel}</strong>
          <em>{day.weekday}</em>
        </div>

        <header className="day-paper__header">
          <span>{day.weekday} · {day.dateLabel}</span>
          <h2>{narrative?.title || day.title}</h2>
          <p>{day.subtitle}</p>
          {narrative ? (
            <div className="narrative-story">
              <Feather size={14} />
              {narrative.story}
            </div>
          ) : (
            <div>{day.summary}</div>
          )}
        </header>

        {featuredPhotos.length > 0 && (
          <div className="cover-film" aria-label="featured photos">
            {featuredPhotos.map((photo, index) => (
              <img key={`${photo.id}-${index}`} src={photo.thumb} alt={photo.fileName} loading="lazy" />
            ))}
          </div>
        )}

        {narrative?.postcard && (
          <div className="postcard">
            <div className="postcard__header">
              <Mail size={13} />
              <span>POSTCARD</span>
            </div>
            <p>{narrative.postcard}</p>
            <div className="postcard__date">{day.dateLabel}</div>
          </div>
        )}

        <div className="stop-log">
          {day.stops.map((stop) => (
            <StopEntry
              key={stop.id}
              stop={stop}
              isFocused={stop.id === initialStopId}
              refSetter={(element) => {
                stopRefs.current[stop.id] = element;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type StopEntryProps = {
  stop: TimelineStop;
  isFocused: boolean;
  refSetter: (element: HTMLDivElement | null) => void;
};

function StopEntry({ stop, isFocused, refSetter }: StopEntryProps) {
  const capsule = stop.capsule;

  return (
    <article className={`stop-entry ${isFocused ? "is-focused" : ""}`} ref={refSetter}>
      <div className="stop-entry__number">{formatStopCounter(stop.index)}</div>
      <div className="stop-entry__content">
        <div className="stop-entry__meta">
          <span>{stop.type}</span>
          <i />
          <span>{stop.time}</span>
          {capsule?.mood && (
            <>
              <i />
              <span className="stop-entry__mood">{capsule.mood}</span>
            </>
          )}
        </div>
        <h3>{capsule?.poeticTitle || stop.title}</h3>
        {capsule && <p className="stop-entry__location">{stop.title}</p>}
        {capsule?.scene && <p className="stop-entry__scene">{capsule.scene}</p>}
        <p className="stop-entry__subtitle">{stop.subtitle}</p>

        {capsule?.journalNote && (
          <blockquote className="capsule-journal">
            {capsule.journalNote}
          </blockquote>
        )}

        {!capsule && <p>{stop.description}</p>}

        {capsule && (
          <div className="capsule-footer">
            {capsule.colors?.length > 0 && (
              <div className="capsule-colors">
                {capsule.colors.map((c) => (
                  <span key={c} className="capsule-color" style={{ background: c }} title={c} />
                ))}
              </div>
            )}
            {capsule.tags?.length > 0 && (
              <div className="capsule-tags">
                {capsule.tags.map((t) => (
                  <span key={t} className="capsule-tag">#{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {stop.photos.length > 0 && (
          <div className="filmstrip">
            {stop.photos.slice(0, 9).map((photo, index) => (
              <figure key={photo.id}>
                <img src={photo.thumb} alt={photo.fileName} loading="lazy" />
                <figcaption>{String(index + 1).padStart(2, "0")} · {(capsule?.poeticTitle || stop.title).replace(/\s\d+$/, "")}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
