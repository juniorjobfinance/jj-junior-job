#!/usr/bin/env node
// ingestion/test-limites-mot.js
//
// `\b` EST ASCII. IL NE VOIT AUCUNE FRONTIÈRE CONTRE UNE LETTRE ACCENTUÉE.
//
// C'est le piège le plus coûteux du dépôt, parce qu'il ne se plaint jamais :
// le motif n'est pas faux, il est INERTE. Il n'attrape rien, ne lève rien, et
// l'on croit avoir couvert un vocabulaire qu'on n'a pas couvert.
//
// Quatre occurrences en cinq jours, en septembre 2026 :
//
//   11/09  `\bfinanc\b`                  ne matche jamais « finance »
//   13/09  `\bcommodit\b`                ne matche jamais « commodities »
//   15/09  `\b[àa] partir de`            ne matche jamais « à partir de »
//   15/09  `exig[ée]e?s?\b`              ne matche jamais « exigé »
//
// Victor, le 15/09 : « mets-le sous contrôle, ne le répare plus. La classe se
// ferme une fois, pas à chaque découverte. »
//
// Ce contrôle relit les motifs de `pipeline.js`, `classifier.js` et
// `sources.js` et échoue si un `\b` peut toucher une lettre accentuée. Au
// premier passage il en a trouvé CINQ, tous vivants :
//
//   d[ée]riv[ée]s?\b          « produit dérivé » au singulier
//   \bconfirm[ée]e?s?\b       « confirmé »
//   \bexp[ée]riment[ée]e?s?\b « expérimenté »
//   \b[ée]coles?\b            « École »        (pipeline)
//   \b[ée]cole\b              « École »        (sources)
//
// LA DIFFICULTÉ, et c'est elle qui avait laissé passer les deux derniers :
// le caractère qui précède un `\b` peut être OPTIONNEL. Dans
// `exig[ée]e?s?\b`, le dernier caractère ÉCRIT est `?` ; le dernier caractère
// POSSIBLE est le `é` de la classe. Un contrôle qui ne regarderait que le
// voisin immédiat ne verrait rien.
//
// La forme juste, partout : `(?![A-Za-zÀ-ÿ])` et `(?<![A-Za-zÀ-ÿ])`.
//
// Usage : node ingestion/test-limites-mot.js

'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const FICHIERS = ['ingestion/pipeline.js', 'ingestion/classifier.js', 'ingestion/sources.js'];
const ACCENT = /[À-ÖØ-öø-ÿ]/;

