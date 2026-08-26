# Smart Parking Management System 🚗⚡

A full-stack web application designed to automate and simplify parking space management. The system allows users to view real-time parking space availability, book slots online with secure payment integration, and manage active bookings (extend/cancel). It also features an administrative panel to configure parking rates, monitor slots, view financial statistics, and manage system-wide policies.

---

## 🚀 Key Features

### 👤 User Panel
* **Real-time Availability:** Instantly view available slots and pricing for different vehicle categories (2-Wheeler, 4-Wheeler, Bus) on the landing page.
* **Online Booking:** Select vehicle details, set parking duration, and book slots online.
* **Secure Payment Integration:** Integrated with **Razorpay** checkout for secure card, UPI, and net banking transactions.
* **Booking Control:** Live countdown timer for active bookings with options to:
  * **Extend Booking:** Add hours to an active session with automatic additional billing.
  * **Cancel Booking:** Cancel bookings with dynamic cancellation fees based on administration settings.
* **Personal Booking History:** Complete track of previous bookings, receipts, and cancellation details.

### 👑 Admin Dashboard
* **Real-Time Analytics:** Access metrics on total bookings, active parking sessions, total revenue collected, and overall slot occupancy.
* **Slot Configuration:** Modify total capacity and pricing per hour dynamically for each vehicle category.
* **Policy Management:** Set system-wide cancellation fees (fixed charges or percentage-based of the booking amount).
* **Booking Overseer:** View details of every transaction and booking status across the entire system.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | **React (v18)** | User Interface |
| | **React Router DOM (v6)** | Client-side routing |
| | **Tailwind CSS (v3)** | Modern responsive styling |
| | **Lucide React** | Icon system |
| | **Sonner** | Clean toast notifications |
| **Backend** | **FastAPI (Python)** | High-performance, async REST API |
| | **Motor** | Asynchronous MongoDB driver |
| | **PyJWT & Bcrypt** | Secure user authentication and password hashing |
| | **Razorpay SDK** | Payment orders generation and server-side verification |
| **Database** | **MongoDB** | NoSQL Document database (collections: `users`, `bookings`, `parking_config`, `settings`, `payment_orders`) |

---

## 📂 Project Structure

```text
smart-parking/
├── backend/
│   ├── server.py             # FastAPI App, JWT auth, Razorpay API integrations
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── public/               # Static assets & index.html
│   ├── src/
│   │   ├── components/       # Reusable components (e.g. ProtectedRoute)
│   │   ├── contexts/         # React Authentication Context (AuthContext)
│   │   ├── pages/            # View pages (Login, Dashboard, Payment, Admin)
│   │   ├── App.js            # Router configuration
│   │   └── index.js          # React entry point
│   ├── tailwind.config.js    # Tailwind layout options
│   └── package.json          # Frontend packages
└── package.json              # Main project description
```

---

## ⚙️ Environment Configuration

Before running the application, set up environment variables in both the `backend` and `frontend` folders.

### 🔑 Backend Configuration (`backend/.env`)
Create a `.env` file inside the `backend/` directory:
```env
MONGO_URL=your_mongodb_connection_string
DB_NAME=smart_parking
JWT_SECRET=your_jwt_signing_key
FRONTEND_URL=http://localhost:3000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
ADMIN_EMAIL=admin@parkspot.com
ADMIN_PASSWORD=admin123
```

### 🔑 Frontend Configuration (`frontend/.env`)
Create a `.env` file inside the `frontend/` directory:
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_RAZORPAY_KEY_ID=your_razorpay_key_id
```

---

## 🏃 Running the Application

### 1. Set Up the Backend
1. Navigate to the `backend` directory.
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server using Uvicorn:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

### 2. Set Up the Frontend
1. Navigate to the `frontend` directory.
2. Install the node packages:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔒 Security Implementations
* **Secure Authentication:** User tokens are generated as stateless JWT tokens and stored in **HttpOnly, SameSite cookies** to defend against XSS and CSRF.
* **Bcrypt Password Salting:** Passwords are never stored in plain text.
* **Server-side Signature Verification:** Every payment transaction is authenticated server-side using **HMAC-SHA256** checksum verification via the Razorpay Secret Key to prevent tampered or spoofed order requests.
