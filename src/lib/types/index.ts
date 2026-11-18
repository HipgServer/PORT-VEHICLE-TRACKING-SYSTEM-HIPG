/**
 * PORT VEHICLE TRACKING SYSTEM (PERI TRACKER)
 * SHARED STRICT TYPES & DOMAIN INTERFACES
 */

export type UserRole = "admin" | "supervisor" | "operator" | "driver";

export type DutyStatus =
  | "NOT_ON_DUTY"
  | "DUTY_ACTIVE"
  | "DUTY_INTERRUPTED"
  | "DUTY_COMPLETED";

export type TrackingStatus =
  | "TRACKING_ACTIVE"
  | "TRACKING_INTERRUPTED"
  | "GPS_PERMISSION_DENIED"
  | "GPS_UNAVAILABLE"
  | "NETWORK_OFFLINE"
  | "UPLOAD_PENDING"
  | "DUTY_ENDED";

export type VehicleTrackingStatus =
  | "ONLINE"
  | "STALE"
  | "OFFLINE"
  | "TRACKING_INTERRUPTED"
  | "NOT_ON_DUTY";

export type GpsSource =
  | "PWA_BROWSER_GPS"
  | "ANDROID_GPS"
  | "ESP32_GPS"
  | "COMMERCIAL_GPS";

export type YardEventType =
  | "YARD_ENTERED"
  | "YARD_EXITED"
  | "YARD_CHANGED"
  | "OUTSIDE_ALL_YARDS";

export type VehicleType =
  | "terminal_tractor"
  | "reach_stacker"
  | "forklift"
  | "shuttle_bus"
  | "pickup"
  | "patrol_car";

export type YardCategory =
  | "roro"
  | "container"
  | "bulk"
  | "customs"
  | "maintenance"
  | "gate"
  | "service";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][]; // GeoJSON polygon rings: [[[lng, lat], [lng, lat], ...]]
}

/**
 * Standard incoming GPS payload interface
 */
export interface IGpsPayload {
  recordId: string;
  source: GpsSource | string;
  deviceId: string;
  vehicleId: string;
  driverId: string;
  dutySessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp: string; // ISO 8601 UTC string
  localTimestamp?: string;
  batteryLevel?: number;
}

/**
 * Persisted IndexedDB offline queue item
 */
export interface IQueuedGpsRecord {
  recordId: string;
  deviceId: string;
  vehicleId: string;
  driverId: string;
  dutySessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: string; // GPS UTC
  localCreationTimestamp: string;
  uploadStatus: "pending" | "uploading" | "failed" | "uploaded";
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

/**
 * Normalized internal GPS record used across pipeline
 */
export interface INormalizedGpsRecord {
  recordId: string;
  source: GpsSource;
  deviceId: string;
  vehicleId: string;
  driverId: string;
  dutySessionId: string;
  coordinates: [number, number]; // [lng, lat]
  accuracy: number;
  speed: number;
  heading: number;
  gpsTimestamp: Date;
  receivedAt: Date;
}

/**
 * Vehicle entity view
 */
export interface IVehicleView {
  id: string;
  vehicleNumber: string;
  type: VehicleType;
  makeModel: string;
  status: "active" | "maintenance" | "inactive";
  assignedDriverId?: string;
  assignedDriverName?: string;
  currentDutySessionId?: string;
  trackingStatus: VehicleTrackingStatus;
  dutyStatus: DutyStatus;
  currentYardId?: string;
  currentYardName?: string;
  lastAcceptedGpsTime?: string;
  lastReceivedGpsTime?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  latitude?: number;
  longitude?: number;
  lastSpeed?: number;
  lastHeading?: number;
  lastAccuracy?: number;
  isMoving?: boolean;
}

/**
 * Yard entity view
 */
export interface IYardView {
  id: string;
  name: string;
  code: string;
  category: YardCategory;
  capacity: number;
  currentCount: number;
  speedLimitKmh: number;
  color: string;
  active: boolean;
  boundary: GeoPolygon;
  center?: [number, number]; // [lng, lat]
}

/**
 * Socket.IO Real-Time event payload definitions
 */
export interface ServerToClientEvents {
  "vehicle:location": (data: {
    vehicleId: string;
    vehicleNumber: string;
    coordinates: [number, number]; // [lng, lat]
    speed: number;
    heading: number;
    accuracy: number;
    timestamp: string;
    trackingStatus: VehicleTrackingStatus;
    dutyStatus: DutyStatus;
    currentYardId?: string;
    currentYardName?: string;
    driverId?: string;
    driverName?: string;
  }) => void;
  "vehicle:status": (data: {
    vehicleId: string;
    trackingStatus: VehicleTrackingStatus;
    dutyStatus: DutyStatus;
    lastSeen: string;
  }) => void;
  "vehicle:tracking-interrupted": (data: {
    vehicleId: string;
    dutySessionId: string;
    interruptedAt: string;
    reason: string;
  }) => void;
  "vehicle:yard-entered": (data: {
    vehicleId: string;
    yardId: string;
    yardName: string;
    timestamp: string;
    coordinates: [number, number];
  }) => void;
  "vehicle:yard-exited": (data: {
    vehicleId: string;
    yardId: string;
    yardName: string;
    timestamp: string;
    coordinates: [number, number];
  }) => void;
  "duty:started": (data: {
    sessionId: string;
    vehicleId: string;
    driverId: string;
    startTime: string;
  }) => void;
  "duty:ended": (data: {
    sessionId: string;
    vehicleId: string;
    driverId: string;
    endTime: string;
  }) => void;
  "device:online": (data: { deviceId: string; timestamp: string }) => void;
  "device:offline": (data: { deviceId: string; timestamp: string }) => void;
  "notification:new": (notification: any) => void;
}

export interface ClientToServerEvents {
  "subscribe:fleet": () => void;
  "unsubscribe:fleet": () => void;
  "subscribe:vehicle": (vehicleId: string) => void;
  "unsubscribe:vehicle": (vehicleId: string) => void;
  "device:heartbeat": (data: { deviceId: string; timestamp: string }) => void;
}
