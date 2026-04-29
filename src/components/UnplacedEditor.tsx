import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MapPin, Search, X } from "lucide-react";
import type { MediaItem, TravelAlbum } from "../types/album";

type GeocodeResult = {
  placeName: string;
  latitude: number;
  longitude: number;
  type: string;
};

type EditablePhoto = {
  fileName: string;
  thumb: string;
  takenAt: string;
  query: string;
  placeName: string;
  latitude: number | null;
  longitude: number | null;
  results: GeocodeResult[];
  isSearching: boolean;
};

type UnplacedEditorProps = {
  photos: MediaItem[];
  onClose: () => void;
  onSaved: (album: TravelAlbum) => void;
};

export function UnplacedEditor({ photos, onClose, onSaved }: UnplacedEditorProps) {
  const [items, setItems] = useState<EditablePhoto[]>(() =>
    photos.map((photo) => ({
      fileName: photo.fileName,
      thumb: photo.thumb,
      takenAt: isoToLocalInput(photo.takenAt),
      query: "",
      placeName: "",
      latitude: null,
      longitude: null,
      results: [],
      isSearching: false
    }))
  );
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const completeCount = useMemo(
    () => items.filter((item) => item.latitude !== null && item.longitude !== null && item.takenAt).length,
    [items]
  );

  const updateItem = (fileName: string, patch: Partial<EditablePhoto>) => {
    setItems((current) => current.map((item) => (item.fileName === fileName ? { ...item, ...patch } : item)));
  };

  const searchPlace = async (item: EditablePhoto) => {
    const query = item.query.trim();
    if (!query) {
      setMessage("先输入一个地点，比如「成都太古里」或「青海湖」。");
      return;
    }

    updateItem(item.fileName, { isSearching: true, results: [] });
    setMessage("");

    try {
      const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { results?: GeocodeResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "地点搜索失败");
      updateItem(item.fileName, { results: payload.results ?? [], isSearching: false });
      if ((payload.results ?? []).length === 0) {
        setMessage("没有搜到地点，可以试试更具体的城市、景点或店名。");
      }
    } catch (error) {
      updateItem(item.fileName, { isSearching: false });
      setMessage(error instanceof Error ? error.message : "地点搜索失败");
    }
  };

  const save = async () => {
    const overrides = Object.fromEntries(
      items
        .filter((item) => item.latitude !== null && item.longitude !== null && item.takenAt)
        .map((item) => [
          item.fileName,
          {
            placeName: item.placeName || item.query,
            latitude: item.latitude,
            longitude: item.longitude,
            takenAt: localInputToIso(item.takenAt)
          }
        ])
    );

    if (Object.keys(overrides).length === 0) {
      setMessage("至少先给一张照片选择地点并确认拍摄时间。");
      return;
    }

    setIsSaving(true);
    setMessage("正在保存并重新生成足迹地图...");

    try {
      const response = await fetch("/api/manual-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides })
      });
      const payload = (await response.json()) as { album?: TravelAlbum; error?: string };
      if (!response.ok || !payload.album) throw new Error(payload.error || "保存失败");
      onSaved(payload.album);
      setMessage("已保存。");
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="补充未定位照片">
      <div className="unplaced-paper">
        <button className="modal-close" onClick={onClose}>
          <X size={13} />
          Close · Esc
        </button>

        <header className="unplaced-paper__header">
          <span>UNPLACED PHOTOS</span>
          <h2>补充地点</h2>
          <p>未获取到 GPS 的照片不会出现在地图上。给它们补地点和拍摄时间后，会自动转成经纬度并重新生成足迹。</p>
        </header>

        {photos.length === 0 ? (
          <div className="unplaced-empty">
            <Check size={20} />
            所有照片都有位置信息。
          </div>
        ) : (
          <div className="unplaced-list">
            {items.map((item) => (
              <article className="unplaced-card" key={item.fileName}>
                <img src={item.thumb} alt={item.fileName} />
                <div className="unplaced-card__body">
                  <div className="unplaced-card__title">{item.fileName}</div>

                  <label>
                    <span>地点</span>
                    <div className="place-search">
                      <input
                        value={item.query}
                        onChange={(event) => updateItem(item.fileName, { query: event.target.value })}
                        placeholder="输入城市、景点、店名"
                      />
                      <button onClick={() => searchPlace(item)} disabled={item.isSearching}>
                        {item.isSearching ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
                      </button>
                    </div>
                  </label>

                  {item.results.length > 0 && (
                    <div className="geocode-results">
                      {item.results.map((result) => (
                        <button
                          key={`${result.latitude}-${result.longitude}-${result.placeName}`}
                          onClick={() =>
                            updateItem(item.fileName, {
                              placeName: result.placeName,
                              query: result.placeName,
                              latitude: result.latitude,
                              longitude: result.longitude,
                              results: []
                            })
                          }
                        >
                          <MapPin size={13} />
                          <span>{result.placeName}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <label>
                    <span>拍摄时间</span>
                    <input
                      type="datetime-local"
                      value={item.takenAt}
                      onChange={(event) => updateItem(item.fileName, { takenAt: event.target.value })}
                    />
                  </label>

                  <label>
                    <span>经纬度</span>
                    <div className="coord-grid">
                      <input
                        type="number"
                        step="0.000001"
                        value={item.latitude ?? ""}
                        onChange={(event) => updateItem(item.fileName, { latitude: numberOrNull(event.target.value) })}
                        placeholder="纬度"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={item.longitude ?? ""}
                        onChange={(event) => updateItem(item.fileName, { longitude: numberOrNull(event.target.value) })}
                        placeholder="经度"
                      />
                    </div>
                  </label>

                  {item.latitude !== null && item.longitude !== null && (
                    <div className="selected-place">
                      <Check size={14} />
                      {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="unplaced-actions">
          <span>{message || `${completeCount} / ${items.length} 张已准备保存`}</span>
          <button onClick={save} disabled={isSaving || photos.length === 0}>
            {isSaving ? <Loader2 size={15} className="spin" /> : <MapPin size={15} />}
            保存并更新地图
          </button>
        </footer>
      </div>
    </div>
  );
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

function numberOrNull(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
