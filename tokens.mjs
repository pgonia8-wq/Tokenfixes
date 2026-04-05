import { supabase, cors, mapTokenRow } from "../_supabase.mjs";

/**
 * POST /api/creator/tokens
 * Body: { name, symbol, description, emoji, totalSupply, creatorId, lockPercent, lockDurationDays }
 * Crea un nuevo token en Supabase y lo devuelve.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    name,
    symbol,
    description,
    emoji,
    totalSupply,
    creatorId,
    lockPercent = 60,
    lockDurationDays = 90,
  } = req.body ?? {};

  if (!name || !symbol || !creatorId) {
    return res.status(400).json({ error: "Missing required fields: name, symbol, creatorId" });
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", creatorId)
      .single();

    const creatorName = profile?.username ?? "anon";

    const supply = Number(totalSupply ?? 1_000_000);
    const locked = supply * (Number(lockPercent) / 100);
    const circulating = supply - locked;

    const newToken = {
      id: `tkn_${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      emoji: emoji ?? "🌟",
      creator_id: creatorId,
      creator_name: creatorName,
      price_wld: 0.001,
      price_usdc: 0.003,
      market_cap: 3000,
      holders: 1,
      curve_percent: 0,
      change_24h: 0,
      volume_24h: 0,
      total_supply: supply,
      circulating_supply: circulating,
      locked_supply: locked,
      burned_supply: 0,
      lock_duration_days: Number(lockDurationDays),
      description: description ?? "",
      is_trending: false,
      tags: [],
      buy_pressure: 50,
    };

    const { data: inserted, error } = await supabase
      .from("tokens")
      .insert(newToken)
      .select()
      .single();

    if (error) throw error;

    await supabase.from("token_activity").insert({
      type: "create",
      user_id: creatorId,
      username: creatorName,
      token_id: inserted.id,
      token_symbol: inserted.symbol,
      amount: circulating,
      timestamp: new Date().toISOString(),
    });

    await supabase.from("holdings").upsert({
      user_id: creatorId,
      token_id: inserted.id,
      token_name: inserted.name,
      token_symbol: inserted.symbol,
      token_emoji: inserted.emoji,
      amount: circulating,
      avg_buy_price: inserted.price_usdc,
      current_price: inserted.price_usdc,
      value: circulating * Number(inserted.price_usdc),
      pnl: 0,
      pnl_percent: 0,
    }, { onConflict: "user_id,token_id" });

    return res.status(201).json(mapTokenRow(inserted));
  } catch (err) {
    console.error("[POST /api/creator/tokens]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
