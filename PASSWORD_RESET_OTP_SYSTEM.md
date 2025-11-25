# 🔐 Système de Réinitialisation de Mot de Passe avec OTP

## ✅ Implémentation Complète - Système Sécurisé et Fiable

### 📋 Vue d'ensemble

Le système de réinitialisation de mot de passe utilise un code OTP (One-Time Password) de 6 chiffres envoyé par email via Resend. Cette approche est **beaucoup plus sécurisée** que le système natif de Supabase car elle utilise l'Admin API et ne crée aucune session automatique.

---

## 🎯 Avantages par rapport à l'ancien système

| Ancien système (Supabase natif) | Nouveau système (OTP) |
|----------------------------------|----------------------|
| ❌ Crée une session automatique | ✅ Aucune session automatique |
| ❌ Utilisateur peut rafraîchir et rester connecté | ✅ Utilisateur doit se reconnecter manuellement |
| ❌ Tokens dans l'URL (risque de fuite) | ✅ Code OTP séparé (email uniquement) |
| ❌ localStorage non fiable | ✅ Pas de localStorage nécessaire |
| ❌ Complexe à gérer côté frontend | ✅ Flow simple et clair |

---

## 🔄 Flow Complet

```
1. Utilisateur clique "Mot de passe oublié ?" sur page de login
   ↓
2. Modal s'ouvre - Étape 1 : Entrer l'email
   ↓
3. Edge Function "send-password-reset-code" :
   - Vérifie que l'email existe
   - Génère un code de 6 chiffres aléatoire
   - Stocke le code dans la table password_reset_codes
   - Envoie un email HTML professionnel via Resend
   ↓
4. Modal - Étape 2 : Entrer le code + nouveau mot de passe
   ↓
5. Edge Function "verify-and-reset-password" :
   - Vérifie que le code est valide et non expiré
   - Utilise Admin API pour changer le mot de passe
   - Marque le code comme utilisé
   - AUCUNE SESSION N'EST CRÉÉE
   ↓
6. Modal affiche le succès et se ferme
   ↓
7. Utilisateur doit se connecter manuellement avec le nouveau mot de passe
```

---

## 📁 Fichiers Créés

### 1. Migration SQL
**Fichier**: `supabase/migrations/20251125000000_add_password_reset_codes.sql`

Crée la table `password_reset_codes` avec :
- `user_id` : Référence à l'utilisateur
- `email` : Email de l'utilisateur
- `code` : Code OTP de 6 chiffres
- `expires_at` : Expiration (15 minutes)
- `used` : Booléen pour usage unique

### 2. Edge Function - Envoi du Code
**Fichier**: `supabase/functions/send-password-reset-code/index.ts`

**Fonctionnalités** :
- Vérifie que l'utilisateur existe (via Admin API)
- Génère un code de 6 chiffres aléatoire
- Invalide tous les codes précédents pour cet email
- Insère le nouveau code avec expiration de 15 minutes
- Envoie un email HTML professionnel via Resend (support@help.hallia.ai)
- Retourne toujours un succès même si l'email n'existe pas (sécurité anti-énumération)

**Variables d'environnement requises** :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`

### 3. Edge Function - Vérification et Réinitialisation
**Fichier**: `supabase/functions/verify-and-reset-password/index.ts`

**Fonctionnalités** :
- Vérifie que le code existe et n'a pas été utilisé
- Vérifie que le code n'a pas expiré (15 minutes)
- Valide le nouveau mot de passe (minimum 6 caractères)
- **Utilise Admin API** : `supabase.auth.admin.updateUserById()`
- Marque le code comme utilisé
- Invalide tous les autres codes pour cet email
- **IMPORTANT** : N'utilise PAS `updateUser()`, donc **aucune session n'est créée**

**Variables d'environnement requises** :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Composant React - Modal OTP
**Fichier**: `src/components/PasswordResetModal.tsx`

**Fonctionnalités** :
- Interface en 2 étapes (email → code + mot de passe)
- Champ code stylisé avec limitation à 6 chiffres
- Validation côté client
- Messages d'erreur clairs
- Fermeture automatique après succès
- Bouton "Retour" pour revenir à l'étape 1

### 5. Intégration dans Login
**Fichier**: `src/components/Login.tsx`

**Modifications** :
- Ajout du bouton "Mot de passe oublié ?" (visible uniquement en mode connexion)
- State `showPasswordReset` pour contrôler l'affichage du modal
- Import du composant `PasswordResetModal`

---

## 🎨 Design de l'Email

L'email envoyé utilise un template HTML professionnel aux couleurs d'Hallia :

**Caractéristiques** :
- Gradient orange moderne (FB923C → F97316)
- Code OTP stylisé en gros caractères (48px, monospace)
- Informations importantes dans un bloc coloré
- Footer avec contact support
- Responsive et optimisé pour tous les clients email
- Expéditeur : `HALL Recorder <support@help.hallia.ai>`

