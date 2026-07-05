// MediaPipe Pose Landmarker - 33 landmarks configuration
// Documentation: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

export interface LandmarkInfo {
  index: number;
  name: string;
  nameRu: string;
  color: string;
}

export const LANDMARK_NAMES: LandmarkInfo[] = [
  { index: 0, name: "nose", nameRu: "Нос", color: "#facc15" },
  { index: 1, name: "left_eye_inner", nameRu: "Левый глаз (внутр.)", color: "#a3e635" },
  { index: 2, name: "left_eye", nameRu: "Левый глаз", color: "#a3e635" },
  { index: 3, name: "left_eye_outer", nameRu: "Левый глаз (внешн.)", color: "#a3e635" },
  { index: 4, name: "right_eye_inner", nameRu: "Правый глаз (внутр.)", color: "#a3e635" },
  { index: 5, name: "right_eye", nameRu: "Правый глаз", color: "#a3e635" },
  { index: 6, name: "right_eye_outer", nameRu: "Правый глаз (внешн.)", color: "#a3e635" },
  { index: 7, name: "left_ear", nameRu: "Левое ухо", color: "#facc15" },
  { index: 8, name: "right_ear", nameRu: "Правое ухо", color: "#facc15" },
  { index: 9, name: "mouth_left", nameRu: "Левый угол рта", color: "#f472b6" },
  { index: 10, name: "mouth_right", nameRu: "Правый угол рта", color: "#f472b6" },
  { index: 11, name: "left_shoulder", nameRu: "Левое плечо", color: "#60a5fa" },
  { index: 12, name: "right_shoulder", nameRu: "Правое плечо", color: "#60a5fa" },
  { index: 13, name: "left_elbow", nameRu: "Левый локоть", color: "#60a5fa" },
  { index: 14, name: "right_elbow", nameRu: "Правый локоть", color: "#60a5fa" },
  { index: 15, name: "left_wrist", nameRu: "Левое запястье", color: "#34d399" },
  { index: 16, name: "right_wrist", nameRu: "Правое запястье", color: "#34d399" },
  { index: 17, name: "left_pinky", nameRu: "Левый мизинец", color: "#34d399" },
  { index: 18, name: "right_pinky", nameRu: "Правый мизинец", color: "#34d399" },
  { index: 19, name: "left_index", nameRu: "Левый указательный", color: "#34d399" },
  { index: 20, name: "right_index", nameRu: "Правый указательный", color: "#34d399" },
  { index: 21, name: "left_thumb", nameRu: "Левый большой палец", color: "#34d399" },
  { index: 22, name: "right_thumb", nameRu: "Правый большой палец", color: "#34d399" },
  { index: 23, name: "left_hip", nameRu: "Левое бедро", color: "#f97316" },
  { index: 24, name: "right_hip", nameRu: "Правое бедро", color: "#f97316" },
  { index: 25, name: "left_knee", nameRu: "Левое колено", color: "#f97316" },
  { index: 26, name: "right_knee", nameRu: "Правое колено", color: "#f97316" },
  { index: 27, name: "left_ankle", nameRu: "Левая лодыжка", color: "#f97316" },
  { index: 28, name: "right_ankle", nameRu: "Правая лодыжка", color: "#f97316" },
  { index: 29, name: "left_heel", nameRu: "Левая пятка", color: "#f97316" },
  { index: 30, name: "right_heel", nameRu: "Правая пятка", color: "#f97316" },
  { index: 31, name: "left_foot_index", nameRu: "Левая ступня", color: "#f97316" },
  { index: 32, name: "right_foot_index", nameRu: "Правая ступня", color: "#f97316" },
];

// Body connections for skeleton drawing
export interface BodyConnection {
  start: number;
  end: number;
  color: string;
  width: number;
  label?: string;
}

