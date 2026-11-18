# Port Vehicle & Yard Tracking Management System (Peri Tracker)
### Unified Single Next.js Responsive Progressive Web Application (PWA)
**Deployment Target:** Hambantota International Port (HIPG), Sri Lanka

---

## 1. Architectural Overview

Peri Tracker is implemented as a single, unified Next.js Progressive Web Application (PWA) serving all operational roles across desktop, tablet, and mobile devices without requiring separate Flutter, React Native, or Android native codebases.

All roles share identical backend services, MongoDB Atlas database collections, Socket.IO real-time channels, and geospatial engines:
- **Desktop Web Users / TOS Operators**: Full multi-screen yard layouts, fleet grids, and dwell time analysis.
- **Port Supervisors**: Real-time vehicle location map, geofence audit streams, and interrupted duty session recovery.
- **System Administrators**: Fleet registry, GPS device pairing, and system policy threshold configuration.
- **Equipment Drivers**: Mobile PWA interface with high-contrast touch controls, foreground GPS tracking, and offline buffering.

```
                              ┌───────────────────────────────────────────────┐
                              │            SINGLE RESPONSIVE NEXT.JS PWA      │
                              │  (Desktop Web, Tablet, Mobile Driver / Admin) │
                              └───────────────────────┬───────────────────────┘
                                                      │
                         ┌────────────────────────────┼───────────────────────────┐
                         ▼                            ▼                           ▼
                 ┌───────────────┐            ┌───────────────┐           ┌───────────────┐
                 │ ServiceWorker │            │  GPS Engine   │           │   Socket.IO   │
                 │   (sw.js)     │            │(watchPosition)│           │    Client     │
                 └───────┬───────┘            └───────┬───────┘           └───────┬───────┘
                         │                            │                           │
                         │ (Cache-First Assets /      │ (Sample & Validate)       │
                         │  Network-First Nav)        ▼                           │
                         │                   ┌─────────────────┐                  │
                         │                   │ IndexedDB Queue │                  │
                         │                   │ (Offline Buffer)│                  │
                         │                   └────────┬────────┘                  │
                         │                            │                           │
                         │                            │ (POST /api/gps/batch)     │
                         ▼                            ▼                           ▼
      ═══════════════════════════════════════════════════════════════════════════════════════════
                                UNIFIED PERSISTENT NODE.JS SERVER
      ═══════════════════════════════════════════════════════════════════════════════════════════
                         ▲                            ▲                           ▲
                         │                            │                           │
                 ┌───────┴───────┐            ┌───────┴───────┐           ┌───────┴───────┐
                 │    Next.js    │            │ GPS Ingestion │           │   Socket.IO   │
                 │  App Router   │            │   Pipeline    │           │  Server (io)  │
                 └───────────────┘            └───────┬───────┘           └───────────────┘
                                                      │
                                                      ├───────────────────────────┐
                                                      ▼                           ▼
                                             ┌─────────────────┐         ┌─────────────────┐
                                             │ Geofence Engine │         │  Status Engine  │
                                             │(Turf Hysteresis)│         │(Online/Stale/Off│
                                             └────────┬────────┘         └────────┬────────┘
                                                      │                           │
                                                      ▼                           ▼
      ═══════════════════════════════════════════════════════════════════════════════════════════
                                        MONGODB ATLAS DATABASE
      ═══════════════════════════════════════════════════════════════════════════════════════════
       users • vehicles • drivers • gpsDevices • yards (GeoJSON) • latestLocations •
       locationHistory (2dsphere) • yardEvents • dutySessions • gpsUploadRecords • auditLogs
```

---

## 2. Technology Stack

- **Frontend Framework**: Next.js 15 (App Router), React 19, TypeScript (Strict).
- **Styling**: Tailwind CSS with custom port logistics palette.
- **Mapping & GIS**: MapLibre GL JS with OpenStreetMap raster tiles & GeoJSON yard boundaries.
- **Client Storage**: IndexedDB (via `idb`) for offline GPS queue persistence.
- **Backend & Real-Time**: Node.js, Express, Socket.IO 4.8, REST APIs.
- **Database**: MongoDB Atlas with Mongoose 8, 2dsphere geospatial indexing, and compound indexes.
- **Geofencing**: `@turf/boolean-point-in-polygon` with consecutive reading hysteresis.
- **Authentication**: JWT with secure HTTP-only cookies (`SameSite: Lax`), bcrypt password hashing, and API Key / Device Token authentication.

---

## 3. PWA Background Execution Limitations (Critical Architecture Policy)

