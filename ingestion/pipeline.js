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
const { fetchAllSources } = require('./sources');
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

// Un canonique absent pendant ce nombre de passages consécutifs est retiré
// (PROJET.md §8.6 : "2-3 passages consécutifs").
//
// Ce compteur se mesure en PASSAGES, pas en jours : il doit suivre la fréquence
// du cron. Avec un passage quotidien, 3 passages valent trois jours de
// tolérance — de quoi encaisser une source indisponible sans vider le site.
const MAX_MISSED_RUNS = 3;

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
// pourvue, elle aurait été dépubliée — et le compteur missedRuns la sortirait du
// site en 3 passages. Sa présence vaut donc mieux qu'une date de publication.
// Couper à 30 jours ici revenait à jeter des offres vivantes : 21 des 22 postes
// finance de Thales, la totalité de PAI Partners et d'Accor. Le plafond haut ne
// sert plus qu'à écarter les zombies manifestes (Saint-Gobain laisse en ligne
// des annonces de 2018).
const MAX_AGE_JOURS = 30;
const MAX_AGE_JOURS_ATS_DIRECT = 120;

// Les sources qui republient les annonces d'autrui, par opposition à celles qui
// lisent l'ATS de la maison elle-même.
const SOURCES_AGREGATEUR_RE = /^(francetravail|adzuna|opendatasoft|labonnealternance)/;

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
const SOURCES_DATE_FIABLE_RE =
  /^(francetravail|labonnealternance|adzuna|opendatasoft|lever|greenhouse|workday|ashby|recruitee|teamtailor|smartrecruiters|oraclecloud|phenom|sitemapld|servicepublic|vie|manuel)/;

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
const FAMILLES = [
  'Comptabilité & Consolidation',
  'Contrôle de gestion & Trésorerie',
  'Audit & Conseil',
  'M&A & Marchés financiers',
  "Gestion d'actifs & Investissement",
  'Risques, Conformité & Actuariat',
  'Commercial & Relation client',
  'Data, Tech & Opérations',
  'Autres métiers de la finance',
];

