#!/usr/bin/env node
// ingestion/detect-workday.js
//
// Détecteur Workday. Workday est l'ATS dominant chez les grands groupes
// français (Sanofi, Airbus, Air Liquide sont déjà branchés via lui), mais son
// adressage n'est pas devinable à partir du seul nom : il faut un TENANT, un
// datacenter (wd1/wd3/wd5/wd103...) ET un nom de "site" carrières, tous trois
// choisis par l'entreprise.
//
// Attention : le DNS de myworkdayjobs.com répond pour n'importe quel
// sous-domaine (HTTP 406), donc "le host répond" ne prouve RIEN. Seule preuve
// valable : l'API cxs renvoie du JSON avec un compteur d'offres.
//
// Usage : node ingestion/detect-workday.js totalenergies loreal kering

'use strict';

const DCS = ['wd1', 'wd3', 'wd5', 'wd2', 'wd101', 'wd103'];

// Noms de site les plus courants. Le site ne dérive PAS toujours du tenant :
// Michelin utilise le tenant "michelinhr" mais le site "Michelin", Airbus le
// tenant "ag" et le site "Airbus". D'où la possibilité de passer une marque en
// plus du tenant (syntaxe "tenant:Marque") pour élargir les candidats.
function siteCandidates(tenant, brand) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const bases = [...new Set([tenant, brand].filter(Boolean).map(cap))];
  const out = ['External', 'ExternalCareers', 'Careers', 'careers', 'External_Career_Site'];
  for (const B of bases) {
    out.push(B, `${B}Careers`, `${B}_Careers`, `${B}External`, `${B}ExternalCareer`, `${B}ExternalCareers`);
  }
  return [...new Set(out)];
}

async function tryCombo(tenant, dc, site) {
  const url = `https://${tenant}.${dc}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (typeof json.total !== 'number') return null;
    return { tenant, dc, site, total: json.total };
  } catch {
    return null;
  }
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

async function detect(tenant, brand) {
  const combos = [];
  for (const dc of DCS) for (const site of siteCandidates(tenant, brand)) combos.push({ dc, site });
  const hits = (await pool(combos, 10, ({ dc, site }) => tryCombo(tenant, dc, site))).filter(Boolean);
  // Dédoublonne : le même site répond parfois sur plusieurs datacenters.
  const seen = new Set();
  return hits.filter((h) => {
    const k = `${h.site}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function main() {
  const tenants = process.argv.slice(2);
  if (tenants.length === 0) {
    console.error('Usage : node ingestion/detect-workday.js <tenant> [tenant...]');
    process.exit(1);
  }

  for (const raw of tenants) {
    // Syntaxe acceptée : "tenant" ou "tenant:Marque"
    const [t, brand] = raw.split(':');
    const hits = await detect(t, brand);
    if (hits.length === 0) {
      console.log(`${t.padEnd(22)} -> rien (tenant/site différent, ou pas sur Workday)`);
      continue;
    }
    for (const h of hits) {
      console.log(
        `${t.padEnd(22)} -> OK  { tenant: '${h.tenant}', dc: '${h.dc}', site: '${h.site}', emp: '__NOM__' }   // ${h.total} offres`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
