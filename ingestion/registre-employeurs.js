// ---------------------------------------------------------------------------
// Le registre des employeurs vus — une mémoire, pas une photo
// ---------------------------------------------------------------------------
//
// `data/employeurs-inconnus.json` est ÉCRASÉ à chaque passage. Il porte le
// relevé du matin, et le relevé du matin efface celui de la veille.
//
// La mesure qui a motivé ce fichier : trois relevés successifs comptaient
// 26, puis 18, puis 17 employeurs. Un employeur qui disparaît d'un relevé n'est
// pas réglé pour autant — ses offres ont simplement expiré, et la maison
// reviendra publier. La photo du jour sous-déclarait donc d'au moins un tiers,
// et reconstituer l'union demandait de relire trois commentaires d'issue à la
// main.
//
// Le registre fusionne au lieu d'écraser. Sa propriété la plus utile est qu'il
// SE NETTOIE TOUT SEUL : un employeur inscrit dans `structures.js` cesse
// d'apparaître dans le relevé dès le lendemain, puisque `resolveStructure` lui
// répond. Aucune liste de « déjà traités » à tenir — la seule chose qui sort un
// nom de la liste, c'est de régler le problème.
//
// Il ne décide de rien : il alimente une issue. Corrompu ou absent, le pire
// qu'il puisse faire est de repartir du relevé du jour, c'est-à-dire du
// comportement d'avant.
// ---------------------------------------------------------------------------
const fs = require('fs');

// La fenêtre. Trente jours couvrent un cycle de publication complet : au seuil
// du pipeline une annonce CDI vit 60 jours, donc trente jours attrapent toute
// maison ayant publié au moins une fois dans le mois. Sept jours rateraient les
// maisons à rotation lente ; quatre-vingt-dix feraient enfler la liste de
// maisons qui ne publient plus.
const FENETRE_JOURS = 30;

// Au-delà, l'entrée est oubliée. Sans cela le fichier ne ferait que croître,
// avec des maisons qui n'existent peut-être plus. Six mois laissent la place à
// une saison complète d'alternance avant d'effacer.
const OUBLI_JOURS = 180;

const VIDE = { version: 1, genere: null, employeurs: [] };

function jour(d) {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

// L'ecart en JOURS, et non en fractions de jour. Les deux bornes sont ramenees
// a leur date avant la soustraction : sans cela, une date-jour comparee a
// l'instant present rend 0,66 jour — arrondi a 1 — et une maison vue ce matin
// s'affiche « hier ». Le seuil de trente jours n'en souffrait pas ; le texte
// affiche, si.
function ecartJours(depuis, jusqua) {
  return Math.round((new Date(jour(jusqua)) - new Date(jour(depuis))) / 86400000);
}

/** Lit le registre. Un fichier absent ou illisible rend un registre vide : le
 *  passage du matin ne doit jamais échouer sur un fichier de travail. */
function charger(chemin) {
  try {
    const r = JSON.parse(fs.readFileSync(chemin, 'utf8'));
    if (!r || !Array.isArray(r.employeurs)) return { ...VIDE };
    return r;
  } catch {
    return { ...VIDE };
  }
}

/**
 * Fusionne le relevé du jour dans le registre.
 *
 * @param {object} registre  le registre chargé
 * @param {Array<{emp:string, offres:number, categorie:string}>} releves
 * @param {Date|string} date  la date du passage
 * @returns {{registre:object, nouveaux:number, revus:number, oublies:number}}
 */
function fusionner(registre, releves, date = new Date()) {
  const aujourdhui = jour(date);
  const par = new Map(registre.employeurs.map((e) => [e.emp, e]));
  let nouveaux = 0;
  let revus = 0;

  for (const { emp, offres, categorie } of releves) {
    if (!emp) continue;
    const e = par.get(emp);
    if (!e) {
      par.set(emp, {
        emp,
        categories: [categorie],
        premiereVue: aujourdhui,
        derniereVue: aujourdhui,
        passages: 1,
        offres: offres || 0,
        offresMax: offres || 0,
      });
      nouveaux++;
      continue;
    }
    // Un employeur peut être vu deux fois le même jour, une fois par catégorie.
    // Le compteur de passages ne doit avancer qu'une fois par JOUR, sans quoi
    // il compte des catégories et non des passages.
    if (e.derniereVue !== aujourdhui) {
      e.passages = (e.passages || 0) + 1;
      revus++;
    }
    e.derniereVue = aujourdhui;
    e.offres = offres || 0;
    e.offresMax = Math.max(e.offresMax || 0, offres || 0);
    if (!e.categories.includes(categorie)) e.categories.push(categorie);
  }

  const avant = par.size;
  const gardes = [...par.values()].filter((e) => ecartJours(e.derniereVue, aujourdhui) <= OUBLI_JOURS);
  gardes.sort((a, b) => (a.derniereVue === b.derniereVue ? b.passages - a.passages : b.derniereVue.localeCompare(a.derniereVue)));

  return {
    registre: { version: 1, genere: new Date(date).toISOString(), fenetreJours: FENETRE_JOURS, employeurs: gardes },
    nouveaux,
    revus,
    oublies: avant - gardes.length,
  };
}

/** Les employeurs vus au moins une fois dans les FENETRE_JOURS derniers jours,
 *  pour une catégorie donnée. C'est ce que l'issue doit montrer. */
function actifs(registre, categorie, date = new Date()) {
  const aujourdhui = jour(date);
  return registre.employeurs.filter(
    (e) =>
      Array.isArray(e.categories) &&
      e.categories.includes(categorie) &&
      ecartJours(e.derniereVue, aujourdhui) <= FENETRE_JOURS
  );
}

function enregistrer(chemin, registre) {
  fs.writeFileSync(chemin, JSON.stringify(registre, null, 2) + '\n');
}

module.exports = { FENETRE_JOURS, OUBLI_JOURS, charger, fusionner, actifs, enregistrer, jour, ecartJours };
