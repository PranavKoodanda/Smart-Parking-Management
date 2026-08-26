from dotenv import load_dotenv
from pathlib import Path
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import hmac
import hashlib
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# Password hashing utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT token utilities
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth dependency
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Admin-only dependency
async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Pydantic Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    email: str
    name: str
    role: str
    created_at: datetime

class ParkingConfigCreate(BaseModel):
    vehicle_type: str
    slots_total: int
    price_per_hour: float

class ParkingConfigResponse(BaseModel):
    id: str
    vehicle_type: str
    slots_total: int
    slots_available: int
    price_per_hour: float

class BookingCreate(BaseModel):
    vehicle_number: str
    vehicle_type: str
    duration_hours: float
    booking_type: str  # "online" or "on-spot"

class BookingExtend(BaseModel):
    additional_hours: float

class BookingResponse(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    vehicle_number: str
    vehicle_type: str
    slot_number: str
    entry_time: datetime
    exit_time: datetime
    duration_hours: float
    amount: float
    status: str
    booking_type: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    payment_status: Optional[str] = None
    cancellation_fee: Optional[float] = None
    created_at: datetime

class PaymentVerifyAndBookRequest(BaseModel):
    booking: BookingCreate
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class SettingsUpdate(BaseModel):
    cancellation_type: str  # "fixed" or "percentage"
    cancellation_value: float

def get_razorpay_credentials() -> tuple[str, str]:
    key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    return key_id, key_secret

async def validate_booking_draft(booking: BookingCreate) -> tuple[dict, float]:
    config = await db.parking_config.find_one({"vehicle_type": booking.vehicle_type})
    if not config:
        raise HTTPException(status_code=404, detail="Vehicle type not configured")

    occupied = await db.bookings.count_documents({
        "vehicle_type": booking.vehicle_type,
        "status": "active"
    })
    available = config["slots_total"] - occupied
    if available <= 0:
        raise HTTPException(status_code=400, detail="No slots available")

    amount = round(config["price_per_hour"] * booking.duration_hours, 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid booking amount")
    return config, amount

async def assign_next_slot(vehicle_type: str) -> str:
    existing_slots = await db.bookings.find(
        {"vehicle_type": vehicle_type, "status": "active"},
        {"slot_number": 1}
    ).to_list(1000)
    used_slots = set()
    for booking in existing_slots:
        try:
            used_slots.add(int(str(booking["slot_number"]).split("-")[-1]))
        except (ValueError, TypeError):
            continue

    slot_num = 1
    while slot_num in used_slots:
        slot_num += 1

    return f"{vehicle_type}-{slot_num}"

# Auth Routes
@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    email = request.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(request.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": request.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    
    return {
        "_id": user_id,
        "email": email,
        "name": request.name,
        "role": "user",
        "created_at": user_doc["created_at"]
    }

@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    email = request.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    
    return {
        "_id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "created_at": user["created_at"]
    }

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Public Availability Route (No Auth)
@api_router.get("/public/availability")
async def get_public_availability():
    configs = await db.parking_config.find({}).to_list(100)
    result = []
    
    for config in configs:
        occupied = await db.bookings.count_documents({
            "vehicle_type": config["vehicle_type"],
            "status": "active"
        })
        available = config["slots_total"] - occupied
        result.append({
            "vehicle_type": config["vehicle_type"],
            "slots_total": config["slots_total"],
            "slots_available": available,
            "price_per_hour": config["price_per_hour"]
        })
    return result

# Parking Config Routes (Admin Only)
@api_router.post("/parking-config")
async def create_parking_config(
    config: ParkingConfigCreate,
    admin: dict = Depends(get_admin_user)
):
    existing = await db.parking_config.find_one({"vehicle_type": config.vehicle_type})
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle type already configured")
    
    doc = config.model_dump()
    result = await db.parking_config.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}

@api_router.get("/parking-config")
async def get_parking_configs(admin: dict = Depends(get_admin_user)):
    configs = await db.parking_config.find({}).to_list(100)
    result = []
    
    for config in configs:
        occupied = await db.bookings.count_documents({
            "vehicle_type": config["vehicle_type"],
            "status": "active"
        })
        available = config["slots_total"] - occupied
        result.append({
            "id": str(config["_id"]),
            "vehicle_type": config["vehicle_type"],
            "slots_total": config["slots_total"],
            "slots_available": available,
            "price_per_hour": config["price_per_hour"]
        })
    
    return result

@api_router.put("/parking-config/{vehicle_type}")
async def update_parking_config(
    vehicle_type: str,
    config: ParkingConfigCreate,
    admin: dict = Depends(get_admin_user)
):
    result = await db.parking_config.update_one(
        {"vehicle_type": vehicle_type},
        {"$set": config.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"message": "Config updated successfully"}

# Settings Routes (Admin Only)
@api_router.get("/settings")
async def get_settings(admin: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"key": "cancellation_policy"})
    if not settings:
        return {"cancellation_type": "fixed", "cancellation_value": 50}
    return settings.get("value", {"cancellation_type": "fixed", "cancellation_value": 50})

@api_router.put("/settings")
async def update_settings(
    settings: SettingsUpdate,
    admin: dict = Depends(get_admin_user)
):
    await db.settings.update_one(
        {"key": "cancellation_policy"},
        {"$set": {"value": settings.model_dump()}},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

# Booking Routes
@api_router.post("/payments/create-order")
async def create_payment_order(
    booking: BookingCreate,
    current_user: dict = Depends(get_current_user)
):
    _, amount = await validate_booking_draft(booking)
    razorpay_key_id, razorpay_key_secret = get_razorpay_credentials()
    amount_paise = int(round(amount * 100))

    try:
        order_response = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(razorpay_key_id, razorpay_key_secret),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"park_{current_user['_id'][:6]}_{int(datetime.now(timezone.utc).timestamp())}",
                "payment_capture": 1
            },
            timeout=15
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Failed to connect to payment gateway")

    if order_response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to create payment order")

    order = order_response.json()
    if not order.get("id"):
        raise HTTPException(status_code=502, detail="Invalid payment gateway response")

    await db.payment_orders.insert_one({
        "order_id": order["id"],
        "user_id": current_user["_id"],
        "booking_draft": booking.model_dump(),
        "amount": amount_paise,
        "currency": "INR",
        "status": "created",
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "razorpay_key_id": razorpay_key_id,
        "booking_preview": {
            "vehicle_number": booking.vehicle_number.upper(),
            "vehicle_type": booking.vehicle_type,
            "duration_hours": booking.duration_hours,
            "booking_type": booking.booking_type,
            "amount": amount
        }
    }

@api_router.post("/payments/verify-and-book")
async def verify_payment_and_create_booking(
    payload: PaymentVerifyAndBookRequest,
    current_user: dict = Depends(get_current_user)
):
    _, razorpay_key_secret = get_razorpay_credentials()
    signature_payload = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        razorpay_key_secret.encode("utf-8"),
        signature_payload,
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    order_doc = await db.payment_orders.find_one({
        "order_id": payload.razorpay_order_id,
        "user_id": current_user["_id"]
    })
    if not order_doc:
        raise HTTPException(status_code=404, detail="Payment order not found")
    if order_doc.get("status") != "created":
        raise HTTPException(status_code=400, detail="Payment order already processed")
    if order_doc.get("booking_draft") != payload.booking.model_dump():
        raise HTTPException(status_code=400, detail="Booking details changed. Please retry payment")

    _, amount = await validate_booking_draft(payload.booking)
    expected_amount_paise = int(round(amount * 100))
    if expected_amount_paise != order_doc.get("amount"):
        raise HTTPException(status_code=400, detail="Amount mismatch. Please retry payment")

    slot_number = await assign_next_slot(payload.booking.vehicle_type)
    entry_time = datetime.now(timezone.utc)
    exit_time = entry_time + timedelta(hours=payload.booking.duration_hours)

    booking_doc = {
        "user_id": current_user["_id"],
        "user_email": current_user["email"],
        "vehicle_number": payload.booking.vehicle_number.upper(),
        "vehicle_type": payload.booking.vehicle_type,
        "slot_number": slot_number,
        "entry_time": entry_time,
        "exit_time": exit_time,
        "duration_hours": payload.booking.duration_hours,
        "amount": amount,
        "status": "active",
        "booking_type": payload.booking.booking_type,
        "razorpay_order_id": payload.razorpay_order_id,
        "razorpay_payment_id": payload.razorpay_payment_id,
        "payment_status": "paid",
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.bookings.insert_one(booking_doc)
    await db.payment_orders.update_one(
        {"_id": order_doc["_id"]},
        {"$set": {
            "status": "paid",
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
            "booking_id": str(result.inserted_id),
            "paid_at": datetime.now(timezone.utc)
        }}
    )

    booking_doc["id"] = str(result.inserted_id)
    booking_doc.pop("_id", None)
    return booking_doc

@api_router.post("/bookings")
async def create_booking(
    booking: BookingCreate,
    current_user: dict = Depends(get_current_user)
):
    # Get parking config
    config = await db.parking_config.find_one({"vehicle_type": booking.vehicle_type})
    if not config:
        raise HTTPException(status_code=404, detail="Vehicle type not configured")
    
    # Check availability
    occupied = await db.bookings.count_documents({
        "vehicle_type": booking.vehicle_type,
        "status": "active"
    })
    available = config["slots_total"] - occupied
    
    if available <= 0:
        raise HTTPException(status_code=400, detail="No slots available")
    
    # Assign slot number
    existing_slots = await db.bookings.find(
        {"vehicle_type": booking.vehicle_type, "status": "active"},
        {"slot_number": 1}
    ).to_list(1000)
    used_slots = {int(b["slot_number"].split("-")[1]) for b in existing_slots}
    slot_num = 1
    while slot_num in used_slots:
        slot_num += 1
    
    slot_number = f"{booking.vehicle_type}-{slot_num}"
    
    # Calculate amount
    amount = config["price_per_hour"] * booking.duration_hours
    
    # Create booking
    entry_time = datetime.now(timezone.utc)
    exit_time = entry_time + timedelta(hours=booking.duration_hours)
    
    booking_doc = {
        "user_id": current_user["_id"],
        "user_email": current_user["email"],
        "vehicle_number": booking.vehicle_number.upper(),
        "vehicle_type": booking.vehicle_type,
        "slot_number": slot_number,
        "entry_time": entry_time,
        "exit_time": exit_time,
        "duration_hours": booking.duration_hours,
        "amount": amount,
        "status": "active",
        "booking_type": booking.booking_type,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.bookings.insert_one(booking_doc)
    booking_doc["id"] = str(result.inserted_id)
    booking_doc.pop("_id", None)
    
    return booking_doc

@api_router.get("/bookings/my")
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find(
        {"user_id": current_user["_id"]}
    ).sort("created_at", -1).to_list(1000)
    
    result = []
    for b in bookings:
        result.append({
            "id": str(b["_id"]),
            "user_id": b["user_id"],
            "vehicle_number": b["vehicle_number"],
            "vehicle_type": b["vehicle_type"],
            "slot_number": b["slot_number"],
            "entry_time": b["entry_time"],
            "exit_time": b["exit_time"],
            "duration_hours": b["duration_hours"],
            "amount": b["amount"],
            "status": b["status"],
            "booking_type": b["booking_type"],
            "razorpay_order_id": b.get("razorpay_order_id"),
            "razorpay_payment_id": b.get("razorpay_payment_id"),
            "payment_status": b.get("payment_status"),
            "cancellation_fee": b.get("cancellation_fee"),
            "created_at": b["created_at"]
        })
    
    return result

@api_router.get("/bookings/all")
async def get_all_bookings(admin: dict = Depends(get_admin_user)):
    bookings = await db.bookings.find({}).sort("created_at", -1).to_list(1000)
    
    result = []
    for b in bookings:
        result.append({
            "id": str(b["_id"]),
            "user_id": b["user_id"],
            "user_email": b.get("user_email"),
            "vehicle_number": b["vehicle_number"],
            "vehicle_type": b["vehicle_type"],
            "slot_number": b["slot_number"],
            "entry_time": b["entry_time"],
            "exit_time": b["exit_time"],
            "duration_hours": b["duration_hours"],
            "amount": b["amount"],
            "status": b["status"],
            "booking_type": b["booking_type"],
            "razorpay_order_id": b.get("razorpay_order_id"),
            "razorpay_payment_id": b.get("razorpay_payment_id"),
            "payment_status": b.get("payment_status"),
            "cancellation_fee": b.get("cancellation_fee"),
            "created_at": b["created_at"]
        })
    
    return result

@api_router.post("/bookings/{booking_id}/extend")
async def extend_booking(
    booking_id: str,
    extend: BookingExtend,
    current_user: dict = Depends(get_current_user)
):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["user_id"] != current_user["_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking["status"] != "active":
        raise HTTPException(status_code=400, detail="Can only extend active bookings")
    
    # Get price
    config = await db.parking_config.find_one({"vehicle_type": booking["vehicle_type"]})
    additional_amount = config["price_per_hour"] * extend.additional_hours
    
    # Update booking
    new_exit_time = booking["exit_time"] + timedelta(hours=extend.additional_hours)
    new_duration = booking["duration_hours"] + extend.additional_hours
    new_amount = booking["amount"] + additional_amount
    
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "exit_time": new_exit_time,
            "duration_hours": new_duration,
            "amount": new_amount
        }}
    )
    
    return {"message": "Booking extended successfully", "additional_amount": additional_amount}

@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["user_id"] != current_user["_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking["status"] != "active":
        raise HTTPException(status_code=400, detail="Booking already cancelled or completed")
    
    # Get cancellation policy
    settings = await db.settings.find_one({"key": "cancellation_policy"})
    policy = settings.get("value", {"cancellation_type": "fixed", "cancellation_value": 50}) if settings else {"cancellation_type": "fixed", "cancellation_value": 50}
    
    # Calculate cancellation fee
    if policy["cancellation_type"] == "fixed":
        cancellation_fee = policy["cancellation_value"]
    else:  # percentage
        cancellation_fee = (booking["amount"] * policy["cancellation_value"]) / 100
    
    # Update booking
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": "cancelled",
            "cancellation_fee": cancellation_fee
        }}
    )
    
    return {"message": "Booking cancelled", "cancellation_fee": cancellation_fee}

@api_router.post("/bookings/{booking_id}/complete")
async def complete_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["user_id"] != current_user["_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking["status"] != "active":
        raise HTTPException(status_code=400, detail="Booking not active")
    
    await db.bookings.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": "completed"}}
    )
    
    return {"message": "Booking completed successfully"}

# Admin Dashboard Stats
@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_bookings = await db.bookings.count_documents({})
    active_bookings = await db.bookings.count_documents({"status": "active"})
    
    # Calculate total revenue
    pipeline = [
        {"$group": {"_id": None, "total_revenue": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.bookings.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
    
    # Get slot stats
    configs = await db.parking_config.find({}).to_list(100)
    total_slots = sum(c["slots_total"] for c in configs)
    
    occupied_slots = 0
    for config in configs:
        occupied = await db.bookings.count_documents({
            "vehicle_type": config["vehicle_type"],
            "status": "active"
        })
        occupied_slots += occupied
    
    available_slots = total_slots - occupied_slots
    
    return {
        "total_bookings": total_bookings,
        "active_bookings": active_bookings,
        "total_revenue": total_revenue,
        "total_slots": total_slots,
        "occupied_slots": occupied_slots,
        "available_slots": available_slots
    }

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3000')],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin seeding
@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.payment_orders.create_index("order_id", unique=True)
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@parkspot.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
    
    # Seed default parking config if not exists
    if await db.parking_config.count_documents({}) == 0:
        default_configs = [
            {"vehicle_type": "2-Wheeler", "slots_total": 50, "price_per_hour": 10},
            {"vehicle_type": "4-Wheeler", "slots_total": 30, "price_per_hour": 20},
            {"vehicle_type": "4+ Wheeler", "slots_total": 20, "price_per_hour": 40}
        ]
        await db.parking_config.insert_many(default_configs)
    
    # Seed default settings
    if await db.settings.count_documents({"key": "cancellation_policy"}) == 0:
        await db.settings.insert_one({
            "key": "cancellation_policy",
            "value": {"cancellation_type": "fixed", "cancellation_value": 50}
        })

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
