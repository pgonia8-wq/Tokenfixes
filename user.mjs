import { supabase, cors } from "./_supabase.mjs";

/**
 * GET /api/user?user_id=XXX
 * Devuelve el perfil del usuario para el token app, uniendo datos de profiles.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "Missing user_id" });

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, bio, created_at, tier")
      .eq("id", user_id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const { count: tokensCreated } = await supabase
      .from("tokens")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user_id);

    const { count: tokensHeld } = await supabase
      .from("holdings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gt("amount", 0);

    const { data: holdingsData } = await supabase
      .from("holdings")
      .select("value")
      .eq("user_id", user_id);

    const totalValue = (holdingsData ?? []).reduce((acc, h) => acc + Number(h.value ?? 0), 0);

    return res.status(200).json({
      id: user_id,
      username: profile?.username ?? "anon",
      avatarUrl: profile?.avatar_url ?? null,
      bio: profile?.bio ?? "",
      balanceUsdc: 0,
      balanceWld: 0,
      totalValue,
      tokensCreated: tokensCreated ?? 0,
      tokensHeld: tokensHeld ?? 0,
      joinedAt: profile?.created_at ?? new Date().toISOString(),
      tier: profile?.tier ?? "free",
    });
  } catch (err) {
    console.error("[GET /api/user]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
