-- Activer la réplication Realtime pour la table email_open_events
-- Cela permet aux clients de recevoir les notifications en temps réel quand des événements d'ouverture sont insérés

ALTER PUBLICATION supabase_realtime ADD TABLE email_open_events;

-- Note: Si l'erreur "publication already contains relation" apparaît, c'est que la table est déjà ajoutée
-- Dans ce cas, ignorer l'erreur et vérifier dans le dashboard Supabase → Database → Replication
