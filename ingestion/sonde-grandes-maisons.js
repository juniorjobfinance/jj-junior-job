#!/usr/bin/env node
// ingestion/sonde-grandes-maisons.js
//
// Sondeur "grands comptes". Les maisons qui recrutent le plus de juniors en
// France (banques, Big 4, CAC 40, assureurs) n'utilisent PAS les ATS à
// identifiant devinable (Greenhouse, Lever...) que detect-ats.js sait trouver.
// Elles vivent sur des plateformes à tenant propre : Workday, TalentSoft,
// SuccessFactors, Cornerstone, Avature, Oracle Cloud. Le slug seul ne suffit
// pas — il faut essayer les motifs d'URL réellement utilisés par ces éditeurs.
//
// Ce script prend une liste "Nom | slugs alternatifs" et essaie, pour chaque
// entreprise, tous les motifs connus de chaque éditeur. Il ne conclut QUE sur
// une réponse qui contient réellement des offres, et il vérifie le robots.txt
// avant de valider. Sortie : lignes prêtes à coller dans TARGET_COMPANIES.
//
// Usage :
//   node ingestion/sonde-grandes-maisons.js --file ingestion/grandes-maisons.txt
//   node ingestion/sonde-grandes-maisons.js "PwC France|pwc" "Danone|danone"

'use strict';

const fs = require('fs');

const UA = 'Mozilla/5.0 (compatible; JJ job board; +https://example.org/jj)';
const TIMEOUT = 5000;

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

async function get(url, opts = {}) {
  try {
    return await fetch(url, {
      headers: { 'user-agent': UA, accept: '*/*', ...(opts.headers || {}) },
      method: opts.method || 'GET',
      body: opts.body,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    return null;
  }
}

// Un robots.txt qui interdit le chemin visé est un refus explicite : on n'y va
// pas, même si l'endpoint répond (cas KPMG, Groupama, Natixis).
const robotsCache = new Map();
async function robotsAutorise(host, chemin) {
  if (!robotsCache.has(host)) {
    const res = await get(`https://${host}/robots.txt`);
    robotsCache.set(host, res && res.ok ? (await res.text()).slice(0, 6000) : '');
  }
  const txt = robotsCache.get(host);
  if (!txt) return true;
  const bloc = txt.split(/user-agent:/i).find((b) => b.trim().startsWith('*')) || '';
  const interdits = [...bloc.matchAll(/disallow:\s*(\S*)/gi)].map((m) => m[1]).filter(Boolean);
  if (interdits.includes('/')) return false;
  return !interdits.some((d) => chemin.startsWith(d.replace(/\*.*$/, '')));
}

// --- Workday -----------------------------------------------------------------
// L'API publique est POST {host}/wday/cxs/{tenant}/{site}/jobs. Le tenant est
// souvent le slug, le nom du site l'est beaucoup moins : on essaie les formes
// les plus fréquentes. Le datacenter (wd1, wd3, wd5, wd103...) fait partie du
// domaine et n'est pas devinable autrement qu'en le testant.
const WD_DC = ['wd3', 'wd1', 'wd5', 'wd103', 'wd12', 'wd2'];
async function sondeWorkday(slug, variantesSite) {
  const sites = ['Careers', 'External', 'ExternalCareers', slug, `${slug}Careers`, 'Global', ...variantesSite];
  for (const dc of WD_DC) {
    const host = `${slug}.${dc}.myworkdayjobs.com`;
    // Une seule sonde par datacenter pour savoir s'il existe, avant de balayer
    // les noms de site : sinon on fait 6 x 8 requêtes pour rien.
    const sonde = await get(`https://${host}/wday/cxs/${slug}/Careers/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
    });
    if (!sonde) continue;
    if (sonde.status === 404 && !sonde.headers.get('x-wd-tenant')) {
      // Le domaine existe (pas d'erreur réseau) mais pas ce site : on balaie.
    } else if (!sonde.ok) {
      continue;
    }
    for (const site of [...new Set(sites)]) {
      const res = await get(`https://${host}/wday/cxs/${slug}/${site}/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: 'finance' }),
      });
      if (!res || !res.ok) continue;
      const j = await res.json().catch(() => null);
      if (!j || !Array.isArray(j.jobPostings)) continue;
      return {
        ats: 'workday',
        ligne: `{ tenant: '${slug}', dc: '${dc}', site: '${site}', emp: '%EMP%' }`,
        n: j.total ?? j.jobPostings.length,
        exemple: j.jobPostings[0]?.title,
      };
    }
  }
  return null;
}

