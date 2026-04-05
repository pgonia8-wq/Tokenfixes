import { supabase, cors, mapAirdropRow } from "./_supabase.mjs";

/**
 * GET /api/airdrops
 * Devuelve todos los airdrops activos con info de si el usuario ya reclamó.
 * Parámetros opcionales: user_id
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { user_id } = req.query;

  try {
    const { data: airdrops, error } = await supabase
      .from("airdrops")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    let claimedSet = new Set();
    let nextClaimMap = {};

    if (user_id) {
      const { data: claims } = await supabase
        .from("airdrop_claims")
        .select("airdrop_id, claimed_at")
        .eq("user_id", user_id);

      (claims ?? []).forEach((c) => {
        const airdrop = (airdrops ?? []).find((a) => a.id === c.airdrop_id);
        const cooldownHours = airdrop?.cooldown_hours ?? 24;
        const claimedAt = new Date(c.claimed_at);
        const nextAt = new Date(claimedAt.getTime() + cooldownHours * 60 * 60 * 1000);
        if (nextAt > new Date()) {
          claimedSet.add(c.airdrop_id);
          nextClaimMap[c.airdrop_id] = nextAt.toISOString();
        }
      });
    }

    const result = (airdrops ?? []).map((row) => ({
      ...mapAirdropRow(row),
      hasClaimed: claimedSet.has(row.id),
      nextClaimAt: nextClaimMap[row.id] ?? null,
    }));

    return res.status(200).json({ airdrops: result, total: result.length });
  } catch (err) {
    console.error("[GET /api/airdrops]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
