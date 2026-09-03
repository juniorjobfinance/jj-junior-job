// ---------------------------------------------------------------------------
// Atelier — interroger le pipeline sans le lancer
// ---------------------------------------------------------------------------
//
// Le pipeline est un script : il classe, filtre et publie en un seul passage de
// dix-huit minutes, et n'exporte rien. Pour répondre à « pourquoi cette offre
// n'est-elle pas en ligne ? », on recopiait jusqu'ici ses fonctions à coups
// d'expressions régulières sur son propre texte.
//
// Cette méthode a donné trois diagnostics FAUX dans la même séance : la copie
// de SENIOR_RE accusait un filtre qui, dans le vrai pipeline, laissait passer
// l'offre ; la copie de estGrandeVille ignorait le découpage du lieu fait en
// amont ; et aucune copie ne voyait les portes de normalize(). On a cherché le
// défaut là où il n'était pas pendant deux heures.
//
// Cet atelier charge le VRAI fichier, neutralise son appel final à run(), et
// rend ses fonctions internes. Ce qu'on teste ici est donc exactement ce que
// GitHub Actions exécutera demain matin.
//
// Usage :
//     const { chargerPipeline } = require('./atelier');
//     const P = chargerPipeline(process.cwd());
//     P.normalize({ __src: 'liste:X', emp: 'X', raw: { ... } });
//     P.estGrandeVille('Saint-Quentin-en-Yvelines');
//     P.inferFamille("Chargé d'affaires Transaction Management", '', 'Caceis');
//
// Pour ajouter une fonction à la liste, il suffit de l'écrire dans NOMS : elle
// n'a pas besoin d'être exportée par le pipeline.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

// Les fonctions et tables qu'on veut pouvoir interroger. Toute fonction du
// pipeline peut être ajoutée ici ; celles-ci sont les portes par lesquelles une
// offre passe, dans l'ordre où elle les rencontre.
const NOMS = [
  // Le chemin complet d'une offre brute vers le catalogue.
  'normalize',
  // La lecture des dates, qu'on veut pouvoir éprouver seule : une date fausse
  // place une annonce périmée en tête du site. `ficheJsonLd` est la lecture de
  // la fiche elle-même — le dernier recours quand la source ne date pas.
  'dateFrancaiseSansAnnee',
  'cleanTitle',
  'nettoyerLieu',
  'nettoyerPays',
  'ficheJsonLd',
  // Les portes, prises une par une.
  'estUneOffreFinance',
  'classifyVolet',
  'classifyContrat',
  'inferFamille',
  'inferFamilleParTitre',
  'inferSector',
  'normaliserEmployeur',
  'trouverMaison',
  'titreNommeUnMetier',
  'niveauHorsCible',
  'passesJuniorFilter',
  'estGrandeVille',
  'villeDeLaListe',
  'normaliserPourClassement',
  // Les tables, pour savoir POURQUOI une porte a mordu.
  'MAISONS',
  'FAMILLES',
  'FAMILLE_RULES',
  'FAMILLE_HORS_PERIMETRE',
  'METIER_HORS_PERIMETRE_RE',
  'SENIOR_RE',
  'DESCR_SENIOR_RE',
  'TITRE_SANS_METIER_RE',
  'VENTE_HORS_FINANCE_RE',
  'INTERMEDIAIRE_RE',
];

function chargerPipeline(racine = path.join(__dirname, '..')) {
  const chemin = path.join(racine, 'ingestion/pipeline.js');
  let src = fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  // La ligne shebang n'est pas du JavaScript valide dans une Function.
  src = src.replace(/^#![^\n]*\n/, '');
  // L'appel final : c'est lui, et lui seul, qui déclenche le passage complet.
  src = src.replace(/run\(\)\.catch\([\s\S]*$/, '');
  if (src.includes('run().catch')) {
    throw new Error("l'appel à run() n'a pas pu être neutralisé — atelier refusé");
  }

  const fabrique = new Function(
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    src + '\n;return {' + NOMS.join(', ') + '};'
  );
  // Les require() relatifs du pipeline (« ./sources ») doivent se résoudre
  // depuis SON dossier, pas depuis celui de l'appelant.
  const requireDuPipeline = require('module').createRequire(chemin);
  const faux = { exports: {} };
  return fabrique(requireDuPipeline, faux, faux.exports, path.join(racine, 'ingestion'), chemin);
}

// ---------------------------------------------------------------------------
// Mode ligne de commande
// ---------------------------------------------------------------------------
//     node ingestion/atelier.js "Stage - Depositary Control Assistant" "Caceis"
//
// Rejoue les portes dans l'ordre où l'offre les rencontre, et nomme celle qui
// la retient. Le lieu est facultatif (troisième argument).
function expliquer(titre, employeur, lieu) {
  const P = chargerPipeline();
  const emp = P.normaliserEmployeur(employeur || "");
  const dire = (nom, verdict, precision) =>
    console.log("  " + (verdict ? "BLOQUE " : "  ok   ") + nom.padEnd(26) + (precision || ""));

  console.log("\n" + titre + "   [" + employeur + (lieu ? " · " + lieu : "") + "]");
  console.log("  employeur normalisé : " + emp);

  dire("métier hors périmètre", !P.estUneOffreFinance(titre));
  dire("niveau Bac+2/+3", P.niveauHorsCible(titre));
  const famille = P.inferFamille(titre, "", emp);
  dire("famille", famille === P.FAMILLE_HORS_PERIMETRE, famille || "aucune");
  const maison = P.trouverMaison(emp);
  dire("maison de référence", !maison, maison ? maison.nom || String(maison) : "inconnue");
  dire("titre nomme un métier", !P.titreNommeUnMetier(titre, emp));
  dire("séniorité", P.SENIOR_RE.test(titre));
  if (lieu) {
    const ville = P.villeDeLaListe(lieu);
    dire("commune couverte", !P.estGrandeVille(ville), ville);
  }
}

if (require.main === module) {
  const [titre, employeur, lieu] = process.argv.slice(2);
  if (!titre) {
    console.error('usage : node ingestion/atelier.js "Intitulé" "Employeur" ["Lieu"]');
    process.exit(1);
  }
  expliquer(titre, employeur, lieu);
}

module.exports = { chargerPipeline, NOMS, expliquer };
