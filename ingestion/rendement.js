// ---------------------------------------------------------------------------
// Rendement — ce que chaque source rapporte vraiment
// ---------------------------------------------------------------------------
//
// L'entonnoir (ingestion/entonnoir.js) répond pour UNE maison. Ce script pose
// la même question à TOUTES en une seule collecte, et classe les sources par
// ce qu'elles perdent.
//
// Il existe parce que les pannes du projet sont silencieuses. Une source peut
// tourner chaque matin et ne rien publier, pour cinq raisons différentes, sans
// qu'aucune ne s'affiche :
//
//   - la maison n'est pas dans maisons.txt          (EDF, Euronext : tout jeté)
//   - le connecteur pointe dans le vide             (Accenture sur wd3 : 422)
//   - la pagination s'arrête à la première page     (Workday : total: 0)
//   - le lieu n'est pas reconnu                     (Saint-Quentin-en-Yvelines)
//   - le contrat est deviné au lieu d'être lu       (alternances rangées en CDI)
//
// Chacune de ces cinq causes a été trouvée à la main le 2 septembre 2026, une
// maison à la fois. Ce script les aurait toutes montrées en un passage.
//
// Usage :
//     node ingestion/rendement.js              # toutes les sources
//     node ingestion/rendement.js muettes      # seulement celles qui rendent 0
//
// Le passage complet demande une quinzaine de minutes : il interroge les mêmes
// sources que le pipeline, une seule fois, avec la même courtoisie.
// ---------------------------------------------------------------------------
const { chargerPipeline } = require('./atelier');
const sources = require('./sources');

async function mesurer() {
  const P = chargerPipeline();
  const brutes = await sources.fetchAllSources();

  // Une ligne par source, au sens du pipeline : « workday:bdf », « liste:EDF ».
  const parSource = new Map();
  const compteur = (nom) => {
    if (!parSource.has(nom)) {
      parSource.set(nom, { collectees: 0, normalisees: 0, publiables: 0, volets: {}, emp: new Set() });
    }
    return parSource.get(nom);
  };

  for (const item of brutes) {
    const c = compteur(String(item.__src || '?'));
    c.collectees++;
    const offre = P.normalize(item);
    if (!offre) continue;
    c.normalisees++;
    // Le VIE échappe au filtre des grandes villes — il est à l'étranger par
    // nature. Le pipeline fait cette exception ; sans elle, cet outil
    // annonçait « 117 collectées, 1 publiable » pour une source qui en publie
    // quatre-vingt-dix.
    if (offre.volet !== 'vie' && !P.estGrandeVille(offre.loc)) continue;
    c.publiables++;
    c.emp.add(offre.emp);
    c.volets[offre.volet] = (c.volets[offre.volet] || 0) + 1;
  }

  return parSource;
}

function afficher(parSource, seulementMuettes) {
  const lignes = [...parSource.entries()]
    .map(([nom, c]) => ({ nom, ...c }))
    .sort((a, b) => b.collectees - a.collectees);

  const muettes = lignes.filter((l) => l.publiables === 0);
  const total = lignes.reduce((n, l) => n + l.collectees, 0);
  const publiables = lignes.reduce((n, l) => n + l.publiables, 0);

  console.log(`\n${lignes.length} sources · ${total} offres collectées · ${publiables} publiables\n`);

  console.log(`--- ${muettes.length} sources qui ne publient RIEN ---`);
  console.log('  collectées  source');
  for (const l of muettes.sort((a, b) => b.collectees - a.collectees)) {
    // Une source qui collecte beaucoup et ne publie rien est le cas le plus
    // suspect : elle marche, et quelque chose en aval la vide.
    const marque = l.collectees >= 20 ? '  <-- à regarder' : '';
    console.log('  ' + String(l.collectees).padStart(9) + '  ' + l.nom.padEnd(38) + marque);
  }

  if (seulementMuettes) return;

  console.log('\n--- rendement des sources qui publient ---');
  console.log('  collectées  publiables  perte   source');
  for (const l of lignes.filter((x) => x.publiables > 0)) {
    const perte = l.collectees ? Math.round((100 * (l.collectees - l.publiables)) / l.collectees) : 0;
    const detail = Object.entries(l.volets)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    console.log(
      '  ' +
        String(l.collectees).padStart(9) +
        '  ' +
        String(l.publiables).padStart(10) +
        '  ' +
        String(perte + ' %').padStart(5) +
        '   ' +
        l.nom.padEnd(34) +
        detail
    );
  }
}

if (require.main === module) {
  mesurer()
    .then((r) => afficher(r, process.argv[2] === 'muettes'))
    .catch((err) => {
      console.error('[rendement] échec :', err.message);
      process.exitCode = 1;
    });
}

module.exports = { mesurer };
