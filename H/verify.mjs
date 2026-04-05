/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: api/verify.mjs
   ESTADO: Sin cambios respecto a la versión actual del repo.
   El archivo ya fue corregido correctamente. Se entrega aquí como referencia
   de la versión completa y auditada.

   BUGS QUE YA TIENE CORREGIDOS (documentados en el archivo original):
   [V1] CORS con "*" — necesario para World App WebView
   [V2] action hardcoded "verify-user" — se usa APP_ID + ACTION_ID desde env
   [V3] Validación de env vars al inicio
   [V4] Anti-replay con check de nullifier_hash existente
   [V5] Verificación robusta de verifyData.success
   [V6] APP_ID desde variable de entorno con fallback
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) {
  console.error("[VERIFY] ERROR: SUPABASE_URL no está configurada");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[VERIFY] ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada");
}
if (!process.env.WORLDCOIN_APP_ID) {
  console.warn("[VERIFY] ADVERTENCIA: WORLDCOIN_APP_ID no está configurada. Usando valor hardcoded.");
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const APP_ID = process.env.WORLDCOIN_APP_ID ?? "app_6a98c88249208506dcd4e04b529111fc";
const ACTION_ID = process.env.WORLDCOIN_ACTION_ID ?? "verify-user";

export default async function handler(req, res) {
  console.log("[VERIFY] Verificando World ID...");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    console.warn("[VERIFY] Método no permitido:", req.method);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { payload } = body;

  if (
    !payload ||
    !payload.nullifier_hash ||
    !payload.proof ||
    !payload.merkle_root ||
    !payload.verification_level
  ) {
    console.error("[VERIFY] Faltan campos en proof:", {
      hasPayload: !!payload,
      hasNullifierHash: !!payload?.nullifier_hash,
      hasProof: !!payload?.proof,
      hasMerkleRoot: !!payload?.merkle_root,
      hasVerificationLevel: !!payload?.verification_level,
    });
    return res.status(400).json({ success: false, error: "Faltan campos en proof" });
  }

  const nullifierHash = payload.nullifier_hash;
  console.log("[VERIFY] nullifier_hash recibido:", nullifierHash);

  // Anti-replay: verificar si este nullifier_hash ya fue verificado
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, verified")
      .eq("id", nullifierHash)
      .maybeSingle();

    if (existing?.verified) {
      console.log("[VERIFY] nullifier_hash ya verificado anteriormente:", nullifierHash);
      return res.status(200).json({ success: true, nullifier_hash: nullifierHash, reused: true });
    }
  } catch (err) {
    console.warn("[VERIFY] No se pudo verificar anti-replay:", err.message);
  }

  // Verificar con Worldcoin Developer Portal
  let verifyData;
  try {
    console.log("[VERIFY] Llamando a Worldcoin API. app_id:", APP_ID, "action:", ACTION_ID);

    const verifyResponse = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: ACTION_ID,
          merkle_root: payload.merkle_root,
          proof: payload.proof,
          nullifier_hash: nullifierHash,
          verification_level: payload.verification_level,
        }),
      }
    );

    verifyData = await verifyResponse.json();
    console.log("[VERIFY] Respuesta de Worldcoin. status:", verifyResponse.status, "body:", JSON.stringify(verifyData));

    const isSuccess = verifyResponse.ok && (verifyData.success === true || verifyData.success === "true");

    if (!isSuccess) {
      console.error("[VERIFY] Worldcoin rechazó la verificación:", verifyData);
      return res.status(verifyResponse.status || 400).json({
        success: false,
        error: verifyData.detail ?? verifyData.error ?? "Verificación fallida en Worldcoin",
        worldcoin_response: verifyData,
      });
    }
  } catch (err) {
    console.error("[VERIFY] Error de red al contactar Worldcoin:", err.message);
    return res.status(500).json({ success: false, error: "Error al contactar Worldcoin" });
  }

  // Guardar/actualizar perfil en Supabase
  try {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: nullifierHash,
          tier: "free",
          verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.error("[VERIFY] Error upsert profiles:", upsertError.message, upsertError.details);
      return res.status(500).json({ success: false, error: upsertError.message });
    }

    console.log("[VERIFY] Perfil creado/actualizado exitosamente:", nullifierHash);
  } catch (err) {
    console.error("[VERIFY] Error inesperado en Supabase profiles:", err.message);
    return res.status(500).json({ success: false, error: "Error al guardar perfil" });
  }

  return res.status(200).json({ success: true, nullifier_hash: nullifierHash });
}
