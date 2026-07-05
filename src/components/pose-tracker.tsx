"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileVideo, Info, Loader2, Camera, CameraOff, RotateCcw,
  Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  LANDMARK_NAMES, BODY_CONNECTIONS, BODY_PARTS,
  type BodyPartKey,
} from "@/lib/pose-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

// MoveNet model URLs (TensorFlow Hub - reliable CDN)
// Correct TFHub URL for tf.js models
const MODEL_URL = "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4";

// Lazy-loaded TF.js references
let tfModule: typeof import("@tensorflow/tfjs") | null = null;

async function loadTf() {
  if (!tfModule) {
    tfModule = await import("@tensorflow/tfjs");
    await tfModule.ready();
  }
  return tfModule;
}

// Keypoint indices for MoveNet output
// MoveNet outputs [y, x, score, visibility] for each of 17 keypoints
const MOVENET_KEYPOINTS = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip",
  "left_knee", "right_knee", "left_ankle", "right_ankle",
];

type TrackingStatus = "idle" | "loading-tf" | "loading-model" | "loading-camera" | "running" | "error";

interface LandmarkData {
  x: number; y: number; score: number;
  name: string; nameRu: string;
}

interface BodyPartVisibility {
  head: boolean; torso: boolean;
  leftArm: boolean; rightArm: boolean;
  leftLeg: boolean; rightLeg: boolean;
}

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingStep, setLoadingStep] = useState("");
  const [fps, setFps] = useState(0);
  const [landmarks, setLandmarks] = useState<LandmarkData[] | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<number | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [minScore, setMinScore] = useState(0.25);
  const [partVisibility, setPartVisibility] = useState<BodyPartVisibility>({
    head: true, torso: true, leftArm: true, rightArm: true, leftLeg: true, rightLeg: true,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const frameTimestamps = useRef<number[]>([]);

  const calculateFps = useCallback(() => {
    const now = performance.now();
    frameTimestamps.current.push(now);
    if (frameTimestamps.current.length > 30) frameTimestamps.current.shift();
    if (frameTimestamps.current.length >= 2) {
      const el = frameTimestamps.current[frameTimestamps.current.length - 1] - frameTimestamps.current[0];
      setFps(Math.round(((frameTimestamps.current.length - 1) / el) * 1000));
    }
  }, []);

  const detectCameras = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const vd = devs.filter(d => d.kind === "videoinput");
      setCameraDevices(vd);
      if (vd.length > 0 && !selectedCamera) setSelectedCamera(vd[0].deviceId);
    } catch { /* */ }
  }, [selectedCamera]);

  const initModel = useCallback(async () => {
    setLoadingStep("Инициализация TensorFlow.js...");
    setStatus("loading-tf");
    const tf = await loadTf();

    setLoadingStep("Загрузка модели MoveNet...");
    setStatus("loading-model");

    let model;
    try {
      model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
    } catch (modelErr) {
      // Fallback: try alternate URL format
      console.warn("Primary model URL failed, trying fallback...", modelErr);
      model = await tf.loadGraphModel(
        "https://tfhub.dev/google/movenet/singlepose/lightning/4",
        { fromTFHub: true }
      );
    }

    // Warm up the model with a dummy input
    const dummy = tf.zeros([1, 192, 192, 3]);
    const warmup = model.execute(dummy);
    (warmup as any).dispose();
    dummy.dispose();

    return model;
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      const c: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      };
      const s = await navigator.mediaDevices.getUserMedia(c);
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      return true;
    } catch { return false; }
  }, []);

  const drawResults = useCallback(
    (keypoints: LandmarkData[], canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (showSkeleton) {
        for (const conn of BODY_CONNECTIONS) {
          const s = keypoints[conn.start];
          const e = keypoints[conn.end];
          if (!s || !e || s.score < minScore || e.score < minScore) continue;
          const sp = Object.entries(BODY_PARTS).find(([, p]) => p.landmarks.includes(conn.start));
          const ep = Object.entries(BODY_PARTS).find(([, p]) => p.landmarks.includes(conn.end));
          if (sp && !partVisibility[sp[0] as BodyPartKey]) continue;
          if (ep && !partVisibility[ep[0] as BodyPartKey]) continue;
          const sx = s.x * canvas.width, sy = s.y * canvas.height;
          const ex = e.x * canvas.width, ey = e.y * canvas.height;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.strokeStyle = conn.color;
          ctx.lineWidth = conn.width;
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.85;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (showLandmarks) {
        for (let i = 0; i < keypoints.length; i++) {
          const kp = keypoints[i];
          if (!kp || kp.score < minScore) continue;
          const part = Object.entries(BODY_PARTS).find(([, p]) => p.landmarks.includes(i));
          if (part && !partVisibility[part[0] as BodyPartKey]) continue;
          const lmInfo = LANDMARK_NAMES[i];
          if (!lmInfo) continue;
          const x = kp.x * canvas.width, y = kp.y * canvas.height;

          ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = lmInfo.color + "30"; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = lmInfo.color; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();

          if (showLabels && i === selectedLandmark) {
            const text = `${lmInfo.nameRu} (${(kp.x * 100).toFixed(0)}%, ${(kp.y * 100).toFixed(0)}%)`;
            ctx.font = "bold 13px system-ui, sans-serif";
            const m = ctx.measureText(text);
            const pad = 6, bx = x + 14, by = y - 24;
            ctx.fillStyle = "rgba(0,0,0,0.8)";
            ctx.beginPath(); ctx.roundRect(bx - pad, by - pad, m.width + pad * 2, 20 + pad, 6); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.fillText(text, bx, by + 10);
          }
        }
      }
    },
    [showSkeleton, showLandmarks, showLabels, selectedLandmark, minScore, partVisibility]
  );

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;
    const tf = tfModule;
    if (!video || !canvas || !model || !tf || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }

    try {
      // Preprocess: crop and resize to 192x192
      const img = tf.browser.fromPixels(video);
      const [h, w] = [img.shape[0], img.shape[1]];
      const pads = tf.tidy(() => {
        const maxDim = Math.max(h, w);
        const padH = maxDim - h;
        const padW = maxDim - w;
        const top = Math.floor(padH / 2);
        const bottom = padH - top;
        const left = Math.floor(padW / 2);
        const right = padW - left;
        return [top, bottom, left, right];
      });
      const padded = tf.pad3d(img as any, [[pads[0], pads[1]], [pads[2], pads[3]], [0, 0]]);
      const cropped = tf.image.resizeBilinear(padded, [192, 192]);
      const batched = cropped.expandDims(0).toFloat();

      const output = model.execute(batched) as any;
      const data = (output.dataSync() as Float32Array).slice();
      output.dispose();
      batched.dispose();
      cropped.dispose();
      padded.dispose();
      img.dispose();

      // Parse output: [1, 1, 17, 3] -> y, x, score per keypoint
      const kps: LandmarkData[] = [];
      for (let i = 0; i < 17; i++) {
        const yi = i * 3;
        const yNorm = data[yi];
        const xNorm = data[yi + 1];
        const score = data[yi + 2];
        const lmInfo = LANDMARK_NAMES[i];
        kps.push({
          x: xNorm,
          y: yNorm,
          score: Math.max(0, Math.min(1, score)),
          name: lmInfo?.name ?? MOVENET_KEYPOINTS[i],
          nameRu: lmInfo?.nameRu ?? MOVENET_KEYPOINTS[i],
        });
      }

      setLandmarks(kps);
      drawResults(kps, canvas);
      calculateFps();
    } catch (err) {
      console.error("Detection error:", err);
    }

    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [drawResults, calculateFps]);

  const startTracking = useCallback(async () => {
    setErrorMsg("");
    try {
      const model = await initModel();
      modelRef.current = model;
      setStatus("loading-camera");
      await detectCameras();
      const ok = await startCamera(selectedCamera || undefined);
      if (!ok) throw new Error("Не удалось получить доступ к камере. Разрешите доступ в браузере.");
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 640;
        canvasRef.current.height = videoRef.current.videoHeight || 480;
      }
      setStatus("running");
      setLoadingStep("");
      animFrameRef.current = requestAnimationFrame(runDetection);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Неизвестная ошибка");
      setStatus("error");
    }
  }, [initModel, detectCameras, startCamera, selectedCamera, runDetection]);

  const stopTracking = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) { const c = canvasRef.current.getContext("2d"); if (c) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
    if (modelRef.current) { modelRef.current.dispose(); modelRef.current = null; }
    setLandmarks(null); setFps(0); setLoadingStep(""); setStatus("idle");
  }, []);

  const restartTracking = useCallback(() => { stopTracking(); setTimeout(() => startTracking(), 300); }, [stopTracking, startTracking]);
  useEffect(() => () => stopTracking(), [stopTracking]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!landmarks || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width / r.width, sy = canvasRef.current.height / r.height;
    const cx = (e.clientX - r.left) * sx, cy = (e.clientY - r.top) * sy;
    let best = -1, dist = Infinity;
    for (let i = 0; i < landmarks.length; i++) {
      if (landmarks[i].score < minScore) continue;
      const dx = landmarks[i].x * canvasRef.current!.width - cx;
      const dy = landmarks[i].y * canvasRef.current!.height - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < dist && d < 40) { dist = d; best = i; }
    }
    setSelectedLandmark(best >= 0 ? best : null);
  }, [landmarks, minScore]);

  const togglePart = useCallback((p: BodyPartKey) => setPartVisibility(v => ({ ...v, [p]: !v[p] })), []);
  const isLoading = ["loading-tf", "loading-model", "loading-camera"].includes(status);

  const stMap: Record<TrackingStatus, { l: string; c: string; i: React.ReactNode }> = {
    idle: { l: "Ожидание", c: "bg-zinc-500", i: <Camera className="h-4 w-4" /> },
    "loading-tf": { l: "Инициализация...", c: "bg-amber-500", i: <Loader2 className="h-4 w-4 animate-spin" /> },
    "loading-model": { l: "Загрузка модели...", c: "bg-amber-500", i: <Loader2 className="h-4 w-4 animate-spin" /> },
    "loading-camera": { l: "Камера...", c: "bg-amber-500", i: <Loader2 className="h-4 w-4 animate-spin" /> },
    running: { l: "Трекинг", c: "bg-emerald-500", i: <Camera className="h-4 w-4" /> },
    error: { l: "Ошибка", c: "bg-red-500", i: <CameraOff className="h-4 w-4" /> },
  };
  const st = stMap[status];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Отслеживание позы</h1>
          <p className="text-muted-foreground mt-1">Реалтайм-трекинг тела через камеру — MoveNet AI (TensorFlow.js)</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">{st.i}<span>{st.l}</span><span className={`ml-1.5 h-2 w-2 rounded-full ${st.c}`} /></Badge>
          {status === "running" && <Badge variant="secondary" className="font-mono tabular-nums">{fps} FPS</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative bg-black aspect-video w-full">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" playsInline muted />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100 cursor-crosshair" onClick={handleCanvasClick} />
                {status === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white gap-4 z-10">
                    <div className="rounded-full bg-zinc-800 p-6"><Camera className="h-12 w-12 text-zinc-400" /></div>
                    <p className="text-lg font-medium text-zinc-200">Камера не подключена</p>
                    <p className="text-sm text-zinc-500">Нажмите &laquo;Начать трекинг&raquo; для запуска</p>
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white gap-4 z-10">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                    <p className="text-sm text-zinc-300">{loadingStep}</p>
                    <div className="w-48"><Progress value={status === "loading-tf" ? 25 : status === "loading-model" ? 65 : 85} className="h-2" /></div>
                  </div>
                )}
                {status === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white gap-4 z-10">
                    <div className="rounded-full bg-red-900/30 p-6"><CameraOff className="h-10 w-10 text-red-400" /></div>
                    <p className="text-lg font-medium text-red-300">Ошибка</p>
                    <p className="text-sm text-zinc-400 max-w-sm">{errorMsg}</p>
                  </div>
                )}
                {status === "running" && <div className="absolute top-3 left-3 z-20"><Badge variant="secondary" className="bg-black/60 text-white border-0 font-mono text-xs backdrop-blur-sm">{fps} FPS</Badge></div>}
                {status === "running" && !landmarks && <div className="absolute bottom-3 left-3 z-20"><Badge variant="secondary" className="bg-black/60 text-amber-300 border-0 text-xs backdrop-blur-sm">Встаньте перед камерой</Badge></div>}
                {status === "running" && landmarks && <div className="absolute bottom-3 left-3 z-20"><Badge variant="secondary" className="bg-black/60 text-emerald-300 border-0 text-xs backdrop-blur-sm">✓ 17 точек отслеживаются</Badge></div>}
              </div>
            </CardContent>
          </Card>
          <Card><CardContent className="p-4"><div className="flex flex-wrap items-center gap-3">
            {status !== "running" && status !== "loading-tf" && status !== "loading-model" && status !== "loading-camera" ? (
              <Button onClick={startTracking} className="gap-2" size="lg"><Camera className="h-4 w-4" />Начать трекинг</Button>
            ) : (
              <Button onClick={stopTracking} variant="destructive" className="gap-2" size="lg"><CameraOff className="h-4 w-4" />Остановить</Button>
            )}
            {status === "running" && <Button onClick={restartTracking} variant="outline" className="gap-2" size="lg"><RotateCcw className="h-4 w-4" />Перезапустить</Button>}
            {cameraDevices.length > 1 && (
              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)} disabled={status === "running"}>
                {cameraDevices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Камера ${i + 1}`}</option>)}
              </select>
            )}
          </div></CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Отображение</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="flex items-center justify-between"><Label className="text-sm">Скелет</Label><Switch checked={showSkeleton} onCheckedChange={setShowSkeleton} /></div>
            <div className="flex items-center justify-between"><Label className="text-sm">Точки</Label><Switch checked={showLandmarks} onCheckedChange={setShowLandmarks} /></div>
            <div className="flex items-center justify-between"><Label className="text-sm">Подписи</Label><Switch checked={showLabels} onCheckedChange={setShowLabels} /></div>
          </CardContent></Card>

          <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" />Части тела</CardTitle></CardHeader><CardContent className="space-y-2.5">
            {(Object.entries(BODY_PARTS) as [BodyPartKey, (typeof BODY_PARTS)[BodyPartKey]][]).map(([k, p]) => (
              <div key={k} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} /><span className="text-sm">{p.label}</span></div>
                <Switch checked={partVisibility[k]} onCheckedChange={() => togglePart(k)} />
              </div>
            ))}
          </CardContent></Card>

          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Чувствительность</CardTitle></CardHeader><CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between"><Label className="text-sm">Мин. уверенность</Label><span className="text-xs text-muted-foreground font-mono">{(minScore * 100).toFixed(0)}%</span></div>
              <Slider value={[minScore * 100]} onValueChange={v => setMinScore(v[0] / 100)} min={5} max={80} step={5} />
            </div>
          </CardContent></Card>

          {selectedLandmark !== null && landmarks && (
            <Card className="border-emerald-500/30"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Info className="h-4 w-4 text-emerald-500" />Точка</CardTitle></CardHeader><CardContent className="space-y-2">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: LANDMARK_NAMES[selectedLandmark]?.color }} /><span className="font-medium text-sm">{LANDMARK_NAMES[selectedLandmark]?.nameRu}</span></div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>EN: {LANDMARK_NAMES[selectedLandmark]?.name}</p><p>Индекс: {selectedLandmark}</p>
                {landmarks[selectedLandmark] && <><p>X: {(landmarks[selectedLandmark].x * 100).toFixed(1)}%</p><p>Y: {(landmarks[selectedLandmark].y * 100).toFixed(1)}%</p><p>Уверенность: {((landmarks[selectedLandmark].score) * 100).toFixed(0)}%</p></>}
              </div>
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setShowDetails(!showDetails)}>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><FileVideo className="h-4 w-4" />Координаты</span>
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardTitle>
            </CardHeader>
            {showDetails && <CardContent className="p-0"><ScrollArea className="max-h-64"><div className="px-4 pb-4 space-y-0.5">
              {landmarks ? LANDMARK_NAMES.map(lm => { const d = landmarks[lm.index]; if (!d) return null; return (
                <div key={lm.index} className="flex items-center justify-between py-1 text-xs hover:bg-muted/50 rounded px-1 cursor-pointer" onClick={() => setSelectedLandmark(lm.index)}>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: lm.color, opacity: d.score < minScore ? 0.3 : 1 }} /><span className={d.score < minScore ? "text-muted-foreground/50" : ""}>{lm.nameRu}</span></div>
                  <span className="font-mono text-muted-foreground ml-2">{(d.x * 100).toFixed(0)}%, {(d.y * 100).toFixed(0)}%</span>
                </div>);
              }) : <p className="text-xs text-muted-foreground py-4 text-center">Запустите трекинг</p>}
            </div></ScrollArea></CardContent>}
          </Card>
        </div>
      </div>

      <Card className="bg-muted/30"><CardContent className="p-4"><div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Как работает:</strong> <strong>MoveNet</strong> (Google TensorFlow Hub) — опенсорс AI-модель, отслеживающая 17 точек тела в реальном времени в браузере.</p>
          <p><strong>Отслеживается:</strong> нос, глаза, уши, плечи, локти, запястья, бёдра, колени, лодыжки. Кликните на точку для деталей.</p>
          <p><strong>Стек:</strong> TypeScript + React + TensorFlow.js + MoveNet + Canvas. Данные не покидают ваш браузер.</p>
        </div>
      </div></CardContent></Card>
    </div>
  );
}