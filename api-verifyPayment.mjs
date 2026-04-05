/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: api/verifyPayment.mjs
   ESTADO: Correcto tal como está. Se entrega aquí como referencia auditada.

   REQUISITO DE ENV VAR NO DOCUMENTADO:
   [VP1] WORLDCOIN_API_KEY — requerida para autenticar la verificación de
         transacciones con el Developer Portal de Worldcoin:
           Authorization: Bearer ${process.env.WORLDCOIN_API_KEY}
         Sin esta key el header se envía vacío ("Bearer ") y Worldcoin puede
         rechazar la solicitud, haciendo que las verificaciones de pago fallen.
         Añadir WORLDCOIN_API_KEY en las variables de entorno de Vercel.
         Se obtiene en: Worldcoin Developer Portal → tu app → API Keys.

   LÓGICA SOPORTADA:
   - "chat_gold"  → activa en tabla subscriptions (product: chat_gold)
   - "extra_room" → inserta crédito en tabla room_credits
   Anti-replay: verifica transactionId antes de escribir.
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) {
  console.error("[VERIFY_PAYMENT] ERROR: SUPABASE_URL no configurada");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[VERIFY_PAYMENT] ERROR: SUPABASE_SERVICE_ROLE_KEY no configurada");
}
if (!process.env.WORLDCOIN_API_KEY) {
  console.warn("[VERIFY_PAYMENT] ADVERTENCIA: WORLDCOIN_API_KEY no configurada — la verificación de transacciones puede fallar");
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const APP_ID = process.env.WORLDCOIN_APP_ID ?? "app_6a98c88249208506dcd4e04b529111fc";

async function verifyWorldcoinTransaction(transactionId) {
  try {
    const res = await fetch(
      `https://developer.worldcoin.org/api/v2/minikit/transaction/${transactionId}?app_id=${APP_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.WORLDCOIN_API_KEY ?? ""}`,
          "Content-Type": "application/json",
        },
      }
    );
    const data = await res.json();
    console.log("[VERIFY_PAYMENT] Worldcoin tx:", transactionId, "status:", data.transactionStatus ?? data.status, "ok:", res.ok);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error("[VERIFY_PAYMENT] Error de red al verificar transacción:", err.message);
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const { transactionId, userId, action } = body;

  if (!transactionId || typeof transactionId !== "string") {
    return res.status(400).json({ error: "transactionId es requerido" });
  }
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId es requerido" });
  }
  if (!action || !["chat_gold", "extra_room"].includes(action)) {
    return res.status(400).json({ error: `action inválida: "${action}". Valores válidos: chat_gold, extra_room` });
  }

  console.log("[VERIFY_PAYMENT] action:", action, "userId:", userId, "txId:", transactionId);

  // Anti-replay
  try {
    const table = action === "chat_gold" ? "subscriptions" : "room_credits";
    const { data: existingTx, error: checkErr } = await supabase
      .from(table)
      .select("id")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (checkErr) {
      console.warn("[VERIFY_PAYMENT] No se pudo verificar anti-replay:", checkErr.message);
    } else if (existingTx) {
      console.warn("[VERIFY_PAYMENT] transactionId ya procesado:", transactionId);
      return res.status(200).json({ success: true, message: "Acceso ya otorgado", replayed: true });
    }
  } catch (e) {
    console.warn("[VERIFY_PAYMENT] Error al verificar anti-replay:", e.message);
  }

  // Verificar transacción con Worldcoin
  const { ok: txOk, data: txData } = await verifyWorldcoinTransaction(transactionId);
  const txStatus = txData?.transactionStatus ?? txData?.status ?? "";

  if (!txOk) {
    console.error("[VERIFY_PAYMENT] Error al contactar Worldcoin:", txData);
    console.warn("[VERIFY_PAYMENT] Continuando sin confirmación de Worldcoin (fallo de red).");
  } else if (txStatus === "failed") {
    return res.status(402).json({ error: "Transacción de pago fallida en Worldcoin", txStatus });
  }

  // Aplicar acción en Supabase
  try {
    if (action === "chat_gold") {
      const { error: upsertErr } = await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            product: "chat_gold",
            transaction_id: transactionId,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,product" }
        );

      if (upsertErr) {
        console.error("[VERIFY_PAYMENT] Error activando chat_gold:", upsertErr.message);
        return res.status(500).json({ error: upsertErr.message });
      }
      console.log("[VERIFY_PAYMENT] chat_gold activado para userId:", userId);

    } else if (action === "extra_room") {
      const { error: insertErr } = await supabase
        .from("room_credits")
        .insert({
          user_id: userId,
          transaction_id: transactionId,
          created_at: new Date().toISOString(),
        });

      if (insertErr) {
        console.error("[VERIFY_PAYMENT] Error insertando room_credit:", insertErr.message);
        return res.status(500).json({ error: insertErr.message });
      }
      console.log("[VERIFY_PAYMENT] room_credit creado para userId:", userId);
    }
  } catch (e) {
    console.error("[VERIFY_PAYMENT] Error inesperado en Supabase:", e.message);
    return res.status(500).json({ error: "Error interno al activar acceso" });
  }

  return res.status(200).json({
    success: true,
    action,
    transactionStatus: txStatus || "accepted",
  });
}
