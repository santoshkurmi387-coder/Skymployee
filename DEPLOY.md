# CourierOps — Complete Setup & Deployment Guide

> **Stack**: Node.js + Express (Backend) · MongoDB Atlas (Database) · Vanilla JS PWA (Frontend)
> **Free Hosting**: Render (backend) + Vercel (frontend) + MongoDB Atlas (database)

---

## Project Structure

```
courierops/
├── backend/
│   ├── server.js              ← Express entry point
│   ├── package.json
│   ├── .env.example           ← Copy to .env and fill in values
│   ├── models/
│   │   ├── User.js            ← Admin accounts (mobile + OTP)
│   │   ├── Employee.js        ← Employee records
│   │   ├── Attendance.js      ← Daily attendance logs
│   │   └── AdvanceSalary.js   ← Advance salary records
│   ├── routes/
│   │   ├── auth.js            ← Send OTP / Verify OTP / Get profile
│   │   ├── employees.js       ← CRUD employees
│   │   ├── attendance.js      ← CRUD attendance
│   │   └── salary.js          ← Report + advance salary
│   ├── middleware/
│   │   └── auth.js            ← JWT verification middleware
│   └── utils/
│       └── sms.js             ← Twilio OTP sender
│
├── frontend/
│   ├── public/
│   │   ├── index.html         ← Main SPA page
│   │   ├── manifest.json      ← PWA manifest
│   │   ├── service-worker.js  ← PWA offline caching
│   │   ├── css/app.css        ← All styles
│   │   ├── js/
│   │   │   ├── api.js         ← All API calls (fetch wrapper)
│   │   │   └── app.js         ← All UI logic
│   │   └── icons/             ← PWA icons (you generate these)
│   ├── server.js              ← Optional static server + proxy
│   ├── package.json
│   └── vercel.json            ← Vercel routing config
│
├── render.yaml                ← Render deployment config
├── .gitignore
└── DEPLOY.md                  ← This file
```

---

## Step 1 — Prerequisites

Install these on your computer:

```bash
# Check if Node.js is installed (need v18+)
node --version

# If not installed, download from: https://nodejs.org

# Install nodemon globally for development
npm install -g nodemon
```

---

## Step 2 — Set Up MongoDB Atlas (Free Database)

1. Go to **https://cloud.mongodb.com** and create a free account
2. Click **"Build a Database"** → choose **M0 Free Tier** → region: **Mumbai (ap-south-1)**
3. Create a database user:
   - Username: `courierops_user`
   - Password: (generate a strong password, save it!)
4. Under **Network Access** → click **"Add IP Address"** → choose **"Allow access from anywhere"** (0.0.0.0/0)
5. Click **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://courierops_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/courierops?retryWrites=true&w=majority
   ```
6. Save this — you'll need it as `MONGO_URI`

---

## Step 3 — Set Up Twilio OTP (Free Trial)

1. Go to **https://www.twilio.com** → Sign up free
2. You get **$15 free credit** (enough for hundreds of OTPs)
3. From the dashboard, note:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**
   - **Phone Number** (a free Twilio number)
4. In free trial, you can only send SMS to **verified numbers**.
   - Go to Verified Callers → add your test mobile numbers

> **Development mode**: The backend prints the OTP to the server console and returns it in the API response — no Twilio needed for local testing!

---

## Step 4 — Run Locally

### Backend

```bash
# Navigate to backend folder
cd courierops/backend

# Install dependencies
npm install

# Create your .env file from the example
cp .env.example .env

# Edit .env and fill in:
# - MONGO_URI (from Step 2)
# - JWT_SECRET (any long random string)
# - TWILIO_* (from Step 3, or leave blank for dev mode)
# - NODE_ENV=development
# - FRONTEND_URL=http://localhost:3000

# Start the backend development server
npm run dev
# → Server running on http://localhost:5000
# → MongoDB connected
```

### Frontend

```bash
# In a new terminal, go to frontend folder
cd courierops/frontend

# Install dependencies
npm install

# Start the frontend server
npm start
# → Frontend running at http://localhost:3000
```

Open **http://localhost:3000** in your browser.

> **Dev tip**: In development mode, the OTP appears in the **backend terminal** AND is returned in the API response as `devOTP`. No real SMS is sent.

---

## Step 5 — Generate PWA Icons

You need icon images at various sizes. Use this free tool:
- Go to **https://www.pwabuilder.com/imageGenerator**
- Upload a 512×512 PNG of your logo
- Download the generated icons
- Place them in `frontend/public/icons/`

Or create simple placeholder icons:

```bash
# Quick way using ImageMagick (if installed)
for size in 72 96 128 144 192 512; do
  convert -size ${size}x${size} gradient:#3b82f6-#06b6d4 \
    -gravity center -fill white -font Arial -pointsize $((size/4)) \
    -annotate 0 "CO" frontend/public/icons/icon-${size}.png
done
```

---

## Step 6 — Deploy Backend to Render (Free)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial CourierOps commit"
   git remote add origin https://github.com/YOUR_USERNAME/courierops.git
   git push -u origin main
   ```

2. Go to **https://render.com** → Sign up free → **New Web Service**

3. Connect your GitHub repository

