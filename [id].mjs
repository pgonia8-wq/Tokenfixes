import { supabase, cors, mapTokenRow } from "../_supabase.mjs";

/**
 * GET /api/tokens/:id
 * Devuelve un token específico por su ID.
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing token id" });

  try {
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return res.status(404).json({ error: "Token not found" });
      throw error;
    }

    return res.status(200).json(mapTokenRow(data));
  } catch (err) {
    console.error("[GET /api/tokens/:id]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
