from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json
import logging
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------- Setup ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_TOKEN_TTL_MINUTES = 60 * 24  # 1 day

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("server")

app = FastAPI(title="Campus Mobility API")
api = APIRouter(prefix="/api")

# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ---------- Models ----------
class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # 'passenger' | 'driver'
    phone: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_number: Optional[str] = None
    license_number: Optional[str] = None
    college_id: Optional[str] = None

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class RideRequestBody(BaseModel):
    pickup: str
    destination: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    scheduled_for: Optional[str] = None  # ISO string for future ride
    notes: Optional[str] = None

class RatingBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = None

class AvailabilityBody(BaseModel):
    is_online: bool
    lat: Optional[float] = None
    lng: Optional[float] = None

class LocationUpdateBody(BaseModel):
    lat: float
    lng: float

# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker

async def require_verified_driver(user: dict = Depends(require_role("driver"))) -> dict:
    if user.get("verification_status", "pending") != "approved":
        raise HTTPException(status_code=403, detail="Driver account is awaiting verification.")
    return user

# ---------- WebSocket manager ----------
class ConnectionManager:
    def __init__(self):
        # user_id -> list[WebSocket]
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.connections:
            self.connections[user_id] = [w for w in self.connections[user_id] if w is not ws]
            if not self.connections[user_id]:
                self.connections.pop(user_id, None)

    async def send_to(self, user_id: str, message: dict):
        for ws in list(self.connections.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                pass

    async def broadcast(self, message: dict, role: Optional[str] = None):
        for uid, sockets in list(self.connections.items()):
            for ws in list(sockets):
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    pass

manager = ConnectionManager()

async def notify_drivers_online(message: dict):
    """Send to all currently online drivers (live in connection manager)."""
    online_drivers = await db.users.find({"role": "driver", "is_online": True}, {"id": 1, "_id": 0}).to_list(500)
    for d in online_drivers:
        await manager.send_to(d["id"], message)

# ---------- Notifications ----------
async def create_notification(user_id: str, title: str, message: str, type: str):
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "read": False,
        "created_at": now_iso(),
    }
    try:
        await db.notifications.insert_one(notif)
        await manager.send_to(user_id, {"type": "notification", "notification": notif})
    except Exception:
        pass
    return notif

# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    if body.role not in ("passenger", "driver"):
        raise HTTPException(status_code=400, detail="Invalid role")
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "name": body.name,
        "email": email,
        "phone": body.phone,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
        "rating_avg": 5.0,
        "rating_count": 0,
        "is_online": False,
    }
    if body.role == "driver":
        doc["vehicle_model"] = body.vehicle_model or "E-Rickshaw"
        doc["vehicle_number"] = body.vehicle_number or ""
        doc["lat"] = None
        doc["lng"] = None
        doc["verification_status"] = "pending"
        doc["license_number"] = body.license_number or ""
        doc["college_id"] = body.college_id or ""
        doc["verification_notes"] = None
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, body.role)
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=86400, path="/")
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return {"user": doc, "token": token}

@api.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=86400, path="/")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Drivers ----------
@api.get("/drivers/online")
async def list_online_drivers(_user: dict = Depends(get_current_user)):
    docs = await db.users.find(
        {"role": "driver", "is_online": True},
        {"_id": 0, "password_hash": 0},
    ).to_list(200)
    return docs

@api.post("/drivers/availability")
async def set_availability(body: AvailabilityBody, user: dict = Depends(require_role("driver"))):
    if body.is_online and user.get("verification_status", "pending") != "approved":
        raise HTTPException(status_code=403, detail="Driver account is awaiting verification.")
    update = {"is_online": body.is_online}
    if body.lat is not None and body.lng is not None:
        update["lat"] = body.lat
        update["lng"] = body.lng
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    await manager.broadcast({"type": "driver_availability", "driver_id": user["id"], "is_online": body.is_online})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

@api.post("/drivers/location")
async def update_location(body: LocationUpdateBody, user: dict = Depends(require_verified_driver)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"lat": body.lat, "lng": body.lng}})
    await manager.broadcast({"type": "driver_location", "driver_id": user["id"], "lat": body.lat, "lng": body.lng})
    return {"ok": True}

@api.get("/drivers/{driver_id}")
async def get_driver(driver_id: str, _user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"id": driver_id, "role": "driver"}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Driver not found")
    return doc

