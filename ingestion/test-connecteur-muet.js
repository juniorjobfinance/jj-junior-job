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
  src +
    '\n;return { suivreConnecteursMuets, SEUIL_CONNECTEUR_MUET, PASSAGES_AVANT_BLOCAGE,' +
    ' laSourceARepondu, diagnosticConnecteur, anomaliesDePublication };'
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

// === 5 — §39 : LE COMPTEUR N INCREMENTE QUE SI LA SOURCE NE REPOND PAS ===
//
// Le 07/09 a 21h13, bofa a bloque la publication du catalogue entier au
// troisieme passage — alors qu il repondait quatorze offres en deux
// secondes. Le defaut etait chez nous : une date lue en JJ/MM quand elle est
// en MM/JJ. Un catalogue incomplet de 1 %, avec sa cause a la ligne pres,
// n a pas ete publie pour proteger dix offres.
//
// `brutes` = ce que les connecteurs ont RENDU, avant nos filtres.
const brutes = (nom, n) =>
  Array.from({ length: n }, () => ({ __src: nom + ':exemple' }));

{
  // La source repond quatorze offres, nos filtres les ecartent toutes.
  const suivis = {};
  const b = brutes('bofa', 14);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, b);
  verifier('5 — la source repond : le compteur DEMARRE mais n incremente pas', suivis.bofa, 0);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, b);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, b);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, b);
  verifier('5 — quatre passages, la source repond toujours : toujours zero', suivis.bofa, 0);
}

{
  // La source ne repond pas : le comportement d avant, intact.
  const suivis = {};
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, brutes('greenhouse', 5));
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, brutes('greenhouse', 5));
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis, brutes('greenhouse', 5));
  verifier('5 — la source ne repond pas : le compteur escalade comme avant', suivis.bofa, 3);
}

{
  // `brutes` absent : on ne sait pas. Ne pas savoir ne desarme pas le
  // garde-fou — c est le comportement conservateur, et celui d avant.
  const suivis = {};
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);
  P.suivreConnecteursMuets(M({ bofa: 10 }), M({}), suivis);
  verifier('5 — sans `brutes`, on escalade quand meme', suivis.bofa, 2);
}

// === 6 — LE PREDICAT ET LE MESSAGE LISENT LA MEME CHOSE ===
//
// Deux tests separes pour la meme question divergent tot ou tard, et alors
// le message dit « la source a repondu » pendant que le compteur escalade
// comme si elle etait morte.
{
  verifier('6 — repond', P.laSourceARepondu('bofa', brutes('bofa', 3)), true);
  verifier('6 — ne repond pas', P.laSourceARepondu('bofa', brutes('autre', 3)), false);
  verifier('6 — recolte vide', P.laSourceARepondu('bofa', []), false);
  verifier('6 — recolte absente', P.laSourceARepondu('bofa', undefined), false);

  // Et le message doit dire la MEME chose que le predicat.
  const repond = P.diagnosticConnecteur('bofa', 10, brutes('bofa', 14));
  verifier('6 — le message dit « A RÉPONDU » quand le predicat dit true',
    /A RÉPONDU/.test(repond), true);
  const muet = P.diagnosticConnecteur('bofa', 10, brutes('autre', 14));
  // L'apostrophe du message est DROITE, pas typographique — lue au `cat -A`,
  // pas ecrite de memoire. Cette assertion a echoue au premier jet pour cette
  // seule raison. C'est le piege qui a corrompu CLAUDE.md trois fois.
  verifier("6 — le message dit « N'A RIEN RENVOYÉ » quand le predicat dit false",
    /N'A RIEN RENVOYÉ/.test(muet), true);
}

// === 7 — §39 AU JOUR 4 : LE COMPTEUR EST DEJA A TROIS ET LA SOURCE REPOND ==
//
// La garde du compteur suffit au cas simple. Mais cette sequence est reelle :
//
//   jours 1-3  la source est vraiment muette      -> le compteur monte a 3
//   jour 4     la source repond, nos filtres ecartent tout
//
// Au jour 4, sans le SECOND garde-fou — celui qui lit le predicat dans la
// condition de blocage —, le catalogue entier ne partirait pas pour un defaut
// de notre cote. C est l incident du 07/09 a 21h13, et c est la propriete qui
// protege le site.
//
// Ce test passe par anomaliesDePublication, qui lit le catalogue de la veille
// sur le disque : c est un test d integration, et il ne peut pas etre autre
// chose. Si offres.js manque ou porte moins de 50 offres, la fonction rend
// deux listes vides et le test le dit plutot que de croire au succes.
{
  const anciennes = (() => {
    try {
      const g = {};
      new Function('window', fs.readFileSync(path.join(__dirname, '..', 'offres.js'), 'utf8'))(g);
      return g.__OFFRES__ || [];
    } catch (e) { return []; }
  })();

  if (anciennes.length < 50) {
    verifier('7 — catalogue de la veille lisible (sinon le test ne prouve rien)', false, true);
  } else {
    // Le catalogue de ce matin, prive de tout ce que « bofa » servait.
    const nouvelles = anciennes.filter((o) => String(o.source || '').split(':')[0] !== 'bofa');
    // La source REPOND quatorze offres, et nos filtres les ecartent toutes.
    const b = brutes('bofa', 14);
    // Le compteur est deja a trois, herite de trois vrais silences.
    const r = P.anomaliesDePublication(nouvelles, b, { bofa: 3 });
    const bloquePourBofa = r.bloquantes.some((x) => /bofa/.test(x));
    const signalePourBofa = r.signalements.some((x) => /bofa/.test(x));
    verifier('7 — compteur a 3 + source qui repond : NE BLOQUE PAS', bloquePourBofa, false);
    verifier('7 — compteur a 3 + source qui repond : signale quand meme', signalePourBofa, true);
    // Et le message doit dire POURQUOI il n escalade pas.
    verifier('7 — le signalement nomme le §39',
      r.signalements.some((x) => /bofa/.test(x) && /§39/.test(x)), true);

    // Le meme jour 4, mais la source NE repond PAS : le blocage doit revenir.
    const r2 = P.anomaliesDePublication(nouvelles, brutes('autre', 14), { bofa: 3 });
    verifier('7 — compteur a 3 + source muette : BLOQUE',
      r2.bloquantes.some((x) => /bofa/.test(x)), true);
  }
}

console.log('\n  ' + (echecs ? echecs + ' ÉCHEC(S)' : 'les deux propriétés tiennent'));
process.exit(echecs ? 1 : 0);