> [!IMPORTANT]
> **Browser-Based PWA Background Execution Limitation**
> On Android and iOS mobile operating systems, web browsers strictly throttle or suspend JavaScript execution and the Geolocation API (`navigator.geolocation.watchPosition`) when the browser tab is hidden, minimized, or when the screen locks.
>
> A Service Worker is **not** a continuous background process and **cannot** be used to run persistent GPS tracking. Peri Tracker does not implement fake background tracking or claim guaranteed background execution.

### Lifecycle Management Protocol
Peri Tracker implements strict browser lifecycle listeners:
1. `document.visibilityState` / `visibilitychange`
2. `pageshow` / `pagehide`
3. `online` / `offline`
4. Geolocation error callbacks

#### When Application is Hidden or Suspended:
1. The driver's latest known coordinate and accuracy are preserved.
2. The interruption timestamp is logged.
3. The tracking state transitions to `TRACKING_INTERRUPTED`.
4. Any unsent GPS records remain safely stored in the client-side IndexedDB queue.
5. An interruption beacon is transmitted to `/api/duty/interrupt`.
6. The dashboard displays the vehicle in `TRACKING_INTERRUPTED` status and **never marks stale coordinates as live**.

#### When Application Returns to Foreground:
1. Authentication and active duty session are verified.
2. GPS permissions and network connectivity are validated.
3. `navigator.geolocation.watchPosition` is re-initialized.
4. The client flushes buffered records from IndexedDB to `/api/gps/batch`.
5. Tracking state transitions back to `TRACKING_ACTIVE`.
6. Server-side tracking status updates to `ONLINE`.

---

## 4. Mobile GPS Tracking Engine & Offline Queue

### GPS Sampling & Throttling
Browser `watchPosition` callbacks fire at arbitrary hardware intervals. The `GPSTrackingEngine` decouples raw callbacks from rate-controlled uploads:
- **Moving** (> 2 km/h): 5 seconds.
- **Stationary / Idle** (< 2 km/h): 30 seconds.
- **Parked**: 60 seconds.

### Ingestion Validation Filters
Records are rejected or flagged if:
- Latitude < -90 or > 90, Longitude < -180 or > 180.
- Accuracy radius > 50 meters (`GPS_MIN_ACCURACY_METERS`).
- Timestamp is > 5 minutes in the future or > 7 days in the past.
- Record ID already processed (server-side idempotency).

### Persistent IndexedDB Offline Buffer
- Database: `peri_gps_offline_db` / ObjectStore: `gps_upload_queue`.
- Storage limit: 5,000 records with FIFO eviction on storage quota warnings.
- Network retry policy: Exponential backoff with random jitter (1s to 30s).
- Record deletion: **Only** occurs upon verified HTTP 200/201 response from the server.

---

## 5. Duty Session Lifecycle & Supervisor Recovery

```
    ┌───────────────┐
    │  NOT_ON_DUTY  │
    └───────┬───────┘
            │ Driver selects vehicle & starts duty
            ▼
    ┌───────────────┐      Browser Hidden / Signal Drop
    │  DUTY_ACTIVE  │ ─────────────────────────────────┐
    └───────┬───────┘                                  ▼
            │                                ┌───────────────────┐
            │ Driver Ends Shift              │ DUTY_INTERRUPTED  │
            │                                └─────────┬─────────┘
            │                                          │
            │                         Supervisor Action│
            │                      ┌───────────────────┴───────────────────┐
            │                      ▼                                       ▼
            │             ┌─────────────────┐                     ┌─────────────────┐
            │             │  Resume Active  │                     │ Force Complete  │
            │             └────────┬────────┘                     └────────┬────────┘
            ▼                      │                                       ▼
    ┌───────────────┐              │                               ┌───────────────┐
    │DUTY_COMPLETED │ ◄────────────┴───────────────────────────────│DUTY_COMPLETED │
    └───────────────┘                                              └───────────────┘
```

1. **Duty Start**: Driver authenticates, chooses an active vehicle. Server verifies the vehicle is free of active duties (one active duty per vehicle constraint).
2. **Duty Tracking**: GPS records are tagged with `dutySessionId`. Uploads against non-active sessions are rejected.
3. **Duty Interruption**: Unplanned app closure sets `DUTY_INTERRUPTED` without prematurely completing the session.
4. **Supervisor Recovery**: Supervisors can inspect interrupted sessions on the dashboard and choose to either **Resume** or **Force Complete** with mandatory audit notes.

---

## 6. Geofencing Engine & Hysteresis

- Yard boundaries are stored as MongoDB GeoJSON `Polygon` types with 2dsphere indexing.
- Point-in-polygon queries execute via Turf.js.
- **Consecutive Reading Hysteresis**: Requires **2 consecutive GPS readings** inside a new polygon before triggering `YARD_ENTERED` or `YARD_CHANGED` events. This completely prevents boundary bouncing and GPS jitter false alarms.
- Readings with accuracy > 40m are suppressed from triggering boundary events.

