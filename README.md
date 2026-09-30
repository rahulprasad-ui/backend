# ⚙️ Rivava TrackFi - Backend REST API

Enterprise-grade, scalable Node.js & Express REST API backend powering the Rivava TrackFi platform. Built with Firebase Admin SDK, Razorpay Payment integration, and **Resend** transactional email & OTP service.

---

## 🏛 Architecture & Project Layout

```
backend/
├── src/
│   ├── config/          # Environment variables & Firebase Admin SDK singleton
│   ├── constants/       # Status codes, OTP limits, collection names
│   ├── controllers/     # Auth, Verification, Elite Payments, User controllers
│   ├── middlewares/     # Rate limiters, Bearer Auth, Security headers, Error handler
│   ├── routes/          # /auth, /verification, /elite, /payments, /users, /health
│   ├── services/        # Business logic (Auth, OTP, Resend Emailer, Elite Membership, User sync)
│   ├── templates/       # HTML & Text Email Templates (Welcome, Verification, Alerts, OTP)
│   ├── utils/           # Logger, ApiError, ApiResponse, AsyncHandler
│   ├── validators/      # Input sanitization and phone validators
│   └── app.js           # Express App assembly & security middleware
├── tests/               # Automated unit test suite
├── .env.example         # Environment template
├── Dockerfile           # Multi-stage production container
├── docker-compose.yml   # Container orchestration
├── package.json         # Scripts and dependencies
└── server.js            # Entry point with graceful shutdown handling
```

---

## 🚀 API Modules & Endpoints

| Module | Route Prefix | Key Endpoints | Description |
|---|---|---|---|
| **Health** | `/health`, `/api/v1/health` | `GET /health` | Service uptime and heartbeat check |
| **Authentication** | `/auth`, `/api/v1/auth` | `POST /send-otp`<br>`POST /verify-otp`<br>`POST /forgot-password`<br>`POST /reset-password` | Authentication, OTP generation, and Password Reset |
| **Email Verification** | `/api/v1/verification`, `/verify` | `POST /send-email`<br>`GET /verify?token=...`<br>`GET /status` | Resend email verification flow |
| **Elite & Payments** | `/api/v1/elite`, `/api/v1/payments` | `POST /create-order`<br>`POST /verify-payment`<br>`POST /book-session`<br>`POST /cancel-subscription` | Elite membership subscription & Razorpay integration |
| **User Profiles** | `/api/v1/users` | `GET /profile`<br>`PUT /profile`<br>`POST /sync` | Cloud profile management & bi-directional sync |

---

## ⚙️ Environment Variables Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure required keys in `.env`:
   - `PORT`: Default `3000`
   - `NODE_ENV`: `development` | `production`
   - `RESEND_API_KEY`: API Key from [Resend](https://resend.com/api-keys)
   - `RESEND_FROM_EMAIL`: Sender address (e.g. `Rivava TrackFi <onboarding@resend.dev>`)
   - `FIREBASE_PROJECT_ID`: Your Firebase project ID
   - `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to `serviceAccountKey.json`
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Razorpay payment keys

---

## 🛠️ Commands & Scripts

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Run Automated Unit Tests
```bash
npm test
```

### 4. Run in Production Mode
```bash
npm start
```

### 5. Run via Docker Compose
```bash
docker-compose up -d --build
```
