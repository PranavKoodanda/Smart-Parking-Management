# Smart Parking System - Complete Project Explanation

## 1. PROJECT OVERVIEW

**Smart Parking** is a full-stack web application designed to manage parking spaces efficiently. It allows users to check real-time parking availability, book parking slots, make payments online, and extend their bookings. Administrators can manage parking configurations, view statistics, and set cancellation policies.

**Key Objective:** Eliminate manual parking slot management by providing a digital platform for seamless parking reservation and payment processing.

---

## 2. SYSTEM ARCHITECTURE

The project follows a **Client-Server Architecture** with:
- **Frontend:** React 18 (Single Page Application)
- **Backend:** FastAPI (Python async web framework)
- **Database:** MongoDB (NoSQL document database)
- **Payment Gateway:** Razorpay for online payment processing
- **Deployment:** Can be deployed on cloud services (supports CORS)

```
┌─────────────────────┐         ┌──────────────────────┐         ┌──────────────────┐
│  React Frontend     │         │  FastAPI Backend     │         │    MongoDB       │
│  (Port 3000)        │────────▶│  (Port 8000)         │────────▶│  (Cloud/Local)   │
│                     │         │                      │         │                  │
│  - Login/Register   │         │  - Auth Endpoints    │         │  - Users         │
│  - Booking Pages    │         │  - Booking API       │         │  - Bookings      │
│  - Payment Page     │         │  - Payment Handling  │         │  - Parking Config│
│  - Admin Dashboard  │         │  - Admin Stats       │         │  - Settings      │
└─────────────────────┘         └──────────────────────┘         └──────────────────┘
                                         │
                                         ▼
                                  ┌──────────────────┐
                                  │  Razorpay API    │
                                  │  (Payment)       │
                                  └──────────────────┘
```

---

## 3. TECHNOLOGY STACK

### Frontend
- **React 18.2** - UI framework
- **React Router DOM v6.22** - Client-side routing
- **Axios** - HTTP client for API calls
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Sonner** - Toast notification system

### Backend
- **FastAPI 0.110** - Modern Python web framework
- **Uvicorn 0.25** - ASGI server
- **Motor 3.3** - Async MongoDB driver
- **PyJWT** - JSON Web Token authentication
- **Bcrypt** - Password hashing
- **Pydantic 2.6** - Data validation
- **Razorpay** - Payment gateway SDK

### Database
- **MongoDB 4.5** - Document database
- **Collections:** users, bookings, parking_config, settings, payment_orders

---

## 4. FRONTEND STRUCTURE & PAGES

### 4.1 Routing Architecture
```
/                       → PublicAvailability (public)
/login                  → Login (public)
/register               → Register (public)
/dashboard              → UserDashboard (protected - users)
/payment                → PaymentPage (protected - users)
/admin                  → AdminDashboard (protected - admins only)
```

### 4.2 Core Pages & Functionality

#### **PublicAvailability.js** (Home Page)
- **Purpose:** Landing page showing real-time parking slot availability
- **Features:**
  - Displays available slots for each vehicle type (2-Wheeler, 4-Wheeler, Bus)
  - Shows total slots and current pricing per hour
  - Icons for each vehicle category
  - Call-to-action buttons for Login/Register
  - Fetches data from `/api/public/availability` (no auth required)

#### **Login.js**
- **Purpose:** User authentication
- **Features:**
  - Email and password input fields
  - Form validation
  - Calls `/api/auth/login` endpoint
  - Stores JWT token in cookies
  - Redirects to dashboard on success
  - Toast notifications for errors

#### **Register.js**
- **Purpose:** New user account creation
- **Features:**
  - Name, email, and password fields
  - Password minimum length validation
  - Calls `/api/auth/register` endpoint
  - Auto-login after registration
  - Redirects to dashboard

#### **UserDashboard.js**
- **Purpose:** Main user interface for parking bookings
- **Features:**
  - **Active Booking Display:** Shows current active parking with countdown timer
  - **Booking History:** Lists all past bookings with statuses
  - **Create New Booking Form:**
    - Vehicle number input
    - Vehicle type selection (2-Wheeler, 4-Wheeler, Bus)
    - Duration input (in hours)
    - Booking type (online or on-spot)
    - Redirects to payment page on submission
  - **Extend Booking:** Add extra hours to active booking
  - **Cancel Booking:** Cancel active booking with calculated cancellation fee
  - **Countdown Timer:** Real-time display of remaining parking time
  - Fetches from `/api/bookings/my` endpoint

