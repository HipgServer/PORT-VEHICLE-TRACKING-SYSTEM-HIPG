import { DutyStatus, VehicleTrackingStatus } from "@/lib/types";

export interface StatusEvaluationInput {
  dutyStatus: DutyStatus;
  lastAcceptedGpsTime?: Date | null;
  isTrackingInterrupted?: boolean;
  staleThresholdSeconds?: number;
  offlineThresholdSeconds?: number;
}

export interface StatusEvaluationResult {
  trackingStatus: VehicleTrackingStatus;
  dutyStatus: DutyStatus;
  secondsSinceLastUpdate: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  isLive: boolean;
}

export function evaluateVehicleTrackingStatus(
  input: StatusEvaluationInput
): StatusEvaluationResult {
  const {
    dutyStatus,
    lastAcceptedGpsTime,
    isTrackingInterrupted = false,
    staleThresholdSeconds = 60,
    offlineThresholdSeconds = 180,
  } = input;

  // If vehicle has no active duty session
  if (dutyStatus === "NOT_ON_DUTY" || dutyStatus === "DUTY_COMPLETED") {
    return {
      trackingStatus: "NOT_ON_DUTY",
      dutyStatus,
      secondsSinceLastUpdate: lastAcceptedGpsTime
        ? Math.floor((Date.now() - new Date(lastAcceptedGpsTime).getTime()) / 1000)
        : -1,
      confidence: "NONE",
      isLive: false,
    };
  }

  // Active duty session
  if (!lastAcceptedGpsTime) {
    return {
      trackingStatus: "OFFLINE",
      dutyStatus,
      secondsSinceLastUpdate: -1,
      confidence: "NONE",
      isLive: false,
    };
  }

  const secondsSinceLastUpdate = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastAcceptedGpsTime).getTime()) / 1000)
  );

  // If driver app triggered tracking interruption (e.g. backgrounded or closed)
  if (isTrackingInterrupted || dutyStatus === "DUTY_INTERRUPTED") {
    return {
      trackingStatus: "TRACKING_INTERRUPTED",
      dutyStatus: "DUTY_INTERRUPTED",
      secondsSinceLastUpdate,
      confidence: "LOW",
      isLive: false,
    };
  }

  // Connectivity thresholds
  if (secondsSinceLastUpdate <= staleThresholdSeconds) {
    return {
      trackingStatus: "ONLINE",
      dutyStatus,
      secondsSinceLastUpdate,
      confidence: "HIGH",
      isLive: true,
    };
  }

  if (secondsSinceLastUpdate <= offlineThresholdSeconds) {
    return {
      trackingStatus: "STALE",
      dutyStatus,
      secondsSinceLastUpdate,
      confidence: "MEDIUM",
      isLive: false, // Never mark stale as live!
    };
  }

  return {
    trackingStatus: "OFFLINE",
    dutyStatus,
    secondsSinceLastUpdate,
    confidence: "LOW",
    isLive: false,
  };
}

