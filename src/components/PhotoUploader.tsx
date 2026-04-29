import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Upload, X } from "lucide-react";
import type { TravelAlbum } from "../types/album";

type PhotoUploaderProps = {
  onClose: () => void;
  onUploaded: (album: TravelAlbum) => void;
};

const ACCEPTED_IMAGE_TYPES = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"].join(",");

export function PhotoUploader({ onClose, onUploaded }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const addFiles = (nextFiles: FileList | File[]) => {
    const images = Array.from(nextFiles).filter(
      (file) => file.type.startsWith("image/") || /\.(heic|heif|tiff?)$/i.test(file.name)
    );
    setFiles((current) => mergeFiles(current, images));
    setMessage(images.length === 0 ? "没有识别到支持的图片文件。" : "");
  };

  const upload = async () => {
    if (files.length === 0) {
      setMessage("先选择一些照片。");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));
    setIsUploading(true);
    setMessage("正在保存照片并重新生成足迹地图...");

    try {
      const response = await fetch("/api/upload-photos", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        album?: TravelAlbum;
        uploaded?: Array<{ fileName: string }>;
        error?: string;
      };
      if (!response.ok || !payload.album) throw new Error(payload.error || "上传失败");

      onUploaded(payload.album);
      setMessage(`已上传 ${payload.uploaded?.length ?? files.length} 张照片。`);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="上传照片">
      <div className="upload-paper">
        <button className="modal-close" onClick={onClose}>
          <X size={13} />
          Close · Esc
        </button>

        <header className="upload-paper__header">
          <span>IMPORT PHOTOS</span>
          <h2>上传照片</h2>
          <p>选择本地照片后会保存到 raw/photos，并自动重新生成足迹地图。带 GPS 的照片会直接显示在地图上。</p>
        </header>

        <button
          className={`upload-dropzone ${isDragging ? "is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <ImagePlus size={30} />
          <strong>选择或拖入照片</strong>
          <span>支持 JPG、PNG、WebP、HEIC、TIFF，可一次选择多张</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {files.length > 0 && (
          <div className="upload-list">
            <div className="upload-list__summary">
              <Check size={14} />
              {files.length} 张 · {formatBytes(totalSize)}
            </div>
            {files.slice(0, 12).map((file) => (
              <div className="upload-file" key={`${file.name}-${file.size}-${file.lastModified}`}>
                <span>{file.name}</span>
                <em>{formatBytes(file.size)}</em>
              </div>
            ))}
            {files.length > 12 && <div className="upload-file">还有 {files.length - 12} 张照片</div>}
          </div>
        )}

        <footer className="unplaced-actions">
          <span>{message || "上传后会自动运行 album:build 并刷新页面数据。"}</span>
          <button onClick={upload} disabled={isUploading || files.length === 0}>
            {isUploading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            上传并更新地图
          </button>
        </footer>
      </div>
    </div>
  );
}

function mergeFiles(current: File[], next: File[]) {
  const seen = new Set(current.map(fileKey));
  const merged = [...current];

  for (const file of next) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }

  return merged;
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
