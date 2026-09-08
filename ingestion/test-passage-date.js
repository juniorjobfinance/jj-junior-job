#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Le passage obligé des dates — trois épreuves
// ---------------------------------------------------------------------------
//
// Quarante-deux endroits du pipeline lisaient une date ; aucun ne consultait
// une déclaration sur place, et deux conventions opposées coexistaient :
// `new Date()` lit à l'américaine, `dateIso` à l'européenne — **234 jours
// d'écart** sur la même chaîne « 09/01/2026 ».
//
// Pire : une chaîne « 25/12/2026 » arrivant dans `normalize()` levait une
// `RangeError`, remontait jusqu'à `run().catch`, et le passage du matin mourait
// EN ENTIER. Zéro offre publiée, alerte muette sur la cause. Il suffisait qu'un
// éditeur change une version.
//
// LE PASSAGE REFUSE L'OFFRE, JAMAIS LE PASSAGE. Une date illisible rend le
// catalogue INCOMPLET, pas FAUX : DECISIONS.md §27 et §35, le même raisonnement
// que pour le connecteur muet.
//
// LA MÉTHODE, ET POURQUOI ELLE A DÛ ÊTRE REFAITE.
//
// Première version : on posait la date piégée dans une LISTE DE CHAMPS devinée
// (`date`, `postedDate`, `createdAt`…). Six témoins sur douze ne la recevaient
// pas, parce que leur branche lit un autre champ — et l'épreuve annonçait alors
// « le connecteur tombe à zéro » en mesurant tout autre chose.
//
// Version retenue : on DÉCOUVRE le champ que chaque branche lit, en le
// mutant un par un et en regardant si `_postedAt` bouge. C'est un avant/après,
// et il se vérifie lui-même : un témoin dont on n'a pas trouvé le champ est
// écarté de l'épreuve au lieu d'y figurer sans rien prouver.
//
//     node ingestion/test-passage-date.js
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const chemin = path.join(__dirname, 'pipeline.js');
let src = fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
src = src.replace(/^#![^\n]*\n/, '').replace(/run\(\)\.catch\([\s\S]*$/, '');
const P = new Function(
  'require', 'module', 'exports', '__dirname', '__filename',
  src + '\n;return { lireDatePublication, DATE_REFUSEE, normalize, rapportClassement };'
)(require('module').createRequire(chemin), { exports: {} }, {}, __dirname, chemin);

let echecs = 0;
function verifier(nom, ok, detail) {
  if (!ok) echecs++;
  console.log('  ' + (ok ? 'ok   ' : 'ÉCHEC') + ' ' + nom + (detail ? '\n         ' + detail : ''));
}
const jour = (v) => (typeof v === 'string' ? v.slice(0, 10) : String(v));
const copie = (o) => JSON.parse(JSON.stringify(o));

// --- La récolte, source des témoins -------------------------------------
const DATA = path.join(__dirname, '..', 'data');
const fichiers = fs.existsSync(DATA)
  ? fs.readdirSync(DATA).filter((n) => n.startsWith('brut-') && n.endsWith('.json.gz')).sort()
  : [];
if (!fichiers.length) {
  console.log('  aucune récolte dans data/ — épreuve sans objet');
  console.log('  (lancer le pipeline une fois pour en constituer une)');
  process.exit(0);
}
const recolte = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, fichiers[fichiers.length - 1]))).toString());

// --- Trouver le champ de date que la BRANCHE lit ------------------------
// On pose une date-repère dans un champ, on normalise, et on regarde si
// `_postedAt` la reprend. Le champ qui la fait bouger est celui que le code
// lit — on ne le devine pas, on l'observe.
const REPERE = '2026-04-17';
function champDeDate(brut) {
  const raw = brut.raw || {};
  for (const champ of Object.keys(raw)) {
    const v = raw[champ];
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const essai = copie(brut);
    essai.raw[champ] = REPERE;
    let n;
    try { n = P.normalize(essai); } catch { continue; }
    if (n && jour(n._postedAt) === REPERE) return champ;
  }
  return null;
}

// Des témoins qui survivent à normalize ET dont on sait quel champ les date.
//
// Au plus DEUX par connecteur : sans ce plafond, les douze témoins venaient
// tous de greenhouse et de lever, et l'épreuve 2 annonçait « toutes les
// branches » en n'en éprouvant que deux.
const temoins = [];
const parConnecteur = {};
for (const o of recolte.offres) {
  if (temoins.length >= 12) break;
  const fam = String(o.__src || '?').split(':')[0];
  if ((parConnecteur[fam] || 0) >= 2) continue;
  let n;
  try { n = P.normalize(copie(o)); } catch { continue; }
  if (!n) continue;
  const champ = champDeDate(o);
  if (!champ) continue;
  parConnecteur[fam] = (parConnecteur[fam] || 0) + 1;
  temoins.push({ brut: o, champ, src: o.__src });
}
console.log('  ' + temoins.length + ' témoin(s) dont le champ de date est identifié' +
  ', dans ' + fichiers[fichiers.length - 1]);
