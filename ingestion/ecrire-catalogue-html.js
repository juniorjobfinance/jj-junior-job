// Écrit le catalogue DANS index.html, au moment de la génération.
//
// POURQUOI
// Google recevait une page de 1 033 caractères : les 912 offres arrivaient par
// offres.js, en JavaScript. Le moteur exécute le JS, mais tard et sans
// garantie. Mesuré le 04/09/2026 : les cartes des 912 offres pèsent 300 Ko
// bruts et 25 Ko une fois compressées — le poids d'une petite image, pour la
// totalité du catalogue. Il n'y a donc aucun rendu partiel à régler.
//
// LE GABARIT N'EST PAS RECOPIÉ ICI, ET C'EST LE POINT CENTRAL
// Le piège le plus cher du projet est la duplication : « ne jamais recopier une
// fonction pour la tester » a coûté trois diagnostics faux en une séance, et la
// page porte déjà la cicatrice d'une liste de familles dupliquée qui avait
// divergé. On applique donc le procédé d'atelier.js : on DÉCOUPE le vrai
// gabarit dans index.html, entre deux bornes, et on l'exécute tel quel. Si
// quelqu'un change une carte dans la page, le HTML généré change avec elle.
//
// CE QUE LE PIPELINE APPELLE, ET CE QU'IL N'APPELLE PAS
// La plage découpée contient aussi des fonctions qui lisent « state » et
// « els » — matchesFilters, updateFamilleCounts. Les DÉCLARER hors du
// navigateur est sans danger : leur corps n'est évalué qu'à l'appel, et on ne
// les appelle jamais. Seules grouperParAnnonce, cardHTML et cardGroupeHTML le
// sont.
const fs = require('fs');
const path = require('path');
const TEXTES = require('./familles-textes');

const BORNE_GABARIT = /\/\/ ==== JJ:GABARIT:DEBUT[\s\S]*?\/\/ ==== JJ:GABARIT:FIN/;
const BORNE_OFFRES = /(<!--JJ:OFFRES:DEBUT-->)[\s\S]*?(<!--JJ:OFFRES:FIN-->)/;
const BORNE_PEPITES = /(<!--JJ:PEPITES:DEBUT-->)[\s\S]*?(<!--JJ:PEPITES:FIN-->)/;
const BORNE_POINTS = /(<!--JJ:POINTS:DEBUT-->)[\s\S]*?(<!--JJ:POINTS:FIN-->)/;
const BORNE_TEXTES = /(\/\*JJ:TEXTES:DEBUT\*\/)[\s\S]*?(\/\*JJ:TEXTES:FIN\*\/)/;
const BANDEAU = /<div id="pepites" class="pepites"( hidden)?>/;

// La plage découpée contient, au premier niveau, la construction de « els » —
// des document.getElementById. On fournit donc un DOM inerte, le temps de
// l'évaluation seulement.
//
// Puis on le VERROUILLE : après le chargement, toute touche au DOM lève. Sans
// ce verrou, un gabarit qui se mettrait à lire la page rendrait ici des cartes
// silencieusement fausses — exactement le mode de panne que ce fichier existe
// pour éviter. Le verrou transforme une divergence muette en erreur.
const AIDES = `
  var __domVerrouille = false;
  function __refus(quoi) {
    if (__domVerrouille) {
      throw new Error(
        'Le gabarit de carte a touche au DOM (' + quoi + ') pendant le rendu ' +
        'hors navigateur. Il ne peut plus etre execute par le pipeline : soit ' +
        'la dependance est retiree du gabarit, soit les bornes JJ:GABARIT sont ' +
        'deplacees.'
      );
    }
  }
  var __noeud = {
    addEventListener: function () {}, setAttribute: function () {},
    querySelectorAll: function () { return []; }, forEach: function () {},
    options: [], value: '', textContent: '', hidden: false, dataset: {}, checked: false,
  };
  var document = {
    getElementById: function (id) { __refus('getElementById(' + id + ')'); return __noeud; },
    querySelectorAll: function (s) { __refus('querySelectorAll(' + s + ')'); return []; },
    querySelector: function (s) { __refus('querySelector(' + s + ')'); return __noeud; },
    addEventListener: function () {},
  };
  var window = { innerWidth: 1280, addEventListener: function () {}, location: { search: '' } };

  function sansAccents(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  }
  function zoneDe(o) { return o.zone || 'Lieu non précisé'; }
  function maisonDe(o) { return o.maison || 'PME et start-ups'; }
  var state = null;
`;

