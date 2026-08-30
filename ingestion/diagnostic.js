#!/usr/bin/env node
// ingestion/diagnostic.js
//
// Mesure l'entonnoir : combien d'offres chaque entreprise publie AU TOTAL sur
// sa plateforme, et combien il en reste après le filtre finance + le filtre
// France. Sert à répondre à "pourquoi si peu d'offres ?" avec des chiffres
// plutôt qu'avec des impressions.
//
// Usage : node ingestion/diagnostic.js

'use strict';

const { TARGET_COMPANIES } = require('./sources');

async function getJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Total brut publié par l'entreprise (tous pays, tous métiers).
async function totalFor(ats, c) {
  try {
    if (ats === 'greenhouse') {
      const j = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${c.token}/jobs`);
      return (j.jobs || []).length;
    }
    if (ats === 'lever') {
      const j = await getJSON(`https://api.lever.co/v0/postings/${c.company}?mode=json`);
      return (j || []).length;
    }
    if (ats === 'recruitee') {
      const j = await getJSON(`https://${c.company}.recruitee.com/api/offers/`);
      return (j.offers || []).length;
    }
    if (ats === 'teamtailor') {
      const j = await getJSON(`https://${c.company}.teamtailor.com/jobs.json`);
      return (j.items || []).length;
    }
    if (ats === 'smartrecruiters') {
      const j = await getJSON(`https://api.smartrecruiters.com/v1/companies/${c.id}/postings?limit=1`);
      return j.totalFound || 0;
    }
    if (ats === 'workday') {
      const j = await getJSON(
        `https://${c.tenant}.${c.dc}.myworkdayjobs.com/wday/cxs/${c.tenant}/${c.site}/jobs`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }) }
      );
      return j.total || 0;
    }
    if (ats === 'oraclecloud') {
      const j = await getJSON(
        `https://${c.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${c.site},limit=1`
      );
      return ((j.items || [])[0] || {}).TotalJobsCount || 0;
    }
    if (ats === 'opendatasoft') {
      const j = await getJSON(`https://${c.domain}/api/records/1.0/search/?dataset=${c.dataset}&rows=0`);
      return j.nhits || 0;
    }
  } catch {
    return null;
  }
  return null;
}

function label(ats, c) {
  return c.emp || c.company || c.id || c.token || c.tenant || c.domain;
}

async function main() {
  const sources = require('./sources');
  const kept = {};
  const all = await sources.fetchAllATS();
  for (const o of all) {
    const e = o.emp || '?';
    kept[e] = (kept[e] || 0) + 1;
  }

  console.log('ENTREPRISE                      TOTAL PUBLIÉ   RETENU (finance+France)');
  console.log('-'.repeat(74));

  let grandTotal = 0;
  let grandKept = 0;

  for (const [ats, list] of Object.entries(TARGET_COMPANIES)) {
    for (const c of list) {
      const name = label(ats, c);
      const total = await totalFor(ats, c);
      const k = kept[name] || 0;
      grandTotal += total || 0;
      grandKept += k;
      const pct = total ? ` (${Math.round((k / total) * 100)}%)` : '';
      console.log(
        `${name.slice(0, 30).padEnd(30)} ${String(total === null ? 'err' : total).padStart(8)}   ${String(k).padStart(8)}${pct}`
      );
    }
  }

  console.log('-'.repeat(74));
  console.log(`${'TOTAL'.padEnd(30)} ${String(grandTotal).padStart(8)}   ${String(grandKept).padStart(8)} (${Math.round((grandKept / grandTotal) * 100)}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
