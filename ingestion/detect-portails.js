#!/usr/bin/env node
// ingestion/detect-portails.js
//
// Sondeur des plateformes carrières "grands comptes" : SuccessFactors,
// TalentSoft et Phenom. Contrairement aux ATS de type Greenhouse/Lever
// (identifiant unique devinable), celles-ci vivent sur un domaine propre à
// l'entreprise. On teste donc les motifs d'URL les plus répandus.
//
// IMPORTANT : le script vérifie le robots.txt AVANT de conclure. Un domaine qui
// répond mais dont le robots.txt interdit l'accès est signalé comme INTERDIT et
// ne doit pas être ajouté à TARGET_COMPANIES (cas rencontré avec KPMG).
//
// Usage : node ingestion/detect-portails.js --file ingestion/entreprises4.txt

'use strict';

function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

async function head(url, timeout = 8000) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    return res;
  } catch {
    return null;
  }
}

// Un robots.txt qui interdit la racine (ou le chemin visé) = refus explicite.
async function robotsAutorise(host, chemin) {
  const res = await head(`https://${host}/robots.txt`, 6000);
  if (!res || !res.ok) return true; // pas de robots.txt = pas de restriction
  const txt = (await res.text()).slice(0, 4000);
  // On ne lit que le bloc "User-agent: *"
  const bloc = txt.split(/user-agent:/i).find((b) => b.trim().startsWith('*')) || '';
  const interdits = [...bloc.matchAll(/disallow:\s*(\S*)/gi)].map((m) => m[1]);
  if (interdits.includes('/')) return false;
  return !interdits.some((d) => d && d !== '/' && chemin.startsWith(d.replace(/\*/g, '')));
}

async function testSuccessFactors(name) {
  const s = slug(name);
  const hosts = [`careers.${s}.com`, `jobs.${s}.com`, `careers.${s}.fr`, `jobs.${s}.fr`];
  for (const host of hosts) {
    for (const tenant of [s, 'careers', 'external']) {
      const res = await head(`https://${host}/${tenant}/search/?q=&locationsearch=France`);
      if (!res || !res.ok) continue;
      const html = await res.text();
      const n = (html.match(/jobTitle-link/g) || []).length;
      if (n === 0) continue;
      const ok = await robotsAutorise(host, `/${tenant}/search/`);
      return { plateforme: 'successfactors', host, tenant, offres: n, autorise: ok };
    }
  }
  return null;
}

async function testTalentSoft(name) {
  const s = slug(name);
  const hosts = [`${s}-recrute.talent-soft.com`, `${s}.talent-soft.com`, `recrutement-${s}.talent-soft.com`];
  for (const host of hosts) {
    const res = await head(`https://${host}/offre-de-emploi/liste-offres.aspx?LCID=1036`);
    if (!res || !res.ok) continue;
    const html = await res.text();
    const n = (html.match(/\/offre-de-emploi\/emploi[^"]+\.aspx/g) || []).length;
    if (n === 0) continue;
    const ok = await robotsAutorise(host, '/offre-de-emploi/');
    return { plateforme: 'talentsoft', host, offres: n, autorise: ok };
  }
  return null;
}

async function testPhenom(name) {
  const s = slug(name);
  const hosts = [`careers.${s}.com`, `jobs.${s}.com`, `careers.${s}.fr`];
  for (const host of hosts) {
    const res = await head(`https://${host}/api/jobs?country=France&limit=1`);
    if (!res || !res.ok) continue;
    try {
      const j = await res.json();
      if (typeof j.totalCount !== 'number' || j.totalCount === 0) continue;
      const ok = await robotsAutorise(host, '/api/jobs');
      return { plateforme: 'phenom', host, offres: j.totalCount, autorise: ok };
    } catch {
      continue;
    }
  }
  return null;
}

async function pool(items, limit, worker) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await worker(items[k]);
      }
    })
  );
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const fi = args.indexOf('--file');
  const noms =
    fi !== -1
      ? require('fs')
          .readFileSync(args[fi + 1], 'utf8')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
      : args;

  let n = 0;
  const trouves = [];
  await pool(noms, 5, async (nom) => {
    const r =
      (await testSuccessFactors(nom)) || (await testTalentSoft(nom)) || (await testPhenom(nom));
    n++;
    if (r) {
      trouves.push({ nom, ...r });
      console.log(
        `[${n}/${noms.length}] ${r.autorise ? 'TROUVE ' : 'INTERDIT'} ${nom} -> ${r.plateforme} ${r.host} (${r.offres})`
      );
    }
    if (n % 20 === 0) console.error(`  ... ${n}/${noms.length}`);
  });

  console.log(`\n===== ${trouves.length} portails sur ${noms.length} =====\n`);
  for (const t of trouves.filter((x) => x.autorise)) {
    if (t.plateforme === 'successfactors')
      console.log(`  { host: '${t.host}', tenant: '${t.tenant}', emp: '${t.nom}' },   // ${t.offres}`);
    else console.log(`  { host: '${t.host}', emp: '${t.nom}' },   // ${t.plateforme} ${t.offres}`);
  }
  const refuses = trouves.filter((x) => !x.autorise);
  if (refuses.length) {
    console.log('\n--- Portails existants mais INTERDITS par robots.txt (ne pas ajouter) ---');
    refuses.forEach((t) => console.log(`  ${t.nom} : ${t.host}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
