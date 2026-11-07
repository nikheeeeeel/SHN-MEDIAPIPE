export type MonitoringRuntimeStatus =
  | "idle"
  | "starting"
  | "calibrating"
  | "active"
  | "error"
  | "unsupported";

export interface MonitoringSettings {
  absenceSeconds: number;
  gazeAwaySeconds: number;
  cooldownSeconds: number;
  cameraIndex: number;
}

export interface MonitoringRequest extends MonitoringSettings {
  intention: string;
}

export interface MonitoringStatusPayload {
  status: "active" | "calibrating";
  facePresent: boolean;
  absenceSeconds: number;
  calibrationProgress?: number;
  gazeAvailable?: boolean;
  gazeAway?: boolean;
  gazeAwaySeconds?: number;
  gazeReason?: string;
}

export interface MonitoringErrorPayload {
  code: string;
  message: string;
}

export interface ReminderPayload {
  kind: "away" | "focus" | string;
  intention: string;
  message: string;
  triggerSeconds: number;
}