#### **PaymentPage.js**
- **Purpose:** Razorpay payment processing
- **Features:**
  - Dynamically loads Razorpay checkout script
  - Receives booking draft from router state
  - Creates payment order via `/api/payments/create-order`
  - Opens Razorpay checkout modal
  - Verifies payment signature
  - Creates booking after successful payment via `/api/payments/verify-and-book`
  - Handles payment errors gracefully

#### **AdminDashboard.js**
- **Purpose:** Administrative control panel
- **Features:**
  - **Statistics Dashboard:**
    - Total bookings count
    - Active bookings count
    - Total revenue
    - Slot management (total, occupied, available)
  - **Parking Configuration Management:**
    - View all vehicle types with pricing
    - Edit slot counts and pricing per hour
  - **Booking Management:**
    - View all user bookings
    - Filter by status
  - **Settings Management:**
    - Configure cancellation policy (fixed amount or percentage)
    - Set cancellation fee value
  - Admin-only access control

### 4.3 Shared Components

#### **ProtectedRoute.js**
- **Purpose:** Route protection middleware
- **Features:**
  - Checks if user is authenticated
  - Enforces admin-only routes with `requireAdmin` prop
  - Shows loading spinner during auth check
  - Redirects to login if not authenticated
  - Redirects non-admins away from admin pages

#### **AuthContext.js**
- **Purpose:** Global authentication state management
- **Features:**
  - `useAuth()` hook for component access
  - State: `user`, `loading`
  - Methods:
    - `login(email, password)` - authenticates user
    - `register(email, password, name)` - creates new account
    - `logout()` - clears session
    - `checkAuth()` - verifies existing session
  - Automatically checks auth on app load
  - Handles API errors with user-friendly messages

---

## 5. BACKEND API ENDPOINTS

### 5.1 Authentication Endpoints (`/api/auth`)

#### **POST /auth/register**
- **Input:** `{ email, password, name }`
- **Output:** User object with JWT tokens in cookies
- **Logic:**
  - Validates email uniqueness
  - Hashes password using bcrypt
  - Creates user document in MongoDB
  - Issues access token (15 min expiry) and refresh token (7 days)
  - Sets httponly cookies for security

#### **POST /auth/login**
- **Input:** `{ email, password }`
- **Output:** User object with JWT tokens
- **Logic:**
  - Verifies email exists
  - Validates password against hash
  - Issues new JWT tokens

#### **POST /auth/logout**
- **Authentication:** Required (JWT)
- **Logic:** Deletes JWT cookies

#### **GET /auth/me**
- **Authentication:** Required (JWT)
- **Output:** Current user profile
- **Logic:** Verifies token validity and returns user data

---

### 5.2 Public Endpoints

#### **GET /public/availability**
- **Authentication:** Not required
- **Output:** Array of parking configurations with availability
```json
[
  {
    "vehicle_type": "2-Wheeler",
    "slots_total": 100,
    "slots_available": 45,
    "price_per_hour": 20
  }
]
```
- **Logic:** Queries parking_config, counts active bookings, calculates available slots

---

### 5.3 Parking Configuration Endpoints (`/api/parking-config`)

#### **POST /parking-config** (Admin only)
- **Input:** `{ vehicle_type, slots_total, price_per_hour }`
- **Logic:** Creates new vehicle type configuration

#### **GET /parking-config** (Admin only)
- **Output:** All parking configurations with real-time availability

#### **PUT /parking-config/{vehicle_type}** (Admin only)
- **Input:** `{ vehicle_type, slots_total, price_per_hour }`
- **Logic:** Updates pricing and slot count for vehicle type

---

### 5.4 Booking Endpoints (`/api/bookings`)

#### **POST /bookings** (For on-spot bookings, Authenticated)
- **Input:** `{ vehicle_number, vehicle_type, duration_hours, booking_type }`
- **Output:** Booking object with slot assignment
- **Logic:**
  - Validates vehicle type exists
  - Checks slot availability
  - Assigns next available slot (e.g., "2-Wheeler-1")
  - Calculates amount: price_per_hour × duration_hours
  - Sets entry_time as now, exit_time as now + duration
  - Creates booking in "active" status
  - Returns booking details

#### **GET /bookings/my** (Authenticated)
- **Output:** All bookings for current user
- **Sorting:** Most recent first

#### **GET /bookings/all** (Admin only)
- **Output:** All bookings in the system

#### **POST /bookings/{booking_id}/extend** (Authenticated)
- **Input:** `{ additional_hours }`
- **Logic:**
  - Validates booking exists and is active
  - Calculates additional charge
  - Updates exit_time and amount
  - Returns additional amount charged

