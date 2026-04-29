import { useState, useEffect } from "react";
import { X, Sparkles, Loader2, CheckCircle } from "lucide-react";
import type { TravelAlbum } from "../types/album";

export type AiConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  textBaseURL: string;
  textApiKey: string;
  textModel: string;
};

export const DEFAULT_AI_CONFIG: AiConfig = {
  baseURL: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-chat",
  textBaseURL: "",
  textApiKey: "",
  textModel: "",
};

export function getAiConfig(): AiConfig {
  const saved = localStorage.getItem("atlas_ai_config");
  if (!saved) return DEFAULT_AI_CONFIG;
  return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
}

export function saveAiConfig(config: AiConfig) {
  localStorage.setItem("atlas_ai_config", JSON.stringify(config));
}

type AiConfigModalProps = {
  onClose: () => void;
  onAlbumUpdated: (album: TravelAlbum) => void;
};

export function AiConfigModal({ onClose, onAlbumUpdated }: AiConfigModalProps) {
  const [config, setConfig] = useState<AiConfig>(getAiConfig);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [isDone, setIsDone] = useState(false);

  const updateConfig = (updates: Partial<AiConfig>) => {
    const next = { ...config, ...updates };
    setConfig(next);
    saveAiConfig(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRunning) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, isRunning]);

  const runEnrichment = async () => {
    if (!config.apiKey) {
      setProgress("请先填写 API Key。");
      return;
    }

    setIsRunning(true);
    setIsDone(false);
    setProgress("正在启动 AI 记忆解析（视觉模型读取照片中...）");

    try {
      const resp = await fetch("/api/ai-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      });

      const data = await resp.json() as { ok?: boolean; album?: TravelAlbum; stats?: string; error?: string; log?: string[] };
      if (!resp.ok || !data.ok) throw new Error(data.error || "AI enrichment failed");
      if (data.log?.length) console.log("[AI enrichment log]", data.log.join("\n"));

      setProgress(data.stats || "完成！");
      setIsDone(true);
      if (data.album) onAlbumUpdated(data.album);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "生成失败";
      const errorLines = raw.split("\n").filter(l => l.includes("ERROR") || l.includes("error") || l.includes("Check"));
      setProgress(errorLines.length > 0 ? errorLines[0] : raw.split("\n")[0]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="AI 记忆解析">
      <div className="upload-paper" style={{ maxWidth: 680 }}>
        <button className="modal-close" onClick={onClose} disabled={isRunning}>
          <X size={13} />
          Close · Esc
        </button>

        <header className="upload-paper__header">
          <span>MEMORY CAPSULE</span>
          <h2>AI 记忆解析</h2>
          <p>视觉模型会逐张阅读你的照片，理解画面内容，然后为每个足迹点写下诗意标题、手账旁注、氛围标签，为每段旅程写一封寄给未来自己的明信片。</p>
        </header>

        <div className="unplaced-list">
          <article className="unplaced-card" style={{ display: "grid", gap: 18, padding: "24px 20px", gridTemplateColumns: "1fr" }}>
            <label>
              <span>API 地址</span>
              <input
                type="text"
                value={config.baseURL}
                onChange={(e) => updateConfig({ baseURL: e.target.value })}
                placeholder="https://api.deepseek.com"
              />
            </label>

            <label>
              <span>视觉模型名称</span>
              <input
                type="text"
                value={config.model}
                onChange={(e) => updateConfig({ model: e.target.value })}
                placeholder="deepseek-chat"
              />
              <span className="ai-config-hint">需要支持图片输入的模型，如 deepseek-chat、gpt-4o、moonshot-v1-128k-vision-preview 等。</span>
            </label>

            <label>
              <span>API 密钥</span>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
              />
              <span className="ai-config-hint">密钥仅存储在浏览器本地，不会上传到任何服务器。</span>
            </label>

            <details className="ai-config-details">
              <summary>纯文本模型（可选，用于生成叙事，节省视觉模型开销）</summary>
              <div className="ai-config-details__body">
                <label>
                  <span>文本模型 API 地址</span>
                  <input
                    type="text"
                    value={config.textBaseURL}
                    onChange={(e) => updateConfig({ textBaseURL: e.target.value })}
                    placeholder="留空则与视觉模型相同"
                  />
                </label>
                <label>
                  <span>文本模型名称</span>
                  <input
                    type="text"
                    value={config.textModel}
                    onChange={(e) => updateConfig({ textModel: e.target.value })}
                    placeholder="留空则与视觉模型相同"
                  />
                </label>
                <label>
                  <span>文本模型 API 密钥</span>
                  <input
                    type="password"
                    value={config.textApiKey}
                    onChange={(e) => updateConfig({ textApiKey: e.target.value })}
                    placeholder="留空则与视觉模型相同"
                  />
                </label>
              </div>
            </details>
          </article>
        </div>

        <footer className="unplaced-actions">
          <span>
            {isDone && <CheckCircle size={14} style={{ verticalAlign: "middle", marginRight: 4, color: "#5c6f3b" }} />}
            {progress || (config.apiKey ? "配置已保存，点击右侧按钮开始生成。" : "请填写 API Key。")}
          </span>
          <button onClick={runEnrichment} disabled={isRunning || !config.apiKey}>
            {isRunning ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {isRunning ? "正在生成..." : "生成记忆胶囊"}
          </button>
        </footer>
      </div>
    </div>
  );
}
