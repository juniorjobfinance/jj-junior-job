#!/usr/bin/env node
// ---------------------------------------------------------------------------
// LE LECTEUR DE FICHES DATE-T-IL JUSTE ? — contrôle permanent
// ---------------------------------------------------------------------------
//
// `ficheJsonLd` convertissait « A/B/AAAA » à l'européenne, EN DUR, pour toutes
// les sources. L'hypothèse venait d'un seul site — le Crédit Agricole, et son
// commentaire le disait — et s'appliquait à tous.
//
// Bank of America envoie « 09/01/2026 » à l'américaine. Le 1ᵉʳ septembre
// devenait le 9 janvier : **235 jours de plus**, et ses dix offres franchissaient
// le seuil d'âge le même matin. C'est la jumelle des deux conversions retirées
// de `normalize()` le 07/09 — mon inventaire couvrait les branches de
// `normalize`, pas le chemin des fiches, où 556 offres sont datées par passage.
//
// LA PREUVE DU FORMAT, quand « le nombre > 12 » est muet. Aucune des dates de
// BofA ne dépasse 12 : ni « 09/01 » ni « 08/03 » ne tranchent. La preuve vient
// d'ailleurs — **la liste et la fiche décrivent la même offre**, la liste dit
// « 2026-09-01 » en ISO, donc la fiche est américaine. La concordance de deux
// champs prouve là où l'inspection d'une valeur ne peut rien.
//
// ET LA DIFFÉRENCE AVEC normalize : ici un refus n'écarte pas l'OFFRE, il
// écarte LA DATE DE LA FICHE. L'offre garde celle de sa liste.
//
//     node ingestion/test-fiche-date.js
// ---------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

const chemin = path.join(__dirname, 'pipeline.js');
let src = fs.readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
src = src.replace(/^#![^\n]*\n/, '').replace(/run\(\)\.catch\([\s\S]*$/, '');
const P = new Function(
  'require', 'module', 'exports', '__dirname', '__filename',
  src + '\n;return { ficheJsonLd, lireDatePublication, DATE_REFUSEE };'
)(require('module').createRequire(chemin), { exports: {} }, {}, __dirname, chemin);

let echecs = 0;
function verifier(nom, ok, detail) {
  if (!ok) echecs++;
  console.log('  ' + (ok ? 'ok   ' : 'ÉCHEC') + ' ' + nom + (detail ? '\n         ' + detail : ''));
}
const jour = (v) => (v ? String(v).slice(0, 10) : String(v));

// Une fiche minimale, telle que les sites l'émettent.
const fiche = (date) =>
  `<html><head><script type="application/ld+json">` +
  JSON.stringify({ '@type': 'JobPosting', title: 'Analyst', datePosted: date }) +
  `</script></head><body></body></html>`;

// === 1 — BofA : « 09/01/2026 » déclaré américain est le 1er SEPTEMBRE ====
{
  const r = P.ficheJsonLd(fiche('09/01/2026'), 'MM/JJ/AAAA');
  verifier('1 — « 09/01/2026 » déclaré MM/JJ rend le 1er septembre',
    jour(r.date) === '2026-09-01', 'rendu : ' + jour(r.date));

  const s = P.ficheJsonLd(fiche('08/03/2026'), 'MM/JJ/AAAA');
  verifier('1 — « 08/03/2026 » déclaré MM/JJ rend le 3 août',
    jour(s.date) === '2026-08-03', 'rendu : ' + jour(s.date));
}

// === 2 — le défaut d'hier : lu à l'européenne, c'est le 9 JANVIER =======
// On ne teste pas que le correctif marche, on montre CE QU'IL CORRIGE.
{
  const r = P.ficheJsonLd(fiche('09/01/2026'), 'JJ/MM/AAAA');
  verifier('2 — la même chaîne lue en JJ/MM rend le 9 janvier (le défaut)',
    jour(r.date) === '2026-01-09',
    'écart avec le 1er septembre : ' +
      Math.round((new Date('2026-09-01') - new Date('2026-01-09')) / 86400000) + ' jours');
}

// === 3 — sans déclaration, la date de la fiche est REFUSÉE ==============
// Et l'offre garde celle de sa liste : le refus porte sur la date, pas l'offre.
{
  const r = P.ficheJsonLd(fiche('09/01/2026'), undefined);
  verifier('3 — sans déclaration, « 09/01/2026 » est refusé', r.date === null,
    r.date ? 'la fiche a impose ' + jour(r.date) : null);
  verifier('3 — la fiche rend quand même son objet, sans date',
    r && typeof r === 'object' && 'description' in r);
}

// === 4 — Crédit Agricole, déclaré européen, continue de marcher =========
{
  const r = P.ficheJsonLd(fiche('17/08/2026'), 'JJ/MM/AAAA');
  verifier('4 — « 17/08/2026 » déclaré JJ/MM rend le 17 août',
    jour(r.date) === '2026-08-17', 'rendu : ' + jour(r.date));
  // Le 17 ne peut pas être un mois : déclaré américain, la date est refusée.
  const s = P.ficheJsonLd(fiche('17/08/2026'), 'MM/JJ/AAAA');
  verifier('4 — la même, déclarée MM/JJ, est refusée (mois 17)', s.date === null,
    s.date ? 'acceptee : ' + jour(s.date) : null);
}

// === 5 — Société Générale : « 2026/07/24 », que rien ne lisait ==========
{
  const r = P.ficheJsonLd(fiche('2026/07/24'), undefined);
  verifier('5 — « 2026/07/24 » est lu sans déclaration (non ambigu)',
    jour(r.date) === '2026-07-24', 'rendu : ' + jour(r.date));
}

// === 6 — ce qui doit continuer à passer =================================
{
  for (const [entree, attendu] of [
    ['2026-08-31', '2026-08-31'],
    ['2026-8-25', '2026-08-25'],
    ['2026-09-03T16:53:43+0200', '2026-09-03'],
  ]) {
    const r = P.ficheJsonLd(fiche(entree), undefined);
    verifier('6 — passe encore : « ' + entree + ' »', jour(r.date) === attendu,
      'rendu : ' + jour(r.date));
  }
  // Une date future ou trop ancienne reste écartée : le garde-fou est intact.
  const futur = P.ficheJsonLd(fiche('2099-01-01'), undefined);
  verifier('6 — une date future reste écartée', futur.date === null);
  const vieux = P.ficheJsonLd(fiche('2009-01-01'), undefined);
  verifier('6 — une date antérieure à 2015 reste écartée', vieux.date === null);
}

console.log('\n  ' + (echecs ? echecs + ' ÉCHEC(S)' : 'le lecteur de fiches date juste'));
process.exit(echecs ? 1 : 0);
