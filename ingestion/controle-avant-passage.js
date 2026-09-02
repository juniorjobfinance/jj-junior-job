#!/usr/bin/env node
// ingestion/controle-avant-passage.js
//
// CONTRÔLE AVANT VOL — à lancer après toute modification, avant de laisser le
// passage automatique de 6 h 30 tourner sans surveillance.
//
// Il ne remplace pas un passage complet : il vérifie ce qui casse un passage
// SANS le dire, c'est-à-dire les fautes qu'aucune erreur de syntaxe ne révèle.
// Chacune de ces vérifications correspond à un incident réellement survenu.
//
// Usage : node ingestion/controle-avant-passage.js

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
let echecs = 0;
let alertes = 0;

function ok(libelle, detail = '') {
  console.log(`  ok    ${libelle}${detail ? ' — ' + detail : ''}`);
}
function ko(libelle, detail) {
  console.log(`  ÉCHEC ${libelle} — ${detail}`);
  echecs++;
}
function alerte(libelle, detail) {
  console.log(`  !     ${libelle} — ${detail}`);
  alertes++;
}

const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

console.log('\n--- Syntaxe ---');
for (const f of ['ingestion/pipeline.js', 'ingestion/sources.js', 'ingestion/manuel.js', 'ingestion/maisons.js']) {
  try {
    execSync(`node --check "${path.join(RACINE, f)}"`, { stdio: 'pipe' });
    ok(f);
  } catch (e) {
    ko(f, String(e.stderr || e).split('\n')[0]);
  }
}
// Le script de la page n'est pas un fichier .js : on l'extrait pour le compiler.
try {
  const html = lire('index.html');
  const m = html.match(/<script>\n\(function \(\) \{[\s\S]*?\n<\/script>/);
  if (!m) throw new Error('bloc <script> introuvable');
  new Function(m[0].replace(/^<script>/, '').replace(/<\/script>$/, ''));
  ok('index.html (script de la page)');
} catch (e) {
  ko('index.html', e.message);
}

console.log('\n--- Caractères de contrôle ---');
// Un heredoc mal échappé transforme « \b » en backspace : la règle ne
// correspond alors plus à rien, sans la moindre erreur.
for (const f of ['ingestion/pipeline.js', 'ingestion/sources.js']) {
  const n = (lire(f).match(/\x08/g) || []).length;
  if (n) ko(f, `${n} caractère(s) backspace`);
  else ok(f, 'aucun backspace');
}

console.log('\n--- Cohérence des deux axes ---');
// Les listes sont dupliquées en dur dans la page : elles ont déjà divergé, et
// la page affichait alors des familles à zéro.
try {
  const p = lire('ingestion/pipeline.js');
  const h = lire('index.html');
  const extraire = (src, mot, nom) => {
    const m = src.match(new RegExp(`${mot} ${nom} = \\[([\\s\\S]*?)\\];`));
    return m ? (m[1].match(/'[^']*'|"[^"]*"/g) || []).map((x) => x.slice(1, -1)) : null;
  };
  for (const nom of ['FAMILLES', 'STRUCTURES']) {
    const a = extraire(p, 'const', nom);
    const b = extraire(h, 'var', nom);
    if (!a || !b) {
      ko(nom, 'liste introuvable dans un des deux fichiers');
      continue;
    }
    const manquantes = a.filter((x) => !b.includes(x));
    const enTrop = b.filter((x) => !a.includes(x));
    if (manquantes.length || enTrop.length) {
      ko(nom, `divergence — pipeline seul : ${manquantes.join(', ') || 'aucune'} ; page seule : ${enTrop.join(', ') || 'aucune'}`);
    } else {
      ok(nom, `${a.length} entrées identiques des deux côtés`);
    }
  }
} catch (e) {
  ko('cohérence des axes', e.message);
}

console.log('\n--- Sources ---');
try {
  const s = lire('ingestion/sources.js');
  // Le Promise.all de fetchAllSources est destructuré : un appel ajouté sans sa
  // variable décale toute la liste et fait disparaître une source en silence.
  const d = s.match(/const \[([^\]]+)\] = await Promise\.all\(\[/);
  if (!d) {
    ko('fetchAllSources', 'destructuration introuvable');
  } else {
    const variables = d[1].split(',').length;
    const debut = s.indexOf(d[0]) + d[0].length;
    const fin = s.indexOf('\n  ]);', debut);
    const corps = s.slice(debut, fin).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    let prof = 0;
    let entrees = 0;
    for (const ligne of corps.split('\n')) {
      if (prof === 0 && /^\s{4}\S/.test(ligne)) entrees++;
      for (const c of ligne) {
        if ('([{'.includes(c)) prof++;
        if (')]}'.includes(c)) prof--;
      }
    }
    if (variables === entrees) ok('fetchAllSources', `${variables} variables pour ${entrees} appels`);
    else ko('fetchAllSources', `${variables} variables pour ${entrees} appels — une source serait perdue`);
  }

  // Les agrégateurs publics sont débranchés à dessein (DECISIONS.md §2).
  if (/const AGREGATEURS_PUBLICS_ACTIFS = false;/.test(s)) ok('agrégateurs publics', 'désactivés, comme décidé');
  else alerte('agrégateurs publics', 'ACTIVÉS — contraire à DECISIONS.md §2');
} catch (e) {
  ko('sources.js', e.message);
}

console.log('\n--- Délais maximum ---');
// Un fetch sans délai suspend le passage jusqu'à ce que GitHub le tue.
try {
  const p = lire('ingestion/pipeline.js');
  const sansDelai = [];
  // On lit une fenêtre FIXE après l'appel, sans chercher sa parenthèse
  // fermante : un « AbortSignal.timeout(10000) » en contient une, et s'arrêter
  // à la première faisait conclure à tort qu'il n'y avait pas de délai.
  for (const m of p.matchAll(/await fetch\(/g)) {
    const fenetre = p.slice(m.index, m.index + 400);
    if (/AbortSignal\.timeout/.test(fenetre)) continue;
    const ligne = p.slice(0, m.index).split('\n').length;
    sansDelai.push(`ligne ${ligne}`);
  }
  if (sansDelai.length) ko('pipeline.js', `${sansDelai.length} appel(s) fetch sans délai (${sansDelai.join(', ')})`);
  else ok('pipeline.js', 'tous les appels réseau ont un délai maximum');
} catch (e) {
  ko('délais', e.message);
}

console.log('\n--- Catalogue publié ---');
try {
  global.window = {};
  require(path.join(RACINE, 'offres.js'));
  const O = global.window.__OFFRES__;
  if (!Array.isArray(O) || !O.length) {
    ko('offres.js', 'vide ou illisible');
  } else {
    ok('offres.js', `${O.length} offres`);
    const sansContrat = O.filter((o) => o.volet === 'cdi-cdd' && !o.contrat).length;
    if (sansContrat) ko('contrat', `${sansContrat} offres CDI-CDD sans contrat`);
    else ok('contrat', 'toutes les offres CDI-CDD portent CDI ou CDD');

    const nonIso = O.filter((o) => o.postedAt && !/^\d{4}-\d{2}-\d{2}T/.test(String(o.postedAt))).length;
    if (nonIso) ko('dates', `${nonIso} dates au format brut`);
    else ok('dates', 'toutes en ISO');

    const jours = (o) => Math.floor((Date.now() - new Date(o.postedAt)) / 86400000);
    const trop = O.filter((o) => o.datePubFiable && jours(o) > (o.volet === 'cdi-cdd' ? 60 : 120)).length;
    if (trop) ko('âge', `${trop} offres au-dessus de leur seuil`);
    else ok('âge', 'aucune offre périmée');

    const descr = O.filter((o) => o._descr).length;
    if (descr) ko('fuite', `${descr} offres publient le texte de l'annonce`);
    else ok('fuite', "le texte des annonces n'est pas publié");
  }
} catch (e) {
  ko('offres.js', e.message);
}

console.log('\n--- Passage automatique ---');
try {
  const wf = lire('.github/workflows/mise-a-jour-quotidienne.yml');
  const cron = wf.match(/cron:\s*'([^']+)'/);
  ok('cron', `${cron ? cron[1] : '?'} UTC (06h30 Paris en été)`);
  if (/node ingestion\/pipeline\.js\s*2>&1/.test(wf)) ok('garde-fou', 'actif (pas de --forcer)');
  else alerte('garde-fou', '--forcer présent : la publication ne serait plus protégée');
  if (/actions\/cache/.test(wf)) ok('state.json', 'restauré par le cache');
  else ko('state.json', 'non restauré — aucune offre ne serait nouvelle ni retirée');
  if (/VERCEL_DEPLOY_HOOK_URL/.test(wf)) ok('déploiement', 'Deploy Hook Vercel appelé');
  else ko('déploiement', 'aucun déclenchement Vercel');
} catch (e) {
  ko('workflow', e.message);
}

console.log('\n--- Dépôt ---');
try {
  const sale = execSync('git status --porcelain', { cwd: RACINE }).toString().trim();
  if (sale) alerte('dépôt', `modifications non commitées :\n${sale.split('\n').map((l) => '          ' + l).join('\n')}`);
  else ok('dépôt', 'propre, tout est poussé');
} catch (e) {
  alerte('dépôt', e.message);
}

console.log('');
if (echecs) {
  console.log(`${echecs} ÉCHEC(S) — ne pas laisser le passage tourner en l'état.\n`);
  process.exitCode = 1;
} else if (alertes) {
  console.log(`Aucun échec, ${alertes} point(s) à regarder.\n`);
} else {
  console.log('Tout est en ordre pour le passage automatique.\n');
}
