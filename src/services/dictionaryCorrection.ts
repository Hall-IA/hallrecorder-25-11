import { supabase } from '../lib/supabase';

// Cache du dictionnaire pour éviter des requêtes répétées
let dictionaryCache: { userId: string; entries: Array<{ incorrect: string; correct: string }> } | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

/**
 * Échappe les caractères spéciaux pour la regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalise un texte pour la comparaison (supprime accents, met en minuscule)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Supprime les accents
}

/**
 * Génère toutes les variantes possibles d'un mot pour la recherche
 * Prend en compte : majuscules, accents, tirets, apostrophes, espaces
 */
function generateSearchPatterns(word: string): string {
  const escaped = escapeRegex(word);
  
  // Créer un pattern qui gère les variations de casse et d'accents
  // Utiliser une approche caractère par caractère pour les accents
  let pattern = '';
  
  for (const char of escaped) {
    const lower = char.toLowerCase();
    const upper = char.toUpperCase();
    
    // Gérer les caractères accentués courants en français
    const accentMap: Record<string, string> = {
      'a': '[aàâäáã]',
      'e': '[eéèêë]',
      'i': '[iîïí]',
      'o': '[oôöóõ]',
      'u': '[uùûüú]',
      'c': '[cç]',
      'n': '[nñ]',
      'y': '[yÿý]',
      // Versions majuscules
      'A': '[AÀÂÄÁÃ]',
      'E': '[EÉÈÊË]',
      'I': '[IÎÏÍ]',
      'O': '[OÔÖÓÕ]',
      'U': '[UÙÛÜÚ]',
      'C': '[CÇ]',
      'N': '[NÑ]',
      'Y': '[YŸÝ]',
    };
    
    if (accentMap[lower]) {
      // Combiner minuscules et majuscules pour ce caractère
      const lowerPattern = accentMap[lower];
      const upperPattern = accentMap[upper] || `[${upper}]`;
      pattern += `(?:${lowerPattern}|${upperPattern})`;
    } else if (lower !== upper) {
      pattern += `[${lower}${upper}]`;
    } else {
      pattern += char;
    }
  }
  
  return pattern;
}

/**
 * Charge le dictionnaire depuis le cache ou la base de données
 */
async function loadDictionary(userId: string): Promise<Array<{ incorrect: string; correct: string }>> {
  const now = Date.now();
  
  // Vérifier le cache
  if (dictionaryCache && dictionaryCache.userId === userId && (now - cacheTimestamp) < CACHE_DURATION) {
    return dictionaryCache.entries;
  }
  
  const { data: dictionary, error } = await supabase
    .from('custom_dictionary')
    .select('incorrect_word, correct_word')
    .eq('user_id', userId);
  
  if (error) {
    console.error('❌ Erreur chargement dictionnaire:', error);
    return [];
  }
  
  const entries = (dictionary || []).map(d => ({
    incorrect: d.incorrect_word,
    correct: d.correct_word
  }));
  
  // Mettre en cache
  dictionaryCache = { userId, entries };
  cacheTimestamp = now;
  
  return entries;
}

/**
 * Invalide le cache du dictionnaire (à appeler après ajout/suppression)
 */
export function invalidateDictionaryCache(): void {
  dictionaryCache = null;
  cacheTimestamp = 0;
}

/**
 * Applique les corrections du dictionnaire personnalisé au texte
 * Gère automatiquement :
 * - Les variations de casse (majuscules/minuscules)
 * - Les accents et caractères spéciaux français
 * - Les mots au milieu des phrases ou en début
 * - Préserve la casse du mot original quand possible
 */
export async function applyDictionaryCorrections(text: string, userId: string): Promise<string> {
  if (!text || !userId) {
    return text;
  }

  const entries = await loadDictionary(userId);
  
  if (entries.length === 0) {
    return text;
  }

  let correctedText = text;
  let totalCorrections = 0;

  for (const { incorrect, correct } of entries) {
    if (!incorrect || !correct) continue;
    
    // Générer un pattern robuste qui gère les variations
    const pattern = generateSearchPatterns(incorrect);
    
    // Utiliser une limite de mot Unicode-aware
    // \b ne fonctionne pas bien avec les accents, donc on utilise une approche différente
    // On cherche le mot précédé et suivi d'un non-mot ou début/fin de chaîne
    const regex = new RegExp(
      `(?<=^|[\\s.,;:!?()\\[\\]{}«»"'\\-—–])(${pattern})(?=$|[\\s.,;:!?()\\[\\]{}«»"'\\-—–])`,
      'giu'
    );
    
    // Fallback si lookbehind n'est pas supporté
    let regexToUse: RegExp;
    try {
      // Tester si le regex est valide
      regex.test('');
      regexToUse = regex;
    } catch {
      // Fallback sans lookbehind (moins précis mais fonctionne partout)
      regexToUse = new RegExp(`(^|[\\s.,;:!?()\\[\\]{}«»"'\\-—–])(${pattern})([\\s.,;:!?()\\[\\]{}«»"'\\-—–]|$)`, 'giu');
    }
    
    const beforeLength = correctedText.length;
    
    correctedText = correctedText.replace(regexToUse, (match, ...args) => {
      // Préserver la casse du premier caractère si possible
      const originalWord = typeof args[0] === 'string' && args[0].length > 1 ? args[1] : args[0];
      
      if (!originalWord || typeof originalWord !== 'string') {
        return match.replace(new RegExp(pattern, 'i'), correct);
      }
      
      // Si le mot original commence par une majuscule, mettre une majuscule à la correction
      let finalCorrection = correct;
      if (originalWord[0] === originalWord[0].toUpperCase() && originalWord[0] !== originalWord[0].toLowerCase()) {
        finalCorrection = correct.charAt(0).toUpperCase() + correct.slice(1);
      }
      
      // Si tout le mot est en majuscules, mettre la correction en majuscules
      if (originalWord === originalWord.toUpperCase() && originalWord !== originalWord.toLowerCase()) {
        finalCorrection = correct.toUpperCase();
      }
      
      return match.replace(new RegExp(pattern, 'i'), finalCorrection);
    });
    
    if (correctedText.length !== beforeLength || correctedText !== text) {
      totalCorrections++;
    }
  }

  if (totalCorrections > 0) {
    console.log(`✅ Dictionnaire: ${totalCorrections} correction(s) appliquée(s)`);
  }

  return correctedText;
}
