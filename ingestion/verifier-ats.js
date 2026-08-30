#!/usr/bin/env node
// ingestion/verifier-ats.js
//
// Garde-fou du détecteur : une correspondance de slug ne prouve PAS qu'on est
// tombé sur la bonne entreprise. "air" peut être n'importe qui, pas forcément
// Air Liquide ; "cic" idem. Ce script interroge chaque piste et affiche le NOM
// réel déclaré par la plateforme, pour qu'on puisse confirmer ou écarter.
//
// Usage : node ingestion/verifier-ats.js <ats> <slug> [<ats> <slug> ...]
//   node ingestion/verifier-ats.js teamtailor air lever cic greenhouse oliver

'use strict';

async function nameFor(ats, slug) {
  try {
    if (ats === 'greenhouse') {
      // L'endpoint "boards" expose le nom de l'entreprise du board.
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}`);
      if (!r.ok) return null;
      const j = await r.json();
      return { name: j.name, sample: null };
    }
    if (ats === 'lever') {
      const r = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      if (!r.ok) return null;
      const j = await r.json();
      const first = (j || [])[0] || {};
      // Lever n'expose pas le nom : on s'appuie sur l'URL et un intitulé témoin.
      return { name: `(lever/${slug})`, sample: `${first.text || '?'} — ${first.categories?.location || '?'}` };
    }
    if (ats === 'recruitee') {
      const r = await fetch(`https://${slug}.recruitee.com/api/offers/`);
      if (!r.ok) return null;
      const j = await r.json();
      const first = (j.offers || [])[0] || {};
      return { name: first.company_name || `(recruitee/${slug})`, sample: `${first.title || '?'} — ${first.city || '?'}, ${first.country || '?'}` };
    }
    if (ats === 'teamtailor') {
      const r = await fetch(`https://${slug}.teamtailor.com/jobs.json`);
      if (!r.ok) return null;
      const j = await r.json();
      const first = (j.items || [])[0] || {};
      const loc = ((first._jobposting || {}).jobLocation || [])[0] || {};
      const addr = loc.address || {};
      return { name: j.title, sample: `${first.title || '?'} — ${addr.addressLocality || '?'}, ${addr.addressCountry || '?'}` };
    }
    if (ats === 'ashby') {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      if (!r.ok) return null;
      const j = await r.json();
      const first = (j.jobs || [])[0] || {};
      // Ashby n'expose pas le nom de la société : on s'appuie sur l'URL de
      // l'annonce (qui contient le vrai nom du board) et un intitulé témoin.
      return {
        name: (first.jobUrl || `(ashby/${slug})`).replace(/^https?:\/\//, '').split('/').slice(0, 2).join('/'),
        sample: `${first.title || '?'} — ${first.location || '?'}`,
      };
    }
    if (ats === 'smartrecruiters') {
      const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=1`);
      if (!r.ok) return null;
      const j = await r.json();
      const first = (j.content || [])[0] || {};
      return { name: first.company?.name || `(smartrecruiters/${slug})`, sample: `${first.name || '?'} — ${first.location?.city || '?'}, ${first.location?.country || '?'}` };
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const pairs = [];
  for (let i = 0; i < args.length; i += 2) pairs.push([args[i], args[i + 1]]);

  for (const [ats, slug] of pairs) {
    const info = await nameFor(ats, slug);
    if (!info) {
      console.log(`${ats.padEnd(16)} ${slug.padEnd(24)} -> INACCESSIBLE`);
      continue;
    }
    console.log(`${ats.padEnd(16)} ${slug.padEnd(24)} -> "${info.name}"`);
    if (info.sample) console.log(`${''.padEnd(42)}ex: ${info.sample}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
