// Génère les pages par famille : /familles/<slug>.html
//
// POURQUOI
// Le canonical de l'accueil ramène tous les filtres à `/`, donc le site n'a
// que 3 URL indexables. Quelqu'un qui cherche « alternance contrôle de
// gestion » ne peut tomber sur rien. Quinze pages, une par famille, répondent
// chacune à une recherche réelle — sans page par offre et sans toucher au lien
// sortant, les deux règles fondatrices du projet.
//
// LE SOCLE EST LE SITE, PAS UNE COQUILLE
// Mesuré le 04/09 : le socle pèse 89 % de chaque page. Ce n'est pas de la
// redondance, c'est le mécanisme de retour — la colonne de gauche affiche les
// 15 familles avec leurs compteurs GLOBAUX, donc un visiteur venu de Google
// voit immédiatement les quatorze autres et décoche pour tout voir. Une page
// nue ferait paraître le site plus petit qu'il n'est.
//
// UNE PAGE SANS TEXTE N'EST PAS PUBLIÉE
// Sans introduction propre, quinze pages ne sont que quinze variantes de la
// même — ce que Google traite en contenu dupliqué et ce qu'un visiteur traite
// en perte de temps. Les textes vivent dans familles-textes.js, écrits à la
// main. Une famille dont l'intro est vide est SAUTÉE, et le rapport le dit.
const fs = require('fs');
const path = require('path');
const { chargerGabarit, rendreCartes } = require('./ecrire-catalogue-html.js');

const SITE = 'https://juniorjobfinance.com';
const DOSSIER = 'familles';
const VOLETS = ['stage', 'alternance', 'vie', 'cdi-cdd'];
const LIBELLE = { stage: 'Stage', alternance: 'Alternance', vie: 'VIE', 'cdi-cdd': 'CDI · CDD' };

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {Array}  offres   le catalogue publie
 * @param {string} suffixe  '' en production ; sinon on ecrit ailleurs
 * @returns {{ecrites:Array, sautees:Array, inconnues:Array}}
 */
