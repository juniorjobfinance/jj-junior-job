#!/usr/bin/env node
// ingestion/sonder-carrieres.js
//
// SONDEUR DE SITES CARRIÈRES — le chaînon qui manquait entre les deux autres
// détecteurs.
//
// detect-ats.js devine un identifiant public (Greenhouse, Lever, Ashby…).
// detect-portails.js teste trois plateformes à domaine propre.
// Ni l'un ni l'autre ne trouve Workday, Oracle Cloud ou Cornerstone, dont le
// « tenant » est une chaîne opaque impossible à deviner — or ce sont
// précisément les plateformes des grands groupes, c'est-à-dire des 72 maisons
// de référence qui ne remontent aucune offre.
//
// Le principe est inverse : plutôt que de deviner l'identifiant, on part du
// SITE CARRIÈRES de l'entreprise et on lit la signature de sa plateforme dans
// le HTML et dans les redirections. Le tenant s'y trouve toujours, puisque
// c'est lui qui sert les offres à la page.
//
// Usage :
//   node ingestion/sonder-carrieres.js "Carmignac:carmignac.com" "Scor:scor.com"
//   node ingestion/sonder-carrieres.js --fichier ingestion/maisons-a-sonder.txt
//
// Le fichier contient une maison par ligne, au format « Nom:domaine.com ».
//
// Le robots.txt est lu AVANT de conclure : une plateforme qui nous interdit
// l'accès est signalée comme telle et ne doit pas être branchée. C'est la règle
// du projet, et elle n'est pas négociable.

'use strict';

const UA = 'Mozilla/5.0 (compatible; JJ job board; +https://juniorjobfinance.com)';

// Les signatures, de la plus spécifique à la plus générale. L'ordre compte :
// une page Workday contient parfois le mot « oracle » dans une balise tierce.
const SIGNATURES = [
  {
    nom: 'workday',
    motif: /https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)/i,
    config: (m) => `{ tenant: '${m[1]}', dc: '${m[2]}', site: '${m[3]}', emp: 'NOM' }`,
  },
  {
    nom: 'oraclecloud',
    motif: /https?:\/\/([a-z0-9.-]*oraclecloud\.com)\/hcmUI\/CandidateExperience\/[a-z-]+\/sites\/([A-Za-z0-9_]+)/i,
    config: (m) => `{ host: '${m[1]}', site: '${m[2]}', emp: 'NOM' }`,
  },
  {
    nom: 'cornerstone',
    motif: /https?:\/\/([a-z0-9-]+)\.csod\.com/i,
    config: (m) => `{ tenant: '${m[1]}', emp: 'NOM' }`,
  },
  {
    nom: 'successfactors',
    motif: /career\d*\.successfactors\.(?:eu|com)\/careers?\?company=([A-Za-z0-9]+)/i,
    config: (m) => `{ company: '${m[1]}', emp: 'NOM' }`,
  },
  {
    nom: 'smartrecruiters',
    motif: /(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i,
    config: (m) => `{ slug: '${m[1]}', emp: 'NOM' }`,
  },
  {
    nom: 'avature',
    motif: /https?:\/\/([a-z0-9.-]+\.avature\.net)/i,
    config: (m) => `{ host: '${m[1]}', emp: 'NOM' }`,
  },
  {
    nom: 'talentsoft',
    motif: /https?:\/\/([a-z0-9-]+)\.talent-soft\.com|([a-z0-9-]+)\.talentsoft\.com/i,
    config: (m) => `{ host: '${(m[1] || m[2])}.talent-soft.com', emp: 'NOM' }`,
  },
  {
    nom: 'talentlink',
    motif: /https?:\/\/([a-z0-9-]+)\.tal\.net/i,
    config: (m) => `{ tenant: '${m[1]}', emp: 'NOM' }`,
  },
  {
    nom: 'eightfold',
    motif: /https?:\/\/([a-z0-9-]+)\.eightfold\.ai/i,
    config: (m) => `{ tenant: '${m[1]}', emp: 'NOM' }`,
  },
  { nom: 'greenhouse', motif: /boards\.greenhouse\.io\/([a-z0-9_-]+)/i, config: (m) => `{ slug: '${m[1]}', emp: 'NOM' }` },
  { nom: 'lever', motif: /jobs\.lever\.co\/([a-z0-9_-]+)/i, config: (m) => `{ slug: '${m[1]}', emp: 'NOM' }` },
  { nom: 'teamtailor', motif: /([a-z0-9-]+)\.teamtailor\.com/i, config: (m) => `{ slug: '${m[1]}', emp: 'NOM' }` },
  { nom: 'recruitee', motif: /([a-z0-9-]+)\.recruitee\.com/i, config: (m) => `{ slug: '${m[1]}', emp: 'NOM' }` },
  { nom: 'ashby', motif: /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i, config: (m) => `{ slug: '${m[1]}', emp: 'NOM' }` },
  // Reconnus pour information : aucun connecteur ne les lit aujourd'hui.
  { nom: 'icims (PAS DE CONNECTEUR)', motif: /([a-z0-9-]+)\.icims\.com/i, config: () => '—' },
  { nom: 'workable (PAS DE CONNECTEUR)', motif: /apply\.workable\.com\/([a-z0-9_-]+)/i, config: (m) => `slug ${m[1]}` },
  { nom: 'taleo (PAS DE CONNECTEUR)', motif: /([a-z0-9-]+)\.taleo\.net/i, config: () => '—' },
];