#### **POST /bookings/{booking_id}/cancel** (Authenticated)
- **Logic:**
  - Validates booking is active
  - Applies cancellation policy (fixed or percentage)
  - Updates status to "cancelled"
  - Stores cancellation_fee
  - Returns refund amount after fee

#### **POST /bookings/{booking_id}/complete** (Authenticated)
- **Logic:** Marks booking as "completed"

---

### 5.5 Payment Endpoints (`/api/payments`)

#### **POST /payments/create-order** (Authenticated)
- **Input:** Booking draft object
- **Process:**
  1. Validates booking (checks availability and amount)
  2. Calls Razorpay API to create payment order
  3. Stores order details in payment_orders collection
  4. Returns `{ order_id, amount, currency, razorpay_key_id }`
- **Error Handling:** Validates amount, handles payment gateway errors

#### **POST /payments/verify-and-book** (Authenticated)
- **Input:** 
  ```json
  {
    "booking": { /* booking draft */ },
    "razorpay_order_id": "...",
    "razorpay_payment_id": "...",
    "razorpay_signature": "..."
  }
  ```
- **Process:**
  1. **Signature Verification:** Uses HMAC-SHA256 to verify payment authenticity
  2. **Order Validation:** Confirms order exists and hasn't been processed
  3. **Booking Validation:** Re-validates booking details and amount
  4. **Slot Assignment:** Assigns parking slot
  5. **Booking Creation:** Creates booking document with status "active" and payment info
  6. **Order Update:** Marks payment order as "paid"
- **Security:** Prevents replay attacks by checking order status

---

### 5.6 Settings Endpoints (`/api/settings`) (Admin only)

#### **GET /settings**
- **Output:** Current cancellation policy
```json
{
  "cancellation_type": "fixed",  // or "percentage"
  "cancellation_value": 50       // amount or percentage
}
```

#### **PUT /settings**
- **Input:** `{ cancellation_type, cancellation_value }`
- **Logic:** Updates system-wide settings using MongoDB upsert

---

### 5.7 Admin Statistics Endpoint

#### **GET /admin/stats** (Admin only)
- **Output:**
```json
{
  "total_bookings": 150,
  "active_bookings": 23,
  "total_revenue": 12500,
  "total_slots": 300,
  "occupied_slots": 45,
  "available_slots": 255
}
```
- **Logic:**
  - Counts all bookings and active ones
  - Aggregates total revenue from amount field
  - Calculates total and occupied slots across all vehicle types

---

## 6. DATABASE DESIGN

### MongoDB Collections

#### **users**
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password_hash: String,
  name: String,
  role: String, // "user" or "admin"
  created_at: DateTime
}
```

#### **bookings**
```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: users),
  user_email: String,
  vehicle_number: String,
  vehicle_type: String,
  slot_number: String, // e.g., "2-Wheeler-1"
  entry_time: DateTime,
  exit_time: DateTime,
  duration_hours: Number,
  amount: Number (in INR),
  status: String, // "active", "completed", "cancelled"
  booking_type: String, // "online", "on-spot"
  razorpay_order_id: String (optional),
  razorpay_payment_id: String (optional),
  payment_status: String, // "paid", "pending"
  cancellation_fee: Number (optional),
  created_at: DateTime
}
```

#### **parking_config**
```javascript
{
  _id: ObjectId,
  vehicle_type: String (unique), // "2-Wheeler", "4-Wheeler", "Bus"
  slots_total: Number,
  price_per_hour: Number
}
```

#### **settings**
```javascript
{
  _id: ObjectId,
  key: String, // "cancellation_policy"
  value: {
    cancellation_type: String, // "fixed" or "percentage"
    cancellation_value: Number
  }
}
```

#### **payment_orders**
```javascript
{
  _id: ObjectId,
  order_id: String (unique, Razorpay order ID),
  user_id: ObjectId,
  booking_draft: Object,
  amount: Number (in paise),
  currency: String,
  status: String, // "created", "paid"
  razorpay_payment_id: String (optional),
  razorpay_signature: String (optional),
  booking_id: String (optional),
  created_at: DateTime,
  paid_at: DateTime (optional)
}
```

### Indexes
- `users.email` - Unique index for fast email lookups
- `payment_orders.order_id` - Unique index for Razorpay orders

---

## 7. KEY FEATURES & WORKFLOWS

### 7.1 User Registration & Authentication
```
1. User fills registration form
2. Frontend validates inputs
3. POST /auth/register with email, password, name
4. Backend:
   - Checks email uniqueness
   - Hashes password (bcrypt)
   - Creates user document (default role: "user")
   - Issues JWT tokens (access: 15min, refresh: 7days)