---

## 7. Vehicle Tracking Status Classification

| Status | Threshold | Confidence | Dashboard Representation |
|---|---|---|---|
| `ONLINE` | GPS update < 60s ago | HIGH | Green pulsing beacon |
| `STALE` | GPS update 60s - 180s ago | MEDIUM | Amber badge (Not live) |
| `OFFLINE` | GPS update > 180s ago | LOW | Slate badge |
| `TRACKING_INTERRUPTED` | App suspended / closed during active duty | LOW | Red flashing alert |
| `NOT_ON_DUTY` | Vehicle has no active shift | NONE | Slate outline |

---

## 8. Database Architecture (13 Collections)

1. `users`: Credentials, roles (`admin`, `supervisor`, `operator`, `driver`), contact details.
2. `vehicles`: Vehicle number, type, make/model, status, assigned driver, current yard.
3. `drivers`: Driver employee ID, license expiry, assigned vehicle, active duty pointer.
4. `gpsDevices`: Device registry, source type (`PWA_BROWSER_GPS`, `ESP32_GPS`, etc.), API keys.
5. `yards`: GeoJSON polygons for Hambantota Port yards (Ro-Ro 1, Ro-Ro 2, Container 1, Container 2, Customs, Maintenance, Gate).
6. `latestLocations`: Microsecond vehicle positions with separate `lastReceivedGpsTime`, `lastAcceptedGpsTime`, and `lastProcessedTime`.
7. `locationHistory`: Historical breadcrumb logs indexed by `vehicleId` + `gpsTimestamp`.
8. `yardEvents`: Audit log of all `YARD_ENTERED`, `YARD_EXITED`, `YARD_CHANGED` events.
9. `dutySessions`: Complete duty lifecycle history, start/end locations, duration, supervisor recovery notes.
10. `gpsUploadRecords`: Server-side idempotency log preventing duplicate coordinate ingestion.
11. `auditLogs`: Security actions, logins, role modifications, supervisor overrides.
12. `notifications`: Alert subscriptions for interrupted duties, yard events, and device disconnects.
13. `systemSettings`: Configurable thresholds (accuracy limits, stale intervals, hysteresis count).

---

## 9. API Reference

### GPS Ingestion
- `POST /api/gps/location`: Ingest single location payload.
- `POST /api/gps/batch`: Ingest offline queue synchronization batch (up to 100 records).

### Duty Lifecycle
- `POST /api/duty/start`: Initialize active shift for driver and lock vehicle.
- `POST /api/duty/end`: Complete active shift, record duration, and unlock vehicle.
- `GET /api/duty/active`: Query driver's current duty session.
- `POST /api/duty/interrupt`: Report client suspension or network failure.
- `POST /api/duty/recover`: Supervisor override to resume or force-complete interrupted shifts.

### Fleet & Yards
- `GET /api/vehicles`: Fleet overview with live statuses and delta timestamps.
- `GET /api/yards`: Hambantota Port GeoJSON polygons and current yard occupancies.
- `GET /api/history`: Paginated historical GPS trail for breadcrumb replay.
- `GET /api/events`: Recent geofence boundary events.
- `GET /api/health`: System health, MongoDB status, memory, and uptime metrics.

---

## 10. Automated Test Suite

Run the full automated test suite covering all core requirements:

```bash
npm test
```

Test coverage includes:
- **Authentication**: JWT signing, verification, forged token rejection, role-based guards.
- **GPS Ingestion**: Coordinate bounds, poor accuracy filter (> 50m), future timestamp rejection, ESP32 normalizer.
- **Duty Lifecycle**: Session creation, vehicle conflict lock, interruption state, supervisor recovery.
- **Geofencing**: Point-in-polygon, boundary drift suppression, hysteresis confirmation (2 consecutive readings).
- **Status Classification**: Online, stale, offline, tracking interrupted, and duty separation.

---

## 11. Quick Start & Production Deployment

### Development Mode
```bash
# 1. Seed database with Hambantota Port yards, vehicles, and test users
npm run seed

# 2. Start unified Next.js + Socket.IO server
npm run dev
```

Visit:
- **Dashboard**: `http://localhost:3000/dashboard`
- **Driver Mobile PWA**: `http://localhost:3000/driver`
- **Sign In**: `http://localhost:3000/login`

### Default Demo Credentials
- **Admin**: `admin` / `admin123`
- **Supervisor**: `supervisor` / `admin123`
- **Operator**: `operator` / `admin123`
- **Driver 1**: `driver1` / `driver123`
- **Driver 2**: `driver2` / `driver123`

### Production Docker Deployment
```bash
docker-compose up -d --build
```

