import { supabase, cors } from "../../_supabase.mjs";

/**
 * POST /api/airdrops/:id/claim
 * Body: { airdropId, userId }
 *
 * Reclama un airdrop:
 *  1. Verifica que el airdrop existe y está activo
 *  2. Verifica cooldown del usuario (no ha reclamado recientemente)
 *  3. Verifica que quedan tokens disponibles
 *  4. Registra el claim en airdrop_claims
 *  5. Añade los tokens a los holdings del usuario
 *  6. Registra el evento en token_activity
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const { userId } = req.body ?? {};

  if (!id || !userId) {
    return res.status(400).json({ error: "Missing required fields: id (airdrop), userId" });
  }

  try {
    const { data: airdrop, error: airdropErr } = await supabase
      .from("airdrops")
      .select("*")
      .eq("id", id)
      .single();

    if (airdropErr || !airdrop) return res.status(404).json({ error: "Airdrop not found" });
    if (!airdrop.is_active) return res.status(400).json({ error: "Este airdrop ya no está activo" });

    const remainingAmount = Number(airdrop.total_amount) - Number(airdrop.claimed_amount);
    if (remainingAmount <= 0) {
      return res.status(400).json({ error: "Este airdrop ya está agotado" });
    }

    const { data: lastClaim } = await supabase
      .from("airdrop_claims")
      .select("claimed_at")
      .eq("airdrop_id", id)
      .eq("user_id", userId)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .single();

    if (lastClaim) {
      const cooldownMs = Number(airdrop.cooldown_hours) * 60 * 60 * 1000;
      const nextClaim = new Date(lastClaim.claimed_at).getTime() + cooldownMs;
      if (Date.now() < nextClaim) {
        const nextClaimAt = new Date(nextClaim).toISOString();
        return res.status(400).json({
          error: "Aún no puedes reclamar este airdrop",
          nextClaimAt,
        });
      }
    }

    const claimAmount = Math.min(Number(airdrop.daily_amount), remainingAmount);

    await supabase.from("airdrop_claims").insert({
      airdrop_id: id,
      user_id: userId,
      amount: claimAmount,
      claimed_at: new Date().toISOString(),
    });

    const newClaimedAmount = Number(airdrop.claimed_amount) + claimAmount;
    const newParticipants = Number(airdrop.participants) + (lastClaim ? 0 : 1);
    const isStillActive = newClaimedAmount < Number(airdrop.total_amount)
      && (!airdrop.end_date || new Date(airdrop.end_date) > new Date());

    await supabase.from("airdrops").update({
      claimed_amount: newClaimedAmount,
      participants: newParticipants,
      is_active: isStillActive,
    }).eq("id", id);

    const { data: existing } = await supabase
      .from("holdings")
      .select("amount, avg_buy_price")
      .eq("user_id", userId)
      .eq("token_id", airdrop.token_id)
      .single();

    const prevAmount = Number(existing?.amount ?? 0);
    const newAmount = prevAmount + claimAmount;

    await supabase.from("holdings").upsert({
      user_id: userId,
      token_id: airdrop.token_id,
      token_name: airdrop.token_name,
      token_symbol: airdrop.token_symbol,
      token_emoji: airdrop.token_emoji,
      amount: newAmount,
      avg_buy_price: 0,
      current_price: 0,
      value: 0,
      pnl: 0,
      pnl_percent: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,token_id" });

    await supabase.from("token_activity").insert({
      type: "airdrop",
      user_id: userId,
      username: "airdrop",
      token_id: airdrop.token_id,
      token_symbol: airdrop.token_symbol,
      amount: claimAmount,
      timestamp: new Date().toISOString(),
    });

    const cooldownMs = Number(airdrop.cooldown_hours) * 60 * 60 * 1000;
    const nextClaimAt = new Date(Date.now() + cooldownMs).toISOString();

    return res.status(200).json({
      success: true,
      amount: claimAmount,
      nextClaimAt,
      message: `Recibiste ${claimAmount} ${airdrop.token_symbol}`,
    });
  } catch (err) {
    console.error("[POST /api/airdrops/:id/claim]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