// Famille fine (celle des règles) -> famille affichée.
const CONSOLIDATION_FAMILLES = {
  'Banque de détail & clientèle': 'Commercial & Relation client',
  'Assurance — distribution & sinistres': 'Commercial & Relation client',
  'Comptabilité & Consolidation': 'Comptabilité & Consolidation',
  'Contrôle de gestion & FP&A': 'Contrôle de gestion & Trésorerie',
  'Trésorerie & Financement': 'Contrôle de gestion & Trésorerie',
  'Audit & Contrôle interne': 'Audit & Conseil',
  'Conseil': 'Audit & Conseil',
  'M&A & Transaction Services': 'M&A & Marchés financiers',
  'Marchés & Front Office': 'M&A & Marchés financiers',
  "Gestion d'actifs & Wealth": "Gestion d'actifs & Investissement",
  'Risques & Conformité': 'Risques, Conformité & Actuariat',
  'Actuariat': 'Risques, Conformité & Actuariat',
  'Data & Quant': 'Data, Tech & Opérations',
  'Middle & Back Office': 'Data, Tech & Opérations',
  'Organisation & Projets': 'Data, Tech & Opérations',
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
  [/\bm&a\b|fusions?[\s-]?acquisitions?|due diligence|transaction services|corporate finance|leveraged finance|\becm\b|\bdcm\b|private equity|capital[\s-]?investissement|venture capital|\blbo\b|deal advisory|[ée]valuation d'entreprise|fund finance|buyout|co[\s-]?investment/i, 'M&A & Transaction Services'],
  [/data scien|data analyst|analyste data|\bquant\b|quantitatif|machine learning|mod[ée]lisation|\bdatavi|business intelligence|\bdata\b (?:engineer|manager|steward)/i, 'Data & Quant'],

  // --- Assurance : sinistres, contrats, distribution -----------------------
  [/sinistre|indemnisation|souscript|\biard\b|pr[ée]voyance|assurance de personnes|courtage|gestionnaire.{0,20}(?:assurance|contrat|garantie)|conseill.{0,20}assurance|assurance (?:collective|emprunteur|construction|sant[ée])|\binsurance\b/i, 'Assurance — distribution & sinistres'],

  // --- Marchés, gestion, opérations ---------------------------------------
  [/front[\s-]?office|salle des march[ée]s|trading|\btrader\b|structuration|capital market|taux et change|\bfx\b|produits d[ée]riv[ée]|march[ée]s financiers|structuring|\bpricing\b/i, 'Marchés & Front Office'],
  [/asset management|gestion d'actifs|gestion de portefeuille|\bopcvm\b|\bg[ée]rant|banque priv[ée]e|gestion priv[ée]e|wealth|gestion de patrimoine|conseill.{0,15}investissement|\binvestment\b|\besg\b|extra[\s-]?financi/i, "Gestion d'actifs & Wealth"],
  [/middle[\s-]?office|back[\s-]?office|d[ée]positaire|custody|fund admin|r[èe]glement[\s-]livraison|post[\s-]?march[ée]|cr[ée]dits? documentaires?|flux edi|\bt2s\b|succession|op[ée]rations bancaires|moyens de paiement|\bswift\b/i, 'Middle & Back Office'],

  // --- Finance d'entreprise ------------------------------------------------
  [/comptab|accounting|accountant|consolid|cl[ôo]ture comptable|r[ée]vision comptable|facturation|\bdaf\b|gestionnaire de paie|\bpaie\b|administration des ventes|\badv\b/i, 'Comptabilité & Consolidation'],
  [/contr[ôo]le de gestion|contr[ôo]leur de gestion|controlling|\bcontroller\b|\bfp&a\b|business partner|budg[ée]t|reporting financier|performance financi[èe]re|cost control|pilotage financier|contr[ôo]leur? financi|contr[ôo]leur op[ée]rations|p&l|business performance|performance op[ée]rationnelle|\balm\b|asset & liability/i, 'Contrôle de gestion & FP&A'],
  [/tr[ée]sorerie|tr[ée]sorier|treasury|cash management|financement structur|financement immobilier|charg.{0,15}financement|credit management|recouvrement|analyste cr[ée]dit|risque de cr[ée]dit|\bcr[ée]dit\b/i, 'Trésorerie & Financement'],

  // --- Audit, conseil, risques ---------------------------------------------
  [/audit|commissariat aux comptes|contr[ôo]le interne|internal control|contr[ôo]le permanent|inspection g[ée]n[ée]rale/i, 'Audit & Contrôle interne'],
  [/risque|\brisk\b|conformit[ée]|compliance|\bkyc\b|\blcb.?ft\b|blanchiment|d[ée]ontolog|s[ée]curit[ée] financi[èe]re|sanctions|fraude|contentieux|reporting r[ée]glementaire|regulatory reporting|d[ée]claratif/i, 'Risques & Conformité'],
  [/consult|conseil\b|advisory|transformation financi/i, 'Conseil'],

  // --- Analyse et recherche -------------------------------------------------
  [/analyse financi[èe]re|analyste financier|financial analyst|finance analyst|finance officer|[ée]quity research|\bresearch\b|[ée]conomist|[ée]tudes [ée]conomiques|strat[ée]giste/i, 'Marchés & Front Office'],

  // --- Organisation, MOA, projets ------------------------------------------
  [/business analyst|\bmoa\b|\bamoa\b|ma[îi]trise d'ouvrage|chef(?:fe)? de projet|product owner|organisation et projets|\bpmo\b/i, 'Organisation & Projets'],

  // --- Réseau bancaire et commercial : le plus large, donc en dernier -------
  [/conseill|charg.{0,4} (?:de client|d'affaires|de stmt)|client[èe]le|agence bancaire|banque de d[ée]tail|commercial|d[ée]veloppement|coverage|relation client|account manager|charg.{0,4} d'affaires|business development|\bagence\b/i, 'Banque de détail & clientèle'],
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

function inferFamille(title, romeLibelle) {
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

// Type de structure par employeur (heuristique — liste de départ PROJET.md §15).
// Type de structure. Le découpage précédent rangeait 446 offres sous un seul
// mot, "Banque" — or un étudiant qui vise le M&A chez Lazard et celui qui vise
// une agence de la Caisse d'Épargne ne cherchent pas la même chose. La banque
// de détail et la banque d'affaires sont deux mondes, et c'est la distinction
// la plus utile qu'on puisse offrir sur ce site.
const SECTEUR_PAR_MAISON = {
  // Banque de détail : réseaux d'agences, clientèle particuliers et pro.
  'BPCE': 'Banque de détail', 'Crédit Agricole': 'Banque de détail',
  'BNP Paribas': 'Banque de détail', 'Société Générale': 'Banque de détail',
  'Crédit Mutuel': 'Banque de détail', 'La Banque Postale': 'Banque de détail',

  // Banque d'affaires et de marchés : CIB, boutiques M&A, courtiers.
  'BNP Paribas CIB': "Banque d'affaires & marchés", 'Société Générale CIB': "Banque d'affaires & marchés",
  'Crédit Agricole CIB': "Banque d'affaires & marchés", 'Natixis': "Banque d'affaires & marchés",
  'Goldman Sachs': "Banque d'affaires & marchés", 'JPMorgan': "Banque d'affaires & marchés",
  'Morgan Stanley': "Banque d'affaires & marchés", 'Bank of America': "Banque d'affaires & marchés",
  'Citi': "Banque d'affaires & marchés", 'Barclays': "Banque d'affaires & marchés",
  'Deutsche Bank': "Banque d'affaires & marchés", 'UBS': "Banque d'affaires & marchés",
  'HSBC France': "Banque d'affaires & marchés", 'Lazard': "Banque d'affaires & marchés",
  'Rothschild & Co': "Banque d'affaires & marchés", 'Edmond de Rothschild': "Banque d'affaires & marchés",
  'Oddo BHF': "Banque d'affaires & marchés", 'Messier & Associés': "Banque d'affaires & marchés",
  'Centerview Partners': "Banque d'affaires & marchés", 'Perella Weinberg': "Banque d'affaires & marchés",
  'Kepler Cheuvreux': "Banque d'affaires & marchés",

  // Infrastructure de marché et données financières.
  'LSEG': 'Secteur public & institutions',

  // Gestion d'actifs.
  'Amundi': "Gestion d'actifs & Private equity", 'AXA IM': "Gestion d'actifs & Private equity",
  'BNP Paribas AM': "Gestion d'actifs & Private equity", 'Natixis IM': "Gestion d'actifs & Private equity",
  'Carmignac': "Gestion d'actifs & Private equity", 'Comgest': "Gestion d'actifs & Private equity",
  'Sycomore': "Gestion d'actifs & Private equity", 'Groupama AM': "Gestion d'actifs & Private equity",
  'CPR AM': "Gestion d'actifs & Private equity", 'Lazard Frères Gestion': "Gestion d'actifs & Private equity",
  "La Financière de l'Échiquier": "Gestion d'actifs & Private equity",

  // Private equity, infrastructure, capital-risque.
  'Ardian': "Gestion d'actifs & Private equity", 'Eurazeo': "Gestion d'actifs & Private equity",
  'PAI Partners': "Gestion d'actifs & Private equity", 'Tikehau': "Gestion d'actifs & Private equity",
  'Antin Infrastructure': "Gestion d'actifs & Private equity", 'Astorg': "Gestion d'actifs & Private equity",
  'Sagard': "Gestion d'actifs & Private equity", 'Andera Partners': "Gestion d'actifs & Private equity",
  'LBO France': "Gestion d'actifs & Private equity", 'IK Partners': "Gestion d'actifs & Private equity",
  'Siparex': "Gestion d'actifs & Private equity", 'Partech': "Gestion d'actifs & Private equity",
  'Alven': "Gestion d'actifs & Private equity", 'Bpifrance': "Gestion d'actifs & Private equity",

  // Assurance, mutuelles et courtage.
  'AXA': 'Assurance & mutuelles', 'Allianz France': 'Assurance & mutuelles',
  'CNP Assurances': 'Assurance & mutuelles', 'Scor': 'Assurance & mutuelles',
  'Covéa': 'Assurance & mutuelles', 'Generali France': 'Assurance & mutuelles',
  'AG2R La Mondiale': 'Assurance & mutuelles', 'Groupama': 'Assurance & mutuelles',
  'Matmut': 'Assurance & mutuelles', 'MAIF': 'Assurance & mutuelles',
  'Macif': 'Assurance & mutuelles', 'Malakoff Humanis': 'Assurance & mutuelles',
  'Marsh McLennan': 'Assurance & mutuelles',
  'Verlingue': 'Assurance & mutuelles', 'Coface': 'Assurance & mutuelles',

  // Audit, conseil, transaction services.
  'Deloitte': "Cabinet d'audit & conseil", 'EY': "Cabinet d'audit & conseil", 'KPMG': "Cabinet d'audit & conseil",
  'PwC': "Cabinet d'audit & conseil", 'Forvis Mazars': "Cabinet d'audit & conseil", 'Grant Thornton': "Cabinet d'audit & conseil",
  'BDO': "Cabinet d'audit & conseil", 'Eight Advisory': "Cabinet d'audit & conseil", 'Accuracy': "Cabinet d'audit & conseil",
  'McKinsey': "Cabinet d'audit & conseil", 'BCG': "Cabinet d'audit & conseil", 'Bain': "Cabinet d'audit & conseil",
  'Oliver Wyman': "Cabinet d'audit & conseil", 'Roland Berger': "Cabinet d'audit & conseil",
  'Sia Partners': "Cabinet d'audit & conseil", 'Talan': "Cabinet d'audit & conseil", 'Capgemini': "Cabinet d'audit & conseil",

  // Institutions publiques.
  'Banque de France': 'Secteur public & institutions', 'AMF': 'Secteur public & institutions',
  'ACPR': 'Secteur public & institutions', 'Caisse des Dépôts': 'Secteur public & institutions',
  'Agence France Trésor': 'Secteur public & institutions',

  // Fintech.
  'Qonto': 'Fintech', 'Swile': 'Fintech', 'Pennylane': 'Fintech',
  'Spendesk': 'Fintech', 'Alan': 'Fintech', 'Ledger': 'Fintech', 'Younited': 'Fintech',
};

// Employeurs hors liste de référence : on ne connaît pas leur maison, seulement
// leur raison sociale. Quelques mots suffisent à reconnaître un métier
// ("Banque de ...", "... Assurances", "Cabinet ... audit"), et tout le reste
// reçoit une étiquette honnête plutôt qu'un "Entreprise" qui ne dit rien.
//
// Le vocabulaire est le MÊME que celui de SECTEUR_PAR_MAISON : deux tables qui
// nomment différemment la même chose fabriquent des doublons dans le filtre.
const SECTEUR_PAR_MOT = [
  [/\bbanque\b|\bbank\b|caisse d.?[ée]pargne|banque populaire|cr[ée]dit (?:agricole|mutuel|coop)/i, 'Banque de détail'],
  [/asset manag|gestion d.?actifs|\bam\b$|investment manag|\bopcvm\b/i, "Gestion d'actifs & Private equity"],
  [/private equity|capital|invest(?:issement)?s?\b|\bfonds\b/i, "Gestion d'actifs & Private equity"],
  [/assurance|mutuelle|\bmutex\b|pr[ée]voyance|assureur/i, 'Assurance & mutuelles'],
  [/courtage|courtier|\bbroker\b/i, 'Assurance & mutuelles'],
  [/audit|conseil|consulting|advisory|cabinet|expertise comptable|commissariat/i, "Cabinet d'audit & conseil"],
  [/fintech|paiement|\bpay\b|neobank|n[ée]obanque/i, 'Fintech'],
  [/minist[èe]re|pr[ée]fecture|agence nationale|[ée]tablissement public|\bcnrs\b|universit[ée]|\bcaisse (?:nationale|primaire)/i, 'Secteur public & institutions'],
];

// Étiquette des employeurs qu'aucun mot ne permet de rattacher. Elle correspond
// au groupe "PME et start-ups" du filtre entreprise : les deux se lisent
// ensemble.
const SECTEUR_AUTRES = 'PME & start-up';

// Une même maison recrute dans plusieurs mondes : BNP Paribas a un réseau
// d'agences, une banque d'affaires (CIB), un gérant d'actifs (AM) et un
// assureur (Cardif). Classer toutes ses offres "Banque de détail" parce que la
// maison s'appelle BNP serait faux une fois sur trois. Quand l'employeur ou
// l'intitulé désigne l'entité qui recrute, c'est elle qui décide du type.
const ENTITE_BFI_RE =
  /\bcib\b|corporate\s*(?:&|and|et)\s*investment|banque de financement|banque d'affaires|global (?:markets|banking)|investment bank|salle des march[ée]s|\bglobal capital markets\b|\bm&a\b|fusions?[\s-]acquisitions?|\btrading\b|\btrader\b|structuration|produits d[ée]riv[ée]s/i;
const ENTITE_GESTION_RE =
  /asset management|\bam\b\s*$|gestion d'actifs|investment managers?|wealth management|banque priv[ée]e|gestion priv[ée]e|private equity|gestion de portefeuille|\bg[ée]rant\b/i;
const ENTITE_ASSURANCE_RE = /\bcardif\b|\bassurances?\b|\binsurance\b|\bpr[ée]voyance\b/i;

// Maisons multi-entités : les groupes bancaires dont le type par défaut est le
// réseau de détail. C'est pour elles seules que la détection d'entité joue —
// chez Amundi ou Deloitte, il n'y a rien à arbitrer.
const MAISONS_MULTI_ENTITES = new Set([
  'BNP Paribas', 'Société Générale', 'Crédit Agricole', 'BPCE', 'Crédit Mutuel',
  'La Banque Postale', 'Natixis', 'HSBC France',
]);

function inferSector(emp, maison, title) {
  if (maison && MAISONS_MULTI_ENTITES.has(maison)) {
    const texte = (emp || '') + ' ' + (title || '');
    if (ENTITE_GESTION_RE.test(texte)) return "Gestion d'actifs & Private equity";
    if (ENTITE_BFI_RE.test(texte)) return "Banque d'affaires & marchés";
    if (ENTITE_ASSURANCE_RE.test(emp || '')) return 'Assurance & mutuelles';
  }

  if (maison && SECTEUR_PAR_MAISON[maison]) return SECTEUR_PAR_MAISON[maison];
  // Une maison de référence absente de la table est un grand groupe industriel
  // ou de services : sa direction financière recrute des juniors, mais ce n'est
  // pas une maison de finance. Le dire évite de la ranger sous "Banque".
  if (maison) return 'Entreprise (direction financière)';
  const key = (emp || '').toLowerCase().trim();
  for (const [re, secteur] of SECTEUR_PAR_MOT) {
    if (re.test(key)) return secteur;
  }
  return SECTEUR_AUTRES;
}

// ---------------------------------------------------------------------------
// Liens intermédiaires interdits
// ---------------------------------------------------------------------------
// Sites qui s'intercalent entre le candidat et l'employeur. Y renvoyer trahit
// la promesse centrale de JJ et impose souvent un compte tiers pour postuler.
// Note : Adzuna est une SOURCE (on l'interroge par API) mais ses redirect_url
// pointent vers l'annonce d'origine — c'est bien le domaine final qui compte.
const INTERMEDIAIRE_RE =
  /jobteaser\.com|welcometothejungle\.com|welcomekit\.co|hellowork\.com|wizbii\.com|jobijoba\.com|consultor\.fr|indeed\.[a-z.]+|linkedin\.com|glassdoor\.[a-z.]+|apec\.fr|studyrama|letudiant\.fr|monster\.[a-z.]+|cadremploi\.fr|regionsjob\.com|meteojob\.com|talent\.com|jooble\.org|neuvoo|jobrapido|optioncarriere|keljob\.com|aplitrak\.com|handicap-job\.com|contactrh\.com|mytalentplug|talentplug|beetween|jobvitae|hellowork|figaro\s?emploi|profilculture|choosemycompany|engagement-jeunes|walkngo|jobteaser|placedesmetiers|emploi-collectivites/i;

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
function contientVille(libelle, ville) {
  const i = libelle.indexOf(ville);
  if (i === -1) return false;
  const avant = libelle[i - 1];
  const apres = libelle[i + ville.length];
  const estLettre = (c) => c !== undefined && /[a-zà-öø-ÿ]/.test(c);
  return !estLettre(avant) && !estLettre(apres);
}

function estGrandeVille(loc) {
  const v = (loc || '').toLowerCase().trim();
  if (!v) return true; // pas d'info -> on ne jette pas
  if (REGIONS_ET_INCONNU.some((r) => v === r || v.startsWith(r + ','))) return true;
  // Département seul : même statut qu'une région.
  if (DEPARTEMENTS.some((d) => v === d || v.startsWith(d + ','))) return true;
  // "1er Arrondissement", "13ème Arrondissement" sans le nom de la ville : ces
  // libellés ne désignent que Paris, Lyon ou Marseille — jamais un village.
  if (/^\d{1,2}\s*(er|e|ème|eme)\s+arrondissement/i.test(v)) return true;
  if (PARIS_RE.test(v)) return true;
  return [...GRAND_PARIS, ...GRANDES_VILLES].some((ville) => contientVille(v, ville));
}

// ---------------------------------------------------------------------------
// Classement dans l'onglet (volet) — déterministe (PROJET.md §8.2)
// ---------------------------------------------------------------------------
function classifyVolet({ src, typeContratRaw, title }) {
  if (src === 'labonnealternance') return 'alternance';
  if (src === 'vie') return 'vie'; // aucun connecteur VIE actif (§4.1) — pour complétude future

  const t = (typeContratRaw || '').toLowerCase();
  if (/stage|\bmis\b|internship|\bintern\b/.test(t)) return 'stage';
  if (/alternance|apprentissage|professionnalisation|apprentice/.test(t)) return 'alternance';
  if (/cdi|cdd|full[\s-]?time|permanent|fixed[\s-]?term/.test(t)) return 'cdi-cdd';

  // fallback mots-clés de l'intitulé
  const ti = (title || '').toLowerCase();
  if (/stage|stagiaire/.test(ti)) return 'stage';
  if (/alternance|alternant|apprenti/.test(ti)) return 'alternance';
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
const DESCR_SENIOR_RE = new RegExp(
  // "4 ans", "5 ans", "10 ans" d'expérience (3 ans reste dans la cible 0-3)
  `\\b([4-9]|[1-9]\\d)\\s*(?:à\\s*\\d+\\s*)?ans?\\s+(?:minimum\\s+)?d[e']\\s*exp[ée]rience|` +
    `exp[ée]rience\\s+(?:professionnelle\\s+)?(?:de\\s+)?([4-9]|[1-9]\\d)\\s*ans?|` +
    `exp[ée]rience\\s+confirm[ée]e|exp[ée]rience\\s+significative|` +
    `votre\\s+expertise|exp[ée]riment[ée]e?\\s+sur\\s+ce\\s+poste|` +
    `justifiez\\s+d[e']\\s*une\\s+exp[ée]rience\\s+(?:r[ée]ussie|confirm[ée]e|significative)`,
  'i'
);

// À l'inverse, une mention explicite d'ouverture aux débutants l'emporte.
const DESCR_JUNIOR_RE =
  /d[ée]butant[e]?s?\s+accept|jeune\s+dipl[ôo]m|premi[èe]re\s+exp[ée]rience|sans\s+exp[ée]rience|profil\s+junior|ouvert\s+aux\s+d[ée]butants/i;

// Les "candidatures spontanées" ne sont pas des offres : ce sont des
// formulaires de dépôt de CV, sans poste réel derrière. Les afficher
// reviendrait à publier des ghost jobs, exactement ce que JJ combat (§2).
const SPONTANEOUS_RE = /candidatures?\s+spontan[ée]es?|spontaneous\s+application|vivier\s+de\s+candidat|\bjob\s+test\b/i;

// Recrutement d'indépendants : agent général, mandataire, profession libérale,
// franchise. Ce ne sont pas des emplois juniors salariés mais des propositions
// de créer sa propre activité — et les assureurs les publient dupliquées
// département par département, ce qui noie les vraies offres (32 annonces AXA
// identiques à un numéro de département près). Hors périmètre de JJ.
const INDEPENDANT_RE =
  /profession\s+lib[ée]rale|agent\s+g[ée]n[ée]ral|\bmandataire\b|ind[ée]pendant|franchis[ée]|cr[ée]ateur\s+d.entreprise|auto-?entrepreneur|\bentrepreneur\s+en\b|votre\s+propre\s+(?:cabinet|agence|activit[ée])|\bVDI\b/i;

function passesJuniorFilter(volet, title, descr) {
  if (SPONTANEOUS_RE.test(title || '')) return false;
  if (INDEPENDANT_RE.test(title || '')) return false;
  if (volet !== 'cdi-cdd') return true; // stage/alternance = junior par nature
  if (SENIOR_RE.test(title)) return false;
  if (descr) {
    if (DESCR_JUNIOR_RE.test(descr)) return true; // ouverture explicite aux débutants
    if (DESCR_SENIOR_RE.test(descr)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Normalisation par source -> schéma unifié
// { emp, title, sector, famille, volet, loc, place, sal?, dl?, url, source, alsoOn? }
// ---------------------------------------------------------------------------
// Workday ne renvoie qu'un texte relatif ("Posted Today", "Posted Yesterday",
// "Posted 5 Days Ago", "Posted 30+ Days Ago") au lieu d'une date absolue.
function parseWorkdayRelativeDate(postedOn) {
  const now = new Date();
  const text = (postedOn || '').toLowerCase();
  let daysAgo = 0;
  if (/yesterday/.test(text)) daysAgo = 1;
  else {
    const match = text.match(/(\d+)\+?\s*days?\s*ago/);
    if (match) daysAgo = parseInt(match[1], 10);
  }
  now.setDate(now.getDate() - daysAgo);
  return now.toISOString();
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
  if (!titre || titre !== titre.toUpperCase()) return titre;
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
  /afterwork|after[\s-]work|webinar|webinaire|job ?dating|portes ouvertes|forum (?:de |des )?(?:recrutement|m[ée]tiers|[ée]coles)|\bsalon\b|meet ?up|conf[ée]rence|d[ée]couvrez|rejoignez[\s-]nous|candidature spontan[ée]e|talent ?pool|cooptation/i;

const METIER_HORS_PERIMETRE_RE =
  /general counsel|\bavocat|recruiter|talent acquisition|charg[ée]e? de recrutement|\binfirmi|aide[\s-]soignant|\bd[ée]veloppeur|\bdeveloper\b|devops|devsecops|software engineer|cloud engineer|network engineer|\bnetops\b|sysadmin|administrateur (?:syst|r[ée]seau)|technicien informatique|it (?:security|support|developer)|ing[ée]nieur (?:logiciel|r[ée]seaux?|cloud|syst[èe]me|infrastructure)|risques professionnels|pr[ée]vention des risques|sant[ée] au travail|\bhse\b|\bqhse\b/i;

function estUneOffreFinance(titre) {
  return !PAS_UNE_OFFRE_RE.test(titre) && !METIER_HORS_PERIMETRE_RE.test(titre);
}

function cleanTitle(title) {
  let t = decodeEntities(title || '').replace(/\s+/g, ' ').trim();

  // 1) Préfixes de contrat répétés en tête, éventuellement plusieurs fois :
  //    "Stage : Stage - Finance" -> "Finance"
  const prefixe = /^(?:stage|stagiaire|alternance|alternant|apprentissage|apprenti|internship|intern|cdi|cdd|vie|job d'?[ée]t[ée])\s*(?:de fin d'?[ée]tudes?\s*)?(?:\d+\s*mois\s*)?[:\-–—]\s*/i;
  for (let i = 0; i < 3 && prefixe.test(t); i++) t = t.replace(prefixe, '');

  // 2) Durées et dates résiduelles en tête : "6 mois - ", "- Janvier 2027 - "
  t = t.replace(/^\d+\s*mois\s*[:\-–—]\s*/i, '');

  // 3) Mentions de genre : on n'en garde aucune (redondant, alourdit la lecture)
  t = t.replace(/[\s\-–—(]*\b[hf]\s*\/\s*[hfx](?:\s*\/\s*x)?\b[)\s]*/gi, ' ');
  t = t.replace(/\((?:h|f|m)\/(?:f|h|w)\)/gi, ' ');

  // 4) Codes internes et hashtags : "#TDFE2026", "(réf. 12345)"
  t = t.replace(/#\S+/g, ' ').replace(/\(\s*r[ée]f\.?[^)]*\)/gi, ' ');

  // 5) Ponctuation résiduelle en bord
  t = t.replace(/\s+/g, ' ').replace(/^[\s:\-–—,]+|[\s:\-–—,]+$/g, '').trim();

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
  } else if (__src.startsWith('workday:')) {
    emp = item.emp;
    title = raw.title;
    ville = (raw.locationsText || '').split(',')[0].replace(/\s+area$/i, '').trim();
    pays = 'France'; // déjà filtré par FRANCE_LOCATION_RE côté connecteur
    url = raw.url;
    typeContratRaw = raw.title; // pas de sous-type dans la liste -> fallback mots-clés du titre
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
    postedAt = new Date().toISOString(); // Avature ne date pas ses fiches
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
    title = raw.title;
    // Format AXA : "75-PARIS" -> on retire le code département en préfixe.
    ville = (raw.city || '').replace(/^\d{2,3}\s*-\s*/, '').trim();
    pays = 'France';
    url = raw.apply_url || raw.meta_data?.canonical_url;
    typeContratRaw = raw.title;
    romeLibelle = (raw.categories || raw.category || []).join(' ');
    postedAt = raw.posted_date || new Date().toISOString();
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

  title = adoucirMajuscules(cleanTitle(title));
  if (!title || !url) return null;
  if (!estUneOffreFinance(title)) return null;

  // Garde-fou central : JJ promet un lien vers l'annonce de la MAISON (§2 du
  // brief). Un lien vers un job board intermédiaire (JobTeaser, Welcome to the
  // Jungle, Wizbii, Indeed...) oblige le candidat à passer par un tiers, souvent
  // derrière un compte — exactement ce qu'on reproche aux concurrents. On les
  // écarte quelle que soit la source, y compris les ajouts manuels.
  if (INTERMEDIAIRE_RE.test(url)) return null;

  const volet = classifyVolet({ src: __src, typeContratRaw, title });
  const famille = inferFamille(title, romeLibelle);
  emp = normaliserEmployeur(emp);
  const maisonRef = trouverMaison(emp);
  const sector = inferSector(emp, maisonRef, title);

  return {
    emp,
    title,
    sector,
    famille,
    volet,
    loc: nettoyerLieu(decodeEntities(ville || '').trim()) || 'Non précisé',
    // Zone d'affichage (calculée ici pour que la page n'ait pas à reconnaître
    // 300 orthographes de villes en JavaScript).
    zone: inferZone(decodeEntities(ville || '').trim()),
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
    _postedAt: postedAt || new Date().toISOString(),
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

function canonicalKey(offer) {
  return `${slug(offer.emp)}|${slugTitleFuzzy(offer.title)}|${slugLieu(offer.loc)}`;
}

// Clé sans le lieu : sert au rattrapage des offres dont une source donne la ville
// et l'autre pas. Un même poste chez une même maison publié deux fois, une fois
// localisé et une fois "Non précisé", est la même offre.
function cleSansLieu(offer) {
  return `${slug(offer.emp)}|${slugTitleFuzzy(offer.title)}`;
}

// Retire les offres sans lieu quand la même offre existe ailleurs avec un lieu.
// On garde toujours la version la plus informative pour le candidat.
function retirerSansLieuRedondantes(offers) {
  const localisees = new Set();
  for (const o of offers) {
    if (!/^non précisé$|^france$/i.test((o.loc || '').trim())) localisees.add(cleSansLieu(o));
  }
  return offers.filter(
    (o) => !(/^non précisé$|^france$/i.test((o.loc || '').trim()) && localisees.has(cleSansLieu(o)))
  );
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
    src.startsWith('sitemapld:') // fiche lue sur le site officiel = source de vérité
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
async function checkLink(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.status === 404 || res.status === 410) return 'dead';
    return 'ok';
  } catch {
    return 'unknown'; // erreur réseau transitoire -> pas de retrait (anti-faux-positif)
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

async function applyFreshnessAndDeadRemoval(offers) {
  const now = new Date().toISOString();
  const prevState = loadState();
  const nextState = {};
  const result = [];

  const seenKeys = new Set(offers.map((o) => o._key));

  for (const offer of offers) {
    const prev = prevState[offer._key];
    let linkStatus = 'unknown';
    if (CHECK_LINKS) linkStatus = await checkLink(offer.url);

    if (linkStatus === 'dead') {
      // Lien mort constaté directement -> retrait immédiat, pas d'entrée conservée.
      continue;
    }

    const firstSeenAt = prev?.firstSeenAt || now;
    nextState[offer._key] = { firstSeenAt, lastSeenAt: now, missedRuns: 0, linkStatus };

    result.push({
      ...offer,
      _firstSeenAt: firstSeenAt,
      _lastSeenAt: now,
      _linkStatus: linkStatus,
    });
  }

  // Offres connues mais absentes de ce passage : incrémente le compteur, retire
  // au-delà du seuil (marge anti-faux-positif d'une source qui déconne un jour).
  let retirees = 0;
  let enSursis = 0;
  for (const [key, prev] of Object.entries(prevState)) {
    if (seenKeys.has(key)) continue;
    const missedRuns = (prev.missedRuns || 0) + 1;
    if (missedRuns >= MAX_MISSED_RUNS) { retirees++; continue; } // retirée définitivement
    enSursis++;
    nextState[key] = { ...prev, missedRuns };
    // Note : on ne réinjecte pas l'offre complète (le contenu n'est plus connu),
    // seul le compteur est conservé pour ne pas ré-ingérer une offre expirée sans info.
  }

  saveState(nextState);
  const nouvelles = result.filter((o) => o._firstSeenAt === now).length;
  console.log(
    `[pipeline] ${nouvelles} nouvelles offres ce matin, ${retirees} retirées définitivement ` +
      `(absentes depuis ${MAX_MISSED_RUNS} passages : pourvues ou expirées), ${enSursis} en sursis.`
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
    const parMaison = {};
    let n = 0;
    for (const { o } of notes) {
      const cle = o.maison + '|' + o.emp;
      parMaison[cle] = (parMaison[cle] || 0) + 1;
      if (parMaison[cle] > 2) continue;
      retenus.add(o._key);
      if (++n >= 8) break;
    }
  }
  return retenus;
}

function writeOutput(offers) {
  const pepites = choisirPepites(offers);
  console.log(`[pipeline] ${pepites.size} offres mises en avant comme « Pépites JJ ».`);

  const publicOffers = offers.map((o) => {
    const { _key, _postedAt, _firstSeenAt, _lastSeenAt, _linkStatus, ...rest } = o;
    // firstSeenAt = date à laquelle JJ a vu cette offre pour la première fois.
    // C'est ce qui alimente le filtre "nouvelles offres" de la page : plus
    // fiable que postedAt, que certaines sources ne fournissent pas ou mal.
    return {
      ...rest,
      verifiedAt: _lastSeenAt,
      postedAt: _postedAt,
      firstSeenAt: _firstSeenAt,
      // false = la source ne date pas ses offres : _postedAt vaut la date de
      // collecte, la page ne doit donc pas l'afficher comme date de publication.
      datePubFiable: SOURCES_DATE_FIABLE_RE.test(o.source),
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
    if (t >= seuilAtsDirect) return true;
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

  const final = await applyFreshnessAndDeadRemoval(deduped);
  console.log(`[pipeline] ${final.length} offres finales après vérification de fraîcheur${CHECK_LINKS ? ' + liens' : ''}.`);

  writeOutput(final);
  console.log(
    `[pipeline] Écrit dans ${path.relative(process.cwd(), OUTPUT_PATH)}` +
      `, ${path.relative(process.cwd(), RSS_PATH)} (flux RSS) et ${path.relative(process.cwd(), SITEMAP_PATH)}.`
  );

  // Résumé par onglet et par famille
  const byVolet = {};
  const byFamille = {};
  for (const o of final) {
    byVolet[o.volet] = (byVolet[o.volet] || 0) + 1;
    byFamille[o.famille] = (byFamille[o.famille] || 0) + 1;
  }
  // Origine des offres : montre ce qu'apporte chaque source, et combien
  // d'offres ont été retrouvées dans plusieurs sources puis fusionnées.
  const parSource = {};
  for (const o of final) {
    const p = o.source.split(':')[0];
    parSource[p] = (parSource[p] || 0) + 1;
  }
  const fusionnees = final.filter((o) => o.alsoOn && o.alsoOn.length).length;
  console.log('\n--- Origine des offres ---');
  for (const [p, n] of Object.entries(parSource).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + p.padEnd(18) + String(n).padStart(5));
  }
  console.log('  (' + fusionnees + ' offres vues dans plusieurs sources, fusionnées)');

  {
    const parMaison = {};
    for (const o of final) parMaison[o.maison] = (parMaison[o.maison] || 0) + 1;
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
