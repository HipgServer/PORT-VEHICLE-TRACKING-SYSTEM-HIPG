import { gpsOfflineQueue } from "./indexedDBQueue";
import { IQueuedGpsRecord, TrackingStatus } from "@/lib/types";

export interface GpsEngineConfig {
  vehicleId: string;
  driverId: string;
  dutySessionId: string;
  deviceId?: string;
  maxAccuracyMeters?: number;
  movingIntervalMs?: number; // 5-10s
  idleIntervalMs?: number;   // 30s
  parkedIntervalMs?: number; // 60s
  onStatusChange?: (status: TrackingStatus, details?: string) => void;
  onLocationSampled?: (record: IQueuedGpsRecord) => void;
  onPendingQueueCountChange?: (count: number) => void;
}

export class GPSTrackingEngine {
  private config: Required<GpsEngineConfig>;
  private watchId: number | null = null;
  private uploadTimer: any = null;
  private isRunning: boolean = false;
  private lastSampledTime: number = 0;
  private lastUploadedTime: number = 0;
  private lastLocation: GeolocationCoordinates | null = null;
  private currentStatus: TrackingStatus = "DUTY_ENDED";
  private uploadBackoffMs: number = 1000;
  private isUploading: boolean = false;

  constructor(config: GpsEngineConfig) {
    this.config = {
      vehicleId: config.vehicleId,
      driverId: config.driverId,
      dutySessionId: config.dutySessionId,
      deviceId: config.deviceId || "PWA-BROWSER-GPS",
      maxAccuracyMeters: config.maxAccuracyMeters ?? 50,
      movingIntervalMs: config.movingIntervalMs ?? 5000,
      idleIntervalMs: config.idleIntervalMs ?? 30000,
      parkedIntervalMs: config.parkedIntervalMs ?? 60000,
      onStatusChange: config.onStatusChange || (() => {}),
      onLocationSampled: config.onLocationSampled || (() => {}),
      onPendingQueueCountChange: config.onPendingQueueCountChange || (() => {}),
    };

    if (typeof window !== "undefined") {
      this.attachLifecycleListeners();
    }
  }

  /**
   * Starts GPS tracking session
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      this.setStatus("GPS_UNAVAILABLE", "Geolocation API not available in browser");
      return false;
    }

    try {
      this.isRunning = true;
      this.setStatus("TRACKING_ACTIVE");

      // Start Geolocation watchPosition
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.handleGeolocationSuccess(pos),
        (err) => this.handleGeolocationError(err),
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );

      // Start separate upload worker loop
      this.startUploadLoop();
      return true;
    } catch (err: any) {
      this.setStatus("GPS_UNAVAILABLE", err.message);
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Stops GPS tracking
   */
  public stop(): void {
    this.isRunning = false;

    if (this.watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer);
      this.uploadTimer = null;
    }

