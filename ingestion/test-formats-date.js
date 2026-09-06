#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Contrôle permanent — le format de date des sources
// ---------------------------------------------------------------------------
//
// Le 06/09/2026, la publication a été refusée parce que le connecteur Bank of
// America était tombé de dix offres à zéro. Ni le réseau, ni l'employeur : leur
// API date en **MM/JJ/AAAA**, le pipeline lisait en **JJ/MM/AAAA**. Une offre
// publiée le 1er septembre — `09/01/2026` — était enregistrée au 9 janvier,
// vieille de 240 jours au lieu de 5. Les dix ont franchi le seuil d'âge le même
// matin.
//
// CE QUE CE CONTRÔLE PEUT, ET CE QU'IL NE PEUT PAS.
//
// Une date « A/B/AAAA » ne se laisse lire que d'une façon quand l'un des deux
// nombres dépasse 12 :
//
//     B > 12  ->  B ne peut pas être un mois  ->  format AMÉRICAIN (MM/JJ)
//     A > 12  ->  A ne peut pas être un mois  ->  format EUROPÉEN  (JJ/MM)
//
// Quand les deux valent 12 ou moins, la date est indécidable : « 07/03/2026 »
// est valide dans les deux lectures et ne lèvera jamais d'erreur — elle sera
// simplement fausse de quatre mois. Sur les quatorze dates de Bank of America,
// UNE SEULE était auto-révélatrice.
//
// Ce contrôle n'attrapera donc jamais une source dont toutes les dates tombent
// entre 1 et 12. Il attrape autre chose, que personne d'autre ne verrait :
// **une source qui CHANGE de format**, ou une source américaine qui se met à
// servir une date révélatrice. C'est déjà ce qu'aucune relecture n'aurait vu.
//
// Il lit la dernière récolte brute — celle que le passage vient d'écrire — et
// non le catalogue publié : une offre écartée à l'âge, précisément parce que sa
// date était mal lue, ne figure plus dans le catalogue. C'est là qu'était le
// piège.
//
//     node ingestion/test-formats-date.js
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RACINE = path.join(__dirname, '..');
const DATA = path.join(RACINE, 'data');

// Le format déclaré pour chaque source, tel qu'il est écrit dans sources.js.
// Cette table ne DÉCIDE de rien — c'est sources.js qui décide. Elle sert à
// confronter la déclaration aux données, et c'est tout son intérêt : si les
// deux divergent, l'une des deux est fausse.
const DECLARES = {
  bofa: 'MM/JJ/AAAA',
  'phenom:careers.axa.com': 'JJ/MM/AAAA',
};

const SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

function derniereRecolte() {
  if (!fs.existsSync(DATA)) return null;
  const f = fs.readdirSync(DATA).filter((n) => n.startsWith('brut-') && n.endsWith('.json.gz')).sort().pop();
  if (!f) return null;
  return { nom: f, contenu: JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, f))).toString()) };
}

// Toutes les chaînes « A/B/AAAA » d'un objet, à n'importe quelle profondeur.
function chainesBarrees(o, sortie = [], profondeur = 0) {
  if (profondeur > 4 || !o || typeof o !== 'object') return sortie;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && SLASH.test(v.trim())) sortie.push(v.trim());
    else if (v && typeof v === 'object') chainesBarrees(v, sortie, profondeur + 1);
  }
  return sortie;
}

const recolte = derniereRecolte();
if (!recolte) {
  console.log('  aucune récolte dans data/ — contrôle sans objet');
  console.log('  (lancer le pipeline une fois pour en constituer une)');
  process.exit(0);
}

console.log('  récolte : ' + recolte.nom + ' — ' + recolte.contenu.offres.length + ' offres brutes\n');

