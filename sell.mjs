import { supabase, cors } from "../../_supabase.mjs";

/**
 * POST /api/tokens/:id/sell
 * Body: { tokenId, amount, userId }
 *
 * Registra una venta de token en Supabase:
 *  1. Verifica que el usuario tiene suficiente balance
 *  2. Actualiza holdings (reduce amount)
 *  3. Actualiza stats del token (volume, buyPressure)
 *  4. Registra el evento en token_activity
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const { amount, userId } = req.body ?? {};

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

    const { data: holding } = await supabase
      .from("holdings")
      .select("amount, avg_buy_price")
      .eq("user_id", userId)
      .eq("token_id", id)
      .single();

    const ownedAmount = Number(holding?.amount ?? 0);
    if (ownedAmount < Number(amount)) {
      return res.status(400).json({ error: `Saldo insuficiente. Tienes ${ownedAmount} ${token.symbol}` });
    }

    const price = Number(token.price_usdc);
    const totalReceived = price * Number(amount);
    const newAmount = ownedAmount - Number(amount);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    const username = profile?.username ?? "anon";

    const avgBuy = Number(holding?.avg_buy_price ?? 0);
    if (newAmount <= 0) {
      await supabase.from("holdings").delete().eq("user_id", userId).eq("token_id", id);
    } else {
      await supabase.from("holdings").update({
        amount: newAmount,
        current_price: price,
        value: newAmount * price,
        pnl: newAmount * (price - avgBuy),
        pnl_percent: avgBuy > 0 ? ((price - avgBuy) / avgBuy) * 100 : 0,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("token_id", id);
    }

    const newVolume = Number(token.volume_24h) + totalReceived;
    const newBuyPressure = Math.max(0, Number(token.buy_pressure) - 2);

    await supabase.from("tokens").update({
      volume_24h: newVolume,
      buy_pressure: newBuyPressure,
    }).eq("id", id);

    await supabase.from("token_activity").insert({
      type: "sell",
      user_id: userId,
      username,
      token_id: id,
      token_symbol: token.symbol,
      amount: Number(amount),
      price,
      total: totalReceived,
      timestamp: new Date().toISOString(),
    });

    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`;

    return res.status(200).json({
      success: true,
      txHash,
      amount: Number(amount),
      price,
      total: totalReceived,
      message: `Vendiste ${amount} ${token.symbol} por ${totalReceived.toFixed(4)} USDC`,
    });
  } catch (err) {
    console.error("[POST /api/tokens/:id/sell]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
