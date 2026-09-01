#!/usr/bin/env node
// ingestion/valider-maisons.js
//
// VALIDATEUR — le garde-fou entre la détection et la mise en production.
//
// Un sondeur peut se tromper de trois façons, toutes rencontrées :
//   - il suit un lien « carrières » qui mène au PORTEFEUILLE du fonds et non au
//     fonds lui-même (Alven renvoyait vers Concord, Sagard vers Portage) ;
//   - il prend un segment d'URL pour un identifiant (« fr-FR » lu comme le nom
//     du site Workday de la Banque de France, qui répond 404) ;
//   - il capte le domaine de la plateforme au lieu du client (« www » et
//     « app » lus comme des slugs Teamtailor).
//
// Une configuration fausse ne casse rien : elle rend zéro offre en silence, et
// la maison paraît branchée alors qu'elle ne l'est pas. On appelle donc le VRAI
// connecteur, avec la configuration proposée, et on regarde ce qui sort — le
// nombre d'offres, et surtout les lieux, parce qu'une maison qui ne recrute
// qu'à New York n'a rien à faire sur JJ.
//
// Usage : node ingestion/valider-maisons.js ingestion/candidats.json
//
// Le fichier est un tableau d'objets { plateforme, config }.

'use strict';

const src = require('./sources.js');

const CONNECTEURS = {
  workday: src.fetchWorkday,
  oraclecloud: src.fetchOracleCloud,
  successfactors: src.fetchSuccessFactors,
  talentsoft: src.fetchTalentSoft,
  talentlink: src.fetchTalentLink,
  talentview: src.fetchTalentView,
  cornerstone: src.fetchCornerstone,
  ashby: src.fetchAshby,
  teamtailor: src.fetchTeamtailor,
  recruitee: src.fetchRecruitee,
  phenom: src.fetchPhenom,
  avature: src.fetchAvature,
};

// Le lieu se cache sous un nom différent dans chaque API.
function lieuDe(raw) {
  const brut =
    raw.locationsText || raw.location || raw.city || raw.primaryLocation ||
    raw.Location || raw.ville || (raw.workplace && raw.workplace.city) || '';
  return String(brut).replace(/\s+/g, ' ').trim().slice(0, 40);
}

function titreDe(raw) {
  return String(raw.title || raw.name || raw.Title || raw.titre || raw.jobTitle || '?').slice(0, 58);
}

const FRANCE_RE = /france|paris|lyon|lille|nantes|bordeaux|marseille|toulouse|nice|strasbourg|rennes|montpellier|défense|courbevoie|puteaux|nanterre|levallois|montrouge|issy/i;

(async () => {
  const fichier = process.argv[2];
  if (!fichier) {
    console.error('usage : node ingestion/valider-maisons.js <candidats.json>');
    process.exit(1);
  }
  const candidats = JSON.parse(require('fs').readFileSync(fichier, 'utf8'));

  const retenus = [];
  for (const { plateforme, config } of candidats) {
    const fn = CONNECTEURS[plateforme];
    if (!fn) {
      console.log(`${String(config.emp).padEnd(22)} PLATEFORME NON LUE : ${plateforme}`);
      continue;
    }
    try {
      const offres = await fn(config);
      const lieux = offres.map((o) => lieuDe(o.raw)).filter(Boolean);
      const enFrance = lieux.filter((l) => FRANCE_RE.test(l)).length;
      const verdict = offres.length === 0 ? 'VIDE' : enFrance === 0 ? 'aucune en France' : `${enFrance} en France`;
      console.log(`${String(config.emp).padEnd(22)} ${String(offres.length).padStart(4)} offres | ${verdict}`);
      offres.slice(0, 3).forEach((o) => console.log(`     ${lieuDe(o.raw).padEnd(22)} ${titreDe(o.raw)}`));
      if (enFrance > 0) retenus.push({ plateforme, config, offres: offres.length, enFrance });
    } catch (e) {
      console.log(`${String(config.emp).padEnd(22)} ÉCHEC : ${e.message.slice(0, 60)}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n--- ${retenus.length} maison(s) à brancher (offres réelles en France) ---`);
  for (const r of retenus) {
    console.log(`  ${r.plateforme.padEnd(16)} ${JSON.stringify(r.config)}  // ${r.enFrance} en France`);
  }
})();
