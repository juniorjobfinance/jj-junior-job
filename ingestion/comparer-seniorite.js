// ---------------------------------------------------------------------------
// Comparer les deux chemins du filtre de séniorité, avant de basculer
// ---------------------------------------------------------------------------
//
// Deux chemins coexistent aujourd'hui, et c'est provisoire :
//
//   ANCIEN — `dureesExperienceCitees(_descr)`, lu sur la description TRONQUÉE
//            à 3 000 ou 4 000 caractères selon le connecteur. C'est lui qui
//            décide encore.
//   NOUVEAU — `verdictSenioriteDescr(texte entier)`, calculé à l'ingestion et
//            stocké dans `_expMax`, `_formuleSeniorite`, `_vetoJunior`. Il
//            mesure, mais ne décide pas.
//
// Basculer sans mesurer serait un pari. Cet outil dit exactement ce que la
// bascule change, DANS LES DEUX SENS — car un filtre qui ne fait que durcir
// est suspect : on veut aussi voir ce qu'il libère.
//
// Usage :
//     node ingestion/comparer-seniorite.js
//
// Il rejoue depuis le cache (aucun appel réseau) et n'écrit rien.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { chargerPipeline } = require('./atelier');

const P = chargerPipeline();
const DATA = path.join(__dirname, '..', 'data');

function dernierCache() {
  const f = fs
    .readdirSync(DATA)
    .filter((n) => /^brut-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
    .reverse()[0];
  if (!f) return null;
  return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
}

const cache = dernierCache();
if (!cache) {
  console.error('Aucun cache dans data/. Lancer une collecte sans --depuis-cache.');
  process.exit(1);
}

// Les fiches rattrapées portent la description COMPLÈTE : c'est elle que le
// nouveau chemin lit. Sans elles, la comparaison porterait sur du vide.
const fiches = new Map((cache.fiches || []).map((f) => [f.url, f]));
if (!fiches.size) {
  console.error(
    "Ce cache ne porte aucune fiche rattrapée : il date d'avant cette version.\n" +
      'Relancer une collecte complète, sinon la comparaison ne mesure rien.'
  );
  process.exit(1);
}

// Le catalogue publié, pour ne comparer que sur ce qui est réellement en ligne.
global.window = {};
const CATALOGUE = ['offres-refonte.js', 'offres.js']
  .map((n) => path.join(__dirname, '..', n))
  .find((p) => fs.existsSync(p));
require(CATALOGUE);
const pub = window.__OFFRES__.filter((o) => o.volet === 'cdi-cdd');

// La troncature que subissait l'ancien chemin. On la reproduit pour comparer
// ce qui était réellement comparé, pas ce qu'on aurait aimé.
const TRONCATURE = 3000;

const durcit = []; // écartées par le NOUVEAU, gardées par l'ANCIEN
const libere = []; // gardées par le NOUVEAU, écartées par l'ANCIEN
let analysees = 0;

for (const o of pub) {
  const f = fiches.get(o.url);
  if (!f || !f.descr) continue;
  analysees++;

  const complet = String(f.descr);
  const tronque = complet.slice(0, TRONCATURE);

  // ANCIEN : durées lues sur le texte tronqué, plus le motif de séniorité.
  const duresAncien = P.dureesExperienceCitees(tronque);
  const ancienEcarte =
    duresAncien.some((n) => n > P.EXPERIENCE_MAX_ANNEES) || P.DESCR_SENIOR_RE.test(tronque);

  // NOUVEAU : verdict calculé sur le texte entier, veto junior compris.
  const v = P.verdictSenioriteDescr(complet);
  const nouveauEcarte = !v._vetoJunior && ((v._expMax !== null && v._expMax >= 4) || Boolean(v._formuleSeniorite));

  if (nouveauEcarte === ancienEcarte) continue;

  const motif = v._expMax !== null && v._expMax >= 4 ? `${v._expMax} ans` : v._formuleSeniorite || 'motif ancien';
  const ligne = {
    emp: o.emp,
    titre: o.title,
    motif,
    veto: v._vetoJunior,
    longueur: complet.length,
  };
  (nouveauEcarte ? durcit : libere).push(ligne);
}

const montrer = (titre, liste, explication) => {
  console.log(`\n=== ${titre} — ${liste.length} offre(s) ===`);
  console.log(`    ${explication}`);
  if (!liste.length) {
    console.log('    (aucune)');
    return;
  }
  liste.slice(0, 20).forEach((x, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. [${x.motif}]${x.veto ? ' [veto junior]' : ''} ` +
        `${String(x.emp).slice(0, 24)} — ${String(x.titre).slice(0, 46)}`
    );
  });
  if (liste.length > 20) console.log(`  … et ${liste.length - 20} autre(s)`);
};

console.log(`Photo du cache : ${String(cache.genere).slice(0, 19)}`);
console.log(`CDI·CDD publiés avec une fiche complète : ${analysees} sur ${pub.length}`);
console.log(`Troncature simulée pour l'ancien chemin : ${TRONCATURE} caractères`);

montrer(
  'LE NOUVEAU CHEMIN ÉCARTE, L’ANCIEN GARDAIT',
  durcit,
  "Ce sont les offres que la troncature cachait — le gain de la bascule."
);
montrer(
  'LE NOUVEAU CHEMIN GARDE, L’ANCIEN ÉCARTAIT',
  libere,
  "Surtout des veto junior, et des formules que l'ancien lisait trop largement."
);

console.log(`\nBilan : ${durcit.length} écartée(s) en plus, ${libere.length} récupérée(s).`);
console.log(`Le catalogue CDI·CDD passerait de ${pub.length} à ${pub.length - durcit.length + libere.length}.`);
