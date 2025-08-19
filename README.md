# สตาร์ททุก service แบบ background
docker compose up -d --build

# ดูสถานะ
docker compose ps

# ดู log ของ API
docker compose logs -f api
