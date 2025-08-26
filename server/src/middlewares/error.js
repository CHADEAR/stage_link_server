// src/middlewares/error.js
export default function errorHandler(err, _req, res, _next) {
  console.error("UNCAUGHT ERROR:", err);
  res.status(err.status || 500).json({ error: err.message || "internal error" });
}
