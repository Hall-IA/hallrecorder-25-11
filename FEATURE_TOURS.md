# Tours Guidés (Feature Tours)

Ce projet utilise **Driver.js** pour créer des tours guidés interactifs qui aident les utilisateurs à découvrir les fonctionnalités de l'application.

## 🎯 Tours Disponibles

### 1. Tour de Détail de Réunion (`meeting-detail-features`)
Ce tour se déclenche automatiquement la première fois qu'un utilisateur visite une page de détail de réunion (après 2 secondes).

**Étapes du tour:**
1. Introduction au résumé de la réunion
2. Astuce pour la correction rapide (double-clic)
3. Bouton d'envoi par email
4. Bouton d'édition
5. Export PDF

## 🔧 Comment ajouter un nouveau tour

### 1. Définir le tour dans `src/config/featureTours.ts`

```typescript
export const TOURS = {
  monNouveauTour: {
    id: 'mon-nouveau-tour-id',
    steps: [
      {
        element: '#mon-element-id', // Sélecteur CSS
        popover: {
          title: 'Titre de l\'étape',
          description: 'Description de la fonctionnalité',
          side: 'bottom' as const, // 'top' | 'right' | 'bottom' | 'left'
          align: 'start' as const,   // 'start' | 'center' | 'end'
        },
      },
      // Autres étapes...
    ] as TourStep[],
  },
};
```

### 2. Utiliser le tour dans un composant

```typescript
import { useFeatureTour } from '../hooks/useFeatureTour';
import { TOURS } from '../config/featureTours';

function MonComposant() {
  // Avec démarrage automatique
  const { hasSeenTour, startTour } = useFeatureTour(
    TOURS.monNouveauTour.id,
    TOURS.monNouveauTour.steps,
    { autoStart: true, delay: 1000 } // Démarre après 1 seconde
  );

  // Ou démarrage manuel
  const { startTour } = useFeatureTour(
    TOURS.monNouveauTour.id,
    TOURS.monNouveauTour.steps
  );

  return (
    <div>
      {/* Votre contenu */}
      <button onClick={startTour}>Afficher le guide</button>
    </div>
  );
}
```

### 3. Ajouter les attributs aux éléments HTML

Pour que Driver.js puisse cibler les éléments, ajoutez des IDs ou des attributs `data-tour`:

```tsx
// Avec ID
<div id="mon-element-id">Contenu</div>

// Avec data-tour
<button data-tour="mon-bouton">Cliquez ici</button>
```

## 🎨 Personnalisation des styles

Les styles personnalisés sont définis dans `src/index.css` sous la section `DRIVER.JS CUSTOM STYLES`.

Vous pouvez modifier:
- Les couleurs (actuellement aux couleurs coral/sunset)
- La taille des popovers
- L'apparence des boutons
- Les animations

## 📱 Gestion du stockage

Les tours vus par l'utilisateur sont stockés dans `localStorage` avec la clé `seenTours`.

### Réinitialiser tous les tours (développement)

```typescript
import { useResetAllTours } from '../hooks/useFeatureTour';

function DevTools() {
  const { resetAll } = useResetAllTours();

  return <button onClick={resetAll}>Réinitialiser tous les tours</button>;
}
```

### Réinitialiser un tour spécifique

```typescript
const { resetTour } = useFeatureTour(TOURS.monTour.id, TOURS.monTour.steps);

<button onClick={resetTour}>Revoir ce tour</button>
```

## 💡 Bonnes pratiques

1. **Sélecteurs stables**: Utilisez des IDs ou `data-tour` plutôt que des classes CSS qui peuvent changer
2. **Descriptions claires**: Soyez concis et focalisez sur le "pourquoi" et le "comment"
3. **Ordre logique**: Organisez les étapes dans un ordre naturel d'utilisation
4. **Timing approprié**:
   - Utilisez `autoStart: false` pour les fonctionnalités avancées
   - Utilisez `autoStart: true` avec un délai pour les fonctionnalités principales
5. **Ne surchargez pas**: Limitez le nombre d'étapes par tour (5-7 maximum)

## 🐛 Debugging

Si un tour ne fonctionne pas:

1. Vérifiez que l'élément existe dans le DOM quand le tour démarre
2. Vérifiez le sélecteur CSS dans la console:
   ```javascript
   document.querySelector('#mon-element-id')
   ```
3. Regardez la console pour les erreurs de Driver.js
4. Vérifiez que les étapes sont bien typées avec `as TourStep[]`

## 📚 Documentation Driver.js

Pour plus d'options: [https://driverjs.com/docs](https://driverjs.com/docs)
