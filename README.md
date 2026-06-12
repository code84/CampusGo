# CampusGo - Real-Time Campus Mobility Platform

CampusGo is a full-stack campus ride dispatch system for the IIT Roorkee e-rickshaw network. It supports role-based passenger, driver, and admin workflows with live ride updates, maps, notifications, analytics, post-ride feedback, and Razorpay test checkout after driver acceptance.

## Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Razorpay Test Payment Flow](#razorpay-test-payment-flow)
- [Test Accounts](#test-accounts)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Design System](#design-system)
- [Security Notes](#security-notes)

## Features

### Passenger

- Register and login as a passenger.
- Request rides between predefined IIT Roorkee campus locations.
- Add optional schedule time and ride notes.
- See online drivers, pickup marker, destination marker, and route on the live map.
- Track ride lifecycle: `requested` -> `accepted` -> `in_progress` -> `completed`.
- Pay through Razorpay test checkout only after a driver accepts the ride.
- Cancel active rides before completion.
- Submit inline post-ride rating and feedback only after a completed unrated ride.
- View ride history with status filters.
- View passenger analytics such as total rides, completed rides, active rides, and status breakdown.

### Driver

- Register and login as a driver.
- Driver accounts enter a verification queue before full availability.
- Toggle online/offline availability with location updates.
- Receive real-time ride requests through WebSocket events.
- Accept or reject available ride requests.
- Atomic ride acceptance prevents two drivers from accepting the same ride.
- Start a ride only after passenger payment is marked complete.
- Complete active rides.
- View current ride route and rider details.
- View driver analytics, recent rides, ratings, and estimated earnings.

### Admin

- Login as admin.
- View platform dashboard stats for users, drivers, online drivers, rides, and revenue estimates.
- View recent ride activity.
- Review pending driver verification requests.
- Approve or reject drivers with optional notes.
- Monitor platform trends and ride status distribution.

### Real-Time System

- FastAPI WebSocket endpoint at `/api/ws?token=<jwt>`.
- Socket provider reconnects clients automatically.
- Live events include ride requests, ride updates, driver availability, driver location, notifications, and new ratings.

### Notifications

- Persistent notification inbox.
- Live unread notification count.
- Mark single notifications as read.
- Mark all notifications as read.
- Ride, rating, payment, and driver verification notification types.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, Motor, MongoDB, Pydantic, PyJWT, bcrypt |
| Frontend | React 18, React Router 7, CRACO, Tailwind CSS, Radix UI components |
| Maps | React-Leaflet, Leaflet, CartoDB Dark Matter tiles, OSRM routing |
| Charts | Recharts |
| Icons | Phosphor Icons |
| Payments | Razorpay Checkout test mode |
| Realtime | FastAPI WebSocket |
| Tests | pytest, requests, websockets |

## Project Structure

```text
CampusGo/
├── backend/
│   ├── server.py                 # FastAPI app, API routes, WebSocket, seed data
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Local backend env file, ignored by Git
│   ├── tests/
│   │   └── backend_test.py       # Backend API and WebSocket tests
│   └── venv/                     # Local virtualenv, ignored by Git
├── frontend/
│   ├── env.example               # Safe frontend env template
│   ├── package.json              # React app scripts and dependencies
│   ├── craco.config.js           # CRA override config
│   ├── tailwind.config.js        # Tailwind config
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js                # App routing and role guards
│       ├── index.js              # React entry point
│       ├── components/
│       │   ├── AppLayout.jsx     # Authenticated app shell
│       │   ├── Bits.jsx          # Shared UI primitives
│       │   ├── LiveMap.jsx       # Leaflet map and route rendering
│       │   └── ui/               # Radix/shadcn-style UI components
│       ├── constants/testIds/    # Test id constants
│       ├── hooks/                # Shared hooks
│       ├── lib/
│       │   ├── api.js            # Axios client and WebSocket URL helper
│       │   ├── AuthContext.jsx   # Auth state and token persistence
│       │   ├── SocketContext.jsx # WebSocket lifecycle
│       │   └── locations.js      # Campus location data
│       └── pages/
│           ├── Landing.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── PassengerHome.jsx
│           ├── DriverDashboard.jsx
│           ├── DriverInbox.jsx
│           ├── DriverAnalytics.jsx
│           ├── AdminDashboard.jsx
│           ├── History.jsx
│           ├── Notifications.jsx
│           └── Profile.jsx
├── memory/
│   └── PRD.md                    # Product requirement notes
├── test_reports/                 # Test report artifacts
├── tests/                        # Root test package placeholder
├── design_guidelines.json        # Visual design guidance
├── .gitignore
└── README.md
```

## Local Setup

### Prerequisites

- Python 3.11 or newer.
- Node.js 18 or newer.
- MongoDB 6 or newer, local or Atlas.
- Razorpay test key id for frontend checkout testing.

### 1. Clone

```bash
git clone https://github.com/code84/CampusGo.git
cd CampusGo
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="campus_mobility"
JWT_SECRET="change-this-in-production"
CORS_ORIGINS="http://localhost:3000"
ADMIN_EMAIL="admin@iitr.ac.in"
ADMIN_PASSWORD="admin123"
```

Start the backend:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Useful backend URLs:

- API root: `http://127.0.0.1:8000/api/`
- Swagger docs: `http://127.0.0.1:8000/docs`
- WebSocket: `ws://127.0.0.1:8000/api/ws?token=<jwt>`

The backend seeds the default admin, passenger, drivers, and historical ride data on startup if they do not already exist.

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`. You can copy from `frontend/env.example`:

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
REACT_APP_RAZORPAY_KEY_ID=rzp_test_RTsX9RpaHtSX4g
```

Start the frontend:

```bash
npm start
```

Open `http://localhost:3000`.

## Environment Variables

### Backend `.env`

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string. |
| `DB_NAME` | Yes | MongoDB database name. |
| `JWT_SECRET` | Yes | Secret used to sign JWT access tokens. |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins. |
| `ADMIN_EMAIL` | Yes | Seed admin email. |
| `ADMIN_PASSWORD` | Yes | Seed admin password. |

### Frontend `.env`

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Backend base URL without `/api`. |
| `REACT_APP_RAZORPAY_KEY_ID` | Yes for payment testing | Razorpay public test key id used by Checkout. |

This is a Create React App frontend, so client-exposed variables must use the `REACT_APP_` prefix. Do not use `NEXT_PUBLIC_` here.

## Razorpay Test Payment Flow

CampusGo uses Razorpay Checkout in test mode to demonstrate the payment process.

Current flow:

1. Passenger clicks **Request ride now**.
2. Backend creates a ride with `payment_status: pending` and `fare_estimate: 30`.
3. Driver accepts the ride.
4. Passenger sees **Pay ₹30 to start ride** below **Cancel ride**.
5. Razorpay Checkout opens from that payment button.
6. On successful test payment, frontend calls `POST /api/rides/{id}/payment`.
7. Backend stores `payment_id`, `payment_status: paid`, `fare_estimate`, and `paid_at`.
8. Driver receives a live update and can start the ride.
9. Backend blocks `POST /api/rides/{id}/start` until payment is paid.

Important security note: `REACT_APP_RAZORPAY_KEY_ID` is public and safe for the frontend. `RAZORPAY_KEY_SECRET` must stay server-side and must never be committed. The current integration is test/demo checkout and does not perform server-side Razorpay signature verification.

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@iitr.ac.in` | `admin123` |
| Passenger | `passenger@iitr.ac.in` | `passenger123` |
| Driver 1 | `driver1@iitr.ac.in` | `driver123` |
| Driver 2 | `driver2@iitr.ac.in` | `driver123` |
| Driver 3 | `driver3@iitr.ac.in` | `driver123` |

## API Reference

All REST endpoints are mounted under `/api`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register passenger or driver. |
| `POST` | `/auth/login` | Public | Login and receive JWT. |
| `POST` | `/auth/logout` | Cookie/session | Clear auth cookie. |
| `GET` | `/auth/me` | JWT | Return current user. |

### Drivers

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/drivers/online` | JWT | List online drivers. |
| `POST` | `/drivers/availability` | Driver | Toggle online status and update location. |
| `POST` | `/drivers/location` | Verified driver | Update live driver coordinates. |
| `GET` | `/drivers/{driver_id}` | JWT | Get public driver profile. |

### Rides

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/rides/request` | Passenger | Request a ride. |
| `GET` | `/rides/mine` | JWT | List current user's rides. |
| `GET` | `/rides/available` | Driver | List unassigned immediate ride requests. |
| `GET` | `/rides/{ride_id}` | JWT | Get ride details. |
| `POST` | `/rides/{ride_id}/accept` | Verified driver | Accept requested ride atomically. |
| `POST` | `/rides/{ride_id}/reject` | Driver | Soft reject a ride. |
| `POST` | `/rides/{ride_id}/payment` | Passenger | Mark accepted ride payment complete. |
| `POST` | `/rides/{ride_id}/start` | Verified driver | Start paid accepted ride. |
| `POST` | `/rides/{ride_id}/complete` | Verified driver | Complete in-progress ride. |
| `POST` | `/rides/{ride_id}/cancel` | Passenger or assigned driver | Cancel non-completed ride. |
| `POST` | `/rides/{ride_id}/rate` | Passenger | Rate completed ride and send feedback. |

### Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/analytics/driver` | Driver | Driver stats, timeline, status breakdown, earnings estimate. |
| `GET` | `/analytics/passenger` | Passenger | Passenger ride totals and status breakdown. |
| `GET` | `/analytics/demand` | JWT | Hourly demand and top pickup locations. |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/stats` | Admin | Platform stats. |
| `GET` | `/admin/recent-activity` | Admin | Recent enriched rides. |
| `GET` | `/admin/pending-drivers` | Admin | Pending driver verification queue. |
| `POST` | `/admin/drivers/{driver_id}/approve` | Admin | Approve driver verification. |
| `POST` | `/admin/drivers/{driver_id}/reject` | Admin | Reject driver verification with optional notes. |

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/notifications` | JWT | List user notifications. |
| `GET` | `/notifications/unread-count` | JWT | Return unread count. |
| `POST` | `/notifications/{notif_id}/read` | JWT | Mark notification as read. |
| `POST` | `/notifications/read-all` | JWT | Mark all notifications as read. |

### Health and Realtime

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | API health check under `/api/`. |
| `WS` | `/ws?token=<jwt>` | JWT | Authenticated realtime socket under `/api/ws`. |

## Testing

### Frontend build

```bash
cd frontend
npm run build
```

### Frontend tests

```bash
cd frontend
npm test -- --watchAll=false
```

### Backend tests

Start MongoDB and the backend server first, then run:

```bash
cd backend
venv\Scripts\python.exe -m pytest tests\backend_test.py -v
```

Current backend suite covers auth, driver availability, ride workflow, payment-before-start enforcement through the workflow, analytics, and WebSocket auth.

## Design System

- Dark Swiss/high-contrast visual language.
- Zinc base surfaces with amber `#FFB800` primary accent.
- Flat cards, 1px borders, minimal shadows, strong grid alignment.
- Satoshi-style display typography and compact uppercase metadata labels.
- JetBrains Mono-style numeric/data presentation.
- Live map uses dark tiles and route polylines.
- Interactive elements include `data-testid` attributes for reliable tests.

## Security Notes

- `.env` files are ignored by Git and should stay local.
- Do not commit JWT secrets, Razorpay secret keys, MongoDB credentials, or admin production passwords.
- Frontend Razorpay key id is public by design; Razorpay key secret is private and must remain server-side.
- Passwords are hashed with bcrypt.
- JWT auth supports `Authorization: Bearer <token>` and cookie fallback.
- Driver start is guarded server-side and requires a paid accepted ride.

## Common Commands

| Task | Command |
|---|---|
| Start backend | `cd backend`, then `uvicorn server:app --reload --host 0.0.0.0 --port 8000` |
| Start frontend | `cd frontend`, then `npm start` |
| Build frontend | `cd frontend`, then `npm run build` |
| Run backend tests | `cd backend`, then `venv\Scripts\python.exe -m pytest tests\backend_test.py -v` |
| Check backend syntax | `cd backend`, then `venv\Scripts\python.exe -m py_compile server.py` |

## Notes

- The backend stores ride payment metadata as `payment_id`, `payment_status`, `fare_estimate`, and `paid_at`.
- Scheduled rides are stored with `scheduled_for` and are not broadcast to available drivers immediately.
- Driver verification is required before driver availability/location/start actions that use `require_verified_driver`.
- This repository currently uses npm commands in the frontend workflow, although `package.json` includes Yarn package manager metadata.