export const BODY_CONNECTIONS: BodyConnection[] = [
  // Head / Face
  { start: 0, end: 1, color: "#facc15", width: 2, label: "Голова" },
  { start: 0, end: 2, color: "#facc15", width: 2 },
  { start: 1, end: 3, color: "#facc15", width: 2 },
  { start: 2, end: 4, color: "#facc15", width: 2 },
  { start: 5, end: 6, color: "#facc15", width: 2 },
  { start: 7, end: 0, color: "#facc15", width: 2 },
  { start: 8, end: 0, color: "#facc15", width: 2 },
  { start: 9, end: 0, color: "#f472b6", width: 1.5 },
  { start: 10, end: 0, color: "#f472b6", width: 1.5 },

  // Torso
  { start: 11, end: 12, color: "#60a5fa", width: 3, label: "Торс" },
  { start: 11, end: 23, color: "#60a5fa", width: 3 },
  { start: 12, end: 24, color: "#60a5fa", width: 3 },
  { start: 23, end: 24, color: "#60a5fa", width: 3 },

  // Left arm
  { start: 11, end: 13, color: "#38bdf8", width: 2.5, label: "Левая рука" },
  { start: 13, end: 15, color: "#38bdf8", width: 2.5 },

  // Right arm
  { start: 12, end: 14, color: "#38bdf8", width: 2.5, label: "Правая рука" },
  { start: 14, end: 16, color: "#38bdf8", width: 2.5 },

  // Left hand
  { start: 15, end: 17, color: "#34d399", width: 2 },
  { start: 15, end: 19, color: "#34d399", width: 2 },
  { start: 15, end: 21, color: "#34d399", width: 2 },
  { start: 17, end: 19, color: "#34d399", width: 1.5 },

  // Right hand
  { start: 16, end: 18, color: "#34d399", width: 2 },
  { start: 16, end: 20, color: "#34d399", width: 2 },
  { start: 16, end: 22, color: "#34d399", width: 2 },
  { start: 18, end: 20, color: "#34d399", width: 1.5 },

  // Left leg
  { start: 23, end: 25, color: "#f97316", width: 3, label: "Левая нога" },
  { start: 25, end: 27, color: "#f97316", width: 3 },

  // Right leg
  { start: 24, end: 26, color: "#f97316", width: 3, label: "Правая нога" },
  { start: 26, end: 28, color: "#f97316", width: 3 },

  // Left foot
  { start: 27, end: 29, color: "#fb923c", width: 2 },
  { start: 27, end: 31, color: "#fb923c", width: 2 },
  { start: 29, end: 31, color: "#fb923c", width: 1.5 },

  // Right foot
  { start: 28, end: 30, color: "#fb923c", width: 2 },
  { start: 28, end: 32, color: "#fb923c", width: 2 },
  { start: 30, end: 32, color: "#fb923c", width: 1.5 },
];

// Group landmarks by body part for the info panel
export const BODY_PARTS = {
  head: {
    label: "Голова",
    labelEn: "Head",
    color: "#facc15",
    landmarks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  torso: {
    label: "Торс",
    labelEn: "Torso",
    color: "#60a5fa",
    landmarks: [11, 12, 23, 24],
  },
  leftArm: {
    label: "Левая рука",
    labelEn: "Left Arm",
    color: "#38bdf8",
    landmarks: [11, 13, 15, 17, 19, 21],
  },
  rightArm: {
    label: "Правая рука",
    labelEn: "Right Arm",
    color: "#38bdf8",
    landmarks: [12, 14, 16, 18, 20, 22],
  },
  leftLeg: {
    label: "Левая нога",
    labelEn: "Left Leg",
    color: "#f97316",
    landmarks: [23, 25, 27, 29, 31],
  },
  rightLeg: {
    label: "Правая нога",
    labelEn: "Right Leg",
    color: "#f97316",
    landmarks: [24, 26, 28, 30, 32],
  },
} as const;

export type BodyPartKey = keyof typeof BODY_PARTS;

// Model URL for MediaPipe Pose Landmarker
export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker.task";