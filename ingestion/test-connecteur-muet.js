#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Le compteur des connecteurs muets — deux assertions, pas une suite
// ---------------------------------------------------------------------------
//
// Le 06/09/2026, dix offres sur 928 ont gelé le site trois matins de suite : le
// connecteur Bank of America tombait à zéro, et le garde-fou refusait toute la
// publication. Publier sans lui donnait un catalogue incomplet de 1 % ; ne pas
// publier en donnait un vieux de trois jours.
//
// Un connecteur muet ne bloque donc plus, il crie — et l'escalade se fait dans
// le TEMPS : au troisième passage consécutif à zéro, ce n'est plus un incident,
// c'est un connecteur mort qu'on n'a pas réparé.
//
// Deux propriétés décident si ce compteur est sain, et elles seules :
//
//   1. IL NE DÉMARRE QUE SUR UNE CHUTE. Un connecteur mort depuis trois mois
//      est à zéro tous les matins. S'il incrémentait, il bloquerait la
//      publication au troisième matin au nom d'une source dont plus personne
//      n'attend rien.
//   2. IL SE REMET À ZÉRO DÈS QU'UNE OFFRE ARRIVE. Pas au bout d'un moment,
//      pas au passage vert : dès qu'il rend une offre.
//
//     node ingestion/test-connecteur-muet.js
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

// On charge la VRAIE fonction du pipeline. La recopier ici donnerait un test
// qui éprouve sa copie — trois diagnostics faux ont déjà été rendus ainsi.
const chemin = path.join(__dirname, 'pipeline.js');
let src = fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
src = src.replace(/^#![^\n]*\n/, '').replace(/run\(\)\.catch\([\s\S]*$/, '');
const fabrique = new Function(
  'require', 'module', 'exports', '__dirname', '__filename',
  src + '\n;return { suivreConnecteursMuets, SEUIL_CONNECTEUR_MUET, PASSAGES_AVANT_BLOCAGE };'
);
const faux = { exports: {} };
const P = fabrique(require('module').createRequire(chemin), faux, faux.exports, __dirname, chemin);

let echecs = 0;
function verifier(nom, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log('  ' + (ok ? 'ok   ' : 'ÉCHEC') + ' ' + nom);
  if (!ok) console.log('         attendu ' + JSON.stringify(attendu) + ', obtenu ' + JSON.stringify(obtenu));
}

const M = (o) => new Map(Object.entries(o));

// --- 1. Un connecteur mort depuis dix passages ne bloque JAMAIS ---------
// Il n'est plus dans le catalogue de la veille — donc `avant` ne le connaît
// pas — et il n'a jamais été suivi. Dix passages plus tard, il ne l'est
// toujours pas : le compteur reste vide, et rien ne bloque.
{
  const suivis = {};
  for (let passage = 1; passage <= 10; passage++) {
    // « avant » = le catalogue publié la veille. Le mort n'y figure pas.
    P.suivreConnecteursMuets(M({ greenhouse: 40 }), M({ greenhouse: 41 }), suivis);
  }
  verifier('1 — un connecteur mort depuis dix passages n\'est jamais suivi', suivis, {});
}

// Et la même chose s'il apparaît dans `avant` avec MOINS que le seuil : une
// source qui ne servait qu'une offre ne mérite pas de bloquer le site.
{
  const suivis = {};
  for (let passage = 1; passage <= 10; passage++) {
    P.suivreConnecteursMuets(M({ petit: 1 }), M({}), suivis);
  }
  verifier('1 bis — un connecteur qui ne servait qu\'une offre n\'est pas suivi', suivis, {});
}

// --- 2. Une offre rendue remet le compteur à ZÉRO -----------------------
// Premier passage : chute depuis 10 -> suivi, compteur à 1.
// Deuxième passage : il rend une offre -> il disparaît du suivi.
{
  const suivis = {};
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);
  verifier('2 — après la chute, le connecteur est suivi au rang 1', suivis, { bofa: 1 });

  P.suivreConnecteursMuets(M({ bofa: 10 }), M({ bofa: 3 }), suivis);
  verifier('2 — une offre rendue au deuxième passage le sort du suivi', suivis, {});
}

// --- Le seuil de blocage, pour mémoire ---------------------------------
// Trois passages consécutifs à zéro, et alors seulement il bloque.
{
  const suivis = {};
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);
  verifier('3 — deux passages à zéro : on crie encore', suivis.bofa < P.PASSAGES_AVANT_BLOCAGE, true);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);
  verifier('3 — au troisième, il bloque', suivis.bofa >= P.PASSAGES_AVANT_BLOCAGE, true);
}

// Le cas qui compte vraiment le lendemain : on a publié SANS lui, donc il
// n'est plus dans le catalogue de la veille. Le compteur doit continuer —
// sinon l'escalade ne se déclencherait jamais.
{
  const suivis = {};
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);        // jour 1 : chute
  P.suivreConnecteursMuets(M({ greenhouse: 40 }), M({}), suivis);  // jour 2 : publié sans lui
  P.suivreConnecteursMuets(M({ greenhouse: 40 }), M({}), suivis);  // jour 3
  verifier('4 — le compteur survit à une publication faite sans lui', suivis.bofa, 3);
}

console.log('\n  ' + (echecs ? echecs + ' ÉCHEC(S)' : 'les deux propriétés tiennent'));
process.exit(echecs ? 1 : 0);
