# สตาร์ททุก service แบบ background
docker compose up -d --build

# ดูสถานะ
docker compose ps

# ดู log ของ API
docker compose logs -f api

# วิธีการรันโปรเจคตั้งแต่เริ่มของแต่ละเครื่อง
# 1.ต้องเปิดโปรแกรม docker ไว้
# 2.ต้องเปิด pgAdmin
# 3.เปิด vscode --> server 
# 4.รัน server(หลังบ้าน) ด้วยคำสั่ง
docker compose up -d --build

