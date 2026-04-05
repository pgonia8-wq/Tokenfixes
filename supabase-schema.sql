-- ─────────────────────────────────────────────────────────────────────────────
-- TABLAS NECESARIAS PARA EL BACKEND DEL TOKEN MINI-APP
-- Ejecutar en: Supabase → SQL Editor
-- Orden importante: tokens antes de airdrops, holdings y token_activity
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. TOKENS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tokens (
  id                  TEXT        PRIMARY KEY,
  name                TEXT        NOT NULL,
  symbol              TEXT        NOT NULL,
  emoji               TEXT        DEFAULT '🌟',
  creator_id          TEXT        NOT NULL,
  creator_name        TEXT        NOT NULL DEFAULT 'anon',
  price_wld           NUMERIC     DEFAULT 0,
  price_usdc          NUMERIC     DEFAULT 0,
  market_cap          NUMERIC     DEFAULT 0,
  holders             INTEGER     DEFAULT 0,
  curve_percent       NUMERIC     DEFAULT 0,
  change_24h          NUMERIC     DEFAULT 0,
  volume_24h          NUMERIC     DEFAULT 0,
  total_supply        NUMERIC     DEFAULT 1000000,
  circulating_supply  NUMERIC     DEFAULT 0,
  locked_supply       NUMERIC     DEFAULT 0,
  burned_supply       NUMERIC     DEFAULT 0,
  lock_duration_days  INTEGER     DEFAULT 90,
  description         TEXT        DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  is_trending         BOOLEAN     DEFAULT FALSE,
  tags                TEXT[]      DEFAULT '{}',
  buy_pressure        NUMERIC     DEFAULT 50
);

-- ── 2. AIRDROPS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airdrops (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_id          TEXT        REFERENCES tokens(id) ON DELETE CASCADE,
  token_name        TEXT        NOT NULL,
  token_symbol      TEXT        NOT NULL,
  token_emoji       TEXT        DEFAULT '🌟',
  title             TEXT        NOT NULL,
  description       TEXT        DEFAULT '',
  total_amount      NUMERIC     DEFAULT 0,
  claimed_amount    NUMERIC     DEFAULT 0,
  daily_amount      NUMERIC     DEFAULT 10,
  participants      INTEGER     DEFAULT 0,
  max_participants  INTEGER     DEFAULT 1000,
  end_date          TIMESTAMPTZ,
  is_active         BOOLEAN     DEFAULT TRUE,
  cooldown_hours    INTEGER     DEFAULT 24,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. AIRDROP_CLAIMS ─────────────────────────────────────────────────────
-- Registra cada vez que un usuario reclama un airdrop.
-- UNIQUE(airdrop_id, user_id) se rompe si hay cooldown que permite reclamar
-- más de una vez — usar UNIQUE en (airdrop_id, user_id, claimed_at::date) o
-- sin UNIQUE y verificar desde el servidor (ya lo hace el endpoint).

CREATE TABLE IF NOT EXISTS airdrop_claims (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  airdrop_id  TEXT        REFERENCES airdrops(id) ON DELETE CASCADE,
  user_id     TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL,
  claimed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_airdrop_claims_user ON airdrop_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_airdrop_claims_airdrop ON airdrop_claims(airdrop_id);

-- ── 4. HOLDINGS ───────────────────────────────────────────────────────────
-- Posición actual de cada usuario en cada token.

CREATE TABLE IF NOT EXISTS holdings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT        NOT NULL,
  token_id      TEXT        REFERENCES tokens(id) ON DELETE CASCADE,
  token_name    TEXT        DEFAULT '',
  token_symbol  TEXT        DEFAULT '',
  token_emoji   TEXT        DEFAULT '🌟',
  amount        NUMERIC     DEFAULT 0,
  avg_buy_price NUMERIC     DEFAULT 0,
  current_price NUMERIC     DEFAULT 0,
  value         NUMERIC     DEFAULT 0,
  pnl           NUMERIC     DEFAULT 0,
  pnl_percent   NUMERIC     DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_token ON holdings(token_id);

-- ── 5. TOKEN_ACTIVITY ─────────────────────────────────────────────────────
-- Feed de actividad: compras, ventas, creaciones, airdrops, locks, burns.

CREATE TABLE IF NOT EXISTS token_activity (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT        NOT NULL,  -- buy | sell | create | airdrop | lock | burn
  user_id       TEXT        NOT NULL,
  username      TEXT        DEFAULT 'anon',
  token_id      TEXT        REFERENCES tokens(id) ON DELETE CASCADE,
  token_symbol  TEXT        NOT NULL,
  amount        NUMERIC     DEFAULT 0,
  price         NUMERIC,
  total         NUMERIC,
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_activity_token ON token_activity(token_id);
CREATE INDEX IF NOT EXISTS idx_token_activity_user  ON token_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_token_activity_ts    ON token_activity(timestamp DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
-- El backend usa SUPABASE_SERVICE_ROLE_KEY que bypasea RLS.
-- Habilitar RLS es opcional pero recomendado para acceso directo desde el cliente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE airdrops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE airdrop_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_activity ENABLE ROW LEVEL SECURITY;

-- Lectura pública de tokens y airdrops (las funciones serverless lo manejan, pero útil para debugging)
CREATE POLICY IF NOT EXISTS "tokens_public_read"   ON tokens         FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "airdrops_public_read" ON airdrops       FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "activity_public_read" ON token_activity FOR SELECT USING (true);