# ---------- Rides ----------
async def _enrich_ride(ride: dict) -> dict:
    if ride.get("passenger_id"):
        p = await db.users.find_one({"id": ride["passenger_id"]}, {"_id": 0, "password_hash": 0})
        if p:
            ride["passenger"] = {"id": p["id"], "name": p["name"], "phone": p.get("phone"), "rating_avg": p.get("rating_avg", 5.0)}
    if ride.get("driver_id"):
        d = await db.users.find_one({"id": ride["driver_id"]}, {"_id": 0, "password_hash": 0})
        if d:
            ride["driver"] = {
                "id": d["id"],
                "name": d["name"],
                "phone": d.get("phone"),
                "vehicle_model": d.get("vehicle_model"),
                "vehicle_number": d.get("vehicle_number"),
                "rating_avg": d.get("rating_avg", 5.0),
                "lat": d.get("lat"),
                "lng": d.get("lng"),
            }
    return ride

@api.post("/rides/request")
async def request_ride(body: RideRequestBody, user: dict = Depends(require_role("passenger"))):
    ride_id = str(uuid.uuid4())
    doc = {
        "id": ride_id,
        "passenger_id": user["id"],
        "driver_id": None,
        "status": "requested",
        "pickup": body.pickup,
        "destination": body.destination,
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "dest_lat": body.dest_lat,
        "dest_lng": body.dest_lng,
        "scheduled_for": body.scheduled_for,
        "notes": body.notes,
        "created_at": now_iso(),
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
        "fare_estimate": 30,
        "rating": None,
        "feedback": None,
    }
    await db.rides.insert_one(doc)
    enriched = await _enrich_ride({**doc})
    enriched.pop("_id", None)
    # Notify all online drivers (only for immediate rides, not scheduled)
    if not body.scheduled_for:
        await notify_drivers_online({"type": "new_ride_request", "ride": enriched})
    await manager.send_to(user["id"], {"type": "ride_update", "ride": enriched})
    await create_notification(user["id"], "Ride Requested", f"Your ride from {body.pickup} to {body.destination} has been requested.", "ride_requested")
    return enriched

@api.get("/rides/mine")
async def my_rides(user: dict = Depends(get_current_user), status: Optional[str] = None):
    query: Dict[str, Any] = {}
    if user["role"] == "passenger":
        query["passenger_id"] = user["id"]
    elif user["role"] == "driver":
        query["driver_id"] = user["id"]
    else:
        query = {}
    if status:
        query["status"] = status
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _enrich_ride(r) for r in rides]

