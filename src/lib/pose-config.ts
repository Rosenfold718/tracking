// MoveNet (TensorFlow.js) — 17 keypoints configuration
// https://www.tensorflow.org/hub/tutorials/movenet

export interface LandmarkInfo {
  index: number;
  name: string;
  nameRu: string;
  color: string;
}

export const LANDMARK_NAMES: LandmarkInfo[] = [
  { index: 0, name: "nose", nameRu: "Нос", color: "#facc15" },
  { index: 1, name: "left_eye", nameRu: "Левый глаз", color: "#a3e635" },
  { index: 2, name: "right_eye", nameRu: "Правый глаз", color: "#a3e635" },
  { index: 3, name: "left_ear", nameRu: "Левое ухо", color: "#facc15" },
  { index: 4, name: "right_ear", nameRu: "Правое ухо", color: "#facc15" },
  { index: 5, name: "left_shoulder", nameRu: "Левое плечо", color: "#60a5fa" },
  { index: 6, name: "right_shoulder", nameRu: "Правое плечо", color: "#60a5fa" },
  { index: 7, name: "left_elbow", nameRu: "Левый локоть", color: "#38bdf8" },
  { index: 8, name: "right_elbow", nameRu: "Правый локоть", color: "#38bdf8" },
  { index: 9, name: "left_wrist", nameRu: "Левое запястье", color: "#34d399" },
  { index: 10, name: "right_wrist", nameRu: "Правое запястье", color: "#34d399" },
  { index: 11, name: "left_hip", nameRu: "Левое бедро", color: "#f97316" },
  { index: 12, name: "right_hip", nameRu: "Правое бедро", color: "#f97316" },
  { index: 13, name: "left_knee", nameRu: "Левое колено", color: "#f97316" },
  { index: 14, name: "right_knee", nameRu: "Правое колено", color: "#f97316" },
  { index: 15, name: "left_ankle", nameRu: "Левая лодыжка", color: "#f97316" },
  { index: 16, name: "right_ankle", nameRu: "Правая лодыжка", color: "#f97316" },
];

export interface BodyConnection {
  start: number;
  end: number;
  color: string;
  width: number;
}

export const BODY_CONNECTIONS: BodyConnection[] = [
  // Face
  { start: 0, end: 1, color: "#facc15", width: 2 },
  { start: 0, end: 2, color: "#facc15", width: 2 },
  { start: 1, end: 3, color: "#facc15", width: 2 },
  { start: 2, end: 4, color: "#facc15", width: 2 },
  { start: 3, end: 5, color: "#facc15", width: 2 },
  { start: 4, end: 6, color: "#facc15", width: 2 },

  // Torso
  { start: 5, end: 6, color: "#60a5fa", width: 3 },
  { start: 5, end: 11, color: "#60a5fa", width: 3 },
  { start: 6, end: 12, color: "#60a5fa", width: 3 },
  { start: 11, end: 12, color: "#60a5fa", width: 3 },

  // Left arm
  { start: 5, end: 7, color: "#38bdf8", width: 2.5 },
  { start: 7, end: 9, color: "#38bdf8", width: 2.5 },

  // Right arm
  { start: 6, end: 8, color: "#38bdf8", width: 2.5 },
  { start: 8, end: 10, color: "#38bdf8", width: 2.5 },

  // Left leg
  { start: 11, end: 13, color: "#f97316", width: 3 },
  { start: 13, end: 15, color: "#f97316", width: 3 },

  // Right leg
  { start: 12, end: 14, color: "#f97316", width: 3 },
  { start: 14, end: 16, color: "#f97316", width: 3 },
];

export const BODY_PARTS = {
  head: {
    label: "Голова",
    labelEn: "Head",
    color: "#facc15",
    landmarks: [0, 1, 2, 3, 4],
  },
  torso: {
    label: "Торс",
    labelEn: "Torso",
    color: "#60a5fa",
    landmarks: [5, 6, 11, 12],
  },
  leftArm: {
    label: "Левая рука",
    labelEn: "Left Arm",
    color: "#38bdf8",
    landmarks: [5, 7, 9],
  },
  rightArm: {
    label: "Правая рука",
    labelEn: "Right Arm",
    color: "#38bdf8",
    landmarks: [6, 8, 10],
  },
  leftLeg: {
    label: "Левая нога",
    labelEn: "Left Leg",
    color: "#f97316",
    landmarks: [11, 13, 15],
  },
  rightLeg: {
    label: "Правая нога",
    labelEn: "Right Leg",
    color: "#f97316",
    landmarks: [12, 14, 16],
  },
} as const;

export type BodyPartKey = keyof typeof BODY_PARTS;