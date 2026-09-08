#!/usr/bin/env node
// ---------------------------------------------------------------------------
// L'ENTITÉ QUI RECRUTE EST-ELLE LUE JUSTE ? — contrôle permanent
// ---------------------------------------------------------------------------
//
// Un étudiant lisait « AXA » sur une annonce de la **Mutuelle
// Saint-Christophe**, qui n'est pas une filiale d'AXA. La source nommait
// pourtant l'employeur réel — dans `tags3`, un champ qu'on ne lisait pas.
//
// DEUX PIÈGES ENCADRENT CETTE LECTURE, et ce sont eux qu'on éprouve ici.
//
// 1. **Le même nom de champ dit deux choses selon la plateforme.** Chez
//    AXA-Phenom, `tags3` porte l'entité ; chez Talentsoft, il porte la DATE de
//    publication. Un compte d'entités bâti sur le nom du champ a rendu
//    « 04/09/2026 » et trente-huit autres dates comme des employeurs, le
//    08/09/2026. Le champ se déclare donc PAR SOURCE — jamais par plateforme,
//    jamais par nom. C'est « un champ lu doit être un champ demandé », version
//    multi-plateformes.
//
// 2. **Substituer trop large fragmente l'employeur.** « AXA France », « AXA
//    Banque », « AXA XL » disent la même maison que « AXA ». Les afficher
//    séparément n'apprend rien au candidat — et change la clé de
//    déduplication, qui commence par `slugEmp(offer.emp)` : deux noms pour une
//    même offre en font deux offres. Mesuré le 08/09 : appliquer l'entité sans
//    borne aurait renommé **371 offres** « AXA » en « AXA France ». Avec la
//    borne, **10 offres** changent de nom, et ce sont les bonnes.
//
//     node ingestion/test-entite.js
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

const chemin = path.join(__dirname, 'pipeline.js');
let src = fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
src = src.replace(/^#![^\n]*\n/, '').replace(/run\(\)\.catch\([\s\S]*$/, '');
const P = new Function(
  'require', 'module', 'exports', '__dirname', '__filename',
  src + '\n;return { entiteQuiRecrute, CHAMP_ENTITE_PAR_SOURCE };'
)(require('module').createRequire(chemin), { exports: {} }, {}, __dirname, chemin);

let echecs = 0;
function verifier(nom, ok, detail) {
  if (!ok) echecs++;
  console.log('  ' + (ok ? 'ok   ' : 'ÉCHEC') + ' ' + nom + (detail ? '\n         ' + detail : ''));
}

const AXA = 'phenom:careers.axa.com';

// === 1 — une AUTRE marque est substituée =================================
for (const [valeur, attendu] of [
  ['MUTUELLE SAINT-CHRISTOPHE', 'MUTUELLE SAINT-CHRISTOPHE'],
  ['Direct Assurance', 'Direct Assurance'],
  ['GIE AXA', 'GIE AXA'],
]) {
  const r = P.entiteQuiRecrute(AXA, { tags3: valeur }, 'AXA');
  verifier('1 — « ' + valeur + ' » remplace « AXA »', r === attendu, 'rendu : ' + JSON.stringify(r));
}

// === 2 — une déclinaison de la MÊME maison ne l'est pas ===================
// C'est la borne : sans elle, 371 offres AXA seraient renommées.
for (const valeur of ['AXA France', 'AXA BANQUE', 'AXA XL', 'AXA Partners',
  'AXA Group Operations', 'AXA', 'axa france']) {
  const r = P.entiteQuiRecrute(AXA, { tags3: valeur }, 'AXA');
  verifier('2 — « ' + valeur + ' » ne remplace PAS « AXA »', r === null, 'rendu : ' + JSON.stringify(r));
}

// === 3 — une source NON DÉCLARÉE ne lit rien =============================
// Le cœur du piège : chez Talentsoft, `tags3` porte une date. Si la lecture
// se faisait par nom de champ, « 04/09/2026 » deviendrait un employeur.
for (const src2 of ['talentsoft:jobs.amundi.com', 'phenom:careers.allianz.com',
  'workday:bdf', 'liste:Crédit Agricole']) {
  const r = P.entiteQuiRecrute(src2, { tags3: '04/09/2026' }, 'CNP Assurances');
  verifier('3 — source non déclarée « ' + src2 + " » n'est pas lue", r === null,
    'rendu : ' + JSON.stringify(r));
}

// === 4 — le champ déclaré est le seul lu =================================
// Sur la source déclarée, un AUTRE champ ne doit pas parler à sa place.
{
  const r = P.entiteQuiRecrute(AXA, { LegalEntity: 'Direct Assurance', tags2: 'Freelance' }, 'AXA');
  verifier('4 — un champ non déclaré ne parle pas à la place de `tags3`', r === null,
    'rendu : ' + JSON.stringify(r));
}

// === 5 — les formes que la source envoie réellement ======================
{
  verifier('5 — un tableau à une valeur est lu',
    P.entiteQuiRecrute(AXA, { tags3: ['Direct Assurance'] }, 'AXA') === 'Direct Assurance');
  verifier('5 — un tableau à plusieurs valeurs est refusé',
    P.entiteQuiRecrute(AXA, { tags3: ['Direct Assurance', 'AXA France'] }, 'AXA') === null);
  for (const [etiquette, brut] of [
    ['vide', ''], ['espaces', '   '], ['absent', undefined], ['nul', null],
    ['objet', { nom: 'Direct Assurance' }], ['nombre', 42],
  ]) {
    verifier('5 — ' + etiquette + ' est refusé',
      P.entiteQuiRecrute(AXA, { tags3: brut }, 'AXA') === null);
  }
  verifier('5 — une valeur de plus de 70 caractères est refusée',
    P.entiteQuiRecrute(AXA, { tags3: 'D'.repeat(71) }, 'AXA') === null);
}

// === 6 — la table est déclarée par SOURCE, pas par plateforme ============
{
  const cles = Object.keys(P.CHAMP_ENTITE_PAR_SOURCE || {});
  verifier('6 — la table nomme au moins une source', cles.length >= 1);
  verifier('6 — chaque clé est une source complète « plateforme:hôte », pas une plateforme',
    cles.every((k) => k.includes(':') && k.split(':')[1].length > 0),
    'clés : ' + cles.join(', '));
}

console.log('\n  ' + (echecs ? echecs + ' ÉCHEC(S)' : "l'entité qui recrute est lue juste"));
process.exit(echecs ? 1 : 0);
