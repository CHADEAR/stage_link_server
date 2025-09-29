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
