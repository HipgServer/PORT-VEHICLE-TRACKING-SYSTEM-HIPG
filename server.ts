import { createServer } from "http";
import { parse } from "url";
import fs from "fs";
import path from "path";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import { setSocketServer } from "./src/lib/socket/server";
import { connectDB } from "./src/lib/db/connection";
import { Vehicle, LatestLocation, DutySession, SystemSetting } from "./src/lib/db/models";
import { evaluateVehicleTrackingStatus } from "./src/lib/gps/statusEngine";
import { ServerToClientEvents, ClientToServerEvents } from "./src/lib/types";

dotenv.config({ path: ".env.local" });
dotenv.config();

const port = parseInt(process.env.PORT || "3000", 10);
const hasBuild = fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
const dev = process.env.NODE_ENV === "development" ? true : !hasBuild;
const app = next({ dev });
const handle = app.getRequestHandler();

async function bootstrap() {
  await app.prepare();

  // Connect to MongoDB Atlas
  try {
    await connectDB();
    console.log("[Database] Connected to MongoDB Atlas.");
  } catch (err) {
    console.error("[Database] Connection failed:", err);
  }

  // Create HTTP server for unified Next.js + Socket.IO execution
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Initialize Persistent Socket.IO Server
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    path: "/socket.io/",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Register io instance for the GPS processing pipeline
  setSocketServer(io);

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join fleet-wide room
    socket.on("subscribe:fleet", () => {
      socket.join("fleet");
      console.log(`[Socket.IO] Client ${socket.id} subscribed to fleet`);
    });

    socket.on("unsubscribe:fleet", () => {
      socket.leave("fleet");
    });

    // Join individual vehicle room
    socket.on("subscribe:vehicle", (vehicleId) => {
      socket.join(`vehicle:${vehicleId}`);
    });

    socket.on("unsubscribe:vehicle", (vehicleId) => {
      socket.leave(`vehicle:${vehicleId}`);
    });

    // Device heartbeat
    socket.on("device:heartbeat", (data) => {
      socket.to("fleet").emit("device:online", data);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  // Background Periodic Status Classification Ticker
  // Evaluates every 30 seconds if vehicles transition to STALE or OFFLINE
  setInterval(async () => {
    try {
      const staleSetting = await SystemSetting.findOne({ key: "GPS_STALE_THRESHOLD_SECONDS" });
      const offlineSetting = await SystemSetting.findOne({ key: "GPS_OFFLINE_THRESHOLD_SECONDS" });
      const staleThreshold = staleSetting?.value ?? 60;
      const offlineThreshold = offlineSetting?.value ?? 180;

      const vehicles = await Vehicle.find({ status: "active" });
      const latestLocations = await LatestLocation.find();
      const activeSessions = await DutySession.find({
        status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
      });

      const locMap = new Map();
      latestLocations.forEach((l) => locMap.set(l.vehicleId.toString(), l));

      const sessMap = new Map();
      activeSessions.forEach((s) => sessMap.set(s.vehicleId.toString(), s));

      for (const v of vehicles) {
        const loc = locMap.get(v._id.toString());
        const session = sessMap.get(v._id.toString());
        const dutyStatus = session ? session.status : "NOT_ON_DUTY";

        if (loc) {
          const evalResult = evaluateVehicleTrackingStatus({
            dutyStatus,
            lastAcceptedGpsTime: loc.lastAcceptedGpsTime,
            isTrackingInterrupted: session?.status === "DUTY_INTERRUPTED" || loc.trackingStatus === "TRACKING_INTERRUPTED",
            staleThresholdSeconds: staleThreshold,
            offlineThresholdSeconds: offlineThreshold,
          });

          // If tracking status transitioned, update DB and broadcast event
          if (loc.trackingStatus !== evalResult.trackingStatus) {
            await LatestLocation.findByIdAndUpdate(loc._id, {
              trackingStatus: evalResult.trackingStatus,
            });

            io.to("fleet").emit("vehicle:status", {
              vehicleId: v._id.toString(),
              trackingStatus: evalResult.trackingStatus,
              dutyStatus,
              lastSeen: loc.lastAcceptedGpsTime ? loc.lastAcceptedGpsTime.toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      // Silently catch ticker error
    }
  }, 30000);

  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 PERI TRACKER - PORT VEHICLE & YARD TRACKING SYSTEM`);
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`> Persistent Socket.IO: active on /socket.io/`);
    console.log(`======================================================\n`);
  });
}

bootstrap().catch((err) => {
  console.error("Bootstrap fatal error:", err);
  process.exit(1);
});