---

## 🔒 Sécurité

### Points Forts

1. **Admin API** : Utilise `admin.updateUserById()` qui ne crée PAS de session
2. **Code unique** : Usage unique, invalidé après utilisation
3. **Expiration courte** : 15 minutes seulement
4. **Anti-énumération** : Retourne toujours un succès même si l'email n'existe pas
5. **Invalidation multiple** : Tous les codes précédents sont invalidés lors d'une nouvelle demande
6. **Pas de token dans l'URL** : Le code est uniquement dans l'email
7. **Validation stricte** : Vérification côté serveur du code, de l'expiration, et du statut

### Comparaison avec les Applications Réelles

Ce système suit le même modèle que :
- **Gmail** : Code de vérification par email
- **Slack** : Code OTP pour changement de mot de passe
- **Notion** : Code de vérification pour reset
- **Stripe Dashboard** : Code OTP pour opérations sensibles

---

## 🚀 Déploiement

### 1. Appliquer la migration

```bash
# En local avec Supabase CLI
supabase db push

# Ou appliquer manuellement via Supabase Dashboard > SQL Editor
```

### 2. Déployer les Edge Functions

```bash
# send-password-reset-code
supabase functions deploy send-password-reset-code

# verify-and-reset-password
supabase functions deploy verify-and-reset-password
```

### 3. Configurer les variables d'environnement

Dans le dashboard Supabase, aller dans **Edge Functions > Settings** et ajouter :

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Les autres variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) sont automatiquement injectées par Supabase.

### 4. Vérifier la clé API Resend

S'assurer que le domaine `help.hallia.ai` est vérifié dans Resend et que la clé API a les permissions d'envoi.

---

## 🧪 Tests

### Test 1 : Demande de code
1. Ouvrir l'application en navigation privée
2. Cliquer sur "Mot de passe oublié ?"
3. Entrer un email valide
4. Vérifier la réception de l'email avec le code

### Test 2 : Code invalide
1. Entrer un mauvais code
2. Vérifier que l'erreur "Code invalide ou expiré" s'affiche

### Test 3 : Code expiré
1. Attendre 15 minutes après réception du code
2. Essayer d'utiliser le code
3. Vérifier que l'erreur "Code expiré" s'affiche

### Test 4 : Réinitialisation réussie
1. Demander un nouveau code
2. Entrer le code correct immédiatement
3. Entrer un nouveau mot de passe (2 fois)
4. Vérifier le message de succès
5. **IMPORTANT** : Vérifier qu'on est déconnecté et redirigé vers login
6. Se connecter avec le nouveau mot de passe

### Test 5 : Usage unique
1. Demander un code
2. Utiliser le code pour changer le mot de passe
3. Essayer de réutiliser le même code
4. Vérifier que l'erreur "Code invalide ou expiré" s'affiche

### Test 6 : Email inexistant
1. Entrer un email qui n'existe pas
2. Vérifier qu'un message de succès est affiché (anti-énumération)
3. Vérifier qu'aucun email n'est reçu

---

## 📊 Monitoring

### Logs à surveiller

**Edge Function send-password-reset-code** :
- `✅ Email envoyé avec succès à: xxx@example.com`
- `⚠️ Email non trouvé: xxx@example.com`
- `❌ Erreur lors de l'envoi de l'email`

**Edge Function verify-and-reset-password** :
- `✅ Mot de passe réinitialisé avec succès pour: xxx@example.com`
- `❌ Code invalide ou déjà utilisé pour: xxx@example.com`
- `❌ Code expiré pour: xxx@example.com`

### Nettoyage des codes expirés

Optionnel : Configurer un cron job pour nettoyer les codes expirés

```sql
-- Appeler cette fonction périodiquement
SELECT clean_expired_reset_codes();
```

---

## ✅ Résumé

**Problème initial** : L'ancien système avec Supabase natif créait une session automatique, permettant à l'utilisateur de rafraîchir et rester connecté sans changer le mot de passe.

**Solution implémentée** : Système OTP professionnel avec :
- Code de 6 chiffres par email
- Expiration de 15 minutes
- Usage unique
- Admin API (pas de session automatique)
- Connexion manuelle obligatoire après reset
- Email professionnel via Resend (support@help.hallia.ai)

**Résultat** : Un système de réinitialisation de mot de passe **fiable, sécurisé et professionnel**, identique aux applications modernes comme Gmail, Slack, et Notion.

---

## 📝 Notes Importantes

1. **Ne jamais utiliser `updateUser()`** dans le contexte de reset password - toujours utiliser `admin.updateUserById()`
2. **Ne jamais créer de session automatique** après un reset password
3. **Toujours invalider les codes précédents** lors d'une nouvelle demande
4. **Toujours vérifier l'expiration** côté serveur
5. **Ne jamais révéler si un email existe** (anti-énumération)

---

**✅ Système prêt pour la production !**