// --- TalentSoft (Cegid) ------------------------------------------------------
async function sondeTalentSoft(slug, extra) {
  const hosts = [
    `${slug}-recrute.talent-soft.com`,
    `${slug}.talent-soft.com`,
    `recrutement.${slug}.com`,
    `recrutement.${slug}.fr`,
    `jobs.${slug}.com`,
    `carrieres.${slug}.com`,
    ...extra.map((s) => `${s}-recrute.talent-soft.com`),
    ...extra.map((s) => `${s}.talent-soft.com`),
  ];
  for (const host of [...new Set(hosts)]) {
    const res = await get(`https://${host}/offre-de-emploi/liste-offres.aspx`);
    if (!res || !res.ok) continue;
    const html = await res.text();
    const n = (html.match(/offre-de-emploi\/emploi-/g) || []).length;
    if (n === 0) continue;
    if (!(await robotsAutorise(host, '/offre-de-emploi/'))) return { ats: 'talentsoft', interdit: host };
    return { ats: 'talentsoft', ligne: `{ host: '${host}', emp: '%EMP%' }`, n };
  }
  return null;
}

// --- SAP SuccessFactors ------------------------------------------------------
async function sondeSuccessFactors(slug, extra) {
  const hosts = [`careers.${slug}.com`, `jobs.${slug}.com`, `careers.${slug}.fr`, `jobs.${slug}.fr`,
    ...extra.flatMap((s) => [`careers.${s}.com`, `jobs.${s}.com`])];
  for (const host of [...new Set(hosts)]) {
    for (const tenant of [slug, 'careers', 'external', '']) {
      const chemin = tenant ? `/${tenant}/search/` : '/search/';
      const res = await get(`https://${host}${chemin}?q=&locationsearch=France`);
      if (!res || !res.ok) continue;
      const html = await res.text();
      const n = (html.match(/jobTitle-link/g) || []).length;
      if (n === 0) continue;
      if (!(await robotsAutorise(host, chemin))) return { ats: 'successfactors', interdit: host };
      return { ats: 'successfactors', ligne: `{ host: '${host}', tenant: '${tenant}', emp: '%EMP%' }`, n };
    }
  }
  return null;
}

// --- Cornerstone OnDemand ----------------------------------------------------
// Endpoint public : {slug}.csod.com/ux/ats/careersite/{n}/home/requisitions
async function sondeCornerstone(slug, extra) {
  for (const s of [...new Set([slug, ...extra])]) {
    const host = `${s}.csod.com`;
    for (const site of [1, 2, 4, 5]) {
      const res = await get(
        `https://${host}/services/x/career-site/v1/search?type=Career%20Site&careerSiteId=${site}&pageSize=10&cultureId=1`,
        { headers: { accept: 'application/json' } }
      );
      if (!res || !res.ok) continue;
      const j = await res.json().catch(() => null);
      const jobs = j?.data?.requisitions;
      if (!Array.isArray(jobs) || jobs.length === 0) continue;
      if (!(await robotsAutorise(host, '/ux/ats/'))) return { ats: 'cornerstone', interdit: host };
      return {
        ats: 'cornerstone',
        ligne: `{ host: '${host}', site: ${site}, emp: '%EMP%' }`,
        n: j.data.totalCount ?? jobs.length,
        exemple: jobs[0]?.requisition?.displayJobTitle,
      };
    }
  }
  return null;
}

