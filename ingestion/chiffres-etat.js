// ---------------------------------------------------------------------------
// Les chiffres d'ETAT.md, mesurés plutôt que recopiés
// ---------------------------------------------------------------------------
//
// ETAT.md doit être réécrit à chaque séance, et ses chiffres recopiés à la main
// se périment en une nuit — le catalogue change tous les matins à 06h30. Ce
// script les LIT dans offres.js et rend le bloc prêt à coller.
//
//     node ingestion/chiffres-etat.js
//
// Il ne modifie rien : c'est à l'auteur de la séance de choisir ce qu'il en
// garde et d'écrire le reste, qui ne se mesure pas.
const fs = require('fs');
const path = require('path');

function catalogue(racine = path.join(__dirname, '..')) {
  const src = fs.readFileSync(path.join(racine, 'offres.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
}

function chiffres(offres) {
  const parVolet = {};
  const employeurs = new Set();
  const maisons = new Set();
  const parFamille = {};
  const parStructure = {};
  let datees = 0;
  let plusVieille = 0;

  for (const o of offres) {
    parVolet[o.volet] = (parVolet[o.volet] || 0) + 1;
    if (o.emp) employeurs.add(o.emp);
    if (o.maison) maisons.add(o.maison);
    if (o.famille) parFamille[o.famille] = (parFamille[o.famille] || 0) + 1;
    if (o.sector) parStructure[o.sector] = (parStructure[o.sector] || 0) + 1;
    if (o.datePubFiable) {
      datees++;
      const j = Math.round((Date.now() - new Date(o.postedAt).getTime()) / 86400000);
      if (j > plusVieille) plusVieille = j;
    }
  }
  return { parVolet, employeurs, maisons, parFamille, parStructure, datees, plusVieille };
}

function pourcentages(table, total) {
  return Object.entries(table)
    .sort((a, b) => b[1] - a[1])
    .map(([nom, n]) => ({ nom, n, part: (100 * n) / total }));
}

if (require.main === module) {
  const offres = catalogue();
  const c = chiffres(offres);
  const total = offres.length;
  const ETIQUETTES = { stage: 'Stage', 'cdi-cdd': 'CDI · CDD', vie: 'VIE', alternance: 'Alternance' };

  console.log(`**${total} offres** · **${c.employeurs.size} employeurs** · **${c.maisons.size} maisons**\n`);
  console.log('| Onglet | Offres |');
  console.log('|---|---|');
  for (const [volet, n] of Object.entries(c.parVolet).sort((a, b) => b[1] - a[1])) {
    console.log(`| ${ETIQUETTES[volet] || volet} | ${n} |`);
  }

  console.log(`\n${c.datees}/${total} datées (${Math.round((100 * c.datees) / total)} %)`);
  console.log(`plus ancienne offre datée : ${c.plusVieille} jours`);

  const fam = pourcentages(c.parFamille, total);
  const str = pourcentages(c.parStructure, total);
  const bornes = (l) =>
    `${l.length} familles, de ${l[l.length - 1].part.toFixed(1)} % à ${l[0].part.toFixed(1)} %`;
  console.log(`\nFamilles métier — ${bornes(fam)}`);
  const residu = fam.find((f) => /^Autres m[ée]tiers/.test(f.nom));
  if (residu) console.log(`   résidu « ${residu.nom} » : ${residu.part.toFixed(1)} %`);
  console.log(`Types de structure — ${bornes(str)}`);

  const parMaison = {};
  for (const o of offres) parMaison[o.maison || o.emp] = (parMaison[o.maison || o.emp] || 0) + 1;
  const top = Object.entries(parMaison).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('\nDouze premières maisons :');
  for (const [nom, n] of top) console.log(`   ${String(n).padStart(4)}  ${nom}`);
}

module.exports = { catalogue, chiffres };
