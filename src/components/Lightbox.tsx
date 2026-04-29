import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MediaItem } from "../types/album";

type LightboxProps = {
  photos: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function Lightbox({ photos, currentIndex, onClose, onNavigate }: LightboxProps) {
  const photo = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.fileName} draggable={false} />
        <div className="lightbox__caption">
          <span>{photo.fileName}</span>
          <span>
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      </div>

      {hasPrev && (
        <button className="lightbox__nav lightbox__nav--prev" onClick={goPrev} aria-label="Previous">
          <ChevronLeft size={28} />
        </button>
      )}
      {hasNext && (
        <button className="lightbox__nav lightbox__nav--next" onClick={goNext} aria-label="Next">
          <ChevronRight size={28} />
        </button>
      )}

      <button className="lightbox__close" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
    </div>
  );
}
