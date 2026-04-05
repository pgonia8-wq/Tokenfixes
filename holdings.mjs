import { supabase, cors, mapHoldingRow } from "../_supabase.mjs";

/**
 * GET /api/user/holdings?user_id=XXX
 * Devuelve los tokens que tiene el usuario, con PnL calculado.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  try {
    const { data, error } = await supabase
      .from("holdings")
      .select(`
        id, user_id, amount, avg_buy_price, updated_at,
        tokens (
          id, name, symbol, emoji, price_wld, price_usdc
        )
      `)
      .eq("user_id", user_id)
      .gt("amount", 0);

    if (error) throw error;

    const holdings = (data ?? []).map((row) => {
      const token = Array.isArray(row.tokens) ? row.tokens[0] : row.tokens;
      const currentPrice = Number(token?.price_usdc ?? 0);
      const amount = Number(row.amount ?? 0);
      const avgBuyPrice = Number(row.avg_buy_price ?? 0);
      const value = amount * currentPrice;
      const cost = amount * avgBuyPrice;
      const pnl = value - cost;
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

      return {
        id: row.id,
        userId: row.user_id,
        tokenId: token?.id ?? "",
        tokenName: token?.name ?? "",
        tokenSymbol: token?.symbol ?? "",
        tokenEmoji: token?.emoji ?? "🌟",
        amount,
        avgBuyPrice,
        currentPrice,
        value,
        pnl,
        pnlPercent,
        updatedAt: row.updated_at,
      };
    });

    const totalValue = holdings.reduce((acc, h) => acc + h.value, 0);
    const totalPnl = holdings.reduce((acc, h) => acc + h.pnl, 0);
    const totalCost = totalValue - totalPnl;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return res.status(200).json({ holdings, totalValue, totalPnl, totalPnlPercent });
  } catch (err) {
    console.error("[GET /api/user/holdings]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
