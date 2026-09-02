// ---------------------------------------------------------------------------
// Audit du catalogue publié — trois questions, posées au fichier en ligne
// ---------------------------------------------------------------------------
//
//   1. Chaque offre est-elle dans le bon onglet ? Un stage dans « Stage », une
//      alternance dans « Alternance », un CDI dans « CDI · CDD ».
//   2. Les CDI/CDD publiés sont-ils vraiment juniors, ou des postes confirmés
//      qui ont franchi le filtre ?
//   3. Les cartes sont-elles lisibles — un lieu, une date, un intitulé qui
//      nomme un métier ?
//
// Ces trois questions se posent sur le RÉSULTAT, pas sur le code. Un filtre
// peut être juste et laisser passer une offre mal étiquetée par sa source ;
// c'est ici qu'on le voit.
//
// Usage :
//     node ingestion/audit-catalogue.js            # le catalogue local
//     node ingestion/audit-catalogue.js --en-ligne # celui du dernier commit
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RACINE = path.join(__dirname, '..');

function catalogue(enLigne) {
  const texte = enLigne
    ? execSync('git show HEAD:offres.js', { cwd: RACINE, maxBuffer: 1e8 }).toString()
    : fs.readFileSync(path.join(RACINE, 'offres.js'), 'utf8');
  return JSON.parse(texte.slice(texte.indexOf('['), texte.lastIndexOf(']') + 1));
}

// --- 1. L'onglet -----------------------------------------------------------
// On ne juge que sur des mentions EXPLICITES dans l'intitulé ou l'adresse :
// c'est le seul signal indiscutable. Un intitulé muet n'est pas une erreur.
const DIT_STAGE = /\bstages?\b|\bstagiaires?\b|\binternships?\b|\bintern\b|summer analyst|off[- ]cycle/i;
const DIT_ALTERNANCE = /alternan|apprenti|apprenticeship|contrat de professionnalisation/i;
const DIT_CDI = /\bcdi\b|permanent contract/i;

function ongletAttendu(o) {
  const texte = `${o.title || ''} ${o.url || ''}`;
  // L'alternance passe avant le stage : « Stage ou alternance » est proposé aux
  // deux, et l'alternance est la mention la plus engageante des deux.
  if (DIT_ALTERNANCE.test(texte)) return 'alternance';
  if (DIT_STAGE.test(texte)) return 'stage';
  if (DIT_CDI.test(texte)) return 'cdi-cdd';
  return null; // l'intitulé ne dit rien : on ne se prononce pas
}

// --- 2. La séniorité des CDI/CDD -------------------------------------------
// Ce que le filtre 0-3 ans est censé avoir écarté. On relit les intitulés
// publiés pour vérifier qu'aucun grade senior n'a survécu.
const GRADE_SENIOR =
  /\bsenior\b|\bconfirm[ée]e?\b|\bexp[ée]riment[ée]e?\b|\bexpert\b|\bhead of\b|\bdirect(?:eur|rice|or)\b|\bmanager\b|\bresponsable\b|\bchef(?:fe)? de service\b|\bvice[- ]president\b|\bvp\b|\bprincipal\b|\blead\b|\bpartner\b|\bassoci[ée]e? (?:director|partner)\b/i;
// Protections : ces mots ne désignent pas un grade quand ils sont ainsi cadrés.
const FAUX_SENIOR =
  /junior|assistant|adjoint|stage|alternan|apprenti|\bintern\b|graduate|d[ée]butant|middle office|back office|front office|account manager|product manager|contract manager|asset manager|fund manager|community manager|lead buyer|leadership/i;

// --- 3. La lisibilité de la carte ------------------------------------------
const LIEU_VAGUE = /^(non pr[ée]cis[ée]|france|remote|t[ée]l[ée]travail)$/i;

function auditer(offres) {
  const malPlacees = [];
  const seniors = [];
  const sansLieu = [];
  const sansDate = [];
  const titresCourts = [];

  for (const o of offres) {
    const attendu = ongletAttendu(o);
    if (attendu && attendu !== o.volet && o.volet !== 'vie') {
      malPlacees.push({ o, attendu });
    }
    if (o.volet === 'cdi-cdd' && GRADE_SENIOR.test(o.title || '') && !FAUX_SENIOR.test(o.title || '')) {
      seniors.push(o);
    }
    if (LIEU_VAGUE.test(String(o.loc || ''))) sansLieu.push(o);
    if (!o.datePubFiable) sansDate.push(o);
    if (String(o.title || '').trim().length < 12) titresCourts.push(o);
  }

  return { malPlacees, seniors, sansLieu, sansDate, titresCourts };
}

function pourcent(n, total) {
  return `${n} (${((100 * n) / total).toFixed(1)} %)`;
}

if (require.main === module) {
  const offres = catalogue(process.argv.includes('--en-ligne'));
  const r = auditer(offres);
  const n = offres.length;

  console.log(`\n${n} offres auditées\n`);

  console.log(`--- 1. Onglet : ${pourcent(r.malPlacees.length, n)} mal placées ---`);
  for (const { o, attendu } of r.malPlacees.slice(0, 40)) {
    console.log(
      `  ${String(o.volet).padEnd(11)}-> ${String(attendu).padEnd(11)}${String(o.emp).slice(0, 18).padEnd(20)}${String(o.title).slice(0, 46)}`
    );
  }
  if (r.malPlacees.length > 40) console.log(`  … et ${r.malPlacees.length - 40} autres`);

  const cdi = offres.filter((o) => o.volet === 'cdi-cdd').length;
  console.log(`\n--- 2. Séniorité : ${r.seniors.length} sur ${cdi} CDI/CDD portent un grade senior ---`);
  for (const o of r.seniors.slice(0, 40)) {
    console.log(`  ${String(o.emp).slice(0, 20).padEnd(22)}${String(o.title).slice(0, 56)}`);
  }
  if (r.seniors.length > 40) console.log(`  … et ${r.seniors.length - 40} autres`);

  console.log(`\n--- 3. Lisibilité ---`);
  console.log(`  lieu vague       ${pourcent(r.sansLieu.length, n)}`);
  console.log(`  date incertaine  ${pourcent(r.sansDate.length, n)}`);
  console.log(`  intitulé < 12 c. ${pourcent(r.titresCourts.length, n)}`);
  if (r.titresCourts.length) {
    console.log('    ' + [...new Set(r.titresCourts.map((o) => `${o.emp} : ${o.title}`))].slice(0, 10).join('\n    '));
  }
}

module.exports = { catalogue, auditer, ongletAttendu };
