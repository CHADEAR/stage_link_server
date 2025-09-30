// เก็บ response ของผู้ฟัง SSE
const clients = new Set();

/** สมัคร */
export function subscribe(res) {
  clients.add(res);
  // ล้างออกเมื่อ client หลุด
  res.on?.("close", () => {
    clients.delete(res);
  });
}

/** กระจายอัปเดต */
export function broadcast(payload) {
  const data = `event: vote_update\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      // ถ้าเขียนไม่ได้ แปลว่าหลุด: เอาออก
      clients.delete(res);
    }
  }
}
