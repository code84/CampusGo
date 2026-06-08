# CampusGo — Real-Time Campus Mobility Platform

## Original Problem Statement
Real-Time Campus Mobility and Ride Management Platform for the IIT Roorkee
e-rickshaw network. A centralized digital system that lets passengers and
drivers discover, request, assign and manage rides — with real-time state
synchronization across all clients.

## User Choices
- Platform: **Campus Mobility** (option b)
- Auth: **JWT-based custom auth**
- Priorities: **WebSockets first**, **Live Map** next
- Visual style: **Dark, minimal**
- Demo data: **Yes** (admin, passenger, 3 drivers, 18 historical rides)

## User Personas
1. **Passenger** — student/staff requesting last-mile rides across campus.
2. **Driver** — e-rickshaw operator accepting & completing rides.
3. **Admin** — operations role (account exists; admin-only screens deferred).

## Core Requirements (static)
- Secure JWT auth with role separation (passenger / driver / admin).
- Driver availability (online/offline + location).
- Ride lifecycle: requested → accepted → in_progress → completed | cancelled.
- Real-time updates via WebSocket for ride state, driver availability and location.
- Driver dashboard with stats and analytics charts.
- Passenger booking flow with live map and active-ride tracking.
- Rate & review for completed rides; aggregate updates driver score.
- Ride history with filters for both roles.

## Architecture
- **Backend**: FastAPI (`/api` prefix) + Motor (async MongoDB) + PyJWT + bcrypt.
- **Realtime**: native FastAPI WebSocket at `/api/ws?token=<jwt>` with
  per-user connection registry and broadcast to online drivers.
- **Frontend**: React 19 + react-router 7 + Tailwind + Shadcn/UI primitives,
  Phosphor icons, Recharts, React-Leaflet (CartoDB Dark tiles).
- **Theme**: Custom Swiss/High-contrast dark palette (zinc + #FFB800 accent),
  Satoshi/IBM Plex/JetBrains Mono typography.

## What's Been Implemented (2026-06-04)
- JWT auth (register/login/logout/me) with bcrypt hashing.
- Role-aware routing on the frontend (passenger vs driver dashboards).
- Driver: online/offline toggle, location ping, ride inbox, active ride
  (start/complete), recent rides list.
- Passenger: ride booking form (pickup/destination from campus locations,
  optional scheduling, notes), live map showing drivers + pickup/dropoff,
  active ride lifecycle tracker, post-ride rating modal.
- Atomic accept (first-driver-wins via `update_one` with status guard, 409 on race).
- Analytics: driver timeline + status breakdown; passenger summary; demand
  (hourly + top pickups).
- History page with status filters for both roles.
- Profile page.
- Landing page with hero + features + CTA.
- Seed data: admin, 1 passenger, 3 drivers (2 online), 18 historical rides.
- 18/18 backend tests passing (see `/app/backend/tests/backend_test.py`).

## Test Credentials
See `/app/memory/test_credentials.md`.

## Prioritized Backlog
**P1**
- Live driver location ticking on the passenger map during accepted/in-progress rides (server endpoint exists; frontend periodic broadcast still needed).
- Admin console: assets/users overview, audit log viewer.
- Push/in-app notifications for ride state changes (toasts exist; persistent inbox missing).

**P2**
- Ride scheduling — currently stored but no scheduler runs at the scheduled time.
- Digital payment simulation (UPI QR).
- Demand forecasting (time-series on hourly_demand).
- Route polyline on map (currently only markers).
- Multi-driver matching strategy (nearest driver, ETA).

**P3**
- Move seed/rating/analytics to a Mongo aggregation pipeline.
- Pagination for `/api/rides/mine`.
- CORS hardening (currently `*`).

## Next Action Items
1. Add live driver-location streaming during an active ride.
2. Wire admin oversight screens (system-wide rides + audit log).
3. Implement scheduled-ride dispatcher (cron / background task).
