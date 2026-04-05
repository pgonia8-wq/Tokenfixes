/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: api/upgrade.mjs
   QUÉ CAMBIÓ (3 bugs):

   [FIX-1] IMPORT ROTO
     ANTES:  import { supabase } from "../supabaseClient.ts";
     AHORA:  import { createClient } from "@supabase/supabase-js"; + createClient()
     POR QUÉ: las funciones serverless de Vercel corren en Node.js puro —
              no pueden importar archivos .ts del frontend de Vite.
              En producción este import causa un error de módulo y el endpoint
              entero falla silenciosamente (el usuario nunca puede hacer upgrade).

   [FIX-2] URL ROTA DE ETHERSCAN (template literal mal escrito)
     ANTES:  `...txhash=\( {transactionId}&apikey= \){apiKey}`
     AHORA:  `...txhash=${transactionId}&apikey=${apiKey}`
     POR QUÉ: el template literal usaba \( \) en lugar de ${ }, lo que hacía
              que verifyTxOnChain() siempre devolviera false y bloqueara
              todos los upgrades de tier. Nadie podía comprar premium.

   [FIX-3] API KEY HARDCODEADA EN CÓDIGO FUENTE
     ANTES:  const apiKey = "B7PCP5XSYD41ZDT96PZ8R1X15CDH5H2US1";
     AHORA:  const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
     POR QUÉ: la clave estaba en texto plano en el repositorio público de GitHub.
              Cualquier persona podía verla. Añade ETHERSCAN_API_KEY en
              las variables de entorno de Vercel con el valor anterior.
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

// [FIX-1] Instanciar Supabase con variables de entorno del servidor (igual que
//          todos los otros endpoints: verify.mjs, walletVerify.mjs, etc.)
const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const PREMIUM_LIMIT = 10000;
const PREMIUM_PLUS_LIMIT = 3000;

// Obtiene precio dinámico
async function getUpgradePrice(tier) {
  if (tier === "premium") {
    const { count } = await supabase
      .from("upgrades")
      .select("*", { count: "exact" })
      .eq("tier", "premium");
    return count < PREMIUM_LIMIT ? 10 : 20;
  } else {
    const { count } = await supabase
      .from("upgrades")
      .select("*", { count: "exact" })
      .eq("tier", "premium+");
    return count < PREMIUM_PLUS_LIMIT ? 15 : 35;
  }
}

// Crea token de referido
async function createReferralToken(userId) {
  const token = nanoid(10);
  const { error } = await supabase.from("referral_tokens").insert({
    token,
    created_by: userId,
    tier: "premium",
    boost_limit: 1,
    tips_allowed: false,
    created_at: new Date().toISOString(),
  });

  if (error) throw error;
  return token;
}

// Verifica tx on chain (Etherscan API for Optimism)
async function verifyTxOnChain(transactionId) {
  // [FIX-3] Clave desde variable de entorno — añadir ETHERSCAN_API_KEY en Vercel
  const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
  // [FIX-2] Template literal corregido: ${} en lugar de \( \)
  const res = await fetch(`https://api-optimistic.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${transactionId}&apikey=${apiKey}`);
  const data = await res.json();
  return data.status === "1" && data.result === "1";  // 1 = success
}

// Handler principal
export default async function handler(req, res) {
  if (req.method === "GET" && req.query.getPrice === "true") {
    const tier = req.query.tier;
    if (!tier) return res.status(400).json({ success: false, error: "Missing tier" });
    const price = await getUpgradePrice(tier);
    return res.status(200).json({ success: true, price });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = req.body || {};
  const { userId, tier, transactionId } = body;

  if (!userId || !tier || !transactionId) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    // Verificar tx on chain
    const isTxSuccess = await verifyTxOnChain(transactionId);
    if (!isTxSuccess) {
      return res.status(400).json({ success: false, error: "Transacción no exitosa on chain" });
    }

    const price = await getUpgradePrice(tier);

    // Insert upgrade
    const { error: insertError } = await supabase.from("upgrades").insert({
      user_id: userId,
      tier,
      price,
      start_date: new Date().toISOString(),
      transaction_id: transactionId,
    });

    if (insertError) throw insertError;

    // Update profiles.tier
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ tier })
      .eq("id", userId);

    if (updateError) throw updateError;

    const newReferralToken = await createReferralToken(userId);

    return res.status(200).json({ success: true, price, referralToken: newReferralToken });
  } catch (err) {
    console.error("[BACKEND] Error:", err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
}
