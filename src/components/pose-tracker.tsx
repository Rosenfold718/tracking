"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileVideo, Info, Loader2, Camera, CameraOff, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  type NormalizedLandmark,
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import {
  LANDMARK_NAMES,
  BODY_CONNECTIONS,
  BODY_PARTS,
  POSE_MODEL_URL,
  type BodyPartKey,
} from "@/lib/pose-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

type TrackingStatus = "idle" | "loading-model" | "loading-camera" | "running" | "error";

interface BodyPartVisibility {
  head: boolean;
  torso: boolean;
  leftArm: boolean;
  rightArm: boolean;
  leftLeg: boolean;
  rightLeg: boolean;
}

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(-1);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [fps, setFps] = useState(0);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<number | null>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [minDetectionConfidence, setMinDetectionConfidence] = useState(0.5);
  const [minTrackingConfidence, setMinTrackingConfidence] = useState(0.5);
  const [partVisibility, setPartVisibility] = useState<BodyPartVisibility>({
    head: true,
    torso: true,
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [modelLoadingProgress, setModelLoadingProgress] = useState(0);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");

  // FPS calculation
  const frameTimestamps = useRef<number[]>([]);

  const calculateFps = useCallback(() => {
    const now = performance.now();
    frameTimestamps.current.push(now);
    // Keep only the last 30 frames
    if (frameTimestamps.current.length > 30) {
      frameTimestamps.current.shift();
    }
    if (frameTimestamps.current.length >= 2) {
      const elapsed = frameTimestamps.current[frameTimestamps.current.length - 1] - frameTimestamps.current[0];
      const currentFps = Math.round((frameTimestamps.current.length - 1) / (elapsed / 1000));
      setFps(currentFps);
    }
  }, []);

  // Detect available cameras
  const detectCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameraDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch {
      // Camera enumeration might not be available
    }
  }, [selectedCamera]);

  // Initialize MediaPipe Pose Landmarker
  const initPoseLandmarker = useCallback(async () => {
    try {
      setModelLoadingProgress(10);
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      setModelLoadingProgress(50);

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minDetectionConfidence,
        minTrackingConfidence,
      });
      setModelLoadingProgress(100);
      return landmarker;
    } catch (err) {
      console.error("Failed to initialize PoseLandmarker:", err);
      // Fallback to CPU delegate
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        setModelLoadingProgress(60);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minDetectionConfidence,
          minTrackingConfidence,
        });
        setModelLoadingProgress(100);
        return landmarker;
      } catch (err2) {
        console.error("Failed to initialize PoseLandmarker even with CPU:", err2);
        throw err2;
      }
    }
  }, [minDetectionConfidence, minTrackingConfidence]);

  // Start camera
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch (err) {
      console.error("Camera error:", err);
      return false;
    }
  }, []);

  // Draw skeleton and landmarks on canvas
  const drawPose = useCallback(
    (landmarksList: NormalizedLandmark[], canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawingUtils = new DrawingUtils(ctx);

      for (const poseLandmarks of landmarksList) {
        // Draw connections (skeleton lines)
        if (showSkeleton) {
          for (const connection of BODY_CONNECTIONS) {
            const startLm = poseLandmarks[connection.start];
            const endLm = poseLandmarks[connection.end];

            // Check visibility thresholds
            if (!startLm || !endLm) continue;
            if (startLm.visibility !== undefined && startLm.visibility < 0.4) continue;
            if (endLm.visibility !== undefined && endLm.visibility < 0.4) continue;

            // Check if this connection belongs to a visible body part
            const startPart = Object.entries(BODY_PARTS).find(([, part]) =>
              part.landmarks.includes(connection.start)
            );
            const endPart = Object.entries(BODY_PARTS).find(([, part]) =>
              part.landmarks.includes(connection.end)
            );

            if (startPart && endPart) {
              if (!partVisibility[startPart[0] as BodyPartKey]) continue;
              if (!partVisibility[endPart[0] as BodyPartKey]) continue;
            }

            const startX = startLm.x * canvas.width;
            const startY = startLm.y * canvas.height;
            const endX = endLm.x * canvas.width;
            const endY = endLm.y * canvas.height;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = connection.color;
            ctx.lineWidth = connection.width;
            ctx.lineCap = "round";
            ctx.globalAlpha = 0.85;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        // Draw landmarks (points)
        if (showLandmarks) {
          for (let i = 0; i < poseLandmarks.length; i++) {
            const lm = poseLandmarks[i];
            if (!lm) continue;
            if (lm.visibility !== undefined && lm.visibility < 0.4) continue;

            // Check body part visibility
            const part = Object.entries(BODY_PARTS).find(([, p]) => p.landmarks.includes(i));
            if (part && !partVisibility[part[0] as BodyPartKey]) continue;

            const x = lm.x * canvas.width;
            const y = lm.y * canvas.height;
            const lmInfo = LANDMARK_NAMES[i];

            // Outer glow
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, 2 * Math.PI);
            ctx.fillStyle = lmInfo.color + "40";
            ctx.fill();

            // Inner point
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = lmInfo.color;
            ctx.fill();

            // Border
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label
            if (showLabels && i === selectedLandmark) {
              const text = `${lmInfo.nameRu} (${(lm.x * 100).toFixed(0)}%, ${(lm.y * 100).toFixed(0)}%)`;
              ctx.font = "bold 13px system-ui, sans-serif";
              const metrics = ctx.measureText(text);
              const padding = 6;
              const bgX = x + 12;
              const bgY = y - 22;

              ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
              ctx.beginPath();
              ctx.roundRect(bgX - padding, bgY - padding, metrics.width + padding * 2, 20 + padding, 6);
              ctx.fill();

              ctx.fillStyle = "#ffffff";
              ctx.fillText(text, bgX, bgY + 10);
            }
          }
        }
      }
    },
    [showSkeleton, showLandmarks, showLabels, selectedLandmark, partVisibility]
  );

  // Animation frame callback for continuous detection
  const onFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(onFrame);
      return;
    }

    const nowInMs = performance.now();

    // Only detect if enough time has passed (throttle to ~30fps for performance)
    if (nowInMs - lastTimestampRef.current >= 16) {
      lastTimestampRef.current = nowInMs;

      try {
        const result = landmarker.detectForVideo(video, nowInMs);

        if (result.landmarks && result.landmarks.length > 0) {
          setLandmarks(result.landmarks[0]);
          drawPose(result.landmarks, canvas, video);
        } else {
          setLandmarks(null);
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        calculateFps();
      } catch (err) {
        console.error("Detection error:", err);
      }
    }

    animFrameRef.current = requestAnimationFrame(onFrame);
  }, [drawPose, calculateFps]);

  // Start tracking
  const startTracking = useCallback(async () => {
    setStatus("loading-model");
    setErrorMsg("");

    try {
      // 1. Load model
      const landmarker = await initPoseLandmarker();
      poseLandmarkerRef.current = landmarker;

      // 2. Start camera
      setStatus("loading-camera");
      await detectCameras();
      const cameraStarted = await startCamera(selectedCamera || undefined);
      if (!cameraStarted) {
        throw new Error("Не удалось получить доступ к камере. Убедитесь, что вы разрешили доступ к камере в браузере.");
      }

      // 3. Set canvas size
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 1280;
        canvasRef.current.height = videoRef.current.videoHeight || 720;
      }

      // 4. Start detection loop
      setStatus("running");
      lastTimestampRef.current = -1;
      animFrameRef.current = requestAnimationFrame(onFrame);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setErrorMsg(message);
      setStatus("error");
      console.error("Start tracking error:", err);
    }
  }, [initPoseLandmarker, detectCameras, startCamera, selectedCamera, onFrame]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    poseLandmarkerRef.current = null;
    setLandmarks(null);
    setFps(0);
    setStatus("idle");
  }, []);

  // Restart with new settings
  const restartTracking = useCallback(() => {
    stopTracking();
    setTimeout(() => startTracking(), 300);
  }, [stopTracking, startTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // Handle canvas click for landmark selection
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!landmarks || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      let closestIdx = -1;
      let closestDist = Infinity;

      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm || (lm.visibility !== undefined && lm.visibility < 0.4)) continue;
        const dx = lm.x * canvasRef.current.width - clickX;
        const dy = lm.y * canvasRef.current.height - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist && dist < 30) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      setSelectedLandmark(closestIdx >= 0 ? closestIdx : null);
    },
    [landmarks]
  );

  const toggleBodyPart = useCallback((part: BodyPartKey) => {
    setPartVisibility((prev) => ({ ...prev, [part]: !prev[part] }));
  }, []);

  const statusConfig = {
    idle: { label: "Ожидание", color: "bg-zinc-500", icon: <Camera className="h-4 w-4" /> },
    "loading-model": { label: "Загрузка модели...", color: "bg-amber-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    "loading-camera": { label: "Подключение камеры...", color: "bg-amber-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    running: { label: "Трекинг активен", color: "bg-emerald-500", icon: <Camera className="h-4 w-4" /> },
    error: { label: "Ошибка", color: "bg-red-500", icon: <CameraOff className="h-4 w-4" /> },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Отслеживание позы
          </h1>
          <p className="text-muted-foreground mt-1">
            Реалтайм-трекинг тела, рук, ног и головы через камеру с помощью MediaPipe AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            {currentStatus.icon}
            <span>{currentStatus.label}</span>
            <span className={`ml-1.5 h-2 w-2 rounded-full ${currentStatus.color}`} />
          </Badge>
          {status === "running" && (
            <Badge variant="secondary" className="font-mono tabular-nums">
              {fps} FPS
            </Badge>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera view */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative bg-black aspect-video w-full">
                {/* Video */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                  playsInline
                  muted
                />

                {/* Canvas overlay */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover -scale-x-100 cursor-crosshair"
                  onClick={handleCanvasClick}
                />

                {/* Placeholder when idle */}
                {status === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white gap-4 z-10">
                    <div className="rounded-full bg-zinc-800 p-6">
                      <Camera className="h-12 w-12 text-zinc-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-zinc-200">Камера не подключена</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Нажмите &laquo;Начать трекинг&raquo; для запуска
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {(status === "loading-model" || status === "loading-camera") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white gap-4 z-10">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                    <p className="text-sm text-zinc-300">
                      {status === "loading-model"
                        ? "Загрузка модели MediaPipe..."
                        : "Подключение к камере..."}
                    </p>
                    {status === "loading-model" && (
                      <Progress value={modelLoadingProgress} className="w-48 h-2" />
                    )}
                  </div>
                )}

                {/* Error state */}
                {status === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-white gap-4 z-10">
                    <div className="rounded-full bg-red-900/30 p-6">
                      <CameraOff className="h-10 w-10 text-red-400" />
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="text-lg font-medium text-red-300">Ошибка</p>
                      <p className="text-sm text-zinc-400 mt-1">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {/* FPS overlay when running */}
                {status === "running" && (
                  <div className="absolute top-3 left-3 z-20">
                    <Badge variant="secondary" className="bg-black/60 text-white border-0 font-mono tabular-nums text-xs backdrop-blur-sm">
                      {fps} FPS
                    </Badge>
                  </div>
                )}

                {/* No person detected */}
                {status === "running" && !landmarks && (
                  <div className="absolute bottom-3 left-3 z-20">
                    <Badge variant="secondary" className="bg-black/60 text-amber-300 border-0 text-xs backdrop-blur-sm">
                      Человек не обнаружен — встаньте перед камерой
                    </Badge>
                  </div>
                )}

                {/* Person detected */}
                {status === "running" && landmarks && (
                  <div className="absolute bottom-3 left-3 z-20">
                    <Badge variant="secondary" className="bg-black/60 text-emerald-300 border-0 text-xs backdrop-blur-sm">
                      ✓ Человек обнаружен — 33 точки отслеживаются
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                {status === "idle" || status === "error" ? (
                  <Button onClick={startTracking} className="gap-2" size="lg">
                    <Camera className="h-4 w-4" />
                    Начать трекинг
                  </Button>
                ) : (
                  <Button onClick={stopTracking} variant="destructive" className="gap-2" size="lg">
                    <CameraOff className="h-4 w-4" />
                    Остановить
                  </Button>
                )}

                {status === "running" && (
                  <Button onClick={restartTracking} variant="outline" className="gap-2" size="lg">
                    <RotateCcw className="h-4 w-4" />
                    Перезапустить
                  </Button>
                )}

                {cameraDevices.length > 1 && (
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    disabled={status === "running"}
                  >
                    {cameraDevices.map((device, i) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Камера ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar - Settings & Info */}
        <div className="space-y-4">
          {/* Visualization settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Настройки отображения</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-skeleton" className="text-sm">Скелет (линии)</Label>
                <Switch
                  id="show-skeleton"
                  checked={showSkeleton}
                  onCheckedChange={setShowSkeleton}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-landmarks" className="text-sm">Точки суставов</Label>
                <Switch
                  id="show-landmarks"
                  checked={showLandmarks}
                  onCheckedChange={setShowLandmarks}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-labels" className="text-sm">Подписи при клике</Label>
                <Switch
                  id="show-labels"
                  checked={showLabels}
                  onCheckedChange={setShowLabels}
                />
              </div>
            </CardContent>
          </Card>

          {/* Body parts toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Части тела
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(Object.entries(BODY_PARTS) as [BodyPartKey, (typeof BODY_PARTS)[BodyPartKey]][]).map(
                ([key, part]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full inline-block"
                        style={{ backgroundColor: part.color }}
                      />
                      <span className="text-sm">{part.label}</span>
                    </div>
                    <Switch
                      checked={partVisibility[key]}
                      onCheckedChange={() => toggleBodyPart(key)}
                    />
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Detection settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Чувствительность</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Мин. уверенность обнаружения</Label>
                  <span className="text-xs text-muted-foreground font-mono">{(minDetectionConfidence * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[minDetectionConfidence * 100]}
                  onValueChange={(v) => setMinDetectionConfidence(v[0] / 100)}
                  min={10}
                  max={95}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Мин. уверенность отслеживания</Label>
                  <span className="text-xs text-muted-foreground font-mono">{(minTrackingConfidence * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[minTrackingConfidence * 100]}
                  onValueChange={(v) => setMinTrackingConfidence(v[0] / 100)}
                  min={10}
                  max={95}
                  step={5}
                />
              </div>
              {status === "running" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={restartTracking}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Применить
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Selected landmark info */}
          {selectedLandmark !== null && landmarks && (
            <Card className="border-emerald-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-500" />
                  Выбранная точка
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full inline-block"
                    style={{ backgroundColor: LANDMARK_NAMES[selectedLandmark].color }}
                  />
                  <span className="font-medium text-sm">{LANDMARK_NAMES[selectedLandmark].nameRu}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Английское название: {LANDMARK_NAMES[selectedLandmark].name}</p>
                  <p>Индекс: {selectedLandmark}</p>
                  {landmarks[selectedLandmark] && (
                    <>
                      <p>X: {(landmarks[selectedLandmark].x * 100).toFixed(1)}%</p>
                      <p>Y: {(landmarks[selectedLandmark].y * 100).toFixed(1)}%</p>
                      <p>Z (глубина): {landmarks[selectedLandmark].z?.toFixed(3) || "N/A"}</p>
                      <p>Видимость: {((landmarks[selectedLandmark].visibility || 0) * 100).toFixed(0)}%</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All landmarks details (expandable) */}
          <Card>
            <CardHeader
              className="pb-3 cursor-pointer select-none"
              onClick={() => setShowDetails(!showDetails)}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileVideo className="h-4 w-4" />
                  Координаты всех точек
                </span>
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
            {showDetails && (
              <CardContent className="p-0">
                <ScrollArea className="max-h-64">
                  <div className="px-4 pb-4 space-y-0.5">
                    {landmarks ? (
                      LANDMARK_NAMES.map((lm) => {
                        const landmark = landmarks[lm.index];
                        if (!landmark) return null;
                        const vis = landmark.visibility !== undefined ? landmark.visibility : 1;
                        return (
                          <div
                            key={lm.index}
                            className="flex items-center justify-between py-1 text-xs hover:bg-muted/50 rounded px-1 cursor-pointer transition-colors"
                            onClick={() => setSelectedLandmark(lm.index)}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-2 w-2 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: lm.color, opacity: vis < 0.4 ? 0.3 : 1 }}
                              />
                              <span className={`truncate ${vis < 0.4 ? "text-muted-foreground/50" : ""}`}>
                                {lm.nameRu}
                              </span>
                            </div>
                            <span className="font-mono text-muted-foreground shrink-0 ml-2">
                              {(landmark.x * 100).toFixed(0)}%, {(landmark.y * 100).toFixed(0)}%
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Запустите трекинг для просмотра координат
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Info section */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Как это работает:</strong> Приложение использует <strong>MediaPipe Pose Landmarker</strong> от Google — 
                опенсорс AI-модель, которая отслеживает 33 ключевые точки тела в реальном времени прямо в вашем браузере.
              </p>
              <p>
                <strong>Что отслеживается:</strong> Голова, лицо, плечи, локти, запястья, кисти рук, бёдра, колени, лодыжки и ступни.
                Кликните на любую точку на видео, чтобы увидеть её координаты.
              </p>
              <p>
                <strong>Технологии:</strong> TypeScript + React + MediaPipe Tasks Vision + Canvas API. 
                Ничего не устанавливается — всё работает в браузере.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}