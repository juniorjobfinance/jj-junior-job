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
// Les memes, mais DANS UNE PHRASE : « CDI · CDD » avec un point median ne
// se lit pas dans un titre, et « vie » en minuscules n est pas le sigle.
const LIBELLE_H2 = { stage: 'stage', alternance: 'alternance', vie: 'VIE', 'cdi-cdd': 'CDI et CDD' };

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
  // Les familles qui auront REELLEMENT une page. Une famille sans intro est
  // sautee plus bas : un lien vers elle serait un 404, et le maillage qu on
  // vient de poser deviendrait un piege a explorateur.
  const avecPage = familles.filter(
    (f) => textes[f] && String(textes[f].intro || '').trim());
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
    //
    // LE TEXTE EST LA PAGE. Il vivait dans une bulle `hidden`, ouverte au
    // clic sur un « ? ». Sur l'accueil c'est la bonne forme — la place y
    // manque, et quinze paragraphes dans la colonne de gauche la rendraient
    // illisible. Ici, non : un visiteur venu de Google sur « stage M&A »
    // arrivait sur une liste d'intitulés, sans un mot d'explication. Le seul
    // contenu original du site était caché sur les quinze pages dont il est
    // la raison d'être.
    //
    // Il est donc EN CLAIR et HAUT dans la page, avant la liste d'offres.
    //
    // Et le « ? » disparaît d'ici — il mettait son point d'interrogation
    // DANS le h1 : la page M&A annonçait « Fusions & Acquisitions ? » à
    // Google, au lieu de la requête visée.
    const h1 = esc(t.h1);

    // Deux titres de CONTENU, là où la page n'en avait aucun : ses <h2>
    // étaient « Recherche », « Lieu », « Résultats » — des étiquettes
    // d'interface, qui racontaient un formulaire à Google. Ils se calculent
    // ici faute de mieux ; `h2Metier` et `h2Offres` dans familles-textes.js
    // les remplacent dès qu'ils sont écrits à la main.
    const h2Metier = String(t.h2Metier || '').trim()
      ? esc(t.h2Metier.trim())
      : h1 + '&nbsp;: en quoi consiste le métier&nbsp;?';
    // Le second ne nomme QUE les contrats réellement présents : annoncer un
    // VIE dans le titre quand la famille n'en a aucun est un titre qui ment.
    const h2Offres = String(t.h2Offres || '').trim()
      ? esc(t.h2Offres.trim())
      : 'Offres en ' + h1 + '&nbsp;: ' + presents.map((v) => LIBELLE_H2[v]).join(', ');

    // « À ne pas confondre avec Financements & Coverage » : l'ancre est déjà
    // écrite, il ne manquait que le lien. C'est le maillage le plus naturel
    // qui existe — dix liens sur les quinze pages, mesurés le 13/09/2026.
    //
    // PAR ÉGALITÉ DE CHAÎNE, sur le libellé exact et après échappement.
    // Jamais par ressemblance : « Contrôle » désigne deux familles,
    // « finance » en désigne une troisième, et un liage approximatif aurait
    // envoyé le lecteur sur la mauvaise page sans que rien ne le signale.
    // Du plus long au plus court, au cas où un libellé en contiendrait un
    // autre — ce n'est pas le cas aujourd'hui, et ça ne se surveille pas.
    const lier = (texte) => {
      let out = esc(texte);
      for (const autre of avecPage.slice().sort((a, b) => b.length - a.length)) {
        if (autre === famille) continue;
        const libelle = esc(autre);
        if (!out.includes(libelle)) continue;
        out = out.split(libelle).join(
          '<a href="/' + DOSSIER + '/' + slug(autre) + '.html">' + libelle + '</a>');
      }
      return out;
    };

    const intro =
      '<section class="famille-intro">' +
        '<h2>' + h2Metier + '</h2>' +
        '<p class="famille-texte">' + esc(t.intro) + '</p>' +
        (String(t.distinction || '').trim()
          ? '<p class="famille-distinction">' + lier(t.distinction) + '</p>'
          : '') +
      '</section>';

    page = page
      .replace(/<h1 style="font-size:1\.1rem; margin:0;">Offres<\/h1>/,
        () => '<h1 style="font-size:1.1rem; margin:0;">' + h1 + '</h1>')
      // Le texte se glisse à la place du titre muet « Résultats », donc
      // AVANT la liste des cartes et juste après le h1.
      .replace(/<h2 class="sr-only">Résultats<\/h2>/,
        () => intro + '<h2 class="famille-h2-offres">' + h2Offres + '</h2>');

    // --- Le maillage : les quatorze autres en pied -----------------------
    //
    // Le bloc de liens vient d'index.html : la page en hérite déjà. Ce qui
    // manque est qu'elle ne se lie pas à elle-même — une page qui se cite en
    // lien gaspille un lien, et « la page courante » doit se voir.
    const monLien = '<a href="/' + DOSSIER + '/' + slug(famille) + '.html">' +
      esc(famille) + '</a>';
    page = page.replace(
      /(<!--JJ:FAMILLES-LIENS:DEBUT-->)([\s\S]*?)(<!--JJ:FAMILLES-LIENS:FIN-->)/,
      (_, a, bloc, b) => a + bloc.split(monLien).join(
        '<span class="courant" aria-current="page">' + esc(famille) + '</span>') + b);

    // --- Le fil d'Ariane -------------------------------------------------
    //
    // index.html porte un WebSite, qui serait faux sur une sous-page : on
    // remplace le bloc borné. Pas de JobPosting ici non plus — voir la
    // raison écrite dans index.html, à la borne.
    const fil = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: t.h1, item: url },
      ],
    });
    page = page.replace(
      /(<!--JJ:JSONLD:DEBUT-->)[\s\S]*?(<!--JJ:JSONLD:FIN-->)/,
      (_, a, b) => a + '<script type="application/ld+json">' + fil + '</script>' + b);

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
