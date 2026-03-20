-- Schéma de base de données pour la synchronisation MicroFoX
-- Exécutez ce script dans l'éditeur SQL de votre projet Supabase

-- Table de stockage générique pour les données localStorage
CREATE TABLE IF NOT EXISTS storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation de la sécurité au niveau des lignes (RLS)
ALTER TABLE storage ENABLE ROW LEVEL SECURITY;

-- Politique d'accès public (via la clé anon)
-- Note : Pour une production réelle, il est recommandé de restreindre l'accès en fonction de l'authentification
CREATE POLICY "Accès public" ON storage FOR ALL USING (true) WITH CHECK (true);

-- Index pour accélérer les recherches par préfixe (utilisé lors du chargement)
CREATE INDEX IF NOT EXISTS idx_storage_key_prefix ON storage (key text_pattern_ops);
