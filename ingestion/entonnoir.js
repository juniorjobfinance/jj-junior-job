// ---------------------------------------------------------------------------
// Entonnoir — où se perdent les offres d'une maison
// ---------------------------------------------------------------------------
//
// Une maison publie 800 offres sur son site et nous en montrons 48. Où sont
// passées les 752 autres ? Ce script le dit, poste par poste : il appelle le
// vrai connecteur, fait passer chaque offre par les vraies portes du pipeline
// (via ingestion/atelier.js), et compte les sorties par motif.
//
// C'est la méthode qui a fait gagner une centaine d'offres chez le Crédit
// Agricole : sur les 805 offres de leur site, l'entonnoir a montré que 93
// tombaient dans une rubrique qu'on ne demandait même pas, et que douze
// communes à nom composé étaient jugées « petites villes » à cause d'un
// découpage sur le tiret. Aucune de ces deux causes n'était visible autrement.
//
// Usage :
//     node ingestion/entonnoir.js                     # liste les maisons
//     node ingestion/entonnoir.js "BNP"               # l'entonnoir de BNP
//     node ingestion/entonnoir.js "BNP" detail        # + le titre de chaque rejet
//
// La lecture se fait en deux temps :
//   - « métier hors périmètre », « réseau », « séniorité » sont des rejets
//     VOULUS ; s'ils dominent, tout va bien.
//   - « commune non couverte », « maison inconnue », « aucune famille » sont
//     suspects : ce sont eux qui cachaient les défauts du Crédit Agricole.
// ---------------------------------------------------------------------------
const { chargerPipeline } = require('./atelier');
const sources = require('./sources');

// Chaque famille d'ATS a son connecteur ; on les indexe pour pouvoir rejouer
// n'importe quelle maison, pas seulement celles servies par une liste HTML —
// les plus grosses (Société Générale, Amundi, PwC, AXA) passent par un ATS.
const CONNECTEURS = {
  greenhouse: sources.fetchGreenhouse,
  lever: sources.fetchLever,
  smartrecruiters: sources.fetchSmartRecruiters,
  workday: sources.fetchWorkday,
  cornerstone: sources.fetchCornerstone,
  recruitee: sources.fetchRecruitee,
  oraclecloud: sources.fetchOracleCloud,
  eicards: sources.fetchEiCards,
  servicepublic: sources.fetchServicePublic,
  avature: sources.fetchAvature,
  radancy: sources.fetchRadancy,
  sitemapld: sources.fetchSitemapJsonLd,
  successfactors: sources.fetchSuccessFactors,
  talentsoft: sources.fetchTalentSoft,
  phenom: sources.fetchPhenom,
  ashby: sources.fetchAshby,
  teamtailor: sources.fetchTeamtailor,
};

// Toutes les sources rejouables, sous une forme commune :
// { emp, famille, lire } où lire() rend les offres brutes du connecteur.
function toutesLesSources() {
  const liste = [];
  for (const cfg of sources.LISTES_HTML || []) {
    liste.push({ emp: cfg.emp, famille: 'liste HTML', lire: () => sources.fetchListeHtml(cfg) });
  }
  for (const [famille, configs] of Object.entries(sources.TARGET_COMPANIES || {})) {
    const connecteur = CONNECTEURS[famille];
    if (!connecteur || !Array.isArray(configs)) continue;
    for (const cfg of configs) {
      liste.push({ emp: cfg.emp, famille, lire: () => connecteur(cfg) });
    }
  }
  return liste;
}

function decoder(s) {
  return String(s || '')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"');
}

async function entonnoir(src, detail) {
  const P = chargerPipeline();
  const brutes = await src.lire();
  const sorties = {};
  const compter = (motif, quoi) => (sorties[motif] = sorties[motif] || []).push(quoi);

  for (const item of brutes) {
    const raw = item.raw || {};
    const titre = decoder(raw.titre || raw.title);
    const entite = decoder(raw.entite || '');
    const etiquette = titre.slice(0, 62) + (entite ? '   [' + entite.slice(0, 24) + ']' : '');

    const offre = P.normalize({ __src: item.__src, emp: item.emp, raw: { ...raw, titre, entite } });
    if (offre) {
      compter('9. RETENUES', etiquette);
      continue;
    }

    // normalize a dit non : on rejoue ses portes pour nommer la coupable.
    const emp = P.normaliserEmployeur(entite || src.emp);
    if (!P.estUneOffreFinance(titre)) compter('1. métier hors périmètre', etiquette);
    else if (P.INTERMEDIAIRE_RE.test(raw.url || '')) compter('2. lien intermédiaire', etiquette);
    else if (P.inferFamille(titre, '', emp) === P.FAMILLE_HORS_PERIMETRE) compter('3. réseau / commercial', etiquette);
    else if (!P.trouverMaison(emp)) compter('4. MAISON INCONNUE — ' + emp, etiquette);
    else if (!P.titreNommeUnMetier(titre, emp)) compter('5. titre ne nomme aucun métier', etiquette);
    else compter('6. rejet non identifié', etiquette);
  }

  // La commune se juge APRÈS normalize, comme dans le pipeline.
  console.log(`\n${brutes.length} offres collectées chez ${src.emp} (${src.famille})\n`);
  for (const motif of Object.keys(sorties).sort()) {
    console.log(String(sorties[motif].length).padStart(5) + '  ' + motif);
  }
  if (detail) {
    for (const motif of Object.keys(sorties).sort()) {
      if (motif.startsWith('9.')) continue;
      console.log('\n--- ' + motif + ' ---');
      sorties[motif].forEach((x) => console.log('    ' + x));
    }
  }
}

async function principal() {
  const [motif, detail] = process.argv.slice(2);
  const toutes = toutesLesSources();
  if (!motif) {
    console.log(`${toutes.length} sources rejouables :\n`);
    for (const s of toutes) console.log('  ' + s.emp.padEnd(30) + s.famille);
    console.log('\nUsage : node ingestion/entonnoir.js "Nom" [detail]');
    return;
  }
  const choisies = toutes.filter((s) => new RegExp(motif, 'i').test(s.emp));
  if (!choisies.length) {
    console.error(`aucune source ne correspond à « ${motif} ».`);
    process.exitCode = 1;
    return;
  }
  for (const s of choisies) await entonnoir(s, detail === 'detail');
}

if (require.main === module) {
  principal().catch((err) => {
    console.error('[entonnoir] échec :', err.message);
    process.exitCode = 1;
  });
}

module.exports = { entonnoir };
