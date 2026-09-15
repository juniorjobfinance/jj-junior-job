#!/usr/bin/env node
// ingestion/test-doublon-marque.js
//
// LA MÊME OFFRE SOUS DEUX NOMS DE MAISON.
//
// `canonicalKey` vaut `slugEmp|slugTitre|lieu` : le nom de l'employeur fait
// PARTIE de la clé, donc deux offres identiques publiées sous deux noms ne
// peuvent jamais se dédupliquer. `CLAUDE.md` le porte comme piège depuis des
// semaines ; le 15/09/2026 il s'est réalisé.
//
// Le moteur e-i.com du Crédit Mutuel Alliance Fédérale sert la même annonce
// depuis trois domaines. Quatre numéros d'annonce paraissaient deux fois au
// catalogue, dont « Analyste RSE-ESG », sous CIC ET sous Crédit Mutuel.
//
// Le contrôle « une URL, un employeur » ne pouvait rien voir : les adresses
// diffèrent par leur HÔTE. Et l'on ne pouvait pas débrancher un domaine —
// mesure du 15/09 : CIC et Crédit Mutuel servent 15 offres chacun, dont 11
// communes, mais 4 en propre de chaque côté. Débrancher, c'était payer un
// doublon d'une offre perdue.
//
// La correction dit donc que, sur ce moteur, une offre EST son numéro.
//
// Usage : node ingestion/test-doublon-marque.js

'use strict';

const { chargerPipeline } = require('./atelier');
const P = chargerPipeline(require('path').join(__dirname, '..'));

const EI = (host, annonce) => `https://${host}/fr/offre.html?annonce=${annonce}`;
const offre = (emp, url) => ({ emp, title: 'Analyste RSE-ESG', loc: 'Paris', url });

let echecs = 0;
function verifier(libelle, obtenu, attendu) {
  if (String(obtenu) === String(attendu)) return;
  echecs++;
  console.log(`  ÉCHEC  ${libelle}`);
  console.log(`         obtenu « ${obtenu} », attendu « ${attendu} »`);
}

// --- Ce qui doit FONDRE ---------------------------------------------------
const cic = P.canonicalKey(offre('CIC', EI('recrutement.cic.fr', 116238)));
const cm = P.canonicalKey(offre('Crédit Mutuel', EI('recrutement.creditmutuel.fr', 116238)));
const bt = P.canonicalKey(offre('Banque Transatlantique', EI('www.banquetransatlantique.com', 116238)));

verifier('CIC et Crédit Mutuel, même annonce : même clé', cic === cm, true);
verifier('Banque Transatlantique aussi', cic === bt, true);
verifier("la clé est le numéro, pas le nom de la maison", cic, 'eicards|116238');

// --- Ce qui doit RESTER DISTINCT -----------------------------------------
// Deux numéros différents sont deux offres, même chez le même employeur.
verifier(
  'deux numéros différents restent deux offres',
  P.canonicalKey(offre('CIC', EI('recrutement.cic.fr', 116245))) === cic,
  false
);

// La liste des hôtes est CLOSE. Un autre client du même moteur aurait sa
// propre numérotation : l'y inclure ne coûterait pas un doublon mais une
// offre PERDUE, deux annonces sans rapport se fondant l'une dans l'autre.
const etranger = P.canonicalKey(offre('Maison X', EI('recrutement.autre-maison.fr', 116238)));
verifier('un hôte hors liste garde la clé employeur|titre|lieu', etranger, 'maison x|analyste rse esg|paris');
verifier('  et ne se confond donc pas avec le CIC', etranger === cic, false);

// Le reste du catalogue est intact : la règle ne vaut que pour ce moteur.
const thales = P.canonicalKey({
  emp: 'Thales',
  title: 'Zenith Business Data Analyst Finance',
  loc: 'Vélizy-Villacoublay',
  url: 'https://thales.wd3.myworkdayjobs.com/en-US/Careers/job/x_R0309466',
});
verifier('une offre Workday garde sa clé normale', /^thales\|/.test(thales), true);

// --- Ce qui ne doit pas FAIRE TOMBER le passage ---------------------------
// `canonicalKey` est appelée sur chaque offre de la récolte : une adresse
// absente ou malformée doit rendre une clé, pas lever une exception.
for (const [libelle, url] of [['absente', undefined], ['vide', ''], ['malformée', 'pas une url']]) {
  let rendu;
  try {
    rendu = P.canonicalKey({ emp: 'A', title: 'B', loc: 'C', url });
  } catch (e) {
    rendu = 'EXCEPTION ' + e.message;
  }
  verifier(`une adresse ${libelle} rend une clé sans lever`, typeof rendu === 'string' && rendu.startsWith('a|'), true);
}

const total = 10;
console.log(`${total - echecs}/${total} clés de déduplication conformes`);
if (echecs) process.exitCode = 1;
