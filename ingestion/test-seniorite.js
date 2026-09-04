#!/usr/bin/env node
// ingestion/test-seniorite.js
//
// LA LECTURE DES DURÉES D'EXPÉRIENCE, phrase par phrase.
//
// C'est le mécanisme qui décide, à lui seul, qu'une annonce n'est pas junior.
// Il a échoué en silence le 04/09/2026 : un garde-fou écrit contre « Bac+5 »
// disqualifiait TOUT nombre situé à moins de 45 caractères d'un diplôme, si
// bien que « Bac+5, vous possédez 5 à 10 ans d'expérience » ne rendait rien.
// Treize offres seniors sont entrées par ce trou, dont six chez CNP Assurances
// dont le pied de page écrit « Bac+4 Niveau d'expérience 6-10 ans ».
//
// Aucune suite ne couvrait ce mécanisme : les cas ci-dessous sont donc écrits
// à partir d'annonces RÉELLES, chacune nommant sa maison, pour que la
// prochaine régression se voie avant d'être publiée.
//
// Usage : node ingestion/test-seniorite.js

'use strict';

const { chargerPipeline } = require('./atelier');
const P = chargerPipeline(require('path').join(__dirname, '..'));

// [ phrase, attendu, provenance ]
const CAS = [
  // --- Les fourchettes, sous toutes leurs écritures ---------------------
  // La règle du §5 de DECISIONS.md est la BORNE HAUTE : « 3 à 5 ans » vaut 5.
  ['Vous justifiez de 3 à 5 ans d’expérience.', 5, 'Caceis'],
  ['Vous justifiez de 5 à 10 ans d’expérience.', 10, 'Crédit Agricole CIB'],
  ["Niveau d'expérience minimum 6 - 10 ans", 10, 'Caceis'],
  ['Une expérience de 10 à 15 ans est requise.', 15, 'forme non observée, par symétrie'],
  ['Vous avez de 5 à 10 ans d’expérience.', 10, 'Sia Partners'],
  ['Vous avez entre 5 et 10 ans d’expérience.', 10, 'Sia Partners'],
  ['You have 5-10 years of experience.', 10, 'Wakam'],
  ['You have 3 to 5 years of experience.', 5, 'forme anglaise courante'],

  // --- Le diplôme et l'exigence dans la MÊME phrase ----------------------
  // Ces quatre-là rendaient null avant le 04/09/2026.
  ["De formation Bac+5, vous possédez 5 à 10 ans d'expérience.", 10, 'Talan'],
  ["Bac+4 Niveau d'expérience 6-10 ans", 10, 'CNP Assurances'],
  ['BAC +5 Expérience de 5 ans minimum', 5, 'Covéa'],
  ["Bac + 5 avec une expérience de au moins 10 ans", 10, 'Groupe BPCE'],

  // --- Les faux positifs, chacun payé par une observation ----------------
  // Ils doivent rester à null : c'est ce qui rend le resserrement sûr.
  ['Bac+5, 5 années d’études', null, "le faux positif qui a justifié le garde-fou"],
  ['Bac+5, soit 5 années d’études, avec une expérience en audit.', null, 'même, en phrase'],
  ["Façonné par plus de 145 ans d'expérience, Indosuez accompagne.", null, 'Indosuez'],
  ["Contrat en alternance de 2 ans, une première expérience est un plus.", null, 'contrat, pas exigence'],
  ['Notre maison, créée il y a 30 ans, cherche un profil avec de l’expérience.', null, 'âge de la maison'],
  ['Nous comptons 3 000 consultants depuis 48 bureaux.', null, "aucune ancre « expérience »"],

  // --- La cible elle-même : ce qui doit PASSER --------------------------
  ["Vous justifiez de 2 ans d'expérience.", 2, 'dans la cible'],
  ["Une première expérience de 3 ans en audit.", 3, 'à la limite, donc admis'],
];

let echecs = 0;
for (const [phrase, attendu, source] of CAS) {
  const rendu = P.dureeExperienceMax(phrase);
  if (rendu !== attendu) {
    echecs++;
    console.log(`  ÉCHEC  attendu ${attendu}, rendu ${rendu}`);
    console.log(`         « ${phrase} »   [${source}]`);
  }
}
console.log(`\n${CAS.length - echecs}/${CAS.length} lectures de durée conformes`);

// --- Le verdict complet, au-delà du seul chiffre --------------------------
// Les formules sans chiffre et le veto « débutants » décident autant que les
// durées : une régression sur l'un d'eux serait tout aussi silencieuse.
const VERDICTS = [
  ["Vous disposez d'une expérience confirmée en audit.", 'formule', 'AXA'],
  ['Vous justifiez d’une expérience significative.', 'formule', 'Matmut'],
  ['Solide expérience en comptabilité exigée.', 'formule', 'Thales'],
  ["Une première expérience est appréciée, poste ouvert aux débutants.", 'veto', 'veto junior'],
  ['Poste ouvert aux jeunes diplômés.', 'veto', 'veto junior'],
  ['Vous êtes rigoureux et curieux.', 'rien', 'aucun signal'],
];
let echecs2 = 0;
for (const [phrase, attendu, source] of VERDICTS) {
  const v = P.verdictSenioriteDescr(phrase);
  const rendu = v._vetoJunior ? 'veto' : v._formuleSeniorite ? 'formule' : 'rien';
  if (rendu !== attendu) {
    echecs2++;
    console.log(`  ÉCHEC  attendu ${attendu}, rendu ${rendu}`);
    console.log(`         « ${phrase} »   [${source}]`);
  }
}
console.log(`${VERDICTS.length - echecs2}/${VERDICTS.length} verdicts de séniorité conformes`);

if (echecs + echecs2) process.exitCode = 1;
