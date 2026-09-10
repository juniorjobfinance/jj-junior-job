#!/usr/bin/env node
// ---------------------------------------------------------------------------
// CE BRASSAGE EST-IL RÉEL ? — instrument, pas contrôle
// ---------------------------------------------------------------------------
//
// Un matin, le catalogue affiche « 79 arrivées, 70 départs » là où la veille
// il en montrait 15 et 13. Cinq fois plus en un jour. La tentation est
// d'expliquer — « c'est la rentrée » — et une explication n'est pas une
// mesure.
//
// Une symétrie par employeur (AXA 8/11, Guerlain 5/5, BNP 4/4) est aussi la
// signature d'une clé de déduplication instable : si `emp`, `loc` ou `url`
// bougent d'un caractère entre deux passages, la MÊME offre sort et rentre,
// et se compte deux fois.
//
// Cet outil tranche. Il rapproche les départs et les arrivées **non pas sur
// canonicalKey** — c'est justement le suspect — mais sur un triplet
// normalisé : employeur + intitulé + ville, en minuscules, accents retirés,
// espaces réduits.
//
//   arrivées sans jumeau  -> brassage réel
//   arrivées avec jumeau  -> la même offre, revenue sous une autre identité
//
// MESURE DE RÉFÉRENCE, 10/09/2026 : 67 arrivées réelles et 58 départs réels
// sur 1 047 offres (6,4 %), plus 12 republications d'employeur. Voir ETAT.md.
//
//     node ingestion/rotation-reelle.js                  # les deux derniers passages
//     node ingestion/rotation-reelle.js <avant> <apres>  # deux commits précis
//     node ingestion/rotation-reelle.js --urls           # + le diff d'URL par paire
//
// Ce n'est pas un contrôle : il ne bloque rien et ne s'exécute pas au passage
// de 6h30. On l'ouvre quand un brassage surprend.
// ---------------------------------------------------------------------------
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const args = process.argv.slice(2);
const AVEC_URLS = args.includes('--urls');
const refs = args.filter((a) => !a.startsWith('--'));

// Les deux derniers passages automatiques, quand on ne précise rien. C'est le
// cas d'usage courant : « ce matin a surpris, montre-moi ».
function derniersPassages() {
  const sortie = execFileSync(
    'git',
    ['log', '--author=JJ bot', '--format=%H', '-2'],
    { encoding: 'utf8', cwd: RACINE }
  ).trim().split('\n').filter(Boolean);
  if (sortie.length < 2) {
    console.error("  Moins de deux passages automatiques dans l'historique.");
    console.error('  Préciser deux commits : node ingestion/rotation-reelle.js <avant> <apres>');
    process.exit(1);
  }
  return [sortie[1], sortie[0]]; // du plus ancien au plus récent
}

const [REF_AVANT, REF_APRES] = refs.length >= 2 ? refs.slice(0, 2) : derniersPassages();

// On lit offres.js TEL QU'IL ÉTAIT au commit, jamais le fichier du disque :
// celui-ci a pu être régénéré depuis, et on comparerait alors deux états qui
// ne sont pas ceux qu'on croit.
function catalogueAu(ref) {
  let texte;
  try {
    texte = execFileSync('git', ['show', ref + ':offres.js'],
      { encoding: 'utf8', maxBuffer: 9e7, cwd: RACINE });
  } catch (e) {
    console.error('  Commit illisible : ' + ref);
    process.exit(1);
  }
  const faux = {};
  new Function('window', texte)(faux);
  const lot = faux.__OFFRES__;
  if (!Array.isArray(lot) || !lot.length) {
    console.error('  offres.js vide ou illisible au commit ' + ref);
    process.exit(1);
  }
  return lot;
}

const AVANT = catalogueAu(REF_AVANT);
const APRES = catalogueAu(REF_APRES);

// L'identité qui SÉPARE les deux ensembles. Elle inclut l'URL — c'est
// délibéré : c'est elle qui produit les « départs » et « arrivées » qu'on
// veut examiner. Le rapprochement, lui, s'en passera.
const identite = (o) => String(o.url || '') + '|' + String(o.emp || '');

const idAvant = new Set(AVANT.map(identite));
const idApres = new Set(APRES.map(identite));
const departs = AVANT.filter((o) => !idApres.has(identite(o)));
const arrivees = APRES.filter((o) => !idAvant.has(identite(o)));

// Le triplet : ce qui décrit le POSTE, sans rien qui décrive son adresse.
const plat = (s) => String(s == null ? '' : s)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();
const triplet = (o) => plat(o.emp) + ' | ' + plat(o.title) + ' | ' + plat(o.loc);

const parTriplet = new Map();
for (const d of departs) {
  const k = triplet(d);
  if (!parTriplet.has(k)) parTriplet.set(k, []);
  parTriplet.get(k).push(d);
}

