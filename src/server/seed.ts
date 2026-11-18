import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import {
  User,
  Vehicle,
  Driver,
  GpsDevice,
  Yard,
  LatestLocation,
  SystemSetting,
} from "../lib/db/models";

dotenv.config({ path: ".env.local" });
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/peri_tracker";

// Realistic Hambantota Port (HIPG) Yard Polygons
// Latitudes ~ 6.115 to 6.128, Longitudes ~ 81.112 to 81.126
const YARDS_DATA = [
  {
    name: "Ro-Ro Yard 1 (Main Vehicle Staging)",
    code: "RY-01",
    category: "roro",
    capacity: 1200,
    currentCount: 0,
    speedLimitKmh: 25,
    color: "#3b82f6", // Blue
    description: "Primary vehicle discharge and staging yard adjacent to Berth 07",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1140, 6.1210],
          [81.1170, 6.1210],
          [81.1170, 6.1245],
          [81.1140, 6.1245],
          [81.1140, 6.1210],
        ],
      ],
    },
  },
  {
    name: "Ro-Ro Yard 2 (Transshipment Area)",
    code: "RY-02",
    category: "roro",
    capacity: 1500,
    currentCount: 0,
    speedLimitKmh: 25,
    color: "#06b6d4", // Cyan
    description: "Export and transshipment vehicle holding yard",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1175, 6.1210],
          [81.1205, 6.1210],
          [81.1205, 6.1245],
          [81.1175, 6.1245],
          [81.1175, 6.1210],
        ],
      ],
    },
  },
  {
    name: "Container Yard 1 (West Quay Apron)",
    code: "CY-01",
    category: "container",
    capacity: 2200,
    currentCount: 0,
    speedLimitKmh: 20,
    color: "#10b981", // Emerald
    description: "Primary import/export TEU yard serviced by STS cranes at Berth 01-02",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1135, 6.1165],
          [81.1170, 6.1165],
          [81.1170, 6.1200],
          [81.1135, 6.1200],
          [81.1135, 6.1165],
        ],
      ],
    },
  },
  {
    name: "Container Yard 2 (East Terminal)",
    code: "CY-02",
    category: "container",
    capacity: 1800,
    currentCount: 0,
    speedLimitKmh: 20,
    color: "#059669", // Dark Green
    description: "Empty and general cargo container storage area",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1175, 6.1165],
          [81.1210, 6.1165],
          [81.1210, 6.1200],
          [81.1175, 6.1200],
          [81.1175, 6.1165],
        ],
      ],
    },
  },
  {
    name: "Customs & Inspection Yard",
    code: "CUS-01",
    category: "customs",
    capacity: 400,
    currentCount: 0,
    speedLimitKmh: 15,
    color: "#f59e0b", // Amber
    description: "Sri Lanka Customs physical examination and scanning facility",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1215, 6.1215],
          [81.1245, 6.1215],
          [81.1245, 6.1245],
          [81.1215, 6.1245],
          [81.1215, 6.1215],
        ],
      ],
    },
  },
  {
    name: "Maintenance & Heavy Workshop",
    code: "MNT-01",
    category: "maintenance",
    capacity: 150,
    currentCount: 0,
    speedLimitKmh: 15,
    color: "#ef4444", // Red
    description: "Mechanical repair workshop, fueling station and tire service bay",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1215, 6.1170],
          [81.1245, 6.1170],
          [81.1245, 6.1200],
          [81.1215, 6.1200],
          [81.1215, 6.1170],
        ],
      ],
    },
  },
  {
    name: "Main Port Gate Terminal",
    code: "GATE-01",
    category: "gate",
    capacity: 100,
    currentCount: 0,
    speedLimitKmh: 10,
    color: "#8b5cf6", // Purple
    description: "Security checkpoint, OCR gate lanes and weighbridge",
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [81.1250, 6.1190],
          [81.1275, 6.1190],
          [81.1275, 6.1220],
          [81.1250, 6.1220],
          [81.1250, 6.1190],
        ],
      ],
    },
  },
];

