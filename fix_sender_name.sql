-- Vider le sender_name pour ne plus afficher de nom d'expéditeur
-- Remplacez 'VOTRE_USER_ID' par votre vrai user_id ou utilisez la version avec email

-- Version 1: Si vous connaissez votre user_id
-- UPDATE user_settings SET sender_name = NULL WHERE user_id = 'VOTRE_USER_ID';

-- Version 2: Pour tous les utilisateurs (attention!)
-- UPDATE user_settings SET sender_name = NULL;

-- Version 3: Trouver votre user_id via email puis mettre à jour
UPDATE user_settings 
SET sender_name = NULL 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%badr%'
);

-- Vérifier le résultat
SELECT user_id, sender_name, sender_email, smtp_user 
FROM user_settings 
WHERE sender_name IS NOT NULL;

