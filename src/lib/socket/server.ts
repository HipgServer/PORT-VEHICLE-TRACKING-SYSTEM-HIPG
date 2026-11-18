import { Server as SocketIOServer } from "socket.io";
import { ServerToClientEvents, ClientToServerEvents } from "@/lib/types";

let ioInstance: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

export function setSocketServer(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
) {
  ioInstance = io;
}

export function getSocketServer(): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
> | null {
  return ioInstance;
}

/**
 * Broadcasts live location updates to all subscribed clients
 */
export function broadcastVehicleLocation(data: {
  vehicleId: string;
  vehicleNumber: string;
  coordinates: [number, number];
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
  trackingStatus: any;
  dutyStatus: any;
  currentYardId?: string;
  currentYardName?: string;
  driverId?: string;
  driverName?: string;
}) {
  if (ioInstance) {
    ioInstance.to("fleet").emit("vehicle:location", data);
    ioInstance.to(`vehicle:${data.vehicleId}`).emit("vehicle:location", data);
  }
}

/**
 * Broadcasts status updates (ONLINE, STALE, OFFLINE, TRACKING_INTERRUPTED)
 */
export function broadcastVehicleStatus(data: {
  vehicleId: string;
  trackingStatus: any;
  dutyStatus: any;
  lastSeen: string;
}) {
  if (ioInstance) {
    ioInstance.to("fleet").emit("vehicle:status", data);
    ioInstance.to(`vehicle:${data.vehicleId}`).emit("vehicle:status", data);
  }
}

/**
 * Broadcasts yard entry events
 */
export function broadcastYardEntered(data: {
  vehicleId: string;
  yardId: string;
  yardName: string;
  timestamp: string;
  coordinates: [number, number];
}) {
  if (ioInstance) {
    ioInstance.to("fleet").emit("vehicle:yard-entered", data);
    ioInstance.emit("notification:new", {
      type: "YARD_ENTRY",
      title: "Yard Entered",
      message: `Vehicle entered ${data.yardName}`,
      data,
    });
  }
}

/**
 * Broadcasts yard exit events
 */
export function broadcastYardExited(data: {
  vehicleId: string;
  yardId: string;
  yardName: string;
  timestamp: string;
  coordinates: [number, number];
}) {
  if (ioInstance) {
    ioInstance.to("fleet").emit("vehicle:yard-exited", data);
    ioInstance.emit("notification:new", {
      type: "YARD_EXIT",
      title: "Yard Exited",
      message: `Vehicle exited ${data.yardName}`,
      data,
    });
  }
}

/**
 * Broadcasts tracking interruption alerts
 */
export function broadcastTrackingInterrupted(data: {
  vehicleId: string;
  dutySessionId: string;
  interruptedAt: string;
  reason: string;
}) {
  if (ioInstance) {
    ioInstance.to("fleet").emit("vehicle:tracking-interrupted", data);
    ioInstance.emit("notification:new", {
      type: "TRACKING_INTERRUPTED",
      title: "Tracking Interrupted",
      message: `Vehicle tracking interrupted: ${data.reason}`,
      data,
    });
  }
}

