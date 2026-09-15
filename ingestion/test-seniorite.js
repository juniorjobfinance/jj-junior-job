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

  // --- Les quantités APPROXIMATIVES -------------------------------------
  // « Une dizaine d'années » est aussi net qu'un « 10 ans » pour qui lit
  // l'annonce, et parfaitement muet pour qui compte des chiffres. La Banque
  // de France publiait son « Analyste dossiers d'agréments » sous cette
  // forme, et il est passé — sa fiche ne faisait que 2 853 caractères, donc
  // aucune troncature n'était en cause : le mot n'était simplement pas dans
  // la table des nombres, et l'apostrophe de « dizaine D'ANNÉES » coupait le
  // motif en deux.
  ["Vous disposez d’une dizaine d’années d’expérience.", 10, 'Banque de France'],
  ["Une quinzaine d’années d’expérience exigée.", 15, 'par symétrie'],
  ["Une vingtaine d'années d'expérience.", 20, 'par symétrie, à la borne'],
  // Et ce qu'elles ne doivent PAS faire dire au juge.
  ['Vous encadrez une dizaine de collaborateurs, expérience appréciée.', null, "« dizaine » sans l'unité"],
  ['Vous justifiez d’années d’expérience variées.', null, 'aucun nombre, juste une apostrophe'],

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

// --- CE QUE LE JUGE PEUT LIRE --------------------------------------------
// Les deux cas ci-dessus supposent un texte propre. Encore faut-il que le
// texte ARRIVE propre : `texteDeLaPage` remplaçait toute entité HTML par une
// ESPACE, si bien que le moteur e-i.com — CIC, Crédit Mutuel, Banque
// Transatlantique, qui encodent tous leurs accents en « &#233; » — servait
// au juge « Exp rience professionnelle ant rieure de 3   5 ans ».
//
// Or l'ancre du juge est `/exp[ée]rien/i`. Le mot n'existait plus, la phrase
// entière était sautée, et « Analyste RSE-ESG » du CIC a été publié malgré
// ses 3 à 5 ans exigés. Ce n'était pas un défaut d'affichage : chaque ancre
// de ce mécanisme est un mot français accentué.
const remplissage = '<p>Rejoignez notre groupe bancaire. </p>'.repeat(20);
const LECTURES = [
  [
    remplissage + '<p>Exp&#233;rience professionnelle ant&#233;rieure de 3 &#224; 5 ans.</p>',
    5,
    'CIC — accents en entités numériques',
  ],
  [
    remplissage + '<p>Vous disposez d&#39;une dizaine d&#8217;ann&#233;es d&#8217;exp&#233;rience.</p>',
    10,
    'les deux corrections ensemble : entité + quantité approximative',
  ],
  [remplissage + '<p>Expérience de 3 à 5 ans.</p>', 5, 'texte déjà propre : inchangé'],
];
let echecs3 = 0;
for (const [html, attendu, source] of LECTURES) {
  const texte = P.texteDeLaPage(html);
  const rendu = texte ? P.verdictSenioriteDescr(texte)._expMax : null;
  if (rendu !== attendu) {
    echecs3++;
    console.log(`  ÉCHEC  attendu ${attendu}, rendu ${rendu}   [${source}]`);
    console.log(`         lu : « ${String(texte).slice(-90)} »`);
  }
}
// Une entité que le décodeur ne connaît pas doit rester une ESPACE : sans
// quoi elle collerait deux mots l'un à l'autre.
{
  const lu = P.texteDeLaPage(remplissage + '<p>Paris&zzz;Lyon</p>') || '';
  if (!/Paris Lyon/.test(lu)) {
    echecs3++;
    console.log('  ÉCHEC  une entité inconnue doit redevenir une espace');
  }
}
console.log(`${LECTURES.length + 1 - echecs3}/${LECTURES.length + 1} lectures de fiche conformes`);

// --- L'INTITULÉ QUI SUFFIT À ÉCARTER -------------------------------------
// « On n'encadre pas une équipe à zéro an. » HSBC publiait un « Team Leader
// - Asia & Middle East Corridor » en CDI, et aucun marqueur ne le voyait.
// Le motif vit dans SENIOR_RE, qui ne se consulte que pour les CDI/CDD : un
// stage d'assistant reste donc un stage, et c'est le dernier cas ci-dessous
// qui le vérifie.
//
// CHAQUE CAS PORTE UNE DESCRIPTION, et ce n'est pas un détail. Sans elle, un
// CDI dont l'intitulé ne dit pas « junior » est écarté par une règle de
// dernier recours, étrangère au marqueur : les quatre cas « écarté »
// passaient alors AUSSI sur le code d'avant la correction, et ne
// protégeaient rien. C'est la contre-épreuve — relancer la suite sur le
// pipeline de HEAD — qui l'a montré, pas la relecture.
const DESCR = 'Texte de l’annonce, suffisant pour que la description soit réputée lue.';
const INTITULES = [
  ['cdi-cdd', 'Team Leader - Asia & Middle East Corridor - Global Network Banking', false, 'HSBC'],
  ['cdi-cdd', 'Team leader Governance, Compliance & Regulatory', false, 'Deloitte'],
  ['cdi-cdd', 'Chef d’équipe Back Office', false, 'forme française'],
  ['cdi-cdd', 'Team Manager OPC - Fund Administration', false, 'Caceis'],
  ['stage', 'Stage - Assistant du Team Lead Finance', true, 'un stage reste un stage'],
  ['cdi-cdd', 'Analyste financier junior au sein de l’équipe M&A', true, "« équipe » seul n'encadre rien"],
];
let echecs4 = 0;
for (const [volet, titre, attendu, source] of INTITULES) {
  const rendu = P.passesJuniorFilter({ volet, title: titre, _descrExtrait: DESCR }, true);
  if (rendu !== attendu) {
    echecs4++;
    console.log(`  ÉCHEC  attendu ${attendu ? 'gardé' : 'écarté'}, rendu ${rendu ? 'gardé' : 'écarté'}`);
    console.log(`         « ${titre} »   [${source}]`);
  }
}
console.log(`${INTITULES.length - echecs4}/${INTITULES.length} intitulés jugés conformément`);

if (echecs + echecs2 + echecs3 + echecs4) process.exitCode = 1;