if (temoins.length < 6) {
  console.log('  trop peu de témoins pour éprouver quoi que ce soit — épreuve abandonnée');
  process.exit(1);
}
const parSrc = {};
for (const t of temoins) parSrc[t.src] = t.champ;
console.log('  ' + Object.entries(parSrc).map(([s, c]) => s.split(':')[0] + '.' + c).join(', ').slice(0, 92) + '\n');

const piege = (t, valeur) => { const c = copie(t.brut); c.raw[t.champ] = valeur; return c; };

// === ÉPREUVE 1 — « 25/12/2026 », qui hier tuait le passage ==============
{
  P.rapportClassement.ecartees.length = 0;
  const t = temoins[0];
  let leve = false;
  let sortie;
  try { sortie = P.normalize(piege(t, '25/12/2026')); } catch { leve = true; }
  verifier('1 — la chaîne ne lève plus d\'exception', !leve,
    leve ? 'une RangeError remonterait à run().catch et tuerait le passage entier' : null);
  verifier('1 — l\'offre est refusée', sortie === null,
    sortie ? 'elle est passée avec _postedAt = ' + jour(sortie._postedAt) : null);
  const note = P.rapportClassement.ecartees.find((e) => e.etage === 'date');
  verifier('1 — le motif est nommé', !!note,
    note ? '« ' + note.etage + ' : ' + note.precision + ' » (' + note.source + ')' : 'rien dans le registre des écartées');
  verifier('1 — le même témoin passe quand sa date est lisible',
    P.normalize(piege(t, '2026-09-01')) !== null);
}

// === ÉPREUVE 2 — un portail entier bascule en JJ/MM =====================
// Chaque date porte un premier nombre > 12 : indécidable autrement qu'en
// JJ/MM, donc refusée FAUTE DE DÉCLARATION.
//
// Les connecteurs qui DÉCLARENT « JJ/MM/AAAA » sont exclus de cette épreuve,
// et c'est le fond du mécanisme : pour eux, « 21/09/2026 » n'est pas une
// bascule, c'est leur format normal, et l'accepter est le comportement voulu.
// La première version de cette épreuve les comptait comme des brèches — elle
// aurait fait « corriger » une déclaration qui fonctionnait.
const DECLARENT_JJMM = ['cornerstone:', 'liste:', 'phenom:careers.axa.com'];
{
  P.rapportClassement.ecartees.length = 0;
  const sujets = temoins.filter((t) => !DECLARENT_JJMM.some((d) => String(t.src).startsWith(d)));
  const exclus = temoins.length - sujets.length;
  if (exclus) console.log('  ·     2 — ' + exclus + ' témoin(s) écarté(s) : leur connecteur DÉCLARE le JJ/MM');
  const lot = sujets.map((t, i) => piege(t, (13 + (i % 15)) + '/0' + ((i % 9) + 1) + '/2026'));
  let exceptions = 0;
  const passees = lot.map((o) => { try { return P.normalize(o); } catch { exceptions++; return null; } }).filter(Boolean);
  verifier('2 — aucune exception sur les ' + lot.length, exceptions === 0, exceptions + ' exception(s)');
  verifier('2 — toutes les offres sont refusées', passees.length === 0, passees.length + ' survivante(s)');
  const notes = P.rapportClassement.ecartees.filter((e) => e.etage === 'date');
  verifier('2 — toutes sont tracées sous le motif', notes.length === lot.length,
    notes.length + ' trace(s) pour ' + lot.length + ' offres');
  verifier('2 — la trace nomme le connecteur', notes.length > 0 && !!notes[0].source,
    notes.length ? 'ex. ' + notes[0].source : null);
}

