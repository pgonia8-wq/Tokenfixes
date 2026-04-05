import { supabase, cors, mapTokenRow } from "../_supabase.mjs";

/**
 * GET /api/tokens/trending
 * Devuelve los tokens marcados como trending, ordenados por volumen.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("is_trending", true)
      .order("volume_24h", { ascending: false })
      .limit(20);

    if (error) throw error;

    const tokens = (data ?? []).map(mapTokenRow);
    return res.status(200).json({ tokens, total: tokens.length, hasMore: false });
  } catch (err) {
    console.error("[GET /api/tokens/trending]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
