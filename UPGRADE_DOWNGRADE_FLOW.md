# Flux de Changement d'Abonnement

## Règles Métier

### 1. Upgrade (Starter → Illimité)

**Comportement :**
- Changement **immédiat**
- Stripe applique un **prorata automatique** (`proration_behavior: 'create_prorations'`)
- Le client est facturé immédiatement pour la différence
- Le cycle de facturation reste identique

**Expérience utilisateur :**
1. L'utilisateur clique sur "Changer pour la formule Illimitée"
2. Message affiché : "Passage immédiat au plan Illimité. Un prorata a été appliqué automatiquement par Stripe."
3. La base de données est mise à jour immédiatement :
   - `user_subscriptions.plan_type` → 'unlimited'
   - `user_subscriptions.minutes_quota` → NULL
   - `stripe_subscriptions.price_id` → price_1SSyNh14zZqoQtSCqPL9VwTj
4. La facture de prorata apparaît dans Stripe dans quelques secondes
5. Un auto-refresh des factures est déclenché après 3 secondes

### 2. Downgrade (Illimité → Starter)

**Comportement :**
- Changement **programmé** pour le prochain cycle
- Aucun prorata (`proration_behavior: 'none'`)
- Le client conserve les avantages du plan Illimité jusqu'à la fin du cycle
- Le cycle de facturation reste identique (`billing_cycle_anchor: 'unchanged'`)

**Expérience utilisateur :**
1. L'utilisateur clique sur "Changer pour la formule Starter"
2. Message affiché : "Votre changement vers le plan Starter sera appliqué le [DATE]."
3. Une bannière d'information apparaît :
   - "Changement de plan programmé"
   - "Votre abonnement passera au plan Starter le [DATE]."
4. La base de données enregistre le changement futur :
   - `user_subscriptions.pending_downgrade_plan` → 'starter'
   - Le plan actuel reste 'unlimited'
5. Au prochain cycle, le webhook Stripe détecte le changement et applique :
   - `user_subscriptions.plan_type` → 'starter'
   - `user_subscriptions.minutes_quota` → 600
   - `user_subscriptions.pending_downgrade_plan` → NULL

## Architecture Technique

### 1. Edge Function : `change-subscription-plan`

**Endpoint :** `/functions/v1/change-subscription-plan`

**Responsabilités :**
- Vérifie l'authentification et l'abonnement actuel
- Détermine si c'est un upgrade ou downgrade
- Pour les upgrades :
  - Met à jour l'abonnement Stripe avec prorata
  - Synchronise immédiatement la base de données
- Pour les downgrades :
  - Met à jour l'abonnement Stripe sans prorata
  - Enregistre `pending_downgrade_plan`

### 2. Webhook Stripe : `stripe-webhook`

**Responsabilités :**
- Écoute les événements de Stripe
- Pour les renouvellements d'abonnement :
  - Vérifie si un `pending_downgrade_plan` existe
  - Si oui, applique le changement et efface le pending
  - Met à jour toutes les tables concernées

### 3. Frontend : `Subscription.tsx`

**Améliorations :**
- Affiche les messages de confirmation différenciés
- Montre la bannière de downgrade programmé
- Bouton "Actualiser" pour les factures
- Auto-refresh après upgrade (3 secondes)
- Gestion des états de chargement

### 4. Base de données

**Table `user_subscriptions` :**
- Nouvelle colonne : `pending_downgrade_plan` (text, nullable)
- Valeurs possibles : NULL, 'starter', 'unlimited'

## Gestion des Factures

### Facture de Prorata (Upgrade)

**Caractéristiques :**
- Créée automatiquement par Stripe lors d'un upgrade
- Contient les lignes avec `proration: true`
- Description : "Ajustement de prorata - Changement de plan"
- Montant : différence entre les deux plans au prorata

**Timing :**
- Génération : quelques secondes après le changement
- Visible dans l'Edge Function `get-invoices`
- Auto-refresh déclenché côté frontend après 3s

### Pas de Facture (Downgrade)

- Aucune facture intermédiaire générée
- La prochaine facture régulière sera au nouveau tarif
- Le client garde les avantages du plan supérieur jusqu'au cycle suivant

## Points d'Attention

1. **Synchronisation immédiate pour upgrades** : La base de données est mise à jour dans la fonction `change-subscription-plan` pour éviter les décalages
2. **Pas de modification du cycle** : Les deux opérations préservent le cycle de facturation d'origine
3. **Webhook en backup** : Le webhook Stripe reste le mécanisme de vérité finale
4. **UI réactive** : Rafraîchissement automatique après changement + bouton manuel
5. **Messages clairs** : Explications différenciées selon le type de changement

## Test

### Tester un Upgrade

1. Avoir un abonnement Starter actif
2. Aller dans Mon Abonnement
3. Sélectionner "Formule Illimitée"
4. Cliquer sur "Changer pour la formule Illimitée"
5. Vérifier :
   - Message de confirmation immédiat
   - Plan affiché passe à "Illimité"
   - Quota devient "illimité"
   - Facture de prorata apparaît après quelques secondes

### Tester un Downgrade

1. Avoir un abonnement Illimité actif
2. Aller dans Mon Abonnement
3. Sélectionner "Formule Starter"
4. Cliquer sur "Changer pour la formule Starter"
5. Vérifier :
   - Message indiquant la date future
   - Bannière bleue "Changement de plan programmé"
   - Plan actuel reste "Illimité"
   - Quota reste "illimité"
   - Attendre le prochain cycle de facturation pour voir l'application
