# CampusGo — Real-Time Campus Mobility Platform

A centralized digital dispatch system for the IIT Roorkee e-rickshaw network. Passengers and drivers can discover, request, assign, and manage rides with real-time state synchronization across all clients.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI, Motor (async MongoDB), PyJWT + bcrypt |
| **Frontend** | React 19, react-router 7, Tailwind CSS 3, Radix UI primitives |
| **Maps** | React-Leaflet + CartoDB Dark Matter tiles + OSRM routing |
| **Charts** | Recharts |
| **Icons** | @phosphor-icons/react |
| **Real-time** | Native FastAPI WebSocket (`/api/ws`) |
| **Build** | CRACO (CRA override) |

## Project Structure

```
CampusGo-main/
├── backend/
│   ├── server.py             # FastAPI app: auth, rides, drivers, analytics, WS
│   ├── requirements.txt
│   ├── .env                  # MongoDB URI, JWT secret, admin creds
│   └── tests/
│       └── backend_test.py   # 18 pytest tests (100% passing)
├── frontend/
│   ├── src/
│   │   ├── App.js            # Routing, auth guards, layout
│   │   ├── index.js          # Entry point (React Query provider)
│   │   ├── pages/            # Landing, Login, Register, PassengerHome,
│   │   │                     # DriverDashboard, DriverInbox, DriverAnalytics,
│   │   │                     # AdminDashboard, Notifications, History, Profile
│   │   ├── components/       # AppLayout, LiveMap, Bits (StatCard, etc.)
│   │   ├── lib/              # api.js, AuthContext, SocketContext, locations
│   │   ├── hooks/            # use-toast (shadcn)
│   │   └── constants/testIds/
│   ├── public/index.html
│   ├── package.json
│   └── tailwind.config.js
├── memory/
│   └── PRD.md                # Product requirements document
├── test_reports/
│   └── iteration_1.json      # E2E test results and observations
└── design_guidelines.json    # Dark Swiss/high-contrast design system
```

## Features

### Authentication
- JWT-based custom auth with role separation (passenger / driver / admin)
- Register, login, logout, session persistence via `Authorization` header + localStorage

### Passenger
- Ride booking form with campus location selector (12 predefined IITR points)
- Optional ride scheduling and notes
- Live map showing online drivers + pickup/destination markers + route visualization via OSRM polylines
- Active ride lifecycle tracker (requested → accepted → in_progress → completed) with real-time route updates when driver location changes
- Post-ride rating (1–5 stars) with feedback
- Ride history with status filters
- Analytics summary (total, completed, active rides)

### Driver
- Online/offline toggle with location ping
- Real-time ride inbox (WebSocket push for new requests)
- Atomic first-driver-wins ride acceptance (409 on race conditions)
- Active ride management (accept → start → complete) with map showing driver → pickup → destination route polylines
- Driver verification system (license number, college ID — pending/approved/rejected)
- Analytics dashboard: timeline chart (7-day), status breakdown pie chart, earnings estimate
- Campus-wide demand analytics (hourly bar chart, top pickup points)
- Ride history with status filters

### Admin
- Dashboard with 7 stat cards (users, drivers, online, rides breakdown, revenue)
- Ride trend chart (7-day timeline) + status distribution pie chart
- Recent activity feed (last 10 rides, enriched with passenger/driver details)
- Driver verification queue with approve/reject actions

### Notifications
- Persistent notification inbox with read/unread tracking
- Real-time push via WebSocket `notification` events
- Bell icon with live unread count badge in sidebar + mobile header
- Dropdown preview of recent notifications
- Mark single or all notifications as read
- Notification types: ride events (requested, accepted, started, completed, cancelled), new ratings, driver verification status changes