// Les motifs s'écrivent sous trois formes dans le dépôt, et le `\b` n'y porte
// pas le même nombre d'antislashs :
//   /…\b…/       littéral        un antislash
//   '…\\b…'      chaîne          deux
//   `…\b…`       gabarit         un  (les gabarits servent à composer AV/AP)
// On les ramène toutes à la forme littérale avant d'analyser.
function motifsDuFichier(src) {
  const morceaux = [];
  for (const m of src.matchAll(/\/(?![/*])((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/[gimsuy]*/g)) {
    morceaux.push({ texte: m[1], index: m.index });
  }
  for (const m of src.matchAll(/(['"])((?:[^\\\n]|\\.)*?)\1/g)) {
    if (m[2].includes('\\\\b')) morceaux.push({ texte: m[2].replace(/\\\\/g, '\\'), index: m.index });
  }
  for (const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    if (m[1].includes('\\b')) morceaux.push({ texte: m[1], index: m.index });
  }
  return morceaux;
}

// Recule depuis la position du `\b` et rend les atomes qui peuvent être le
// DERNIER caractère matché — en traversant les quantificateurs optionnels.
function atomesAvant(p, i) {
  const atomes = [];
  let j = i;
  for (let garde = 0; j > 0 && garde < 8; garde++) {
    let optionnel = false;
    if (p[j - 1] === '?' || p[j - 1] === '*') { optionnel = true; j--; }
    else if (p[j - 1] === '+') { j--; }
    else if (p[j - 1] === '}') {
      const k = p.lastIndexOf('{', j - 1);
      if (k >= 0) { optionnel = /^\{0\b/.test(p.slice(k, j)); j = k; }
    }
    if (j <= 0) break;
    let atome;
    if (p[j - 1] === ']') {
      const k = p.lastIndexOf('[', j - 1);
      if (k < 0) break;
      atome = p.slice(k, j); j = k;
    } else if (j >= 2 && p[j - 2] === '\\') { atome = p.slice(j - 2, j); j -= 2; }
    else if (p[j - 1] === ')') { atomes.push('(groupe)'); break; }
    else { atome = p[j - 1]; j -= 1; }
    atomes.push(atome);
    if (!optionnel) break;
  }
  return atomes;
}

// Et en aval, symétriquement.
function atomesApres(p, i) {
  const atomes = [];
  let j = i;
  for (let garde = 0; j < p.length && garde < 8; garde++) {
    let atome;
    if (p[j] === '[') {
      const k = p.indexOf(']', j + 1);
      if (k < 0) break;
      atome = p.slice(j, k + 1); j = k + 1;
    } else if (p[j] === '\\') { atome = p.slice(j, j + 2); j += 2; }
    else if (p[j] === '(') { atomes.push('(groupe)'); break; }
    else { atome = p[j]; j += 1; }
    atomes.push(atome);
    const q = p[j];
    if (q === '?' || q === '*') { j++; continue; }
    if (q === '{') {
      const k = p.indexOf('}', j);
      if (k > 0 && /^\{0\b/.test(p.slice(j, k + 1))) { j = k + 1; continue; }
    }
    break;
  }
  return atomes;
}

let total = 0;
const defauts = [];
for (const f of FICHIERS) {
  const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
  for (const { texte, index } of motifsDuFichier(src)) {
    for (const m of texte.matchAll(/\\b/g)) {
      total++;
      const coupables = [
        ...atomesAvant(texte, m.index).filter((a) => ACCENT.test(a)).map((a) => 'AVANT ' + a),
        ...atomesApres(texte, m.index + 2).filter((a) => ACCENT.test(a)).map((a) => 'APRÈS ' + a),
      ];
      if (!coupables.length) continue;
      defauts.push({
        f: f.split('/').pop(),
        ligne: src.slice(0, index).split('\n').length,
        coupables,
        extrait: texte.slice(Math.max(0, m.index - 34), m.index + 30),
      });
    }
  }
}

// --- LE CONTRÔLE SE FAIT DIRE NON-ZÉRO SUR UN CAS CONNU --------------------
// Un contrôle qu'on n'a jamais vu échouer n'est pas vérifié. Celui-ci se
// prouve sur les deux motifs qui l'ont motivé, écrits ici en dur.
//
// DEUX PIÈGES PORTENT LE MÊME NOM et un seul se mécanise. `\bfinanc\b` et
// `\bcommodit\b` sont tout aussi inertes, mais ENTIÈREMENT ASCII : ce qui
// cloche n'est pas un accent, c'est qu'un RADICAL réclame une frontière au
// milieu d'un mot. Pour le détecter il faudrait savoir que « financ » n'est
// pas un mot français — donc un lexique, que ce dépôt n'a pas et ne veut pas.
//
// Cette classe-là reste donc une fiche de `CLAUDE.md` et un contre-test, pas
// un contrôle. Les deux épreuves ci-dessous l'établissent en ne signalant
// RIEN : c'est la portée du contrôle, écrite noir sur blanc, pour qu'on ne le
// croie pas plus large qu'il n'est.
const EPREUVES = [
  ['\\bfinanc\\b', 0, 'radical ASCII : hors de portée de ce contrôle, voir ci-dessus'],
  ['\\bcommodit\\b', 0, 'idem — inerte, mais sans le moindre accent'],
  ['exig[ée]e?s?\\b', 1, 'le cas du 15/09 — accent OPTIONNEL avant le `\\b`'],
  ['\\b[àa] partir de', 1, 'le cas du 15/09 — accent APRÈS le `\\b`'],
  ['(?![A-Za-zÀ-ÿ])exig[ée]e?s?', 0, 'la forme juste ne doit RIEN signaler'],
  ['\\bmanagers?\\b', 0, 'un motif ASCII ne doit RIEN signaler'],
];
let echecsEpreuve = 0;
for (const [motif, attendu, quoi] of EPREUVES) {
  let n = 0;
  for (const m of motif.matchAll(/\\b/g)) {
    const c = [
      ...atomesAvant(motif, m.index).filter((a) => ACCENT.test(a)),
      ...atomesApres(motif, m.index + 2).filter((a) => ACCENT.test(a)),
    ];
    if (c.length) n++;
  }
  if (n !== attendu) {
    echecsEpreuve++;
    console.log(`  ÉCHEC D'ÉPREUVE  « ${motif} » : attendu ${attendu} signalement(s), rendu ${n}`);
    console.log(`                   ${quoi}`);
  }
}
console.log(`${EPREUVES.length - echecsEpreuve}/${EPREUVES.length} épreuves de l'instrument`);

// --- LE VERDICT ------------------------------------------------------------
console.log(`${total} limites de mot relues dans ${FICHIERS.length} fichiers`);
if (defauts.length) {
  console.log(`\n  ${defauts.length} limite(s) de mot touchent une lettre accentuée :\n`);
  for (const d of defauts) {
    console.log(`  ÉCHEC  ${d.f}:${d.ligne}   ${d.coupables.join(', ')}`);
    console.log(`         …${d.extrait}…`);
    console.log(`         → remplacer ce \\b par (?![A-Za-zÀ-ÿ]) ou (?<![A-Za-zÀ-ÿ])`);
  }
} else {
  console.log('aucune limite de mot ne touche une lettre accentuée');
}

if (defauts.length || echecsEpreuve) process.exitCode = 1;