async function seedDatabase() {
  console.log("Connecting to database:", MONGODB_URI.replace(/:([^:@]+)@/, ":****@"));
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully.");

  // 1. Seed System Settings
  const settings = [
    { key: "GPS_MIN_ACCURACY_METERS", value: 50, description: "Maximum acceptable GPS accuracy radius in meters" },
    { key: "GPS_STALE_THRESHOLD_SECONDS", value: 60, description: "Seconds before location is considered stale" },
    { key: "GPS_OFFLINE_THRESHOLD_SECONDS", value: 180, description: "Seconds before device is considered offline" },
    { key: "GPS_INTERRUPTED_THRESHOLD_SECONDS", value: 90, description: "Seconds before active duty tracking is marked interrupted" },
    { key: "GEOFENCE_HYSTERESIS_COUNT", value: 2, description: "Consecutive GPS readings required to confirm yard change" },
    { key: "MOVING_SAMPLING_INTERVAL_SECONDS", value: 5, description: "Sampling interval while moving" },
    { key: "IDLE_SAMPLING_INTERVAL_SECONDS", value: 30, description: "Sampling interval while stationary" },
    { key: "PARKED_SAMPLING_INTERVAL_SECONDS", value: 60, description: "Sampling interval while parked" },
  ];

  for (const s of settings) {
    await SystemSetting.findOneAndUpdate({ key: s.key }, s, { upsert: true, new: true });
  }
  console.log("Seeded system settings.");

  // 2. Seed Yards
  const createdYards = [];
  for (const y of YARDS_DATA) {
    const yard = await Yard.findOneAndUpdate(
      { code: y.code },
      y,
      { upsert: true, new: true }
    );
    createdYards.push(yard);
  }
  console.log(`Seeded ${createdYards.length} yards.`);

  // 3. Seed Users
  const passwordHash = await bcrypt.hash("admin123", 10);
  const driverHash = await bcrypt.hash("driver123", 10);

  const usersData = [
    {
      username: "admin",
      email: "admin@hipg.lk",
      passwordHash,
      fullName: "Port General Administrator",
      role: "admin",
      phone: "+94 77 123 4567",
      active: true,
    },
    {
      username: "supervisor",
      email: "supervisor@hipg.lk",
      passwordHash,
      fullName: "Yard Shift Supervisor",
      role: "supervisor",
      phone: "+94 77 234 5678",
      active: true,
    },
    {
      username: "operator",
      email: "operator@hipg.lk",
      passwordHash,
      fullName: "TOS Operations Controller",
      role: "operator",
      phone: "+94 77 345 6789",
      active: true,
    },
    {
      username: "driver1",
      email: "driver1@hipg.lk",
      passwordHash: driverHash,
      fullName: "Kamal Perera",
      role: "driver",
      phone: "+94 77 456 7890",
      active: true,
    },
    {
      username: "driver2",
      email: "driver2@hipg.lk",
      passwordHash: driverHash,
      fullName: "Sunil Shantha",
      role: "driver",
      phone: "+94 77 567 8901",
      active: true,
    },
    {
      username: "driver3",
      email: "driver3@hipg.lk",
      passwordHash: driverHash,
      fullName: "Nuwan Pradeep",
      role: "driver",
      phone: "+94 77 678 9012",
      active: true,
    },
  ];

  const userMap = new Map();
  for (const u of usersData) {
    const user = await User.findOneAndUpdate(
      { username: u.username },
      u,
      { upsert: true, new: true }
    );
    userMap.set(u.username, user);
  }
  console.log(`Seeded ${usersData.length} users.`);

  // 4. Seed Vehicles (10 vehicles)
  const vehiclesData = [
    { vehicleNumber: "TT-101", type: "terminal_tractor", makeModel: "Kalmar TT612d Heavy 4x2", licensePlate: "SP-TT-0101", maxSpeedKmh: 45 },
    { vehicleNumber: "TT-102", type: "terminal_tractor", makeModel: "Kalmar TT612d Heavy 4x2", licensePlate: "SP-TT-0102", maxSpeedKmh: 45 },
    { vehicleNumber: "TT-103", type: "terminal_tractor", makeModel: "Terberg YT222 Yard Tractor", licensePlate: "SP-TT-0103", maxSpeedKmh: 45 },
    { vehicleNumber: "RS-201", type: "reach_stacker", makeModel: "Sany SRSC45H1 45T", licensePlate: "SP-RS-0201", maxSpeedKmh: 30 },
    { vehicleNumber: "RS-202", type: "reach_stacker", makeModel: "Kalmar DRG450 Gloria", licensePlate: "SP-RS-0202", maxSpeedKmh: 30 },
    { vehicleNumber: "FL-301", type: "forklift", makeModel: "Toyota 8FD160 16T Heavy", licensePlate: "SP-FL-0301", maxSpeedKmh: 25 },
    { vehicleNumber: "SB-401", type: "shuttle_bus", makeModel: "Toyota Coaster 30-Seater", licensePlate: "SP-SB-0401", maxSpeedKmh: 50 },
    { vehicleNumber: "PU-501", type: "pickup", makeModel: "Toyota Hilux 4x4 Yard Utility", licensePlate: "SP-PU-0501", maxSpeedKmh: 60 },
    { vehicleNumber: "PU-502", type: "pickup", makeModel: "Isuzu D-Max Technical Patrol", licensePlate: "SP-PU-0502", maxSpeedKmh: 60 },
    { vehicleNumber: "PC-601", type: "patrol_car", makeModel: "Mitsubishi L200 Port Security", licensePlate: "SP-PC-0601", maxSpeedKmh: 60 },
  ];

  const vehicleMap = new Map();
  for (const v of vehiclesData) {
    const vehicle = await Vehicle.findOneAndUpdate(
      { vehicleNumber: v.vehicleNumber },
      { ...v, status: "active" },
      { upsert: true, new: true }
    );
    vehicleMap.set(v.vehicleNumber, vehicle);

    // Initialize or verify latestLocation placeholder with safe coordinates in Ro-Ro Yard 1
    const defaultCoords = [81.1155, 6.1225];
    await LatestLocation.findOneAndUpdate(
      { vehicleId: vehicle._id },
      {
        vehicleId: vehicle._id,
        source: "PWA_BROWSER_GPS",
        location: { type: "Point", coordinates: defaultCoords },
        accuracy: 8.5,
        speed: 0,
        heading: 90,
        gpsTimestamp: new Date(),
        lastReceivedGpsTime: new Date(),
        lastAcceptedGpsTime: new Date(),
        lastProcessedTime: new Date(),
        trackingStatus: "NOT_ON_DUTY",
        currentYardId: createdYards[0]._id,
        isMoving: false,
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${vehiclesData.length} vehicles & initialized latestLocation records.`);

  // 5. Seed Drivers
  const driversData = [
    { username: "driver1", employeeId: "EMP-001", licenseNumber: "DL-984210", licenseExpiry: new Date("2028-12-31"), assignedVehicle: "TT-101" },
    { username: "driver2", employeeId: "EMP-002", licenseNumber: "DL-652391", licenseExpiry: new Date("2029-06-30"), assignedVehicle: "TT-102" },
    { username: "driver3", employeeId: "EMP-003", licenseNumber: "DL-431802", licenseExpiry: new Date("2027-10-15"), assignedVehicle: "RS-201" },
  ];

  for (const d of driversData) {
    const user = userMap.get(d.username);
    const vehicle = vehicleMap.get(d.assignedVehicle);
    if (user && vehicle) {
      await Driver.findOneAndUpdate(
        { userId: user._id },
        {
          userId: user._id,
          employeeId: d.employeeId,
          licenseNumber: d.licenseNumber,
          licenseExpiry: d.licenseExpiry,
          assignedVehicleId: vehicle._id,
          status: "available",
        },
        { upsert: true, new: true }
      );
      await Vehicle.findByIdAndUpdate(vehicle._id, { assignedDriverId: user._id });
    }
  }
  console.log(`Seeded ${driversData.length} driver profiles.`);

  // 6. Seed GPS Devices
  const devicesData = [
    { deviceId: "DEV-PWA-001", name: "Driver 1 Mobile Browser PWA", type: "PWA_BROWSER_GPS", vehicle: "TT-101" },
    { deviceId: "DEV-PWA-002", name: "Driver 2 Mobile Browser PWA", type: "PWA_BROWSER_GPS", vehicle: "TT-102" },
    { deviceId: "DEV-PWA-003", name: "Driver 3 Mobile Browser PWA", type: "PWA_BROWSER_GPS", vehicle: "RS-201" },
    { deviceId: "DEV-ESP-001", name: "ESP32 Yard Tracker RS-202", type: "ESP32_GPS", vehicle: "RS-202" },
    { deviceId: "DEV-ESP-002", name: "ESP32 Yard Tracker FL-301", type: "ESP32_GPS", vehicle: "FL-301" },
    { deviceId: "DEV-COM-001", name: "Queclink Commercial Fleet GPS", type: "COMMERCIAL_GPS", vehicle: "PU-501" },
  ];

  for (const dev of devicesData) {
    const v = vehicleMap.get(dev.vehicle);
    await GpsDevice.findOneAndUpdate(
      { deviceId: dev.deviceId },
      {
        deviceId: dev.deviceId,
        name: dev.name,
        type: dev.type,
        assignedVehicleId: v ? v._id : null,
        status: "active",
        lastHeartbeatAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${devicesData.length} GPS devices.`);

  console.log("\nDATABASE SEED COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error("Error during database seed:", err);
  process.exit(1);
});