### Real-Time
- WebSocket at `/api/ws?token=<jwt>` with auto-reconnect (2.5s)
- Events: `new_ride_request`, `ride_taken`, `ride_update`, `driver_availability`, `driver_location`, `new_rating`, `notification`

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB 6+ (local or Atlas)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
```

Edit `backend/.env` (defaults work for local MongoDB):
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="campus_mobility"
JWT_SECRET="<change-this-in-production>"
CORS_ORIGINS="http://localhost:3000"
ADMIN_EMAIL="admin@iitr.ac.in"
ADMIN_PASSWORD="admin123"
```

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The server auto-seeds: 1 admin, 1 passenger, 3 drivers, and 18 historical rides on first startup.

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Edit `frontend/.env`:
```
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
REACT_APP_RAZORPAY_KEY_ID=rzp_test_RTsX9RpaHtSX4g
```

`REACT_APP_RAZORPAY_KEY_ID` enables Razorpay test checkout after a driver accepts a passenger ride. This is a Create React App frontend, so use the `REACT_APP_` prefix, not `NEXT_PUBLIC_`. Do not put `RAZORPAY_KEY_SECRET` in `frontend/.env`; Razorpay secrets must stay server-side and should never be committed.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Run Tests (Backend)

```bash
cd backend
pytest tests/backend_test.py -v
```

Requires the server to be running. All 18 tests should pass.

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@iitr.ac.in | admin123 |
| Passenger | passenger@iitr.ac.in | passenger123 |
| Driver 1 | driver1@iitr.ac.in | driver123 |
| Driver 2 | driver2@iitr.ac.in | driver123 |
| Driver 3 | driver3@iitr.ac.in | driver123 |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register (passenger/driver) |
| POST | `/api/auth/login` | — | Login |
| POST | `/api/auth/logout` | — | Logout |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/drivers/online` | JWT | List online drivers |
| POST | `/api/drivers/availability` | Driver | Toggle online/offline + location |
| POST | `/api/drivers/location` | Driver | Update live location |
| GET | `/api/drivers/{id}` | JWT | Get driver profile |
| POST | `/api/rides/request` | Passenger | Request a ride |
| GET | `/api/rides/mine` | JWT | User's ride history |
| GET | `/api/rides/available` | Driver | Available ride requests |
| GET | `/api/rides/{id}` | JWT | Ride details |
| POST | `/api/rides/{id}/accept` | Driver | Accept a ride |
| POST | `/api/rides/{id}/reject` | Driver | Soft-reject a ride |
| POST | `/api/rides/{id}/payment` | Passenger | Mark accepted ride payment complete |
| POST | `/api/rides/{id}/start` | Driver | Start ride |
| POST | `/api/rides/{id}/complete` | Driver | Complete ride |
| POST | `/api/rides/{id}/cancel` | Passenger/Driver | Cancel ride |
| POST | `/api/rides/{id}/rate` | Passenger | Rate completed ride |
| GET | `/api/analytics/driver` | Driver | Driver analytics |
| GET | `/api/analytics/passenger` | Passenger | Passenger analytics |
| GET | `/api/analytics/demand` | JWT | Campus demand data |
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET | `/api/admin/recent-activity` | Admin | Last 10 enriched rides |
| GET | `/api/admin/pending-drivers` | Admin | Unverified drivers |
| POST | `/api/admin/drivers/{id}/approve` | Admin | Approve driver verification |
| POST | `/api/admin/drivers/{id}/reject` | Admin | Reject driver verification |
| GET | `/api/notifications` | JWT | User's notifications |
| GET | `/api/notifications/unread-count` | JWT | Unread notification count |
| POST | `/api/notifications/{id}/read` | JWT | Mark notification read |
| POST | `/api/notifications/read-all` | JWT | Mark all notifications read |
| WS | `/api/ws?token=` | JWT | Real-time events |

## Design System

- **Theme**: Dark, Swiss high-contrast archetype
- **Palette**: Zinc base (`#09090B` / `#18181B`) + Amber accent (`#FFB800`)
- **Typography**: Satoshi (headings), IBM Plex Sans (body), JetBrains Mono (data)
- **Maps**: CartoDB Dark Matter tile layer + OSRM routing engine for route polylines
- **Components**: Flat cards with 1px borders, subtle hover lift, no shadows
- **Accessibility**: `data-testid` on all interactive elements, 4.5:1 contrast minimum