// --- Oracle Cloud HCM --------------------------------------------------------
async function sondeOracle(slug, extra) {
  const hosts = [...new Set([slug, ...extra])].flatMap((s) => [
    `${s}.fa.em2.oraclecloud.com`, `${s}.fa.em3.oraclecloud.com`, `${s}.fa.ocs.oraclecloud.com`,
  ]);
  for (const host of hosts) {
    for (const site of ['CX_1', 'CX_1001', 'CX_2']) {
      const url =
        `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
        `?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${site},limit=10`;
      const res = await get(url, { headers: { accept: 'application/json' } });
      if (!res || !res.ok) continue;
      const j = await res.json().catch(() => null);
      const liste = j?.items?.[0]?.requisitionList;
      if (!Array.isArray(liste) || liste.length === 0) continue;
      return {
        ats: 'oraclecloud',
        ligne: `{ host: '${host}', site: '${site}', emp: '%EMP%' }`,
        n: j.items[0].TotalJobsCount ?? liste.length,
        exemple: liste[0]?.Title,
      };
    }
  }
  return null;
}

// --- SmartRecruiters (identifiant parfois différent du slug) ------------------
async function sondeSmartRecruiters(slug, extra) {
  for (const s of [...new Set([slug, ...extra])]) {
    const res = await get(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=10&country=fr`);
    if (!res || !res.ok) continue;
    const j = await res.json().catch(() => null);
    if (!j || !j.totalFound) continue;
    return { ats: 'smartrecruiters', ligne: `{ id: '${s}', emp: '%EMP%' }`, n: j.totalFound, exemple: j.content?.[0]?.name };
  }
  return null;
}

const SONDES = [sondeWorkday, sondeSmartRecruiters, sondeTalentSoft, sondeSuccessFactors, sondeCornerstone, sondeOracle];

async function sonder(entree) {
  // Format : "Nom affiché | slug1, slug2, ... | SiteWorkday1, SiteWorkday2"
  const [nom, slugsBruts = '', sitesBruts = ''] = entree.split('|').map((s) => s.trim());
  const extra = slugsBruts ? slugsBruts.split(/\s*,\s*/).filter(Boolean) : [];
  const sites = sitesBruts ? sitesBruts.split(/\s*,\s*/).filter(Boolean) : [];
  const slug = extra[0] || slugify(nom);
  const autres = extra.slice(1);

  for (const sonde of SONDES) {
    const r = sonde === sondeWorkday ? await sonde(slug, sites) : await sonde(slug, autres);
    if (r) return { nom, ...r };
    // Workday mérite un 2e essai sur les slugs alternatifs.
    if (sonde === sondeWorkday) {
      for (const s of autres) {
        const r2 = await sondeWorkday(s, sites);
        if (r2) return { nom, ...r2 };
      }
    }
  }
  return { nom, ats: null };
}

async function main() {
  const args = process.argv.slice(2);
  let entrees;
  if (args[0] === '--file') {
    entrees = fs
      .readFileSync(args[1], 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } else {
    entrees = args;
  }
  if (!entrees.length) {
    console.log('Usage : node ingestion/sonde-grandes-maisons.js --file <liste.txt>');
    process.exit(1);
  }

  // Les sondes d'une même entreprise restent séquentielles : on ne martèle
  // jamais un même hôte. En revanche on traite plusieurs entreprises de front,
  // ce sont des domaines différents — sinon un balayage de 65 maisons prend des
  // heures, l'essentiel du temps étant passé en délais d'attente.
  const CONCURRENCE = 5;
  const file = entrees.slice();
  const resultats = [];
  let faits = 0;

  await Promise.all(
    Array.from({ length: CONCURRENCE }, async () => {
      while (file.length) {
        const r = await sonder(file.shift());
        faits++;
        const tete = '[' + faits + '/' + entrees.length + ']';
        if (r.interdit) {
          console.log(tete + ' INTERDIT ' + r.nom + ' -> ' + r.ats + ' (' + r.interdit + ') robots.txt refuse');
        } else if (r.ats) {
          console.log(tete + ' TROUVE  ' + r.nom + ' -> ' + r.ats + ' (' + r.n + ' offres) ' + (r.exemple ? '« ' + r.exemple + ' »' : ''));
          resultats.push(r);
        } else {
          console.log(tete + ' rien    ' + r.nom);
        }
      }
    })
  );

  const trouves = {};
  for (const r of resultats) {
    (trouves[r.ats] = trouves[r.ats] || []).push(r.ligne.replace('%EMP%', r.nom.replace(/'/g, "\\'")));
  }

  console.log('\n===== ' + resultats.length + ' lignes à coller dans TARGET_COMPANIES =====');
  for (const [ats, lignes] of Object.entries(trouves)) {
    console.log('  ' + ats + ': [');
    for (const l of lignes) console.log('    ' + l + ',');
    console.log('  ],');
  }
  console.log("\nÀ VÉRIFIER avec ingestion/verifier-ats.js avant de garder : un slug qui répond");
  console.log("n'est pas forcément la bonne entreprise.");
}

main();