5. Tokens stored in httponly cookies
6. User redirected to dashboard
```

### 7.2 Real-Time Availability Check
```
1. User visits home page
2. Frontend calls GET /public/availability (no auth)
3. Backend:
   - Fetches all parking configurations
   - For each vehicle type:
     - Counts active bookings
     - Calculates available = total - occupied
4. Displays to user with pricing info
```

### 7.3 Parking Booking (Online - with Payment)
```
1. User clicks "Book Now" on dashboard
2. Fills vehicle details and duration
3. Submits booking form
4. Frontend navigates to /payment with booking draft
5. PaymentPage:
   - Calls POST /payments/create-order
   - Backend returns Razorpay order_id
   - Opens Razorpay checkout modal
6. User enters payment details in Razorpay
7. Razorpay returns payment confirmation
8. Frontend calls POST /payments/verify-and-book:
   - Backend verifies HMAC signature
   - Re-validates booking and amount
   - Assigns slot (e.g., "2-Wheeler-5")
   - Creates booking with status "active"
   - Marks payment order as "paid"
9. User redirected to dashboard
10. Active booking appears with countdown timer
```

### 7.4 Booking Extension
```
1. User with active booking clicks "Extend"
2. Enters additional hours
3. Frontend calls POST /bookings/{id}/extend
4. Backend:
   - Validates booking is active
   - Fetches vehicle type price
   - Calculates additional charge
   - Updates exit_time and amount
5. User charged additional amount
6. Countdown timer recalculates
```

### 7.5 Booking Cancellation
```
1. User clicks "Cancel" on active booking
2. Frontend calls POST /bookings/{id}/cancel
3. Backend:
   - Validates booking is active
   - Fetches cancellation policy from settings
   - If "fixed": cancellation_fee = policy_value
   - If "percentage": cancellation_fee = (amount × policy_value) / 100
   - Updates booking status to "cancelled"
   - Stores cancellation_fee
4. User receives refund: amount - cancellation_fee
5. Booking disappears from active, appears in history
```

### 7.6 Admin Dashboard Operations
```
1. Admin logs in (pre-seeded credentials)
2. Dashboard loads with:
   - Real-time statistics (revenue, bookings, slots)
   - All parking configurations
   - All user bookings
   - Current settings

3. Edit Parking Config:
   - Admin clicks "Edit" on vehicle type
   - Changes slots_total or price_per_hour
   - Submits form
   - Backend validates and updates

4. Update Cancellation Policy:
   - Admin clicks "Settings"
   - Chooses fixed or percentage
   - Enters value
   - Backend upserts settings document

5. View Bookings:
   - Admin can see all user bookings
   - Filter by status
   - Monitor parking lot utilization
```

---

## 8. SECURITY FEATURES

### 8.1 Authentication
- **JWT Tokens:** Stateless authentication using signed tokens
- **Dual Tokens:** 
  - Access token: 15 minutes (API calls)
  - Refresh token: 7 days (renew access)
- **HttpOnly Cookies:** Prevents XSS attacks by making tokens inaccessible to JavaScript
- **Secure Flag:** (When deployed with HTTPS)

### 8.2 Password Security
- **Bcrypt Hashing:** Industry-standard password hashing with salt
- **Minimum Length Validation:** Frontend enforces 6+ character passwords

### 8.3 Authorization
- **Role-Based Access Control (RBAC):**
  - Users can only access own bookings
  - Admins have full system access
  - Protected routes check `current_user.role`

### 8.4 Payment Security
- **HMAC-SHA256 Signature Verification:** 
  - Razorpay signatures verified server-side
  - Prevents tampered payment data
- **Order Validation:**
  - Orders can only be used once
  - Amount re-calculated server-side
  - Booking draft verified hasn't changed

### 8.5 Data Validation
- **Pydantic Models:** Type validation and schema enforcement
- **Email Validation:** Using `EmailStr` type
- **ObjectId Validation:** Validates MongoDB document IDs

### 8.6 API Security
- **CORS Configuration:** Restricts requests to allowed frontend URL
- **Unique Constraints:** Email, order_id enforce data integrity
- **Input Sanitization:** All user inputs validated before database operations

---

## 9. USER ROLES & PERMISSIONS

### User Role
- ✅ Register and login
- ✅ View public availability
- ✅ Create bookings (online with payment)
- ✅ Extend active bookings
- ✅ Cancel bookings
- ✅ View own booking history
- ❌ Access admin features

### Admin Role
- ✅ All user permissions
- ✅ View system statistics
- ✅ Create/edit parking configurations
- ✅ View all bookings
- ✅ Manage cancellation policy
- ✅ Seed users and configurations

---

## 10. DATA FLOW EXAMPLES

### Example 1: Complete Booking Flow
```
User (Frontend) → Login → Gets JWT token
         ↓
    Dashboard → Clicks "Book Now"
         ↓
    Booking Form → Submits vehicle details
         ↓
    Backend Validation → Checks availability
         ↓
    Redirect to PaymentPage
         ↓
    Razorpay Checkout → User pays
         ↓
    Signature Verification → Confirm payment authentic
         ↓
    Create Booking → Assign slot, set entry/exit times
         ↓
    Dashboard → Shows active booking with timer
