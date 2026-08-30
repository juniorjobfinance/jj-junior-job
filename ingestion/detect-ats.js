#!/usr/bin/env node
// ingestion/detect-ats.js
//
// DÉTECTEUR D'ATS — l'outil qui permet de passer de 10 à 1000 entreprises.
//
// Principe (PROJET.md §7.4) : on ne code PAS un scraper par entreprise. On code
// un connecteur par TYPE de plateforme de recrutement (ATS), puis pour chaque
// entreprise on a juste besoin de savoir : quelle plateforme utilise-t-elle, et
// sous quel identifiant ? Ce script répond à cette question automatiquement.
//
// Il teste un nom d'entreprise (ou plusieurs variantes de "slug") contre tous
// les ATS à endpoint public qu'on sait lire, et affiche la ligne de
// configuration prête à coller dans TARGET_COMPANIES (sources.js).
//
// Usage :
//   node ingestion/detect-ats.js qonto
//   node ingestion/detect-ats.js "Edmond de Rothschild" ardian eurazeo
//
// Pour les ATS à tenant opaque (Workday, Oracle Cloud, Taleo), le slug ne suffit
// pas : il faut relever l'URL du site carrières de l'entreprise (le tenant y est
// visible). Le script le signale explicitement plutôt que de deviner.

'use strict';

// Mots vides qu'on retire pour former les slugs ("Groupe X" -> "x").
const STOP_WORDS = new Set(['groupe', 'group', 'sa', 'sas', 'france', 'partners', 'capital', 'et', 'de', 'la', 'le', 'du', 'des']);

// Génère les variantes de slug plausibles pour un nom d'entreprise.
function slugVariants(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const words = base.split(' ').filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));

  const variants = [
    base.replace(/ /g, ''),
    base.replace(/ /g, '-'),
    meaningful.join(''),
    meaningful.join('-'),
    meaningful[0],
  ];

  // Limité à 4 variantes distinctes : au-delà on multiplie les requêtes pour un
  // gain marginal (et on tape inutilement sur les API des plateformes).
  return [...new Set(variants.filter((v) => v && v.length >= 3))].slice(0, 4);
}

// Exécute des tâches avec un plafond de parallélisme, pour rester correct
// vis-à-vis des API interrogées lors d'un passage en masse.
async function pool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

