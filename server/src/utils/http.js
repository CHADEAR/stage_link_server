// src/utils/http.js
export function httpError(status, message) {
  const e = new Error(message || "error");
  e.status = status;
  return e;
}