function chargerGabarit(htmlSource) {
  const m = htmlSource.match(BORNE_GABARIT);
  if (!m) {
    throw new Error(
      'Les bornes JJ:GABARIT sont introuvables dans index.html. Le gabarit ne ' +
      'peut pas etre decoupe : on n ecrit rien plutot que d ecrire un catalogue ' +
      'produit par une copie du gabarit.'
    );
  }
  const fabrique = new Function(
    AIDES + m[0] + `
    __domVerrouille = true;
    return { grouperParAnnonce: grouperParAnnonce, cardHTML: cardHTML,
             cardGroupeHTML: cardGroupeHTML, cleAnnonce: cleAnnonce,
             pepiteHTML: pepiteHTML, pepitePointsHTML: pepitePointsHTML };`
  );
  return fabrique();
}

// Les offres arrivent dans l'ordre du catalogue publie ; on les rend dans le
// meme ordre, sans filtre et sans pagination. Le JS de la page reecrira ce
// conteneur au chargement avec la vue par defaut : l'etat transitoire montre
// donc PLUS d'offres que l'etat final, jamais moins ni d'autres.
//
// UNE CARTE PAR LIGNE, et ce n'est pas de la cosmétique. Sur une seule ligne,
// git annonce « 1 ligne modifiée » quel que soit le changement : le diff
// quotidien du bot devient illisible, et personne ne relit ce qui est publié.
// Et une ligne unique qui change oblige git à stocker un bloc entier chaque
// jour, là où 800 cartes identiques d'un jour sur l'autre se délestent bien.
// Le coût est de 832 octets bruts, et rien une fois compressé.
//
// Cette fonction est la SEULE à décider de l'espacement. controle-avant-passage
// l'appelle aussi, au lieu de refaire le join de son côté : sans quoi les deux
// divergeraient d'un espace et la comparaison exacte échouerait sur un
// catalogue sain — la panne qu'on vient précisément de corriger.
function rendreCartes(offres, gabarit) {
  const groupes = gabarit.grouperParAnnonce(offres);
  const cartes = groupes
    .map((g) => (g.length > 1 ? gabarit.cardGroupeHTML(g) : gabarit.cardHTML(g[0])));
  return { html: '\n' + cartes.join('\n') + '\n', groupes: groupes.length };
}