// === ÉPREUVE 3 — « 07/29/2026 » par le chemin Cornerstone ===============
// 2514 convertissait en dur, à l'européenne, AVANT tout contrôle : le passage
// en était aveugle. La ligne est supprimée, la déclaration est au point
// d'appel, et « 07/29/2026 » — mois 29 en JJ/MM — doit être refusé.
{
  P.rapportClassement.ecartees.length = 0;
  const corner = temoins.find((t) => String(t.src).startsWith('cornerstone:'));
  if (!corner) {
    console.log('  ·     3 — aucun témoin Cornerstone dans cette récolte ; la déclaration');
    console.log('           est éprouvée directement :');
    verifier('3 — « 07/29/2026 » lu en JJ/MM est refusé',
      P.lireDatePublication('07/29/2026', 'JJ/MM/AAAA') === P.DATE_REFUSEE);
    verifier('3 — la même chaîne lue en MM/JJ est acceptée',
      jour(P.lireDatePublication('07/29/2026', 'MM/JJ/AAAA')) === '2026-07-29');
  } else {
    const sortie = P.normalize(piege(corner, '07/29/2026'));
    verifier('3 — « 07/29/2026 » est refusé par le chemin Cornerstone', sortie === null,
      sortie ? 'passée avec _postedAt = ' + jour(sortie._postedAt) : null);
    const note = P.rapportClassement.ecartees.find((e) => e.etage === 'date');
    verifier('3 — le motif est nommé', !!note, note ? '« ' + note.precision + ' »' : null);
  }
}

// === CE QUI DOIT CONTINUER À PASSER =====================================
// Un passage obligé qui refuserait tout ne vaudrait rien.
{
  const ATTENDU = (ms) => new Date(ms).toISOString().slice(0, 10);
  const cas = [
    ['ISO simple', '2026-09-01', '2026-09-01'],
    ['ISO horodaté', '2026-09-03T16:53:43+0200', '2026-09-03'],
    ['horodatage Unix en secondes', 1788000000, ATTENDU(1788000000 * 1000)],
    ['horodatage Unix en millisecondes', 1788000000000, ATTENDU(1788000000000)],
    ['absence de date', null, null],
    ['chaîne vide', '', null],
  ];
  for (const [nom, entree, attendu] of cas) {
    const r = P.lireDatePublication(entree);
    const ok = attendu === null ? r === null : r !== P.DATE_REFUSEE && jour(r) === attendu;
    verifier('passe encore — ' + nom, ok, ok ? null : 'rendu : ' + (r === P.DATE_REFUSEE ? 'REFUSÉ' : jour(r)));
  }
  verifier('déclaré MM/JJ — « 09/01/2026 » est le 1er septembre',
    jour(P.lireDatePublication('09/01/2026', 'MM/JJ/AAAA')) === '2026-09-01');
  verifier('déclaré JJ/MM — « 09/01/2026 » est le 9 janvier',
    jour(P.lireDatePublication('09/01/2026', 'JJ/MM/AAAA')) === '2026-01-09');
  verifier('sans déclaration — « 09/01/2026 » est REFUSÉ',
    P.lireDatePublication('09/01/2026') === P.DATE_REFUSEE);
}

// === LE MOIS EN TOUTES LETTRES, ET LE FUSEAU ============================
// « June 3, 2026 » (amazon.jobs) n'est pas ambigu — le mois est ecrit. Mais
// `new Date('June 3, 2026')` lit en heure LOCALE : minuit a Paris vaut 22 h
// UTC la veille, et la date reculait d'un jour. Six formes etaient touchees.
//
// C'est le defaut de « 2026-8-25 » (corrige le 07/09) sur une AUTRE branche
// de la meme fonction. La lecon tient en une phrase : ne jamais laisser
// `new Date` deviner le fuseau — lui donner une chaine en Z.
{
  for (const [entree, attendu] of [
    ['June 3, 2026', '2026-06-03'],
    ['September 2, 2026', '2026-09-02'],
    ['July 27, 2026', '2026-07-27'],
    ['December 15, 2025', '2025-12-15'],
    ['Jun 3, 2026', '2026-06-03'],
    ['3 June 2026', '2026-06-03'],
    ['1 Jan 2026', '2026-01-01'],
  ]) {
    const r = P.lireDatePublication(entree);
    const ok = r !== P.DATE_REFUSEE && jour(r) === attendu;
    verifier('mois anglais — « ' + entree + ' » est le ' + attendu, ok,
      ok ? null : 'rendu : ' + (r === P.DATE_REFUSEE ? 'REFUSÉ' : jour(r)));
  }
  // Un mot qui ressemble a un mois mais n en est pas : on refuse, on ne
  // devine pas. Sans cela « Foo 3, 2026 » passerait par `new Date` et
  // rendrait Invalid Date — ou pire, quelque chose.
  verifier('mois anglais — « Foo 3, 2026 » est REFUSÉ',
    P.lireDatePublication('Foo 3, 2026') === P.DATE_REFUSEE);
  verifier('mois anglais — « Mai 3, 2026 » (francais) est REFUSÉ ou lu, jamais decale',
    (() => { const r = P.lireDatePublication('Mai 3, 2026');
      return r === P.DATE_REFUSEE || jour(r) === '2026-05-03'; })());
}

console.log('\n  ' + (echecs ? echecs + ' ÉCHEC(S)' : 'les trois épreuves passent'));
process.exit(echecs ? 1 : 0);
