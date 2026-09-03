#!/usr/bin/env node
// ingestion/pipeline.js
//
// Pipeline d'ingestion JJ (voir PROJET.md §7 et §8). Tourne 1x/jour (cron / GitHub
// Action). Étapes : normalisation -> classement onglet -> inférence famille/structure
// -> filtre junior -> déduplication -> retrait des offres mortes -> écriture offres.js.
//
// Usage :
//   node ingestion/pipeline.js               (hors-ligne / sources configurées)
//   node ingestion/pipeline.js --check-links (vérifie aussi les liens en HTTP HEAD)

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchAllSources, sourcesReprises, isFinanceOfferFor } = require('./sources');
const { trouverMaison, MAISONS } = require('./maisons');

const CHECK_LINKS = process.argv.includes('--check-links');
const STATE_PATH = path.join(__dirname, 'state.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'offres.js');
const RSS_PATH = path.join(__dirname, '..', 'offres.xml');
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

// Adresse publique du site : sert au flux RSS et au sitemap. À changer ici et
// nulle part ailleurs le jour où un vrai nom de domaine remplace le sous-domaine
// Vercel.
const SITE_URL = 'https://juniorjobfinance.com';

// Une offre absente de la collecte pendant plus de ce délai est retirée.
//
// La tolérance se compte en JOURS, plus en passages. Un compteur de passages
// est indissociable de la fréquence du cron : à raison d'un passage par jour,
// « 3 passages » valait trois jours ; en passant à un passage par heure, la
// même règle aurait supprimé des offres bien vivantes au bout de trois heures.
// Exprimée en jours, elle dit ce qu'elle veut dire et survit à tout changement
// de rythme — y compris à un rythme différent selon les maisons.
//
// Trois jours : de quoi encaisser une source indisponible deux matins de suite
// sans laisser traîner une offre pourvue plus d'une poignée de jours.
const MAX_JOURS_ABSENCE = 3;

// Âge maximum d'une offre. Deux seuils, parce que "vieille" ne veut pas dire
// la même chose selon d'où vient l'annonce.
//
// AGRÉGATEURS (France Travail, Adzuna, open data BPCE) : ils gardent des copies
// d'annonces que l'employeur a déjà retirées. Une offre de plus d'un mois y est
// le plus souvent pourvue — c'est le "ghost job" que JJ combat (§2). On coupe
// à 30 jours, comme convenu.
//
// ATS DIRECT de la maison (Workday, Recruitee, SmartRecruiters, Greenhouse...) :
// là, l'annonce est encore EN LIGNE chez l'employeur aujourd'hui. Si elle était
// pourvue, elle aurait été dépubliée — et la règle d'absence la sortirait du
// site en 3 passages. Sa présence vaut donc mieux qu'une date de publication.
// Couper à 30 jours ici revenait à jeter des offres vivantes : 21 des 22 postes
// finance de Thales, la totalité de PAI Partners et d'Accor. Le plafond haut ne
// sert plus qu'à écarter les zombies manifestes (Saint-Gobain laisse en ligne
// des annonces de 2018).
const MAX_AGE_JOURS = 30;
const MAX_AGE_JOURS_ATS_DIRECT = 120;
// Un CDI ou un CDD publié il y a plus de deux mois est presque toujours
// pourvu : l'annonce reste en ligne, mais le poste ne l'est plus. Le seuil
// long ne vaut que pour les stages, les alternances et les VIE, dont les
// campagnes s'ouvrent des mois à l'avance — une promotion d'été 2027 se
// candidate dès l'automne 2026.
const MAX_AGE_JOURS_CDI_CDD = 60;

// Les sources qui republient les annonces d'autrui, par opposition à celles qui
// lisent l'ATS de la maison elle-même.
// « opendatasoft » a été retiré de cette liste : le portail de données
// ouvertes du groupe BPCE est SA propre publication, pas un agrégateur. Le
// seuil de 30 jours lui appliquait une sévérité quatre fois supérieure à
// celle des autres maisons, et écartait 28 de leurs 51 stages et
// alternances.
const SOURCES_AGREGATEUR_RE = /^(francetravail|adzuna|labonnealternance)/;

// Les employeurs absents de la liste de référence ne sont plus écartés : ils
// sont REGROUPÉS. Chaque offre garde le nom exact de son employeur sur la carte
// — c'est là que le candidat postule — mais dans le filtre "Entreprise" les
// deux cents PME, cabinets et associations tiennent une seule ligne au lieu de
// deux cents.
//
// C'est ce qui permet d'avoir le volume ET la lisibilité : un étudiant qui
// cherche Rothschild ou Amundi les repère toujours d'un coup d'œil, sans faire
// défiler des dizaines de noms qu'il ne connaît pas.
const MAISON_AUTRES = 'PME et start-ups';

// Mettre à true pour revenir à un site strictement limité aux maisons de
// référence : les offres du groupe MAISON_AUTRES sont alors écartées.
const MAISONS_DE_REFERENCE_SEULEMENT = false;

// Toutes les sources ne datent pas leurs offres. Celles listées ici renvoient
// une VRAIE date de publication ; les autres (TalentSoft, SuccessFactors et le
// framework e-i n'exposent aucune date, ni en liste ni sur la fiche) reçoivent
// la date du passage. Faire passer cette date-là pour une date de publication
// serait mensonger : ces offres apparaîtraient toutes comme "publiées
// aujourd'hui" et trusteraient le haut du tri. On marque donc la fiabilité,
// et l'affichage comme le tri en tiennent compte.
//
// Figurer ici ne dit pas que TOUTES les offres de la source sont datées : c'est
// `_dateDeLaSource`, calculé offre par offre, qui tranche. Une source listée
// dont telle annonce n'a pas de date la voit rester « incertaine », et part
// quand même lire sa fiche.
//
// `yello`, `liste` et `avature` ont rejoint la liste le 03/09/2026, quand on a
// découvert où ils cachaient leur date : sur la carte pour EY (« 25 août ») et
// La Banque Postale (<time datetime>), dans le sitemap pour TotalEnergies.
// Leur date était lue depuis ce matin-là, mais restait affichée « incertaine »
// faute d'être ici — et leurs offres échappaient au filtre d'âge, ce qui
// laissait vivre une annonce TotalEnergies de 498 jours.
const SOURCES_DATE_FIABLE_RE =
  /^(francetravail|labonnealternance|adzuna|opendatasoft|lever|greenhouse|workday|ashby|recruitee|teamtailor|smartrecruiters|oraclecloud|phenom|sitemapld|servicepublic|vie|manuel|bpce|cornerstone|axafr|lvmh|talentlink|talentview|radancy|wordpress|goldman|yello|liste|avature)/;

// ---------------------------------------------------------------------------
// Référentiels de classification
// ---------------------------------------------------------------------------

// Familles métier. Le découpage précédent (9 familles) souffrait de deux maux :
// "Commercial & Relation client" mélangeait les conseillers d'agence bancaire et
// les gestionnaires de sinistres — deux métiers qui n'ont rien en commun — et
// "Risques & Conformité" servait de fourre-tout, récupérant tout ce que les
// règles ne reconnaissaient pas. Un étudiant qui cochait "Risques" tombait sur
// des actuaires et des account managers.
//
// Ce découpage-ci suit les métiers tels que les nomment les écoles et les
// recruteurs, et la case fourre-tout porte désormais son vrai nom.
// Familles AFFICHÉES sur le site. Le principe posé au départ : JJ doit rester
// lisible pour un étudiant qui découvre le secteur. Seize cases classaient
// juste mais se lisaient mal — dix suffisent, aucune quasi-vide, des noms
// qu'un étudiant comprend. La précision, elle, reste dans les règles : elles
// distinguent seize métiers, puis CONSOLIDATION_FAMILLES les replie sur dix.
// Corriger un classement se fait donc dans les règles ; changer le découpage
// visible se fait ici et dans la table de repli, sans toucher aux règles.
// Familles = des MÉTIERS purs, jamais des secteurs. « Assurance » et « Banque
// de détail » ne sont pas des métiers : ce sont des types de structure, et ils
// vivent déjà dans le filtre correspondant. Un gestionnaire de sinistres et un
// conseiller bancaire font le même métier de fond — la relation client — chez
// deux employeurs différents.
// Deux axes, deux vocabulaires. Les FAMILLES nomment une ACTIVITÉ (ce qu'on
// fait) ; les SECTEURS nomment une INSTITUTION (qui emploie) et commencent tous
// par Banque, Société, Cabinet, Compagnie, Entreprise ou Institution. Aucune
// expression n'apparaît sur les deux axes — sans quoi le lecteur ne sait plus
// lequel il filtre : « M&A & Banque d'affaires » côté métier et « Banque
// d'affaires & marchés » côté entreprise se marchaient dessus.
// LES DOUZE MÉTIERS DE LA FINANCE JUNIOR
//
// Deux exigences se contredisent et doivent pourtant tenir ensemble : un
// étudiant qui ne sait pas encore ce qu'il veut doit comprendre chaque intitulé
// sans glossaire, et celui qui vise déjà le M&A ou la dette privée doit y
// retrouver SON métier, pas une catégorie vague qui l'englobe.
//
// D'où le découpage par MÉTIER RÉEL et non par grande fonction. Trois
// séparations comptent particulièrement :
//
//   - Capital-investissement ≠ Gestion d'actifs. Le premier achète des
//     entreprises non cotées et siège à leur conseil ; le second gère des
//     portefeuilles de titres cotés. Ce sont deux voies, deux recrutements,
//     deux carrières — les fondre revenait à dire à un candidat PE que le
//     stage chez Amundi lui correspond.
//   - Banque privée ≠ Gestion d'actifs. On y conseille des particuliers
//     fortunés, pas des institutionnels.
//   - Opérations & Middle-office ≠ Data & Quant. Un gestionnaire back-office
//     titres et un analyste quantitatif n'ont ni le même métier ni la même
//     formation. Les mêler mettait « Back Office Monétique » sous « Data &
//     Quant », ce qui trompait les deux publics à la fois.
//
// L'ordre suit le parcours d'un étudiant : les métiers de deal et de marché
// d'abord, la gestion ensuite, les fonctions d'entreprise après, le support
// pour finir.
const FAMILLES = [
  'Fusions & Acquisitions',
  'Marchés financiers',
  'Capital-investissement',
  "Gestion d'actifs",
  'Banque privée & Patrimoine',
  'Audit & Contrôle interne',
  'Conseil & Transformation',
  'Comptabilité & Consolidation',
  'Contrôle de gestion & Trésorerie',
  'Risques & Conformité',
  'Data & Quant',
  'Opérations & Middle-office',
  'Autres métiers de la finance',
];

// JJ s'adresse aux étudiants et jeunes diplômés qui visent un MÉTIER de la
// finance : analyse, audit, M&A, marchés, gestion d'actifs, risques, contrôle
// de gestion. Le recrutement de réseau — conseiller d'agence, commercial en
// assurance, chargé de clientèle particuliers — relève d'un autre métier et
// d'un autre public. Il représentait 480 offres sur 1 484 (32 % du site),
// presque toutes en CDI, publiées en masse ville par ville : il écrasait le
// catalogue et noyait les postes réellement recherchés. Les offres qui
// retombent dans cette famille ne sont donc pas publiées.
const FAMILLE_HORS_PERIMETRE = 'Commercial & Relation client';

// Famille fine (celle des règles) -> famille affichée.
//
// Cette table est le point où le classement se joue vraiment : des règles fines
// justes peuvent être ruinées par une consolidation qui les verse au mauvais
// endroit. C'était le cas — « Middle & Back Office » et « Organisation &
// Projets » atterrissaient tous deux dans « Data & Quant », qui affichait donc
// « Gestionnaire Back Office Monétique » à un étudiant venu chercher du
// quantitatif.
const CONSOLIDATION_FAMILLES = {
  // Hors périmètre : réseau d'agence et distribution d'assurance.
  'Banque de détail & clientèle': 'Commercial & Relation client',
  'Assurance — distribution & sinistres': 'Commercial & Relation client',

  // Métiers de deal et de marché.
  'M&A & Transaction Services': 'Fusions & Acquisitions',
  'Marchés & Front Office': 'Marchés financiers',

  // Les trois métiers de la gestion, désormais distincts. Ils partageaient
  // auparavant une seule case, ce qui revenait à confondre un fonds de LBO,
  // un gérant actions et un banquier privé.
  'Private Equity & Infrastructure': 'Capital-investissement',
  "Gestion d'actifs & Wealth": "Gestion d'actifs",
  'Banque privée & Patrimoine': 'Banque privée & Patrimoine',

  // Vérification et accompagnement : deux métiers, deux recrutements, deux
  // carrières. Les fondre masquait la différence entre auditer les comptes
  // d'un client et conduire sa transformation.
  'Audit & Contrôle interne': 'Audit & Contrôle interne',
  'Conseil': 'Conseil & Transformation',
  'Organisation & Projets': 'Conseil & Transformation',

  // Fonctions financières de l'entreprise.
  'Comptabilité & Consolidation': 'Comptabilité & Consolidation',
  'Contrôle de gestion & FP&A': 'Contrôle de gestion & Trésorerie',
  'Trésorerie & Financement': 'Contrôle de gestion & Trésorerie',

  // Maîtrise des risques. L'actuariat y reste rattaché : c'est le même univers
  // réglementaire et les mêmes recruteurs, et le volume ne justifie pas encore
  // une famille à part.
  'Risques & Conformité': 'Risques & Conformité',
  'Actuariat': 'Risques & Conformité',

  // Chiffre et exécution, enfin séparés.
  'Data & Quant': 'Data & Quant',
  'Middle & Back Office': 'Opérations & Middle-office',

  'Autres métiers de la finance': 'Autres métiers de la finance',
};

// L'ordre compte : la première règle qui correspond gagne. Les métiers les plus
// spécifiques passent donc avant les plus larges — sans quoi "Analyste M&A"
// tomberait dans "Marchés" à cause du mot "analyste".
//
// Les motifs s'appuient sur des RADICAUX ("charg", "conseill", "gestionnaire")
// plutôt que sur des mots entiers : les intitulés arrivent au masculin, au
// féminin et au pluriel, et "Chargée d'affaires" ne correspondait pas à un
// motif écrit "chargé".
const FAMILLE_RULES = [
  // --- Spécialités identifiables sans ambiguïté ---------------------------
  [/actuari|actuair|tarification (?:vie|sant|iard)|provisionnement|\bsolvab(?:ilit[ée])? ?ii\b/i, 'Actuariat'],
  // Fusions & Acquisitions : le conseil aux entreprises qui achètent, vendent ou
  // lèvent des fonds. Le private equity, lui, part vers l'INVESTISSEMENT — on
  // n'y conseille pas une opération, on la finance et on détient la société.
  [/\bm&a\b|fusions?[\s-]?acquisitions?|due diligence|transaction services|strategy (?:and|&) transactions|corporate finance|leveraged finance|\becm\b|\bdcm\b|deal advisory|[ée]valuation d'entreprise|origination|syndication|introduction en bourse|\bipo\b|banque d'affaires|investment banking|\bgib\b|debt advisory|restructuring/i, 'M&A & Transaction Services'],
  [/data scien|data analyst|analyste data|\bquant\b|quantitati[fv]|machine learning|mod[ée]lisation|\bdatavi|business intelligence|\bdata\b (?:engineer|manager|steward)|[ée]tudes statistiques|statisticien|donn[ée]es financi[èe]res|data (?:and|&) (?:process|reporting)|chief data officer|data project/i, 'Data & Quant'],

  // --- Assurance : sinistres, contrats, distribution -----------------------
  // --- Services titres et clientèle institutionnelle -----------------------
  // Ce vocabulaire est celui du métier titres et de la clientèle de gros ; un
  // guichet d'agence ne parle jamais d'OST, de dépositaire ou d'investor
  // services. La règle vient AVANT celles de l'assurance et du réseau, qui
  // sont volontairement très larges et happaient ces postes : « Gestionnaire
  // Opérations Garanties » partait en assurance (le mot « garantie »),
  // « Chargé service clients institutionnels » aussi (« service clients »).
  [
    /transaction management|trade finance|op[ée]rations? garanties|asset servicing|investor services|funds? solutions|securities finance|conservation de titres|d[ée]positaire|op[ée]rations? sur titres|op[ée]rations? client[èe]le|op[ée]rations? [ée]metteurs?|service[s]? [ée]metteurs?|\bost\b|client[es]? institutionnel|institutionnels et souverains|fund (?:administration|accounting|execution|distribution)/i,
    'Middle & Back Office',
  ],

  [/sinistre|indemnisation|souscript|\biard\b|pr[ée]voyance|assurance de personnes|courtage|gestionnaire.{0,20}(?:assurance|contrat|garantie)|conseill.{0,20}assurance|assurances? collectives?|assurance (?:emprunteur|construction|sant[ée])|assurance de personnes?|prestations? sant[ée]|gestionnaire (?:retraite|pr[ée]vention|technique)|satisfaction adh[ée]rent|r[ée]clamations?|op[ée]rations? d.assurance|relations? grands? clients?|production grands comptes|accompagnement clients?|assurances? professionnelles?|assistance clients?|service clients?|client service|(?<!investor )relations? clients?|gestion international|gestion individuelle|comptes? multi[\s-]activit|charg[ée]e? d.affaires entrepreneurs|\bretraite\b|op[ée]rations assurance|assurance vie|gestion internationale|centre de services|gestionnaire op[ée]rationnel|\binsurance\b/i, 'Assurance — distribution & sinistres'],

  // --- Marchés, gestion, opérations ---------------------------------------
  // Marchés & Front Office : le vocabulaire du métier, en français comme en
  // anglais. Sans « fixed income », « cross asset », « produits structurés » ou
  // « dérivés », les postes les plus recherchés de Lazard, Goldman, BNP ou ODDO
  // tombaient tous dans « Autres métiers de la finance ».
  [/front[\s-]?office|salle des march[ée]s|trading|\btrader\b|structuration|capital market|taux et change|\bfx\b|produits? d[ée]riv[ée]|d[ée]riv[ée]s?\b|derivativ|march[ée]s financiers|finance de march[ée]|financial market|structuring|\bpricing\b|cross[\s-]?asset|fixed income|high yield|\bobligataire\b|produits? structur|solutions? structur|blended finance|execution and clearing|\bclearing\b|\bsales\b\s*(?:&|et)\s*trading|equity capital|debt capital|\bdcm\b|\becm\b|\bcoverage\b|op[ée]rateur de march[ée]|analyste actions?|\bfo\/fi\b|garanties internationales|financements? syndiqu|syndicated loan|network banking|produits? structur[ée]s? financial|structured product|healthcare sector|march[ée] de l.[ée]nergie|real[\s-]?time analyst|[ée]tudes financi[èe]res|analyse cr[ée]dit|titrisation|\bipv\b|collateral|digital assets|controls on equity|global (?:corporate )?banking|global markets|corporate banking|primary distribution/i, 'Marchés & Front Office'],
  // Gestion d'actifs : la vente institutionnelle (« sales gestion
  // institutionnelle », « coverage institutionnel ») est un métier de la gestion
  // d'actifs, pas du réseau — c'est la distribution de produits financiers à des
  // investisseurs professionnels.
  // Investissement & Private equity : on place l'argent de clients — dans des
  // sociétés (private equity, venture) ou dans des fonds (gestion d'actifs).
  // La vente institutionnelle en fait partie : c'est la distribution de produits
  // financiers à des investisseurs professionnels, pas du réseau.
  // Les trois métiers de la gestion, séparés par ce qu'on gère et pour qui.
  // L'ordre va du plus spécifique au plus large : « Private Equity Real Estate »
  // doit partir au capital-investissement, pas à la gestion d'actifs.

  // 1) Capital-investissement : on achète des entreprises ou des actifs non
  //    cotés — LBO, croissance, infrastructure, immobilier, dette privée.
  //    « Fund management » chez un fonds désigne la gestion du véhicule
  //    d'investissement lui-même, pas la gestion de portefeuille cotée.
  [/private equity|private debt|private credit|private assets|private capital|capital[\s-]?investissement|capital d[ée]veloppement|venture capital|\bvc\b fund|\blbo\b|\bmlbo\b|buyout|growth (?:equity|capital)|direct lending|mezzanine|dette priv[ée]e|infrastructure fund|fonds d'infrastructure|real estate (?:fund|equity|investment|debt)|secondaries|co[\s-]?investment|\bgp\b stake|fund of funds|fund finance|fund management|dette d'infrastructure|^real estate\b|^infrastructure\b|^capital\b|secondary opportunities|venture (?:fund|capital)|five arrows|meridiam/i, 'Private Equity & Infrastructure'],

  // 2) Banque privée et patrimoine : on conseille des particuliers fortunés.
  [/banque priv[ée]e|banquier[\s.]?priv[ée]|private bank|gestion priv[ée]e|gestion de patrimoine|ing[ée]nierie patrimoniale|patrimonia|\bwealth\b|family office/i, 'Banque privée & Patrimoine'],

  // 3) Gestion d'actifs : on gère des portefeuilles pour des institutionnels.
  //    Les relations investisseurs y sont rattachées — lever et suivre les
  //    encours est le métier commercial de la gestion, pas du réseau.
  [/asset management|gestion d'actifs|gestion de portefeuille|portfolio|\bopcvm\b|\bg[ée]rant|conseill.{0,15}investissement|\binvestment\b|\besg\b|extra[\s-]?financi|sustainab|durabilit[ée]|gestion institutionnelle|client[èe]les? institutionnel|investisseurs? institutionnel|institutional client|fonds structur|multi[\s-]?gestion|s[ée]lection de fonds|fund selection|\bfonds\b|analyste? buy[\s-]?side|investor relations|relations? investisseurs?|fundrais|lev[ée]e de fonds|investment solutions|multi[\s-]?management|fund (?:analyst|distributor)|distributeur de fonds|clients? institutionnels?|investissements? actions?|\brse\b|\be&s\b analyst|gestionnaire de portefeuille|investissements? durables?/i, "Gestion d'actifs & Wealth"],
  // Opérations : tout ce qui fait tourner la machine derrière le front office.
  // Le mot « operations » seul ne suffisait pas — il fallait « opérations
  // bancaires » — si bien que « Banking Operations », « Finance Operations
  // EMEA » ou « Fund Manager Operations Officer » stagnaient dans le
  // fourre-tout alors que c'est le même métier.
  [/middle[\s-]?office|back[\s-]?office|front to back|d[ée]positaire|custody|fund admin|r[èe]glement[\s-]livraison|post[\s-]?march[ée]|cr[ée]dits? documentaires?|flux edi|\bt2s\b|succession|moyens de paiement|mon[ée]tique|\bswift\b|settlement|corporate actions|valorisation de fonds|instruments? financiers?|unit[ée]s? de comptes?|services bancaires|client onboarding|(?:banking|finance|fund|central|securities|business|distributor|manager)\s+operations?|operations? officer|op[ée]rations? et processus|documentation drafting|gestionnaire des processus|suivi d.activit[ée]|charg[ée]e? de commissions|business management|op[ée]rations?\s+(?:bancaires?|titres?|financi[èe]res?|de march[ée]|transverses?|fund|infrastructure)/i, 'Middle & Back Office'],

  // --- Finance d'entreprise ------------------------------------------------
  [/comptab|accounting|accountant|consolid|analyste fiscal|fiscalit[ée]|cl[ôo]ture comptable|r[ée]vision comptable|facturation|\bdaf\b|gestionnaire de paie|\bpaie\b|administration des ventes|\badv\b/i, 'Comptabilité & Consolidation'],
  [/contr[ôo]le de gestion|contr[ôo]leur de gestion|controlling|\bcontroller\b|\bfp&a\b|business partner|budg[ée]t|reporting financier|performance financi[èe]re|cost control|pilotage financier|contr[ôo]leur? financi|contr[ôo]le financier|performance analyst|analyse business unit|contr[ôo]leur op[ée]rations|p&l|business performance|performance op[ée]rationnelle|\balm\b|asset & liability/i, 'Contrôle de gestion & FP&A'],
  [/tr[ée]sorerie|tr[ée]sorier|treasury|cash management|financement structur|financement immobilier|charg.{0,15}financement|credit management|recouvrement|analyste cr[ée]dit|risque de cr[ée]dit|\bcr[ée]dit\b/i, 'Trésorerie & Financement'],

  // --- Audit, conseil, risques ---------------------------------------------
  [/audit|commissariat aux comptes|commissaire aux comptes|contr[ôo]leurs? (?:interne|permanent)|contr[ôo]le (?:interne|permanent)|internal control|inspection g[ée]n[ée]rale/i, 'Audit & Contrôle interne'],
  [/risque|\brisk\b|conformit[ée]|compliance|\bkyc\b|\blcb.?ft\b|\baml\b|\bcsrd\b|\bsfdr\b|reporting extra[\s-]?financier|r[ée]tablissement|r[ée]solution|solvabilit[ée]|tarification|gestion de crise|financial crime|gouvernance|surveillance|blanchiment|d[ée]ontolog|s[ée]curit[ée] financi[èe]re|sanctions|fraude|contentieux|reporting r[ée]glementaire|regulatory reporting|d[ée]claratif/i, 'Risques & Conformité'],
  [/consult|conseil\b|advisory|transformation|pilotage de programme|analyste? strat[ée]g|operational project|project (?:officer|manag)|\bpmo\b|market intelligence|business insights|performance et animation|growth strategy|strategy (?:and|&) partnerships|syst[èe]mes? d.informations? finance/i, 'Conseil'],

  // --- Analyse et recherche -------------------------------------------------
  [/analyse financi[èe]re|analyste financier|financial analyst|finance analyst|finance officer|[ée]quity research|\bresearch\b|[ée]conomist|[ée]tudes [ée]conomiques|strat[ée]giste/i, 'Marchés & Front Office'],

  // --- Organisation, MOA, projets ------------------------------------------
  [/business analyst|\bmoa\b|\bamoa\b|ma[îi]trise d'ouvrage|chef(?:fe)? de projet|product owner|organisation et projets|\bpmo\b/i, 'Organisation & Projets'],

  // --- Banque de financement : à sauver AVANT la règle « réseau » -----------
  // Un « Originateur Sustainable Banking » ou un « Chargé d'affaires » en
  // financement de projet sont des postes de banque de financement, pas des
  // conseillers d'agence. Sans cette règle, le motif très large ci-dessous les
  // happerait et ils disparaîtraient avec le réseau.
  [/originat|syndication|financement de projet|project finance|sustainable banking|financement durable|leveraged finance|debt capital|equity capital|\bdcm\b|\becm\b|banque d'affaires|corporate (?:&|et) investment|\bcib\b|lenders? (?:insurance )?advisory/i, 'Marchés & Front Office'],

  // --- Réseau bancaire et commercial : le plus large, donc en dernier -------
  // « coverage » a été retiré d'ici : en banque de financement comme en gestion
  // d'actifs, c'est un poste de front office (couverture d'un portefeuille de
  // clients institutionnels), jamais du guichet. Ajoutés en revanche l'accueil
  // et le guichet, qui n'étaient captés par aucune règle et se retrouvaient
  // dans « Autres métiers de la finance ».
  [/conseill|charg.{0,4} (?:de client|d'affaires|de stmt)|client[èe]le|agence bancaire|banque de d[ée]tail|commercial|d[ée]veloppement|relation client|account manager|charg.{0,4} d'affaires|business development|\bagence\b|\baccueil\b|\bguichet\b/i, 'Banque de détail & clientèle'],
];

// Les intitulés français sont truffés d'écriture inclusive :
// "Contrôleur(se) de gestion", "Contrôleur / Contrôleuse de gestion",
// "Chargé.e de suivi". Ces formes cassent les règles de classement — un poste
// de contrôle de gestion se retrouvait alors dans le fourre-tout au lieu de
// "Finance d'entreprise". On aplatit ces variantes AVANT de classer.
function normaliserPourClassement(text) {
  return (
    (text || '')
      // "Contrôleur(se)", "Chargé(e)", "CONTROLEUR(EUSE)" -> on retire la parenthèse
      .replace(/\(([a-zà-öø-ÿ]{1,6})\)/gi, '')
      // "Chargé.e", "Chargé·e" -> "Chargé"
      .replace(/([a-zà-öø-ÿ])[.·]e\b/gi, '$1')
      // "Contrôleur / Contrôleuse" -> "Contrôleur" (on garde la 1re forme)
      .replace(/\s*\/\s*[A-Za-zà-öø-ÿ]+(?=\s)/g, ' ')
      // "Contrôleuse" -> "Contrôleur" (féminins en -euse/-rice/-ère)
      .replace(/euse\b/gi, 'eur')
      .replace(/trice\b/gi, 'teur')
      .replace(/\s+/g, ' ')
  );
}

// Chez un cabinet de conseil, les intitulés génériques désignent le métier du
// cabinet : « Business Analyst » et « Associate » chez McKinsey ou BCG sont les
// deux premiers échelons du consultant, pas de la maîtrise d'ouvrage ni de la
// banque d'affaires. Le titre seul ne peut pas le dire — l'employeur, si.
const MAISON_DE_CONSEIL_RE =
  /mckinsey|boston consulting|\bbcg\b|\bbain\b|roland berger|oliver wyman|kearney|alixpartners|accenture|capgemini|wavestone|sia partners|julhiet|eight advisory|talan|\bstrategy&\b/i;
const TITRE_GENERIQUE_CONSEIL_RE =
  /business analyst|\bassociate\b|\bconsultant\b|\banalyst\b|\banalyste\b|\bpartner\b|engagement manager/i;

function inferFamille(title, romeLibelle, emp) {
  const parTitre = inferFamilleParTitre(title, romeLibelle);
  // L'employeur ne tranche que si l'intitulé n'a rien dit de précis. « Business
  // Analyst Risque de crédit » chez Talan reste rangé sous les risques : sa
  // spécialité en apprend plus au candidat que le métier du cabinet. Mais
  // « Business Analyst » tout court chez McKinsey n'est pas de la maîtrise
  // d'ouvrage — c'est le premier échelon du consultant.
  const generique = parTitre === 'Data & Quant' || parTitre === 'Autres métiers de la finance';
  if (
    generique &&
    emp &&
    MAISON_DE_CONSEIL_RE.test(emp) &&
    TITRE_GENERIQUE_CONSEIL_RE.test(title || '')
  ) {
    return CONSOLIDATION_FAMILLES['Conseil'] || 'Conseil';
  }
  return parTitre;
}

function inferFamilleParTitre(title, romeLibelle) {
  // L'INTITULÉ d'abord, seul. Le libellé ROME des agrégateurs est un code
  // administratif large ("Comptabilité" pour tout ce qui touche aux chiffres) :
  // mélangé au titre, il gagnait la course et rangeait « Analyste Chargé
  // d'affaires — Financements Structurés » de Crédit Agricole CIB en
  // Comptabilité. On ne s'en sert donc qu'en dernier recours, quand l'intitulé
  // seul ne dit rien.
  const titreSeul = normaliserPourClassement(title || '');
  for (const [re, famille] of FAMILLE_RULES) {
    if (re.test(titreSeul)) return CONSOLIDATION_FAMILLES[famille] || famille;
  }
  const text = normaliserPourClassement(`${title} ${romeLibelle || ''}`);
  for (const [re, famille] of FAMILLE_RULES) {
    if (re.test(text)) return CONSOLIDATION_FAMILLES[famille] || famille;
  }
  // Aucune règle n'a mordu. Le dire franchement vaut mieux que de gonfler une
  // famille légitime avec ce qu'on n'a pas su classer.
  return 'Autres métiers de la finance';
}

// Une même maison arrive sous plusieurs orthographes selon la source :
// "BNP PARIBAS" (Adzuna), "Bnp Paribas" (France Travail), "BNP Paribas Mission
// Handicap" (entité de recrutement). Affichées telles quelles, elles occupent
// trois lignes différentes dans le filtre entreprise et cassent la
// déduplication. On ramène chaque variante au nom canonique de la maison.
const EMPLOYEUR_CANONIQUE = [
  [/^bnp\s*paribas\b(?!.*\b(am|asset|cardif|real estate|personal finance|fortis)\b)/i, 'BNP Paribas'],
  [/^bnp\s*paribas\s+(asset management|am)\b/i, 'BNP Paribas Asset Management'],
  [/^(societe|société)\s*generale\b(?!.*\bcib\b)/i, 'Société Générale'],
  [/^(societe|société)\s*generale\b.*\bcib\b/i, 'Société Générale CIB'],
  [/^cr[ée]dit\s*agricole\s*(s\.?a\.?|group|groupe)?$/i, 'Crédit Agricole'],
  [/^cr[ée]dit\s*agricole\s*cib\b/i, 'Crédit Agricole CIB'],
  [/^(la\s*)?banque\s*postale\b/i, 'La Banque Postale'],
  [/^groupe\s*bpce\b|^bpce\s*(sa)?$/i, 'Groupe BPCE'],
  [/^natixis\b(?!.*investment)/i, 'Natixis'],
  [/^amundi\b/i, 'Amundi'],
  [/^axa\b(?!.*\b(im|investment)\b)/i, 'AXA'],
  [/^axa\s*(im|investment managers)\b/i, 'AXA Investment Managers'],
  [/^hsbc\b/i, 'HSBC France'],
  [/^(ernst\s*&?\s*young|ey)\b/i, 'EY'],
  [/^(pwc|pricewaterhousecoopers)\b/i, 'PwC'],
  [/^deloitte\b/i, 'Deloitte'],
  [/^(forvis\s*)?mazars\b/i, 'Forvis Mazars'],
  [/^grant\s*thornton\b/i, 'Grant Thornton'],
  [/^rothschild\b/i, 'Rothschild & Co'],
  [/^l\s*'?\s*or[ée]al\b/i, "L'Oréal"],
  [/^total\s*energies\b|^total\b/i, 'TotalEnergies'],
  [/^cr[ée]dit\s*mutuel\b(?!.*ark[ée]a)/i, 'Crédit Mutuel'],
];

// Suffixes purement administratifs : ils n'apportent rien au candidat et
// fabriquent des doublons ("Matmut SA" vs "Matmut").
const SUFFIXE_JURIDIQUE =
  /\s*[-–,(]?\s*\b(s\.?a\.?s\.?u?\.?|s\.?a\.?r\.?l\.?|s\.?a\.?|sca|snc|gie)\b\s*[)]?\s*$/i;

// Ceux-là ne se retirent QUE s'ils sont détachés par un séparateur : sinon on
// ampute des noms où le mot fait partie de la maison ("Caisse d'Epargne Ile de
// France" -> "Caisse d'Epargne Ile de", "Groupe Henner" -> "Henner").
const SUFFIXE_DECORATIF =
  /\s*[-–,(]\s*(mission handicap|recrutement|recrute|carri[èe]res?|careers?|france|groupe|group)\s*[)]?\s*$/i;

// "BNP Paribas Mission Handicap" : le seul cas où le suffixe se colle sans
// séparateur et où le retirer est juste.
const SUFFIXE_ENTITE_RH = /\s+(mission handicap|service recrutement)\s*$/i;

function normaliserEmployeur(emp) {
  let nom = (emp || '').replace(/\s+/g, ' ').trim();
  if (!nom) return nom;
  nom = nom.replace(SUFFIXE_ENTITE_RH, '').trim();
  for (const [re, canonique] of EMPLOYEUR_CANONIQUE) {
    if (re.test(nom)) return canonique;
  }
  // "SODEXO" -> "Sodexo" : les sources qui crient en majuscules (France Travail,
  // Adzuna) rendent la liste illisible. Les sigles courts (LVMH, MAIF, BRED,
  // SCOR) restent en majuscules — c'est leur orthographe.
  if (nom === nom.toUpperCase() && /[A-ZÀ-Ö]/.test(nom)) {
    nom = nom
      .split(' ')
      .map((mot) =>
        mot.replace(/[^A-Za-zÀ-ÿ]/g, '').length <= 5
          ? mot
          : mot.toLowerCase().replace(/(^|['’(-])([a-zà-öø-ÿ])/g, (_, sep, c) => sep + c.toUpperCase())
      )
      .join(' ');
  }
  let avant;
  do {
    avant = nom;
    nom = nom.replace(SUFFIXE_JURIDIQUE, '').replace(SUFFIXE_DECORATIF, '').trim();
  } while (nom !== avant && nom.length > 2);
  return nom || emp;
}

// Type de structure : le deuxième axe du site, celui du « chez qui ».
//
// Trois principes tiennent ce découpage :
//
//  1. Un type nomme un EMPLOYEUR, jamais un métier. Chaque libellé s'ouvre donc
//     sur un mot d'institution — Banque, Société, Fonds, Compagnie, Cabinet,
//     Entreprise, Institution — pour qu'on ne confonde jamais ce filtre avec
//     celui des familles, qui nomme une activité.
//
//  2. Aucun libellé ne reprend le nom d'une famille. « Gestion d'actifs » est
//     un métier ; l'employeur, lui, est une « société de gestion ». La nuance
//     est celle du secteur, et elle évite de lire deux fois le même mot dans
//     deux filtres qui ne veulent pas dire la même chose.
//
//  3. Les distinctions retenues sont celles qui changent une candidature. Une
//     boutique de M&A et une BFI recrutent le même profil pour deux métiers
//     très différents ; un fonds de private equity et une société de gestion
//     cotée aussi. À l'inverse, séparer les fintechs des autres services
//     financiers spécialisés ne servait personne : huit offres dans une case
//     que le candidat ne pense pas à ouvrir.
const STRUCTURES = [
  "Banque de financement & d'investissement",
  "Banque d'affaires indépendante",
  'Banque de détail',
  'Société de gestion',
  "Fonds d'investissement",
  "Compagnie d'assurance & mutuelle",
  'Big Four & cabinets d’audit',
  'Cabinet de conseil & stratégie',
  'Fintech & services financiers spécialisés',
  'Entreprise (direction financière)',
  'Institution publique & régulateur',
];

const SECTEUR_PAR_MAISON = {
  // --- Banque de détail : réseaux d'agences, clientèle de particuliers -----
  // Ce sont des groupes universels : le type ci-dessous n'est que leur défaut,
  // l'arbitrage d'inferSector les répartit ensuite selon l'entité qui recrute.
  'BPCE': 'Banque de détail', 'Crédit Agricole': 'Banque de détail',
  'BNP Paribas': 'Banque de détail', 'Société Générale': 'Banque de détail',
  'Crédit Mutuel': 'Banque de détail', 'La Banque Postale': 'Banque de détail',
  'Santander': 'Banque de détail', 'BBVA': 'Banque de détail',
  'Intesa Sanpaolo': 'Banque de détail',

  // --- Banque de financement & d'investissement : les BFI ------------------
  'BNP Paribas CIB': "Banque de financement & d'investissement",
  'Société Générale CIB': "Banque de financement & d'investissement",
  'Crédit Agricole CIB': "Banque de financement & d'investissement",
  'Natixis': "Banque de financement & d'investissement",
  'Goldman Sachs': "Banque de financement & d'investissement",
  'JPMorgan': "Banque de financement & d'investissement",
  'Morgan Stanley': "Banque de financement & d'investissement",
  'Bank of America': "Banque de financement & d'investissement",
  'Citi': "Banque de financement & d'investissement",
  'Barclays': "Banque de financement & d'investissement",
  'Deutsche Bank': "Banque de financement & d'investissement",
  'UBS': "Banque de financement & d'investissement",
  'HSBC France': "Banque de financement & d'investissement",
  'Nomura': "Banque de financement & d'investissement",
  'Oddo BHF': "Banque de financement & d'investissement",

  // --- Banque d'affaires indépendante : les boutiques ----------------------
  // Elles ne portent ni bilan ni réseau : elles vendent du conseil financier.
  // C'est la distinction que cherche un candidat qui vise le M&A.
  'Lazard': "Banque d'affaires indépendante",
  'Rothschild & Co': "Banque d'affaires indépendante",
  'PJT Partners': "Banque d'affaires indépendante",
  'Houlihan Lokey': "Banque d'affaires indépendante",
  'Centerview Partners': "Banque d'affaires indépendante",
  'Perella Weinberg': "Banque d'affaires indépendante",
  'Messier & Associés': "Banque d'affaires indépendante",
  'Edmond de Rothschild': "Banque d'affaires indépendante",
  'Kepler Cheuvreux': "Banque d'affaires indépendante",

  // --- Sociétés de gestion : l'épargne collective, cotée -------------------
  'Amundi': 'Société de gestion', 'AXA IM': 'Société de gestion',
  'BNP Paribas AM': 'Société de gestion', 'Natixis IM': 'Société de gestion',
  'Carmignac': 'Société de gestion', 'Comgest': 'Société de gestion',
  'Sycomore': 'Société de gestion', 'Groupama AM': 'Société de gestion',
  'CPR AM': 'Société de gestion', 'Lazard Frères Gestion': 'Société de gestion',
  "La Financière de l'Échiquier": 'Société de gestion',
  'BlackRock': 'Société de gestion', 'Julius Baer': 'Société de gestion',
  'Candriam': 'Société de gestion', 'Mirova': 'Société de gestion',
  'Ostrum': 'Société de gestion', 'DNCA': 'Société de gestion',
  'Rothschild & Co AM': 'Société de gestion',

  // --- Fonds d'investissement : non coté, infrastructure, capital-risque ---
  // Séparés des sociétés de gestion : on n'y fait pas le même métier, on n'y
  // entre pas par la même porte, et le candidat le sait.
  'Ardian': "Fonds d'investissement", 'Eurazeo': "Fonds d'investissement",
  'PAI Partners': "Fonds d'investissement", 'Tikehau': "Fonds d'investissement",
  'Antin Infrastructure': "Fonds d'investissement", 'Astorg': "Fonds d'investissement",
  'Sagard': "Fonds d'investissement", 'Andera Partners': "Fonds d'investissement",
  'LBO France': "Fonds d'investissement", 'IK Partners': "Fonds d'investissement",
  'Siparex': "Fonds d'investissement", 'Partech': "Fonds d'investissement",
  'Alven': "Fonds d'investissement", 'Meridiam': "Fonds d'investissement",
  'Infravia': "Fonds d'investissement", 'Apax Partners': "Fonds d'investissement",

  // --- Assurance, mutuelles, réassurance et courtage -----------------------
  'AXA': "Compagnie d'assurance & mutuelle", 'Allianz France': "Compagnie d'assurance & mutuelle",
  'CNP Assurances': "Compagnie d'assurance & mutuelle", 'Scor': "Compagnie d'assurance & mutuelle",
  'Covéa': "Compagnie d'assurance & mutuelle", 'Generali France': "Compagnie d'assurance & mutuelle",
  'AG2R La Mondiale': "Compagnie d'assurance & mutuelle", 'Groupama': "Compagnie d'assurance & mutuelle",
  'Matmut': "Compagnie d'assurance & mutuelle", 'MAIF': "Compagnie d'assurance & mutuelle",
  'Macif': "Compagnie d'assurance & mutuelle", 'Malakoff Humanis': "Compagnie d'assurance & mutuelle",
  'Marsh McLennan': "Compagnie d'assurance & mutuelle", 'Verlingue': "Compagnie d'assurance & mutuelle",
  'Coface': "Compagnie d'assurance & mutuelle", 'Swiss Life': "Compagnie d'assurance & mutuelle",
  'Swiss Life France': "Compagnie d'assurance & mutuelle",
  'Wakam': "Compagnie d'assurance & mutuelle", 'April': "Compagnie d'assurance & mutuelle",

  // --- Audit et expertise comptable ----------------------------------------
  'Deloitte': 'Big Four & cabinets d’audit', 'EY': 'Big Four & cabinets d’audit',
  'KPMG': 'Big Four & cabinets d’audit', 'PwC': 'Big Four & cabinets d’audit',
  'Forvis Mazars': 'Big Four & cabinets d’audit', 'Grant Thornton': 'Big Four & cabinets d’audit',
  'BDO': 'Big Four & cabinets d’audit', 'RSM': 'Big Four & cabinets d’audit',
  'Baker Tilly': 'Big Four & cabinets d’audit', 'Fiducial': 'Big Four & cabinets d’audit',
  'In Extenso': 'Big Four & cabinets d’audit',

  // --- Conseil : stratégie, management, transaction services ---------------
  'McKinsey': 'Cabinet de conseil & stratégie', 'BCG': 'Cabinet de conseil & stratégie',
  'Bain': 'Cabinet de conseil & stratégie', 'Oliver Wyman': 'Cabinet de conseil & stratégie',
  'Roland Berger': 'Cabinet de conseil & stratégie', 'Sia Partners': 'Cabinet de conseil & stratégie',
  'Talan': 'Cabinet de conseil & stratégie', 'Capgemini': 'Cabinet de conseil & stratégie',
  'Eight Advisory': 'Cabinet de conseil & stratégie', 'Accuracy': 'Cabinet de conseil & stratégie',
  'Wavestone': 'Cabinet de conseil & stratégie', 'Alvarez & Marsal': 'Cabinet de conseil & stratégie',
  'Kearney': 'Cabinet de conseil & stratégie', 'Eleven': 'Cabinet de conseil & stratégie',

  // --- Fintech et services financiers spécialisés --------------------------
  // Conservation de titres, paiement, affacturage, crédit-bail, cautions : ces
  // maisons emploient massivement des juniors en middle et back-office. Les
  // fintechs les rejoignent : même métier rendu, technologie plus récente.
  'Caceis': 'Fintech & services financiers spécialisés',
  'Euroclear': 'Fintech & services financiers spécialisés',
  'Worldline': 'Fintech & services financiers spécialisés',
  'Edenred': 'Fintech & services financiers spécialisés',
  'Crédit Logement': 'Fintech & services financiers spécialisés',
  'LSEG': 'Fintech & services financiers spécialisés',
  'Qonto': 'Fintech & services financiers spécialisés',
  'Swile': 'Fintech & services financiers spécialisés',
  'Pennylane': 'Fintech & services financiers spécialisés',
  'Spendesk': 'Fintech & services financiers spécialisés',
  'Alan': 'Fintech & services financiers spécialisés',
  'Ledger': 'Fintech & services financiers spécialisés',
  'Younited': 'Fintech & services financiers spécialisés',

  // --- Institutions publiques et régulateurs -------------------------------
  'Banque de France': 'Institution publique & régulateur',
  'AMF': 'Institution publique & régulateur',
  'ACPR': 'Institution publique & régulateur',
  'Caisse des Dépôts': 'Institution publique & régulateur',
  'Agence France Trésor': 'Institution publique & régulateur',
  'Bpifrance': 'Institution publique & régulateur',
  'Banque Européenne d’Investissement': 'Institution publique & régulateur',
};

// Employeurs hors liste de référence : on ne connaît pas leur maison, seulement
// leur raison sociale. Quelques mots suffisent à reconnaître un type, et tout
// le reste reçoit une étiquette honnête plutôt qu'un « Entreprise » muet.
//
// Le vocabulaire est le MÊME que celui de SECTEUR_PAR_MAISON : deux tables qui
// nomment différemment la même chose fabriquent des doublons dans le filtre.
// L'ORDRE compte : du plus précis au plus général.
const SECTEUR_PAR_MOT = [
  // Services financiers spécialisés d'abord : « CA Leasing & Factoring » ou
  // « Compagnie Européenne de Garanties et Cautions » contiennent le nom d'un
  // groupe bancaire et seraient sinon rangés en banque de détail.
  [/factor|leasing|cr[ée]dit[\s-]?bail|affacturage|garanties et cautions|payment|paiement|monétique|titres? services|asset servicing|conservation de titres|fintech|n[ée]obanque|neobank/i, 'Fintech & services financiers spécialisés'],
  [/asset manag|gestion d.?actifs|investment solutions|\bam\b$|investment manag|\bopcvm\b|soci[ée]t[ée] de gestion/i, 'Société de gestion'],
  [/private equity|venture|capital[\s-]?(?:investissement|risque)|\bfonds\b|infrastructure partners/i, "Fonds d'investissement"],
  [/assurance|mutuelle|\bmutex\b|pr[ée]voyance|assureur|courtage|courtier|\bbroker\b|r[ée]assurance/i, "Compagnie d'assurance & mutuelle"],
  [/expertise comptable|expert[\s-]?comptable|\bcomptab|fiducia|commissariat aux comptes|\baudit\b/i, 'Big Four & cabinets d’audit'],
  [/conseil|consulting|advisory|strat[ée]g/i, 'Cabinet de conseil & stratégie'],
  [/banque d.affaires|corporate finance/i, "Banque d'affaires indépendante"],
  [/\bcib\b|banque de financement|investment bank/i, "Banque de financement & d'investissement"],
  [/\bbanque\b|\bbank\b|caisse d.?[ée]pargne|banque populaire|cr[ée]dit (?:agricole|mutuel|coop)/i, 'Banque de détail'],
  [/minist[èe]re|pr[ée]fecture|agence nationale|[ée]tablissement public|\bcnrs\b|universit[ée]|\bcaisse (?:nationale|primaire)|autorit[ée] de contr[ôo]le|\bacpr\b|\bamf\b/i, 'Institution publique & régulateur'],
];

// Étiquette des employeurs qu'aucun mot ne rattache à la finance. Ils recrutent
// pourtant des profils financiers : c'est, presque toujours, une société
// ordinaire dotée d'une direction financière. Le dire est plus juste que
// l'ancien « PME & start-up », qui décrivait une TAILLE et non un type.
const SECTEUR_AUTRES = 'Entreprise (direction financière)';

// Ce qu'on ne dit que dans un cabinet : on y suit un PORTEFEUILLE DE CLIENTS.
// « Comptable fournisseur » ou « comptable général » désignent au contraire la
// comptabilité interne d'une société — on ne les retient donc pas.
const CABINET_COMPTABLE_TITRE_RE =
  /expertise[\s-]?comptable|expert[\s-]?comptable|charg[ée].{0,6} de dossiers?|collaborateur\w*[\s-]comptable|collaborateur\w* d'expertise|r[ée]viseur|commissariat aux comptes|commissaire aux comptes|\ben cabinet\b|portefeuille (?:de )?clients?|\bdcg\b|\bdscg\b/i;

// Une même maison recrute dans plusieurs mondes : BNP Paribas a un réseau
// d'agences, une banque de financement (CIB), un gérant d'actifs (AM) et un
// assureur (Cardif). Classer ses 77 offres « Banque de détail » parce que la
// maison s'appelle BNP serait faux une fois sur trois. Quand l'employeur ou
// l'intitulé désigne l'entité qui recrute, c'est elle qui décide du type.
const ENTITE_BFI_RE =
  /\bcib\b|corporate\s*(?:&|and|et)\s*investment|banque de financement|banque d'affaires|global (?:markets|banking)|investment bank|salle des march[ée]s|\bglobal capital markets\b|\bm&a\b|strategy (?:and|&) transactions|fusions?[\s-]acquisitions?|\btrading\b|\btrader\b|structuration|produits d[ée]riv[ée]s/i;
const ENTITE_GESTION_RE =
  /asset management|\bam\b\s*$|gestion d'actifs|investment managers?|wealth management|banque priv[ée]e|gestion priv[ée]e|gestion de portefeuille|\bg[ée]rant\b/i;
const ENTITE_FONDS_RE = /private equity|\blbo\b|capital[\s-]investissement|infrastructure fund|venture/i;
const ENTITE_ASSURANCE_RE = /\bcardif\b|\bassurances?\b|\binsurance\b|\bpr[ée]voyance\b/i;
// Les filiales de services : elles portent le nom du groupe et un métier propre.
const ENTITE_SERVICES_RE =
  /\bfactor\b|factoring|leasing|equipment solutions|payment services|garanties et cautions|personal finance|consumer finance|securities services|asset servicing/i;

// Maisons multi-entités : les groupes universels dont le type par défaut est le
// réseau de détail. C'est pour elles seules que la détection d'entité joue —
// chez Amundi ou Deloitte, il n'y a rien à arbitrer.
const MAISONS_MULTI_ENTITES = new Set([
  'BNP Paribas', 'Société Générale', 'Crédit Agricole', 'BPCE', 'Crédit Mutuel',
  'La Banque Postale', 'Natixis', 'HSBC France',
]);

// Maisons qui font à la fois du conseil, du marché et de la gestion, sous un
// seul nom. Lazard publie ses stages M&A et ceux de Lazard Frères Gestion sous
// « Lazard » : le nom ne dit rien, seule la famille métier peut arbitrer.
const MAISONS_BANQUE_ET_GESTION = new Set([
  'Lazard', 'Rothschild & Co', 'Oddo BHF', 'Edmond de Rothschild',
  'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Barclays', 'Deutsche Bank',
  'UBS', 'Bank of America', 'Citi', 'BNP Paribas CIB', 'Société Générale CIB',
  'Crédit Agricole CIB', 'Kepler Cheuvreux',
]);

// Quand le nom de l'entité ne tranche pas, la FAMILLE MÉTIER de l'offre le
// fait : un stage M&A chez Lazard relève de la banque d'affaires, un stage de
// gestion chez Lazard Frères Gestion de la société de gestion — et Lazard
// apparaît alors, à juste titre, dans les deux catégories. Ce n'est pas la
// maison qu'on classe, c'est l'offre.
//
// Cette table lit les familles AFFICHÉES : elle référençait encore des noms
// abandonnés lors de la refonte des familles, et n'arbitrait donc plus rien.
const SECTEUR_PAR_FAMILLE = {
  'Fusions & Acquisitions': "Banque de financement & d'investissement",
  'Marchés financiers': "Banque de financement & d'investissement",
  'Capital-investissement': "Fonds d'investissement",
  "Gestion d'actifs": 'Société de gestion',
};

function inferSector(emp, maison, title, famille) {
  const texte = (emp || '') + ' ' + (title || '');
  if (maison && MAISONS_MULTI_ENTITES.has(maison)) {
    if (ENTITE_SERVICES_RE.test(emp || '')) return 'Fintech & services financiers spécialisés';
    if (ENTITE_FONDS_RE.test(texte)) return "Fonds d'investissement";
    if (ENTITE_GESTION_RE.test(texte)) return 'Société de gestion';
    if (ENTITE_BFI_RE.test(texte)) return "Banque de financement & d'investissement";
    if (ENTITE_ASSURANCE_RE.test(emp || '')) return "Compagnie d'assurance & mutuelle";
    if (famille && SECTEUR_PAR_FAMILLE[famille]) return SECTEUR_PAR_FAMILLE[famille];
  }
  // Même arbitrage pour les maisons mono-nom qui abritent plusieurs métiers
  // (Lazard et sa filiale de gestion, Rothschild et sa gestion de fortune) :
  // sans entité explicite dans le nom, seule la famille métier peut trancher.
  // Une boutique reste une boutique : elle n'a pas de bilan à prêter, donc son
  // M&A ne bascule pas en banque de financement.
  if (maison && MAISONS_BANQUE_ET_GESTION.has(maison) && famille && SECTEUR_PAR_FAMILLE[famille]) {
    const t = SECTEUR_PAR_FAMILLE[famille];
    const boutique = SECTEUR_PAR_MAISON[maison] === "Banque d'affaires indépendante";
    if (boutique && t === "Banque de financement & d'investissement") return SECTEUR_PAR_MAISON[maison];
    return t;
  }

  if (maison && SECTEUR_PAR_MAISON[maison]) return SECTEUR_PAR_MAISON[maison];
  // Une maison de référence absente de la table est un grand groupe industriel
  // ou de services : sa direction financière recrute des juniors, mais ce n'est
  // pas une maison de finance. Le dire évite de la ranger sous « Banque ».
  if (maison) return 'Entreprise (direction financière)';
  const key = (emp || '').toLowerCase().trim();
  for (const [re, secteur] of SECTEUR_PAR_MOT) {
    if (re.test(key)) return secteur;
  }
  // Cabinets d'expertise comptable indépendants : leur raison sociale ne dit
  // presque jamais leur métier (« STECO », « GMBA », « Groupe IGF »). C'est
  // l'INTITULÉ qui les trahit — on y travaille sur un portefeuille de clients,
  // là où la comptabilité d'une entreprise parle de fournisseurs ou
  // d'immobilisations. Sans cette lecture, ces cabinets tombaient tous dans
  // « Entreprise (direction financière) », qui gonflait à 44 % du catalogue.
  if (CABINET_COMPTABLE_TITRE_RE.test(title || '')) return 'Big Four & cabinets d’audit';
  return SECTEUR_AUTRES;
}

// ---------------------------------------------------------------------------
// Liens intermédiaires interdits
// ---------------------------------------------------------------------------
// Sites qui s'intercalent entre le candidat et l'employeur. Y renvoyer trahit
// la promesse centrale de JJ et impose souvent un compte tiers pour postuler.
// Note : Adzuna est une SOURCE (on l'interroge par API) mais ses redirect_url
// pointent vers l'annonce d'origine — c'est bien le domaine final qui compte.
// Depuis le 01/09/2026, la règle est absolue : JJ ne publie QUE des annonces
// dont le lien mène chez l'employeur. Les agrégateurs y entrent donc aussi —
// y compris ceux qu'on interroge comme sources. Aucun des 92 liens d'Adzuna ne
// menait ailleurs que sur adzuna.fr : cliquer sur une offre affichait une page
// intermédiaire, parfois avec un type de contrat faux, ce qui vidait de son
// sens la promesse centrale du site.
//
// On ne coupe pas les connecteurs pour autant : France Travail donne parfois
// l'adresse de l'annonce d'origine, et ces offres-là restent les bienvenues.
// C'est le LIEN qu'on juge, pas la source — si demain un agrégateur renvoie
// vers l'employeur, ses offres entrent sans qu'on touche à rien.
const INTERMEDIAIRE_RE =
  /adzuna\.[a-z.]+|candidat\.francetravail\.fr|labonnealternance\.apprentissage\.beta\.gouv\.fr|choisirleservicepublic\.gouv\.fr|jobteaser\.com|welcometothejungle\.com|welcomekit\.co|hellowork\.com|wizbii\.com|jobijoba\.com|consultor\.fr|indeed\.[a-z.]+|linkedin\.com|glassdoor\.[a-z.]+|apec\.fr|studyrama|letudiant\.fr|monster\.[a-z.]+|cadremploi\.fr|regionsjob\.com|meteojob\.com|talent\.com|jooble\.org|neuvoo|jobrapido|optioncarriere|keljob\.com|aplitrak\.com|handicap-job\.com|contactrh\.com|mytalentplug|talentplug|beetween|jobvitae|hellowork|figaro\s?emploi|profilculture|choosemycompany|engagement-jeunes|walkngo|jobteaser|placedesmetiers|emploi-collectivites/i;

// ---------------------------------------------------------------------------
// Filtre géographique : grandes villes uniquement
// ---------------------------------------------------------------------------
// Un poste de conseiller d'agence à Nérac ou Villeréal n'intéresse pas la cible
// de JJ (étudiants et jeunes diplômés finance). On ne garde que les métropoles
// où se trouvent réellement les directions financières, sièges et cabinets.

// Paris intra-muros sous toutes ses écritures : "Paris", "PARIS 01 LOUVRE",
// "Paris 15ème", "75-PARIS", "Paris La Défense", "75008"...
const PARIS_RE = /\bparis\b|^75\d{3}$|^75\s*-|\bla d[ée]fense\b/i;

// Petite couronne + pôles tertiaires franciliens : ces communes concentrent les
// sièges sociaux (La Défense, Issy, Montrouge, Saint-Denis...).
const GRAND_PARIS = [
  'nanterre', 'courbevoie', 'puteaux', 'levallois', 'neuilly', 'boulogne', 'issy',
  'montrouge', 'malakoff', 'vanves', 'clichy', 'saint-ouen', 'saint-denis', 'aubervilliers',
  'pantin', 'montreuil', 'bagnolet', 'ivry', 'vitry', 'charenton', 'vincennes',
  'rueil', 'suresnes', 'colombes', 'asnieres', 'asnières', 'gennevilliers', 'la garenne',
  'fontenay', 'creteil', 'créteil', 'noisy', 'bobigny', 'villejuif', 'gentilly',
  'arcueil', 'cachan', 'antony', 'massy', 'palaiseau', 'saclay', 'velizy', 'vélizy',
  'guyancourt', 'versailles', 'cergy', 'nanteuil', 'roissy', 'orly', 'rungis',
  'saint-cloud', 'garches', 'sevres', 'sèvres', 'meudon', 'chatillon', 'châtillon',
  'bagneux', 'clamart', 'saint-mande', 'saint-mandé', 'le kremlin', 'maisons-alfort',
  'alfortville', 'saint-maur', 'nogent', 'romainville', 'les lilas', 'pre-saint-gervais',
  'aulnay', 'drancy', 'bondy', 'rosny', 'champigny', 'chatenay', 'châtenay',
  'bourg-la-reine', 'sceaux', 'fresnes', 'chevilly', 'thiais', 'choisy',
  'saint-germain-en-laye', 'poissy', 'sartrouville', 'houilles', 'bezons', 'argenteuil',
  'la defense', 'la défense', 'saint-quentin-en-yvelines', 'evry', 'évry', 'noisiel',

  // Saint-Quentin-en-Yvelines : ville nouvelle de 150 000 habitants, siège de
  // plusieurs directions financières. Son absence coûtait quatre offres du
  // seul Crédit Agricole — cash management, financements structurés,
  // back-office paiements.
  'saint-quentin-en-yvelines', 'saint-quentin en yvelines', 'montigny-le-bretonneux',
];

// Métropoles régionales (>100 000 hab. ou pôle économique majeur).
const GRANDES_VILLES = [
  'lyon', 'villeurbanne', 'marseille', 'aix-en-provence', 'aix en provence', 'toulouse',
  'bordeaux', 'lille', 'roubaix', 'tourcoing', 'villeneuve-d-ascq', "villeneuve-d'ascq",
  'nantes', 'strasbourg', 'nice', 'sophia antipolis', 'rennes', 'montpellier', 'grenoble',
  'rouen', 'reims', 'toulon', 'saint-etienne', 'saint-étienne', 'dijon', 'angers',
  'nimes', 'nîmes', 'clermont-ferrand', 'le havre', 'brest', 'tours', 'amiens',
  'limoges', 'annecy', 'perpignan', 'besancon', 'besançon', 'metz', 'orleans', 'orléans',
  'mulhouse', 'caen', 'nancy', 'argenteuil', 'poitiers', 'avignon', 'la rochelle',
  'pau', 'bayonne', 'biarritz', 'valence', 'chambery', 'chambéry', 'le mans', 'troyes',
  'lorient', 'niort', 'chartres', 'blois', 'quimper', 'valenciennes', 'dunkerque',
  'bagneux', 'sassenage', 'blagnac', 'labege', 'labège', 'meylan', 'ecully', 'écully',
  'marcq-en-baroeul', 'marcq-en-barœul', 'lezennes', 'wasquehal', 'lesquin',
];

// Certaines sources (Adzuna notamment) ne donnent que la RÉGION, voire juste
// "France". Ces libellés ne sont pas des petites communes : les rejeter
// reviendrait à jeter des offres valides (le cas s'est produit avec SCOR, dont
// les postes d'underwriter sont localisés "Ile-de-France, France").
const REGIONS_ET_INCONNU = [
  'france', 'ile-de-france', 'île-de-france', 'ile de france', 'idf',
  'auvergne', 'rhone-alpes', 'rhône-alpes', 'nouvelle-aquitaine', 'occitanie',
  'hauts-de-france', 'grand est', 'bretagne', 'normandie', 'pays de la loire',
  "provence-alpes-côte d'azur", 'paca', 'bourgogne', 'franche-comté',
  'centre-val de loire', 'corse', 'non précisé', 'remote', 'télétravail',
];

// Beaucoup de sources donnent le DÉPARTEMENT au lieu de la commune
// ("Hauts-de-Seine", "NORD", "RHONE"). Ce n'est pas une petite ville : c'est un
// libellé de même niveau qu'une région, et le rejeter écartait à lui seul des
// centaines d'offres de grandes maisons — dont 53 rien que pour les
// Hauts-de-Seine, qui est le premier bassin d'emploi financier de France.
const DEPARTEMENTS = [
  'ain', 'aisne', 'allier', 'alpes-maritimes', 'ardeche', 'ardèche', 'ardennes',
  'ariege', 'ariège', 'aube', 'aude', 'aveyron', 'bouches-du-rhone',
  'bouches-du-rhône', 'calvados', 'cantal', 'charente', 'charente-maritime',
  'cher', 'correze', 'corrèze', "cote-d'or", "côte-d'or", "cotes-d'armor",
  "côtes-d'armor", 'creuse', 'dordogne', 'doubs', 'drome', 'drôme', 'eure',
  'eure-et-loir', 'finistere', 'finistère', 'gard', 'haute-garonne', 'gers',
  'gironde', 'herault', 'hérault', 'ille-et-vilaine', 'indre', 'indre-et-loire',
  'isere', 'isère', 'jura', 'landes', 'loir-et-cher', 'loire', 'haute-loire',
  'loire-atlantique', 'loiret', 'lot', 'lot-et-garonne', 'lozere', 'lozère',
  'maine-et-loire', 'manche', 'marne', 'haute-marne', 'mayenne',
  'meurthe-et-moselle', 'meuse', 'morbihan', 'moselle', 'nievre', 'nièvre',
  'nord', 'oise', 'orne', 'pas-de-calais', 'puy-de-dome', 'puy-de-dôme',
  'pyrenees-atlantiques', 'pyrénées-atlantiques', 'hautes-pyrenees',
  'hautes-pyrénées', 'pyrenees-orientales', 'pyrénées-orientales', 'bas-rhin',
  'haut-rhin', 'rhone', 'rhône', 'haute-saone', 'haute-saône', 'saone-et-loire',
  'saône-et-loire', 'sarthe', 'savoie', 'haute-savoie', 'paris', 'seine-maritime',
  'seine-et-marne', 'yvelines', 'deux-sevres', 'deux-sèvres', 'somme', 'tarn',
  'tarn-et-garonne', 'var', 'vaucluse', 'vendee', 'vendée', 'vienne',
  'haute-vienne', 'vosges', 'yonne', 'territoire de belfort', 'essonne',
  'hauts-de-seine', 'seine-saint-denis', 'val-de-marne', "val-d'oise",
];

// Regroupement des lieux en zones affichables. Les sources écrivent la même
// ville de dix façons ("75 - Paris 8e Arrondissement", "PARIS-LA DEFENSE(FRA)",
// "Paris, Île-de-France") et les communes de banlieue arrivent nues
// ("Lezennes", "Vaulx-en-Velin"). Sans regroupement, le filtre lieu de la page
// afficherait 300 entrées dont 40 pour Paris. On calcule la zone ICI, une fois,
// avec le même vocabulaire que le filtre géographique ci-dessus — plutôt que de
// dupliquer des listes de villes dans le HTML.
const ZONES = [
  ['Lyon', ['lyon', 'villeurbanne', 'ecully', 'écully', 'vaulx-en-velin', 'venissieux', 'vénissieux', 'sassenage']],
  ['Marseille / Aix', ['marseille', 'aix-en-provence', 'aix en provence', 'toulon']],
  ['Toulouse', ['toulouse', 'blagnac', 'colomiers', 'labege', 'labège']],
  ['Bordeaux', ['bordeaux', 'merignac', 'mérignac', 'pessac']],
  ['Lille', ['lille', 'roubaix', 'tourcoing', "villeneuve-d'ascq", 'villeneuve-d-ascq', 'lezennes', 'wasquehal', 'lesquin', 'marcq-en-baroeul', 'marcq-en-barœul', 'valenciennes', 'dunkerque']],
  ['Nantes', ['nantes', 'saint-herblain']],
  ['Strasbourg', ['strasbourg', 'schiltigheim', 'mulhouse']],
  ['Rennes', ['rennes', 'cesson-sevigne', 'cesson-sévigné', 'brest', 'lorient', 'quimper']],
  ['Nice / Sophia', ['nice', 'sophia antipolis', 'antibes', 'cannes']],
  ['Montpellier', ['montpellier', 'nimes', 'nîmes', 'perpignan']],
  ['Grenoble', ['grenoble', 'meylan', 'chambery', 'chambéry', 'annecy', 'valence']],
  ['Rouen / Le Havre', ['rouen', 'le havre', 'caen']],
  ['Est (Nancy, Metz, Dijon, Besançon)', ['nancy', 'metz', 'dijon', 'besancon', 'besançon', 'reims', 'troyes']],
  ['Val de Loire (Tours, Orléans, Angers, Le Mans)', ['tours', 'joue les tours', 'joué-lès-tours', 'orleans', 'orléans', 'angers', 'le mans', 'blois', 'chartres']],
  ['Sud-Ouest (Pau, Bayonne, La Rochelle, Niort)', ['pau', 'bayonne', 'biarritz', 'la rochelle', 'niort', 'poitiers', 'limoges']],
  ['Auvergne (Clermont-Ferrand)', ['clermont-ferrand']],
  ['Amiens / Picardie', ['amiens', 'compiegne', 'compiègne']],
  ['Avignon / Vaucluse', ['avignon']],
  ['Saint-Étienne', ['saint-etienne', 'saint-étienne']],
];

// Libellés qui ne désignent aucune ville : l'offre existe, mais son lieu n'est
// pas exploitable. Les ranger à part vaut mieux que les noyer dans "autres".
const ZONE_INCONNUE = 'Lieu non précisé';

// Départements franciliens : une offre "Hauts-de-Seine" est parisienne, pas
// "autre ville".
const DEPTS_IDF = ['hauts-de-seine', 'seine-saint-denis', 'val-de-marne',
  "val-d'oise", 'yvelines', 'essonne', 'seine-et-marne'];

// Nettoie le libellé de lieu pour l'affichage. Les sources renvoient de tout :
// l'adresse postale complète ("21 AVENUE DU BEL AIR 75012 PARIS"), le code
// postal collé ("75015 Paris 15e Arrondissement"), un suffixe de plateforme
// ("Courbevoie(pld)"). On veut juste la ville, lisible.
function nettoyerLieu(loc) {
  let v = (loc || '').trim();
  if (!v) return v;
  v = v
    .replace(/\([a-z]{2,4}\)\s*$/i, '')        // "Courbevoie(pld)" -> "Courbevoie"
    .replace(/\bcedex\b\s*\d*/gi, '')          // "Paris Cedex 08" -> "Paris"
    .replace(/\s+\d+\s*e(?:r|me)?\s+arrondissement/i, ''); // "Paris 15e Arrondissement" -> "Paris"
  // Adresse complète en capitales : on ne garde que la ville, après le code postal.
  const m = v.match(/\b\d{5}\b\s+(.+)$/);
  if (m) v = m[1];
  // Reste un code postal isolé en tête ? on le retire.
  v = v.replace(/^\s*\d{5}\s*/, '').replace(/\s{2,}/g, ' ').trim();
  // "21 AVENUE DU BEL AIR PARIS" tout en capitales -> "Paris"
  if (v === v.toUpperCase() && v.length > 3) {
    const mots = v.split(/\s+/);
    const ville = mots.slice(-2).join(' ').match(/^(?:PARIS|LYON|MARSEILLE|LILLE|LA D[ÉE]FENSE)/i)
      ? mots.slice(-2).join(' ')
      : mots[mots.length - 1];
    v = ville
      .toLowerCase()
      .replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_, s, c) => s + c.toUpperCase());
  }
  // Une même ville écrite de quatre façons devient quatre entrées dans le
  // filtre par lieu, et un candidat qui coche l'une perd les autres. La table
  // est volontairement une table : chaque ligne est une décision vérifiable,
  // là où une normalisation automatique des accents fusionnerait des communes
  // réellement distinctes.
  const CANONIQUE = { 'paris la défense': 'La Défense', 'paris la defense': 'La Défense', 'la defense': 'La Défense', 'la défense': 'La Défense' };
  const canon = CANONIQUE[v.toLowerCase().trim()];
  if (canon) return canon;

  // Cas symétrique du précédent : « nice », « nanterre », « amiens » arrivaient
  // tout en minuscules et s'affichaient tels quels, à côté de « Nanterre »
  // écrit correctement par une autre source. Deux graphies de la même ville sur
  // deux cartes voisines donnent l'impression d'un site mal tenu.
  if (v && v === v.toLowerCase() && /[a-zà-öø-ÿ]/.test(v)) {
    v = v.replace(/(^|[\s'’-])([a-zà-öø-ÿ])/g, (_, s, c) => s + c.toUpperCase());
  }
  return v || loc;
}

function inferZone(loc) {
  const v = (loc || '').toLowerCase().trim();
  if (!v) return ZONE_INCONNUE;
  if (/t[ée]l[ée]travail|remote/.test(v)) return 'Télétravail';
  if (PARIS_RE.test(v) || GRAND_PARIS.some((c) => v.includes(c))) return 'Paris / Île-de-France';
  if (/^(ile|île)[\s-]de[\s-]france/.test(v)) return 'Paris / Île-de-France';
  if (DEPTS_IDF.some((d) => v === d || v.startsWith(d + ','))) return 'Paris / Île-de-France';
  // Un arrondissement seul, sans ville : c'est Paris dans l'écrasante majorité
  // des cas, et le libellé ne permet pas de trancher autrement.
  if (/^\d{1,2}\s*(er|e|ème|eme)\s+arrondissement/i.test(v)) return 'Paris / Île-de-France';
  for (const [zone, villes] of ZONES) {
    if (villes.some((c) => v.includes(c))) return zone;
  }
  if (REGIONS_ET_INCONNU.some((r) => v === r || v.startsWith(r + ','))) return ZONE_INCONNUE;
  // Un département sans commune ("NORD", "RHONE") n'est pas une ville : le
  // ranger parmi les villes tromperait le candidat, qui ne saurait pas où le
  // poste se trouve réellement.
  if (DEPARTEMENTS.some((d) => v === d || v.startsWith(d + ','))) return 'Département seul';
  return 'Autres villes';
}

// Cherche un nom de ville comme un MOT, pas comme une sous-chaîne : sans ça,
// "Lillebonne" (Seine-Maritime) passait pour Lille, et "Lorient" pour Orient.
// Les tirets et apostrophes d'un nom composé sont écrits au petit bonheur :
// « Saint-Quentin-en Yvelines » chez l'un, « Saint Quentin en Yvelines » chez
// l'autre. On les ramène tous à des espaces avant de comparer.
function sansLiaisons(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // « Île-de-France » = « Ile-de-France »
    .replace(/[-–'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contientVille(libelle, ville) {
  libelle = sansLiaisons(libelle);
  ville = sansLiaisons(ville);
  const i = libelle.indexOf(ville);
  if (i === -1) return false;
  const avant = libelle[i - 1];
  const apres = libelle[i + ville.length];
  const estLettre = (c) => c !== undefined && /[a-zà-öø-ÿ]/.test(c);
  return !estLettre(avant) && !estLettre(apres);
}

// Extrait la ville d'un libellé de liste. Les employeurs y écrivent de tout :
// « Montrouge - France », « Saint-Quentin-en-Yvelines - France », « Amiens
// (80), puis Montrouge (92) - France », « Saint-Quentin-en Yvelines (lignes N,
// U, RER C,) voire navette CDG Etoile/SQY - France ». On retire le pays, les
// précisions entre parenthèses, puis on coupe au premier vrai séparateur —
// jamais sur le tiret d'un nom composé.
function villeDeLaListe(brut) {
  let v = String(brut || '').replace(/\s*[-–,]\s*france\s*$/i, '').trim();
  v = v.replace(/\([^)]*\)?/g, ' '); // « Amiens (80) » -> « Amiens »
  v = v.split(/\s[-–]\s/)[0]; // un tiret entouré d'espaces sépare vraiment
  v = v.split(',')[0];
  // « Amiens puis Montrouge », « SQY voire navette » : on garde le premier.
  v = v.split(/\s+(?:puis|voire|ou)\s+/i)[0];
  return v.replace(/\s+/g, ' ').trim();
}

function estGrandeVille(loc) {
  let v = (loc || '').toLowerCase().trim();
  if (!v) return true; // pas d'info -> on ne jette pas
  // Le pays en suffixe n'apprend rien à un site qui ne publie que la France,
  // et il empêchait de reconnaître ce qui le précède : le Crédit Agricole
  // écrit « Ile-de-France - France », libellé pourtant on ne peut plus clair,
  // qui était rejeté comme une petite commune.
  v = v.replace(/[\s,]+[-–]?\s*france\s*$/, '').trim() || v;
  // Le séparateur d'un libellé composé peut être une virgule ou un tiret.
  const commencePar = (t) => {
    const a = sansLiaisons(v);
    const b = sansLiaisons(t);
    return a === b || a.startsWith(b + ',') || a.startsWith(b + ' ');
  };
  if (REGIONS_ET_INCONNU.some(commencePar)) return true;
  // Département seul : même statut qu'une région.
  if (DEPARTEMENTS.some(commencePar)) return true;
  // "1er Arrondissement", "13ème Arrondissement" sans le nom de la ville : ces
  // libellés ne désignent que Paris, Lyon ou Marseille — jamais un village.
  if (/^\d{1,2}\s*(er|e|ème|eme)\s+arrondissement/i.test(v)) return true;
  if (PARIS_RE.test(v)) return true;
  return [...GRAND_PARIS, ...GRANDES_VILLES].some((ville) => contientVille(v, ville));
}

// ---------------------------------------------------------------------------
// Classement dans l'onglet (volet) — déterministe (PROJET.md §8.2)
// ---------------------------------------------------------------------------
// Le V.I.E est un contrat à part entière, mais quand une maison le publie sur
// son propre ATS (et non via Business France), le champ "type de contrat" dit
// simplement "Full-time" : seul l'intitulé le signale ("VIE Prague — Compliance
// Officer", "VIE, Risk Analyst"). Piège à éviter : l'ASSURANCE VIE, qui n'a rien
// à voir. On exige donc VIE en capitales, isolé, et jamais dans un contexte
// d'assurance ou d'épargne.
const ASSURANCE_VIE_RE = /assurance[\s-]*vie|contrat[\s-]*vie|[ée]pargne/i;
const VIE_TITRE_RE = /(?:^|[^A-Za-zÀ-ÿ])V\.?I\.?E\.?(?:[^A-Za-zÀ-ÿ]|$)/;

function estOffreVIE(title) {
  if (!title || ASSURANCE_VIE_RE.test(title)) return false;
  return VIE_TITRE_RE.test(title);
}

// CDI ou CDD ? Le volet « cdi-cdd » réunit les deux, mais la carte doit dire
// lequel. On lit d'abord le type de contrat déclaré par la source, qui est
// explicite quand il existe, puis l'intitulé, où les annonces françaises
// écrivent presque toujours la mention. En dernier recours le corps du texte.
//
// Quand rien ne tranche, on ne devine pas : la carte garde alors la mention
// générale de l'onglet. Afficher « CDI » sur un CDD serait pire que de ne
// rien afficher.
// Le CDD se trahit par son motif ou par sa durée bien plus souvent que par
// son sigle : « remplacement », « congé maternité », « surcroît d'activité »,
// « mission de 6 mois ». On cherche donc les trois.
const CDD_RE =
  /\bcdd\b|contrat [àa] dur[ée]e d[ée]termin[ée]e|dur[ée]e d[ée]termin[ée]e|fixed[\s-]?term|temporary contract|\bint[ée]rim\b|remplacement|cong[ée] (?:maternit|parental|sabbatique)|surcro[îi]t d.activit[ée]|maternity cover|\bmission de \d{1,2} mois\b|contrat de \d{1,2} mois|\d{1,2}[\s-]month contract/i;
const CDI_RE =
  /\bcdi\b|contrat [àa] dur[ée]e ind[ée]termin[ée]e|dur[ée]e ind[ée]termin[ée]e|permanent(?:e|ly)?\b|poste permanent|open[\s-]?ended/i;

// CDI ou CDD ? Le volet « cdi-cdd » réunit les deux, mais la carte doit dire
// lequel : on ne postule pas de la même façon à un CDD de six mois et à un
// CDI. On lit le type déclaré par la source, puis le titre, puis le corps de
// l'annonce, puis l'adresse — certaines la nomment dans leur URL.
//
// Et à défaut, CDI. Ce n'est pas une devinette : la durée et le motif d'un CDD
// sont obligatoires et toujours annoncés, parce que ce sont les premières
// choses qu'un candidat regarde. Une offre à pourvoir qui ne dit rien de son
// terme est un CDI. Le défaut inverse serait faux presque à chaque fois.
function classifyContrat({ typeContratRaw, title, descr, url }) {
  const dur = (typeContratRaw || '') + ' ' + (title || '');
  if (CDD_RE.test(dur)) return 'CDD';
  if (CDI_RE.test(dur)) return 'CDI';
  const adresse = String(url || '').replace(/[^a-z]+/gi, ' ');
  if (/\bcdd\b/i.test(adresse)) return 'CDD';
  if (/\bcdi\b/i.test(adresse)) return 'CDI';
  const texte = descr || '';
  if (CDD_RE.test(texte)) return 'CDD';
  if (CDI_RE.test(texte)) return 'CDI';
  return 'CDI';
}

function classifyVolet({ src, typeContratRaw, title, url }) {
  if (src === 'labonnealternance') return 'alternance';
  if (src === 'vie') return 'vie';

  // L'INTITULÉ prime sur le type de contrat déclaré. Les ATS d'entreprise
  // renseignent massivement "Full-time", qui décrit les HORAIRES et non le
  // contrat — un stage est lui aussi à temps plein. Cette valeur faisait donc
  // basculer en CDI des stages et alternances que leur titre annonçait sans la
  // moindre ambiguïté ("Stagiaire Consultant", "Alternance Expertise Comptable").
  const ti = (title || '').toLowerCase();
  if (estOffreVIE(title)) return 'vie';
  // "Débutant" décrit un NIVEAU D'EXPÉRIENCE, pas un contrat : « Contrôleur
  // financier débutant » est un poste d'embauche, pas une alternance. Ces
  // offres (TotalEnergies) atterrissaient pourtant dans l'onglet Alternance.
  if (/d[ée]butant/.test(ti) && !/alternan|apprenti|\bstage\b|stagiaire/.test(ti)) return 'cdi-cdd';
  // L'alternance d'abord : "Alternance - stage de 12 mois" est une alternance.
  if (/alternan|apprenti|apprentice|contrat pro/.test(ti)) return 'alternance';
  // Les banques d'affaires anglo-saxonnes ne disent jamais « stage » : leurs
  // programmes s'appellent « Summer Analyst » (stage d'été), « Off-Cycle
  // Analyst » (stage hors période) ou « Spring Week ». Faute de les reconnaître,
  // ces offres partaient en CDI — puis le filtre de séniorité les écartait
  // comme des postes confirmés. Bank of America perdait ainsi la totalité de
  // ses stages parisiens (GCIB Credit, Global Markets Sales & Trading...),
  // c'est-à-dire exactement le cœur de cible de JJ.
  if (/\bstage\b|stagiaire|internship|\bintern\b|\btrainee\b/.test(ti)) return 'stage';

  // L'ADRESSE, quand l'intitulé se tait. Chez Rothschild & Co, « Assistante
  // banquier privé » ne dit rien de son contrat : seule son adresse porte
  // « alternance-assistante-banquier-prive ». Elle partait donc en CDI, où le
  // filtre 0-3 ans la jugeait comme un poste confirmé.
  //
  // On n'y cherche que des mots qui ne peuvent rien dire d'autre, et seulement
  // après avoir interrogé l'intitulé.
  const ui = (url || '').toLowerCase();
  if (/alternance|apprentissage|contrat-pro/.test(ui)) return 'alternance';
  if (/\bstage\b|stage-|-stage|stagiaire|internship/.test(ui)) return 'stage';
  if (/summer analyst|off[\s-]?cycle|spring week|winter analyst|insight programme|placement year/.test(ti))
    return 'stage';

  const t = (typeContratRaw || '').toLowerCase();
  if (/stage|\bmis\b|internship|\bintern\b/.test(t)) return 'stage';
  if (/alternance|apprentissage|professionnalisation|apprentice/.test(t)) return 'alternance';
  if (/cdi|cdd|full[\s-]?time|permanent|fixed[\s-]?term/.test(t)) return 'cdi-cdd';

  return 'cdi-cdd';
}

// ---------------------------------------------------------------------------
// Filtre junior 0-3 ans (PROJET.md §8.4)
// ---------------------------------------------------------------------------
// Note : \b (limite de mot) ne fonctionne pas correctement juste après un
// caractère accentué en JS ("Confirmé" seul ne matchait pas \bconfirm[ée]e?\b
// car \w ne couvre que l'ASCII). On utilise (?=[^a-zà-öø-ÿ]|$) à la place pour
// les groupes qui peuvent se terminer par un accent (forme masculine).
// ATTENTION : \b ne fonctionne pas de façon fiable autour des mots accentués en
// JS (\w ne couvre que l'ASCII), et il rate aussi les pluriels. "Consultants
// seniors" et "Consultant Technique sénior" passaient donc le filtre.
// On délimite donc par "pas une lettre" (accents compris) de chaque côté, et
// on tolère explicitement les pluriels et les variantes accentuées.
const L = 'a-zà-öø-ÿ'; // toute lettre, accents inclus
const AV = `(?<![${L}])`; // début de mot
const AP = `(?![${L}])`; // fin de mot
const SENIOR_RE = new RegExp(
  [
    `${AV}s[ée]niors?${AP}`, // senior, seniors, sénior, séniors
    `${AV}confirm(?:[ée]e?s?|ed)${AP}`, // confirmé/confirmée/confirmed
    `${AV}exp[ée]riment[ée]e?s?${AP}`,
    `${AV}managers?${AP}`,
    `${AV}direct(?:eur|rice|or)s?${AP}`,
    `${AV}head of${AP}`,
    // Titres seniors des banques d'affaires anglo-saxonnes : un "Vice President"
    // ou un "Executive Director" en BFI, c'est 5-10 ans d'expérience.
    `${AV}vice[\\s-]?presidents?${AP}`,
    `${AV}vp${AP}`,
    // Le grade des banques d'affaires : Associate se situe entre trois et six
    // ans. Les lookbehind protègent les formes d'entrée de carrière, qui
    // veulent dire exactement le contraire — « Junior Associate » chez un
    // cabinet de conseil est un premier poste.
    `${AV}(?<!junior\\s)(?<!summer\\s)(?<!graduate\\s)(?<!stage\\s)associates?${AP}`,
    `${AV}principals?${AP}`,
    `${AV}partners?${AP}`,
    `${AV}leads?${AP}`,
    `${AV}chef(?:fe)?s? de${AP}`,
    // "Responsable" apparaît souvent abrégé ("Resp. Cl. Patrimoniale"),
    // de même que les postes d'encadrement d'agence.
    `${AV}responsables?${AP}`,
    `${AV}resp\\.`,
    `${AV}dir\\.`,
    `${AV}second d'agence${AP}`,
    `${AV}adjointe?s?${AP}`,
    `${AV}exp(?:ert|erte)s?${AP}`,
    `${AV}sup[ée]rieure?${AP}`,
    // "4 ans et +", "5 à 7 ans d'expérience"
    `${AV}([4-9]|\\d{2,})\\s*ans?${AP}`,
  ].join('|'),
  'i'
);
const JUNIOR_RE = new RegExp(
  [
    `${AV}juniors?${AP}`,
    `${AV}d[ée]butante?s?${AP}`,
    `${AV}graduates?${AP}`,
    `${AV}jeunes? dipl[ôo]m[ée]e?s?${AP}`,
    `${AV}0[\\s-]?[àa][\\s-]?[23]\\s*ans?${AP}`,
  ].join('|'),
  'i'
);

// Signaux d'ancienneté présents dans le CORPS de l'annonce (pas dans le titre).
// La plupart des intitulés ne disent rien du niveau requis : "Conseiller
// Clientèle (F/H)" peut demander 5 ans d'expérience. Quand la source fournit
// une description, on l'exploite — c'est le seul moyen de tenir la promesse
// "0-3 ans" du brief (§4.1).
// Apostrophe : les annonces bien composées utilisent l'apostrophe
// typographique U+2019 ("d’expérience"), pas la touche du clavier. La classe
// ci-dessous accepte les deux — sans elle, la règle ratait silencieusement
// toutes les annonces françaises correctement typographiées, dont le "3 à 5
// ans d’expérience" de Coface.
const AP_ = `['’]`;

// Un seuil, deux écritures. En français on lit "5 ans d'expérience" ; en
// anglais "5+ years of experience" ou "minimum of 5 years". Les deux langues
// cohabitent dans le même catalogue — Coface, Talan et Sia Partners publient
// indifféremment dans l'une ou l'autre — donc les deux doivent être couvertes.
const DESCR_SENIOR_RE = new RegExp(
  [
    // FR — "4 ans d'expérience", "3 à 5 ans d'expérience" (on lit la borne
    // haute : un poste "3 à 5 ans" recrute un profil confirmé).
    // « et » compte autant que « à » : « entre 3 et 5 ans » est la tournure
    // la plus courante des annonces françaises, et elle passait entière.
    `\\b\\d+\\s*(?:à|a|-|/|et|ou)\\s*([4-9]|[1-9]\\d)\\s*ans?`,
    // Même fourchette en anglais : « between 3 and 5 years ».
    `\\b\\d+\\s*(?:to|and|-|/)\\s*([4-9]|[1-9]\\d)\\s*years?`,
    `\\b([4-9]|[1-9]\\d)\\s*ans?\\s+(?:minimum\\s+|au\\s+moins\\s+)?d${AP_}?e?\\s*exp[ée]rience`,
    // "Expérience dans un rôle similaire de 5 ans" : mots intercalés tolérés.
    `exp[ée]rience[^.;·•\\n]{0,40}?\\bde\\s+([4-9]|[1-9]\\d)\\s*ans?`,
    // Le seuil est à QUATRE ans, pas trois : la cible annoncée est « 0-3 ans »,
    // donc une offre qui demande « minimum 3 ans » reste dans le périmètre —
    // c'est sa borne haute. À partir de quatre, le poste n'est plus junior.
    `(?:minimum|au\\s+moins|mini\\.?)\\s+(?:de\\s+)?([4-9]|[1-9]\\d)\\s*ans?`,
    `\\b([4-9]|[1-9]\\d)\\s*\\+\\s*ans?`,
    `exp[ée]rience\\s+confirm[ée]e|exp[ée]rience\\s+significative`,
    `votre\\s+expertise|exp[ée]riment[ée]e?\\s+sur\\s+ce\\s+poste`,
    `justifiez\\s+d${AP_}?\\s*une\\s+exp[ée]rience\\s+(?:r[ée]ussie|confirm[ée]e|significative)`,
    // EN — "5 years of experience", "5+ years", "10 years in Sales Operations".
    // On exige un mot d'expérience derrière le nombre : sans cette contrainte,
    // "Master's degree (5 years of study)" ferait sortir un vrai junior.
    `\\b([4-9]|[1-9]\\d)\\s*(?:\\+|to\\s*\\d+|-\\s*\\d+)?\\s*years?` +
      `(?:\\s+of)?\\s+(?:relevant\\s+|professional\\s+|proven\\s+|solid\\s+|hands-?on\\s+|work\\s+|prior\\s+)*` +
      `(?:experience|expertise|in\\b|as\\s+a)`,
    `\\b([4-9]|[1-9]\\d)\\s*\\+\\s*years?\\s+(?:of\\s+)?(?:relevant\\s+|professional\\s+)*experience`,
    `(?:minimum|at\\s+least|min\\.?)\\s+(?:of\\s+)?([4-9]|[1-9]\\d)\\s*years?\\s+(?:of\\s+)?(?:\\w+\\s+){0,2}experience`,
    `proven\\s+(?:track\\s+record|experience)|extensive\\s+experience|senior\\s+level`,
  ].join('|'),
  'i'
);

// À l'inverse, une mention explicite d'ouverture aux débutants l'emporte.
// Tous les synonymes de « on prend un jeune ». C'est la porte de sortie du
// mode strict : une annonce qui se déclare ouverte aux débutants est publiée
// même si rien d'autre ne permet de vérifier le niveau.
const DESCR_JUNIOR_RE =
  /d[ée]butant[e]?s?\s+(?:accept|bienvenu|welcome)|jeune\s+dipl[ôo]m|premi[èe]re\s+exp[ée]rience|sans\s+exp[ée]rience|profil\s+junior|ouvert\s+aux\s+d[ée]butants|sortie?\s+d['’]?[ée]cole|\bjunior\b|\bd[ée]butant|entry[\s-]?level|graduate\s+program|no\s+experience\s+required/i;

// Les "candidatures spontanées" ne sont pas des offres : ce sont des
// formulaires de dépôt de CV, sans poste réel derrière. Les afficher
// reviendrait à publier des ghost jobs, exactement ce que JJ combat (§2).
const SPONTANEOUS_RE = /candidatures?\s+spontan[ée]es?|spontaneous\s+application|vivier\s+de\s+candidat|\bjob\s+test\b/i;

// Recrutement d'indépendants : agent général, mandataire, profession libérale,
// franchise. Ce ne sont pas des emplois juniors salariés mais des propositions
// de créer sa propre activité — et les assureurs les publient dupliquées
// département par département, ce qui noie les vraies offres (32 annonces AXA
// identiques à un numéro de département près). Hors périmètre de JJ.
// Intitulés qui ne nomment aucun métier. Certaines sources construisent le
// titre à partir de l'URL ou d'un gabarit : Andera publiait « Offre - Andera
// Infra », LSEG « Intern », Oliver Wyman « Entry ». Le candidat ne peut rien en
// faire — il ne sait même pas de quel poste il s'agit — et ces cartes donnent
// l'impression d'un catalogue bâclé. Mieux vaut une offre de moins.
const TITRE_SANS_METIER_RE =
  /^(?:offres?|postes?|jobs?|opportunit[ée]s?|candidature|recrutement|annonce)\b/i;
const TITRE_CREUX_RE =
  /^(?:interns?|internships?|entry(?:\s+level)?|off[\s-]?cycle|graduate|trainee|junior|d[ée]butant|profils?|divers|autres?)$/i;

// Un intitulé qui se réduit au nom de la maison ne dit rien non plus : après
// avoir retiré l'employeur, il doit rester de quoi reconnaître un métier.
function titreNommeUnMetier(titre, emp) {
  const t = (titre || '').trim();
  if (!t || TITRE_SANS_METIER_RE.test(t) || TITRE_CREUX_RE.test(t)) return false;
  const cle = (s) =>
    (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  const sansEmployeur = cle(t).replace(cle(emp), '');
  return sansEmployeur.length >= 4;
}

// ---------------------------------------------------------------------------
// Retrait à la demande
// ---------------------------------------------------------------------------
// Les mentions légales promettent qu'une entreprise peut obtenir le retrait
// durable de ses offres. Honorer cette demande à la main ne tiendrait pas : les
// offres reviendraient au passage suivant. La liste est donc lue à chaque
// collecte, et une ligne y suffit — aucun code à toucher.
const EXCLUSIONS_PATH = path.join(__dirname, 'exclusions.txt');

function chargerExclusions() {
  const domaines = [];
  const employeurs = [];
  let lignes;
  try {
    lignes = fs.readFileSync(EXCLUSIONS_PATH, 'utf8').split('\n');
  } catch {
    return { domaines, employeurs }; // fichier absent : rien à exclure
  }
  for (const brute of lignes) {
    const ligne = brute.split('#')[0].trim();
    if (!ligne) continue;
    const m = ligne.match(/^(domaine|employeur)\s*:\s*(.+)$/i);
    if (!m) {
      console.warn(`[exclusions] ligne ignorée (forme attendue « domaine: » ou « employeur: ») : ${ligne}`);
      continue;
    }
    const valeur = m[2].trim().toLowerCase();
    if (/^domaine$/i.test(m[1])) domaines.push(valeur);
    else employeurs.push(valeur);
  }
  if (domaines.length || employeurs.length) {
    console.log(
      `[exclusions] ${domaines.length} domaine(s) et ${employeurs.length} employeur(s) exclus à leur demande.`
    );
  }
  return { domaines, employeurs };
}

const EXCLUSIONS = chargerExclusions();

function estExclue(url, emp) {
  const e = String(emp || '').toLowerCase();
  if (EXCLUSIONS.employeurs.some((x) => e.includes(x))) return true;
  if (!EXCLUSIONS.domaines.length) return false;
  let hote;
  try {
    hote = new URL(url).host.toLowerCase();
  } catch {
    return false;
  }
  // Le sous-domaine compte : exclure « exemple.com » doit aussi écarter
  // « carrieres.exemple.com », sinon la demande serait contournée par accident.
  return EXCLUSIONS.domaines.some((d) => hote === d || hote.endsWith('.' + d));
}

const INDEPENDANT_RE =
  /profession\s+lib[ée]rale|agent\s+g[ée]n[ée]ral|\bmandataire\b|ind[ée]pendant|franchis[ée]|cr[ée]ateur\s+d.entreprise|auto-?entrepreneur|\bentrepreneur\s+en\b|votre\s+propre\s+(?:cabinet|agence|activit[ée])|\bVDI\b/i;

// Intitulés de vente / développement commercial. Cette liste ne suffit jamais
// à écarter une offre à elle seule : elle n'a de sens que croisée avec le type
// de maison (voir son unique point d'appel). « Sales trader », « Sales Front
// Office » ou « Sales ESG » dans une société de gestion restent en périmètre.
const VENTE_HORS_FINANCE_RE =
  /\bsales\b|\bcommercial(?:e|es|aux)?\b|business\s+develop|d[ée]veloppement\s+commercial|\bkey\s+account\b|chargé\w*\s+d[e']\s*affaires?\s+commercial/i;

// Le dernier paramètre distingue les deux passages du filtre. Au premier, les
// descriptions n'ont pas encore été récupérées : refuser les offres qui n'en
// ont pas viderait le catalogue avant même être allé les lire. Au second,
// après lecture des fiches, l'absence de description signifie qu'on n'a PAS PU
// vérifier le niveau — et une offre invérifiable n'est pas publiée.
//
// C'est un arbitrage assumé : mieux vaut perdre des offres correctes que
// d'en publier une seule qui demande sept ans d'expérience. Un candidat qui
// tombe sur un poste hors de sa portée, sur un site qui promet du 0-3 ans, ne
// revient pas.
// Toutes les durées d'expérience citées par une annonce, en années.
//
// On ne cherche plus des tournures : on cherche des NOMBRES suivis d'« ans »
// ou d'« années », puis on regarde autour d'eux si l'on parle bien
// d'expérience professionnelle. Cette inversion est tout l'objet de la
// refonte — une annonce peut écrire son exigence de mille façons, elle finit
// toujours par un nombre et le mot « ans ».
//
// Trois garde-fous, chacun payé par un faux positif observé :
//   - au-delà de vingt ans, ce n'est plus une exigence mais l'âge de la
//     maison (« façonné par plus de 145 ans d'expérience », Indosuez) ;
//   - « 5 années d'études » ou « Bac+5 » décrivent un diplôme, pas un poste ;
//   - le mot « expérience » doit être proche, sinon « 3 000 consultants
//     depuis 48 bureaux » ferait sortir un stage.
const ANNEES_RE = /(\d{1,2})\s*(?:\+\s*)?(?:ans?|ann[ée]es?|years?)\b/gi;
const CONTEXTE_EXPERIENCE_RE = /exp[ée]rience|experience|exp\./i;
const CONTEXTE_A_IGNORER_RE =
  /[ée]tudes?|study|studies|dipl[ôo]m|bac\s*\+|scolarit|cursus|formation|anciennet[ée]|fond[ée]e?\s+en|depuis\s+plus|histoire|history|savoir[\s-]faire|contrat de|dur[ée]e (?:du|de la|d[eu]) (?:contrat|mission|stage)|\bcdd\b de/i;

function dureesExperienceCitees(texte) {
  const trouvees = [];
  if (!texte) return trouvees;
  for (const m of String(texte).matchAll(ANNEES_RE)) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) continue;
    // La fenêtre est large devant (« une expérience réussie de 5 ans ») et
    // plus courte derrière (« 5 ans d'expérience »).
    const avant = texte.slice(Math.max(0, m.index - 90), m.index);
    const apres = texte.slice(m.index, m.index + 60);
    const fenetre = avant + apres;
    if (!CONTEXTE_EXPERIENCE_RE.test(fenetre)) continue;
    if (CONTEXTE_A_IGNORER_RE.test(fenetre)) continue;
    trouvees.push(n);
  }
  return trouvees;
}

// La borne haute de ce qu'une annonce réclame. « Entre 3 et 5 ans » demande
// cinq ans ; « 0 à 3 ans » en demande trois. On lit donc le maximum.
const EXPERIENCE_MAX_ANNEES = 3;

function passesJuniorFilter(volet, title, descr, strict) {
  if (SPONTANEOUS_RE.test(title || '')) return false;
  if (INDEPENDANT_RE.test(title || '')) return false;
  if (volet !== 'cdi-cdd') return true; // stage/alternance = junior par nature
  if (SENIOR_RE.test(title)) return false;

  // Les durées citées passent AVANT tout le reste, y compris avant le mot
  // « junior ». Une annonce intitulée « Junior Consultant » qui réclame cinq
  // ans n'est pas une offre junior : le chiffre est la donnée dure, le
  // qualificatif est du vocabulaire de marque.
  const durees = dureesExperienceCitees(descr);
  if (durees.some((n) => n > EXPERIENCE_MAX_ANNEES)) return false;

  if (descr) {
    if (DESCR_SENIOR_RE.test(descr)) return false; // « confirmé », « expertise »
    if (DESCR_JUNIOR_RE.test(descr)) return true; // ouverture explicite
    // Une durée citée et compatible vaut acceptation : « 2 ans » est un
    // niveau annoncé, pas un silence — c'est même le cas le plus fréquent
    // des offres qui conviennent.
    if (durees.length) return true;
    return true; // description lue, aucun signal contraire
  }
  if (JUNIOR_RE.test(title)) return true; // l'intitulé se déclare junior
  return !strict;
}

// ---------------------------------------------------------------------------
// Normalisation par source -> schéma unifié
// { emp, title, sector, famille, volet, loc, place, sal?, dl?, url, source, alsoOn? }
// ---------------------------------------------------------------------------
// Workday ne renvoie qu'un texte relatif ("Posted Today", "Posted Yesterday",
// "Posted 5 Days Ago", "Posted 30+ Days Ago") au lieu d'une date absolue.
function parseWorkdayRelativeDate(postedOn) {
  const text = (postedOn || '').toLowerCase();
  let daysAgo = null;

  if (/today|aujourd/.test(text)) daysAgo = 0;
  else if (/yesterday|hier/.test(text)) daysAgo = 1;
  else {
    // « Posted 5 Days Ago », « Posted 30+ Days Ago »
    let m = text.match(/(\d+)\+?\s*days?\s*ago/);
    // « Offre publiée il y a 27 jours », « il y a 30 jours ou plus »
    if (!m) m = text.match(/il y a\s+(\d+)\s*jours?/);
    if (m) daysAgo = parseInt(m[1], 10);
    else {
      // « il y a 2 mois » : on compte trente jours par mois, ce qui suffit
      // puisque le seuil d'âge se mesure en mois entiers.
      const mois = text.match(/il y a\s+(\d+)\s*mois|(\d+)\+?\s*months?\s*ago/);
      if (mois) daysAgo = 30 * parseInt(mois[1] || mois[2], 10);
    }
  }

  // Ne pas comprendre la date ne doit PAS la rendre fraîche : l'ancien repli à
  // zéro jour datait du jour même toutes les annonces françaises de Workday.
  // On rend null, et le pipeline ira lire la vraie date sur la fiche.
  if (daysAgo === null) return null;

  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  return now.toISOString();
}

// « 25 août » — un jour et un mois, sans année : le format des cartes Yello
// (EY). L'année n'y figure pas, on prend l'année courante ; si la date ainsi
// obtenue tombe plus de sept jours dans le futur, elle appartient à l'année
// précédente — une annonce n'est jamais publiée demain.
//
// « NOUVEAU », que Yello affiche pour les annonces toutes fraîches, ne nomme
// aucun jour. On rend null : une date qu'on n'a pas reste nulle, sans quoi
// l'offre prétendrait à une fraîcheur qu'on ne peut pas vérifier.
// Indexé à partir de ZÉRO, pour Date.UTC, et accentué comme l'écrivent les
// annonces. Un second MOIS_FR existe plus bas, indexé à partir de UN et sans
// accents : les deux servent des formats différents, d'où les deux noms.
const MOIS_FR_INDEX = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10,
  décembre: 11, decembre: 11,
};

function dateFrancaiseSansAnnee(texte) {
  const m = String(texte || '')
    .toLowerCase()
    .match(/(\d{1,2})\s+([a-zà-ÿ]+)/);
  if (!m) return null;
  const mois = MOIS_FR_INDEX[m[2]];
  if (mois === undefined) return null;
  const maintenant = new Date();
  let d = new Date(Date.UTC(maintenant.getUTCFullYear(), mois, Number(m[1])));
  if (isNaN(d)) return null;
  // Plus de sept jours dans le futur : c'était l'an dernier.
  if (d.getTime() - maintenant.getTime() > 7 * 86400000) {
    d = new Date(Date.UTC(maintenant.getUTCFullYear() - 1, mois, Number(m[1])));
  }
  return d.toISOString();
}

// Format BPCE OpenData : "28/08/2026 4:24:59 PM" (DD/MM/YYYY H:MM:SS AM/PM).
function parseFrenchDateTime(text) {
  const match = (text || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return new Date().toISOString();
  const [, day, month, year] = match;
  return new Date(`${year}-${month}-${day}`).toISOString();
}

// Les sources renvoient souvent du HTML brut : "Chargé" arrive en "Charg&#233;"
// et "&" en "&amp;". Sans décodage, ces séquences s'affichent telles quelles sur
// les cartes (défaut visible chez plusieurs concurrents analysés).
const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
};

function decodeEntities(text) {
  return (text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&[a-z]+;/gi, (e) => HTML_ENTITIES[e.toLowerCase()] || e);
}

// Nettoyage des intitulés. Les sources empilent des préfixes de contrat
// ("Stage : Stage - Finance"), des mentions de genre répétées ("(H/F) ... (H/F)")
// et des codes internes ("#TDFE2026"). Le type de contrat est déjà porté par
// l'onglet, et la mention H/F par la loi — pas besoin de les répéter dans le
// titre. Objectif : un intitulé qui se lit comme un nom de poste.
// Une annonce sur vingt arrive tout en capitales ("CHARGE D'AFFAIRES GRANDES
// ENTREPRISES NICE"). Sur une liste, ça hurle et ça se lit mal. On repasse en
// casse normale, en laissant tranquilles les sigles courts (CDI, M&A, ESG, RH)
// et les mots qui contiennent un chiffre (H/F, BAC+5).
// Mots-outils français : en capitales d'origine ils doivent redescendre en
// minuscules, pas rester tels quels ("Chef DE Produits").
const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux',
  'sur', 'sous', 'pour', 'par', 'dans', 'chez', 'un', 'une', 'a']);

// Sigles à laisser intacts même longs : les recasser les rendrait illisibles.
const SIGLES = new Set(['CDI', 'CDD', 'RH', 'ESG', 'KYC', 'LCB', 'FT', 'ALM', 'IARD',
  'SI', 'IT', 'BI', 'PME', 'ETI', 'ADV', 'DAF', 'FPA', 'MOA', 'MOE', 'VIE', 'CVC']);

function adoucirMajuscules(titre) {
  if (!titre) return titre;
  // Titres tout en minuscules ("comptable général h/f") : on met au moins la
  // première lettre en capitale, pour que la liste ne mélange pas les styles.
  if (titre === titre.toLowerCase() && /[a-zà-öø-ÿ]/.test(titre)) {
    return titre.replace(/^([a-zà-öø-ÿ])/, (c) => c.toUpperCase());
  }
  if (titre !== titre.toUpperCase()) return titre;
  if (titre.replace(/[^A-ZÀ-Ö]/g, '').length < 8) return titre;
  return titre
    .split(' ')
    .map((mot, i) => {
      const nu = mot.replace(/[^A-Za-zÀ-ÿ]/g, '');
      if (SIGLES.has(nu)) return mot;
      if (nu.length <= 3 && !PETITS_MOTS.has(nu.toLowerCase())) return mot; // sigle court
      if (/d/.test(mot)) return mot;
      const bas = mot.toLowerCase();
      // Les mots-outils restent en minuscules, sauf en tête de titre.
      if (i > 0 && PETITS_MOTS.has(nu.toLowerCase())) return bas;
      // Majuscule initiale seulement : ni après une apostrophe (d'affaires),
      // ni après un tiret dans un mot composé déjà couvert plus bas.
      return bas.replace(/^([a-zà-öø-ÿ])/, (c) => c.toUpperCase());
    })
    .join(' ');
}

// Toutes les entrées d'un site carrières ne sont pas des offres d'emploi. On y
// trouve des événements ("Thales AfterWork Finance - 16 Avril"), des pages de
// marque ("Marsh aime les avocats"), et des métiers qui n'ont de financier que
// l'employeur : juristes, avocats, recruteurs. Les laisser passer, c'est faire
// perdre son temps au candidat sur une liste qui promet des offres.
const PAS_UNE_OFFRE_RE =
  /afterwork|after[\s-]work|webinar|webinaire|job ?dating|portes ouvertes|forum (?:de |des )?(?:recrutement|m[ée]tiers|[ée]coles)|\bsalon\b|meet ?up|conf[ée]rence|d[ée]couvrez|rejoignez[\s-]nous|candidature spontan[ée]e|talent ?pool|cooptation|stage en 1 jour|stage d.un jour|\b1 jour pour\b/i;

// Une offre dont l'intitulé annonce une prise de poste DÉJÀ PASSÉE n'est plus
// pourvoyable : "Assistant Contrôle de Gestion – Janvier 2026" affiché en août
// 2026 fait perdre son temps au candidat. Les maisons laissent traîner ces
// annonces sur leur site longtemps après la date. On ne retient que le mois à
// venir (avec un mois de tolérance, le temps que la campagne se termine).
const MOIS_FR = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

function dateDePosteDepassee(titre, maintenant = new Date()) {
  const t = (titre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const m = t.match(
    /(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(20\d\d)/
  );
  if (!m) return false;
  const annonce = new Date(Number(m[2]), MOIS_FR[m[1]] - 1, 1);
  const limite = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
  return annonce < limite;
}

// Métiers qui n'ont de financier que l'employeur. Le droit et la fiscalité en
// font partie : chez un Big Four, un « Stage Fiscalité » relève du pôle
// juridique et fiscal, pas d'une des familles de JJ — et le public visé n'est
// pas le même. Idem pour la communication, le design, la gestion de projet et
// la facturation, qui remontaient par des intitulés hébergés chez des maisons
// de finance (Community manager chez Rothschild, Design Authority chez Crédit
// Agricole, Assistant chef de projet chez BNP).
// Métiers qui ne relèvent pas de la finance et qui ne doivent JAMAIS paraître
// sur JJ. Ces offres ne sont pas reclassées ailleurs : elles sont écartées.
// Les laisser tomber dans « Autres métiers de la finance » revenait à faire
// passer un ingénieur réseau ou un chargé de communication pour un métier de
// la finance, ce qui décrédibilise le catalogue entier.
//
// La règle est bâtie par familles de métiers, pour rester relisible : un
// littéral d'expression régulière de trente lignes ne se corrige plus.
const METIER_HORS_PERIMETRE_RE = new RegExp(
  [
    // Juridique, fiscal, ressources humaines
    "general counsel|\\bavocat|\\battorney\\b|\\blawyer\\b|\\bjuriste\\b|\\bjuridique\\b|\\blegal\\b",
    "fiscalit[ée]|\\bfiscalist|\\btax\\b",
    "recruiter|talent acquisition|charg[ée]e? de recrutement|ressources humaines|\\bpaie\\b|payroll",
    // Informatique et ingénierie
    "\\bd[ée]veloppeur|\\bdeveloper\\b|devops|devsecops|software engineer|cloud engineer|network engineer",
    "\\bnetops\\b|sysadmin|administrateur (?:syst|r[ée]seau)|technicien informatique|it (?:security|support|developer)",
    "ing[ée]nieur (?:logiciel|r[ée]seaux?|cloud|syst[èe]me|infrastructure|s[ée]curit[ée]|digital|[ée]tudes)",
    "salesforce|\\bmainframe\\b|architecte|\\barchitect\\b|digital workplace|forward deployment",
    // « IA » en français, « AI » en anglais : les deux graphies cohabitent
    // dans un même catalogue, parfois chez le même employeur.
    "intelligence artificielle|\\b[ai]a\\b (?:manager|enablement|engineer)|am[ée]lioration continue",
    // Communication, marketing, événementiel
    "community manager|\\bdesign\\b|\\bdesigner\\b|communication|[ée]ditorial|\\bmarketing\\b",
    "[ée]v[ée]nementiel|\\bevents?\\b|\\bbrand\\b|chef(?:fe)? de produits?",
    // Achats, logistique, industrie, sécurité
    "\\bacheteur\\b|\\bachats\\b|\\bbuyer\\b|procurement|aftersales|approvisionn|supply chain|manufacturing|\\bdouane\\b",
    "services g[ée]n[ée]raux|business continuity",
    "risques professionnels|pr[ée]vention des risques|sant[ée] au travail|\\bhse\\b|\\bqhse\\b|s[ûu]ret[ée]",
    // Divers sans rapport avec la finance
    "chef(?:fe)? de projet|charg[ée]e? de facturation|\\bfacturation\\b|centre d.affaires?",
    "\\binfirmi|aide[\\s-]soignant",
    // Relevés en dépouillant le fourre-tout : sécurité informatique, web,
    // documentation, assistanat pur, et les intitulés qui ne nomment qu'une
    // école ou une entreprise.
    "\\bwebmaster\\b|analyste soc\\b|\\bsoc\\b analyst|\\brag\\b|agents? ia\\b",
    "\\bauthor\\b|doctrine|publications?$|recherche et d.innovation",
    // Assistanat, juridique, informatique et affaires réglementaires des
    // grands cabinets : relevés dans le résidu le 02/09/2026.
    "assistant.{0,4}administratif|executive assistant|assistant.{0,4}de direction",
    "\\bdroit\\b|propri[ée]t[ée] intellectuelle|mobilit[ée] internationale",
    // Informatique déguisée en analyse : « Analyste Fonctionnel SIRH » chez
    // VINCI, « Analyste SAP », « Analyste Business Solutions ».
    // Consultants en financement de l'innovation : des ingénieurs. Et un
    // intitulé qui commence par « Ou » est une phrase coupée, pas un poste.
    "consultant.{0,4} scientifique|micro-?[ée]lectronique|consultant informatique|^ou\\b",
    "analyste fonctionnel|\\bsirh\\b|\\bsap\\b|business solutions|solutions d.entreprises",
    // Qualité industrielle, sécurité, logistique.
    "\\bcq\\b|assurance produit|vuln[ée]rabilit|supply officer|cargo|standard parts",
    // Renseignement, affaires publiques, innovation : ni finance ni conseil.
    "intelligence analyst|government relations|policy officer|emerging tech",
    // Rémunération et recrutement, en anglais cette fois.
    "compensation (?:&|and) benefits|recruitment day|assistant polyvalent",
    // Ingénierie mécanique, même sous un intitulé de financement.
    "ing[ée]nieur m[ée]canique|ing[ée]nieur junior analyste",
    // Intitulé réduit à un seul mot : illisible sur une carte.
    "^finance$|^[ée]conomie$",
    "assistant.{0,4}graphique|[ée]coute utilisateurs|data integration|\\bsi\\b finance|servicenow|support it\\b|affaires r[ée]glementaires|quality system|\\bfondation\\b",
    "\\bea\\b\\s*/|team assistant|assistance technique|assistant coordination",
    "coordinateur international|engineering business|industry group",
    "head of growth|gestionnaire digital",
    "assurance qualit[ée]|flow assurance|accr[ée]ditation|laboratoire",
    "sourcing|lead buyer|talent development|gestion administrative",
    "gestionnaire (?:export|r[ée]sidentiel|immobilier|d.exploitation)",
    "^[ée]cole$|centralesup|analyste transport",
    // Immobilier d'exploitation : gérer un parc locatif n'est pas un métier
    // de la finance, à la différence de l'investissement immobilier.
    "gestionnaire locatif|n[ée]gociateur immobilier|assistant.{0,3} de copropri[ée]t|projets? immobiliers?|op[ée]rations? immobili[èe]res?",
    // Rémunération, personnel, instances : ressources humaines.
    "r[ée]mun[ée]rations?|avantages sociaux|administration du personnel|\\bcse\\b",
    // Informatique et web, sous toutes leurs graphies.
    "dev react|frontend|\\bweb analyst\\b|data ing[ée]nieur|ing[ée]nieur ia\\b|\\bcmdb\\b",
    // « quality analyst » a été retiré d'ici : dans une banque, la qualité
    // porte sur les DONNÉES financières — « Data Quality Analyst » est un
    // poste junior de gouvernance de la donnée. L'assurance qualité
    // industrielle reste écartée par « assurance qualité » plus haut.
    "data management office|data protection officer|\\bdpo\\b|\\brgpd\\b|gestionnaire.{0,6}flotte",
    "product manag|appels? d.offres",
    // Formation, communication, relations sociales : ressources humaines.
    "^learning\\b|learning and development|affaires sociales|affaires publiques",
    "\\bcom\\b interne|communication interne",
    // Intelligence artificielle : hors périmètre, quel que soit l'habillage.
    "ai enablement|architecture ai\\b|\\bai\\b (?:engineer|architect)",
    // Souscription et gestion de contrats d'assurance dommages.
    "underwrit|dommages aux biens|\\bird\\b and construction|production construction",
    "professional services implementation",
    // Un intitulé qui ne nomme qu'une entreprise, ou qu'un mot, ne dit rien
    // au candidat : mieux vaut ne pas le publier que le publier illisible.
    "^oliver wyman|portzamparc.{0,45}(?:syst[èe]mes? d.informations?|informatique)|^data$|^gestionnaire administratif$",
  ].join("|"),
  "i"
);

// JJ s'adresse aux profils Bac+5 : grande école de commerce, école d'ingénieur,
// master universitaire. Les intitulés qui annoncent explicitement un niveau
// inférieur — BTS, DUT, licence, bachelor, Bac+2/+3 — visent un autre public, et
// noyaient l'alternance sous des annonces d'assistanat comptable.
const NIVEAU_TROP_BAS_RE =
  /\bbts\b|\bdut\b|(?<!large )(?<!large-)(?<!mid )(?<!mid-)(?<!small )(?<!small-)(?<!market )(?<!market-)\bcap\b|licence pro|\blicence\b|bachelor|bac\s*\+?\s*[23]\b|bac\s*obtenu|niveau bac\b/i;

// ... sauf quand l'annonce ouvre une FOURCHETTE. « Bac+3 à Bac+5 », « Licence
// ou Master », « Bac+3/Bac+5 » : le niveau bas y élargit l'accès, il n'exclut
// personne. C'est la formulation la plus répandue en alternance, où une
// entreprise ouvre volontiers le même poste à plusieurs niveaux — et la
// prendre pour un refus faisait perdre des offres qui visaient aussi le Bac+5.
const NIVEAU_ELEVE_RE =
  /bac\s*\+?\s*[45]\b|\bmaster\b|\bm[12]\b|\bdscg\b|ing[ée]nieur|grande[\s-][ée]cole|\bmsc\b|\bmba\b|derni[èe]re ann[ée]e|fin d.[ée]tudes/i;

// Vrai seulement si le niveau annoncé exclut réellement notre public.
function niveauHorsCible(titre) {
  return NIVEAU_TROP_BAS_RE.test(titre) && !NIVEAU_ELEVE_RE.test(titre);
}

// Écoles, CFA et organismes de formation qui publient l'annonce À LA PLACE de
// l'entreprise. Le candidat ne travaillerait pas pour eux : on lui vend une
// formation, et le « lien direct entreprise » promis par JJ n'existe pas. Ces
// annonces sont en outre dupliquées d'une ville à l'autre et jamais rattachées
// à une maison réelle.
const EMPLOYEUR_ECOLE_RE =
  /\b[ée]coles?\b|\bcfa\b|\bcampus\b|centre de formation|\bmbway\b|\besam\b|\baftec\b|\bihecf\b|\be2se\b|aivancity|inted group|studency|\biesa\b|groupe alternance|\bipac\b|formation/i;

function estUneOffreFinance(titre) {
  return (
    !PAS_UNE_OFFRE_RE.test(titre) &&
    !METIER_HORS_PERIMETRE_RE.test(titre) &&
    !niveauHorsCible(titre) &&
    !dateDePosteDepassee(titre)
  );
}

function cleanTitle(title) {
  let t = decodeEntities(title || '').replace(/\s+/g, ' ').trim();

  // 1) Préfixes de contrat répétés en tête, éventuellement plusieurs fois :
  //    "Stage : Stage - Finance" -> "Finance"
  const prefixe = /^(?:stage|stagiaire|alternance|alternant|apprentissage|apprenti|internship|intern|cdi|cdd|vie|job d['’]?[ée]t[ée])\s*(?:de fin d['’]?[ée]tudes?\s*)?(?:\d+\s*mois\s*)?[:\-–—]\s*/i;
  for (let i = 0; i < 3 && prefixe.test(t); i++) t = t.replace(prefixe, '');

  // 2) Durées et dates résiduelles en tête : "6 mois - ", "- Janvier 2027 - "
  t = t.replace(/^\d+\s*mois\s*[:\-–—]\s*/i, '');

  // 2 bis) La même chose en QUEUE, et en anglais : « Real Estate Investment -
  //    6 months » chez Schroders. Le coût dépasse l'esthétique — quatre offres
  //    Schroders partageaient cette queue et se lisaient comme des doublons
  //    alors que ce sont quatre postes distincts. Le séparateur devant est
  //    exigé : sans lui, on amputerait un titre dont la durée fait le sens.
  t = t.replace(/[\s\-–—(,]+\d+\s*(?:mois|months?)\s*[)\s]*$/i, '');

  // 2 ter) Nombre de postes et nature du recrutement, que VINCI place en queue :
  //    « Analyste PMO - 1 en pré-embauche », « - 2 stages de fin d'études en
  //    pré-embauche ». Ce n'est pas le nom du métier. Les deux intitulés
  //    deviennent identiques et fusionnent à la déduplication, ce qui est
  //    juste : c'est le même poste, annoncé deux fois avec un compte différent.
  t = t.replace(
    /[\s\-–—(,]+\d+\s*(?:stages?|alternances?|postes?|contrats?)?\s*(?:de fin d['’]?[ée]tudes?\s*)?(?:en\s*)?pr[ée][\s-]?embauche\s*[)\s]*$/i,
    ''
  );
  t = t.replace(/[\s\-–—(,]+(?:en\s*)?pr[ée][\s-]?embauche\s*[)\s]*$/i, '');

  // 2 quater) Miettes de gabarit d'adresse. Oracle Cloud nomme ses fiches
  //    « /offer/... » et le mot se retrouvait en tête : « offer - Sovereign
  //    Advisory Group » chez Lazard. Le séparateur qui suit est exigé, sans
  //    quoi un vrai titre commençant par « Offre de stage… » serait amputé.
  t = t.replace(/^(?:offer|offre|job|poste|emploi|vacancy|position)\s*[:\-–—]\s*/i, '');

  // 2 quinquies) Nom de l'événement de recrutement, que la Société Générale
  //    place en tête : « 1 EN 1 JOUR – Assistant Trader ». « 1 en 1 jour » est
  //    leur journée de recrutement — postuler le matin, réponse le soir. Ce
  //    n'est pas le métier, et en tête c'est pourtant ce qu'on lit d'abord.
  t = t.replace(
    /^(?:1\s*en\s*1\s*jour|job\s*dating|forum\s+(?:de\s+)?recrutement|journ[ée]e\s+(?:de\s+)?recrutement)\s*[:\-–—]\s*/i,
    ''
  );

  // 3) Mentions de genre : on n'en garde aucune (redondant, alourdit la lecture).
  //    Les sources écrivent aussi bien "H/F" que "M/F", "F/M" ou "M/W" — la
  //    règle ne couvrait que la forme française et laissait passer les autres.
  t = t.replace(/[\s\-–—(]*\b[hfmw]\s*\/\s*[hfmwx](?:\s*\/\s*[dx])?\b[)\s]*/gi, ' ');
  t = t.replace(/\((?:h|f|m)\s*\/\s*(?:f|h|w|d)\)/gi, ' ');

  // 3 bis) Parenthèse finale qui ne fait que répéter la famille métier déjà
  //    affichée sur la carte : « M&A Large Cap – M&A Analyst
  //    (Fusions-Acquisitions) ». La liste est courte et fermée à dessein —
  //    « (Stratégie - M&A) » chez Ardian précise le périmètre du poste et n'y
  //    correspond pas. Une règle qui aurait supprimé toute parenthèse finale
  //    aurait mangé de l'information utile.
  t = t.replace(
    /\s*\((?:fusions?[\s\-–—&/]*acquisitions?|m\s*&\s*a|corporate finance|private equity|capital[\s\-]investissement|asset management|gestion d['’]actifs|audit|contr[ôo]le de gestion|comptabilit[ée])\)\s*$/i,
    ' '
  );

  // 4) Codes internes et hashtags : "#TDFE2026", "(réf. 12345)", "(10266)"
  t = t.replace(/#\S+/g, ' ').replace(/\(\s*r[ée]f\.?[^)]*\)/gi, ' ');
  t = t.replace(/\(\s*\d{3,}\s*\)/g, ' ');

  // 5) Dates de prise de poste, où qu'elles soient : « - Janvier 2027 »,
  //    « (octobre 2026) », « Rentrée de Mars 2026 ». L'onglet et la date de
  //    publication portent déjà cette information ; dans le titre, elle ne fait
  //    que casser l'alignement d'une liste à l'autre.
  // Les mois anglais comptent autant que les français : les banques d'affaires
  // datent leurs promotions de stagiaires dans l'intitulé, en anglais. Sans
  // eux, Lazard s'affichait « January - Lazard Investment Banking Intern » —
  // le mois passe avant le métier, et la liste ne s'aligne plus.
  const MOIS =
    'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre|' +
    'january|february|march|april|may|june|july|august|september|october|november|december';
  //    « \b » raisonne en ASCII : il voit une limite de mot entre le « h » de
  //    « March » et le « é » de « Marchés », et amputait donc « Marchés
  //    financiers » en « és financiers ». D'où la sentinelle explicite, qui
  //    inclut les lettres accentuées.
  const FIN_MOT = '(?![A-Za-zÀ-ÿ])';
  t = t.replace(
    new RegExp(`[\\s\\-–—(,|]*\\b(?:rentr[ée]e\\s+(?:de\\s+)?)?(?:${MOIS})${FIN_MOT}\\s+20\\d\\d\\b[)\\s]*`, 'gi'),
    ' '
  );
  t = t.replace(new RegExp(`[\\s\\-–—(,|]*\\b(?:${MOIS})${FIN_MOT}\\s*[)]?\\s*$`, 'i'), ' ');

  // 5 bis) Niveau d'études : « - Master 1/2 », « (Bac+5) », « M2 ». C'est un
  //    critère de candidature, pas le nom du poste — et les sources l'écrivent
  //    chacune à leur façon, ce qui casse l'alignement de la liste. L'Oréal
  //    affichait « Sales Business Analyst & Development – Master ½ », la
  //    fraction venant de leur propre « 1/2 ».
  //    La sentinelle est un test de non-lettre, pas « \b » : « Master ½ » finit
  //    sur un caractère qui n'est pas un mot, et « \b » n'y voyait donc aucune
  //    limite — la mention restait dans le titre.
  t = t.replace(
    /[\s\-–—(,|]*\b(?:master\s*(?:½|[12]\s*\/\s*2|[12])|bac\s*\+\s*\d|m[12])(?![A-Za-zÀ-ÿ0-9])[)\s]*/gi,
    ' '
  );

  // 6) Rémunérations : « - 1700€/mois », « 1 700 € brut », « 2000 euros ».
  //    Le champ salaire existe déjà ; dans l'intitulé, c'est du bruit.
  t = t.replace(/[\s\-–—(,|]*\d[\d\s.,]*\s*(?:€|euros?)\s*(?:\/\s*mois|par mois|brut|net)?[)\s]*/gi, ' ');

  // 6 bis) Semestre ou promotion en fin de titre : « – S1 », « – H2 »,
  //    parfois suivi d'une année. C'est la période du stage, que l'onglet et
  //    la date disent déjà. Retiré AVANT le lieu : tant que le semestre ferme
  //    le titre, la ville n'est jamais en dernière position et échappe au
  //    nettoyage qui, lui, ne lit que le dernier segment.
  t = t.replace(/[\s\-–—(,|]*\b[sh][12]\b\s*\d{0,5}\s*[)]?\s*$/i, ' ');

  // 7) Durées résiduelles : « - 6 mois », « (12 mois) »
  t = t.replace(/[\s\-–—(,|]*\b\d{1,2}\s*mois\b[)\s]*/gi, ' ');

  // 8) Mentions de contrat restées en milieu ou fin de titre : la pastille de la
  //    carte le dit déjà (« Comptable en Alternance » -> « Comptable »). On ne
  //    touche PAS au VIE, qui n'est reconnaissable qu'à cet endroit.
  //    Garde-fou : on ne retire que si le titre garde du sens. « Stage Audit »
  //    doit rester « Audit », mais « Stage » tout court ne doit pas devenir vide,
  //    et « Stage en audit » ne doit pas donner « En audit ».
  //    L'apostrophe peut être typographique ("fin d’études") : sans les deux
  //    formes, seul le mot "stage" partait et le titre gardait « fin d’études
  //    Auditeur Financier ».
  const sansContrat = t
    .replace(
      //    « internship » d'abord, sinon l'alternative s'arrêterait sur
      //    « intern » et laisserait « ship » derrière elle. Et « intern » seul
      //    manquait à la liste : BNP publiait « Portfolio Manager (ABL)Intern ».
      //    La parenthèse fermante n'est pas ajoutée aux séparateurs — elle
      //    appartient au groupe précédent, et la manger donnerait « (ABL ».
      //    La limite de mot suffit à accrocher un « Intern » collé.
      /[\s\-–—(,|]*\b(?:en\s+)?(?:alternance|apprentissage|stage(?:\s+de\s+fin\s+d['’]?[ée]tudes?)?|stagiaire|internships?|interns?|cdi|cdd)\b[)\s]*/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    // Le séparateur laissé par le retrait peut être une barre oblique
    // ("Stage / Expertise Comptable") ou un guillemet français.
    .replace(/^[\s:\-–—,|\/«»]+/, '')
    .replace(/^(?:en|de|du|des|d['’]|pour|au|aux)\s+/i, '')
    .replace(/^fin\s+d['’]?[ée]tudes?\s+/i, '')
    .trim();
  if (sansContrat.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 4) t = sansContrat;

  // 9) Scories laissées par les retraits ci-dessus : une année orpheline
  //    ("Consultant - 2027") et les tournures d'annonce qui introduisaient une
  //    date qu'on vient d'enlever ("À partir de – Sales Analyst").
  t = t.replace(/[\s\-–—(,|]*\b20\d\d\b[)\s]*/g, ' ');
  //    Limite de mot obligatoire après l'alternance : sans elle, « d[èe]s »
  //    mordait dans le premier mot venu et « Design Authority IA » devenait
  //    « ign Authority IA ».
  t = t.replace(/^\s*(?:[àa]\s+partir\s+d[eu]|[àa]\s+compter\s+d[eu]|d[èe]s|pour)\b\s*[:\-–—,]*\s*/i, '');
  //    Le mois que cette tournure introduisait reste alors seul en tête
  //    ("Dès septembre - Analyste Crédit"). L'étape 5 ne l'avait pas vu : elle
  //    ne retire un mois que s'il est suivi d'une année ou placé en fin.
  //    Le séparateur est exigé : « January - Lazard... » est bien une date de
  //    promotion, « May Day Analyst » est un intitulé où le mot appartient au
  //    titre. Sans cette exigence, on amputait le second.
  t = t.replace(new RegExp(`^\\s*(?:${MOIS})${FIN_MOT}\\s*[:\\-–—,]+\\s*`, 'i'), '');

  // 10) Ponctuation résiduelle en bord, guillemets et barres obliques compris.
  t = t.replace(/\s+/g, ' ').replace(/^[\s:\-–—,|\/«»"]+|[\s:\-–—,|\/«»"]+$/g, '').trim();

  return t;
}

function normalize(item) {
  const { __src, raw } = item;
  let emp, title, ville, pays, url, typeContratRaw, romeLibelle, postedAt, sal, descr;

  if (__src === 'francetravail') {
    emp = raw.entreprise?.nom || 'Employeur non précisé';
    title = raw.intitule;
    ville = raw.lieuTravail_ville || (raw.lieuTravail?.libelle || '').replace(/\s*\(\d+\)$/, '');
    pays = 'France';
    // Les offres "partenaires" (origine 2) portent parfois l'URL du portail
    // de recrutement PROPRE à l'entreprise (ex : Generali via son sous-domaine
    // contactrh). On la préfère au lien candidat.francetravail.fr — mais jamais
    // quand le "partenaire" est un job board ou un tracker de multidiffusion
    // (Meteojob, Talentplug...) : là, mieux vaut la fiche France Travail.
    {
      const partenaires = raw.origineOffre?.partenaires || [];
      const direct = partenaires
        .map((p) => p.url)
        .find(
          (u) =>
            u &&
            /^https?:/.test(u) &&
            !INTERMEDIAIRE_RE.test(u) &&
            !/mytalentplug|talentplug|multiposting|broadbean|jobposting|smartrecruiters\.com\/redirect/i.test(u)
        );
      url = direct || raw.origineOffre?.urlOrigine;
    }
    // Un contrat d'apprentissage est un « CDD » pour l'API : son vrai visage
    // est dans natureContrat ("Contrat apprentissage", "Contrat de
    // professionnalisation"). Sans ce libellé, toutes les alternances France
    // Travail se classaient en CDI/CDD.
    typeContratRaw = [raw.natureContrat, raw.typeContrat].filter(Boolean).join(' ');
    romeLibelle = raw.romeLibelle;
    postedAt = raw.dateActualisation;
    sal = raw.salaire?.libelle;
    descr = raw.description;
  } else if (__src === 'vie') {
    // Business France (Mon VIE-VIA). Mode référencement : on NE reprend PAS la
    // description de la mission (raw.missionDescription) — seulement de quoi
    // identifier l'offre. Le clic renvoie sur la fiche officielle pour candidater.
    emp = raw.organizationName || 'Employeur non précisé';
    title = raw.missionTitle;
    // Le VIE est par nature à l'étranger : la ville sert d'info, pas de filtre.
    // La carte affiche déjà le pays à part (place) — on ne le remet donc PAS
    // dans la ville, sinon « Madrid, Espagne, Espagne ». On nettoie aussi le
    // libellé Business France, souvent en capitales avec des tirets parasites
    // (« MORRISTOWN -NJ- »).
    ville = (raw.cityName || '')
      .replace(/\s*-\s*[A-Z]{2,3}-?\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      // « MADRID » crié -> « Madrid » ; on laisse les vraies capitales composées.
      .replace(/^[A-ZÀ-Ö][A-ZÀ-Ö\s'-]+$/, (v) =>
        v.toLowerCase().replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_, s, c) => s + c.toUpperCase())
      );
    pays = raw.countryName
      ? raw.countryName.charAt(0) + raw.countryName.slice(1).toLowerCase()
      : 'International';
    url = `https://mon-vie-via.businessfrance.fr/offres/${raw.id}`;
    typeContratRaw = 'VIE';
    // Le classement famille se fait sur le seul intitulé (pas de description).
    romeLibelle = (raw.specializations || []).map((s) => s.label || s.name).filter(Boolean).join(' ');
    postedAt = raw.startBroadcastDate || raw.creationDate || new Date().toISOString();
    if (raw.indemnite) sal = `${Math.round(Number(raw.indemnite))} €/mois (indemnité VIE)`;
  } else if (__src === 'labonnealternance') {
    // Format API v1 (api.apprentissage.beta.gouv.fr) : l'offre est découpée en
    // blocs identifier / workplace / apply / contract / offer.
    emp = raw.workplace?.brand || raw.workplace?.legal_name || raw.workplace?.name || 'Employeur non précisé';
    title = raw.offer?.title;
    ville = raw.workplace?.location?.address?.split(',').pop()?.trim() || raw.workplace?.location?.city || '';
    pays = 'France';
    url = raw.apply?.url;
    typeContratRaw = [raw.contract?.type, 'alternance'].filter(Boolean).join(' ');
    romeLibelle = (raw.offer?.rome_codes || []).join(' ');
    descr = raw.offer?.description;
    postedAt = raw.offer?.publication?.creation || new Date().toISOString();
  } else if (__src.startsWith('greenhouse:')) {
    emp = item.emp;
    title = raw.title;
    ville = (raw.location?.name || '').split(',')[0];
    pays = /France|Paris|Lyon|Marseille/i.test(raw.location?.name || '') ? 'France' : (raw.location?.name || '').split(',').pop()?.trim();
    url = raw.absolute_url;
    typeContratRaw = raw.title; // pas de champ dédié -> fallback mots-clés du titre
    postedAt = raw.updated_at;
  } else if (__src.startsWith('lever:')) {
    emp = item.emp;
    title = raw.text;
    ville = raw.categories?.location?.split(',')[0];
    pays = 'France';
    url = raw.hostedUrl;
    typeContratRaw = raw.categories?.commitment;
    postedAt = new Date(raw.createdAt).toISOString();
  } else if (__src.startsWith('smartrecruiters:')) {
    emp = item.emp;
    title = raw.name;
    ville = raw.location?.city;
    pays = raw.location?.country === 'fr' ? 'France' : raw.location?.country;
    url = raw.applyUrl;
    typeContratRaw = raw.typeOfEmployment?.label;
    postedAt = raw.releasedDate;
    descr = raw.description; // rapatriée depuis la fiche : absente de la liste
  } else if (__src.startsWith('workday:')) {
    emp = item.emp;
    title = raw.title;
    ville = (raw.locationsText || '').split(',')[0].replace(/\s+area$/i, '').trim();
    pays = 'France'; // déjà filtré par FRANCE_LOCATION_RE côté connecteur
    url = raw.url;
    // Le contrat vient de bulletFields quand Workday le donne ; l'intitulé
    // reste en second rideau, car tous les tenants ne remplissent pas ce champ.
    typeContratRaw = [].concat(raw.bulletFields || []).join(' ') + ' ' + (raw.title || '');
    postedAt = parseWorkdayRelativeDate(raw.postedOn);
  } else if (__src.startsWith('opendatasoft:')) {
    emp = item.emp;
    title = raw.title;
    ville = raw.city;
    pays = 'France';
    // Préférer 'url' (la fiche d'annonce) à 'apply_url' (le formulaire de
    // candidature) : le brief §2 exige un lien vers l'ANNONCE, pas un formulaire.
    url = raw.url || raw.apply_url;
    typeContratRaw = raw.jobtype; // "CDI"/"CDD"/"Stage"/"Contrat en alternance"/"Contrat d'apprentissage"
    romeLibelle = raw.category;
    descr = raw.description;
    postedAt = parseFrenchDateTime(raw.lastmodifieddate);
  } else if (__src.startsWith('radancy:')) {
    // Le connecteur a déjà tiré le titre de og:title, la ville de l'adresse
    // et la date du corps de la fiche : il n'y a plus qu'à les reprendre.
    emp = item.emp;
    title = raw.title;
    ville = raw.ville;
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.title;
    postedAt = dateIso(raw.datePublication);
  } else if (__src.startsWith('talentview:')) {
    emp = item.emp;
    title = raw.titre;
    ville = raw.ville;
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.titre;
    postedAt = raw.date ? new Date(raw.date).toISOString() : null;
  } else if (__src.startsWith('talentlink:')) {
    // Le lieu n'est donné que dans l'intitulé, sous forme de liste de bureaux :
    // « (Paris / London) ». Le connecteur n'a retenu que celles qui nomment
    // Paris, on peut donc l'affirmer ici.
    emp = item.emp;
    title = raw.titre;
    ville = 'Paris';
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.titre;
    postedAt = raw.date ? new Date(raw.date).toISOString() : null;
  } else if (__src === 'lvmh') {
    // `requiredExperience` dit le niveau attendu en clair — « Débutant »,
    // « Minimum 5 ans », « Minimum 10 years ». On le passe au filtre 0-3 ans
    // comme une description : c'est le signal le plus net qu'une source nous
    // ait jamais donné sur la séniorité.
    emp = item.emp;
    title = raw.name;
    ville = raw.city || '';
    pays = 'France';
    url = raw.link;
    typeContratRaw = raw.contract || raw.name;
    romeLibelle = raw.functionFilter;
    descr = raw.requiredExperience || '';
    postedAt = raw.publicationTimestamp
      ? new Date(raw.publicationTimestamp * 1000).toISOString()
      : null;
  } else if (__src === 'axafr') {
    // Le site français d'AXA situe ses offres au département (« Savoie ») plutôt
    // qu'à la ville. C'est suffisant pour la carte, et le filtre des grandes
    // villes traite déjà les départements comme les régions.
    emp = item.emp;
    title = raw.JobTitle;
    ville = raw.PrimaryLocationL2 || '';
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.LocalContractType || raw.JobTitle;
    romeLibelle = raw.ReqTypeId;
    // Les qualifications d'abord : c'est là qu'est écrit le niveau attendu.
    descr = [raw.JobQualification, raw.JobDescription]
      .filter(Boolean)
      .join(' ')
      .replace(/<[^>]*>/g, ' ')
      .slice(0, 4000);
    {
      // « 2026-09-07 02:50 PM ». La substitution du premier espace par un « T »
      // visait à rendre la chaîne ISO ; elle produisait « 2026-09-07T02:50 PM »,
      // que Date refuse — « PM » ne peut pas suivre une heure ISO. Sept offres
      // perdaient leur date par excès de zèle. On tente la chaîne telle quelle
      // d'abord, la substitution ensuite seulement.
      const brut = String(raw.JobOpeningDate || '');
      let d = new Date(brut);
      if (isNaN(d)) d = new Date(brut.replace(' ', 'T'));
      postedAt = isNaN(d) ? null : d.toISOString();
    }
  } else if (__src.startsWith('cornerstone:')) {
    // Cornerstone date ses annonces au format français (« 01/09/2026 ») et
    // porte le descriptif complet, qui alimente le filtre 0-3 ans.
    emp = item.emp;
    title = raw.displayJobTitle;
    {
      const lieuFr = (raw.locations || []).find((l) => /^fr$/i.test(l.country || ''));
      ville = (lieuFr || (raw.locations || [])[0] || {}).city || '';
    }
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.displayJobTitle;
    descr = (raw.externalDescription || '').replace(/<[^>]*>/g, ' ').slice(0, 4000);
    {
      const m = String(raw.postingEffectiveDate || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      postedAt = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`).toISOString() : null;
    }
  } else if (__src.startsWith('recruitee:')) {
    emp = item.emp;
    title = raw.title;
    ville = raw.city;
    pays = 'France';
    url = raw.careers_url;
    typeContratRaw = raw.employment_type_code || raw.title;
    romeLibelle = raw.department;
    postedAt = raw.published_at || new Date().toISOString();
  } else if (__src.startsWith('oraclecloud:')) {
    emp = item.emp;
    title = raw.title;
    ville = (raw.location || '').split(',')[0].trim();
    pays = 'France'; // déjà filtré côté connecteur
    url = raw.url;
    typeContratRaw = raw.title; // pas de champ contrat dans la liste
    postedAt = raw.postedDate || new Date().toISOString();
  } else if (__src.startsWith('teamtailor:')) {
    emp = item.emp;
    title = raw.title;
    ville = raw.city || 'Non précisé';
    pays = 'France'; // déjà filtré sur addressCountry === 'FR' côté connecteur
    url = raw.url;
    typeContratRaw = raw.title;
    postedAt = raw.date_published || new Date().toISOString();
  } else if (__src.startsWith('ashby:')) {
    emp = item.emp;
    title = raw.title;
    ville = (raw.location || '').split(',')[0].trim();
    pays = 'France';
    url = raw.jobUrl || raw.applyUrl;
    typeContratRaw = raw.employmentType || raw.title;
    romeLibelle = [raw.department, raw.team].filter(Boolean).join(' ');
    descr = raw.descriptionPlain;
    postedAt = raw.publishedAt || new Date().toISOString();
  } else if (__src === 'adzuna') {
    emp = raw.company?.display_name || 'Employeur non précisé';
    title = raw.title;
    // "Paris, Paris, Île-de-France" -> on garde le segment le plus précis.
    ville = (raw.location?.area || []).slice(-1)[0] || raw.location?.display_name || '';
    pays = 'France';
    url = raw.redirect_url;
    typeContratRaw = [raw.contract_type, raw.contract_time, raw.title].filter(Boolean).join(' ');
    romeLibelle = raw.category?.label;
    descr = raw.description;
    postedAt = raw.created || new Date().toISOString();
    if (raw.salary_min && raw.salary_max) {
      sal = `${Math.round(raw.salary_min)}–${Math.round(raw.salary_max)} €/an`;
    }
  } else if (__src === 'servicepublic') {
    // Le portail de l'État donne le nom exact de l'institution : on le préfère
    // à notre étiquette interne ("Autorité des Marchés Financiers (AMF)").
    emp = raw.employeur || item.emp;
    title = raw.title;
    ville = raw.location || 'Non précisé';
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.title; // le portail ne donne pas le type sur la liste
    romeLibelle = raw.domaine;
    postedAt = raw.postedAt || new Date().toISOString();
  } else if (__src === 'avature') {
    emp = item.emp;
    title = raw.title;
    ville = raw.location || 'Non précisé';
    pays = 'France'; // le connecteur ne retient que les fiches "Pays : France"
    url = raw.url; // fiche sur le portail carrières de la maison
    // La fiche donne son type de contrat ET son niveau d'expérience
    // ("Moins de 3 ans") : les deux servent au classement et au filtre junior.
    typeContratRaw = [raw.contract, raw.title].filter(Boolean).join(' ');
    descr = raw.experience;
    // La fiche Avature ne porte aucune date — mais le sitemap dont elle est
    // issue en donne une par entrée, que le connecteur transmet désormais.
    // C'est une date de modification et non de publication : on ne prétend
    // pas l'inverse. Elle est propre à chaque annonce et vérifiable, là où
    // l'heure de collecte datait du jour même des annonces de 2023.
    postedAt = raw.date || null;
  } else if (__src.startsWith('eicards:')) {
    emp = item.emp;
    title = raw.title;
    // Certaines annonces listent des dizaines de communes : on garde la première.
    ville = (raw.ville || '').split(',')[0].trim();
    pays = 'France';
    url = raw.url; // fiche sur le site du groupe Crédit Mutuel
    typeContratRaw = [raw.contrat, raw.title].filter(Boolean).join(' ');
    postedAt = new Date().toISOString();
  } else if (__src.startsWith('sitemapld:')) {
    emp = item.emp;
    title = raw.titre;
    // Les titres JSON-LD de ces sites concatènent catégorie et lieu :
    // "Analyste ALM - Finance - Boulogne-Billancourt, Ile de France, France".
    // Quand le dernier segment est un lieu, on retire les deux derniers.
    {
      const parts = (title || '').split(/\s+-\s+/);
      if (parts.length >= 3 && /france|dom-tom|defense/i.test(parts[parts.length - 1])) {
        title = parts.slice(0, parts.length - 2).join(' - ');
      }
    }
    ville = raw.ville;
    pays = 'France'; // déjà filtré sur addressCountry côté connecteur
    url = raw.url; // la fiche sur le site officiel de la maison
    typeContratRaw = [raw.type, raw.titre].filter(Boolean).join(' ');
    descr = raw.description;
    postedAt = raw.datePosted || new Date().toISOString();
  } else if (__src === 'bofa') {
    emp = item.emp;
    title = raw.titre;
    ville = raw.ville;
    pays = 'France';
    url = raw.url;
    typeContratRaw = [raw.division, raw.titre].filter(Boolean).join(' ');
    romeLibelle = raw.division;
    postedAt = raw.date || null;
  } else if (__src.startsWith('eightfold:')) {
    emp = item.emp;
    title = raw.titre;
    ville = raw.ville;
    pays = 'France'; // filtré par ville et rayon côté connecteur
    url = raw.url;
    typeContratRaw = raw.titre;
    romeLibelle = raw.departement;
    postedAt = raw.date;
  } else if (__src === 'goldman') {
    // Les intitulés Goldman commencent par du contexte : « 2027 | EMEA | Paris |
    // Investment Banking, Classic | Seasonal ». On retire ces segments de tête
    // pour ne garder que le métier, que la division précise ensuite.
    emp = item.emp;
    title = String(raw.titre || '')
      .split('|')
      .map((x) => x.trim())
      .filter((x) => x && !/^20dd$|^emea$|^paris$|^amer$|^apac$/i.test(x))
      .join(' - ');
    ville = raw.ville;
    pays = 'France';
    url = raw.url;
    typeContratRaw = [raw.type, raw.titre].filter(Boolean).join(' ');
    romeLibelle = raw.division;
    postedAt = raw.date || null;
  } else if (__src.startsWith('yello:')) {
    // Carte d'un job board Yello : seuls l'intitulé et le lien sont exposés.
    emp = item.emp;
    title = raw.titre;
    ville = '';
    pays = 'France'; // filtré par l'identifiant pays du tableau
    url = raw.url;
    typeContratRaw = raw.titre;
    // La carte porte « 25 août », ou « NOUVEAU » quand l'annonce vient de
    // paraître. Le second ne nomme aucun jour : on ne l'invente pas, l'offre
    // reste sans date et le site l'annonce comme telle.
    postedAt = dateFrancaiseSansAnnee(raw.date);
  } else if (__src === 'mckinsey') {
    // Une annonce ouverte dans des dizaines de villes n'est pas une offre
    // parisienne : c'est un entonnoir de candidature permanent, que McKinsey
    // laisse dans son flux longtemps après l'avoir fermé sur son site. Leur
    // « Associate » couvrait 113 villes, datait de 2023, et son lien affichait
    // « This position is no longer available » — exactement la promesse que JJ
    // ne doit jamais casser. Au-delà de cinq villes, on ne publie pas.
    if ((raw.nbVilles || 0) > 5) return null;
    emp = item.emp;
    title = raw.titre;
    ville = 'Paris';
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.titre;
    romeLibelle = raw.interet;
    descr = raw.description;
    // Le flux donne bien une date. La renseigner fait entrer McKinsey dans le
    // filtre d'âge commun, qui écarte alors de lui-même les annonces de 2016 et
    // 2019 encore présentes dans leur catalogue.
    postedAt = raw.date ? new Date(`${raw.date}T00:00:00Z`).toISOString() : null;
  } else if (__src.startsWith('bpce:')) {
    // API JSON du groupe : l'enseigne qui recrute (Natixis CIB France, Natixis
    // IM...) prime sur le nom du groupe, comme pour les entités du Crédit
    // Agricole. La date est donnée au format ISO court.
    emp = item.emp;
    title = raw.titre;
    ville = (raw.lieu || '').split(/[,\-–(]/)[0].trim();
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.type;
    descr = (raw.description || '').replace(/<[^>]*>/g, ' ').slice(0, 3000);
    postedAt = raw.date ? new Date(`${raw.date}T00:00:00Z`).toISOString() : null;
  } else if (__src.startsWith('liste:')) {
    // Carte d'une liste HTML officielle : type de contrat, intitulé et lieu
    // France ». La liste ne porte aucune date de publication — on le dit
    // franchement plutôt que d'afficher la date de collecte comme si c'était
    // celle de l'annonce (datePubFiable reste à false, cf. writeOutput).
    // Quand la carte nomme l'entité qui recrute (LCL, CACIB, Amundi...), c'est
    // elle qu'on affiche : un stage M&A chez Crédit Agricole CIB n'est pas un
    // poste en caisse régionale, et le type d'entreprise en dépend.
    emp = raw.entite || item.emp;
    title = raw.titre;
    // « Reims - France » ou « Paris, Ile-de-France, France » -> la ville seule.
    // « Reims - France », « Paris, Ile-de-France, France » -> la ville seule.
    // Attention au tiret : celui de « Saint-Quentin-en-Yvelines » n'en est
    // pas un. Voir villeDeLaListe.
    ville = villeDeLaListe(raw.lieu);
    pays = 'France'; // déjà filtré côté connecteur
    url = raw.url;
    typeContratRaw = raw.type;
    // « Mis à jour le 31/08/2026 » -> date réelle quand la source la donne.
    {
      // Deux formats selon la maison : « 31/08/2026 » chez EDF, et l'ISO
      // « 2026-09-01 » que La Banque Postale écrit dans l'attribut datetime de
      // ses cartes. Ne connaître que le premier faisait tomber le second dans
      // le vide, sans erreur.
      const iso = (raw.date || '').match(/(\d{4})-(\d{2})-(\d{2})/);
      const m = iso || (raw.date || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      postedAt = !m
        ? null
        : iso
          ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).toISOString()
          : new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`).toISOString();
    }
  } else if (__src.startsWith('wordpress:')) {
    // WordPress REST : la réponse JSON porte tout, y compris le texte.
    emp = raw.entite || item.emp;
    title = raw.titre;
    ville = villeDeLaListe(raw.lieu);
    pays = 'France'; // déjà filtré côté connecteur
    url = raw.url;
    typeContratRaw = raw.type;
    descr = String(raw.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 4000);
    // « 2026-09-01 » ou « 2026-09-01T12:21:44 » : les deux sont acceptés.
    postedAt = raw.date ? dateIso(raw.date) : null;
  } else if (__src.startsWith('successfactors:')) {
    emp = item.emp;
    title = raw.title;
    // Lieu au format "Paris La Défense, FR, 92037" -> on garde la ville.
    ville = (raw.lieu || '').split(',')[0].trim();
    pays = 'France'; // déjà filtré sur le code pays FR côté connecteur
    url = raw.url;
    typeContratRaw = raw.title;
    postedAt = new Date().toISOString();
  } else if (__src.startsWith('talentsoft:')) {
    emp = item.emp;
    title = raw.title;
    ville = raw.ville;
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.contrat;
    romeLibelle = raw.entite;
    postedAt = new Date().toISOString(); // la liste ne porte pas de date
  } else if (__src.startsWith('phenom:')) {
    emp = item.emp;
    // Les deux générations de l'API ne nomment pas les champs pareil :
    // la première dit title/city/apply_url, la seconde name/location/id.
    title = raw.title || raw.name;
    ville = raw.city
      ? // Format AXA : "75-PARIS" -> on retire le code département en préfixe.
        raw.city.replace(/^\d{2,3}\s*-\s*/, '').trim()
      : // Format v2 : "PARIS, Paris, France" -> la ville seule.
        (raw.location || '').split(',')[0].trim();
    pays = 'France';
    // L'annonce d'abord, le formulaire en dernier recours : « apply_url »
    // était lu en premier, si bien que le clic tombait sur une demande de
    // connexion au lieu du texte du poste. C'est la règle du projet, déjà
    // appliquée aux autres connecteurs.
    url =
      raw.__urlFiche ||
      raw.meta_data?.canonical_url ||
      raw.jobUrl ||
      raw.apply_url ||
      raw.applyUrl ||
      (raw.id ? `https://portal.careers.hsbc.com/job/${raw.id}` : null);
    // « tags2 » porte le contrat — « Stage / Alternance / Étudiant en
    // entreprise », « Apprenticeship », « Internship / Placement ». Sans lui,
    // vingt et une offres juniors d'AXA partaient en CDI.
    typeContratRaw = [].concat(raw.tags2 || [], raw.tags1 || []).join(' ') + ' ' + (title || '');
    // Les trois générations de l'API ne s'accordent pas sur la forme : tableau
    // chez la première, chaîne chez la troisième. On aplatit sans supposer.
    romeLibelle = []
      .concat(raw.categories || [], raw.category || [], raw.business_unit || [], raw.department || [])
      .filter(Boolean)
      .join(' ');
    // Les trois générations ne nomment pas la date pareil : « posted_date »
    // chez la première (AXA), « postedDate » et « dateCreated » chez la
    // génération widgets (Allianz, BCG). Ne chercher que les premiers noms
    // faisait tomber Allianz sur le repli à l'heure courante — et comme
    // phenom est une source réputée datée, cette date inventée passait pour
    // fiable et plaçait neuf offres de 2025 en tête de trois onglets.
    //
    // Aucun repli sur l'heure du passage : une date qu'on n'a pas reste
    // nulle. completerDatesManquantes ira la lire sur la fiche, et à défaut
    // l'offre passe en fin de liste, sans prétendre à une fraîcheur qu'elle
    // n'a pas.
    postedAt =
      raw.posted_date ||
      raw.postedDate ||
      (raw.t_create ? new Date(raw.t_create).toISOString() : null) ||
      raw.dateCreated ||
      null;
  } else if (__src === 'manuel') {
    emp = item.emp;
    title = raw.title;
    ville = raw.loc;
    pays = 'France';
    url = raw.url;
    typeContratRaw = raw.typeContrat;
    romeLibelle = raw.category;
    postedAt = raw.addedOn ? new Date(raw.addedOn).toISOString() : new Date().toISOString();
  } else {
    return null; // source inconnue -> ignorée
  }

  // L'intitulé brut est conservé : le nettoyage lui retire les mentions de
  // contrat (« Alternance », « Stage »), qui sont pourtant le seul indice de
  // l'onglet quand la source n'annonce pas le type. Les alternances de
  // Rothschild, dont le mot ne figure que dans l'adresse, se retrouvaient
  // rangées en CDI.
  const titreBrut = title;
  title = adoucirMajuscules(cleanTitle(title));

  // --- Le lieu et le contrat n'ont rien à faire dans l'intitulé ------------
  // Les sources collent très souvent la ville au titre (« Audit Banque
  // Assurance - Paris », « Consultant(e) en data - Paris 1 ») et, pour le VIE,
  // le type de contrat en plus (« VIE Prague - Compliance Officer », « V.I.E.
  // - Analyste opérations et processus junior - Luxembourg »). La carte porte
  // déjà une pastille de contrat et une pastille de lieu : répétés dans le
  // titre, ils désalignent toute la liste et noient le seul élément qui
  // distingue une offre d'une autre — le métier.
  //
  // Et quand la source n'a pas donné de ville, on récupère celle du titre au
  // lieu d'afficher « Non précisé » à côté d'un intitulé qui, lui, la nomme.
  {
    const cle = (s) =>
      decodeEntities(String(s || ''))
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
    const villeConnue = cle(ville);
    const paysConnu = cle(pays);

    // Un segment est un lieu s'il correspond à ce que la source nous a déjà
    // dit (ville ou pays de la mission), ou si c'est une grande ville
    // française — éventuellement suivie de son arrondissement (« Paris 1 »).
    const estUnLieu = (mot) => {
      const brut = mot.trim();
      const k = cle(brut);
      if (k.length < 3) return false;
      if (villeConnue && k === villeConnue) return true;
      if (paysConnu && paysConnu !== 'france' && k === paysConnu) return true;
      return estGrandeVille(brut.replace(/\s*\d{1,2}\s*$/, '').trim().toLowerCase());
    };

    const villeDuTitre = (v) => {
      if (!ville || /^non pr[ée]cis[ée]$|^france$/i.test(String(ville).trim())) ville = v;
    };
    // On ne tronque jamais jusqu'à rendre l'intitulé inintelligible.
    const resteLisible = (s) => s.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 5;

    // 1) Préfixe « VIE » / « V.I.E. », seul ou suivi de la destination.
    //    Pas de \b après le sigle : sur « V.I.E. - Analyste », il forçait un
    //    retour arrière qui laissait le point final orphelin (« . - Analyste »).
    //    Et pas de drapeau insensible à la casse sur la forme sans points, pour
    //    ne pas amputer un titre commençant par « Vie » (assurance vie).
    const pre = title.match(/^(?:V\.\s*I\.\s*E\.?|VIE)[\s.:,\/–—-]+(?:([A-ZÀ-Ö][A-Za-zÀ-ÿ'’-]{2,20})\s*[–—-]\s*)?/);
    if (pre) {
      const reste = title.slice(pre[0].length).trim();
      if (resteLisible(reste)) {
        if (pre[1] && estUnLieu(pre[1])) villeDuTitre(pre[1].trim());
        // « VIE Compliance Officer » : pas un lieu, le mot appartient au titre.
        title = pre[1] && !estUnLieu(pre[1]) ? `${pre[1]} ${reste}`.trim() : reste;
      }
    }

    // 2) Lieu en fin d'intitulé, éventuellement répété (« ... - Paris, France »)
    //    ou donné en liste quand le poste est ouvert sur plusieurs bureaux
    //    (« Auditeur financier -Annecy / Chambéry »).
    //
    //    Une seule ville reconnue suffit à identifier le bloc comme un lieu :
    //    Annecy nous est donné par la source, Chambéry ne figure dans aucune
    //    liste. Exiger de reconnaître les deux laisserait le bloc entier dans
    //    le titre. On demande donc qu'une ville au moins soit certaine, et que
    //    les autres aient la forme d'un nom de lieu — un ou deux mots
    //    capitalisés — pour ne pas emporter la fin d'un vrai intitulé.
    const formeDeLieu = (s) => /^[A-ZÀ-Ö][A-Za-zÀ-ÿ'’-]{1,19}(?:[\s-][A-ZÀ-Ö]?[A-Za-zÀ-ÿ'’-]{1,19}){0,2}$/.test(s.trim());

    //    On part du séparateur le plus à DROITE. Un intitulé en contient
    //    souvent plusieurs — « Consultant - Financial Services - Nantes » — et
    //    lire à partir du premier ferait prendre « Financial Services - Nantes »
    //    pour un seul bloc, qui ne ressemble à aucune ville : la ville restait
    //    alors dans le titre.
    for (let i = 0; i < 2; i++) {
      const coupures = [];
      const sep = /[\s,]*[-–—|,]\s+|\s+[-–—|]\s*/g;
      let s;
      while ((s = sep.exec(title))) coupures.push({ debut: s.index, fin: s.index + s[0].length });

      let retire = false;
      for (let k = coupures.length - 1; k >= 0 && !retire; k--) {
        const queue = title.slice(coupures[k].fin).trim();
        if (!queue) continue;
        const morceaux = queue
          .split(/\s*[\/&]\s*/)
          .map((x) => x.replace(/\s*\d{1,2}\s*$/, '').trim())
          .filter(Boolean);
        if (!morceaux.length || !morceaux.some(estUnLieu) || !morceaux.every(formeDeLieu)) continue;
        const reste = title.slice(0, coupures[k].debut).trim();
        if (!resteLisible(reste)) continue;
        title = reste;
        villeDuTitre(morceaux[0]);
        retire = true;
      }
      if (!retire) break;
    }
  }
  if (!title || !url) return null;
  if (!estUneOffreFinance(title)) return null;

  // Garde-fou central : JJ promet un lien vers l'annonce de la MAISON (§2 du
  // brief). Un lien vers un job board intermédiaire (JobTeaser, Welcome to the
  // Jungle, Wizbii, Indeed...) oblige le candidat à passer par un tiers, souvent
  // derrière un compte — exactement ce qu'on reproche aux concurrents. On les
  // écarte quelle que soit la source, y compris les ajouts manuels.
  if (INTERMEDIAIRE_RE.test(url)) return null;

  // Retrait demandé par la maison : contrôlé ici, avant tout classement, pour
  // qu'aucune offre ne puisse ressortir par un autre chemin.
  if (estExclue(url, emp)) return null;

  const volet = classifyVolet({ src: __src, typeContratRaw, title: titreBrut, url });
  const contrat =
    volet === 'cdi-cdd' ? classifyContrat({ typeContratRaw, title: titreBrut, descr, url }) : null;

  // Le VIE ne vient que de Business France. C'est le registre officiel du
  // dispositif : l'indemnité, la durée, le pays et le statut y sont normés, et
  // c'est de toute façon par ce portail que le candidat dépose sa candidature.
  // Une maison qui annonce un VIE sur son seul ATS sans l'y déposer donne une
  // fiche invérifiable — souvent sans ville ni indemnité, comme les deux
  // « VIE » d'Amundi qui n'existent nulle part chez Business France.
  if (volet === 'vie' && __src !== 'vie') return null;
  const famille = inferFamille(title, romeLibelle, emp);
  if (famille === FAMILLE_HORS_PERIMETRE) return null; // réseau / vente : hors périmètre
  // Le résidu n'est pas un fourre-tout. Une offre qu'aucune règle de famille
  // ne sait ranger n'entre que si son intitulé dit explicitement la finance.
  // Sans ce contrôle, tout ce qui n'était pas nommément exclu se retrouvait
  // publié : le résidu avait atteint 26,7 % du catalogue, peuplé d'ajusteurs
  // composite, de chaudronniers aéronautiques et d'ergothérapeutes.
  // On donne aussi l'intitulé BRUT : le nettoyage retire « Stage » et
  // « Stagiaire », or c'est souvent le seul mot qui situe le poste chez une
  // maison de finance.
  if (famille === 'Autres métiers de la finance' && !isFinanceOfferFor(emp, title, titreBrut)) return null;
  emp = normaliserEmployeur(emp);
  if (EMPLOYEUR_ECOLE_RE.test(emp)) return null; // école/CFA : pas l'employeur réel
  const maisonRef = trouverMaison(emp);

  // JJ ne publie que les maisons de sa liste de référence : banques, sociétés
  // de gestion, cabinets, assureurs, institutions et grands groupes. Un
  // employeur qu'on ne reconnaît pas est, dans l'immense majorité des cas, une
  // petite structure dont l'offre n'intéresse pas le public visé — et rien ne
  // permet de la vérifier. Mieux vaut un catalogue plus court dont chaque ligne
  // se tient qu'un catalogue plus long où il faut trier soi-même.
  //
  // Le VIE échappe à cette règle, et c'est délibéré : Business France référence
  // surtout des entreprises exportatrices de taille moyenne, parfaitement
  // légitimes, qu'aucune liste de maisons de finance ne contiendra jamais.
  // Appliquer la règle à cet onglet le viderait des neuf dixièmes de son
  // contenu sans rien gagner en qualité.
  if (!maisonRef && volet !== 'vie') return null;

  const sector = inferSector(emp, maisonRef, title, famille);

  // Vente et développement commercial : la distinction tient à la MAISON, pas
  // à l'intitulé. Chez un gérant d'actifs, une banque ou un dépositaire, un
  // poste de « Sales » porte sur des produits financiers — c'est un vrai métier
  // de la finance, et l'un des mieux payés (le « Sales Front Office Securities
  // Finance » de Caceis a toute sa place ici). Dans une entreprise industrielle
  // ou de grande consommation, le même mot désigne la vente de son catalogue :
  // le « Sales Business Analyst & Development » de L'Oréal n'a rien d'un poste
  // financier, il est seulement rattaché à une direction qui l'est.
  if (sector === 'Entreprise (direction financière)' && VENTE_HORS_FINANCE_RE.test(title)) return null;

  // Dernier contrôle, une fois l'employeur normalisé : le titre doit nommer un
  // métier. C'est ici, et pas plus haut, parce que le nettoyage a pu vider un
  // intitulé qui semblait fourni au départ (« Internship - Andera Infra »).
  if (!titreNommeUnMetier(title, emp)) return null;

  return {
    emp,
    title,
    sector,
    famille,
    volet,
    // « CDI » ou « CDD » quand on a pu le déterminer, absent sinon : la page
    // retombe alors sur la mention générale de l'onglet.
    contrat: contrat || undefined,
    loc: nettoyerLieu(decodeEntities(ville || '').trim()) || 'Non précisé',
    // Zone d'affichage (calculée ici pour que la page n'ait pas à reconnaître
    // 300 orthographes de villes en JavaScript).
    // Le filtre « Lieu » raisonne en géographie française. Pour le VIE, qui est
    // par nature à l'étranger, cette grille n'a aucun sens : Madrid et Tokyo s'y
    // rangeaient sous « Autres villes ». C'est le PAYS qui sert de repère —
    // c'est d'ailleurs le premier critère de choix d'un VIE.
    zone:
      volet === 'vie' && pays && !/^france$/i.test(pays)
        ? pays
        : inferZone(decodeEntities(ville || '').trim()),
    // Maison de rattachement pour le filtre "Entreprise". "Caisse d'Épargne
    // Île-de-France" garde son nom sur la carte — le candidat postule bien là —
    // mais se range sous "BPCE". Les employeurs hors liste se regroupent sous
    // MAISON_AUTRES plutôt que d'occuper une ligne chacun.
    maison: maisonRef || MAISON_AUTRES,
    maisonReference: Boolean(maisonRef),
    place: pays || 'France',
    sal: sal || undefined,
    url,
    source: __src,
    _descr: descr,
    // Normalisée dès ici, et non à la seule écriture : les filtres d’âge lisent
    // ce champ, et « 09/01/2026 » leur paraissait tout frais — JavaScript le lit
    // à l’américaine, soit le 1er septembre au lieu du 9 janvier.
    _postedAt: dateIso(postedAt) || new Date().toISOString(),
    // La source a-t-elle VRAIMENT daté cette offre ? Le drapeau de fiabilité se
    // calculait sur le seul nom de la source, si bien qu'une source réputée
    // fiable mais muette sur une offre précise lui faisait afficher la date de
    // collecte comme date de publication. Une offre McKinsey sans date se
    // présentait ainsi « Publiée aujourd'hui » — une date inventée.
    // Une date que le pipeline n’a pas su lire ne compte pas comme une date :
    // sinon l’offre serait publiée avec l’heure de collecte présentée comme sa
    // date de parution, ce qui est précisément le mensonge qu’on évite.
    _dateDeLaSource: Boolean(dateIso(postedAt)),
    // Avature ne donne que le « lastmod » de son sitemap : une date de
    // MODIFICATION, la seule que ces portails exposent. Elle est réelle et
    // propre à l'annonce, mais la carte écrira « Mise à jour », pas « Publiée ».
    // La récupération sur fiche peut lever ce drapeau si elle trouve mieux.
    _dateEstMiseAJour: __src === 'avature',
  };
}

// ---------------------------------------------------------------------------
// Déduplication (PROJET.md §8.5)
// Clé canonique = entreprise + intitulé nettoyé + lieu. Priorité de "source de
// vérité" : ATS direct de la boîte > France Travail > La Bonne Alternance.
// ---------------------------------------------------------------------------
function slug(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Retire le bruit courant des intitulés pour rapprocher les variantes (H/F, F/H, CDI...).
function slugTitleFuzzy(title) {
  return slug(title)
    .replace(/\bh f\b|\bf h\b|\bh\/f\b|\bcdi\b|\bcdd\b|\bstage\b|\balternance\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Les sources écrivent le même lieu de trois façons — "38 - Grenoble",
// "Grenoble", "MONTPELLIER", "69 - Lyon 3e Arrondissement". Sans aplatissement,
// la clé canonique les distingue et la même offre s'affiche deux fois.
function slugLieu(loc) {
  return slug(
    (loc || '')
      .replace(/^\s*\d{2,3}\s*[-–]\s*/, '')          // "38 - Grenoble" -> "Grenoble"
      .replace(/\s+\d+\s*e(r|me)?\s+arrondissement/i, '') // "Lyon 3e Arrondissement" -> "Lyon"
      .replace(/\s*\(\w+\)\s*$/, '')                // "Courbevoie(pld)" -> "Courbevoie"
  );
}

// Les sources suffixent le nom de l'employeur de façon incohérente : "Chanel"
// et "Chanel Fr", "KPMG France" et "Kpmg France", "Marriott" et "Marriott
// Hotels Resorts". Deux clés pour la même maison = un doublon qui survit. On
// retire ce suffixe de pays pour le RAPPROCHEMENT uniquement — le nom affiché,
// lui, n'est jamais modifié. On ne touche pas aux suffixes qui désignent une
// entité réellement distincte ("Crédit Agricole CIB" n'est pas "Crédit Agricole").
function slugEmp(emp) {
  return slug(emp).replace(/\s+(?:fr|france)$/, '').trim();
}

// Une offre en télétravail COMPLET n'a pas de lieu de travail : la ville n'est
// qu'une étiquette de diffusion. Pennylane publiait ainsi le même « Spécialiste
// Support Pilotage et Comptabilité (Télétravail complet possible) » à Metz,
// Nancy, Mulhouse, Strasbourg, Reims et Troyes — six cartes identiques.
//
// Le télétravail PARTIEL ne compte pas : « 2 jours de télétravail » suppose un
// bureau, donc une ville, donc un poste distinct.
const TELETRAVAIL_COMPLET_RE =
  /t[ée]l[ée]travail (?:complet|total|int[ée]gral|100\s*%)|100\s*% (?:t[ée]l[ée]travail|remote)|full[\s-]?remote|fully remote|remote only/i;

function canonicalKey(offer) {
  const aDistance = TELETRAVAIL_COMPLET_RE.test(offer.title || '');
  const lieu = aDistance ? 'a-distance' : slugLieu(offer.loc);
  return `${slugEmp(offer.emp)}|${slugTitleFuzzy(offer.title)}|${lieu}`;
}

// Clé sans le lieu : sert au rattrapage des offres dont une source donne la ville
// et l'autre pas. Un même poste chez une même maison publié deux fois, une fois
// localisé et une fois "Non précisé", est la même offre.
function cleSansLieu(offer) {
  return `${slugEmp(offer.emp)}|${slugTitleFuzzy(offer.title)}`;
}

// Retire les offres sans lieu quand la même offre existe ailleurs avec un lieu.
// On garde toujours la version la plus informative pour le candidat.
// Un lieu est "vague" quand il ne désigne aucun lieu de travail précis :
// "France", "Non précisé", une région ou un département seul. Les agrégateurs
// publient volontiers la même offre avec un lieu vague là où la source directe
// donne la ville — "Groupe Samse / Isère" contre "Groupe Samse / Grenoble",
// "Chanel / France" contre "Chanel Fr / Paris". Deux clés, donc un doublon qui
// passait au travers.
function lieuEstVague(loc) {
  const v = (loc || '').trim().toLowerCase();
  if (!v || /^non précisé$|^france$/.test(v)) return true;
  // Une vraie ville n'est jamais vague, même quand elle porte aussi le nom d'un
  // département : Paris, Lyon, Marseille, Nice et Lille sont dans les deux
  // listes. Sans cette garde, « Paris » était jugé imprécis — deux annonces
  // identiques, l'une à Paris et l'autre sans lieu, se retrouvaient toutes deux
  // « vagues » et aucune n'était retirée. Les doublons survivaient.
  if (estGrandeVille(v) && !REGIONS_ET_INCONNU.some((r) => v === r)) {
    const estDepartementSeul =
      DEPARTEMENTS.some((d) => v === d) && ![...GRAND_PARIS, ...GRANDES_VILLES].some((ville) => contientVille(v, ville)) && !PARIS_RE.test(v);
    if (!estDepartementSeul) return false;
  }
  if (REGIONS_ET_INCONNU.some((r) => v === r || v.startsWith(r + ','))) return true;
  if (DEPARTEMENTS.some((d) => v === d || v.startsWith(d + ','))) return true;
  return false;
}

// Retire la version vague d'une offre quand la même existe avec une vraie ville.
// Deux VILLES différentes restent deux postes distincts (un stage à Lyon et un
// à Strasbourg chez Deloitte sont bien deux offres) : on ne fusionne jamais ça.
function retirerSansLieuRedondantes(offers) {
  const localisees = new Set();
  for (const o of offers) {
    if (!lieuEstVague(o.loc)) localisees.add(cleSansLieu(o));
  }
  return offers.filter((o) => !(lieuEstVague(o.loc) && localisees.has(cleSansLieu(o))));
}

const SOURCE_PRIORITY = (src) => {
  if (src === 'manuel') return 4; // vérifié à la main par un humain -> priorité maximale
  if (
    src.startsWith('greenhouse:') ||
    src.startsWith('lever:') ||
    src.startsWith('smartrecruiters:') ||
    src.startsWith('workday:') ||
    src.startsWith('opendatasoft:') ||
    src.startsWith('recruitee:') ||
    src.startsWith('oraclecloud:') ||
    src.startsWith('teamtailor:') ||
    src.startsWith('ashby:') ||
    src.startsWith('phenom:') ||
    src.startsWith('sitemapld:') || // fiche lue sur le site officiel = source de vérité
    src.startsWith('liste:') || // liste officielle de la maison = fiche employeur
    src.startsWith('bpce:') || // API officielle du groupe
    src === 'mckinsey' ||
    src.startsWith('yello:') ||
    src === 'goldman' ||
    src.startsWith('eightfold:') ||
    src === 'bofa'
  )
    return 3;
  // France Travail : source officielle, lien vers l'annonce d'origine.
  if (src === 'francetravail') return 2;
  if (src === 'labonnealternance') return 1;
  // Adzuna : agrégateur. En dernier recours — quand la même offre existe via
  // l'ATS de l'entreprise, on préfère toujours le lien direct de la maison.
  if (src === 'adzuna') return 0.5;
  return 0;
};

function dedupe(offers) {
  const byKey = new Map();
  for (const offer of offers) {
    const key = canonicalKey(offer);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...offer, _key: key, alsoOn: [] });
      continue;
    }
    // Garde la source de vérité (priorité la plus haute), note l'autre dans alsoOn.
    if (SOURCE_PRIORITY(offer.source) > SOURCE_PRIORITY(existing.source)) {
      existing.alsoOn.push(existing.source);
      Object.assign(existing, offer, { alsoOn: existing.alsoOn });
    } else if (!existing.alsoOn.includes(offer.source)) {
      existing.alsoOn.push(offer.source);
    }
  }
  return [...byKey.values()].map((o) => (o.alsoOn.length ? o : { ...o, alsoOn: undefined }));
}

// ---------------------------------------------------------------------------
// Vérification de lien (optionnelle, --check-links) — PROJET.md §8.6
// ---------------------------------------------------------------------------
// Le délai maximum n'est pas un détail : cette fonction tourne désormais dans
// le passage automatique, pour les offres saisies à la main. Sans lui, un
// serveur muet suspendrait le pipeline jusqu'à ce que GitHub le tue.
async function checkLink(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404 || res.status === 410) return 'dead';
    return 'ok';
  } catch {
    // Délai dépassé ou erreur réseau : on ne conclut pas. Le silence d'un
    // serveur ne prouve pas que l'offre est pourvue, et « unknown » est la
    // seule valeur qui n'entraîne aucun retrait.
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// État persistant entre passages (fraîcheur + détection des offres mortes)
// ---------------------------------------------------------------------------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// Compté pendant la vérification des liens, rapporté à la fin du passage :
// les deux se passent dans des fonctions différentes.
let mortesManuelles = 0;

async function applyFreshnessAndDeadRemoval(offers) {
  const now = new Date().toISOString();
  const prevState = loadState();
  const nextState = {};
  const result = [];

  const seenKeys = new Set(offers.map((o) => o._key));

  // Les offres saisies à la main sont vérifiées à CHAQUE passage, sans avoir
  // à demander --check-links : n'étant portées par aucune API, rien d'autre
  // ne peut nous dire que le poste est pourvu. Elles sont assez peu
  // nombreuses pour que le coût soit sans effet sur la durée du passage.
  mortesManuelles = 0;
  for (const offer of offers) {
    const prev = prevState[offer._key];
    const manuelle = String(offer.source || '').startsWith('manuel');
    let linkStatus = 'unknown';
    if (CHECK_LINKS || manuelle) linkStatus = await checkLink(offer.url);

    if (linkStatus === 'dead') {
      // Lien mort constaté directement -> retrait immédiat, pas d'entrée conservée.
      if (manuelle) mortesManuelles++;
      continue;
    }

    const firstSeenAt = prev?.firstSeenAt || now;
    nextState[offer._key] = { firstSeenAt, lastSeenAt: now, linkStatus };

    result.push({
      ...offer,
      _firstSeenAt: firstSeenAt,
      _lastSeenAt: now,
      _linkStatus: linkStatus,
    });
  }

  // Offres connues mais absentes de cette collecte : on regarde depuis QUAND on
  // ne les a plus vues, et non combien de passages ont eu lieu entre-temps. La
  // marge évite de retirer une offre bien vivante parce qu'une source a eu un
  // matin difficile.
  let retirees = 0;
  let enSursis = 0;
  const limite = Date.now() - MAX_JOURS_ABSENCE * 86400000;
  for (const [key, prev] of Object.entries(prevState)) {
    if (seenKeys.has(key)) continue;
    const vueLe = new Date(prev.lastSeenAt || prev.firstSeenAt || 0).getTime();
    if (vueLe && vueLe < limite) { retirees++; continue; } // pourvue ou expirée
    enSursis++;
    // On garde la trace, pas l'offre : son contenu n'est plus connu, et la
    // réinjecter reviendrait à publier une annonce qu'on ne voit plus.
    nextState[key] = { ...prev };
  }

  saveState(nextState);
  const nouvelles = result.filter((o) => o._firstSeenAt === now).length;
  console.log(
    `[pipeline] ${nouvelles} nouvelles offres ce matin, ${retirees} retirées définitivement ` +
      `(plus revues depuis ${MAX_JOURS_ABSENCE} jours : pourvues ou expirées), ${enSursis} en sursis.`
  );
  return result;
}

// ---------------------------------------------------------------------------
// Écriture de offres.js (window.__OFFRES__)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// « Pépites JJ » — les offres qui sortent du lot
//
// Ce ne sont PAS les plus récentes, mais les plus convoitées : une grande
// maison prestigieuse ET/OU un poste rare (M&A, front office, private equity),
// de préférence accessible à un junior (stage, alternance, VIE). L'idée est
// qu'un étudiant tombe d'emblée sur « la » belle opportunité qu'il n'aurait
// pas cherchée.
// ---------------------------------------------------------------------------

// Maisons dont le seul nom fait rêver un étudiant en finance.
const MAISONS_PRESTIGE = new Set([
  'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Bank of America', 'Citi',
  'Barclays', 'Deutsche Bank', 'UBS', 'BNP Paribas CIB', 'Société Générale CIB',
  'Rothschild & Co', 'Lazard', 'Messier & Associés', 'Centerview Partners',
  'Perella Weinberg', 'Edmond de Rothschild', 'Ardian', 'Eurazeo', 'PAI Partners',
  'Tikehau', 'Antin Infrastructure', 'Astorg', 'Sagard', 'Bpifrance',
  'McKinsey', 'BCG', 'Bain', 'Oliver Wyman', 'Amundi', 'Carmignac',
  'LVMH', "L'Oréal", 'Kering', 'Hermès', 'Chanel', 'TotalEnergies',
  'Goldman Sachs', 'Natixis',
]);

// Postes rares et convoités : ceux qu'on ne trouve pas à tous les coins de rue.
const POSTE_RARE_RE =
  /\bm&a\b|fusions?[\s-]acquisitions?|private equity|corporate finance|front office|\btrader\b|trading|transaction services|leveraged finance|\becm\b|\bdcm\b|capital markets|structuration|deal|investment banking|equity research|venture|market risk|credit risk|\balm\b|asset & liability|real estate investment/i;

// Grands groupes reconnaissables — surtout utile pour le VIE, dont les
// employeurs ne sont pas dans la liste des maisons de référence mais restent de
// belles signatures pour un étudiant (un VIE chez TotalEnergies ou Sanofi, ça
// se remarque).
const GRANDE_STRUCTURE_RE =
  /totalenergies|\bengie\b|\bedf\b|\borange\b|bouygues|louis dreyfus|caceis|capgemini|airbus|thales|renault|michelin|danone|schneider|saint-gobain|veolia|\bsncf\b|sanofi|\bbnp\b|credit agricole|societe generale|\bipsen\b|technip|criteo|merck|janssen|arkopharma/i;

function scorePepite(o) {
  let score = 0;
  if (MAISONS_PRESTIGE.has(o.maison)) score += 3;
  if (POSTE_RARE_RE.test(o.title)) score += 2;
  // Le VIE est par nature une opportunité convoitée (à l'étranger, bien
  // rémunéré) : on le valorise, et on reconnaît les grandes structures dont
  // le nom n'est pas dans la liste des maisons de référence.
  if (o.volet === 'vie') {
    score += 2;
    if (GRANDE_STRUCTURE_RE.test(o.emp)) score += 2;
  }
  // Un poste convoité ouvert en stage/alternance est une aubaine junior.
  if (o.volet === 'stage' || o.volet === 'alternance') score += 1;
  // Le lien direct chez l'employeur vaut mieux qu'un agrégateur.
  if (!/adzuna|francetravail|choisirleservicepublic|businessfrance/.test(o.source)) score += 1;
  return score;
}

// Sélectionne les pépites SÉPARÉMENT pour chaque onglet, pour qu'aucun onglet
// ne soit privé de mises en avant (avant, les stages raflaient toutes les
// places et le VIE restait vide). Au plus ~8 par onglet, 2 par maison.
function choisirPepites(offers) {
  const retenus = new Set();
  for (const volet of ['stage', 'alternance', 'vie', 'cdi-cdd']) {
    const notes = offers
      .filter((o) => o.volet === volet)
      .map((o) => ({ o, s: scorePepite(o) }))
      .filter((x) => x.s >= 4)
      .sort((a, b) => b.s - a.s);
    // Une seule pépite par maison et par onglet : un carrousel qui affiche deux
    // fois Lazard donne l'impression d'un catalogue étroit, alors que la
    // promesse est justement de faire découvrir. La même maison peut en
    // revanche reparaître dans un autre onglet — un stage chez Amundi et un VIE
    // chez Amundi sont deux opportunités distinctes pour le candidat.
    const maisonsVues = new Set();
    let n = 0;
    for (const { o } of notes) {
      const cle = o.maison || o.emp;
      if (maisonsVues.has(cle)) continue;
      maisonsVues.add(cle);
      retenus.add(o._key);
      if (++n >= 8) break;
    }
  }
  return retenus;
}

// ---------------------------------------------------------------------------
// Récupération des dates de publication manquantes
// ---------------------------------------------------------------------------
// Certaines sources ne donnent aucune date dans leur liste : on affichait alors
// une carte muette sur « depuis quand est-ce en ligne ? », qui est pourtant la
// première question d'un candidat. Leur FICHE, elle, porte presque toujours la
// date — les ATS émettent un JSON-LD JobPosting pour le référencement Google,
// et `datePosted` y est normalisé. On va donc la chercher.
//
// Deux règles de conduite :
//  - on ne le fait qu'en toute fin de pipeline, sur les offres qui seront
//    réellement publiées : inutile de solliciter un site pour une annonce
//    qu'on s'apprête à écarter ;
//  - on n'invente jamais. Si la fiche ne porte pas de date, l'offre reste sans
//    date plutôt que de recevoir celle de la collecte.
// La fiche rend deux services pour une seule requête : la date de publication,
// et le texte de l'annonce. Ce texte est la seule mention du niveau requis —
// sans lui, le filtre « 0-3 ans » ne peut se prononcer que sur l'intitulé, et
// un poste à cinq ans d'expérience passe dès que son titre ne dit pas
// « senior ». On récupère donc les deux d'un coup.
// Repli quand la page ne publie pas de description structurée. On ne cherche
// dans ce texte qu'une mention d'années d'expérience : il n'a pas besoin
// d'être propre, seulement d'exister. Il n'est jamais publié — comme toute
// description, il sert au seul filtre de séniorité puis il est retiré.
//
// On privilégie le conteneur de l'annonce quand la page le balise ; à défaut
// on prend le texte entier, débarrassé du script, du style et de la
// navigation. Une mention « 5 ans d'expérience » égarée dans un pied de page
// serait un faux rejet, mais le cas est rare devant les 184 offres perdues
// faute de tout texte.
function texteDeLaPage(html) {
  // Pas de recherche de conteneur : les pages d'annonce éclatent le niveau
  // d'expérience, le contrat et les prérequis dans des encadrés séparés du
  // corps du texte, et viser « la » zone de description en manquait toujours
  // une. On prend tout, moins ce qui ne relève pas du contenu.
  const texte = String(html)
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x?[0-9a-f]+;|&\w+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return texte.length > 300 ? texte.slice(0, 12000) : null;
}

// Le type de contrat, lu dans le TEXTE de la fiche. Les API des plateformes ne
// le donnent pas toutes, et quand elles le donnent elles se trompent : le
// JSON-LD de Teamtailor annonce « CONTRACTOR » pour un CDI, celui de
// Greenhouse « Vollzeit ». La page, elle, l'écrit en clair et en français.
//
// On n'accepte que les mentions EXPLICITES, introduites par « type de
// contrat » ou « contrat », pour ne pas confondre avec une phrase du corps de
// l'annonce (« votre contrat de professionnalisation vous permettra… »).
const CONTRAT_FICHE_RE =
  /(?:type de contrat|nature du contrat|contract type)\s*:?\s*([A-Za-zÀ-ÿ' -]{3,40})/i;

function contratDeLaFiche(texte) {
  const m = String(texte || '').match(CONTRAT_FICHE_RE);
  if (!m) return null;
  const dit = m[1].toLowerCase();
  if (/alternan|apprenti|professionnalisation/.test(dit)) return 'alternance';
  if (/stage|stagiaire|intern/.test(dit)) return 'stage';
  return null; // CDI, CDD, intérim : rien à corriger
}

function ficheJsonLd(html) {
  const resultat = { date: null, description: null };
  for (const bloc of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let noeuds;
    try {
      noeuds = [].concat(JSON.parse(bloc[1].trim()));
    } catch {
      continue; // JSON-LD malformé : fréquent, on passe au bloc suivant
    }
    for (const n of noeuds) {
      if (!n) continue;
      if (!resultat.description && typeof n.description === 'string' && n.description.length > 80) {
        resultat.description = n.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/&#x?[0-9a-f]+;|&\w+;/gi, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 4000);
      }
      const brut = n.datePosted || (n['@graph'] || []).map((g) => g && g.datePosted).find(Boolean);
      if (!brut || resultat.date) continue;
      // Deux écritures selon les sites : « 31/08/2026 » (Crédit Agricole) et
      // ISO « 2026-08-31 », parfois sans zéro initial (KPMG : « 2026-8-25 »).
      const fr = String(brut).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const iso = String(brut).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      let d = null;
      if (fr) d = new Date(`${fr[3]}-${fr[2]}-${fr[1]}T00:00:00Z`);
      else if (iso) d = new Date(`${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}T00:00:00Z`);
      if (!d || isNaN(d)) continue;
      // Garde-fou : une date future ou antérieure à 2015 est une erreur de la
      // source, pas une information. On préfère ne rien dire.
      const an = d.getUTCFullYear();
      if (d.getTime() > Date.now() + 86400000 || an < 2015) continue;
      resultat.date = d.toISOString();
    }
  }

  // Tous les ATS n'émettent pas de JSON-LD. Deux formats de repli, relevés sur
  // les sites concernés : une balise meta (SuccessFactors — EY, HSBC) et la
  // date en clair dans la page (framework e-i — Crédit Mutuel, CIC).
  if (!resultat.date) {
    const meta = html.match(/<meta[^>]+(?:datePosted|published_time|pubdate|DC\.date)[^>]*content="([^"]+)"/i);
    let d = meta ? new Date(meta[1]) : null;

    // Dernier recours : la date écrite en toutes lettres dans la page. On
    // travaille sur le texte débalisé, car le libellé et la valeur sont
    // souvent séparés par des balises — TalentSoft écrit « <h3>Publication
    // date</h3> 27/08/2026 », qu'aucune recherche ligne à ligne ne trouve.
    //
    // Le libellé est obligatoire : la même page porte « Expected start date
    // 01/11/2026 », qui est la date de PRISE DE POSTE. Attraper une date au
    // hasard reviendrait à en inventer une.
    if (!d || isNaN(d)) {
      // Le contenu des balises <meta> est ajouté au texte, et pas seulement le
      // corps de la page : chez TalentSoft, la date de dix offres sur onze
      // n'existe QUE dans la description — « Lieu : Poissy. Date : 01/08/2026 ».
      // Retirer les balises avant de chercher emportait l'attribut avec elles,
      // et la date disparaissait sans que rien ne le signale.
      //
      // Elles sont ajoutées à la FIN : les libellés explicites du corps de page
      // restent trouvés en premier, la description ne servant que de recours.
      const metas = [...html.matchAll(/<meta[^>]+content="([^"]*)"/gi)]
        .map((m) => m[1])
        .join(' ');
      const texte = (html.replace(/<[^>]*>/g, ' ') + ' ' + metas)
        .replace(/&#x?[0-9a-f]+;|&\w+;/gi, ' ')
        .replace(/\s+/g, ' ');
      // « Date de parution » est la formulation des pages TalentSoft en
      // français, quand leur version anglaise dit « Publication date ».
      const LIBELLE =
        `(?:date\\s+de\\s+(?:publication|parution)|publication\\s+date|publi[ée]e?\\s+le|` +
        `mise?\\s+en\\s+ligne\\s+le|posted\\s+on)`;
      // TalentSoft n'écrit ni « parution » ni « publication » : sa fiche dit
      // « Date de mise à jour 20/08/2026 », et sa description « Lieu :
      // Montrouge. Date : 20/08/2026. » Les deux donnent le même jour.
      //
      // « Mise à jour » n'est pas « publication », et on ne le prétend pas :
      // c'est la date que TalentSoft affiche lui-même comme celle de l'offre,
      // elle est vérifiable sur la fiche, et elle vaut mieux qu'aucune date.
      const REPLIS = [
        LIBELLE,
        `date\\s+de\\s+mise\\s+[àa]\\s+jour`,
        // Ancrée sur « Lieu : … . Date : », jamais sur « Date » seul : la même
        // page porte « Date prévue de prise de fonction 01/01/2027 », qui est
        // la prise de poste. Une date non étiquetée aurait daté l'annonce de
        // l'an prochain.
        `Lieu\\s*:[^.]{0,90}\\.\\s*Date`,
      ];
      for (const [rang, libelle] of REPLIS.entries()) {
        const fr = texte.match(new RegExp(`${libelle}\\s*:?\\s*(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})`, 'i'));
        const iso = texte.match(new RegExp(`${libelle}\\s*:?\\s*(\\d{4})-(\\d{1,2})-(\\d{1,2})`, 'i'));
        if (fr) d = new Date(`${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}T00:00:00Z`);
        else if (iso) d = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}T00:00:00Z`);
        if (d && !isNaN(d)) {
          // Le rang 1 est « date de mise à jour » : la fiche ne donne alors pas
          // la première publication, et la carte doit écrire « Mise à jour ».
          if (rang === 1) resultat.dateEstMiseAJour = true;
          break;
        }
      }
    }

    if (d && !isNaN(d) && d.getTime() <= Date.now() + 86400000 && d.getUTCFullYear() >= 2015) {
      resultat.date = d.toISOString();
    }
  }

  return resultat;
}

async function completerDatesManquantes(offers) {
  // Deux raisons d'aller lire une fiche, et la seconde comptait autant que la
  // première sans qu'on s'en aperçoive.
  //
  // La date, d'abord : le drapeau `datePubFiable` n'existe qu'à l'écriture, on
  // applique donc ici la même règle sur la source.
  //
  // La SÉNIORITÉ ensuite. Le filtre 0-3 ans ne peut se prononcer que s'il a le
  // texte de l'annonce ; sans lui, il ne juge que l'intitulé, et un poste à
  // cinq ans d'expérience passe dès que son titre ne dit pas « senior ». Or on
  // n'allait chercher les fiches que pour les offres SANS DATE : une offre
  // datée mais sans description n'était jamais examinée. C'est ainsi que des
  // CDI à plus de trois ans d'expérience se retrouvaient publiés.
  //
  // On ne le fait que pour les CDI/CDD : un stage ou une alternance est junior
  // par nature, inutile d'aller vérifier.
  // Trois connecteurs n'ont aucun champ de contrat et se rabattent sur
  // l'intitulé : Teamtailor, SuccessFactors et Phenom. Tout ce qui ne dit pas
  // « stage » dans son titre part en CDI, puis meurt au filtre 0-3 ans. Leurs
  // fiches doivent donc être lues même quand la date et la description sont là,
  // pour que contratDeLaFiche puisse les reclasser.
  const SOURCE_SANS_CONTRAT_RE = /^(teamtailor|successfactors|phenom)/;

  // Une source RÉPUTÉE datée peut très bien ne pas dater telle offre : le
  // catalogue Workday de Swiss Life ne porte « postedOn » sur aucune de ses
  // 96 annonces, et l'API v2 de Phenom n'expose aucun champ de date pour HSBC.
  // Ces offres n'étaient jamais envoyées ici — la condition jugeait la
  // réputation de la source, pas ce que l'offre porte réellement — alors que
  // leur fiche donne la date en clair : « datePosted: 2026-08-31 » chez Swiss
  // Life. Onze offres restaient sans date à côté de la réponse.
  const aCompleter = offers.filter(
    (o) =>
      o.url &&
      (!SOURCES_DATE_FIABLE_RE.test(o.source) ||
        o._dateDeLaSource !== true ||
        (o.volet === 'cdi-cdd' && (!o._descr || o._descr.length < 1500)) ||
        (o.volet === 'cdi-cdd' && SOURCE_SANS_CONTRAT_RE.test(o.source)))
  );
  if (!aCompleter.length) return 0;

  // Une file par hôte : deux sites différents peuvent être interrogés en
  // parallèle, mais on ne bombarde jamais le même. BNP nous avait renvoyé des
  // 403 pour l'avoir oublié, et le robots.txt du Crédit Agricole demande 3 s.
  const parHote = new Map();
  for (const o of aCompleter) {
    let hote;
    try {
      hote = new URL(o.url).host;
    } catch {
      continue;
    }
    if (!parHote.has(hote)) parHote.set(hote, []);
    parHote.get(hote).push(o);
  }

  const DELAI_PAR_HOTE = { 'groupecreditagricole.jobs': 3000, 'group.bnpparibas': 1500 };
  let trouvees = 0;

  await Promise.all(
    [...parHote.entries()].map(async ([hote, liste]) => {
      const delai = DELAI_PAR_HOTE[hote] || 700;
      for (const o of liste) {
        try {
          const r = await fetch(o.url, {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
            signal: AbortSignal.timeout(20000),
          });
          if (r.ok) {
            const texteHtml = await r.text();
            const fiche = ficheJsonLd(texteHtml);
            if (fiche.date) {
              o._postedAt = fiche.date;
              o._dateRecuperee = true;
              // Une date lue sous le libellé « mise à jour » n'est pas une date
              // de publication : la carte le dira. On n'écrase le drapeau que
              // lorsqu'une date est effectivement trouvée.
              o._dateEstMiseAJour = fiche.dateEstMiseAJour === true;
              trouvees++;
            }
            // La description structurée ET le corps de la page, concaténés.
            // Prendre l'une OU l'autre laissait passer les annonces qui
            // décrivent la mission en JSON-LD et posent leurs exigences dans
            // un encadré — le cas du Crédit Agricole, et de son banquier
            // conseil à « 6 - 10 ans » resté en ligne.
            const morceaux = [o._descr, fiche.description, texteDeLaPage(texteHtml)];
            o._descr = morceaux.filter(Boolean).join(' ').slice(0, 16000) || o._descr;

            // Le contrat, tant qu'on tient la page. Sept familles de
            // connecteurs le devinent sur l'intitulé, et rangent donc en CDI
            // toute alternance dont le titre ne le dit pas — que le filtre
            // 0-3 ans écarte ensuite comme un poste confirmé.
            if (o.volet === 'cdi-cdd') {
              const vrai = contratDeLaFiche(o._descr);
              if (vrai) {
                o.volet = vrai;
                o.contrat = null; // la mention CDI/CDD ne veut plus rien dire
                o._voletCorrige = true;
              }
            }
          }
        } catch {
          /* fiche injoignable : l'offre reste sans date, on n'invente pas */
        }
        await new Promise((res) => setTimeout(res, delai));
      }
    })
  );

  return trouvees;
}

// ---------------------------------------------------------------------------
// Garde-fou de publication
// ---------------------------------------------------------------------------
// Le 1er septembre 2026, cinq connecteurs (Workday, VIE, BPCE, Yello, Goldman)
// ont renvoyé zéro depuis le runner GitHub alors qu'ils répondaient normalement
// ailleurs. Le pipeline a publié un catalogue amputé de 28 %, VIE entièrement
// vide, sans que rien ne l'annonce. Une panne de collecte ne doit jamais se
// traduire par une mise en ligne silencieuse : mieux vaut garder le catalogue
// de la veille, un peu vieilli, qu'un catalogue creux qui a l'air normal.
//
// On compare donc au fichier déjà publié, et on refuse d'écrire si :
//   - le total s'effondre (une variation quotidienne saine se compte en
//     dizaines d'offres, pas en centaines) ;
//   - un connecteur qui pesait sérieusement hier tombe à zéro — signe d'une
//     panne ciblée, que le total seul peut masquer si d'autres compensent.
// Doit rester aligné sur RECOLTE_MAX_JOURS de sources.js : sert uniquement au
// message de fin de passage.
const RECOLTE_MAX_JOURS_INFO = 4;
const SEUIL_CHUTE = 0.15; // 15 % du catalogue
const SEUIL_CONNECTEUR_MUET = 10; // offres la veille à partir desquelles un zéro est suspect

function lireCatalexistant() {
  try {
    const src = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const bac = {};
    new Function('window', src)(bac);
    return Array.isArray(bac.__OFFRES__) ? bac.__OFFRES__ : null;
  } catch {
    return null; // premier passage, ou fichier illisible : rien à comparer
  }
}

function parConnecteur(offres) {
  const m = new Map();
  for (const o of offres) {
    const k = String(o.source || '?').split(':')[0];
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

// Renvoie la liste des anomalies. Vide = on peut publier.
function anomaliesDePublication(nouvelles) {
  const anciennes = lireCatalexistant();
  if (!anciennes || anciennes.length < 50) return [];

  const soucis = [];
  const chute = (anciennes.length - nouvelles.length) / anciennes.length;
  if (chute > SEUIL_CHUTE) {
    soucis.push(
      `le catalogue passe de ${anciennes.length} à ${nouvelles.length} offres ` +
        `(-${Math.round(chute * 100)} %, seuil ${Math.round(SEUIL_CHUTE * 100)} %)`
    );
  }

  const avant = parConnecteur(anciennes);
  const apres = parConnecteur(nouvelles);
  for (const [nom, n] of avant) {
    if (n >= SEUIL_CONNECTEUR_MUET && !apres.get(nom)) {
      soucis.push(`le connecteur « ${nom} » passe de ${n} offres à zéro`);
    }
  }
  return soucis;
}

// Une date publiée est toujours en ISO, ou absente. Chaque connecteur rend la
// sienne dans le format de sa source, et la page ne peut pas deviner si
// « 09/01/2026 » est le 9 janvier ou le 1er septembre — JavaScript tranche
// pour le second, à l'américaine, et vieillit l'annonce de huit mois d'un
// coup. On lève ici cette ambiguïté une fois pour toutes.
function dateIso(valeur) {
  if (!valeur) return null;
  const brut = String(valeur).trim();
  // JJ/MM/AAAA : la lecture française, la seule qui vaille pour nos sources.
  const fr = brut.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (fr) {
    const d = new Date(`${fr[3]}-${fr[2]}-${fr[1]}T00:00:00Z`);
    return isNaN(d) ? null : d.toISOString();
  }
  const d = new Date(brut);
  if (isNaN(d)) return null;
  // Une date future, ou antérieure à 2015, est une erreur de la source et non
  // une information : mieux vaut ne rien dire que dire faux.
  const t = d.getTime();
  if (t > Date.now() + 86400000 || d.getUTCFullYear() < 2015) return null;
  return d.toISOString();
}

function writeOutput(offers) {
  const pepites = choisirPepites(offers);
  console.log(`[pipeline] ${pepites.size} offres mises en avant comme « Pépites JJ ».`);

  const publicOffers = offers.map((o) => {
    // `_descr` est le texte intégral de l'annonce. Il sert UNIQUEMENT à juger
    // la séniorité, en interne, et ne doit jamais être publié : ce serait
    // reproduire mot pour mot la prose de l'employeur — ce que JJ n'a aucun
    // droit de faire et aucune raison de vouloir. Il figurait pourtant dans le
    // fichier servi, faute d'avoir été retiré ici : quelques adresses de
    // contact s'y trouvaient, et il pesait à lui seul l'essentiel des 1,9 Mo
    // téléchargés par chaque visiteur.
    //
    // JJ ne publie que ce qui est factuel et non appropriable : l'intitulé du
    // poste, l'employeur, le lieu, la date, et le lien vers l'annonce d'origine.
    const {
      _key, _postedAt, _firstSeenAt, _lastSeenAt, _linkStatus,
      _dateRecuperee, _dateDeLaSource, _dateEstMiseAJour, _descr,
      ...rest
    } = o;
    // firstSeenAt = date à laquelle JJ a vu cette offre pour la première fois.
    // C'est ce qui alimente le filtre "nouvelles offres" de la page : plus
    // fiable que postedAt, que certaines sources ne fournissent pas ou mal.
    // Si la date ne se laisse pas lire, l'offre rejoint les non datées : la
    // page annoncera franchement une publication inconnue plutôt que de la
    // dater au jugé.
    const datePubliee = dateIso(_postedAt);
    return {
      ...rest,
      verifiedAt: _lastSeenAt,
      postedAt: datePubliee || _firstSeenAt,
      firstSeenAt: _firstSeenAt,
      // true = la date affichée est une date de MISE À JOUR de l'annonce, pas
      // de première publication. La carte écrit alors « Mise à jour il y a X »
      // plutôt que « Publiée il y a X ». Absent le reste du temps, pour ne pas
      // alourdir offres.js d'un champ faux sur 95 % des lignes.
      ...(_dateEstMiseAJour && datePubliee ? { dateMaj: true } : {}),
      // false = la source ne date pas ses offres : _postedAt vaut la date de
      // collecte, la page ne doit donc pas l'afficher comme date de publication.
      // _dateRecuperee = la liste ne datait pas l'offre, mais sa fiche l'a fait
      // (JSON-LD `datePosted`) : la date est alors tout aussi réelle.
      datePubFiable:
        Boolean(datePubliee) &&
        ((SOURCES_DATE_FIABLE_RE.test(o.source) && o._dateDeLaSource === true) ||
          o._dateRecuperee === true),
      // true = « Pépite JJ », mise en avant dans le bandeau du haut.
      pepite: pepites.has(o._key),
    };
  });

  const header = `// Fichier généré par ingestion/pipeline.js — NE PAS ÉDITER À LA MAIN.\n// Généré le ${new Date().toISOString()}\n`;
  const body = `window.__OFFRES__ = ${JSON.stringify(publicOffers, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_PATH, header + body);
  writeRss(publicOffers);
  writeSitemap();
}

// ---------------------------------------------------------------------------
// Flux RSS des dernières offres
//
// Tous les concurrents proposent une alerte e-mail, mais elle impose un compte
// et sert de porte d'entrée au démarchage. JJ promet "sans compte, sans pub" :
// le flux RSS donne la même chose — être prévenu des nouvelles offres — sans
// livrer son adresse à personne. C'est un fichier statique, rien à héberger.
// ---------------------------------------------------------------------------
function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sitemap. Le site n'a que trois pages, mais celle d'accueil change tous les
// matins : le générer avec le reste garantit que la date déclarée aux moteurs
// est la vraie date du dernier passage, et non celle du jour où quelqu'un a
// pensé à mettre le fichier à jour.
function writeSitemap() {
  const jour = new Date().toISOString().slice(0, 10);
  const pages = [
    { chemin: '/', freq: 'daily', priorite: '1.0', maj: jour },
    { chemin: '/mentions-legales.html', freq: 'yearly', priorite: '0.2', maj: jour },
    { chemin: '/confidentialite.html', freq: 'yearly', priorite: '0.2', maj: jour },
  ];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map((p) =>
      [
        '  <url>',
        `    <loc>${SITE_URL}${p.chemin}</loc>`,
        `    <lastmod>${p.maj}</lastmod>`,
        `    <changefreq>${p.freq}</changefreq>`,
        `    <priority>${p.priorite}</priority>`,
        '  </url>',
      ].join('\n')
    ),
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(SITEMAP_PATH, xml);
}

function writeRss(offers) {
  const recentes = offers
    .slice()
    .sort((a, b) => new Date(b.firstSeenAt || 0) - new Date(a.firstSeenAt || 0))
    .slice(0, 100);

  const items = recentes
    .map((o) => {
      const titre = `${o.title} — ${o.emp}`;
      const desc = [o.famille, o.sector, o.loc, o.volet].filter(Boolean).join(' · ');
      return [
        '    <item>',
        `      <title>${xmlEscape(titre)}</title>`,
        `      <link>${xmlEscape(o.url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(o.url)}</guid>`,
        `      <description>${xmlEscape(desc)}</description>`,
        `      <pubDate>${new Date(o.firstSeenAt || Date.now()).toUTCString()}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>JJ Finance : dernières offres finance junior</title>',
    `    <link>${SITE_URL}/</link>`,
    "    <description>Stages, alternances et CDI/CDD 0-3 ans en finance, en France. Lien direct vers l'annonce de l'entreprise.</description>",
    '    <language>fr-FR</language>',
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  fs.writeFileSync(RSS_PATH, xml);
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------
async function run() {
  console.log('[pipeline] Récupération des sources...');
  const raw = await fetchAllSources();
  console.log(`[pipeline] ${raw.length} offres brutes récupérées.`);

  const normalized = raw.map(normalize).filter(Boolean);
  console.log(`[pipeline] ${normalized.length} offres normalisées (${raw.length - normalized.length} rejetées : champs manquants).`);
  // Répartition par onglet DÈS la normalisation, avant tout filtrage. Sans
  // elle, on ne peut pas dire si un onglet est pauvre parce que les maisons
  // n'y recrutent pas, ou parce qu'on perd ses offres en chemin — la question
  // s'est posée pour l'alternance, servie uniquement par des sources directes.
  {
    const parVolet = {};
    for (const o of normalized) parVolet[o.volet] = (parVolet[o.volet] || 0) + 1;
    console.log(
      '[pipeline] Avant filtrage : ' +
        Object.entries(parVolet).map(([k, v]) => k + ' ' + v).join(', ')
    );
  }

  // Le filtre "grandes villes françaises" ne s'applique pas au VIE : par nature
  // à l'étranger, et destiné aux jeunes Français, il est pertinent quelle que
  // soit la destination. On le laisse donc passer sans condition de lieu.
  const grandesVilles = normalized.filter((o) => o.volet === 'vie' || estGrandeVille(o.loc));
  console.log(`[pipeline] ${grandesVilles.length} offres en grandes villes ou VIE (${normalized.length - grandesVilles.length} écartées : petites communes).`);

  // Le VIE entre toujours, même si l'entreprise n'est pas une maison de
  // référence : c'est un canal à part (Business France), pas un employeur qu'on
  // aurait choisi de lister — le restreindre à la liste n'aurait aucun sens.
  const dansLePerimetre = MAISONS_DE_REFERENCE_SEULEMENT
    ? grandesVilles.filter((o) => o.maisonReference || o.volet === 'vie')
    : grandesVilles;
  const horsListe = grandesVilles.filter((o) => !o.maisonReference).length;
  console.log(
    MAISONS_DE_REFERENCE_SEULEMENT
      ? `[pipeline] ${dansLePerimetre.length} offres dans les ${MAISONS.length} maisons de référence ` +
          `(${horsListe} écartées : employeur hors liste).`
      : `[pipeline] ${dansLePerimetre.length} offres retenues, dont ${horsListe} regroupées sous « ${MAISON_AUTRES} ».`
  );

  // Le filtre d'âge ne s'applique qu'aux sources qui fournissent une VRAIE date
  // de publication : TalentSoft, SuccessFactors et le framework e-i n'en donnent
  // aucune, leur appliquer un seuil reviendrait à trancher au hasard. Pour les
  // autres, le seuil dépend du type de source (cf. MAX_AGE_JOURS ci-dessus).
  const seuilAgregateur = Date.now() - MAX_AGE_JOURS * 86400000;
  const seuilAtsDirect = Date.now() - MAX_AGE_JOURS_ATS_DIRECT * 86400000;
  const seuilCdiCdd = Date.now() - MAX_AGE_JOURS_CDI_CDD * 86400000;
  let coupeesAgregateur = 0;
  let coupeesZombies = 0;
  const fraiches = dansLePerimetre.filter((o) => {
    if (!SOURCES_DATE_FIABLE_RE.test(o.source)) return true;
    const t = new Date(o._postedAt || 0).getTime();
    if (!t) return true;
    if (SOURCES_AGREGATEUR_RE.test(o.source)) {
      if (t >= seuilAgregateur) return true;
      coupeesAgregateur++;
      return false;
    }
    const seuil = o.volet === 'cdi-cdd' ? seuilCdiCdd : seuilAtsDirect;
    if (t >= seuil) return true;
    coupeesZombies++;
    return false;
  });
  console.log(
    `[pipeline] ${fraiches.length} offres retenues sur l'âge ` +
      `(${coupeesAgregateur} écartées : plus de ${MAX_AGE_JOURS} j sur un agrégateur ; ` +
      `${coupeesZombies} écartées : plus de ${MAX_AGE_JOURS_ATS_DIRECT} j même chez l'employeur).`
  );

  const junior = fraiches.filter((o) => passesJuniorFilter(o.volet, o.title, o._descr));
  console.log(
    `[pipeline] ${junior.length} offres après filtre junior 0-3 ans (${fraiches.length - junior.length} écartées : senior/confirmé).`
  );

  const dedupBrut = dedupe(junior);
  const deduped = retirerSansLieuRedondantes(dedupBrut);
  const dupCount = junior.length - deduped.length;
  console.log(
    `[pipeline] ${deduped.length} offres après déduplication (${dupCount} doublons fusionnés, ` +
      `dont ${dedupBrut.length - deduped.length} variantes sans lieu).`
  );

  let final = await applyFreshnessAndDeadRemoval(deduped);
  console.log(`[pipeline] ${final.length} offres finales après vérification de fraîcheur${CHECK_LINKS ? ' + liens' : ''}.`);

  if (mortesManuelles) {
    console.warn(
      `[pipeline] ${mortesManuelles} offre(s) de manuel.js pointent vers un lien mort : ` +
        `elles ne sont pas publiées, mais leur ligne reste dans le fichier et sera ` +
        `retentée demain. À retirer de ingestion/manuel.js.`
    );
  }

  const nonDatee = (o) => !SOURCES_DATE_FIABLE_RE.test(o.source) && o._dateRecuperee !== true;
  const sansDateAvant = final.filter(nonDatee).length;
  const recuperees = await completerDatesManquantes(final);
  const sansDateApres = final.filter(nonDatee).length;
  console.log(
    `[pipeline] Dates de publication : ${recuperees} récupérées sur les fiches ` +
      `(${sansDateAvant} manquantes -> ${sansDateApres}). ` +
      `${final.length - sansDateApres}/${final.length} offres datées.`
  );

  // Second passage du filtre d'âge, sur les seules offres qui viennent d'être
  // datées. Le premier passage les avait laissées passer faute de date ; on
  // sait maintenant que certaines traînent depuis des années. Une annonce de
  // trois ans est pourvue depuis longtemps : la publier trompe le candidat et
  // discrédite le reste du catalogue. On applique le seuil de l'employeur
  // direct, puisque c'est bien sa fiche qu'on vient de lire.
  const seuilApresDatation = Date.now() - MAX_AGE_JOURS_ATS_DIRECT * 86400000;
  const seuilApresDatationCdi = Date.now() - MAX_AGE_JOURS_CDI_CDD * 86400000;
  let perimees = 0;
  const aJour = final.filter((o) => {
    // Exactement le critère de datePubFiable, dans writeOutput : si la page
    // affiche cette date comme une date de publication, le seuil d'âge doit
    // pouvoir la juger. Les deux divergeaient.
    const dateCredible =
      (SOURCES_DATE_FIABLE_RE.test(o.source) && o._dateDeLaSource === true) ||
      o._dateRecuperee === true;
    if (!dateCredible) return true;
    const t = new Date(o._postedAt || 0).getTime();
    const seuil = o.volet === 'cdi-cdd' ? seuilApresDatationCdi : seuilApresDatation;
    if (!t || t >= seuil) return true;
    perimees++;
    return false;
  });
  if (perimees) {
    console.log(
      `[pipeline] ${perimees} offres écartées après datation : trop anciennes ` +
        `(${MAX_AGE_JOURS_CDI_CDD} j pour un CDI/CDD, ${MAX_AGE_JOURS_ATS_DIRECT} j sinon), ` +
        `ce que seule leur fiche a révélé.`
    );
  }
  final = aJour;

  // Second passage du filtre junior. Les fiches qu'on vient de lire ont donné
  // à des centaines d'offres la description qui leur manquait : jusqu'ici leur
  // séniorité n'était jugée que sur l'intitulé, et un poste demandant cinq ans
  // d'expérience passait dès que son titre ne disait pas « senior ».
  const avantSeniorite = final.length;
  const publiables = final.filter((o) => passesJuniorFilter(o.volet, o.title, o._descr, true));
  // Deux motifs de rejet, comptés séparément : on veut voir lequel domine.
  // « la description dit sept ans » est le but recherché ; « on n'a pas pu lire
  // la description » est le prix de la rigueur, et s'il devenait majoritaire il
  // faudrait revoir l'arbitrage.
  const rejetSeniorite = new Set(final.filter((o) => !publiables.includes(o)));
  const demasquees = [...rejetSeniorite].filter((o) => o._descr).length;
  const invisibles = rejetSeniorite.size - demasquees;
  if (invisibles) {
    // Savoir QUELLES sources restent illisibles est le seul moyen de faire
    // baisser ce chiffre : c'est leur connecteur qu'il faudra doter d'une
    // description, plutôt que de continuer à gratter leurs pages.
    const parSource = {};
    for (const o of rejetSeniorite) {
      if (o._descr) continue;
      const src = String(o.source || '?').split(':')[0];
      parSource[src] = (parSource[src] || 0) + 1;
    }
    const top = Object.entries(parSource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    console.log(`[pipeline] Offres sans description lisible, par source : ${top}.`);
  }
  // Second passage sur le type de contrat. Tout poste sans mention étant
  // réputé CDI, une seule chose reste à faire ici : rattraper les CDD que la
  // fiche révèle et que l'intitulé taisait. Confirmer un CDI n'apprendrait
  // rien, on ne le fait donc pas.
  let cddRattrapes = 0;
  for (const o of publiables) {
    if (o.volet !== 'cdi-cdd' || !o._descr || o.contrat === 'CDD') continue;
    if (CDD_RE.test(o._descr)) {
      o.contrat = 'CDD';
      cddRattrapes++;
    }
  }
  const cdiCdd = publiables.filter((o) => o.volet === 'cdi-cdd');
  const nommes = cdiCdd.filter((o) => o.contrat).length;
  console.log(
    `[pipeline] Contrat précisé sur ${nommes}/${cdiCdd.length} offres CDI-CDD ` +
      `(${cddRattrapes} CDD démasqués par leur fiche).`
  );
  console.log(
    `[pipeline] ${publiables.length} offres après second filtre 0-3 ans sur les fiches ` +
      `(${demasquees} postes confirmés démasqués par leur description, ` +
      `${invisibles} écartées faute de description lisible).`
  );

  // Rien n'est écrit tant que le résultat ne tient pas debout. Une collecte
  // partielle publiée en silence est pire qu'un catalogue d'un jour de retard :
  // le site paraît normal, et personne ne voit qu'un onglet entier est vide.
  // Maisons servies depuis le magasin : le catalogue est complet, mais ces
  // sources-là datent. Le dire évite qu'une panne s'installe en silence.
  if (sourcesReprises.length) {
    console.warn(
      `\n[pipeline] ${sourcesReprises.length} source(s) muette(s) ce matin, servie(s) depuis le magasin :`
    );
    for (const s of sourcesReprises.sort((a, b) => b.offres - a.offres)) {
      console.warn(
        `  - ${s.nom} : récolte du ${s.le.slice(0, 10)} (${s.offres} offres, ${Math.round(s.jours)} j)`
      );
    }
    console.warn(
      `  Une récolte cesse d'être servie au-delà de ${RECOLTE_MAX_JOURS_INFO} jours : la source\n` +
        '  tombe alors à zéro et le garde-fou bloque la publication. À surveiller si\n' +
        '  cela se répète plusieurs matins de suite.\n'
    );
  }

  const anomalies = anomaliesDePublication(publiables);
  if (anomalies.length && !process.argv.includes('--forcer')) {
    console.error('\n[pipeline] PUBLICATION ANNULÉE — la collecte semble incomplète :');
    for (const a of anomalies) console.error(`  - ${a}`);
    console.error(
      '\n  Le catalogue en ligne est conservé tel quel. Relancer le passage suffit\n' +
        '  le plus souvent : ces pannes sont presque toujours passagères (réseau du\n' +
        '  runner, API momentanément fermée). Pour publier malgré tout, par exemple\n' +
        '  si la baisse est voulue : node ingestion/pipeline.js --forcer\n'
    );
    process.exitCode = 1;
    return;
  }

  writeOutput(publiables);
  console.log(
    `[pipeline] Écrit dans ${path.relative(process.cwd(), OUTPUT_PATH)}` +
      `, ${path.relative(process.cwd(), RSS_PATH)} (flux RSS) et ${path.relative(process.cwd(), SITEMAP_PATH)}.`
  );

  // Résumé par onglet et par famille
  const byVolet = {};
  const byFamille = {};
  for (const o of publiables) {
    byVolet[o.volet] = (byVolet[o.volet] || 0) + 1;
    byFamille[o.famille] = (byFamille[o.famille] || 0) + 1;
  }
  // Origine des offres : montre ce qu'apporte chaque source, et combien
  // d'offres ont été retrouvées dans plusieurs sources puis fusionnées.
  const parSource = {};
  for (const o of publiables) {
    const p = o.source.split(':')[0];
    parSource[p] = (parSource[p] || 0) + 1;
  }
  const fusionnees = publiables.filter((o) => o.alsoOn && o.alsoOn.length).length;
  console.log('\n--- Origine des offres ---');
  for (const [p, n] of Object.entries(parSource).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + p.padEnd(18) + String(n).padStart(5));
  }
  console.log('  (' + fusionnees + ' offres vues dans plusieurs sources, fusionnées)');

  {
    const parMaison = {};
    for (const o of publiables) parMaison[o.maison] = (parMaison[o.maison] || 0) + 1;
    // Le groupe des PME se compte à part : mêlé au classement, il écraserait
    // tout et on ne verrait plus quelles maisons de référence recrutent.
    const classees = Object.entries(parMaison)
      .filter(([nom]) => nom !== MAISON_AUTRES)
      .sort((a, b) => b[1] - a[1]);
    const absentes = MAISONS.filter((m) => !parMaison[m.nom]).map((m) => m.nom);
    console.log(`\n--- Maisons présentes (${classees.length} sur ${MAISONS.length}) ---`);
    for (const [nom, n] of classees) console.log('  ' + nom.padEnd(26) + String(n).padStart(5));
    if (parMaison[MAISON_AUTRES]) {
      console.log(`\n--- « ${MAISON_AUTRES} » : ${parMaison[MAISON_AUTRES]} offres ---`);
    }
    console.log(`\n--- Maisons sans aucune offre aujourd'hui (${absentes.length}) ---`);
    console.log('  ' + absentes.join(', '));
  }

  console.log('\n--- Répartition par onglet ---');
  for (const [volet, n] of Object.entries(byVolet)) console.log(`  ${volet.padEnd(10)} ${n}`);
  console.log('\n--- Répartition par famille métier ---');
  for (const famille of FAMILLES) console.log(`  ${famille.padEnd(30)} ${byFamille[famille] || 0}`);
}

run().catch((err) => {
  console.error('[pipeline] Échec :', err);
  process.exitCode = 1;
});
