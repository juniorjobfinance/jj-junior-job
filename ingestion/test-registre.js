// ---------------------------------------------------------------------------
// Épreuve du registre des employeurs vus
// ---------------------------------------------------------------------------
//
// Le registre décide de ce que l'issue « Maisons à inscrire » affiche chaque
// matin. S'il compte faux, on inscrit des maisons déjà inscrites et on oublie
// celles qui comptent — c'est exactement l'erreur qui a fait inscrire dix-sept
// maisons pour zéro offre gagnée.
//
// On l'éprouve donc sur un scénario dont on connaît la réponse à l'avance, avec
// une horloge simulée : sans cela, la fenêtre de trente jours et l'oubli à cent
// quatre-vingts ne sont pas testables avant six mois.
//
//     node ingestion/test-registre.js
// ---------------------------------------------------------------------------
const R = require('./registre-employeurs.js');

let echecs = 0;
function verifier(nom, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log('  ' + (ok ? 'ok   ' : 'ECHEC') + ' ' + nom.padEnd(58) +
    (ok ? '' : '\n         attendu ' + JSON.stringify(attendu) + '\n         obtenu  ' + JSON.stringify(obtenu)));
}

const S = (categorie) => (emp, offres) => ({ emp, offres, categorie });
const sansStructure = S('sans-structure');
const maisonAbsente = S('maison-absente');

// --- Jour 1 : trois employeurs, tous nouveaux ---------------------------
let r = R.fusionner({ version: 1, employeurs: [] }, [
  sansStructure('Leocare', 3),
  sansStructure('Alptis', 1),
  maisonAbsente('Evercore', 2),
], '2026-08-01');
verifier('jour 1 — trois nouveaux', [r.nouveaux, r.revus, r.oublies], [3, 0, 0]);
verifier('jour 1 — le registre en compte trois', r.registre.employeurs.length, 3);

// --- Jour 2 : deux reviennent, un nouveau, un absent --------------------
r = R.fusionner(r.registre, [
  sansStructure('Leocare', 5),
  maisonAbsente('Evercore', 1),
  sansStructure('Repossi', 4),
], '2026-08-02');
verifier('jour 2 — un nouveau, deux revus', [r.nouveaux, r.revus, r.oublies], [1, 2, 0]);

const par = Object.fromEntries(r.registre.employeurs.map((e) => [e.emp, e]));
verifier('Leocare — deux passages', par.Leocare.passages, 2);
verifier('Leocare — offresMax retient le maximum, pas le dernier', [par.Leocare.offres, par.Leocare.offresMax], [5, 5]);
verifier('Evercore — offresMax ne redescend pas quand le jour baisse', [par.Evercore.offres, par.Evercore.offresMax], [1, 2]);
// LE POINT DE TOUT L EXERCICE : Alptis n'a pas ete revue, mais elle n'est pas
// perdue. C'est ce que la photo du jour effacait.
verifier('Alptis — absente du releve, TOUJOURS au registre', !!par.Alptis, true);
verifier('Alptis — sa derniere vue reste au jour 1', par.Alptis.derniereVue, '2026-08-01');
verifier('Alptis — son compteur de passages n a pas bouge', par.Alptis.passages, 1);

// --- Deux categories le meme jour : un passage, deux categories ---------
let r2 = R.fusionner(r.registre, [
  sansStructure('Leocare', 5),
  maisonAbsente('Leocare', 5),
], '2026-08-03');
const leo = r2.registre.employeurs.find((e) => e.emp === 'Leocare');
verifier('deux categories le meme jour — un seul passage de plus', leo.passages, 3);
verifier('deux categories le meme jour — les deux sont retenues', leo.categories.sort(), ['maison-absente', 'sans-structure']);

// --- La fenetre de trente jours -----------------------------------------
// Alptis a ete vue le 01/08. Au 31/08 elle a trente jours : elle est DANS la
// fenetre. Au 01/09 elle en a trente et un : elle en sort.
verifier('fenetre — Alptis visible a 30 jours',
  R.actifs(r2.registre, 'sans-structure', '2026-08-31').map((e) => e.emp).includes('Alptis'), true);
verifier('fenetre — Alptis sortie a 31 jours',
  R.actifs(r2.registre, 'sans-structure', '2026-09-01').map((e) => e.emp).includes('Alptis'), false);
verifier('fenetre — Leocare toujours la a 31 jours (vue le 03/08)',
  R.actifs(r2.registre, 'sans-structure', '2026-09-01').map((e) => e.emp).includes('Leocare'), true);

// --- La categorie separe bien les deux tableaux -------------------------
verifier('categorie — Evercore n est pas « sans structure »',
  R.actifs(r2.registre, 'sans-structure', '2026-08-03').map((e) => e.emp).sort(),
  ['Alptis', 'Leocare', 'Repossi']);
verifier('categorie — Evercore est « hors maisons.txt »',
  R.actifs(r2.registre, 'maison-absente', '2026-08-03').map((e) => e.emp).sort(),
  ['Evercore', 'Leocare']);

// --- L oubli a cent quatre-vingts jours ---------------------------------
// Alptis vue le 01/08 : au 28/01 elle a 180 jours, elle reste. Au 29/01, 181,
// elle est oubliee. On refusionne un releve vide pour declencher le menage.
let r3 = R.fusionner(r2.registre, [], '2027-01-28');
verifier('oubli — Alptis encore la a 180 jours',
  r3.registre.employeurs.map((e) => e.emp).includes('Alptis'), true);
r3 = R.fusionner(r2.registre, [], '2027-01-29');
verifier('oubli — Alptis oubliee a 181 jours',
  r3.registre.employeurs.map((e) => e.emp).includes('Alptis'), false);
verifier('oubli — le compteur le dit', r3.oublies, 1);

// --- Une date-jour contre un INSTANT : la meme unite --------------------
// Le lecteur de l'issue passe `new Date()`, pas une date-jour. Sans
// normalisation, « vu ce matin » rendait 1 et s'affichait « hier ».
const ceMatin = new Date('2026-09-04T00:00:00Z');
const cetApresMidi = new Date('2026-09-04T15:47:00Z');
verifier('meme unite — vu ce matin, lu cet apres-midi : zero jour',
  R.ecartJours('2026-09-04', cetApresMidi), 0);
verifier('meme unite — vu hier, lu cet apres-midi : un jour',
  R.ecartJours('2026-09-03', cetApresMidi), 1);
verifier('meme unite — minuit pile donne le meme resultat',
  R.ecartJours('2026-09-04', ceMatin), 0);

// --- Un fichier absent ou casse ne fait pas echouer le passage ----------
verifier('robustesse — fichier absent', R.charger('C:/rien/du/tout.json').employeurs, []);

// --- La garde d idempotence ---------------------------------------------
// Refusionner le MEME releve le MEME jour ne doit rien changer.
const avant = JSON.stringify(r2.registre.employeurs);
const rr = R.fusionner(r2.registre, [sansStructure('Leocare', 5), maisonAbsente('Leocare', 5)], '2026-08-03');
verifier('idempotence — rejouer le meme releve le meme jour ne change rien',
  JSON.stringify(rr.registre.employeurs), avant);

console.log('\n  ' + (echecs ? echecs + ' ECHEC(S)' : 'tout passe'));
process.exit(echecs ? 1 : 0);
