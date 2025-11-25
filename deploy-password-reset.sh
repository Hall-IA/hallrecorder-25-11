#!/bin/bash

# Script de déploiement pour les fonctions de réinitialisation de mot de passe
# Usage: ./deploy-password-reset.sh

echo "🚀 Déploiement des fonctions de réinitialisation de mot de passe..."
echo ""

# Vérifier que supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Erreur: Supabase CLI n'est pas installé"
    echo "   Installez-le avec: npm install -g supabase"
    exit 1
fi

# Déployer send-password-reset-code
echo "📤 Déploiement de send-password-reset-code..."
supabase functions deploy send-password-reset-code

if [ $? -eq 0 ]; then
    echo "✅ send-password-reset-code déployé avec succès"
else
    echo "❌ Échec du déploiement de send-password-reset-code"
    exit 1
fi

echo ""

# Déployer verify-and-reset-password
echo "📤 Déploiement de verify-and-reset-password..."
supabase functions deploy verify-and-reset-password

if [ $? -eq 0 ]; then
    echo "✅ verify-and-reset-password déployé avec succès"
else
    echo "❌ Échec du déploiement de verify-and-reset-password"
    exit 1
fi

echo ""
echo "✅ Toutes les fonctions ont été déployées avec succès !"
echo ""
echo "⚠️  N'oubliez pas de configurer la variable d'environnement dans Supabase Dashboard:"
echo "   Edge Functions > Settings > Add secret"
echo "   RESEND_API_KEY=re_xxxxxxxxxxxxx"
echo ""
echo "📋 Appliquer la migration SQL:"
echo "   supabase db push"
echo "   ou via Dashboard > SQL Editor"
