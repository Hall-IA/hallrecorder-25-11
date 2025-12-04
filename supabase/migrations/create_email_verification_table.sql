-- Créer la table pour stocker les codes de vérification d'email
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email ON public.email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_user_id ON public.email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON public.email_verification_codes(expires_at);

-- RLS (Row Level Security)
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Politique : seul le service_role peut lire/écrire
CREATE POLICY "Service role can manage email verification codes"
  ON public.email_verification_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Nettoyage automatique des codes expirés (optionnel - fonction cron)
-- Vous pouvez créer une fonction pour supprimer les codes expirés automatiquement
CREATE OR REPLACE FUNCTION clean_expired_email_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < NOW() OR (used = true AND created_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
