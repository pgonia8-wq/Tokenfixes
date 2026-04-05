import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function mapTokenRow(row) {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    emoji: row.emoji ?? "🌟",
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    priceWld: Number(row.price_wld ?? 0),
    priceUsdc: Number(row.price_usdc ?? 0),
    marketCap: Number(row.market_cap ?? 0),
    holders: Number(row.holders ?? 0),
    curvePercent: Number(row.curve_percent ?? 0),
    change24h: Number(row.change_24h ?? 0),
    volume24h: Number(row.volume_24h ?? 0),
    totalSupply: Number(row.total_supply ?? 1000000),
    circulatingSupply: Number(row.circulating_supply ?? 0),
    lockedSupply: Number(row.locked_supply ?? 0),
    burnedSupply: Number(row.burned_supply ?? 0),
    lockDurationDays: Number(row.lock_duration_days ?? 90),
    description: row.description ?? "",
    createdAt: row.created_at,
    isTrending: Boolean(row.is_trending),
    tags: row.tags ?? [],
    buyPressure: Number(row.buy_pressure ?? 50),
  };
}

export function mapAirdropRow(row) {
  return {
    id: row.id,
    tokenId: row.token_id,
    tokenName: row.token_name,
    tokenSymbol: row.token_symbol,
    tokenEmoji: row.token_emoji ?? "🌟",
    title: row.title,
    description: row.description ?? "",
    totalAmount: Number(row.total_amount ?? 0),
    claimedAmount: Number(row.claimed_amount ?? 0),
    dailyAmount: Number(row.daily_amount ?? 0),
    participants: Number(row.participants ?? 0),
    maxParticipants: Number(row.max_participants ?? 1000),
    endDate: row.end_date,
    isActive: Boolean(row.is_active),
    cooldownHours: Number(row.cooldown_hours ?? 24),
  };
}

export function mapActivityRow(row) {
  return {
    id: row.id,
    type: row.type,
    userId: row.user_id,
    username: row.username ?? "anon",
    tokenId: row.token_id,
    tokenSymbol: row.token_symbol,
    amount: Number(row.amount ?? 0),
    price: row.price != null ? Number(row.price) : undefined,
    total: row.total != null ? Number(row.total) : undefined,
    timestamp: row.timestamp ?? row.created_at,
  };
}

export function mapHoldingRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenId: row.token_id,
    tokenName: row.token_name,
    tokenSymbol: row.token_symbol,
    tokenEmoji: row.token_emoji ?? "🌟",
    amount: Number(row.amount ?? 0),
    avgBuyPrice: Number(row.avg_buy_price ?? 0),
    currentPrice: Number(row.current_price ?? 0),
    value: Number(row.value ?? 0),
    pnl: Number(row.pnl ?? 0),
    pnlPercent: Number(row.pnl_percent ?? 0),
    updatedAt: row.updated_at,
  };
}
