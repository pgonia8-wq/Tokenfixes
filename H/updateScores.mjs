/* ─────────────────────────────────────────────────────────────────────────────
   DESTINO: api/updateScores.mjs
   ESTADO: Correcto tal como está. Se entrega aquí como referencia auditada.

   REQUISITO DE SQL:
   [US1] Este endpoint llama a supabase.rpc("update_post_scores").
         Si esa función no existe en tu base de datos, el CRON falla cada
         15 minutos con "function update_post_scores() does not exist".
         → Ejecutar fixes/update_post_scores.sql en Supabase SQL Editor.

   CRON:
   El CRON está configurado en vercel.json:
     { "path": "/api/updateScores", "schedule": "*/15 * * * *" }
   Solo disponible en Vercel Pro. En Vercel Free el CRON no se ejecuta.

   SEGURIDAD:
   Protegido opcionalmente con CRON_SECRET en env vars de Vercel.
   Añadir CRON_SECRET en Vercel y el mismo valor en las llamadas al endpoint
   si se quiere proteger de llamadas externas.
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[UPDATE_SCORES] Supabase env vars missing");
      return res.status(500).json({
        success: false,
        error: "Supabase env vars missing",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Protección opcional con CRON_SECRET
    if (
      process.env.CRON_SECRET &&
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return res.status(401).end("Unauthorized");
    }

    const { error } = await supabase.rpc("update_post_scores");

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: "Scores updated",
    });
  } catch (err) {
    console.error("[UPDATE_SCORES] Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
