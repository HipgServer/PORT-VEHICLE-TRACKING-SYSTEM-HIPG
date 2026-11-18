import { GpsSource, IGpsPayload, INormalizedGpsRecord } from "@/lib/types";

export interface IGpsSourceAdapter {
  sourceType: GpsSource;
  normalize(rawInput: any): IGpsPayload;
}

export class PwaBrowserAdapter implements IGpsSourceAdapter {
  sourceType: GpsSource = "PWA_BROWSER_GPS";

  normalize(raw: any): IGpsPayload {
    return {
      recordId: raw.recordId || `pwa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      source: "PWA_BROWSER_GPS",
      deviceId: raw.deviceId || "PWA-BROWSER",
      vehicleId: raw.vehicleId,
      driverId: raw.driverId,
      dutySessionId: raw.dutySessionId,
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      accuracy: Number(raw.accuracy),
      speed: raw.speed != null ? Number(raw.speed) : 0,
      heading: raw.heading != null ? Number(raw.heading) : 0,
      altitude: raw.altitude != null ? Number(raw.altitude) : null,
      timestamp: raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString(),
      localTimestamp: raw.localTimestamp || new Date().toISOString(),
      batteryLevel: raw.batteryLevel,
    };
  }
}

export class Esp32GpsAdapter implements IGpsSourceAdapter {
  sourceType: GpsSource = "ESP32_GPS";

  normalize(raw: any): IGpsPayload {
    // Supports common NMEA/ESP32 JSON payloads e.g. { dev: "ESP-01", lat: 6.12, lon: 81.11, spd: 12.3, cog: 180, fix: 1, hdop: 1.2 }
    return {
      recordId: raw.recordId || raw.msgId || `esp32-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      source: "ESP32_GPS",
      deviceId: raw.deviceId || raw.dev || raw.chipId,
      vehicleId: raw.vehicleId,
      driverId: raw.driverId || "HARDWARE_DEVICE",
      dutySessionId: raw.dutySessionId || "HARDWARE_SESSION",
      latitude: Number(raw.latitude ?? raw.lat),
      longitude: Number(raw.longitude ?? raw.lng ?? raw.lon),
      accuracy: Number(raw.accuracy ?? (raw.hdop ? raw.hdop * 3.5 : 8.0)),
      speed: raw.speed != null ? Number(raw.speed) : raw.spd ? Number(raw.spd) * 1.852 : 0, // Knots to km/h if spd
      heading: raw.heading != null ? Number(raw.heading) : raw.cog != null ? Number(raw.cog) : 0,
      altitude: raw.altitude != null ? Number(raw.altitude) : raw.alt != null ? Number(raw.alt) : null,
      timestamp: raw.timestamp || raw.time || new Date().toISOString(),
      batteryLevel: raw.batteryLevel ?? raw.vbat,
    };
  }
}

export class CommercialGpsAdapter implements IGpsSourceAdapter {
  sourceType: GpsSource = "COMMERCIAL_GPS";

  normalize(raw: any): IGpsPayload {
    // Commercial fleet protocol (Queclink, Teltonika, Concox)
    return {
      recordId: raw.recordId || raw.imei + "-" + raw.seq || `com-${Date.now()}`,
      source: "COMMERCIAL_GPS",
      deviceId: raw.deviceId || raw.imei,
      vehicleId: raw.vehicleId,
      driverId: raw.driverId || "HARDWARE_DRIVER",
      dutySessionId: raw.dutySessionId || "FLEET_PERMANENT",
      latitude: Number(raw.latitude ?? raw.lat),
      longitude: Number(raw.longitude ?? raw.lng),
      accuracy: Number(raw.accuracy ?? 5.0),
      speed: Number(raw.speed ?? 0),
      heading: Number(raw.heading ?? 0),
      timestamp: raw.timestamp ? new Date(raw.timestamp).toISOString() : new Date().toISOString(),
      batteryLevel: raw.batteryLevel,
    };
  }
}

export class GpsAdapterFactory {
  private static adapters: Map<string, IGpsSourceAdapter> = new Map([
    ["PWA_BROWSER_GPS", new PwaBrowserAdapter()],
    ["ANDROID_GPS", new PwaBrowserAdapter()],
    ["ESP32_GPS", new Esp32GpsAdapter()],
    ["COMMERCIAL_GPS", new CommercialGpsAdapter()],
  ]);

  public static getAdapter(source: string): IGpsSourceAdapter {
    const adapter = this.adapters.get(source.toUpperCase());
    return adapter || this.adapters.get("PWA_BROWSER_GPS")!;
  }

  public static normalizePayload(raw: any): IGpsPayload {
    const source = (raw.source || "PWA_BROWSER_GPS").toUpperCase();
    const adapter = this.getAdapter(source);
    return adapter.normalize(raw);
  }
}