const paires = [];
const arriveesReelles = [];
for (const a of arrivees) {
  const jumeaux = parTriplet.get(triplet(a));
  if (jumeaux && jumeaux.length) paires.push([jumeaux.shift(), a]);
  else arriveesReelles.push(a);
}
const departsReels = [...parTriplet.values()].flat();

// ── Le rapport ─────────────────────────────────────────────────────────────
const court = (r) => String(r).slice(0, 7);
console.log('\n  ' + court(REF_AVANT) + ' -> ' + court(REF_APRES));
console.log('  ' + AVANT.length + ' offres -> ' + APRES.length +
  '   (' + (APRES.length - AVANT.length >= 0 ? '+' : '') + (APRES.length - AVANT.length) + ')');
console.log('  départs bruts : ' + departs.length + '   arrivées brutes : ' + arrivees.length);

const pct = (n) => Math.round((n / APRES.length) * 1000) / 10;
console.log('\n  ══ LE BRASSAGE RÉEL ══\n');
console.log('    arrivées réelles          : ' + arriveesReelles.length + '   (' + pct(arriveesReelles.length) + ' %)');
console.log('    départs réels             : ' + departsReels.length + '   (' + pct(departsReels.length) + ' %)');
console.log('    republications            : ' + paires.length +
  '   (même employeur, même intitulé, même ville — autre URL)');

if (!paires.length) {
  console.log('\n    -> Aucune republication : le brassage est réel, tel qu\'affiché.');
  process.exit(0);
}

// Ce qui diffère, champ par champ. Si `emp` ou `loc` bougent, c'est NOTRE
// clé qui est en cause ; si seule l'URL bouge, c'est l'employeur qui a
// réémis son annonce.
const CHAMPS = ['emp', 'title', 'loc', 'url', 'source', 'volet', 'contrat',
  'zone', 'maison', 'place', 'famille', 'sector', 'postedAt', 'firstSeenAt'];
const compte = {};
for (const [d, a] of paires) {
  for (const c of CHAMPS) if (String(d[c]) !== String(a[c])) compte[c] = (compte[c] || 0) + 1;
}
console.log('\n  ══ QUEL CHAMP BOUGE ══\n');
for (const [c, n] of Object.entries(compte).sort((x, y) => y[1] - x[1])) {
  console.log('    ' + c.padEnd(14) + n + ' / ' + paires.length +
    (c === 'emp' || c === 'loc' || c === 'title'
      ? '   <-- NOTRE clé est en cause'
      : ''));
}
if (!compte.emp && !compte.loc && !compte.title) {
  console.log('\n    Ni emp, ni loc, ni title ne bougent : notre clé est stable.');
  console.log("    C'est l'identifiant donné par l'employeur qui change.");
}

console.log('\n  ══ PAR EMPLOYEUR ══\n');
const parEmp = {};
for (const [, a] of paires) parEmp[a.emp] = (parEmp[a.emp] || 0) + 1;
for (const [e, n] of Object.entries(parEmp).sort((x, y) => y[1] - x[1])) {
  console.log('    ' + String(n).padStart(3) + '  ' + e);
}

// ── --urls : COMMENT l'adresse a changé ────────────────────────────────────
// Sans ce détail on sait qu'une URL bouge, pas de quelle façon — et c'est la
// façon qui distingue un suffixe « -2 » (doublon chez l'employeur) d'un
// identifiant entièrement réémis (republication en lot).
if (AVEC_URLS) {
  console.log('\n  ══ LE DÉTAIL DES URL ══');
  for (const [i, [d, a]] of paires.entries()) {
    const u1 = String(d.url), u2 = String(a.url);
    let k = 0;
    while (k < u1.length && k < u2.length && u1[k] === u2[k]) k++;
    console.log('\n    ' + (i + 1) + '. ' + a.emp + ' — « ' + String(a.title).slice(0, 46) + ' »');
    console.log('       commun : …' + u1.slice(Math.max(0, k - 44), k));
    console.log('       avant  : ' + u1.slice(k, k + 54));
    console.log('       après  : ' + u2.slice(k, k + 54));
    console.log('       postedAt : ' + String(d.postedAt).slice(0, 10) +
      ' -> ' + String(a.postedAt).slice(0, 10) +
      '   firstSeenAt : ' + String(d.firstSeenAt).slice(0, 10) +
      ' -> ' + String(a.firstSeenAt).slice(0, 10));
  }
} else {
  console.log('\n  (relancer avec --urls pour voir COMMENT chaque adresse a changé)');
}

// Une republication n'est pas un défaut : voir DECISIONS.md §41.
console.log('\n  Une offre republiée est CONSERVÉE avec sa nouvelle date — la');
console.log('  republication prouve que le poste est encore ouvert. DECISIONS.md §41.');
