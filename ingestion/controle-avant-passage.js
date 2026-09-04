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
const { chargerPipeline } = require('./atelier');

const RACINE = path.join(__dirname, '..');

// Les seuils viennent du pipeline, jamais d'une copie. Ce controle a
// longtemps porte « ? 60 : 120 » en dur : le jour ou le pipeline aurait
// change le sien, il aurait certifie « aucune offre perimee » en mesurant
// un seuil abandonne. Un garde-fou qui se trompe est pire que pas de
// garde-fou.
const P = chargerPipeline(RACINE);
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
  // `\r?\n` et non `\n` : la copie de travail est en CRLF sous Windows, et le
  // motif strict faisait échouer ce contrôle sur une page saine.
  const m = html.match(/<script>\r?\n\(function \(\) \{[\s\S]*?\r?\n<\/script>/);
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
//
// La référence n'est plus pipeline.js mais les MODULES : classifier.js pour
// les familles, structures.js pour les types de structure. Les tableaux de
// pipeline.js ne servaient plus à rien, et ce contrôle les validait quand
// même — il aurait donc dit « identiques » sur du code mort.
try {
  const h = lire('index.html');
  const { FAMILIES } = require('./classifier');
  const { STRUCTURES: LIBELLES } = require('./structures');
  const source = {
    FAMILLES: FAMILIES.map((f) => f.label),
    STRUCTURES: Object.values(LIBELLES),
  };
  const extraire = (src, mot, nom) => {
    const m = src.match(new RegExp(`${mot} ${nom} = \\[([\\s\\S]*?)\\];`));
    return m ? (m[1].match(/'[^']*'|"[^"]*"/g) || []).map((x) => x.slice(1, -1)) : null;
  };
  for (const nom of ['FAMILLES', 'STRUCTURES']) {
    const a = source[nom];
    const b = extraire(h, 'var', nom);
    if (!a || !b) {
      ko(nom, 'liste introuvable dans un des deux fichiers');
      continue;
    }
    const manquantes = a.filter((x) => !b.includes(x));
    const enTrop = b.filter((x) => !a.includes(x));
    if (manquantes.length || enTrop.length) {
      ko(nom, `divergence — module seul : ${manquantes.join(', ') || 'aucune'} ; page seule : ${enTrop.join(', ') || 'aucune'}`);
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
    const seuil = (o) =>
      o.volet === 'cdi-cdd' ? P.MAX_AGE_JOURS_CDI_CDD : P.MAX_AGE_JOURS_ATS_DIRECT;
    const trop = O.filter((o) => o.datePubFiable && jours(o) > seuil(o)).length;
    if (trop) ko('âge', `${trop} offres au-dessus de leur seuil`);
    else
      ok(
        'âge',
        `aucune offre périmée (${P.MAX_AGE_JOURS_CDI_CDD} j pour un CDI·CDD, ` +
          `${P.MAX_AGE_JOURS_ATS_DIRECT} j sinon)`
      );

    const descr = O.filter((o) => o._descrExtrait).length;
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

console.log('\n--- Maisons branchées ---');
try {
  const sources = require('./sources');
  const { trouverMaison } = require('./maisons');
  const configurees = new Set();
  for (const c of sources.LISTES_HTML || []) if (c.emp) configurees.add(c.emp);
  for (const cfgs of Object.values(sources.TARGET_COMPANIES || {})) {
    if (!Array.isArray(cfgs)) continue;
    for (const c of cfgs) if (c.emp) configurees.add(c.emp);
  }
  // Une maison branchée mais absente de la liste de référence voit TOUTES ses
  // offres jetées par normalize, sans le moindre message. C'est la panne la
  // plus silencieuse du projet : le connecteur tourne, et rien ne sort.
  const orphelines = [...configurees].filter((e) => !trouverMaison(e)).sort();
  if (!orphelines.length) {
    ok('maisons', `les ${configurees.size} maisons branchées sont toutes dans maisons.txt`);
  } else {
    // ÉCHEC et non alerte : DECISIONS.md §16 pose que brancher un connecteur
    // et inscrire la maison sont un seul geste. Une alerte se lit et s'oublie ;
    // c'est ce qui a permis la récidive du 3 septembre.
    ko(
      'maisons',
      `${orphelines.length} branchée(s) mais absente(s) de maisons.txt — leurs offres sont ` +
        `jetées en silence :\n          ${orphelines.join(', ')}`
    );
  }
} catch (e) {
  alerte('maisons', e.message);
}
console.log('\n--- Maisons vues à la collecte ---');
try {
  // Le contrôle ci-dessus est statique : il ne voit que les `emp` déclarés.
  // Celui-ci porte sur ce que la DERNIÈRE COLLECTE a réellement rencontré.
  // Un connecteur sert souvent des employeurs sous un autre nom que le sien —
  // opendatasoft:bpce rend « BPCE Vie » et « BPCE IG », pas « Groupe BPCE ».
  const fichiers = ['data/rejets-maisonref.json', 'data/rejets-maisonref-refonte.json']
    .map((f) => path.join(RACINE, f))
    .filter((f) => fs.existsSync(f));

  if (!fichiers.length) {
    alerte('maisons vues', 'aucun relevé de collecte — lancer le pipeline une fois pour ce contrôle');
  } else {
    const recent = fichiers
      .map((f) => ({ f, t: fs.statSync(f).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0].f;
    const releve = JSON.parse(fs.readFileSync(recent, 'utf8'));
    const parEmp = new Map();
    for (const o of releve.offres || []) parEmp.set(o.entreprise, (parEmp.get(o.entreprise) || 0) + 1);
    const noms = [...parEmp.entries()].sort((a, b) => b[1] - a[1]);
    const quand = String(releve.genere || '?').slice(0, 10);

    if (!noms.length) {
      ok('maisons vues', `aucune maison jetée à la collecte du ${quand}`);
    } else {
      const total = noms.reduce((n, [, v]) => n + v, 0);
      // SIGNALE, ne bloque pas. Ces offres manquent au site ; celles qui y sont
      // restent exactes. Des noms nouveaux apparaissent chaque jour — bloquer
      // sur eux arreterait la publication presque tous les matins, pour une
      // raison qui n'est pas une faute. L'issue « Maisons a inscrire » les
      // porte, et elle, elle est tenue a jour meme sur un passage vert.
      alerte(
        'maisons vues',
        `${noms.length} maison(s) ont servi ${total} offre(s) à la collecte du ${quand} sans être ` +
          `dans maisons.txt — tout a été jeté :\n          ` +
          noms.slice(0, 15).map(([e, n]) => `${e} (${n})`).join(', ') +
          (noms.length > 15 ? `, et ${noms.length - 15} autre(s)` : '')
      );
    }
  }
} catch (e) {
  alerte('maisons vues', e.message);
}

console.log('\n--- Champs publiés ---');
try {
  // LISTE BLANCHE. Tout champ absent d'ici fait echouer le controle.
  //
  // Ajouter un champ au catalogue est une decision : il part chez chaque
  // visiteur, il gonfle le fichier telecharge, et il devient une promesse
  // qu on ne peut plus retirer sans casser la page. Il doit donc apparaitre
  // ici EXPLICITEMENT, jamais par accident.
  const CHAMPS_PUBLICS = new Set([
    // Ce que la carte affiche
    'emp', 'title', 'sector', 'famille', 'volet', 'contrat', 'loc', 'zone',
    'place', 'url', 'sal', 'dl',
    // Le seul identifiant stable qui reste : familleId, structureId et
    // maisonReference etaient DERIVES de famille, sector et maison.
    'tags',
    // Provenance et fraicheur
    'maison', 'source', 'verifiedAt', 'postedAt',
    'firstSeenAt', 'datePubFiable', 'dateMaj', 'alsoOn',
    // Mise en avant
    'pepite',
  ]);

  const fichiers = ['offres.js', 'offres-refonte.js'].filter((f) => fs.existsSync(path.join(RACINE, f)));
  if (!fichiers.length) {
    alerte('champs publiés', 'aucun catalogue a verifier');
  } else {
    let fautifs = 0;
    for (const f of fichiers) {
      const g = {};
      try {
        new Function('window', fs.readFileSync(path.join(RACINE, f), 'utf8'))(g);
      } catch (e) {
        ko(f, `catalogue illisible : ${e.message}`);
        continue;
      }
      const offres = g.__OFFRES__ || [];
      const intrus = new Map();
      for (const o of offres) {
        for (const k of Object.keys(o)) {
          if (CHAMPS_PUBLICS.has(k)) continue;
          if (!intrus.has(k)) intrus.set(k, { n: 0, exemple: o });
          intrus.get(k).n++;
        }
      }
      if (!intrus.size) {
        ok(f, `${offres.length} offres, aucun champ hors liste blanche`);
      } else {
        fautifs++;
        const detail = [...intrus.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .map(([k, v]) =>
            `            « ${k} » sur ${v.n} offre(s) — ex. ${String(v.exemple.emp).slice(0, 22)} : ` +
            `${String(v.exemple.title).slice(0, 40)}`
          )
          .join('\n');
        ko(
          f,
          `${intrus.size} champ(s) publie(s) hors liste blanche — ils partent chez chaque\n` +
            `          visiteur sans avoir ete decides :\n\n${detail}\n\n` +
            `          Soit le champ est voulu et s'ajoute a CHAMPS_PUBLICS dans ce fichier,\n` +
            `          soit il est interne et se retire dans la destructuration de\n` +
            `          writeOutput (ingestion/pipeline.js).`
        );
      }

      // Une offre PUBLIEE sans structure est invisible dans le filtre du site :
      // elle existe et personne ne peut la trouver. C'est pire qu'une offre
      // absente, donc c'est un ECHEC au meme titre qu'un champ hors liste.
      //
      // Le controle « deux tables » ne l'attrape pas : il regarde les
      // employeurs VUS a la collecte. Le VIE contourne la maison de reference,
      // donc un employeur inconnu publie quand meme — KONI France est passee
      // par la le 04/09/2026, et les deux tables etaient vertes.
      const muettes = offres.filter((o) => !o.sector);
      if (muettes.length) {
        fautifs++;
        ko(
          f,
          `${muettes.length} offre(s) publiee(s) SANS structure — invisibles dans le\n` +
            `          filtre du site : elles existent et personne ne peut les trouver.\n\n` +
            muettes
              .slice(0, 10)
              .map((o) => `            ${String(o.emp).slice(0, 26)} — ${String(o.title).slice(0, 42)}`)
              .join('\n') +
            (muettes.length > 10 ? `\n            … et ${muettes.length - 10} autre(s)` : '') +
            `\n\n          A inscrire dans ingestion/structures.js, table EMPLOYER_STRUCTURE.`
        );
      } else {
        ok(f, 'toutes les offres publiees portent une structure');
      }
    }
    if (!fautifs && fichiers.length > 1) {
      console.log('        les ' + fichiers.length + ' catalogues respectent la meme liste.');
    }
  }
} catch (e) {
  alerte('champs publiés', e.message);
}

console.log('\n--- Les deux tables : maisons.txt et structures.js ---');
try {
  const { trouverMaison } = require('./maisons');
  const { resolveStructure, normalizeEmployer, STRUCTURES } = require('./structures');

  // Les employeurs REELLEMENT rencontres : ceux du catalogue publie, plus
  // ceux que maisonRef a ecartes. C'est sur eux que le piege mord.
  // On compte leurs offres au passage : un employeur qui en perd trente ne se
  // traite pas comme un employeur qui en perd une.
  const offresPar = new Map();
  const compter = (e) => offresPar.set(e, (offresPar.get(e) || 0) + 1);
  const vus = new Set();
  for (const f of ['offres.js', 'offres-refonte.js']) {
    const p = path.join(RACINE, f);
    if (!fs.existsSync(p)) continue;
    try {
      const g = {};
      new Function('window', fs.readFileSync(p, 'utf8'))(g);
      for (const o of g.__OFFRES__ || []) if (o.emp) { vus.add(o.emp); compter(o.emp); }
    } catch (e) {
      /* un catalogue illisible est signale ailleurs */
    }
  }
  for (const f of ['data/rejets-maisonref.json', 'data/rejets-maisonref-refonte.json']) {
    const p = path.join(RACINE, f);
    if (!fs.existsSync(p)) continue;
    try {
      for (const o of JSON.parse(fs.readFileSync(p, 'utf8')).offres || []) {
        if (o.entreprise) { vus.add(o.entreprise); compter(o.entreprise); }
      }
    } catch (e) {
      /* idem */
    }
  }

  if (!vus.size) {
    alerte('deux tables', 'aucun catalogue lisible — controle impossible');
  } else {
    // Accepte par maisons.txt, mais sans structure : ses offres franchissent
    // la premiere porte pour se faire rejeter par la seconde.
    const boiteuses = [...vus].filter((e) => trouverMaison(e) && !resolveStructure(e)).sort();
    if (!boiteuses.length) {
      ok('deux tables', `les ${vus.size} employeurs vus resolvent maison ET structure`);
    } else {
      // Le message donne la ligne A COLLER, pas le constat. Un controle qui
      // nomme la correction se repare en trente secondes ; un controle qui
      // constate un ecart se contourne.
      const lignes = boiteuses
        .sort((a, b) => (offresPar.get(b) || 0) - (offresPar.get(a) || 0))
        .map((e) => {
          const n = offresPar.get(e) || 0;
          return `            '${normalizeEmployer(e)}': '???',` +
            `${' '.repeat(Math.max(1, 34 - normalizeEmployer(e).length))}// ${e} (${n} offre${n > 1 ? 's' : ''})`;
        });
      // SIGNALE : meme raison. Un employeur sans structure coute SES offres,
      // pas celles des autres.
      alerte(
        'deux tables',
        `${boiteuses.length} employeur(s) publient mais n'ont pas de structure : la porte\n` +
          `          finance rejette TOUTES leurs offres, en silence.\n\n` +
          `          A corriger dans ingestion/structures.js, table EMPLOYER_STRUCTURE :\n\n` +
          lignes.join('\n') +
          `\n\n          Remplacer ??? par un de ces identifiants :\n` +
          `            ${Object.keys(STRUCTURES).join(', ')}`
      );
    }

    // Pour information seulement : les maisons de reference qui n'ont pas
    // encore de structure mais ne servent rien. Ce sont surtout des maisons
    // hors d'atteinte (pare-feu, JavaScript) ; en faire un echec rendrait ce
    // controle rouge en permanence, donc inutile. C'est une liste de travail.
    const noms = fs
      .readFileSync(path.join(RACINE, 'ingestion/maisons.txt'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.split('|')[0].trim())
      .filter((l) => l && !l.startsWith('#'));
    const dormantes = noms.filter((n) => !resolveStructure(n) && !vus.has(n));
    if (dormantes.length) {
      console.log(
        `        ${dormantes.length} maison(s) de reference sans structure, mais qui ne servent rien —` +
          ' a completer le jour ou elles publient.'
      );
    }
  }
} catch (e) {
  alerte('deux tables', e.message);
}


console.log('\n--- Le catalogue dans le HTML ---');
try {
  const html = lire('index.html');
  const bornes = html.match(/<!--JJ:OFFRES:DEBUT-->([\s\S]*?)<!--JJ:OFFRES:FIN-->/);
  if (!bornes) {
    ko('catalogue HTML', 'les bornes JJ:OFFRES ont disparu d index.html — le pipeline ne peut plus y ecrire');
  } else {
    const dedans = bornes[1];
    const js = lire('offres.js');
    const catalogue = JSON.parse(js.slice(js.indexOf('['), js.lastIndexOf(']') + 1));

    // Ce que le HTML DEVRAIT contenir, calcule avec le vrai gabarit — jamais
    // une reimplementation du regroupement.
    const { chargerGabarit, rendreCartes, rendrePepites, voletParDefaut } =
  require('./ecrire-catalogue-html.js');
    const gabarit = chargerGabarit(html);
    const attendus = gabarit.grouperParAnnonce(catalogue).length;

    const cartes = (dedans.match(/<a class="card"|<div class="card card-groupe">/g) || []).length;

    if (cartes === 0) {
      ko('catalogue HTML', `aucune carte entre les bornes, alors que offres.js en porte ${catalogue.length}`);
    } else if (cartes !== attendus) {
      ko('catalogue HTML',
        `${cartes} carte(s) dans index.html pour ${attendus} attendue(s) — ` +
        'generation interrompue, ou HTML plus a jour que le catalogue');
    } else {
      ok('catalogue HTML', `${cartes} cartes pour ${catalogue.length} offres`);
    }

    // Le comptage seul ne suffit pas : un index.html de la veille peut avoir
    // le meme nombre de cartes. Mais comparer les URL une a une serait FAUX —
    // cardGroupeHTML dedoublonne les villes d'un groupe, donc deux offres au
    // meme endroit ne rendent qu'un lien, et deux URL du catalogue manquent
    // legitimement du HTML.
    //
    // On regenere donc le bloc attendu avec le vrai gabarit et on le compare
    // au bloc present. Meme catalogue, meme gabarit, meme sortie : toute
    // difference est une vraie panne, et il n'y a aucun seuil a regler.
    // On appelle la fonction du pipeline, jamais une reimplementation : c'est
    // elle qui decide de l'espacement, une carte par ligne, et la comparaison
    // ci-dessous est au caractere pres.
    const attendu = rendreCartes(catalogue, gabarit).html;
    if (dedans !== attendu) {
      const i = [...attendu].findIndex((c, k) => dedans[k] !== c);
      ko('catalogue HTML',
        `le HTML ne correspond pas au catalogue (${dedans.length} caracteres ` +
        `contre ${attendu.length} attendus, premiere divergence au ${i}e) — ` +
        'relancer le pipeline avant de publier');
    } else {
      ok('catalogue HTML', 'identique a ce que le gabarit produit pour ce catalogue');
    }

    // Le bandeau des Pepites, meme methode : on regenere et on compare.
    // Il est ecrit dans le HTML depuis le 04/09 — auparavant il etait cache
    // puis devoile par le JS, ce qui decalait toute la page apres le premier
    // affichage.
    const bp = html.match(/<!--JJ:PEPITES:DEBUT-->([\s\S]*?)<!--JJ:PEPITES:FIN-->/);
    const bpts = html.match(/<!--JJ:POINTS:DEBUT-->([\s\S]*?)<!--JJ:POINTS:FIN-->/);
    if (!bp || !bpts) {
      ko('bandeau pépites', 'les bornes JJ:PEPITES ou JJ:POINTS ont disparu d index.html');
    } else {
      const attenduP = rendrePepites(catalogue, gabarit, voletParDefaut(html));
      const cache = /<div id="pepites" class="pepites" hidden>/.test(html);
      if (bp[1] !== attenduP.piste || bpts[1] !== attenduP.points) {
        ko('bandeau pépites',
          `le bandeau ne correspond pas au catalogue (${bp[1].length} caracteres ` +
          `contre ${attenduP.piste.length} attendus) — relancer le pipeline`);
      } else if (attenduP.nombre && cache) {
        ko('bandeau pépites',
          `${attenduP.nombre} pepite(s) ecrite(s) mais le bandeau porte « hidden » : ` +
          'elles seraient invisibles, et le JS les devoilerait apres coup');
      } else if (!attenduP.nombre && !cache) {
        ko('bandeau pépites',
          'aucune pepite mais le bandeau est visible : il occuperait 558 px de vide');
      } else {
        ok('bandeau pépites', attenduP.nombre
          ? `${attenduP.nombre} pepite(s) dans le HTML, bandeau visible`
          : 'aucune pepite pour ce volet, bandeau masque — normal');
      }
    }
  }
} catch (e) {
  ko('catalogue HTML', e.message);
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
  console.log(
    `Aucun échec — le catalogue est publiable. ${alertes} point(s) à regarder :\n` +
      `il lui manque des offres, il n'en porte pas de fausses.\n`
  );
} else {
  console.log('Tout est en ordre pour le passage automatique.\n');
}