// Le bandeau des Pépites était écrit avec `hidden` puis dévoilé par le JS.
// 558 px de haut à 302 px du sommet, révélés APRÈS le premier affichage : tout
// ce qui suit sautait d'un coup. C'est le candidat au CLS de 0,317 que
// Lighthouse mesure sur bureau, et les cinq offres mises en avant étaient au
// passage invisibles pour Google.
//
// Le volet retenu n'est pas écrit en dur : on le lit dans `state` — la page
// affiche ce volet-là au premier rendu, et le HTML doit dire la même chose,
// sinon on remplace un décalage par un autre.
function voletParDefaut(htmlSource) {
  const m = htmlSource.match(/var state = \{[\s\S]{0,200}?volet:\s*'([a-z-]+)'/);
  if (!m) throw new Error("Le volet par defaut est introuvable dans index.html : on n'ecrit pas de pepites plutot que d'en deviner.");
  return m[1];
}

function rendrePepites(offres, gabarit, volet) {
  const pepites = offres.filter((o) => o.volet === volet && o.pepite);
  return {
    piste: pepites.length ? '\n' + pepites.map((o) => gabarit.pepiteHTML(o)).join('\n') + '\n' : '',
    points: pepites.length ? gabarit.pepitePointsHTML(pepites.length) : '',
    nombre: pepites.length,
  };
}

/**
 * Ecrit les cartes entre les bornes d'index.html.
 * @param {Array} offres  le catalogue publie
 * @param {string} suffixe  '' en production ; '-cache' ou '-refonte' sinon,
 *   auquel cas on ecrit index-cache.html et JAMAIS index.html.
 * @returns {{groupes:number, offres:number, octets:number, fichier:string}}
 */
function ecrireCatalogueHtml(offres, suffixe = '') {
  const racine = path.join(__dirname, '..');
  const source = path.join(racine, 'index.html');
  const cible = path.join(racine, `index${suffixe}.html`);

  // On lit TOUJOURS index.html — c'est lui qui porte le gabarit de reference —
  // et on ecrit ailleurs quand le passage n'est pas un vrai passage.
  const html = fs.readFileSync(source, 'utf8');
  const gabarit = chargerGabarit(html);
  const { html: cartes, groupes } = rendreCartes(offres, gabarit);

  if (!BORNE_OFFRES.test(html)) {
    throw new Error('Les bornes JJ:OFFRES sont introuvables dans index.html.');
  }
  // Une fonction, jamais une chaine : un `$&` ou un `$\'` dans un intitule
  // d offre dupliquerait le fichier. C est arrive.
  let sortie = html.replace(BORNE_OFFRES, (_, ouvre, ferme) => ouvre + cartes + ferme);

  // --- Le bandeau des Pepites ------------------------------------------
  if (!BORNE_PEPITES.test(html) || !BORNE_POINTS.test(html) || !BANDEAU.test(html)) {
    throw new Error('Les bornes JJ:PEPITES / JJ:POINTS ou le bandeau sont introuvables dans index.html.');
  }
  const p = rendrePepites(offres, gabarit, voletParDefaut(html));
  sortie = sortie
    .replace(BORNE_PEPITES, (_, a, b) => a + p.piste + b)
    .replace(BORNE_POINTS, (_, a, b) => a + p.points + b)
    // Aucune pepite dans ce volet : le bandeau reste cache, comme le faisait la
    // page. On remet `hidden` plutot que de laisser un cadre vide de 558 px.
    .replace(BANDEAU, () => p.nombre
      ? '<div id="pepites" class="pepites">'
      : '<div id="pepites" class="pepites" hidden>');

  // --- Les textes des familles, pour la fiche metier de la colonne -----
  // Meme source que les quinze pages /familles/ : les recopier ici les
  // condamnerait a diverger.
  if (!BORNE_TEXTES.test(html)) {
    throw new Error('Les bornes JJ:TEXTES sont introuvables dans index.html.');
  }
  // require differe : pages-familles.js nous require pour `chargerGabarit`.
  // En tete de fichier, les deux modules se demanderaient leurs exports avant
  // de les avoir remplis, et le second servi recevrait un objet vide.
  const { slug } = require('./pages-familles');
  const textes = {};
  for (const [famille, t] of Object.entries(TEXTES)) {
    textes[famille] = {
      intro: t.intro || '',
      distinction: t.distinction || '',
      url: '/familles/' + slug(famille) + '.html',
    };
  }
  // `</script>` dans un texte fermerait la balise et casserait la page ;
  // `\u003c` traverse JSON.parse sans que le parseur HTML le voie.
  const json = JSON.stringify(textes).split('<').join('\\u003c');
  sortie = sortie.replace(BORNE_TEXTES, (_, a, b) =>
    a + 'window.__FAMILLES_TEXTES__ = ' + json + ';' + b);
  fs.writeFileSync(cible, sortie);
  return {
    groupes,
    offres: offres.length,
    pepites: p.nombre,
    octets: Buffer.byteLength(cartes, 'utf8'),
    fichier: path.relative(racine, cible),
  };
}

module.exports = { ecrireCatalogueHtml, chargerGabarit, rendreCartes, rendrePepites, voletParDefaut };