4. Settings:
   - **Name**: `courierops-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Add **Environment Variables** (click "Add Environment Variable"):
   ```
   NODE_ENV          = production
   MONGO_URI         = mongodb+srv://... (your Atlas URI)
   JWT_SECRET        = your_random_secret_here
   JWT_EXPIRE        = 7d
   TWILIO_ACCOUNT_SID = ACxxxxxxxxxx
   TWILIO_AUTH_TOKEN  = your_token
   TWILIO_PHONE       = +1234567890
   FRONTEND_URL       = https://your-app.vercel.app  (update after step 7)
   ```

6. Click **Deploy**. Wait 2-3 minutes.
7. Note your backend URL: `https://courierops-backend.onrender.com`

> **Free tier note**: Render free services spin down after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds. Upgrade to Starter ($7/month) to avoid this.

---

## Step 7 — Deploy Frontend to Vercel (Free)

1. Go to **https://vercel.com** → Sign up free (use your GitHub account)

2. Click **"Add New Project"** → Import your GitHub repo

3. Settings:
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: *(leave empty)*
   - **Output Directory**: `public`

4. Add **Environment Variables**:
   ```
   BACKEND_URL = https://courierops-backend.onrender.com
   ```

5. Open `frontend/vercel.json` and replace `YOUR-BACKEND-ON-RENDER` with your actual Render URL

6. Click **Deploy**. Done in ~1 minute.

7. Copy your Vercel URL (e.g. `https://courierops.vercel.app`)

8. Go back to **Render** → your backend service → Environment → update `FRONTEND_URL` to your Vercel URL → redeploy.

---

## Step 8 — Update API Base URL in Frontend

Open `frontend/public/js/api.js` and update the `API_BASE` variable:

```javascript
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : 'https://courierops-backend.onrender.com/api';  // ← your Render URL
```

Commit and push — Vercel auto-deploys on push.

---

## How the Auth Flow Works

```
User enters mobile number
        ↓
Backend: create/find user → generate 6-digit OTP → hash & store in MongoDB → send SMS via Twilio
        ↓
User enters OTP
        ↓
Backend: compare hashed OTP → mark user as verified → return JWT token
        ↓
Frontend: store token in sessionStorage → all API calls include it as "Bearer <token>"
        ↓
User refreshes page → token still in sessionStorage → auto-login (no OTP again)
        ↓
User closes tab → sessionStorage clears → next visit requires OTP again
```

---

## How Salary Calculation Works

```
For each employee in the selected month:

  Present days  → each earns full daily wage (₹700 example)
  Half-Day      → each earns 0.5 × daily wage (₹350)
  Absent/Leave  → ₹0

  Base Salary   = (Present × wage) + (Half-Day × wage × 0.5)

  Advance Taken = sum of all AdvanceSalary records for that employee + month

  Final Payable = Base Salary − Advance Taken
                  (cannot go below ₹0)
```

---

## API Reference

### Auth
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/send-otp` | `{mobile, name?, branchName?}` | Send OTP |
| POST | `/api/auth/verify-otp` | `{mobile, otp}` | Verify OTP, get token |
| GET | `/api/auth/me` | — | Get current user |

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List all employees |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Soft-delete employee |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance` | List (filter by `?employeeId=&month=YYYY-MM`) |
| GET | `/api/attendance/today` | Today's records |
| POST | `/api/attendance` | Create record |
| PUT | `/api/attendance/:id` | Update/edit record |
| DELETE | `/api/attendance/:id` | Delete record |

### Salary
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/salary/report?month=YYYY-MM` | Full salary report |
| GET | `/api/salary/advances` | List advances |
| POST | `/api/salary/advances` | Add advance |
| PUT | `/api/salary/advances/:id` | Update advance |
| DELETE | `/api/salary/advances/:id` | Delete advance |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| OTP not received | Check Twilio credentials; in dev mode look at server terminal for OTP |
| MongoDB connection error | Check MONGO_URI in .env; ensure IP whitelist includes 0.0.0.0/0 |
| CORS error in browser | Set `FRONTEND_URL` in backend .env to your exact frontend URL |
| Render backend slow | Free tier sleeps after 15 min; first request takes ~30s to wake up |
| "Token invalid" after deploy | Make sure `JWT_SECRET` is the same across all restarts |
| PWA not installing | Serve over HTTPS (Vercel does this automatically) |

---

## Security Notes

- All API routes (except `/api/auth/*`) require a valid JWT
- OTPs are **hashed** in the database using bcrypt — even if DB is breached, OTPs can't be read
- OTPs expire after **10 minutes** and allow max **5 attempts**
- Rate limiting: max 100 requests/15 min per IP; 5 OTP requests/10 min
- Each admin only sees **their own branch's** data (isolated by `createdBy` field)
- Employees are soft-deleted (data preserved for records)

---

## Upgrade Path

When ready to upgrade from free tier:

| Service | Free | Paid |
|---------|------|------|
| Render (backend) | Sleeps after 15 min | Starter $7/month — always on |
| MongoDB Atlas | 512MB storage | M2 $9/month — 2GB + backups |
| Vercel (frontend) | 100GB bandwidth | Pro $20/month — more bandwidth |
| Twilio OTP | $15 trial credit | Pay-as-you-go ~₹0.50/SMS |