function ecrirePagesFamilles(offres, suffixe = '') {
  const racine = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
  const gabarit = chargerGabarit(html);

  let textes = {};
  try {
    delete require.cache[require.resolve('./familles-textes.js')];
    textes = require('./familles-textes.js');
  } catch (e) {
    return { ecrites: [], sautees: [], inconnues: [], erreur: e.message };
  }

  const familles = [...new Set(offres.map((o) => o.famille).filter(Boolean))];
  const dossier = path.join(racine, DOSSIER + suffixe);
  const ecrites = [], sautees = [], inconnues = [];

  // Une entree de textes qui ne correspond a aucune famille du catalogue est
  // une faute de frappe : elle ne produit pas une page vide, elle produit une
  // famille SANS page, en silence. On la signale.
  for (const cle of Object.keys(textes)) {
    if (!familles.includes(cle)) inconnues.push(cle);
  }

  for (const famille of familles) {
    const t = textes[famille];
    if (!t || !String(t.intro || '').trim()) {
      sautees.push(famille);
      continue;
    }
    const siennes = offres.filter((o) => o.famille === famille);
    const presents = VOLETS.filter((v) => siennes.some((o) => o.volet === v));
    const pepites = siennes.filter((o) => o.pepite);
    const url = SITE + '/' + DOSSIER + '/' + slug(famille) + '.html';

    let page = html;

    // --- Les chemins : la page est un cran plus bas ---------------------
    page = page
      .replace(/src="offres\.js"/g, 'src="/offres.js"')
      .replace(/src="\/mesure\.js"/g, 'src="/mesure.js"')
      .replace(/url\('polices\//g, "url('/polices/")
      .replace(/href="(confidentialite|mentions-legales|404)\.html"/g, 'href="/$1.html"')
      .replace(/href="offres\.xml"/g, 'href="/offres.xml"');

    // --- Ce que la page dit d'elle-meme ---------------------------------
    page = page
      .replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + esc(t.titre) + '</title>')
      .replace(/(<meta name="description" content=")[^"]*(")/,
        (_, a, b) => a + esc(t.description) + b)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, (_, a, b) => a + url + b)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,
        (_, a, b) => a + esc(t.titre) + b)
      .replace(/(<meta property="og:description" content=")[^"]*(")/,
        (_, a, b) => a + esc(t.description) + b)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => a + url + b);

    // --- La barre : des bascules, et pas de bouton mort -----------------
    const boutons = presents.map((v) =>
      '  <button type="button" class="filtre-contrat" data-volet="' + v + '" aria-pressed="false">' +
      LIBELLE[v] + '</button>').join('\n');
    page = page.replace(/<nav class="tabs" role="tablist" aria-label="Type de contrat">[\s\S]*?<\/nav>/,
      () => '<nav class="tabs" role="group" aria-label="Filtrer par type de contrat">\n' +
        boutons + '\n  <span class="total" id="total-count" aria-hidden="true"></span>\n</nav>');

    // --- Le titre et le texte -------------------------------------------
    // Un depliant, pas un pave : une ligne en tete de page, le texte au clic.
    // Un « ? » à côté du h1, et la bulle juste après — le même composant que
    // la colonne de l'accueil, `.jj-aide` + `.jj-bulle`, branché une fois
    // pour toutes par brancherAide().
    //
    // La bulle est écrite EN DUR ici, jamais injectée par JavaScript : c'est
    // la raison d'être de ces quinze pages — Google doit lire ce texte dans
    // le HTML servi, bulle fermée comprise. `hidden` l'y laisse, et
    // `position: fixed` la garde hors flux dans les deux états, si bien que
    // l'ouvrir ne pousse jamais les offres vers le bas.
    const idBulle = 'aide-' + slug(famille);
    const bouton =
      ' <button type="button" class="jj-aide" aria-expanded="false"' +
      ' aria-controls="' + idBulle + '"' +
      ' aria-label="En quoi consiste le métier : ' + esc(famille) + ' ?">?</button>';
    const bulle =
      '<div class="jj-bulle" id="' + idBulle + '" hidden>' +
        '<p class="jj-bulle-titre">' + esc(famille) + '</p>' +
        '<p>' + esc(t.intro) + '</p>' +
        (String(t.distinction || '').trim()
          ? '<p class="jj-bulle-distinction">' + esc(t.distinction) + '</p>'
          : '') +
      '</div>';
    page = page.replace(/<h1 style="font-size:1\.1rem; margin:0;">Offres<\/h1>/,
      () => '<h1 style="font-size:1.1rem; margin:0;">' + esc(t.h1) + bouton + '</h1>' + bulle);

    // --- Le contexte de la page -----------------------------------------
    page = page
      .replace(/  var FAMILLE_PAGE = null;/, () => '  var FAMILLE_PAGE = ' +
        JSON.stringify(famille) + ';')
      .replace(/(  var state = \{\r?\n)    volet: 'stage',\r?\n    familles: new Set\(\),/,
        (_, a) => a + "    // Page de famille : aucun contrat filtre au depart.\n" +
          "    volet: '',\n    familles: new Set([" + JSON.stringify(famille) + "]),");

    // --- Le contenu ------------------------------------------------------
    page = page
      .replace(/(<!--JJ:OFFRES:DEBUT-->)[\s\S]*?(<!--JJ:OFFRES:FIN-->)/,
        (_, a, b) => a + rendreCartes(siennes, gabarit).html + b)
      .replace(/(<!--JJ:PEPITES:DEBUT-->)[\s\S]*?(<!--JJ:PEPITES:FIN-->)/,
        (_, a, b) => a + (pepites.length
          ? '\n' + pepites.map((o) => gabarit.pepiteHTML(o)).join('\n') + '\n' : '') + b)
      .replace(/(<!--JJ:POINTS:DEBUT-->)[\s\S]*?(<!--JJ:POINTS:FIN-->)/,
        (_, a, b) => a + (pepites.length ? gabarit.pepitePointsHTML(pepites.length) : '') + b)
      .replace(/<div id="pepites" class="pepites"( hidden)?>/,
        () => pepites.length ? '<div id="pepites" class="pepites">'
          : '<div id="pepites" class="pepites" hidden>');

    fs.mkdirSync(dossier, { recursive: true });
    const fichier = path.join(dossier, slug(famille) + '.html');
    fs.writeFileSync(fichier, page);
    ecrites.push({ famille, fichier: path.relative(racine, fichier), url,
      offres: siennes.length, boutons: presents.length, pepites: pepites.length,
      octets: Buffer.byteLength(page, 'utf8') });
  }

  return { ecrites, sautees, inconnues };
}

module.exports = { ecrirePagesFamilles, slug };
