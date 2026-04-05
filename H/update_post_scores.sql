-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: update_post_scores()
-- Destino: Supabase → SQL Editor
--
-- api/updateScores.mjs la llama cada 15 minutos desde el CRON de Vercel:
--   supabase.rpc("update_post_scores")
--
-- Si esta función no existe en tu base de datos, el CRON falla con:
--   "function update_post_scores() does not exist"
--
-- La función recalcula el score de cada post basándose en:
--   - Likes (peso alto)
--   - Views (peso medio)
--   - Comments (peso medio)
--   - Tiempo transcurrido (decay exponencial para favorecer contenido reciente)
--
-- Ajusta los pesos (x0.7, x0.5, x0.3) según las métricas de tu tabla posts.
-- Si tu tabla posts tiene columnas con nombres distintos, cámbialos aquí.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_post_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET score = (
    -- Engagement score ponderado
    (COALESCE(likes_count, 0)    * 3.0) +
    (COALESCE(views_count, 0)    * 0.5) +
    (COALESCE(comments_count, 0) * 2.0)
  )
  * -- Decay temporal: score decrece con el tiempo (vida media ~48 horas)
  EXP(
    -EXTRACT(EPOCH FROM (NOW() - created_at)) / (48.0 * 3600)
  );
END;
$$;

-- Permitir que el rol anon/authenticated de Supabase ejecute la función
-- (no necesario si el backend usa service_role key, pero es buena práctica)
GRANT EXECUTE ON FUNCTION update_post_scores() TO service_role;