// Adresses les plus répandues pour un site carrières français.
function urlsCandidates(domaine) {
  return [
    `https://careers.${domaine}`,
    `https://jobs.${domaine}`,
    `https://carrieres.${domaine}`,
    `https://recrutement.${domaine}`,
    `https://emploi.${domaine}`,
    `https://${domaine}/carrieres`,
    `https://${domaine}/careers`,
    `https://${domaine}/fr/carrieres`,
    `https://${domaine}/nous-rejoindre`,
    `https://${domaine}/rejoignez-nous`,
  ];
}

async function lire(url, timeout = 12000) {
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) return null;
    const html = await r.text();
    return { url: r.url, html };
  } catch {
    return null;
  }
}

// Le robots.txt de la PLATEFORME, pas celui de l'entreprise : c'est elle qu'on
// interrogera. Un « Disallow: / » y ferme le sujet.
async function robotsAutorise(urlPlateforme) {
  try {
    const u = new URL(urlPlateforme);
    const r = await fetch(`${u.origin}/robots.txt`, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: true, note: `robots.txt HTTP ${r.status}` };
    const txt = await r.text();
    // On ne lit que le bloc « User-agent: * ».
    const bloc = txt.split(/user-agent:/i).find((b) => /^\s*\*/.test(b)) || '';
    const interdit = /^\s*disallow:\s*\/\s*$/im.test(bloc);
    return { ok: !interdit, note: interdit ? 'Disallow: / dans robots.txt' : 'autorisé' };
  } catch {
    return { ok: true, note: 'robots.txt injoignable' };
  }
}

function detecter(html, urlFinale) {
  const foin = urlFinale + '\n' + html;
  for (const s of SIGNATURES) {
    const m = foin.match(s.motif);
    if (m) return { plateforme: s.nom, config: s.config(m), preuve: m[0].slice(0, 90) };
  }
  return null;
}

// Beaucoup de grands groupes n'ont pas d'adresse carrières devinable : Danone
// et Michelin ne répondent à aucune des dix variantes courantes. Mais leur page
// d'accueil porte toujours un lien « Carrières » ou « Nous rejoindre ». On le
// suit, ce qui revient à faire ce qu'un humain ferait — et c'est ce lien qui
// mène à la plateforme.
function liensCarrieres(html, base) {
  const liens = new Set();
  const MOTS = /carri[eè]re|career|nous[\s-]rejoindre|rejoignez|recrutement|emploi|\bjobs?\b|talent/i;
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const [, href, texte] = m;
    if (!MOTS.test(texte) && !MOTS.test(href)) continue;
    if (/^(?:mailto|tel|javascript):/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol)) continue;
      liens.add(u.href.split('#')[0]);
    } catch {}
  }
  return [...liens].slice(0, 6);
}

async function sonder(nom, domaine) {
  const vues = new Set();
  const essayer = async (url) => {
    if (vues.has(url)) return null;
    vues.add(url);
    const page = await lire(url);
    if (!page) return null;
    const trouve = detecter(page.html, page.url);
    if (!trouve) return { page };
    const robots = await robotsAutorise(trouve.preuve.startsWith('http') ? trouve.preuve : page.url);
    return { nom, domaine, entree: url, ...trouve, robots };
  };

  for (const url of urlsCandidates(domaine)) {
    const r = await essayer(url);
    if (r && r.plateforme) return r;
  }

  // Deuxième tour : on part de la page d'accueil et on suit ses liens carrières.
  const accueil = await lire(`https://${domaine}`);
  if (accueil) {
    const direct = detecter(accueil.html, accueil.url);
    if (direct) {
      const robots = await robotsAutorise(direct.preuve.startsWith('http') ? direct.preuve : accueil.url);
      return { nom, domaine, entree: accueil.url, ...direct, robots };
    }
    for (const lien of liensCarrieres(accueil.html, accueil.url)) {
      const r = await essayer(lien);
      if (r && r.plateforme) return r;
      await new Promise((res) => setTimeout(res, 250));
    }
  }
  return { nom, domaine, plateforme: null };
}

(async () => {
  const args = process.argv.slice(2);
  let cibles = [];
  if (args[0] === '--fichier') {
    cibles = require('fs')
      .readFileSync(args[1], 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } else {
    cibles = args;
  }

  const trouvees = [];
  for (const cible of cibles) {
    const [nom, domaine] = cible.split(':');
    if (!domaine) {
      console.log(`${nom} — domaine manquant (format attendu « Nom:domaine.com »)`);
      continue;
    }
    const r = await sonder(nom.trim(), domaine.trim());
    if (!r.plateforme) {
      console.log(`${nom.padEnd(24)} aucune plateforme reconnue`);
    } else {
      const feu = r.robots.ok ? 'OK ' : 'NON';
      console.log(`${nom.padEnd(24)} ${feu} ${r.plateforme.padEnd(18)} ${r.config.replace('NOM', nom.trim())}`);
      if (!r.robots.ok) console.log(`${' '.repeat(25)}   ${r.robots.note}`);
      if (r.robots.ok) trouvees.push(r);
    }
    await new Promise((res) => setTimeout(res, 400));
  }

  console.log(`\n${trouvees.length} maison(s) branchable(s) sur ${cibles.length} sondée(s).`);
  console.log('Les lignes « OK » se collent dans TARGET_COMPANIES (ingestion/sources.js).');
})();
