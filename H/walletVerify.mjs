/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: api/walletVerify.mjs
   ESTADO: El código del archivo ya fue corregido en sesión anterior.
           El único cambio pendiente NO está en este archivo sino en
           package.json (raíz):

   [W-CRÍTICO] ethers NO está en dependencies del package.json raíz.
               → fixes/package.json añade "ethers": "^6.13.0" a dependencies.
               → Sin esto, Vercel falla con "Cannot find module 'ethers'"
                 y TODA la autenticación de wallet explota en producción.

   BUGS QUE YA TIENE CORREGIDOS (documentados en el archivo original):
   [W1] Import roto de verifySignedNonce desde nonce.mjs (no existía)
        → reimplementado inline con ethers.verifyMessage()
   [W2] Validación de campos del body (message, signature, address)
   [W3] Env vars validadas con null-coalescing
   [W4] Verificación de expiración del nonce (TTL 5 minutos sobre timestamp)
   [W5] CORS con "*" para World App WebView
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

if (!process.env.SUPABASE_URL) {
  console.error("[WALLET_VERIFY] ERROR: SUPABASE_URL no configurada");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[WALLET_VERIFY] ERROR: SUPABASE_SERVICE_ROLE_KEY no configurada");
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const NONCE_TTL_MS = 5 * 60 * 1000;

function verifySignedNonce(message, signature) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return { success: true, address: recovered };
  } catch (err) {
    console.error("[WALLET_VERIFY] Error al recuperar firma:", err.message);
    return { success: false, address: null, error: err.message };
  }
}

export default async function handler(req, res) {
  console.log("[WALLET_VERIFY] Verificando wallet signature...");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { message, signature, address, userId } = body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ success: false, error: "message es requerido" });
  }
  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ success: false, error: "signature es requerida" });
  }
  if (!address || typeof address !== "string") {
    return res.status(400).json({ success: false, error: "address es requerida" });
  }

  console.log("[WALLET_VERIFY] address:", address, "userId:", userId ?? "(no proporcionado)");

  // Verificar expiración del nonce (TTL 5 minutos)
  const tsMatch = message.match(/Timestamp:\s*(\d{4}-\d{2}-\d{2}T[\d:.Z]+)/);
  if (tsMatch) {
    const msgTime = new Date(tsMatch[1]).getTime();
    if (Date.now() - msgTime > NONCE_TTL_MS) {
      console.warn("[WALLET_VERIFY] Nonce expirado. Mensaje tiene más de 5 minutos.");
      return res.status(400).json({ success: false, error: "Nonce expirado. Solicita uno nuevo." });
    }
  } else {
    console.warn("[WALLET_VERIFY] El mensaje no contiene Timestamp — no se puede verificar expiración.");
  }

  // Verificar firma ECDSA
  const verifyResult = verifySignedNonce(message, signature);
  if (!verifyResult.success) {
    console.error("[WALLET_VERIFY] Firma inválida:", verifyResult.error);
    return res.status(401).json({ success: false, error: "Firma inválida" });
  }

  const recoveredAddress = verifyResult.address;
  console.log("[WALLET_VERIFY] Dirección recuperada:", recoveredAddress, "esperada:", address);

  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    console.error("[WALLET_VERIFY] La firma no corresponde a la dirección declarada.");
    return res.status(401).json({
      success: false,
      error: "La firma no corresponde a la dirección proporcionada",
      expected: address,
      recovered: recoveredAddress,
    });
  }

  // Actualizar perfil en Supabase si se proporcionó userId
  if (userId) {
    try {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          wallet_address: address,
          wallet_verified: true,
          wallet_verified_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateErr) {
        console.error("[WALLET_VERIFY] Error actualizando perfil:", updateErr.message);
        return res.status(200).json({
          success: true,
          address: recoveredAddress,
          warning: "Firma válida pero no se pudo actualizar el perfil: " + updateErr.message,
        });
      }

      console.log("[WALLET_VERIFY] Perfil actualizado con wallet:", address, "userId:", userId);
    } catch (dbErr) {
      console.error("[WALLET_VERIFY] Error inesperado en Supabase:", dbErr.message);
    }
  }

  return res.status(200).json({
    success: true,
    address: recoveredAddress,
  });
}
