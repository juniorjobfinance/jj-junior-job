#!/usr/bin/env node
// ingestion/test-vie.js
//
// SCRIPT DE TEST — n'écrit rien, ne touche ni au pipeline ni à offres.js.
// Affiche 10 offres VIE finance en console pour confirmer que l'API Business
// France (Mon VIE-VIA / Civiweb) répond, que les identifiants et les champs
// sont exploitables, et que le lien officiel est reconstructible.
//
// Usage : node ingestion/test-vie.js
//
// La clé X-API-KEY est celle que le frontend public de mon-vie-via.businessfrance.fr
// envoie en clair à chaque requête. Elle n'ouvre AUCUN espace privé : elle donne
// exactement l'accès public du site. On la met quand même en variable
// d'environnement, jamais en dur dans le code committé.

'use strict';

require('./env').chargerEnv();

const API = 'https://civiweb-api-prd.azurewebsites.net/api/Offers/search';
const FICHE_PUBLIQUE = (id) => `https://mon-vie-via.businessfrance.fr/offres/${id}`;
const API_KEY = process.env.VIE_API_KEY || '';

async function rechercheVie({ query = '', limit = 10, skip = 0 } = {}) {
  const corps = {
    limit,
    skip,
    query,
    activitySectorId: [],
    missionsTypesIds: [],
    missionsDurations: [],
    gerographicZones: [],
    countriesIds: [],
    studiesLevelId: [],
    companiesSizes: [],
    specializationsIds: [],
    entreprisesIds: [0],
    missionStartDate: null,
  };
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'X-API-KEY': API_KEY },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  if (!API_KEY) {
    console.error('VIE_API_KEY absente du .env — voir le message pour la valeur.');
    process.exit(1);
  }

  // On interroge quelques mots-clés finance : l'API n'a pas de facette
  // "spécialisation finance" fiable, on cible donc par vocabulaire, comme pour
  // Adzuna. Le classement fin sera fait par le pipeline plus tard.
  const motsCles = ['finance', 'audit', 'comptable', 'contrôle de gestion', 'trésorerie', 'trader', 'risque'];
  const parId = new Map();

  for (const q of motsCles) {
    try {
      const j = await rechercheVie({ query: q, limit: 50 });
      for (const o of j.result || []) parId.set(o.id, o);
      console.log(`  "${q}" → ${j.count} offres au total, ${(j.result || []).length} lues`);
    } catch (err) {
      console.log(`  "${q}" → ERREUR ${err.message}`);
    }
  }

  console.log(`\n${parId.size} offres VIE finance distinctes récupérées. Aperçu de 10 :\n`);

  let n = 0;
  for (const o of parId.values()) {
    if (n++ >= 10) break;
    console.log('─'.repeat(78));
    console.log(`  ${o.missionTitle}`);
    console.log(`  ${o.organizationName}  ·  ${o.cityName || '?'}, ${o.countryName || '?'}  ·  ${o.missionDuration} mois  ·  ${o.missionType}`);
    if (o.indemnite) console.log(`  Indemnité : ${o.indemnite}`);
    const specs = (o.specializations || []).map((s) => s.label || s.name).filter(Boolean).join(', ');
    if (specs) console.log(`  Spécialisations : ${specs}`);
    console.log(`  Publiée : ${String(o.startBroadcastDate || o.creationDate || '?').slice(0, 10)}  ·  Début : ${String(o.missionStartDate || '?').slice(0, 10)}`);
    console.log(`  Lien officiel : ${FICHE_PUBLIQUE(o.id)}`);
  }

  console.log('\n' + '─'.repeat(78));
  console.log('Test terminé. Rien n\'a été écrit. Vérifie que les liens ci-dessus');
  console.log('ouvrent bien la fiche Business France dans un navigateur.');
}

main().catch((err) => {
  console.error('Échec du test VIE :', err.message);
  process.exit(1);
});