```

### Example 2: Admin Configuration
```
Admin → Login as admin@parkspot.com
  ↓
Dashboard → Clicks "Edit" on 4-Wheeler
  ↓
Form shows current config → Admin updates price & slots
  ↓
POST /parking-config/{vehicle_type} → Backend updates DB
  ↓
Statistics refresh → Shows new values
  ↓
Public API reflects changes → Users see new prices
```

---

## 11. ENVIRONMENT VARIABLES

Backend (.env):
```
MONGO_URL=mongodb+srv://...
DB_NAME=smart_parking
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:3000
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
ADMIN_EMAIL=admin@parkspot.com
ADMIN_PASSWORD=admin123
```

Frontend (.env):
```
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_RAZORPAY_KEY_ID=rzp_...
```

---

## 12. ERROR HANDLING

### Frontend
- **Axios Interceptors:** Catch API errors
- **Toast Notifications:** Display errors to users
- **Loading States:** Show spinners during async operations
- **Form Validation:** Client-side validation before submission

### Backend
- **HTTP Status Codes:**
  - 400: Bad Request (validation errors)
  - 401: Unauthorized (missing/invalid token)
  - 403: Forbidden (insufficient permissions)
  - 404: Not Found (resource doesn't exist)
  - 500: Server Error (unexpected failures)
- **Detailed Error Messages:** Help users understand issues
- **Try-Catch Blocks:** Graceful error handling

---

## 13. PERFORMANCE OPTIMIZATIONS

1. **Async Operations:** FastAPI handles concurrent requests efficiently
2. **Database Indexing:** Unique indexes on frequently queried fields
3. **Real-Time Updates:** Countdown timer in UserDashboard updates without API calls
4. **Lazy Loading:** Components load data on mount
5. **Code Splitting:** Tailwind CSS only includes used styles

---

## 14. FUTURE ENHANCEMENTS

1. **Email Notifications:** Send booking confirmations and reminders
2. **SMS Alerts:** Notify users when parking time is expiring
3. **Mobile App:** React Native implementation
4. **Vehicle Tracking:** Real-time GPS integration
5. **Monthly/Yearly Plans:** Subscription pricing models
6. **Rating System:** Users rate parking facilities
7. **Dynamic Pricing:** Surge pricing during peak hours
8. **Analytics Dashboard:** Advanced reporting for admins
9. **Multi-Location Support:** Manage multiple parking facilities
10. **Wallet System:** Prepaid balance for quick bookings

---

## 15. DEPLOYMENT CHECKLIST

- [ ] Set up MongoDB Atlas (cloud) or local MongoDB
- [ ] Generate JWT_SECRET (use strong random string)
- [ ] Configure Razorpay credentials (test → production keys)
- [ ] Set FRONTEND_URL to production domain
- [ ] Enable HTTPS in production
- [ ] Set secure=True in JWT cookie config
- [ ] Use environment variables for all secrets
- [ ] Enable MongoDB unique indexes
- [ ] Set up backup and disaster recovery
- [ ] Configure monitoring and logging
- [ ] Load test the system
- [ ] Security audit (especially payment flows)

---

## CONCLUSION

The Smart Parking System is a production-ready application that combines modern web technologies with robust backend architecture. It demonstrates:
- **Full-Stack Development:** React frontend to FastAPI backend
- **Database Design:** Normalized MongoDB schema
- **Security:** JWT authentication, payment verification, RBAC
- **User Experience:** Intuitive UI with real-time updates
- **Scalability:** Async operations, efficient queries

The system is designed to handle real-world parking management needs with security, reliability, and user-friendly features.