@api.get("/rides/available")
async def available_rides(user: dict = Depends(require_role("driver"))):
    rides = await db.rides.find(
        {"status": "requested", "driver_id": None, "scheduled_for": None},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return [await _enrich_ride(r) for r in rides]

@api.get("/rides/{ride_id}")
async def get_ride(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    return await _enrich_ride(ride)

@api.post("/rides/{ride_id}/accept")
async def accept_ride(ride_id: str, user: dict = Depends(require_verified_driver)):
    # Atomic accept: only one driver can win
    res = await db.rides.update_one(
        {"id": ride_id, "status": "requested", "driver_id": None},
        {"$set": {"status": "accepted", "driver_id": user["id"], "accepted_at": now_iso()}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=409, detail="Ride no longer available")
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    enriched = await _enrich_ride(ride)
    await manager.send_to(ride["passenger_id"], {"type": "ride_update", "ride": enriched})
    await manager.send_to(user["id"], {"type": "ride_update", "ride": enriched})
    await notify_drivers_online({"type": "ride_taken", "ride_id": ride_id})
    driver_name = user.get("name", "A driver")
    await create_notification(ride["passenger_id"], "Ride Accepted", f"{driver_name} has accepted your ride.", "ride_accepted")
    return enriched

@api.post("/rides/{ride_id}/reject")
async def reject_ride(ride_id: str, user: dict = Depends(require_role("driver"))):
    # Soft reject - log but ride stays available
    await db.ride_rejections.insert_one({"ride_id": ride_id, "driver_id": user["id"], "at": now_iso()})
    return {"ok": True}

@api.post("/rides/{ride_id}/start")
async def start_ride(ride_id: str, user: dict = Depends(require_verified_driver)):
    res = await db.rides.update_one(
        {"id": ride_id, "status": "accepted", "driver_id": user["id"]},
        {"$set": {"status": "in_progress", "started_at": now_iso()}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Cannot start ride")
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    enriched = await _enrich_ride(ride)
    await manager.send_to(ride["passenger_id"], {"type": "ride_update", "ride": enriched})
    await manager.send_to(user["id"], {"type": "ride_update", "ride": enriched})
    await create_notification(ride["passenger_id"], "Ride Started", "Your ride is now in progress. The driver is on the way to your destination.", "ride_started")
    return enriched

@api.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, user: dict = Depends(require_verified_driver)):
    res = await db.rides.update_one(
        {"id": ride_id, "status": "in_progress", "driver_id": user["id"]},
        {"$set": {"status": "completed", "completed_at": now_iso()}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Cannot complete ride")
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    enriched = await _enrich_ride(ride)
    await manager.send_to(ride["passenger_id"], {"type": "ride_update", "ride": enriched})
    await manager.send_to(user["id"], {"type": "ride_update", "ride": enriched})
    await create_notification(ride["passenger_id"], "Ride Completed", "Your ride has been completed. Please rate your experience.", "ride_completed")
    return enriched

@api.post("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot cancel")
    if user["role"] == "passenger" and ride["passenger_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "driver" and ride.get("driver_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "cancelled", "cancelled_at": now_iso()}})
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    enriched = await _enrich_ride(ride)
    if ride.get("passenger_id"):
        await manager.send_to(ride["passenger_id"], {"type": "ride_update", "ride": enriched})
    if ride.get("driver_id"):
        await manager.send_to(ride["driver_id"], {"type": "ride_update", "ride": enriched})
    # Notify the other party
    other_id = ride["driver_id"] if (user["role"] in ("passenger", "admin") and ride.get("driver_id")) else ride.get("passenger_id")
    if other_id:
        await create_notification(other_id, "Ride Cancelled", f"Your ride has been cancelled.", "ride_cancelled")
    return enriched

@api.post("/rides/{ride_id}/rate")
async def rate_ride(ride_id: str, body: RatingBody, user: dict = Depends(require_role("passenger"))):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride["passenger_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Only completed rides can be rated")
    if ride.get("rating"):
        raise HTTPException(status_code=400, detail="Already rated")
    await db.rides.update_one({"id": ride_id}, {"$set": {"rating": body.rating, "feedback": body.feedback}})
    # Update driver aggregate
    if ride.get("driver_id"):
        driver = await db.users.find_one({"id": ride["driver_id"]})
        if driver:
            cnt = driver.get("rating_count", 0)
            avg = driver.get("rating_avg", 5.0)
            new_cnt = cnt + 1
            new_avg = (avg * cnt + body.rating) / new_cnt
            await db.users.update_one(
                {"id": ride["driver_id"]},
                {"$set": {"rating_count": new_cnt, "rating_avg": round(new_avg, 2)}},
            )
            await manager.send_to(ride["driver_id"], {"type": "new_rating", "ride_id": ride_id, "rating": body.rating})
            await create_notification(ride["driver_id"], "New Rating", f"You received a {body.rating}-star rating on a recent ride.", "new_rating")
    return {"ok": True}

# ---------- Analytics ----------
@api.get("/analytics/driver")
async def driver_analytics(user: dict = Depends(require_role("driver"))):
    pipeline_status = [
        {"$match": {"driver_id": user["id"]}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = {row["_id"]: row["count"] async for row in db.rides.aggregate(pipeline_status)}
    total = sum(status_counts.values())
    completed = status_counts.get("completed", 0)
    active = status_counts.get("accepted", 0) + status_counts.get("in_progress", 0)
    driver = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    # last 7 days timeline
    rides = await db.rides.find({"driver_id": user["id"], "status": "completed"}, {"_id": 0}).to_list(500)
    by_day: Dict[str, int] = {}
    for r in rides:
        if r.get("completed_at"):
            day = r["completed_at"][:10]
            by_day[day] = by_day.get(day, 0) + 1
    timeline = [{"day": d, "rides": c} for d, c in sorted(by_day.items())[-7:]]
    earnings = completed * 30
    return {
        "total_rides": total,
        "completed": completed,
        "active": active,
        "cancelled": status_counts.get("cancelled", 0),
        "rating_avg": driver.get("rating_avg", 5.0),
        "rating_count": driver.get("rating_count", 0),
        "earnings_estimate": earnings,
        "timeline": timeline,
        "status_breakdown": [{"name": k, "value": v} for k, v in status_counts.items()],
    }

@api.get("/analytics/passenger")
async def passenger_analytics(user: dict = Depends(require_role("passenger"))):
    pipeline_status = [
        {"$match": {"passenger_id": user["id"]}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = {row["_id"]: row["count"] async for row in db.rides.aggregate(pipeline_status)}
    total = sum(status_counts.values())
    return {
        "total_rides": total,
        "completed": status_counts.get("completed", 0),
        "active": status_counts.get("accepted", 0) + status_counts.get("in_progress", 0) + status_counts.get("requested", 0),
        "cancelled": status_counts.get("cancelled", 0),
        "status_breakdown": [{"name": k, "value": v} for k, v in status_counts.items()],
    }

@api.get("/analytics/demand")
async def demand_analytics(_user: dict = Depends(get_current_user)):
    rides = await db.rides.find({}, {"_id": 0, "created_at": 1, "pickup": 1}).to_list(2000)
    by_hour = [0] * 24
    by_pickup: Dict[str, int] = {}
    for r in rides:
        try:
            dt = datetime.fromisoformat(r["created_at"])
            by_hour[dt.hour] += 1
        except Exception:
            pass
        p = r.get("pickup") or "Unknown"
        by_pickup[p] = by_pickup.get(p, 0) + 1
    hourly = [{"hour": f"{i:02d}", "rides": c} for i, c in enumerate(by_hour)]
    top_pickups = sorted(by_pickup.items(), key=lambda x: x[1], reverse=True)[:5]
    return {
        "hourly_demand": hourly,
        "top_pickups": [{"location": k, "rides": v} for k, v in top_pickups],
        "total_rides": len(rides),
    }

# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_users = await db.users.count_documents({})
    total_drivers = await db.users.count_documents({"role": "driver"})
    online_drivers = await db.users.count_documents({"role": "driver", "is_online": True})
    pending_drivers = await db.users.count_documents({"role": "driver", "verification_status": "pending"})
    approved_drivers = await db.users.count_documents({"role": "driver", "verification_status": "approved"})
    rejected_drivers = await db.users.count_documents({"role": "driver", "verification_status": "rejected"})
    pipeline_status = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = {row["_id"]: row["count"] async for row in db.rides.aggregate(pipeline_status)}
    total_rides = sum(status_counts.values())
    active = status_counts.get("requested", 0) + status_counts.get("accepted", 0) + status_counts.get("in_progress", 0)
    completed = status_counts.get("completed", 0)
    cancelled = status_counts.get("cancelled", 0)
    revenue = completed * 30
    rides = await db.rides.find({"status": "completed"}, {"_id": 0, "completed_at": 1}).to_list(2000)
    by_day: Dict[str, int] = {}
    for r in rides:
        if r.get("completed_at"):
            day = r["completed_at"][:10]
            by_day[day] = by_day.get(day, 0) + 1
    timeline = [{"day": d, "rides": c} for d, c in sorted(by_day.items())[-7:]]
    return {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "online_drivers": online_drivers,
        "pending_drivers": pending_drivers,
        "approved_drivers": approved_drivers,
        "rejected_drivers": rejected_drivers,
        "total_rides": total_rides,
        "active_rides": active,
        "completed_rides": completed,
        "cancelled_rides": cancelled,
        "revenue_estimate": revenue,
        "daily_trend": timeline,
        "status_breakdown": [{"name": k, "value": v} for k, v in status_counts.items()],
    }

@api.get("/admin/recent-activity")
async def admin_recent_activity(user: dict = Depends(require_role("admin"))):
    recent = await db.rides.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return [await _enrich_ride(r) for r in recent]

@api.get("/admin/pending-drivers")
async def admin_pending_drivers(user: dict = Depends(require_role("admin"))):
    docs = await db.users.find(
        {"role": "driver", "verification_status": "pending"},
        {"_id": 0, "password_hash": 0},
    ).to_list(200)
    return docs

@api.post("/admin/drivers/{driver_id}/approve")
async def admin_approve_driver(driver_id: str, user: dict = Depends(require_role("admin"))):
    res = await db.users.update_one(
        {"id": driver_id, "role": "driver"},
        {"$set": {"verification_status": "approved", "verification_notes": None}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    updated = await db.users.find_one({"id": driver_id}, {"_id": 0, "password_hash": 0})
    await create_notification(driver_id, "Driver Verified", "Your driver account has been approved. You can now go online and accept rides.", "driver_verified")
    return updated

class RejectBody(BaseModel):
    notes: Optional[str] = None

@api.post("/admin/drivers/{driver_id}/reject")
async def admin_reject_driver(driver_id: str, body: RejectBody, user: dict = Depends(require_role("admin"))):
    res = await db.users.update_one(
        {"id": driver_id, "role": "driver"},
        {"$set": {"verification_status": "rejected", "verification_notes": body.notes, "is_online": False}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    updated = await db.users.find_one({"id": driver_id}, {"_id": 0, "password_hash": 0})
    notes = body.notes or "No reason provided"
    await create_notification(driver_id, "Driver Verification Rejected", f"Your driver verification was rejected. Reason: {notes}", "driver_rejected")
    return updated

# ---------- Notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"user_id": user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return notifs

@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": count}

@api.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}

# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "campus-mobility", "ok": True}

# ---------- WebSocket ----------
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4401)
        return
    await manager.connect(user_id, websocket)
    try:
        await websocket.send_text(json.dumps({"type": "connected", "user_id": user_id}))
        while True:
            await websocket.receive_text()  # heartbeat / ignore client messages
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)

# Include router
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Seeding ----------
async def seed_data():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.rides.create_index("id", unique=True)
    await db.rides.create_index("passenger_id")
    await db.rides.create_index("driver_id")
    await db.rides.create_index("status")

    seed = [
        {"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"], "name": "Admin", "role": "admin"},
        {"email": "passenger@iitr.ac.in", "password": "passenger123", "name": "Aarav Sharma", "role": "passenger", "phone": "+91 90000 00001"},
        {"email": "driver1@iitr.ac.in", "password": "driver123", "name": "Ravi Kumar", "role": "driver", "phone": "+91 90000 11111", "vehicle_model": "Mahindra Treo E-Rickshaw", "vehicle_number": "UK07 AB 1234", "lat": 29.8650, "lng": 77.8964, "is_online": True, "rating_avg": 4.8, "rating_count": 24},
        {"email": "driver2@iitr.ac.in", "password": "driver123", "name": "Suresh Yadav", "role": "driver", "phone": "+91 90000 22222", "vehicle_model": "Piaggio Ape E-City", "vehicle_number": "UK07 CD 5678", "lat": 29.8665, "lng": 77.8985, "is_online": True, "rating_avg": 4.6, "rating_count": 18},
        {"email": "driver3@iitr.ac.in", "password": "driver123", "name": "Vikram Singh", "role": "driver", "phone": "+91 90000 33333", "vehicle_model": "Mahindra Treo E-Rickshaw", "vehicle_number": "UK07 EF 9012", "lat": 29.8640, "lng": 77.8945, "is_online": False, "rating_avg": 4.9, "rating_count": 32},
    ]
    for s in seed:
        existing = await db.users.find_one({"email": s["email"]})
        if existing:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "name": s["name"],
            "email": s["email"],
            "role": s["role"],
            "phone": s.get("phone"),
            "password_hash": hash_password(s["password"]),
            "created_at": now_iso(),
            "rating_avg": s.get("rating_avg", 5.0),
            "rating_count": s.get("rating_count", 0),
            "is_online": s.get("is_online", False),
        }
        if s["role"] == "driver":
            doc["vehicle_model"] = s.get("vehicle_model")
            doc["vehicle_number"] = s.get("vehicle_number")
            doc["lat"] = s.get("lat")
            doc["lng"] = s.get("lng")
            doc["verification_status"] = "approved"
            doc["license_number"] = s.get("license_number", "")
            doc["college_id"] = s.get("college_id", "")
            doc["verification_notes"] = None
        await db.users.insert_one(doc)
        logger.info(f"Seeded user {s['email']}")

    # Seed some historical rides
    if await db.rides.count_documents({}) == 0:
        passenger = await db.users.find_one({"email": "passenger@iitr.ac.in"})
        d1 = await db.users.find_one({"email": "driver1@iitr.ac.in"})
        d2 = await db.users.find_one({"email": "driver2@iitr.ac.in"})
        locations = ["Bhawan Main Gate", "Lecture Hall Complex", "MAC", "Library", "NC Hostel", "Tinkering Lab", "Sports Complex"]
        import random
        for i in range(18):
            created = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 6), hours=random.randint(0, 23))
            driver = random.choice([d1, d2])
            pick, drop = random.sample(locations, 2)
            ride = {
                "id": str(uuid.uuid4()),
                "passenger_id": passenger["id"],
                "driver_id": driver["id"],
                "status": "completed",
                "pickup": pick,
                "destination": drop,
                "pickup_lat": 29.864 + random.random() * 0.01,
                "pickup_lng": 77.894 + random.random() * 0.01,
                "dest_lat": 29.864 + random.random() * 0.01,
                "dest_lng": 77.894 + random.random() * 0.01,
                "scheduled_for": None,
                "notes": None,
                "created_at": created.isoformat(),
                "accepted_at": (created + timedelta(minutes=1)).isoformat(),
                "started_at": (created + timedelta(minutes=3)).isoformat(),
                "completed_at": (created + timedelta(minutes=12)).isoformat(),
                "cancelled_at": None,
                "fare_estimate": 30,
                "rating": random.choice([4, 5, 5, 5]),
                "feedback": None,
            }
            await db.rides.insert_one(ride)
        logger.info("Seeded 18 historical rides")

@app.on_event("startup")
async def on_startup():
    try:
        await seed_data()
    except Exception as e:
        logger.exception(f"Seed failed: {e}")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
