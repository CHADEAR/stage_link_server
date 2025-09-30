# StageLink Backend (Express + PostgreSQL)

## Quick Start (no Docker)
1. Install PostgreSQL 16+ and create DB `stagelink`.
2. `cp .env.example .env` and adjust `DATABASE_URL` if needed.
3. `npm install`
4. Run migration: `npm run db:migrate`
5. Seed admin: `npm run seed:admin`
6. `npm run dev`

## With Docker
1. `cp .env.example .env`
2. `docker compose up -d`
3. In another terminal, run migrations inside container or locally with `DATABASE_URL` pointed to the container.
4. `npm run seed:admin`

## API Overview
- POST /auth/register
- POST /auth/login
- POST /auth/forgot (request OTP)
- POST /auth/reset (reset with OTP)
- GET  /programmes (public, list programs)
- POST /programmes (admin only, create)
- POST /uploads/program (admin only, file + metadata)
- GET  /users (admin only, list users)
- POST /users/:userId/access (admin only, assign/remove per-program role)

See inline comments in source files for details.

# ----------- !!!!!!!!!!!!!!!!!!!! -------------

StageLink — คู่มือ Setup ครั้งแรก (DEV)

คู่มือนี้สอนตั้งค่าและรันระบบ ครั้งแรกบนเครื่องใหม่ สำหรับโหมดพัฒนา (DEV) โดยใช้ Docker (API + PostgreSQL) และ Vite (Frontend)

0) สิ่งที่ต้องเตรียม

Docker Desktop (Windows / macOS / Linux)

Node.js 18+ (ใช้รัน Frontend)

(ไม่บังคับ) pgAdmin – ไว้ดูฐานข้อมูล

ถ้าใช้โฟลเดอร์ซิงก์ (OneDrive/Dropbox) บางที hot-reload จะงอแง แนะนำวางโปรเจกต์ไว้ในโฟลเดอร์ปกติ

1) โครงโฟลเดอร์ (ตัวอย่าง)
stagelink/
├─ backend/                  # API + docker-compose + SQL
│  ├─ docker-compose.yml
│  ├─ .env                   # คุณต้องสร้าง (ดูข้อ 2.1)
│  ├─ sql/
│  │  ├─ 000_init.sql        # สคีมาเริ่มต้น (users, programmes, uploads, …)
│  │  └─ 001_add_programme_schedule.sql  # เพิ่ม shoot_date/start_time/end_time
│  └─ src/...
└─ frontend/                 # React (Vite)
   └─ .env                   # คุณต้องสร้าง (ดูข้อ 2.2)


ชื่อโฟลเดอร์ปรับได้ แค่ให้ docker-compose.yml อยู่ในที่ที่คุณรันคำสั่ง Docker และ Frontend รันที่พอร์ต 5173

2) ตั้งค่า Environment Variables
2.1 Backend → backend/.env
# HTTP
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Database (ชี้ไป service "db" ใน docker-compose ไม่ใช่ localhost)
DATABASE_URL=postgres://postgres:postgres@db:5432/stagelink

# Auth
JWT_SECRET=devsupersecret
JWT_EXPIRES=7d

# Uploads
UPLOAD_DIR=./uploads

# Dev mailer (ให้ OTP ไปโชว์ใน log ของ API)
DEV_MAILBOX=enabled

# (ไม่บังคับ) seed admin อัตโนมัติด้วย script
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin123!

2.2 Frontend → frontend/.env
VITE_API_URL=http://localhost:3000

3) สตาร์ทบริการด้วย Docker (โหมด DEV)

ไปรันคำสั่งในโฟลเดอร์ backend:

Windows PowerShell

docker compose up -d --build
docker compose exec api npm install     # เฉพาะครั้งแรก
docker compose logs -f api              # รอจนเห็น: [API] Listening on http://localhost:3000


macOS/Linux (bash)

docker compose up -d --build
docker compose exec api npm install     # เฉพาะครั้งแรก
docker compose logs -f api


DB คือ service db (port 5432), API อยู่ที่ http://localhost:3000

4) สร้างตารางฐานข้อมูล

รันสคีมาเริ่มต้น + migration เวลา

Windows PowerShell

type sql\000_init.sql | docker compose exec -T db psql -U postgres -d stagelink
type sql\001_add_programme_schedule.sql | docker compose exec -T db psql -U postgres -d stagelink


macOS/Linux

cat sql/000_init.sql | docker compose exec -T db psql -U postgres -d stagelink
cat sql/001_add_programme_schedule.sql | docker compose exec -T db psql -U postgres -d stagelink


(ไม่บังคับ) เปิด pgAdmin ต่อ localhost:5432 (user postgres, pass postgres, DB stagelink) แล้วตรวจว่ามีตารางและ extensions (citext, pgcrypto) ครบ

5) สร้าง Admin

วิธี A (แนะนำ) — seed script

docker compose exec -e ADMIN_EMAIL=admin1@example.com -e ADMIN_PASSWORD=admin123 api node scripts/seed-admin.js


วิธี B — promote ผู้ใช้ที่สมัครไว้แล้ว

docker compose exec db psql -U postgres -d stagelink -c "UPDATE users SET role='admin' WHERE email='user@example.com';"


หลังเปลี่ยน role ให้ผู้ใช้ logout/login ใหม่ เพื่อออก token ใหม่ที่มี role ถูกต้อง

6) รัน Frontend (Vite)

เข้าโฟลเดอร์ frontend:

npm install
npm run dev   # http://localhost:5173


ตรวจให้แน่ใจว่า VITE_API_URL (frontend) = http://localhost:3000 และ CORS_ORIGIN (backend) = http://localhost:5173