    this.setStatus("DUTY_ENDED");
  }

  /**
   * Updates current configuration (e.g. dutySessionId change)
   */
  public updateConfig(newConfig: Partial<GpsEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Primary Geolocation callback handler.
   * Separates high-frequency browser callbacks from rate-controlled sampling policy.
   */
  private async handleGeolocationSuccess(position: GeolocationPosition): Promise<void> {
    if (!this.isRunning) return;

    const coords = position.coords;
    const now = Date.now();

    // 1. Validate coordinates range
    if (
      coords.latitude < -90 ||
      coords.latitude > 90 ||
      coords.longitude < -180 ||
      coords.longitude > 180
    ) {
      return; // Reject impossible coordinate readings
    }

    // 2. Accuracy validation
    if (coords.accuracy > this.config.maxAccuracyMeters) {
      // Inaccurate reading (> 50m) - skip sampling
      return;
    }

    // 3. Sampling Policy Rate Throttling
    const speedKmh = coords.speed != null ? coords.speed * 3.6 : 0;
    const isMoving = speedKmh > 2.0;
    const requiredInterval = isMoving
      ? this.config.movingIntervalMs
      : coords.speed === 0
      ? this.config.parkedIntervalMs
      : this.config.idleIntervalMs;

    if (now - this.lastSampledTime < requiredInterval) {
      return; // Throttled: do not sample yet
    }

    this.lastSampledTime = now;
    this.lastLocation = coords;

    // 4. Create and enqueue record into IndexedDB
    const record: IQueuedGpsRecord = {
      recordId: `pwa-${now}-${Math.random().toString(36).substring(2, 8)}`,
      deviceId: this.config.deviceId,
      vehicleId: this.config.vehicleId,
      driverId: this.config.driverId,
      dutySessionId: this.config.dutySessionId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: Math.round(coords.accuracy * 10) / 10,
      speed: coords.speed != null ? Math.round(coords.speed * 3.6 * 10) / 10 : 0,
      heading: coords.heading != null ? Math.round(coords.heading) : 0,
      timestamp: new Date(position.timestamp).toISOString(),
      localCreationTimestamp: new Date().toISOString(),
      uploadStatus: "pending",
      retryCount: 0,
    };

    await gpsOfflineQueue.enqueue(record);
    this.config.onLocationSampled(record);
    this.updatePendingCount();

    // Trigger upload check
    this.triggerUploadNow();
  }

  /**
   * Geolocation error handler
   */
  private handleGeolocationError(error: GeolocationPositionError): void {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        this.setStatus("GPS_PERMISSION_DENIED", "User denied GPS location access");
        break;
      case error.POSITION_UNAVAILABLE:
        this.setStatus("GPS_UNAVAILABLE", "GPS satellite signal unavailable");
        break;
      case error.TIMEOUT:
        // Timeout is transient - don't crash
        break;
      default:
        this.setStatus("GPS_UNAVAILABLE", error.message);
    }
  }

  /**
   * Handles document lifecycle events according to Requirement 6:
   * document.visibilityState, visibilitychange, pageshow, pagehide, online, offline
   */
  private attachLifecycleListeners(): void {
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "hidden") {
        this.handleApplicationSuspended("Browser visibility changed to hidden");
      } else if (document.visibilityState === "visible") {
        await this.handleApplicationResumed("Browser visibility restored to active");
      }
    });

    window.addEventListener("pagehide", () => {
      this.handleApplicationSuspended("Page navigating away or backgrounded");
    });

    window.addEventListener("pageshow", async () => {
      await this.handleApplicationResumed("Page reopened");
    });

    window.addEventListener("offline", () => {
      this.setStatus("NETWORK_OFFLINE", "Device lost network connectivity");
    });

    window.addEventListener("online", () => {
      this.setStatus("TRACKING_ACTIVE", "Network connectivity restored");
      this.triggerUploadNow();
    });
  }

  /**
   * Called when browser is hidden, tab switched, or suspended
   */
  private handleApplicationSuspended(reason: string): void {
    if (!this.isRunning) return;

    this.setStatus("TRACKING_INTERRUPTED", reason);

    // Notify backend about tracking interruption (fire-and-forget Beacon or fetch)
    if (navigator.sendBeacon) {
      const payload = JSON.stringify({
        vehicleId: this.config.vehicleId,
        dutySessionId: this.config.dutySessionId,
        interruptedAt: new Date().toISOString(),
        reason,
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/duty/interrupt", blob);
    } else {
      fetch("/api/duty/interrupt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: this.config.vehicleId,
          dutySessionId: this.config.dutySessionId,
          interruptedAt: new Date().toISOString(),
          reason,
        }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  /**
   * Called when browser returns to active foreground
   */
  private async handleApplicationResumed(reason: string): Promise<void> {
    if (!this.isRunning) return;

    // Check connectivity
    if (!navigator.onLine) {
      this.setStatus("NETWORK_OFFLINE");
      return;
    }

    this.setStatus("TRACKING_ACTIVE");

    // Reinitialize watch if dropped
    if (this.watchId === null) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.handleGeolocationSuccess(pos),
        (err) => this.handleGeolocationError(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    // Flush any buffered offline records
    this.triggerUploadNow();
  }

  /**
   * Dedicated upload loop processing queued records with exponential backoff & jitter
   */
  private async processUploadQueue(): Promise<void> {
    if (this.isUploading || !navigator.onLine) return;

    this.isUploading = true;

    try {
      const pendingRecords = await gpsOfflineQueue.getPendingRecords(20);
      if (pendingRecords.length === 0) {
        this.uploadBackoffMs = 1000;
        this.isUploading = false;
        return;
      }

      await gpsOfflineQueue.markUploading(pendingRecords.map((r) => r.recordId));

      // Batch upload
      const response = await fetch("/api/gps/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: pendingRecords }),
      });

      if (response.ok) {
        const result = await response.json();
        // Server accepted! Permanently remove accepted records from IndexedDB
        for (const item of pendingRecords) {
          await gpsOfflineQueue.removeConfirmed(item.recordId);
        }
        this.uploadBackoffMs = 1000; // Reset backoff on success
        this.updatePendingCount();

        // If more items remain, trigger next batch immediately
        const remainingCount = await gpsOfflineQueue.getPendingCount();
        if (remainingCount > 0) {
          setTimeout(() => this.processUploadQueue(), 100);
        }
      } else {
        // HTTP error: exponential backoff with jitter
        const jitter = Math.random() * 500;
        this.uploadBackoffMs = Math.min(this.uploadBackoffMs * 2, 30000) + jitter;
        for (const item of pendingRecords) {
          await gpsOfflineQueue.markFailed(item.recordId, `Server error ${response.status}`);
        }
      }
    } catch (err: any) {
      // Network failure: mark failed and backoff
      const jitter = Math.random() * 500;
      this.uploadBackoffMs = Math.min(this.uploadBackoffMs * 2, 30000) + jitter;
      this.setStatus("NETWORK_OFFLINE", "Network connection failed");
    } finally {
      this.isUploading = false;
      this.updatePendingCount();
    }
  }

  private startUploadLoop(): void {
    const loop = async () => {
      if (!this.isRunning) return;
      await this.processUploadQueue();
      this.uploadTimer = setTimeout(loop, Math.max(3000, this.uploadBackoffMs));
    };
    loop();
  }

  private triggerUploadNow(): void {
    if (!this.isUploading && navigator.onLine) {
      this.processUploadQueue();
    }
  }

  private async updatePendingCount(): Promise<void> {
    const count = await gpsOfflineQueue.getPendingCount();
    this.config.onPendingQueueCountChange(count);
  }

  private setStatus(status: TrackingStatus, details?: string): void {
    this.currentStatus = status;
    this.config.onStatusChange(status, details);
  }

  public getStatus(): TrackingStatus {
    return this.currentStatus;
  }
}

