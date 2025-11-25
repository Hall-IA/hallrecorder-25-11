-- Créer la table pour stocker les codes OTP de réinitialisation de mot de passe
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par email et code
CREATE INDEX idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX idx_password_reset_codes_code ON password_reset_codes(code);
CREATE INDEX idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- RLS : Pas besoin de policies car seules les Edge Functions (avec service_role) y accèdent
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Fonction pour nettoyer automatiquement les codes expirés (optionnel, peut être appelé périodiquement)
CREATE OR REPLACE FUNCTION clean_expired_reset_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
