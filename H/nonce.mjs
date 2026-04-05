/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: api/nonce.mjs
   ESTADO: Sin cambios. Correcto tal como está.
   NOTA: El nonce se genera con crypto.randomBytes(32) — criptográficamente
   seguro. Se entrega al cliente para que lo firme con su wallet. No se
   persiste en servidor porque walletVerify.mjs verifica la firma (no el
   nonce en sí), y valida el timestamp del mensaje para evitar replay.
   ─────────────────────────────────────────────────────────────────────────── */

import crypto from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const nonce = crypto.randomBytes(32).toString("hex");
    console.log("[NONCE] Generado:", nonce);
    return res.status(200).json({ nonce });
  } catch (err) {
    console.error("[NONCE] Error:", err);
    return res.status(500).json({ error: "Error generando nonce" });
  }
}
