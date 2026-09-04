#!/usr/bin/env node
// ingestion/maisons-a-inscrire.js
//
// CE QUI MANQUE AU CATALOGUE, SANS LE RENDRE FAUX.
//
// Deux relevés du dernier passage disent la même chose sous deux angles :
//
//   - des maisons ont servi des offres de finance sans figurer dans
//     maisons.txt, donc tout a été jeté ;
//   - des employeurs publient mais n'ont pas de structure dans structures.js,
//     donc la porte finance rejette toutes leurs offres, en silence.
//
// Ces deux contrôles BLOQUAIENT la publication jusqu'au 04/09/2026. Le premier
// passage réel a montré l'erreur : 18 maisons nouvelles en une journée, et le
// catalogue de 950 offres retenu pour 29 manquantes. On bloque quand publier
// serait mentir ; ici publier est seulement incomplet (DECISIONS.md §27).
//
// Mais un signal sans destinataire est un signal perdu. Ce script produit le
// corps d'une issue tenue à jour même sur un passage vert, et une SIGNATURE
// qui permet de ne commenter que lorsque la liste a réellement changé.
//
// Usage :  node ingestion/maisons-a-inscrire.js [suffixe]
// Écrit   data/maisons-a-inscrire.md
// Affiche TOTAL=<n> et SIGNATURE=<hash>

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const registre = require('./registre-employeurs.js');

const RACINE = path.join(__dirname, '..');
const DATA = path.join(RACINE, 'data');
const SUFFIXES = process.argv[2] ? [process.argv[2]] : ['', '-refonte', '-cache'];

// Le relevé le plus RÉCENT, quel que soit son suffixe : le passage quotidien
// écrit sans suffixe, la branche de refonte avec. Prendre le plus récent évite
// de lire celui d'avant-hier en croyant lire celui de ce matin.
function dernier(base) {
  const candidats = SUFFIXES.map((s) => path.join(DATA, base + s + '.json'))
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ f, t: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!candidats.length) return null;
  try {
    return JSON.parse(fs.readFileSync(candidats[0].f, 'utf8'));
  } catch {
    return null;
  }
}

// --- Le registre, et la photo du jour en secours -------------------------
//
// La photo du jour sous-déclare : trois relevés successifs ont compté 26, 18
// puis 17 employeurs, et un employeur qui disparaît n'a pas été réglé — ses
// offres ont expiré, la maison reviendra. On lit donc les employeurs vus au
// moins une fois dans la fenêtre, pas ceux vus ce matin. La photo reste en
// secours pour le tout premier passage, avant que le registre existe.
const reg = dernier('employeurs-vus');
const AUJ = new Date();

function depuisRegistre(categorie) {
  const m = new Map();
  for (const e of registre.actifs(reg, categorie, AUJ)) {
    m.set(e.emp, { offres: e.offres || 0, vue: e.derniereVue, passages: e.passages || 1 });
  }
  return m;
}

// --- 1. Les maisons vues et jetées ---------------------------------------
const mr = dernier('rejets-maisonref');
let maisons;
if (reg) maisons = depuisRegistre('maison-absente');
else {
  maisons = new Map();
  for (const o of (mr && mr.offres) || []) {
    const e = maisons.get(o.entreprise) || { offres: 0, vue: null, passages: 1 };
    e.offres++;
    maisons.set(o.entreprise, e);
  }
}

// --- 2. Les employeurs sans structure -------------------------------------
let sansStructure;
if (reg) sansStructure = depuisRegistre('sans-structure');
else {
  const ei = dernier('employeurs-inconnus');
  sansStructure = new Map();
  for (const e of (ei && (ei.employeurs || ei.offres)) || []) {
    if (e && e.emp) sansStructure.set(e.emp, { offres: e.offres || 1, vue: null, passages: 1 });
  }
}

// « vue il y a N jours » : une maison vue ce matin et une maison vue il y a
// vingt-huit jours ne demandent pas la même attention, et rien d'autre dans
// le tableau ne les distingue.
function quand(vue) {
  if (!vue) return '';
  const j = registre.ecartJours(vue, AUJ);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  return 'il y a ' + j + ' j';
}

const total = maisons.size + sansStructure.size;

// La signature ne porte que sur les NOMS, pas sur les comptes : le nombre
// d'offres d'une maison bouge tous les jours, la liste des maisons non. Sans
// cette distinction, on commenterait chaque matin pour dire la même chose.
const signature = crypto
  .createHash('sha1')
  .update([...maisons.keys()].sort().join('|') + '##' + [...sansStructure.keys()].sort().join('|'))
  .digest('hex')
  .slice(0, 12);

const lignes = [];
lignes.push('Le passage du ' + String((mr && mr.genere) || new Date().toISOString()).slice(0, 10) +
  " a produit un catalogue **juste mais incomplet**. Rien n'est cassé : ces");
lignes.push("offres manquent, celles qui sont en ligne restent exactes.");
lignes.push('');

if (maisons.size) {
  const n = [...maisons.values()].reduce((a, b) => a + b.offres, 0);
  lignes.push('## ' + maisons.size + ' maison(s) vues et jetées — ' + n + ' offre(s)');
  lignes.push('');
  lignes.push("Elles ont servi une offre de finance sans figurer dans `ingestion/maisons.txt`.");
  lignes.push('');
  lignes.push('| Maison | Offres | Vue |');
  lignes.push('|---|---:|---|');
  for (const [e, d] of [...maisons].sort((a, b) => b[1].offres - a[1].offres)) {
    lignes.push('| ' + e + ' | ' + d.offres + ' | ' + quand(d.vue) + ' |');
  }
  lignes.push('');
  lignes.push("**Attention avant d'inscrire** : une filiale ou une marque s'ajoute en ALIAS");
  lignes.push("sur la ligne de sa maison mère, jamais comme maison à part entière.");
  lignes.push('');
}

if (sansStructure.size) {
  lignes.push('## ' + sansStructure.size + ' employeur(s) sans structure');
  lignes.push('');
  lignes.push('Ils publient, mais `ingestion/structures.js` ne leur donne pas de type :');
  lignes.push('la porte finance rejette toutes leurs offres, en silence.');
  lignes.push('');
  lignes.push('| Employeur | Offres | Vue |');
  lignes.push('|---|---:|---|');
  for (const [e, d] of [...sansStructure].sort((a, b) => b[1].offres - a[1].offres).slice(0, 60)) {
    lignes.push('| ' + e + ' | ' + d.offres + ' | ' + quand(d.vue) + ' |');
  }
  if (sansStructure.size > 60) lignes.push('| … et ' + (sansStructure.size - 60) + ' autre(s) | |');
  lignes.push('');
}

if (!total) {
  lignes.length = 0;
  lignes.push('Aucune maison à inscrire : tout ce que la collecte a vu est reconnu.');
  lignes.push('');
}

lignes.push('---');
lignes.push('');
lignes.push('*Les deux tables sont indépendantes : `maisons.txt` décide de ce qui entre,');
lignes.push('`structures.js` décide du type affiché. Inscrire dans l\'une ne sert à rien');
lignes.push('sans l\'autre (DECISIONS.md §24).*');
lignes.push('');
lignes.push('<!-- signature: ' + signature + ' -->');

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'maisons-a-inscrire.md'), lignes.join('\n'));

console.log('TOTAL=' + total);
console.log('SIGNATURE=' + signature);
console.log('MAISONS=' + maisons.size);
console.log('SANS_STRUCTURE=' + sansStructure.size);
