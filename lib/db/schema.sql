-- Insert Coin schema. Run once with `npm run db:setup` (idempotent).

CREATE TABLE IF NOT EXISTS wallets (
  id            SERIAL PRIMARY KEY,
  pubkey        TEXT NOT NULL UNIQUE,
  enc_secret    TEXT NOT NULL,
  iv            TEXT NOT NULL,
  tag           TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('creator','trading')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coins (
  id                  SERIAL PRIMARY KEY,
  mint                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  ticker              TEXT NOT NULL UNIQUE,
  story               TEXT NOT NULL,
  input_text          TEXT NOT NULL,
  salt                INTEGER NOT NULL DEFAULT 0,
  sprite_json         JSONB NOT NULL,
  frames_json         JSONB,
  archetype           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'launching' CHECK (status IN ('launching','live','bonded','failed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  creator_wallet_id   INTEGER NOT NULL REFERENCES wallets(id),
  trading_wallet_id   INTEGER NOT NULL REFERENCES wallets(id),
  owner_key_hash      TEXT NOT NULL,
  agent_mode          TEXT NOT NULL DEFAULT 'burn' CHECK (agent_mode IN ('burn','trade','hybrid')),
  split_burn_pct      INTEGER NOT NULL DEFAULT 100,
  split_trade_pct     INTEGER NOT NULL DEFAULT 0,
  strategy            TEXT NOT NULL DEFAULT 'momentum',
  profit_route        TEXT NOT NULL DEFAULT 'reinvest' CHECK (profit_route IN ('burn','reinvest','beneficiary')),
  beneficiary_address TEXT,
  level               INTEGER NOT NULL DEFAULT 0,
  terminal_json       JSONB NOT NULL,
  paused              BOOLEAN NOT NULL DEFAULT false,
  -- agent runtime state
  halted              BOOLEAN NOT NULL DEFAULT false,
  halt_reason         TEXT,
  fail_count          INTEGER NOT NULL DEFAULT 0,
  trade_live          BOOLEAN NOT NULL DEFAULT false,
  trading_paused_until TIMESTAMPTZ,
  sleeping            BOOLEAN NOT NULL DEFAULT false,
  last_event_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  launch_sig          TEXT,
  pair_address        TEXT
);

-- Append-only money ledger. Every lamport that moves through an agent wallet is recorded here.
CREATE TABLE IF NOT EXISTS ledger (
  id                 BIGSERIAL PRIMARY KEY,
  coin_id            INTEGER NOT NULL REFERENCES coins(id),
  ts                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  wallet             TEXT NOT NULL CHECK (wallet IN ('creator','trading','funder','none')),
  kind               TEXT NOT NULL CHECK (kind IN ('fee_received','allocated','buyback','burn','trade_open','trade_close','withdraw','network_fee','launch')),
  sol_delta_lamports BIGINT NOT NULL DEFAULT 0,
  token_delta        NUMERIC NOT NULL DEFAULT 0,
  tx_sig             TEXT,
  meta_json          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ledger_coin_idx ON ledger (coin_id, ts DESC);
CREATE OR REPLACE FUNCTION ledger_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS ledger_no_change ON ledger;
CREATE TRIGGER ledger_no_change BEFORE UPDATE OR DELETE ON ledger
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();

CREATE TABLE IF NOT EXISTS trades (
  id             SERIAL PRIMARY KEY,
  coin_id        INTEGER NOT NULL REFERENCES coins(id),
  token_mint     TEXT NOT NULL,
  token_symbol   TEXT,
  strategy       TEXT NOT NULL,
  dry_run        BOOLEAN NOT NULL DEFAULT true,
  entry_sig      TEXT,
  entry_price    DOUBLE PRECISION NOT NULL,
  size_lamports  BIGINT NOT NULL,
  token_amount   NUMERIC NOT NULL DEFAULT 0,
  tp             DOUBLE PRECISION NOT NULL,
  sl             DOUBLE PRECISION NOT NULL,
  trail          DOUBLE PRECISION,
  peak_price     DOUBLE PRECISION,
  max_hold_min   INTEGER NOT NULL,
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_sig       TEXT,
  exit_price     DOUBLE PRECISION,
  closed_at      TIMESTAMPTZ,
  pnl_lamports   BIGINT,
  reason         TEXT
);
CREATE INDEX IF NOT EXISTS trades_coin_idx ON trades (coin_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  coin_id      INTEGER NOT NULL REFERENCES coins(id),
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  type         TEXT NOT NULL CHECK (type IN ('launched','fee','allocated','buyback','burn','trade_open','profit','loss','bonded','level_up','sleep','wake')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tx_sig       TEXT
);
CREATE INDEX IF NOT EXISTS events_id_idx ON events (id DESC);
CREATE INDEX IF NOT EXISTS events_coin_idx ON events (coin_id, id DESC);

CREATE TABLE IF NOT EXISTS milestones (
  coin_id    INTEGER NOT NULL REFERENCES coins(id),
  level      INTEGER NOT NULL,
  reached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coin_id, level)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('emergency_stop', 'false') ON CONFLICT (key) DO NOTHING;
