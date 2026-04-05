import { supabase, cors } from "../../_supabase.mjs";

/**
 * POST /api/tokens/:id/buy
 * Body: { tokenId, amount, currency, userId, paymentMethod }
 *
 * Registra una compra de token en Supabase:
 *  1. Actualiza holdings del usuario (upsert con avg_buy_price ponderado)
 *  2. Actualiza stats del token (holders, volume, curvePercent, buyPressure)
 *  3. Registra el evento en token_activity
 *
 * NOTA: La verificación del pago real (MiniKit) ocurre en el cliente antes de
 * llamar a este endpoint. Este endpoint asume que el pago ya fue verificado.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const { amount, currency = "USDC", userId, paymentMethod } = req.body ?? {};

  if (!id || !amount || !userId) {
    return res.status(400).json({ error: "Missing required fields: id, amount, userId" });
  }

  try {
    const { data: token, error: tokenErr } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", id)
      .single();

    if (tokenErr || !token) return res.status(404).json({ error: "Token not found" });

    const price = currency === "WLD" ? Number(token.price_wld) : Number(token.price_usdc);
    const totalCost = price * Number(amount);
    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    const username = profile?.username ?? "anon";

    const { data: existing } = await supabase
      .from("holdings")
      .select("amount, avg_buy_price")
      .eq("user_id", userId)
      .eq("token_id", id)
      .single();

    const prevAmount = Number(existing?.amount ?? 0);
    const prevAvg = Number(existing?.avg_buy_price ?? 0);
    const newAmount = prevAmount + Number(amount);
    const newAvgBuyPrice = prevAmount === 0
      ? price
      : ((prevAmount * prevAvg) + (Number(amount) * price)) / newAmount;

    await supabase.from("holdings").upsert({
      user_id: userId,
      token_id: id,
      token_name: token.name,
      token_symbol: token.symbol,
      token_emoji: token.emoji,
      amount: newAmount,
      avg_buy_price: newAvgBuyPrice,
      current_price: price,
      value: newAmount * price,
      pnl: newAmount * (price - newAvgBuyPrice),
      pnl_percent: newAvgBuyPrice > 0 ? ((price - newAvgBuyPrice) / newAvgBuyPrice) * 100 : 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,token_id" });

    const { data: holdersCount } = await supabase
      .from("holdings")
      .select("*", { count: "exact", head: true })
      .eq("token_id", id)
      .gt("amount", 0);

    const newVolume = Number(token.volume_24h) + totalCost;
    const newCurve = Math.min(100, Number(token.curve_percent) + (totalCost / 10000) * 0.5);
    const newBuyPressure = Math.min(100, Number(token.buy_pressure) + 2);

    await supabase.from("tokens").update({
      holders: holdersCount ?? Number(token.holders),
      volume_24h: newVolume,
      curve_percent: newCurve,
      buy_pressure: newBuyPressure,
      market_cap: newCurve > 0 ? (Number(token.total_supply) * price) : Number(token.market_cap),
    }).eq("id", id);

    await supabase.from("token_activity").insert({
      type: "buy",
      user_id: userId,
      username,
      token_id: id,
      token_symbol: token.symbol,
      amount: Number(amount),
      price,
      total: totalCost,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      txHash,
      amount: Number(amount),
      price,
      total: totalCost,
      message: `Compraste ${amount} ${token.symbol} por ${totalCost.toFixed(4)} ${currency}`,
    });
  } catch (err) {
    console.error("[POST /api/tokens/:id/buy]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