const PROBES = [
  {
    ats: 'greenhouse',
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    count: (j) => (j.jobs || []).length,
    config: (s) => `{ token: '${s}', emp: '__NOM__' }`,
  },
  {
    ats: 'lever',
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    count: (j) => (Array.isArray(j) ? j.length : 0),
    config: (s) => `{ company: '${s}', emp: '__NOM__' }`,
  },
  {
    ats: 'recruitee',
    url: (s) => `https://${s}.recruitee.com/api/offers/`,
    count: (j) => (j.offers || []).length,
    config: (s) => `{ company: '${s}', emp: '__NOM__' }`,
  },
  {
    ats: 'teamtailor',
    url: (s) => `https://${s}.teamtailor.com/jobs.json`,
    count: (j) => (j.items || []).length,
    config: (s) => `{ company: '${s}', emp: '__NOM__' }`,
  },
  {
    ats: 'smartrecruiters',
    url: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings`,
    count: (j) => (typeof j.totalFound === 'number' ? j.totalFound : (j.content || []).length),
    config: (s) => `{ id: '${s}', emp: '__NOM__' }`,
    // SmartRecruiters répond 200 avec totalFound:0 pour N'IMPORTE quel nom, même
    // inexistant (vérifié). Un résultat à 0 n'y prouve donc rien : on ne le
    // remonte que s'il y a réellement des offres.
    ignoreWhenEmpty: true,
  },
  {
    ats: 'ashby',
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    count: (j) => (j.jobs || []).length,
    config: (s) => `{ company: '${s}', emp: '__NOM__' }`,
  },
  {
    ats: 'workable',
    url: (s) => `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`,
    count: (j) => (j.jobs || []).length,
    config: (s) => `{ company: '${s}', emp: '__NOM__' }`,
    // Workable renvoie du HTML (pas du JSON) pour des comptes inexistants et a
    // produit 100% de faux positifs lors du premier passage (BNP, Goldman,
    // JPMorgan "détectés" alors qu'ils n'y sont pas). Non probant à vide.
    ignoreWhenEmpty: true,
  },
];

async function probe(slug, p) {
  try {
    const res = await fetch(p.url(slug), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const n = p.count(json);
    if (typeof n !== 'number') return null;
    if (n === 0 && p.ignoreWhenEmpty) return null; // réponse non probante
    return { ats: p.ats, slug, jobs: n, config: p.config(slug) };
  } catch {
    return null;
  }
}

async function detect(name) {
  const slugs = slugVariants(name);
  const tasks = [];
  for (const slug of slugs) for (const p of PROBES) tasks.push({ slug, p });
  const hits = (await pool(tasks, 8, ({ slug, p }) => probe(slug, p))).filter(Boolean);

  // Un ATS qui répond avec 0 offre reste une piste valable (compte existant mais
  // rien d'ouvert aujourd'hui) : on les garde, mais après ceux qui ont du volume.
  hits.sort((a, b) => b.jobs - a.jobs);
  return hits;
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.indexOf('--file');
  let names;

  if (fileArg !== -1) {
    const fs = require('fs');
    names = fs
      .readFileSync(args[fileArg + 1], 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } else {
    names = args;
  }

  if (names.length === 0) {
    console.error('Usage : node ingestion/detect-ats.js "Nom Entreprise" [autre...]');
    console.error('   ou : node ingestion/detect-ats.js --file ingestion/entreprises.txt');
    process.exit(1);
  }

  const bulk = names.length > 20;
  const found = [];
  let done = 0;

  // En masse, on traite plusieurs entreprises de front (chacune limitant déjà
  // son propre parallélisme interne).
  await pool(names, bulk ? 6 : 1, async (name) => {
    const hits = await detect(name);
    done++;
    if (hits.length > 0) {
      found.push({ name, hits });
      if (bulk) {
        const best = hits[0];
        console.log(`[${done}/${names.length}] TROUVE  ${name} -> ${best.ats} (${best.jobs} offres)`);
      }
    } else if (!bulk) {
      console.log(`\n=== ${name} ===`);
      console.log("  aucun ATS public détecté (portail fermé, tenant opaque type Workday/Oracle/Taleo,");
      console.log("  ou slug différent) -> relever manuellement l'URL de leur site carrières.");
    }
    if (!bulk && hits.length > 0) {
      console.log(`\n=== ${name} ===`);
      for (const h of hits) {
        const flag = h.jobs > 0 ? 'OK ' : "(0 offre aujourd'hui) ";
        console.log(`  ${flag}${h.ats.padEnd(16)} ${String(h.jobs).padStart(4)} offres   ->  ${h.ats}: ${h.config.replace('__NOM__', name)}`);
      }
    }
    if (bulk && done % 25 === 0) console.error(`  ... ${done}/${names.length} traitées`);
  });

  if (bulk) {
    console.log(`\n\n===== RESULTAT : ${found.length} entreprises sur ${names.length} ont un ATS public =====\n`);
    const byAts = {};
    for (const { name, hits } of found) {
      const best = hits[0];
      (byAts[best.ats] = byAts[best.ats] || []).push({ name, ...best });
    }
    for (const [ats, list] of Object.entries(byAts)) {
      console.log(`\n  ${ats}: [`);
      list
        .sort((a, b) => b.jobs - a.jobs)
        .forEach((h) => console.log(`    ${h.config.replace('__NOM__', h.name.replace(/'/g, "\\'"))},   // ${h.jobs} offres`));
      console.log('  ],');
    }
  }
  console.log('\nColler les lignes voulues dans TARGET_COMPANIES (ingestion/sources.js).');
}

main().catch((err) => {
  console.error('Échec :', err);
  process.exitCode = 1;
});