const parSource = new Map();
for (const o of recolte.contenu.offres) {
  const src = o.__src || '?';
  for (const d of chainesBarrees(o.raw)) {
    const m = SLASH.exec(d);
    const A = Number(m[1]);
    const B = Number(m[2]);
    if (!parSource.has(src)) parSource.set(src, { us: 0, eu: 0, amb: 0, exUs: null, exEu: null });
    const s = parSource.get(src);
    if (B > 12 && A <= 12) { s.us++; s.exUs = s.exUs || d; }
    else if (A > 12 && B <= 12) { s.eu++; s.exEu = s.exEu || d; }
    else s.amb++;
  }
}

let echecs = 0;
// Les motifs sont gardes pour l'issue : le journal ne suffit pas.
const motifs = [];
const dire = (ok, texte) => {
  if (!ok) { echecs++; motifs.push(texte); }
  console.log('  ' + (ok ? 'ok   ' : 'ÉCHEC') + ' ' + texte);
};

// --- 1. Aucune source ne doit se contredire elle-même -------------------
for (const [src, s] of parSource) {
  if (s.us && s.eu) {
    dire(false, src + ' — contradictoire : « ' + s.exUs + ' » prouve l\'américain, ' +
      '« ' + s.exEu + ' » prouve l\'européen. Deux formats dans la même source, ou un champ mal lu.');
  }
}

// --- 2. La déclaration doit correspondre à la preuve --------------------
for (const [src, format] of Object.entries(DECLARES)) {
  const s = parSource.get(src);
  if (!s) { console.log('  ·     ' + src + ' — déclarée « ' + format + ' », aucune date à barres ce matin'); continue; }
  if (format === 'MM/JJ/AAAA') {
    dire(!s.eu, src + ' — déclarée américaine' + (s.eu ? ', mais « ' + s.exEu + ' » prouve l\'européen' : ' ; ' + s.us + ' preuve(s) concordante(s)'));
  } else if (format === 'JJ/MM/AAAA') {
    dire(!s.us, src + ' — déclarée européenne' + (s.us ? ', mais « ' + s.exUs + ' » prouve l\'américain' : ' ; ' + s.eu + ' preuve(s) concordante(s)'));
  }
}

// --- 3. Une source PROUVÉE américaine doit être déclarée ----------------
// C'est la porte par laquelle Bank of America est passée : rien ne la
// déclarait, et le défaut européen la lisait en silence.
for (const [src, s] of parSource) {
  if (s.us && !s.eu && !DECLARES[src]) {
    dire(false, src + ' — « ' + s.exUs + ' » prouve un format AMÉRICAIN, et rien ne le déclare. ' +
      'Le pipeline la lit à l\'européenne : ses offres vieillissent de plusieurs mois en silence. ' +
      'À déclarer dans ingestion/sources.js.');
  }
}

// Le verdict part dans un fichier que l'alerte attachera a l'issue. Un
// controle qui n'ecrit que dans le journal d'une etape n'a pas de
// destinataire : c'est le defaut qu'on vient de corriger sur l'alerte,
// il serait absurde de le reintroduire ici.
const RAPPORT = path.join(DATA, 'formats-non-declares.md');
if (motifs.length) {
  fs.writeFileSync(RAPPORT, [
    '### Format de date non déclaré',
    '',
    'Une date à barres obliques ne se lit que si l on sait de quel côté du monde',
    'elle vient. Ces sources en servent une que rien ne déclare :',
    '',
  ].concat(motifs.map((m) => '- ' + m)).concat([
    '',
    'À déclarer dans `ingestion/sources.js`, à côté du host du connecteur.',
    '',
  ]).join('\n'));
} else if (fs.existsSync(RAPPORT)) {
  fs.unlinkSync(RAPPORT); // plus rien a signaler : le fichier ne doit pas survivre
}

console.log('\n  ' + parSource.size + ' source(s) rendent au moins une date à barres obliques.');
console.log('  ' + (echecs ? echecs + ' ÉCHEC(S)' : 'aucun écart entre les formats déclarés et les preuves'));
process.exit(echecs ? 1 : 0);
