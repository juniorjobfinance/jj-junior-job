// ingestion/sources.js
//
// Connecteurs de sources d'offres pour le pipeline JJ (voir PROJET.md §7 et §8).
// Chaque connecteur retourne un tableau d'offres BRUTES, au format propre à sa source
// (pas encore normalisées — c'est le rôle de pipeline.js).
//
// Tant que les identifiants ne sont pas configurés (variables d'environnement),
// les connecteurs France Travail / La Bonne Alternance ne renvoient RIEN par
// défaut (mieux vaut zéro offre qu'un lien mort). Passer DEMO_DATA=1 pour les
// faire retomber sur des données d'exemple (utile pour tester la normalisation
// et le filtre junior hors-ligne, mais ces liens d'exemple ne sont PAS réels).
//
// Les connecteurs ATS (Greenhouse, Lever, SmartRecruiters) sont de vrais appels
// HTTP publics (pas besoin de clé), activés via TARGET_COMPANIES ci-dessous —
// ils renvoient déjà de vraies offres en direct, aucune donnée d'exemple requise.

'use strict';

// Charge .env avant toute lecture de process.env (identifiants des sources).
require('./env').chargerEnv();

// Lecture/écriture du cache Avature (cf. fetchAvature).
const fs = require('fs');
const path = require('path');

const DEMO_DATA = process.env.DEMO_DATA === '1';
const { MANUAL_OFFERS } = require('./manuel');

// ---------------------------------------------------------------------------
// Utilitaire HTTP minimal (Node 18+ a fetch en global, pas de dépendance)
// ---------------------------------------------------------------------------
// Une requête qui échoue une fois n'a pas forcément échoué. Le 1er septembre
// 2026, une trentaine d'hôtes ont renvoyé « fetch failed » d'un coup sur le
// runner GitHub : aucun code HTTP, juste une connexion qui n'aboutit pas.
// Sans reprise, chacun de ces connecteurs rendait une liste vide et le
// catalogue partait en ligne amputé de 28 %.
//
// On ne réessaie que ce qui a une chance d'aboutir : une panne réseau, un
// délai dépassé, une surcharge serveur (5xx) ou un débit limité (429). Un 403
// ou un 404 sont des refus ; insister ne ferait que nous faire remarquer.
const TENTATIVES = 3;
const ATTENTES_MS = [800, 2500]; // avant la 2e, puis avant la 3e

async function fetchAvecReprise(url, options = {}) {
  // Le signal de l'appelant est écarté volontairement : un AbortSignal.timeout
  // est armé à sa création, donc déjà expiré au deuxième essai — la reprise
  // n'aurait jamais eu lieu. On en fabrique un neuf à chaque tentative.
  const { signal: _ignore, timeoutMs, ...reste } = options;
  let derniere;
  for (let essai = 0; essai < TENTATIVES; essai++) {
    if (essai > 0) await new Promise((r) => setTimeout(r, ATTENTES_MS[essai - 1]));
    try {
      const res = await fetch(url, {
        ...reste,
        signal: AbortSignal.timeout(timeoutMs || 25000),
      });
      if (res.ok) return res;
      // 5xx et 429 : le serveur est débordé, pas fâché. On laisse passer un peu.
      if (res.status >= 500 || res.status === 429) {
        derniere = new Error(`HTTP ${res.status} sur ${url}`);
        continue;
      }
      throw new Error(`HTTP ${res.status} sur ${url}`);
    } catch (err) {
      // Un refus explicite ne se réessaie pas.
      if (/^HTTP [34]\d\d/.test(err.message) && !/HTTP 429/.test(err.message)) throw err;
      derniere = err;
    }
  }
  throw derniere;
}

async function getJSON(url, options = {}) {
  const res = await fetchAvecReprise(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
  });
  return res.json();
}

// Filtre finance strict pour les ATS d'entreprises généralistes (PROJET.md §7.4) :
// une boîte comme Qonto ou Younited publie aussi des postes marketing/sales/tech,
// on ne garde que ce qui relève clairement de la finance (titre ou département).
// Attention en modifiant : ces motifs doivent reconnaître aussi bien la FONCTION
// que la PERSONNE qui l'exerce. "contrôle de gestion" seul ratait "contrôleur de
// gestion" — l'intitulé le plus répandu du métier — et "actuari" ratait
// "actuaire". Ces deux trous écartaient de vraies offres depuis le début.
const FINANCE_KEYWORDS_RE =
  /finan|comptab|accounti|accountant|tr[ée]sor|treasury|contr[ôo]l\w* de gestion|controlling|\bcontroller\b|cost control|\bfp&a\b|audit|risqu|\brisk\b|conformit|complian|actua[ir]|underwrit|souscript|sinistre|trader|trading|sales|broker|dealer|securities|prime-services|product-control|market-data|custody|settlement|collateral|derivativ|wealth|fund|actuaire|sustainab|workout|officer|coverage|origination|syndicat|leasing|factoring|depositary|depositaire|recouvrement|consolid|commissaire aux comptes|assuranc|insuranc|banqu|bancaire|\bbanking\b|\bbanker\b|\bbank\b|courtage|courtier|patrimoine|fiscalist|(?:back|middle|front)[- ]office|\bm&a\b|merger|acquisition|private equity|venture capital|asset management|gestion d.?actifs|analyste|\banalyst\b|cr[ée]dit|\bcredit\b|equity research|[ée]conomiste|economist|\bdaf\b|\bcfo\b|trad(?:er|ing)|salle des march[ée]s|march[ée]s de capitaux|capital markets|corporate finance|investment banking|\bfx\b|\bequities\b|delta one|fixed income|g[ée]ran\w* de portefeuille|portfolio manag|hedge fund|brokerage|fiscalit|transfer pricing|investisse|investor|structuration financi|\bfund\b|\bfonds\b/i;

// Contre-filtre : certains intitulés matchent un mot-clé finance par accident
// ("IT Support **Analyst**", "**Legal** Assistant", "Product **Analyst**").
// Ces métiers ne relèvent d'aucune des 9 familles de JJ (PROJET.md §4.2) —
// notamment le juridique, l'IT et le marketing, qui n'ont pas de case.
// Note : on ne bannit PAS "ingénieur"/"engineer" ni "technicien" en bloc —
// "Ingénieur financier risques" et "Technicien comptable" sont de vrais postes
// finance. On ne vise que les intitulés techniques explicites.
const NON_FINANCE_RE =
  /\bit\b|support|helpdesk|software|developer|d[ée]veloppeur|devops|sysadmin|syst[èe]me|r[ée]seau|cyber|s[ée]curit[ée] informatique|\bqa\b|testeur|test analyst|functional analyst|\bmoa\b|scrum|product owner|\bhr\b|human resources|\blegal\b|juridique|juriste|avocat|marketing|communication|\bm[ée]dia|graphiste|designer|\bux\b|\bui\b|ressources humaines|\brh\b|recrutement|talent acquisition|paie\b|payroll|logistique|maintenance|technicien de|salesforce|(?:data|analytics|systems?|platform|release train|site reliability|machine learning|cloud|security)\s+engineer|architecte logiciel/i;

// Entreprises dont le MÉTIER est la finance (banque, gestion d'actifs, private
// equity, audit, conseil financier/stratégie, assurance). Chez elles, des
// intitulés génériques comme "Consultant", "Analyste" ou "Chargé d'affaires"
// désignent bien des postes finance — alors que le même intitulé chez un
// industriel désignerait autre chose. PROJET.md §15 place explicitement le
// conseil en stratégie (McKinsey, BCG, Bain, Roland Berger) dans le périmètre.
const FINANCE_NATIVE_EMPLOYER_RE =
  /banque|bank|paribas|natixis|amundi|rothschild|lazard|ardian|eurazeo|tikehau|astorg|meridiam|partech|siparex|apax|ik partners|capital|asset management|investment|gestion|patrimoine|assurance|assurances|axa|allianz|generali|covéa|covea|groupama|\bcnp\b|\bscor\b|mutuelle|swiss ?life|ag2r|la mondiale|malakoff|humanis|matmut|\bmaif\b|macif|apicil|klesia|pro ?btp|verlingue|verspieren|deloitte|\bey\b|kpmg|\bpwc\b|mazars|grant thornton|\bbdo\b|\brsm\b|advisory|accuracy|oliver wyman|mckinsey|\bbcg\b|boston consulting|bain|roland berger|kearney|alixpartners|alvarez|sia partners|wavestone|julhiet|eight advisory|audit|conseil|consulting|partners|finance|fintech|qonto|younited|pennylane|spendesk|payfit|swile|floa|oney|cofidis|meilleurtaux|trustpair|mangopay|powens|akur8|descartes underwriting|wakam|leocare|shine|bpce|caisse d'epargne|caisse d'épargne|populaire|crédit|credit|bourso|fortuneo|palatine|coopératif|casden|\bbred\b|\bcic\b|transatlantique|march[ée]s financiers|\bamf\b|\bacpr\b|prudentiel|caisse des d[ée]p[ôo]ts|tr[ée]sor|caceis|\blcl\b|indosuez|sofinco|uptevia|euroclear|clearstream|euronext|northern trust|state street|\bbny\b|schroders|carmignac|comgest|sycomore|ostrum|candriam|mirova|\bdnca\b|tikehau|meridiam|infravia|antin|astorg|sagard|andera|lbo france|\bik\b partners|naxicap|omnes|capza|activa capital/i;

function looksLikeFinance(...fields) {
  const text = fields.filter(Boolean).join(' ');
  if (!FINANCE_KEYWORDS_RE.test(text)) return false;
  // Un signal finance FORT (comptabilité, contrôle de gestion, M&A, actuariat...)
  // l'emporte sur le contre-filtre : "Contrôleur de gestion IT" reste de la finance.
  const strongFinance =
    /comptab|accounti|accountant|contr[ôo]l\w* de gestion|controlling|\bcontroller\b|tr[ée]sor|treasury|\bm&a\b|actuari|audit financier|commissariat aux comptes|risque de cr[ée]dit|equity research|private equity|asset management|\bdaf\b|\bcfo\b|trad(?:er|ing)|investment banking|corporate finance|salle des march[ée]s|capital markets|\bfx\b|\bequities\b|delta one|\bstirt\b|d[ée]positaire|depositary|custody|conservation de titres|fund (?:execution|administration|accounting)|fixed income|collateral|collat[ée]ral|settlement|corporate actions|securities financing/i;
  // Ce signal fort doit venir de l'INTITULÉ du poste (toujours le premier champ),
  // jamais d'un libellé de rubrique passé ensuite (catégorie Adzuna, département,
  // équipe). Ces libellés sont des paniers grossiers : Adzuna range sous
  // "Accounting & Finance Jobs" tout ce qui touche de près ou de loin à la
  // finance. Le mot "accounting" du LIBELLÉ faisait donc passer n'importe quel
  // intitulé — un "Chargé de communication événementielle" chez Amundi compris —
  // en court-circuitant le contre-filtre. L'intitulé, lui, décrit le poste réel.
  // Exception à l'exception : certains mots ne qualifient pas le poste, ils le
  // NOMMENT. "Contrôleur de gestion IT" reste un contrôleur de gestion, mais un
  // "Juriste M&A" est un juriste — le M&A n'est que son domaine d'intervention,
  // et le juridique ne relève d'aucune des 9 familles de JJ. Ces métiers-là
  // l'emportent donc même sur un signal finance fort.
  const METIER_HORS_PERIMETRE_RE =
    /\bjuriste\b|\bavocat\b|\bd[ée]veloppeur\b|\bdeveloper\b|ing[ée]nieur logiciel|\bcommunity manager\b|\bcommunicant\b/i;
  if (METIER_HORS_PERIMETRE_RE.test(fields[0] || '')) return false;
  if (strongFinance.test(fields[0] || '')) return true;
  return !NON_FINANCE_RE.test(text);
}

// Intitulés génériques qui, CHEZ UNE MAISON DE FINANCE, désignent un poste
// finance (chez un industriel, ils désigneraient autre chose).
const GENERIC_FINANCE_ROLE_RE =
  /consultant|consulting|analyst|analyste|charg[ée].{0,3}d.affaires|charg[ée].{0,3}de client[èe]le|conseiller|associate|\bstage\b|\bstagiaire\b|alternan|apprenti|graduate|\bintern\b|internship|gestionnaire|\bg[ée]rant\b|souscript|actuar|banque privée|middle office|back office|front office|\bofficer\b|\bassistant\b|d[ée]positaire|depositary|custody|conservation de titres|securities|\btitres\b|fund (?:execution|administration|accounting|services)|onboarding|settlement|r[èe]glement[\s-]livraison|collateral|collat[ée]ral|fixed income|corporate actions|op[ée]rations? (?:titres|de march[ée]|[ée]metteurs?)|originat|structureur|structurat|titrisation|securitisation|equity|deriv[ée]|derivativ|leveraged|prime services|syndicat|trader|trading|coverage|activit[ée]s? de march[ée]|\bquant|mod[èe]les quantitatifs|market data|\bost\b|[ée]metteurs?|asset servicing|cash management|\bswift\b|paiements? internationaux|inspecteur|inspection|contr[ôo]le (?:permanent|interne)|contr[ôo]leur|reporting r[ée]glementaire|\bnotation\b|property manag|data scien|charg[ée].{0,4}d.[ée]tudes|transformation/i;

// Filtre finance à appliquer aux offres d'une entreprise donnée. Si l'employeur
// est une maison de finance, on élargit aux intitulés génériques du secteur ;
// sinon on s'en tient au filtre strict par mots-clés.
function isFinanceOfferFor(emp, ...fields) {
  if (looksLikeFinance(...fields)) return true;
  if (!emp || !FINANCE_NATIVE_EMPLOYER_RE.test(emp)) return false;
  const text = fields.filter(Boolean).join(' ');
  if (NON_FINANCE_RE.test(text)) return false; // un dev ou un juriste reste hors périmètre
  return GENERIC_FINANCE_ROLE_RE.test(text);
}

// ---------------------------------------------------------------------------
// 1. France Travail — API Offres d'emploi (OAuth2 client_credentials)
//    Doc : https://francetravail.io/produits-partages/catalogue/offres-emploi
//    À CÂBLER (v1) : créer une appli sur francetravail.io, scope api_offresdemploiv2,
//    récupérer un token puis interroger /partenaire/offresdemploi/v2/offres/search
//    avec codeROME + typeContrat + commune.
// ---------------------------------------------------------------------------
const FRANCE_TRAVAIL_CLIENT_ID = process.env.FRANCE_TRAVAIL_CLIENT_ID || '';
const FRANCE_TRAVAIL_CLIENT_SECRET = process.env.FRANCE_TRAVAIL_CLIENT_SECRET || '';
const FRANCE_TRAVAIL_TOKEN_URL =
  'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const FRANCE_TRAVAIL_SEARCH_URL =
  'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';

// Codes ROME finance à interroger (liste de départ — à enrichir, cf. PROJET.md §3).
const ROME_FINANCE = [
  // Banque, assurance, patrimoine (famille C)
  'C1101', // Conseil en gestion de patrimoine financier
  'C1102', // Conseil clientèle en assurances
  'C1103', // Courtage en assurances
  'C1104', // Direction d'exploitation en assurances
  'C1105', // Études actuarielles en assurances
  'C1106', // Expertise risques en assurances
  'C1107', // Indemnisations en assurances
  'C1109', // Souscription d'assurances
  'C1201', // Accueil et services bancaires
  'C1202', // Analyse de crédits et risques bancaires
  'C1203', // Relation clients bancaires
  'C1204', // Conseil clientèle en épargne
  'C1205', // Conseil en gestion de patrimoine (banque)
  'C1206', // Gestion de clientèle bancaire
  'C1207', // Management en exploitation bancaire
  'C1301', // Front office marchés financiers
  'C1302', // Gestion back et middle office marchés
  'C1303', // Gestion de portefeuilles sur marchés financiers
  // Finance d'entreprise, audit, comptabilité (famille M)
  'M1201', // Analyse et ingénierie financière
  'M1202', // Audit et contrôle comptables et financiers
  'M1203', // Comptabilité
  'M1204', // Contrôle de gestion
  'M1205', // Direction administrative et financière
  'M1206', // Management de groupe ou de service comptable
  'M1207', // Trésorerie et financement
];

async function franceTravailToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: FRANCE_TRAVAIL_CLIENT_ID,
    client_secret: FRANCE_TRAVAIL_CLIENT_SECRET,
    scope: 'api_offresdemploiv2 o2dsoffre',
  });
  const res = await fetch(FRANCE_TRAVAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`OAuth2 France Travail: HTTP ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

// L'API plafonne à 150 résultats par appel et exige une pagination par `range`
// (format "debut-fin"). Elle renvoie 206 Partial Content tant qu'il reste des
// pages, 200 sur la dernière.
async function franceTravailPage(token, params, debut, fin) {
  const url = `${FRANCE_TRAVAIL_SEARCH_URL}?${params}&range=${debut}-${fin}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (res.status === 204) return { resultats: [], fini: true }; // aucun résultat
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return { resultats: json.resultats || [], fini: res.status === 200 };
}

// France Travail et La Bonne Alternance sont débranchés depuis le 01/09/2026.
// Leurs annonces renvoient vers candidat.francetravail.fr ou vers le portail de
// l'alternance, jamais vers le site de l'employeur : la règle « 100 % direct »
// les écartait donc en fin de chaîne. Sur 192 offres France Travail, 21
// seulement portaient un lien direct — pour 27 codes métier interrogés avec
// pagination à chaque passage. Le rapport ne se justifiait plus.
//
// Ces sources apportaient surtout des employeurs inconnus : 180 de leurs 192
// offres n'étaient rattachées à aucune maison de référence. JJ se concentre
// désormais sur les grandes maisons, branchées une à une en direct.
const AGREGATEURS_PUBLICS_ACTIFS = false;

async function fetchFranceTravail() {
  if (!AGREGATEURS_PUBLICS_ACTIFS) return [];
  if (!FRANCE_TRAVAIL_CLIENT_ID || !FRANCE_TRAVAIL_CLIENT_SECRET) {
    // Pas de clé configurée -> pas d'appel réseau. On ne remonte des offres
    // d'exemple (non cliquables) que si explicitement demandé (DEMO_DATA=1).
    return DEMO_DATA ? SAMPLE_FRANCE_TRAVAIL : [];
  }

  const toutes = [];
  try {
    const token = await franceTravailToken();

    // `experience` : 1 = moins d'un an, 2 = de 1 à 3 ans, 3 = plus de 3 ans.
    // On demande 1 et 2 — c'est exactement la cible 0-3 ans du brief (§4.1),
    // filtré à la SOURCE plutôt qu'après coup.
    // On interroge code ROME par code ROME : l'API tronque les résultats quand
    // on cumule trop de critères, et cela permet de mieux couvrir chaque métier.
    // Deux passes par code ROME : la générale (expérience 0-3 ans), puis une
    // passe ALTERNANCE. Les contrats d'apprentissage (E2) et de
    // professionnalisation (FS) ont leur propre « nature de contrat » : sans la
    // demander explicitement, l'API n'en remonte presque aucun — le site
    // affichait 0 alternance France Travail alors que le vivier est là.
    const passes = [{ experience: '1,2' }, { natureContrat: 'E2,FS' }];
    for (const rome of ROME_FINANCE) {
      for (const passe of passes) {
        const params = new URLSearchParams({
          codeROME: rome,
          // Offres en France métropolitaine + DOM (pas d'offres étrangères).
          paysContinent: '01',
          ...passe,
        });

        const pageSize = 150;
        for (let debut = 0; debut < 600; debut += pageSize) {
          const { resultats, fini } = await franceTravailPage(
            token,
            params,
            debut,
            debut + pageSize - 1
          );
          toutes.push(...resultats);
          if (fini || resultats.length < pageSize) break;
        }
      }
    }
  } catch (err) {
    console.warn('[sources] France Travail indisponible :', err.message);
    return DEMO_DATA ? SAMPLE_FRANCE_TRAVAIL : [];
  }

  // Le même poste peut ressortir sur plusieurs codes ROME.
  const vus = new Set();
  return toutes
    .filter((o) => {
      if (!o.id || vus.has(o.id)) return false;
      vus.add(o.id);
      return true;
    })
    // France Travail agrège aussi les agences d'intérim et les écoles : même
    // traitement que pour Adzuna, sinon le site se remplit d'intermédiaires
    // au lieu des maisons elles-mêmes.
    .filter((o) => {
      const emp = o.entreprise?.nom || '';
      if (!emp || EMPLOYEUR_ANONYME_RE.test(emp.trim())) return false;
      return !FAUX_EMPLOYEUR_RE.test(emp);
    })
    .map((o) => ({ __src: 'francetravail', raw: o }));
}

// ---------------------------------------------------------------------------
// 1 bis. Adzuna — agrégateur légal (accords de licence avec les sources).
//    Doc : https://developer.adzuna.com — app_id + app_key gratuits.
//    Intérêt : couvre les maisons dont le site carrières est fermé (BNP,
//    Société Générale, Crédit Agricole...) sans jamais toucher à leur portail.
//    On cible la catégorie "accounting-finance-jobs" + des mots-clés junior.
// ---------------------------------------------------------------------------
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '';
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '';
const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs/fr/search';

// Sur un agrégateur, une part des "employeurs" n'en sont pas : écoles et CFA
// qui vendent une formation ("recherche pour son entreprise partenaire"), et
// cabinets de recrutement qui masquent le client. Dans les deux cas, le lien ne
// mène PAS à l'annonce de la maison — ce qui casse la promesse du §2 du brief.
// C'est le défaut n°1 relevé chez Indeed lors de l'analyse concurrentielle.
// Deux familles d'imposteurs, filtrées de la même façon :
//  - écoles / CFA qui recrutent "pour leur entreprise partenaire" ;
//  - cabinets de recrutement et intérim qui masquent leur client.
// Dans les deux cas le lien ne mène PAS à la maison qui embauche, ce qui casse
// la promesse du §2. Certains ont été identifiés à l'usage : Relais-Assur se
// présente lui-même comme "spécialiste du recrutement", Augustin Noha republie
// 2 intitulés dans 7 villes — signature classique d'un cabinet.
const FAUX_EMPLOYEUR_MOTIFS = [
  // Écoles, CFA, organismes de formation
  "\\b[ée]cole\\b", "\\bcfa\\b", 'campus', 'formation', "alternance\\s*$", "\\bapprentissage\\b",
  'ifcv', "\\bcci\\b", 'chambre de commerce', 'centre de format', 'galileo global', "\\baft\\b",
  'afpa', 'greta', 'aforp', 'promeo', 'irfa', 'iscom', 'iseg', 'ipsa', 'efrei', 'esiee', 'ynov',
  'eductive', 'omnes education', 'ecema', 'cesi\\b', 'ecoris', 'sciences-u', 'maestris', 'cerfal',
  'formaposte', 'iscod', 'studi\\b', 'cnam', 'aurlom', 'igefi', 'ifocop', 'walter learning',
  'openclassrooms', "\\bmba\\b", "\\bbts\\+", "institut\\b", "acad[ée]mie", "universit[ée]",
  "esg\\b", 'ipac', 'isefac', 'pigier', 'ascencia', 'digital college', 'groupe alternance',
  'business school', 'enaco', 'skema', 'neoma', 'kedge', 'edhec', 'essec', 'escp', 'emlyon',
  'audencia', 'inseec', 'excelia',
  // Intérim et grands réseaux de recrutement
  'adecco', 'randstad', 'manpower', 'expectra', "hays\\b", 'michael page', 'robert half',
  'walters people', 'robert walters', 'fed finance', 'fed group', 'winsearch', "lynx\\s?rh", "aquila\\s?rh",
  "ras int[ée]rim", "synergie\\b", 'proman', "crit\\b", "actual\\b", 'temporis', 'kelly services',
  'page personnel', 'approach people', 'talentpeople', 'silkhom', 'urban linker', 'externatic',
  'nextep', 'abil resources', "lincoln\\b", 'vidal associates', 'cabinet de recrutement',
  "int[ée]rim\\b", 'start people', "select t\\.?t", 'interimaires', 'talents groupe', 'le cabrh',
  "achil\\b", 'okidoki', 'gi group', 'domino rh', 'leader int', 'triangle int', 'supplay',
  'menway', "artus\\b", 'solano', 'abalone', 'samsic', 'groupe actual', 'job link', 'aeos',
  "sbc int[ée]rim", 'partnaire', 'adequat', 'ergalis', 'derichebourg int', "lhh\\b",
  'mercato de l', "r[ée]seau talents", 'peakh', 'agepac', "fed\\b", "approach\\b",
  'talent ?solutions', 'recruitment solutions', 'consulting group rh', "kelly\\b", 'nextgen rh',
  'human talents', 'talentis', 'myrecrutement', 'jobmania', 'cooptalis', 'externalis',
  // Cabinets repérés à l'usage sur les données réelles
  "relais.?assur", 'augustin noha', 'comptalents', 'dlsi', 'iziwork', 'my premium consulting',
  'linking executive', 'odas conseil', 'capijobnew', "r[ée]union comp[ée]tences",
  "rh d[ée]veloppement", 'new net 3d', 'recrut', 'staffing', 'headhunt', 'executive search',
  'mercuri urval', 'florian mantione', 'alphea', 'adsearch',
  // Un employeur dont le nom se TERMINE par « RH » est un cabinet
  // ("Cornouaille RH", "Nextgen RH") — jamais une maison de finance.
  '\\brh\\s*$',
  // Collectivités : une mairie qui recrute un chargé de prévention n'est pas
  // une maison de finance, même si l'intitulé contient « risques ».
  '^ville de ', '^mairie ', '^commune ', '^communaut[ée] de communes',
];
const FAUX_EMPLOYEUR_RE = new RegExp(FAUX_EMPLOYEUR_MOTIFS.join('|'), 'i');

// Une offre sans employeur identifié ne remplit pas la promesse de JJ : le
// candidat doit savoir chez qui il postule (le nom de la maison est le 2e
// élément de la fiche, §5 du brief). Les annonces anonymes viennent presque
// toujours de cabinets qui masquent leur client.
// Certaines sources renvoient un type de contrat à la place du nom d'entreprise
// ("Stage", "Alternance") : la donnée est inexploitable, le candidat ne saurait
// pas chez qui il postule. On écarte, comme les employeurs anonymes.
const EMPLOYEUR_ANONYME_RE =
  /^(employeur non précisé|confidentiel|entreprise confidentielle|anonyme|stage|stages|alternance|alternances|cdi|cdd|internship|apprentissage|emploi|recrutement|entreprise|société|societe|groupe|n\/?a|-{1,3})$/i;

// Requêtes ciblées : la catégorie finance seule ramène surtout du senior, on
// croise donc avec les mots-clés d'entrée de carrière.
const ADZUNA_REQUETES = [
  { what: 'stage finance' },
  { what: 'alternance finance' },
  { what: 'stage audit' },
  { what: 'alternance comptabilité' },
  { what: 'analyste financier junior' },
  { what: 'contrôleur de gestion junior' },
  { what: 'stage contrôle de gestion' },
  { what: 'alternance banque' },
  { what: 'stage M&A' },
  { what: 'junior', category: 'accounting-finance-jobs' },
  { what: 'débutant', category: 'accounting-finance-jobs' },
];

// Requêtes visant nommément les maisons dont le site carrières est fermé
// (Akamai, portail propriétaire). C'est la seule voie propre pour les avoir.
// La recherche d'Adzuna est FLOUE : chercher "Eurazeo" remonte JCDecaux ou ING,
// "Antin" remonte "Antin Résidences". D'où `employeur`, une vérification stricte
// du nom renvoyé — sans elle, on publierait des offres sous une mauvaise marque.
const ADZUNA_CIBLES = [
  { what: 'Société Générale', employeur: /^soci[ée]t[ée] g[ée]n[ée]rale/i },
  { what: 'BNP Paribas', employeur: /^bnp\s?paribas/i },
  { what: 'Morgan Stanley', employeur: /^morgan stanley/i },
  { what: 'Goldman Sachs', employeur: /^goldman sachs/i },
  { what: 'Crédit Agricole', employeur: /^cr[ée]dit agricole|^cacib/i },
  { what: 'Deloitte', employeur: /^deloitte/i },
  { what: 'KPMG', employeur: /^kpmg/i },
  { what: 'PwC', employeur: /^pwc|^pricewaterhouse/i },
  { what: 'Amundi', employeur: /^amundi/i },
  { what: 'Natixis', employeur: /^natixis|^ostrum|^mirova/i },
  // Lot 4-6 : maisons dont l'ATS est fermé mais qu'Adzuna indexe bien.
  // Les motifs sont volontairement stricts : "Scor" attrape sinon "Mercor",
  // "LVMH" remonte Sephora et des écoles, "Citi" remonte la fonction publique.
  { what: "L'Oréal", employeur: /^l'?or[ée]al/i },
  { what: 'Bpifrance', employeur: /^bpi ?france/i },
  { what: 'Scor', employeur: /^scor\b/i },
  { what: 'Barclays', employeur: /^barclays/i },
  { what: 'Citigroup', employeur: /^citi(group|bank)?$/i },
  { what: 'LVMH', employeur: /^lvmh/i },
  { what: 'Allianz', employeur: /^allianz/i },
  { what: 'Edmond de Rothschild', employeur: /^edmond de rothschild/i },
  { what: 'BNP Paribas Asset Management', employeur: /^bnp paribas asset/i },
  { what: 'TotalEnergies', employeur: /^total ?[ée]?nergies/i },
];

// Adzuna est débranché depuis le 01/09/2026. Aucun de ses liens ne menait chez
// l'employeur : ils renvoyaient tous vers adzuna.fr, où le candidat retrouvait
// une page intermédiaire affichant parfois un type de contrat faux. Le filtre
// des liens intermédiaires les écartait donc tous en fin de chaîne — autant ne
// plus appeler leur API du tout, et laisser leur quota tranquille.
//
// Le code reste en place : si JJ décidait un jour d'accepter à nouveau des
// liens indirects, il suffirait de retirer ce retour anticipé.
const ADZUNA_ACTIF = false;

async function fetchAdzuna() {
  if (!ADZUNA_ACTIF) return [];
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];

  const toutes = [];
  let echecs = 0;

  // Une requête qui échoue (quota du plan Trial, incident réseau) ne doit PAS
  // faire perdre toute la source : on isole chaque appel.
  async function interroger(what, { category, employeur } = {}) {
    for (let page = 1; page <= 3; page++) {
      try {
        const params = new URLSearchParams({
          app_id: ADZUNA_APP_ID,
          app_key: ADZUNA_APP_KEY,
          results_per_page: '50',
          what,
          'content-type': 'application/json',
        });
        if (category) params.set('category', category);

        const json = await getJSON(`${ADZUNA_BASE}/${page}?${params}`);
        const brut = json.results || [];
        // Sur une requête nominative, on ne garde que le bon employeur : la
        // recherche d'Adzuna est floue (cf. ADZUNA_CIBLES).
        const res = employeur
          ? brut.filter((o) => employeur.test((o.company?.display_name || '').trim()))
          : brut;
        toutes.push(...res);
        if (brut.length < 50) break;
      } catch (err) {
        echecs++;
        break; // page suivante inutile si celle-ci a échoué
      }
    }
  }

  // 1) Requêtes thématiques (stage finance, alternance audit...).
  for (const req of ADZUNA_REQUETES) await interroger(req.what, { category: req.category });
  // 2) Requêtes nominatives sur les maisons dont l'ATS est fermé.
  for (const cible of ADZUNA_CIBLES) await interroger(cible.what, { employeur: cible.employeur });

  if (echecs) console.warn(`[sources] Adzuna : ${echecs} requête(s) en échec (quota ?), le reste est conservé.`);
  if (toutes.length === 0) return [];

  // Les requêtes se recoupent largement : on dédoublonne sur l'identifiant.
  const vus = new Set();
  return toutes
    .filter((o) => {
      const id = String(o.id || o.redirect_url || '');
      if (!id || vus.has(id)) return false;
      vus.add(id);
      return true;
    })
    .filter((o) => {
      const emp = o.company?.display_name || '';
      return emp && !EMPLOYEUR_ANONYME_RE.test(emp.trim()) && !FAUX_EMPLOYEUR_RE.test(emp);
    })
    .filter((o) => isFinanceOfferFor(o.company?.display_name, o.title, o.category?.label))
    .map((o) => ({ __src: 'adzuna', raw: o }));
}

// ---------------------------------------------------------------------------
// 1 ter. Sitemap + JSON-LD — la voie "site officiel" pour les maisons sans ATS
//    public. Deux standards faits POUR les robots : le sitemap.xml (liste des
//    pages destinée aux crawlers) et le JSON-LD JobPosting (données structurées
//    que les sites embarquent pour Google for Jobs). Quand une maison publie
//    les deux — c'est le cas de Société Générale : 1096 offres au sitemap,
//    robots.txt n'interdisant que les répertoires techniques Drupal — on peut
//    lire ses offres SUR SON PROPRE SITE, avec un lien direct parfait.
// ---------------------------------------------------------------------------

// Pré-filtre sur le slug de l'URL : inutile de télécharger la fiche d'un
// "algo-developer" pour la jeter ensuite. On ne visite que les pages dont
// l'adresse évoque la finance ou un contrat junior.
const SLUG_FINANCE_RE =
  /financ|audit|risk|risque|complian|conformit|comptab|tresor|treasury|credit|analyst|m-?and-?a|\bm-a\b|inspecteur|actuar|asset|invest|banking|banquier|kyc|middle-office|back-office|controle|controller|patrimoine|clientele|conseiller|stage|alternan|apprenti|intern|graduate|junior|vie-|equity|research|\balm\b|quant|marche|trading|structur|portefeuille|fiscal|consolid|reporting|souscript|sinistre/i;

async function fetchSitemapJsonLd({ sitemap, emp, jobPathRe, maxFiches = 250, delayMs = 400, concurrence = 4, filtrerSlug = true }) {
  let urls;
  try {
    const res = await fetch(sitemap, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  } catch (err) {
    console.warn(`[sources] Sitemap (${emp}) indisponible:`, err.message);
    return [];
  }

  // 1) Ne garder que les fiches d'offres, pré-filtrées par slug.
  // 2) La même offre existe souvent en -fr et -en : on garde une seule langue
  //    par référence (le suffixe -XXXXXXX-fr/-en), préférence au français.
  const parRef = new Map();
  for (const u of urls) {
    if (!jobPathRe.test(u)) continue;
    // Le vocabulaire de l'adresse ne décide que si on OUVRE la fiche. Chez une
    // maison dont le sitemap tient en un millier d'entrées, mieux vaut tout
    // ouvrir : chez Société Générale ce pré-filtre écartait 40 % des fiches,
    // dont des postes de marché dont le slug est en anglais.
    if (filtrerSlug && !SLUG_FINANCE_RE.test(u)) continue;
    const ref = (u.match(/-(\w{8})-(?:fr|en)$/) || [])[1] || u;
    const estFr = /-fr$/.test(u) || /offres-d-emploi/.test(u);
    if (!parRef.has(ref) || estFr) parRef.set(ref, u);
  }
  // Le sitemap d'un groupe mondial commence souvent par l'étranger (celui de
  // Société Générale ouvre sur des dizaines de fiches new-yorkaises). Avec un
  // plafond de visites, il faut donc trier AVANT de couper : les fiches en
  // français (suffixe -fr ou vocabulaire français dans le slug) passent en
  // tête — ce sont presque toujours les postes en France.
  const scoreFr = (u) =>
    (/-fr$/.test(u) || /offres-d-emploi/.test(u) ? 2 : 0) +
    (/controleur|charge-|conseiller|tresor|comptab|alternance|stage-|juriste|risques|gestionnaire|analyste|charg-e/i.test(u) ? 1 : 0);
  const fiches = [...parRef.values()].sort((a, b) => scoreFr(b) - scoreFr(a)).slice(0, maxFiches);

  // 3) Visiter chaque fiche et lire son JSON-LD JobPosting.
  const offres = [];
  let idx = 0;
  await Promise.all(
    Array.from({ length: concurrence }, async () => {
      while (idx < fiches.length) {
        const u = fiches[idx++];
        try {
          const r = await fetch(u, {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
            signal: AbortSignal.timeout(25000),
          });
          if (!r.ok) continue;
          const html = await r.text();
          for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
            let j;
            try {
              j = JSON.parse(m[1]);
            } catch {
              continue;
            }
            const jp = (Array.isArray(j) ? j : [j]).find((x) => x && x['@type'] === 'JobPosting');
            if (!jp) continue;
            const adr = (Array.isArray(jp.jobLocation) ? jp.jobLocation[0] : jp.jobLocation)?.address || {};
            offres.push({
              titre: jp.title,
              type: jp.employmentType,
              ville: adr.addressLocality || '',
              pays: adr.addressCountry || '',
              datePosted: jp.datePosted,
              description: (jp.description || '').replace(/<[^>]*>/g, ' ').slice(0, 3000),
              organisation: jp.hiringOrganization?.name,
              url: u,
            });
            break;
          }
        } catch {
          /* fiche injoignable : on passe */
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    })
  );

  return offres
    .filter((o) => /^(fr|france)$/i.test(o.pays) || FRANCE_LOCATION_RE.test(o.ville))
    .filter((o) => isFinanceOfferFor(o.organisation || emp, o.titre))
    .map((o) => ({ __src: `sitemapld:${emp}`, emp: o.organisation || emp, raw: o }));
}

// ---------------------------------------------------------------------------
// 1 quater. Framework e-i.com (Crédit Mutuel Alliance Fédérale) — les sites de
//    recrutement CIC / Crédit Mutuel / Banque Transatlantique partagent le même
//    moteur maison. robots.txt : "Allow: /" explicite sur les trois. La liste
//    est du HTML serveur : <a href="/fr/offre.html?annonce=N">TITRE</a> suivi
//    d'un bloc ei_listdescription avec la ville. Limite connue : seule la
//    première page (~15 offres) est servie sans JavaScript — on prend ce qui
//    est accessible proprement, rien de plus.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// BNP Paribas — liste paginée du site groupe
//
// BNP ne déclare aucune fiche d'emploi dans son sitemap et son pare-feu renvoie
// 403 à curl : ni le connecteur sitemap+JSON-LD ni les sondes automatiques ne
// pouvaient l'atteindre. Le fetch de Node, lui, passe.
//
// Leur page « toutes nos offres » est rendue côté serveur et paginée par dix.
// Chaque carte porte déjà le type de contrat, l'intitulé et le lieu : on filtre
// donc la France et la finance SUR LA LISTE, sans ouvrir les 3 800 fiches du
// groupe dans le monde. On lit quelques centaines de pages au lieu de quelques
// milliers de fiches.
//
// robots.txt (vérifié) autorise ce chemin : seules les URL à paramètres
// nommés y sont interdites, « ?page= » n'en fait pas partie.
// Le principe de JJ reste « un connecteur par PLATEFORME, pas par entreprise ».
// Ce connecteur-ci est l'exception assumée : il vise les maisons majeures qui
// n'utilisent aucune plateforme connue et qu'aucune sonde ne trouve. Plutôt
// qu'un scraper par maison — autant de codes fragiles à surveiller — on décrit
// chaque site par QUELQUES PARAMÈTRES et on garde une seule mécanique. Ajouter
// une maison devient une ligne de configuration ; le jour où un site est refait,
// seule sa ligne bouge.
//
// Ce que la mécanique suppose : une page de liste rendue côté serveur, paginée
// par un paramètre d'URL, où chaque offre est un bloc portant son intitulé et
// son lieu. On filtre la France et la finance SUR LA LISTE, sans ouvrir les
// fiches — c'est ce qui rend l'exercice tenable quand un groupe publie des
// milliers d'offres dans le monde.
// Deux façons de lire une carte, selon le site :
//   - « champs » : on lit le TEXTE du bloc dans l'ordre (BNP) ;
//   - « attributs » : le bloc porte déjà les données dans ses attributs HTML
//     (Crédit Agricole et ses data-gtm-*), ce qui est plus sûr — un changement
//     de mise en page ne casse rien tant que les attributs restent.
const LISTES_HTML = [
  {
    // La Banque Postale sert sa liste depuis son serveur, quatre offres par
    // page sur trente-sept pages. Le badge « Nouveau ! » n'apparaît que sur
    // certaines cartes : lire les champs par leur rang décalait alors tout d'un
    // cran et donnait le type de contrat en guise d'intitulé. D'où la lecture
    // par motif, qui désigne chaque champ par sa place dans le balisage.
    emp: 'La Banque Postale',
    base: 'https://www.labanquepostale.com',
    page: (n) =>
      n === 1
        ? 'https://www.labanquepostale.com/candidats/offres-d-emploi/nos-offres-d-emploi.html'
        : `https://www.labanquepostale.com/candidats/offres-d-emploi/nos-offres-d-emploi.p-${n}.html`,
    blocRe: /<div class="o-jobOffer__push js-has-link">/,
    blocFin: '</article>',
    lienRe: /href="(\/candidats\/offres-d-emploi\/nos-offres-d-emploi\.job-\d+\.html[^"]*)"/,
    motifs: {
      titre: /<h3[^>]*>\s*([^<]+?)\s*<\/h3>/,
      type: /a-cat-tag--compte"[\s\S]*?<span>\s*([^<]+?)\s*<\/span>/,
      // La ville suit l'icône : elle est le texte qui vient juste après la
      // fermeture du premier <svg> de la ligne d'informations.
      lieu: /o-jobOffer__push__infos[\s\S]*?<\/svg>\s*([^<]+?)\s*<\/span>/,
    },
    // Un site franco-français : le lieu ne répète pas « France ».
    lieuLibre: true,
    maxPages: 40,
    concurrence: 2,
    delaiMs: 400,
  },
  {
    // Oddo BHF passe par Altays, dont la liste est intégrée en iframe dans leur
    // site. Les pages « stages » et « alternances » du site ne sont que des
    // vues filtrées de cette même liste (type-contrat=4) : on prend la liste
    // complète et on laisse notre propre classement trier les contrats, plutôt
    // que de dépendre de leurs filtres.
    //
    // La maison est franco-allemande et publie surtout outre-Rhin : sur
    // 220 offres, le filtre pays en retient une petite part.
    emp: 'Oddo BHF',
    base: 'https://recrutement.altays-progiciels.com',
    page: (n) => `https://recrutement.altays-progiciels.com/oddo/fr/offres.html?page=${n}`,
    blocRe: /<li[^>]+class="[^"]*jobs__detail[^"]*"[^>]*>/i,
    blocFin: '</li>',
    lienRe: /href="(\/oddo\/fr\/offres\/[^"]+\.html)/,
    // Ordre de lecture des cartes : intitulé, contrat, lieu, catégorie.
    // Le lieu change de niveau d'une offre à l'autre — « France », « PARIS
    // (75) », « Provence-Alpes-Côte d'Azur », « Allemagne » —, d'où lieuLibre.
    champs: { titre: 0, type: 1, lieu: 2 },
    lieuLibre: true,
    maxPages: 30,
    concurrence: 2,
    delaiMs: 500,
  },
  {
    emp: 'BNP Paribas',
    base: 'https://group.bnpparibas',
    // « country=7 » = France chez eux. Sans ce filtre on lisait le catalogue
    // mondial, 400 pages, pour en garder la France ; avec, 36 pages suffisent.
    page: (n) =>
      `https://group.bnpparibas/emploi-carriere/toutes-offres-emploi?country=7&page=${n}`,
    blocRe: /<article[^>]+class="[^"]*card-offer[^"]*"/i,
    blocFin: '</article>',
    lienRe: /href="(\/emploi-carriere\/offre-emploi\/[^"]+)"/,
    champs: { type: 0, titre: 1, lieu: 2 },
    // 36 pages distinctes mesurées ; au-delà leur site répète la dernière.
    maxPages: 45,
    // Lire 400 pages six par six a fini par nous faire bloquer en 403 lors
    // d'une série de passages rapprochés. Un passage par jour ne déclenche pas
    // cette limite, mais deux pages à la fois et une seconde d'attente laissent
    // une marge confortable — le passage complet reste sous les trois minutes.
    concurrence: 2,
    delaiMs: 1000,
  },
  {
    emp: 'Crédit Agricole',
    base: 'https://groupecreditagricole.jobs',
    // Pagination par chemin, pas par paramètre.
    // Leur taxonomie fait le tri à notre place. Les onze rubriques demandées,
    // relevées sur leur propre moteur (identifiant, libellé, volume) :
    //   170463 Analyse financière et économique · 170462 Assurances
    //   170464 Finances / Comptabilité / Contrôle de gestion
    //   170465 Gestion d'Actifs · 170466 Financement et Investissement
    //   170469 Conformité / Sécurité financière · 170470 Risques / Contrôles
    //   170472 Immobilier · 170473 Inspection / Audit
    //   170478 Commercial / Relations Clients · 170479 Gestion des opérations
    //
    // « Gestion des opérations » est celle qui manquait le plus : son nom ne dit
    // pas « finance », mais elle contient tout le back et middle-office titres
    // — Fund Accountant, custody, OST, collatéral, settlement.
    // Restent volontairement dehors : IT/Digital/Data, Juridique, RH,
    // Marketing, Achats, Direction générale.
    page: (n) =>
      `https://groupecreditagricole.jobs/fr/nos-offres/metiers/170463-170462-170478-170469-170466-170464-170465-170472-170470-170479-170473/localisations/79/page/${n}/`,
    blocRe: /<article[^>]+class="[^"]*card offer[^"]*"/i,
    blocFin: '</article>',
    lienRe: /href="([^"]*nos-offres-emploi\/[^"]+)"/,
    attributs: {
      titre: 'data-gtm-jobTitle',
      pays: 'data-gtm-jobCountry',
      lieu: 'data-gtm-jobCity',
      type: 'data-gtm-jobContract',
      date: 'data-gtm-jobPublishDate',
      // L'entité qui recrute : LCL, CACIB, Amundi... C'est elle qu'on affiche,
      // car un stage M&A chez CACIB n'est pas un poste en caisse régionale.
      entite: 'data-gtm-jobEntity',
    },
    // Environ 540 offres à 33 par page : 17 pages, on en lit 22 par sécurité.
    maxPages: 22,
    concurrence: 3,
    // Leur robots.txt demande 3 secondes aux agents Claude ; on s'aligne sur
    // cette courtoisie même si la règle générique ne nous l'impose pas.
    delaiMs: 3000,
  },
  {
    emp: 'Covéa',
    base: 'https://recrutement.covea.com',
    page: (n) => `https://recrutement.covea.com/jobs?page=${n}`,
    blocRe: /<a[^>]+href="\/job\//i,
    blocFin: '</a>',
    lienRe: /^([^"?]+)"/,
    lienPrefixe: '/job/',
    depuisLien: true,
    // /job/{intitulé}-in-{ville}-fr-jid-{id} : tout tient dans un seul segment,
    // dont on retire la queue technique.
    positionTitre: 1,
    nettoyerTitre: /-in-[a-z-]+-fr-jid-\d+$|-jid-\d+$/i,
    maxPages: 20,
    concurrence: 3,
  },
  {
    emp: 'Citi',
    base: 'https://jobs.citi.com',
    // Leur page « France » est rendue côté serveur et tient sur une seule page.
    // Attention : ajouter un numéro de page casse le filtre pays et fait
    // remonter le catalogue mondial — on n'en lit donc qu'une.
    page: () => 'https://jobs.citi.com/search-jobs/France/',
    blocRe: /<a[^>]+href="\/job\//i,
    blocFin: '</a>',
    lienRe: /^([^"?]+)"/,
    lienPrefixe: '/job/',
    depuisLien: true,
    // /job/{ville}/{intitulé}/{id}/{réf}
    positionTitre: 2,
    positionLieu: 1,
    maxPages: 1,
  },
  {
    emp: 'Rothschild & Co',
    base: 'https://www.rothschildandco.com',
    // Leur site français liste tout sur une page unique, sans pagination : le
    // Workday branché par ailleurs ne porte que les profils confirmés, et
    // aucune de ces 37 offres — dont les alternances — n'y figure.
    page: () => 'https://www.rothschildandco.com/fr/carrieres/profils-experimentes/nos-carrieres/',
    blocRe: /<a[^>]+href="\/fr\/carrieres\/profils-experimentes\/nos-carrieres\//i,
    blocFin: '</a>',
    lienRe: /^([^"?]+)"/,
    lienPrefixe: '/fr/carrieres/profils-experimentes/nos-carrieres/',
    depuisLien: true,
    // /fr/carrieres/profils-experimentes/nos-carrieres/{intitulé}/ : le titre
    // est le cinquième segment.
    positionTitre: 4,
    maxPages: 1,
  },
  {
    emp: 'KPMG',
    base: 'https://emplois.kpmg.fr',
    page: (n) => `https://emplois.kpmg.fr/recherche-d%27offres?p=${n}`,
    // Les cartes n'ont pas de balise propre : on découpe sur le lien lui-même,
    // dont le chemin porte déjà la ville et l'intitulé.
    blocRe: /<a[^>]+href="\/emploi\//i,
    blocFin: '</a>',
    lienRe: /^([^"]+)"/,
    lienPrefixe: '/emploi/',
    // Tout se lit dans l'adresse : /emploi/{ville}/{intitulé}/{id}/{réf}
    depuisLien: true,
    positionTitre: 2,
    positionLieu: 1,
    maxPages: 12,
    concurrence: 4,
  },
];

// Les intitulés arrivent avec les entités HTML de la source (&apos;, &amp;).
function decodeAttribut(v) {
  return (v || '')
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

// Découpe une page de liste en offres, selon la description du site.
function parseListeHtml(html, cfg) {
  const offres = [];

  // Certains sites n'entourent pas leurs offres d'une balise identifiable :
  // tout est dans l'adresse, qui porte la ville et l'intitulé
  // (/emploi/{ville}/{intitulé}/{id}/{réf}). On lit alors les liens eux-mêmes.
  if (cfg.depuisLien) {
    const vus = new Set();
    // Les liens à paramètres sont des filtres de la page, pas des offres.
    for (const m of html.matchAll(new RegExp(`href="(${cfg.lienPrefixe}[^"?]+)"`, 'g'))) {
      const chemin = m[1];
      if (vus.has(chemin)) continue;
      vus.add(chemin);
      const parts = chemin.split('/').filter(Boolean);
      // Le titre n'est pas au même rang selon les sites : troisième segment
      // chez KPMG (/emploi/{ville}/{intitulé}), dernier chez Rothschild.
      const rangTitre = cfg.positionTitre != null ? cfg.positionTitre : 2;
      if (parts.length <= rangTitre) continue;
      // L'adresse est en minuscules et sans accents : « auditeur-financier-f-h »
      // deviendrait « auditeur financier f h ». On rend une capitale initiale
      // et on retire la mention de genre, que le nettoyage général attend
      // écrite « F/H » et ne reconnaîtrait pas séparée par des espaces.
      // Une adresse ne porte ni accent ni majuscule, et colle à l'intitulé des
      // fragments techniques. On en tire le texte le plus lisible possible.
      const versTexte = (s) =>
        decodeURIComponent(s)
          // Queue technique propre à chaque site (« -in-paris-fr-jid-1113 »).
          .replace(cfg.nettoyerTitre || /(?:)/, '')
          .replace(/-/g, ' ')
          // Mention de genre éclatée par les tirets : « f h », « h f », « e ».
          .replace(/\s+[fh]\s+[hf]\s*$/i, '')
          // « charge e d etudes » : le « e » de l'écriture inclusive s'est
          // détaché de son mot en perdant sa parenthèse.
          .replace(/([a-zà-öø-ÿ])\s+e\s+(?=[a-zà-öø-ÿ])/gi, '$1 ')
          // Le type de contrat est déjà porté par la pastille de la carte, et
          // la mention de genre soudée par les tirets (« hf », « fh ») n'a plus
          // sa barre oblique pour être reconnue par le nettoyage général.
          .replace(/^\s*(?:cdd|cdi|stage|alternance)\s+/i, '')
          .replace(/\s+(?:hf|fh|hfx|mf)\b/gi, ' ')
          .replace(/\s+(?:cdd|cdi)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/^([a-zà-öø-ÿ])/, (c) => c.toUpperCase());
      offres.push({
        url: cfg.base + chemin,
        titre: versTexte(parts[rangTitre]),
        // Certains chemins portent la ville avant l'intitulé, d'autres non.
        lieu: cfg.positionLieu != null ? versTexte(parts[cfg.positionLieu]) : '',
        type: '',
      });
    }
    return offres;
  }

  if (cfg.motifs) return parseListeMotifs(html, cfg);

  const blocs = html.split(cfg.blocRe).slice(1);
  for (const b of blocs) {
    const fin = b.indexOf(cfg.blocFin);
    const bloc = fin > 0 ? b.slice(0, fin) : b;
    const href = (bloc.match(cfg.lienRe) || [])[1];
    if (!href) continue;
    const url = href.startsWith('http') ? href : cfg.base + href;

    if (cfg.attributs) {
      // Les données sont portées par les attributs du bloc : on les lit dans
      // l'en-tête de balise, qui a été coupée juste avant par le split.
      const enTete = bloc.slice(0, bloc.indexOf('>') + 1);
      const attr = (nom) => {
        const m = enTete.match(new RegExp(`${nom}="([^"]*)"`, 'i'));
        return decodeAttribut(m && m[1]);
      };
      const titre = attr(cfg.attributs.titre);
      if (!titre) continue;
      offres.push({
        url,
        titre,
        type: attr(cfg.attributs.type),
        lieu: attr(cfg.attributs.lieu),
        pays: attr(cfg.attributs.pays),
        date: attr(cfg.attributs.date),
        entite: attr(cfg.attributs.entite),
      });
      continue;
    }

    const champs = bloc
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && s !== '>');
    const lire = (i) => (i == null ? '' : champs[i] || '');
    const titre = lire(cfg.champs.titre);
    if (!titre) continue;
    // Le pays manquait à cette lecture : une maison qui l'affiche en clair sur
    // sa carte — Oddo BHF, franco-allemande, écrit « France » ou « Allemagne » —
    // ne pouvait pas être filtrée, et ses offres allemandes seraient entrées.
    offres.push({
      url,
      type: lire(cfg.champs.type),
      titre,
      lieu: lire(cfg.champs.lieu),
      pays: lire(cfg.champs.pays),
    });
  }
  return offres;
}

// Troisième façon de lire une carte : par MOTIF plutôt que par position.
// La Banque Postale affiche un badge « Nouveau ! » sur certaines offres
// seulement ; lire les champs par leur rang décalait alors tout d'un cran et
// donnait le contrat en guise d'intitulé. Chaque champ est ici désigné par
// l'endroit où il se trouve dans le balisage, ce qui ne dépend plus de la
// présence des voisins.
function parseListeMotifs(html, cfg) {
  const offres = [];
  for (const b of html.split(cfg.blocRe).slice(1)) {
    const fin = b.indexOf(cfg.blocFin);
    const bloc = fin > 0 ? b.slice(0, fin) : b;
    const href = (bloc.match(cfg.lienRe) || [])[1];
    if (!href) continue;

    const lire = (re) => {
      if (!re) return '';
      const m = bloc.match(re);
      return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
    };
    const titre = lire(cfg.motifs.titre);
    if (!titre) continue;

    offres.push({
      url: href.startsWith('http') ? href : cfg.base + href,
      titre,
      type: lire(cfg.motifs.type),
      lieu: lire(cfg.motifs.lieu),
      pays: lire(cfg.motifs.pays),
      date: lire(cfg.motifs.date),
    });
  }
  return offres;
}

async function fetchListeHtml(cfg) {
  const retenues = [];
  let echecs = 0;

  // Quelques centaines de pages lues une par une allongeaient le passage
  // quotidien de plusieurs minutes. On en lit un petit paquet en parallèle —
  // sans dépasser la courtoisie due au site, qui reste réglée par delaiMs.
  const parLot = cfg.concurrence || 1;

  for (let p = 1; p <= cfg.maxPages; p += parLot) {
    const numeros = [];
    for (let k = 0; k < parLot && p + k <= cfg.maxPages; k++) numeros.push(p + k);

    // Une page qui échoue est retentée deux fois avant d'être abandonnée : ces
    // sites limitent le débit, et un refus passager faisait perdre les deux
    // tiers du catalogue d'une maison sans la moindre erreur visible.
    const lirePage = async (n) => {
      for (let essai = 0; essai < 3; essai++) {
        try {
          const res = await fetch(cfg.page(n), {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
            signal: AbortSignal.timeout(25000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.text();
        } catch {
          // Attente croissante : 1 s, puis 3 s.
          if (essai < 2) await new Promise((r) => setTimeout(r, 1000 * (essai * 2 + 1)));
        }
      }
      echecs++;
      return null;
    };

    const pages = await Promise.all(numeros.map(lirePage));

    if (echecs >= 5 && !pages.some(Boolean)) break; // le site ne répond plus
    const lot = pages.filter(Boolean).flatMap((h) => parseListeHtml(h, cfg));
    if (!lot.length) break; // dernière page atteinte

    for (const o of lot) {
      // La France se lit soit dans un attribut « pays » dédié, soit dans le
      // libellé du lieu (« Ville, Région, Pays »).
      // Un site franco-français ne répète pas « France » dans chaque lieu : on
      // ne l'exige que là où le libellé porte le pays (BNP) ou un champ dédié.
      // Certaines listes n'ont qu'un champ de localisation, dont le niveau
      // varie d'une offre à l'autre : Oddo BHF y écrit tantôt un pays
      // (« France », « Allemagne »), tantôt une région (« Provence-Alpes-Côte
      // d'Azur »), tantôt une ville (« PARIS (75) »). Le lire comme un pays
      // faisait tomber toutes les offres parisiennes. `lieuLibre` dit qu'il
      // faut reconnaître la France à n'importe lequel de ces niveaux.
      const enFrance = cfg.lieuLibre
        ? FRANCE_LOCATION_RE.test(o.lieu || '') || REGIONS_FR_RE.test(o.lieu || '')
        : o.pays
          ? /^france$/i.test(o.pays)
          : cfg.depuisLien || /\bfrance\b/i.test(o.lieu || '');
      if (!enFrance) continue;
      // On juge la finance sur l'entité qui recrute quand elle est connue :
      // « Analyste » chez CACIB et « Analyste » chez une caisse régionale ne
      // pèsent pas pareil.
      if (!isFinanceOfferFor(o.entite || cfg.emp, o.titre)) continue;
      retenues.push(o);
    }

    // Courtoisie : une pause entre chaque page, comme pour les autres sources.
    await new Promise((r) => setTimeout(r, cfg.delaiMs || 250));
  }

  if (echecs) {
    console.warn(`[sources] Liste ${cfg.emp} : ${echecs} page(s) en échec, le reste est conservé.`);
  }
  if (!retenues.length) {
    // Un site refait ne renvoie plus rien SANS erreur : le dire évite qu'une
    // maison disparaisse en silence du catalogue.
    console.warn(`[sources] Liste ${cfg.emp} : aucune offre — structure du site peut-être modifiée.`);
  }

  return retenues.map((o) => ({ __src: `liste:${cfg.emp}`, emp: cfg.emp, raw: o }));
}

// ---------------------------------------------------------------------------
// API « BPCE jobs » — Natixis et les autres marques du groupe
//
// Leur site carrières est une application JavaScript : le HTML servi ne fait
// que 3 Ko et ne contient aucune offre. Mais la page interroge une véritable
// API JSON, bien plus solide qu'un balisage à découper — elle ne changera pas
// parce qu'un graphiste a refait une carte.
//
// Une seule requête suffit : le paramètre `size` n'est pas plafonné, et la
// réponse porte l'intitulé, la date, le contrat, le lieu, le lien ET la marque
// qui recrute (Natixis CIB France, Natixis IM...), ce qui évite de ranger un
// stage de banque de financement sous une enseigne générique.
const BPCE_APIS = [
  { host: 'https://recrutement.natixis.com', emp: 'Natixis' },
];

async function fetchBpceApi({ host, emp }) {
  let items;
  try {
    const res = await fetchAvecReprise(`${host}/app/wp-json/bpce/v1/search/jobs`, {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; JJ job board)',
        accept: 'application/json',
        'content-type': 'application/json',
      },
      // 500 laisse de la marge : ils en annonçaient 148 au moment du câblage.
      body: JSON.stringify({ size: 500 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    items = (j.data && j.data.items) || [];
  } catch (err) {
    console.warn(`[sources] API BPCE (${emp}) indisponible:`, err.message);
    return [];
  }

  // Les champs arrivent sous trois formes selon la clé : chaîne simple
  // (« Paris »), tableau de chaînes (contract, brand) ou tableau d'objets
  // (localisations, qui porte ville ET pays). On les lit chacun pour ce
  // qu'ils sont plutôt que de tenter un repli générique — c'est ce mélange
  // qui a fait tomber la première version.
  const texte = (v) => (Array.isArray(v) ? String(v[0] ?? '') : String(v ?? ''));
  const lieuDe = (o) => {
    const l = Array.isArray(o.localisations) ? o.localisations[0] : null;
    return { ville: texte(o.localisation) || (l && l.city) || '', pays: (l && l.country) || '' };
  };
  // Les liens sont des objets { url, title, target } ; la fiche publique est
  // relative au site, le lien de candidature pointe vers l'ATS.
  const lienDe = (o) => {
    const u = (o.link && o.link.url) || '';
    if (u) return u.startsWith('http') ? u : host + u;
    return (o.postulate_link && o.postulate_link.url) || '';
  };

  return items
    .filter((o) => {
      const { pays } = lieuDe(o);
      // Le groupe recrute dans le monde entier : leur champ pays vaut
      // « France » ou « International ». On ne garde que la France.
      if (pays && !/^france$/i.test(pays)) return false;
      return isFinanceOfferFor(texte(o.brand) || emp, o.title);
    })
    .map((o) => {
      const { ville } = lieuDe(o);
      return {
        __src: `bpce:${emp}`,
        emp: texte(o.brand) || emp,
        raw: {
          titre: o.title,
          lieu: ville,
          type: texte(o.contract),
          date: o.date,
          url: lienDe(o),
          description: String(o.description || ''),
        },
      };
    })
    .filter((o) => o.raw.url);
}

// ---------------------------------------------------------------------------
// McKinsey — API de recherche de leur site carrières
//
// Le conseil en stratégie était le seul étage de la hiérarchie totalement
// absent du site : aucune sonde ne trouvait McKinsey, dont la page carrières
// est une application JavaScript. Elle interroge en fait une API publique,
// repérée en listant les requêtes réellement effectuées par le navigateur.
//
// Particularité : une même offre est ouverte dans des dizaines de villes du
// monde (« Business Analyst » en liste plus de cent). On ne garde donc que
// celles dont la liste contient Paris, et on affiche Paris comme lieu.
const MCKINSEY_API =
  'https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search?pageSize=200&start=1&cities=Paris&lang=en';

async function fetchMcKinsey() {
  let docs;
  try {
    const json = await getJSON(MCKINSEY_API);
    docs = json.docs || [];
  } catch (err) {
    console.warn('[sources] McKinsey indisponible:', err.message);
    return [];
  }

  return docs
    .filter((d) => (d.cities || []).some((v) => /^paris$/i.test(String(v).trim())))
    .filter((d) => isFinanceOfferFor('McKinsey', d.title, [d.interestCategory, d.functions].flat().filter(Boolean).join(' ')))
    .map((d) => ({
      __src: 'mckinsey',
      emp: 'McKinsey',
      raw: {
        titre: d.title,
        // Date réelle de mise en ligne. Le flux la porte sous ce nom parce
        // qu'elle sert à leur diffusion LinkedIn, mais c'est bien la date de
        // publication de l'annonce — et elle révèle des postes ouverts depuis
        // 2016 que leur propre site déclare pourtant fermés.
        date: d.postedToLinkedInDate || null,
        // Nombre de villes : une même annonce peut être ouverte dans 113 villes
        // à la fois. Ce n'est plus une offre parisienne, c'est un entonnoir de
        // candidature permanent — celui-là même dont le lien renvoyait
        // « This position is no longer available ».
        nbVilles: (d.cities || []).length,
        // L'adresse se reconstruit à partir de l'intitulé sans espace ni
        // ponctuation, suivi de l'identifiant — c'est le format de leur site.
        url: `https://www.mckinsey.com/careers/search-jobs/jobs/${String(d.title)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]/g, '')}-${d.jobID}`,
        interet: [d.interestCategory, d.functions].flat().filter(Boolean).join(' '),
        description: [d.whatYouWillDo, d.yourBackground].filter(Boolean).join(' ').replace(/<[^>]*>/g, ' '),
      },
    }));
}

// ---------------------------------------------------------------------------
// Yello — job boards hébergés (EY)
//
// Le tableau d'offres est mondial : 1 767 annonces, dont 172 en France. Le
// filtre pays est un identifiant numérique propre à chaque tableau, relevé une
// fois dans la requête que la page émet quand on coche « France ».
//
// L'endpoint renvoie du JSON dont le champ `html` contient les cartes : on
// récupère donc un fragment de page, pas un objet structuré. C'est moins solide
// qu'une vraie API mais infiniment plus que de deviner des URL.
const YELLO_BOARDS = [
  {
    emp: 'EY',
    host: 'https://eyglobal.yello.co',
    board: 'c1riT--B2O-KySgYWsZO1Q',
    filtrePays: '29994', // « France » dans leur référentiel
    maxPages: 12,
  },
];

async function fetchYelloBoard(cfg) {
  const offres = [];
  const vus = new Set();

  try {
    for (let page = 1; page <= cfg.maxPages; page++) {
      const url =
        `${cfg.host}/job_boards/${cfg.board}/search` +
        `?locale=fr&query=&filters=${cfg.filtrePays}&page=${page}`;
      const res = await fetchAvecReprise(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)', accept: 'application/json' },
        signal: AbortSignal.timeout(25000),
      });
      const html = (await res.json()).html || '';

      const cartes = [...html.matchAll(
        /<a class="search-results__req_title"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
      )];
      if (!cartes.length) break;

      let nouveaux = 0;
      for (const [, href, titreBrut] of cartes) {
        const chemin = href.replace(/&amp;/g, '&');
        if (vus.has(chemin)) continue;
        vus.add(chemin);
        nouveaux++;
        const titre = titreBrut.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
        if (!titre || !isFinanceOfferFor(cfg.emp, titre)) continue;
        offres.push({
          __src: `yello:${cfg.emp}`,
          emp: cfg.emp,
          raw: { titre, url: chemin.startsWith('http') ? chemin : cfg.host + chemin },
        });
      }
      // Une page qui ne renvoie que du déjà-vu signale la fin de la liste.
      if (!nouveaux) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (err) {
    console.warn(`[sources] Yello (${cfg.emp}) indisponible:`, err.message);
  }

  return offres;
}

// ---------------------------------------------------------------------------
// Goldman Sachs — API GraphQL de leur portail « higher »
//
// C'est le sommet de ce que visent les étudiants en finance, et l'API est
// entièrement ouverte : l'introspection GraphQL fonctionne, ce qui a permis de
// découvrir le schéma sans rien deviner. Elle expose les niveaux d'expérience —
// dont EARLY_CAREER et CAMPUS, exactement le public de JJ.
//
// Le catalogue est mondial (plus de 1 300 postes) et ne propose pas de filtre
// pays fiable : on pagine et on retient la France. Sept pages suffisent.
const GS_API = 'https://api-higher.gs.com/gateway/api/v1/graphql';
const GS_QUERY =
  'query($i:RoleSearchQueryInput!){roleSearch(searchQueryInput:$i){totalCount items{' +
  'roleId jobTitle division jobType{description} locations{city country} lastPostedDate}}}';

// ---------------------------------------------------------------------------
// Eightfold — portails carrières hébergés (Morgan Stanley)
//
// Plateforme utilisée par plusieurs grandes maisons : une ligne de plus suffira
// pour la suivante. Son point d'entrée « pcsx/search » accepte une ville et un
// rayon en kilomètres, ce qui évite d'avoir à parcourir un catalogue mondial.
const EIGHTFOLD_PORTAILS = [
  {
    emp: 'Morgan Stanley',
    host: 'morganstanley.eightfold.ai',
    domain: 'morganstanley.com',
    lieu: 'Paris,  IDF,  France',
    rayonKm: 160,
  },
];

async function fetchEightfold(cfg) {
  let positions;
  try {
    const url =
      `https://${cfg.host}/api/pcsx/search?domain=${encodeURIComponent(cfg.domain)}` +
      `&query=&location=${encodeURIComponent(cfg.lieu)}` +
      `&start=0&num=100&sort_by=distance&filter_distance=${cfg.rayonKm}`;
    const json = await getJSON(url);
    positions = (json.data && json.data.positions) || json.positions || [];
  } catch (err) {
    console.warn(`[sources] Eightfold (${cfg.emp}) indisponible:`, err.message);
    return [];
  }

  return positions
    .filter((p) => isFinanceOfferFor(cfg.emp, p.name, p.department || ''))
    .map((p) => ({
      __src: `eightfold:${cfg.emp}`,
      emp: cfg.emp,
      raw: {
        titre: p.name,
        ville: (p.locations && p.locations[0]) || 'Paris',
        url: `https://${cfg.host}/careers?domain=${cfg.domain}&pid=${p.id}`,
        departement: p.department,
        date: p.postedTs ? new Date(p.postedTs * 1000).toISOString() : null,
      },
    }));
}

// ---------------------------------------------------------------------------
// Bank of America — servlets de recherche de leur site carrières
//
// Deux points d'entrée cohabitent : « campus » pour les stages et programmes
// jeunes diplômés, et le servlet général pour tous les contrats. On interroge
// les deux et le dédoublonnage fait le reste — une offre présente des deux
// côtés n'apparaît qu'une fois.
const BOFA_SERVLETS = ['campusjobssearchservlet', 'jobssearchservlet'];
const BOFA_VILLES = ['Paris, France'];

async function fetchBankOfAmerica() {
  const parId = new Map();

  for (const servlet of BOFA_SERVLETS) {
    for (const ville of BOFA_VILLES) {
      try {
        const url =
          `https://careers.bankofamerica.com/services/${servlet}` +
          `?start=0&rows=200&search=jobsByLocation&searchstring=${encodeURIComponent(ville)}&`;
        const json = await getJSON(url);
        for (const o of json.jobsList || []) {
          const id = o.jobRequisitionId || o.jcrURL;
          if (id && !parId.has(id)) parId.set(id, o);
        }
      } catch (err) {
        console.warn(`[sources] Bank of America (${servlet}) indisponible:`, err.message);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return [...parId.values()]
    .filter((o) => isFinanceOfferFor('Bank of America', o.postingTitle, o.division || o.family || ''))
    .map((o) => ({
      __src: 'bofa',
      emp: 'Bank of America',
      raw: {
        titre: o.postingTitle,
        ville: 'Paris',
        url: o.jcrURL ? `https://careers.bankofamerica.com${o.jcrURL}` : null,
        division: [o.division, o.family].filter(Boolean).join(' '),
        date: o.postedDate || null,
      },
    }))
    .filter((o) => o.raw.url);
}

async function fetchTousEightfold() {
  const lots = await Promise.all(EIGHTFOLD_PORTAILS.map((c) => fetchEightfold(c).catch(() => [])));
  return lots.flat();
}

async function fetchGoldmanSachs() {
  const retenues = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetchAvecReprise(GS_API, {
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; JJ job board)',
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          query: GS_QUERY,
          variables: {
            i: {
              page: { pageSize: 200, pageNumber: page },
              experiences: ['EARLY_CAREER', 'CAMPUS', 'PROFESSIONAL'],
              filters: [],
              searchTerm: '',
            },
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 120));
      const items = json.data.roleSearch.items || [];
      if (!items.length) break;
      retenues.push(...items.filter((o) => (o.locations || []).some((l) => /^france$/i.test(l.country || ''))));
      if (items.length < 200) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    console.warn('[sources] Goldman Sachs indisponible:', err.message);
  }

  return retenues
    .filter((o) => isFinanceOfferFor('Goldman Sachs', o.jobTitle, o.division || ''))
    .map((o) => ({
      __src: 'goldman',
      emp: 'Goldman Sachs',
      raw: {
        titre: o.jobTitle,
        // « 2027 | EMEA | Paris | Investment Banking, Classic | Seasonal » :
        // les segments de tête ne sont que du contexte géographique.
        division: o.division,
        ville: (o.locations || []).map((l) => l.city).filter(Boolean)[0] || 'Paris',
        url: `https://higher.gs.com/roles/${o.roleId}`,
        date: o.lastPostedDate,
        type: (o.jobType && o.jobType.description) || '',
      },
    }));
}

async function fetchTousYello() {
  const lots = await Promise.all(YELLO_BOARDS.map((c) => fetchYelloBoard(c).catch(() => [])));
  return lots.flat();
}

// Chaque enseigne a son entrée au magasin, plutôt qu'un lot commun : si
// Rothschild tombe, BNP et le Crédit Agricole ne doivent pas être repris avec
// lui. C'est aussi ce grain qui permettra de les récolter à des heures
// différentes — BNP et Rothschild à 7h, le Crédit Agricole à 8h.
async function fetchToutesApisBpce(recoltes = {}) {
  const taches = BPCE_APIS.map((c) => () => recolter(`bpce:${c.emp || c.host}`, recoltes, () => fetchBpceApi(c)));
  return (await enFile(taches, 3)).flat();
}

async function fetchToutesListesHtml(recoltes = {}) {
  const taches = LISTES_HTML.map((c) => () => recolter(`liste:${c.emp}`, recoltes, () => fetchListeHtml(c)));
  // Deux à la fois : ces listes se paginent, chaque page est une requête, et
  // BNP nous avait déjà répondu 403 pour avoir trop insisté.
  return (await enFile(taches, 2)).flat();
}

function parseCartesEiCards(html) {
  const offres = [];
  const vus = new Set();
  const re = /href="(\/fr\/offre\.html\?annonce=(\d+))"[^>]*>([^<]+)<\/a>([\s\S]{0,1200}?)<\/ul>/g;
  let m;
  while ((m = re.exec(html))) {
    if (vus.has(m[2])) continue;
    vus.add(m[2]);
    const items = [...m[4].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) =>
      x[1].replace(/<[^>]*>/g, '').replace(/&#\d+;/g, (e) => String.fromCharCode(parseInt(e.slice(2, -1), 10))).replace(/\s+/g, ' ').trim()
    );
    // La ville est l'entrée du type "PARIS (75)".
    const ville = (items.find((t) => /\(\d{2,3}\)/.test(t)) || '').replace(/\s*\(\d+\)\s*/, '').trim();
    const contrat = items.find((t) => /cdi|cdd|stage|alternance|apprentissage/i.test(t)) || '';
    offres.push({
      title: m[3].replace(/&#\d+;/g, (e) => String.fromCharCode(parseInt(e.slice(2, -1), 10))).replace(/\s+/g, ' ').trim(),
      url: `https://${'PLACEHOLDER'}${m[1]}`,
      ville,
      contrat,
    });
  }
  return offres;
}

// Ce moteur (utilisé aussi par le CIC et la Banque Transatlantique) n'expose
// qu'une seule page par URL : « ?p=2 » est silencieusement ignoré et renvoie
// le même contenu que la page 1, tout comme « ?motscles=finance ». La page
// affiche un bouton « Afficher plus d'offres », mais il soumet un formulaire
// POST portant des dizaines de champs cachés liés à l'état de la session —
// pas un paramètre qu'on puisse reconstruire de l'extérieur sans un vrai
// navigateur. Le Crédit Mutuel compte plus de 500 offres au total ; on n'en
// voit que la première page (15), très majoritairement des postes de réseau
// qu'on écarte de toute façon. C'est une limite du site, pas du connecteur.
async function fetchEiCards({ host, emp }) {
  let html;
  try {
    const res = await fetch(`https://${host}/fr/nos_offres.html`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.warn(`[sources] e-i (${host}) indisponible:`, err.message);
    return [];
  }

  return parseCartesEiCards(html)
    .map((o) => ({ ...o, url: o.url.replace('PLACEHOLDER', host) }))
    .filter((o) => isFinanceOfferFor(emp, o.title))
    .map((o) => ({ __src: `eicards:${host}`, emp, raw: o }));
}

// ---------------------------------------------------------------------------
// 2. La Bonne Alternance — API publique (alternance)
//    ⚠️ L'API a migré vers api.apprentissage.beta.gouv.fr et nécessite désormais
//    un compte + token d'accès (elle n'est plus anonyme comme le supposait le
//    brief initial). Portail : https://api.apprentissage.beta.gouv.fr/
//    À CÂBLER (v1) : créer un compte, récupérer un token, l'endpoint exact est
//    documenté sous "Job / jobSearch" dans la doc technique du portail.
// ---------------------------------------------------------------------------
const LBA_API_TOKEN = process.env.LBA_API_TOKEN || '';
const LBA_SEARCH_URL = 'https://api.apprentissage.beta.gouv.fr/api/job/v1/search';

// L'API plafonne à 150 résultats PAR SOURCE (LBA / France Travail / partenaires),
// soit 450 par requête, sans pagination possible. Pour couvrir la France on
// interroge donc département par département sur les principaux bassins
// d'emploi finance — c'est le seul moyen d'aller au-delà du plafond.
// Tous les départements métropolitains : l'alternance finance existe partout,
// et le plafond de 150 résultats par source impose de découper finement.
// (Le filtre "grandes villes" du pipeline fera le tri géographique ensuite.)
const LBA_DEPARTEMENTS = [
  '75', '92', '93', '94', '91', '78', '95', '77', // Île-de-France d'abord
  ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')).filter(
    (d) => !['75', '92', '93', '94', '91', '78', '95', '77', '20'].includes(d)
  ),
  '2A', '2B', // Corse
];

async function fetchLaBonneAlternance() {
  if (!AGREGATEURS_PUBLICS_ACTIFS) return [];
  if (!LBA_API_TOKEN) {
    return DEMO_DATA ? SAMPLE_LBA : [];
  }

  const toutes = [];
  let echecs = 0;

  // Une requête par département : un échec isolé (quota, incident) ne doit pas
  // faire perdre toute la source.
  for (const dep of LBA_DEPARTEMENTS) {
    try {
      const params = new URLSearchParams({ romes: ROME_FINANCE.join(',') });
      params.append('departements', dep);
      const json = await getJSON(`${LBA_SEARCH_URL}?${params}`, {
        headers: { authorization: `Bearer ${LBA_API_TOKEN}` },
      });
      toutes.push(...(json.jobs || []));
    } catch {
      echecs++;
    }
  }

  if (echecs) {
    console.warn(`[sources] La Bonne Alternance : ${echecs} département(s) en échec, le reste est conservé.`);
  }

  // Le même poste ressort sur plusieurs départements limitrophes.
  const vus = new Set();
  return toutes
    .filter((o) => {
      const id = o.identifier?.id || o.apply?.url || '';
      if (!id || vus.has(id)) return false;
      vus.add(id);
      return true;
    })
    // L'API agrège aussi France Travail : on écarte ce qu'on ingère déjà en
    // direct, et surtout les intermédiaires (le lien doit mener à l'employeur).
    .filter((o) => {
      const emp = o.workplace?.brand || o.workplace?.legal_name || o.workplace?.name || '';
      return emp && !EMPLOYEUR_ANONYME_RE.test(emp.trim()) && !FAUX_EMPLOYEUR_RE.test(emp);
    })
    .map((o) => ({ __src: 'labonnealternance', raw: o }));
}

// ---------------------------------------------------------------------------
// 3. ATS direct — un connecteur PAR TYPE d'ATS (PROJET.md §7.4)
//    On ajoute juste le token/tenant de chaque maison dans TARGET_COMPANIES.
// ---------------------------------------------------------------------------

// Entreprises confirmées EN DIRECT (endpoint testé manuellement, retourne de
// vraies offres à la date de câblage) :
// - Qonto, Younited (Lever)
// - LVMH (SmartRecruiters — profil e-commerce/retail, pas toujours de finance dessus)
// - Sanofi, Airbus, Air Liquide (Workday — cf. fetchWorkday ci-dessous)
// - Groupe BPCE (OpenDataSoft — cf. fetchOpenDataSoft ci-dessous). BPCE publie
//   TOUTES ses offres (Banque Populaire, Caisse d'Épargne, Natixis...) en open
//   data officiel, mis à jour 4x/jour : https://bpce.opendatasoft.com — le cas
//   idéal, aucune rétro-ingénierie requise.
// Sondées mais SANS accès public trouvé (portails fermés/propriétaires ou
// backend propriétaire non documenté) : TotalEnergies et L'Oréal (Oracle
// Taleo), Hermès, Safran, Schneider Electric, Crédit Agricole, AXA. BNP Paribas
// et Société Générale ont un vrai moteur de recherche riche (facettes finance,
// localisation) mais BNP est protégé par un pare-feu anti-bot (Akamai, 403 sur
// tout accès non-navigateur) et SG tourne sur un backend propriétaire (CES/
// Quantum) dont le format de requête exact n'a pas pu être établi de façon
// fiable sans risquer un connecteur silencieusement cassé. Pour celles-là, on
// les rattrape via France Travail une fois la clé obtenue (PROJET.md §7.4).
const TARGET_COMPANIES = {
  // NOTE : chaque entrée ci-dessous a été VÉRIFIÉE avec ingestion/verifier-ats.js
  // (le nom réel renvoyé par la plateforme correspond bien à l'entreprise visée).
  // Le détecteur seul produit beaucoup de faux positifs sur les slugs courts :
  // "air" -> une société italienne, "bcg" -> "Bohen Consulting Group",
  // "oliver" -> "OLIVER Agency", "cic" -> des postes à Tokyo. Ne jamais ajouter
  // une ligne sortie du détecteur sans l'avoir passée au vérificateur.
  greenhouse: [
    { token: 'creditagricolecib', emp: 'Crédit Agricole CIB' },
    { token: 'forvismazars', emp: 'Forvis Mazars' },
    { token: 'alixpartners', emp: 'AlixPartners' },
    { token: 'dataiku', emp: 'Dataiku' },
    { token: 'shifttechnology', emp: 'Shift Technology' },
    { token: 'doctolib', emp: 'Doctolib' },
    { token: 'algolia', emp: 'Algolia' },
    { token: 'mirakl', emp: 'Mirakl' },
    { token: 'sesamm', emp: 'Sesamm' },
    { token: 'silvr', emp: 'Silvr' },
    { token: 'capco', emp: 'Capco' },
    { token: 'n26', emp: 'N26' },
  ],
  lever: [
    { company: 'qonto', emp: 'Qonto' },
    { company: 'younited', emp: 'Younited' },
    { company: 'swile', emp: 'Swile' },
    { company: 'ledger', emp: 'Ledger' },
    { company: 'pigment', emp: 'Pigment' },
    { company: 'agicap', emp: 'Agicap' },
    { company: 'veepee', emp: 'Veepee' },
    { company: 'contentsquare', emp: 'Contentsquare' },
    { company: 'brevo', emp: 'Brevo' },
    { company: 'blablacar', emp: 'BlaBlaCar' },
  ],
  smartrecruiters: [
    // Rexel : distribution professionnelle, direction financière et SI finance.
    { id: 'REXEL1', emp: 'Rexel' },
    { id: 'lvmh', emp: 'LVMH' },
    { id: 'Accor', emp: 'Accor' },
    { id: 'sia', emp: 'Sia Partners' },
    { id: 'rolandberger', emp: 'Roland Berger' },
    { id: 'sodexo', emp: 'Sodexo' },
    { id: 'colliers', emp: 'Colliers France' },
    { id: 'altarea', emp: 'Altarea' },
    { id: 'meilleurtaux', emp: 'Meilleurtaux' },
    { id: 'nexity', emp: 'Nexity' },
    { id: 'julhietsterwen', emp: 'Julhiet Sterwen' },
    { id: 'sycomoreassetmanagement', emp: 'Sycomore Asset Management' },
    { id: 'saintgobain', emp: 'Saint-Gobain' },
    { id: 'believe', emp: 'Believe' },
    { id: 'boulanger', emp: 'Boulanger' },
    { id: 'dailymotion', emp: 'Dailymotion' },
    { id: 'revaia', emp: 'Revaia' },
    { id: 'intermarche', emp: 'Intermarché' },
    { id: 'coface', emp: 'Coface' },
    { id: 'mazars', emp: 'Forvis Mazars France' },
    { id: 'louisdreyfuscompany', emp: 'Louis Dreyfus Company' },
    { id: 'vitol', emp: 'Vitol' },
    { id: 'akuo', emp: 'Akuo Energy' },
    { id: 'talan', emp: 'Talan' },
    { id: 'vattenfall', emp: 'Vattenfall' },
    { id: 'wise', emp: 'Wise' },
    { id: 'lorealgroup', emp: "L'Oréal" },
    { id: 'tpicap', emp: 'TP ICAP' },
    { id: 'tradition', emp: 'Tradition' },
    { id: 'tikehaucapital', emp: 'Tikehau Capital' },
    { id: 'cegid', emp: 'Cegid' },
  ],
  // Détectés avec ingestion/detect-workday.js (le tenant, le datacenter et le
  // nom du site sont propres à chaque entreprise, aucun n'est devinable).
  workday: [
    // Deutsche Bank : son site carrières est rendu en JavaScript, mais son API
    // de recherche révèle que les candidatures partent vers Workday, tenant
    // « db », site « DBWebsite ». Deux postes parisiens seulement — c'est leur
    // réalité, pas un défaut du connecteur.
    { tenant: 'db', dc: 'wd3', site: 'DBWebsite', emp: 'Deutsche Bank' },
    // Ipsen : laboratoire pharmaceutique, mais sa direction financière recrute
    // des stagiaires en relations investisseurs et en M&A. Le filtre finance
    // écarte de lui-même le médical et le marketing, majoritaires chez eux.
    { tenant: 'ipsen', dc: 'wd103', site: 'Ipsen_Careers', emp: 'Ipsen' },
    // CDPQ, le fonds de pension québécois, a un bureau parisien qui recrute
    // des stagiaires en investissement et en infrastructures. Le filtre
    // géographique du pipeline écarte de lui-même les postes de Montréal.
    { tenant: 'cdpq', dc: 'wd10', site: 'CDPQ-recrutement-universitaire', emp: 'CDPQ' },
    // Deloitte : audit, actuariat, transaction services, M&A. Son tenant
    // Workday s'appelle « fina », que rien ne relie au nom de la maison —
    // impossible à deviner, il fallait un lien d'annonce pour le connaître.
    { tenant: 'fina', dc: 'wd103', site: 'DeloitteRecrute', emp: 'Deloitte' },
    // Rothschild & Co expose son portail « Lateral » sur Workday, que rien ne
    // reliait au reste de nos sources : quarante postes, dont les alternances
    // parisiennes, n'étaient donc jamais vus.
    { tenant: 'rothschildandco', dc: 'wd3', site: 'RothschildAndCo_Lateral', emp: 'Rothschild & Co' },
    // La Banque de France : analystes financiers d'entreprises, modèles de
    // risque, back-office des opérations de marché. Le nom de son site Workday
    // ne se devine pas — huit variantes testées avant qu'un lien d'annonce ne
    // le donne. Elle peuple à elle seule « Institution publique & régulateur ».
    { tenant: 'bdf', dc: 'wd103', site: 'recrutement-banque-de-France', emp: 'Banque de France' },
    // Euronext, opérateur de la Bourse de Paris : infrastructure de marché,
    // compensation, données financières. Cinq postes français au moment du
    // branchement.
    { tenant: 'hrhub', dc: 'wd3', site: 'Euronext_Career_Page', emp: 'Euronext' },
    { tenant: 'sanofi', dc: 'wd3', site: 'SanofiCareers', emp: 'Sanofi' },
    { tenant: 'ag', dc: 'wd3', site: 'Airbus', emp: 'Airbus' },
    { tenant: 'airliquidehr', dc: 'wd3', site: 'AirLiquideExternalCareer', emp: 'Air Liquide' },
    { tenant: 'thales', dc: 'wd3', site: 'Careers', emp: 'Thales' },
    { tenant: 'michelinhr', dc: 'wd3', site: 'Michelin', emp: 'Michelin' },
    { tenant: 'ardian', dc: 'wd103', site: 'ArdianCareers', emp: 'Ardian' },
    { tenant: 'rothschildandco', dc: 'wd3', site: 'Rothschildandco_Lateral', emp: 'Rothschild & Co' },
    // MMC = Marsh McLennan : porte Oliver Wyman, Mercer, Marsh et Guy Carpenter.
    { tenant: 'mmc', dc: 'wd1', site: 'MMC', emp: 'Marsh McLennan' },
    { tenant: 'morningstar', dc: 'wd5', site: 'Morningstar', emp: 'Morningstar' },
    { tenant: 'lseg', dc: 'wd3', site: 'Careers', emp: 'LSEG' },
    // Ces deux tenants sont mondiaux et n'ont pas de niveau "pays" : le
    // connecteur coche les villes françaises de la facette lieux.
    { tenant: 'pwc', dc: 'wd3', site: 'Global_Experienced_Careers', emp: 'PwC' },
    // Le portail « Campus » porte les stages et jeunes diplômés — la cible de JJ.
    // Seul celui des expérimentés était branché.
    { tenant: 'pwc', dc: 'wd3', site: 'Global_Campus_Careers', emp: 'PwC' },
    { tenant: 'accenture', dc: 'wd103', site: 'accentureCareers', emp: 'Accenture' },
    { tenant: 'ms', dc: 'wd5', site: 'External', emp: 'Morgan Stanley' },
    { tenant: 'kering', dc: 'wd3', site: 'kering', emp: 'Kering' },
    // Maisons du haut de la hiérarchie, trouvées par le sondeur grands comptes.
    // Elles n'ont pas d'identifiant devinable : leur tenant Workday a dû être
    // sondé motif par motif.
    { tenant: 'ag2rlamondiale', dc: 'wd3', site: 'Candidats', emp: 'AG2R La Mondiale' },
    { tenant: 'swisslife', dc: 'wd3', site: 'Swiss_Life_Division_France_Career_Site', emp: 'Swiss Life France' },
    { tenant: 'pjtpartners', dc: 'wd1', site: 'Careers', emp: 'PJT Partners' },
    // Un même tenant Workday héberge souvent DEUX sites : l'un pour les postes
    // expérimentés, l'autre pour les étudiants — et c'est le second qui nous
    // intéresse le plus. Nous n'interrogions que le premier, si bien que les
    // summer analyst et les off-cycle, cœur de cible de JJ, restaient
    // invisibles. Un balayage des 22 tenants a montré que deux maisons sont
    // dans ce cas ; à vérifier pour chaque maison ajoutée désormais.
    { tenant: 'pjtpartners', dc: 'wd1', site: 'Students', emp: 'PJT Partners' },
    { tenant: 'hl', dc: 'wd1', site: 'External', emp: 'Houlihan Lokey' },
    // Houlihan Lokey expose un TROISIÈME site, « Lateral », que rien ne
    // reliait aux deux autres.
    { tenant: 'hl', dc: 'wd1', site: 'Lateral', emp: 'Houlihan Lokey' },
    // MUFG, banque japonaise : financement de projets, leveraged finance,
    // risque de crédit à Paris. Que des postes seniors au branchement — le
    // connecteur se remplira quand ils publieront des juniors.
    { tenant: 'mufgub', dc: 'wd3', site: 'MUFG-Careers', emp: 'MUFG' },
    { tenant: 'hl', dc: 'wd1', site: 'Campus', emp: 'Houlihan Lokey' },
    { tenant: 'blackrock', dc: 'wd1', site: 'BlackRock_Professional', emp: 'BlackRock' },
    { tenant: 'santander', dc: 'wd3', site: 'santanderCareers', emp: 'Santander' },
    { tenant: 'statestreet', dc: 'wd1', site: 'Global', emp: 'State Street' },
    { tenant: 'bbva', dc: 'wd3', site: 'bbva', emp: 'BBVA' },
    { tenant: 'juliusbaer', dc: 'wd3', site: 'External', emp: 'Julius Baer' },
  ],
  opendatasoft: [
    { domain: 'bpce.opendatasoft.com', dataset: 'groupe-bpce-offres-emploi', emp: 'Groupe BPCE' },
  ],
  // Recruitee : ATS très répandu chez les fonds/boutiques françaises.
  // Endpoint public testé : https://{company}.recruitee.com/api/offers/
  // Cornerstone OnDemand : ATS de plusieurs sociétés de gestion et fonds.
  // Le « tenant » est le sous-domaine csod.com, lisible dans l'URL du site
  // carrières (https://eurazeo.csod.com -> tenant « eurazeo »).
  cornerstone: [{ tenant: 'eurazeo', siteId: 1, emp: 'Eurazeo' }],

  // WordPress REST : le site carrières est un WordPress, les offres un type
  // d'article. Le « host » suffit ; « type » vaut « offre » par défaut.
  wordpress: [
    { host: 'https://caissedesdepots-recrute.fr', emp: 'Caisse des Dépôts' },
  ],

  recruitee: [
    { company: 'ikpartners', emp: 'IK Partners' },
    { company: 'meridiam', emp: 'Meridiam' },
    { company: '8advisory', emp: 'Eight Advisory' },
    { company: 'akur8', emp: 'Akur8' },
    { company: 'geodis', emp: 'Geodis' },
    { company: 'sellsy', emp: 'Sellsy' },
    { company: 'qare', emp: 'Qare' },
    { company: 'grantthornton', emp: 'Grant Thornton' },
    { company: 'getlink', emp: 'Getlink' },
    { company: 'paipartners', emp: 'PAI Partners' },
    { company: 'tikehaucapital', emp: 'Tikehau Capital' },
  ],
  // Oracle Cloud HCM (Fusion Recruiting) : utilisé par beaucoup de grands
  // groupes français. Endpoint public testé (aucune clé) :
  //   /hcmRestApi/resources/latest/recruitingCEJobRequisitions
  // Le "host" est le tenant Oracle de l'entreprise (visible dans l'URL de
  // candidature de leur site carrières), "site" est le siteNumber (CX_1, CX_2...).
  oraclecloud: [
    // Schroders, gestion d'actifs britannique, bureau de Paris.
    { host: 'ekbq.fa.em2.oraclecloud.com', site: 'CX_2', emp: 'Schroders' },
    // Scor, quatrième réassureur mondial : actuariat, risques, modélisation.
    { host: 'fa-errt-saasfaprod1.fa.ocs.oraclecloud.com', site: 'CX_2001', emp: 'Scor' },
    // Edmond de Rothschild : banque privée et gestion d'actifs. Son portail
    // est sur le domaine européen d'Oracle (.eu), que rien ne laissait deviner.
    { host: 'evht.fa.ocs.oraclecloud.eu', site: 'CX_7001', emp: 'Edmond de Rothschild' },
    // Le portail BPCE ignore le paramètre « site » : CX_1, CX ou un nom
    // inventé renvoient le même catalogue. Une seule entrée suffit donc, et en
    // ajouter d'autres ferait tourner le connecteur pour rien.
    { host: 'ekez.fa.em2.oraclecloud.com', site: 'CX_1', emp: 'Groupe BPCE' },
    // Sans filtre de lieu, le portail « professionnels » noyait ses deux postes
    // français dans un catalogue mondial dominé par New York.
    { host: 'icbpjb.fa.ocs.oraclecloud.com', site: 'LazardProfessionalCareers', emp: 'Lazard', location: 'France' },
    // Portail « étudiants », distinct du précédent et bien plus riche pour JJ :
    // 47 postes en France contre 2, dont les stages M&A et Restructuring.
    { host: 'icbpjb.fa.ocs.oraclecloud.com', site: 'LazardStudentCareers', emp: 'Lazard', location: 'France' },
    // Oracle Cloud accepte un vrai filtre de lieu, plus juste qu'une recherche
    // par mots-clés : « location=France » rend 21 postes français sur 22, là où
    // « keyword=Paris » en manquait quatre. Le catalogue mondial de JPMorgan
    // approche les 7 000 postes : sans filtre, il serait hors de portée.
    { host: 'jpmc.fa.oraclecloud.com', site: 'CX_1001', emp: 'JPMorgan', location: 'France' },
  ],
  // Ashby : https://api.ashbyhq.com/posting-api/job-board/{company}
  // Framework e-i.com (Crédit Mutuel Alliance Fédérale)
  eicards: [
    { host: 'recrutement.cic.fr', emp: 'CIC' },
    { host: 'recrutement.creditmutuel.fr', emp: 'Crédit Mutuel' },
    { host: 'www.banquetransatlantique.com', emp: 'Banque Transatlantique' },
  ],
  // Portail de l'État (cf. fetchServicePublic). Les identifiants d'organisme
  // viennent des cases "employeur" du moteur de recherche du portail.
  // L'ACPR n'y a pas d'entrée propre : elle recrute via la Banque de France.
  servicepublic: [
    { organisme: 13141, emp: 'Autorité des Marchés Financiers' },
    { organisme: 17, emp: 'Caisse des Dépôts' },
    { organisme: 995, emp: 'Direction générale du Trésor' },
  ],
  // Avature (sitemap + fiches HTML du site officiel — cf. fetchAvature)
  avature: [
    { sitemap: 'https://jobs.totalenergies.com/fr_FR/careers/sitemap.xml', emp: 'TotalEnergies' },
    { sitemap: 'https://careers.loreal.com/fr_FR/jobs/sitemap.xml', emp: "L'Oréal" },
  ],
  // Sitemap + JSON-LD (fiches lues sur le site officiel de la maison)
  // Radancy — adresses en `/job/{VILLE}-{Titre}-{CodePostal}/{id}/`.
  // Des directions financières de grands groupes : peu de postes chacune, mais
  // des alternances, et c'est la catégorie où le catalogue manque de volume.
  // Atos et Alstom sont écartés : le premier ne publie aucun poste de finance
  // en France, le second a un sitemap vide.
  radancy: [
    { host: 'jobs.mcdonalds.com', emp: "McDonald's" },
    { host: 'jobdetails.nestle.com', emp: 'Nestlé' },
    { host: 'careers.bouyguestelecom.fr', emp: 'Bouygues Telecom' },
  ],

  sitemapld: [
    // Barclays et Vinci exposent un sitemap complet et du JSON-LD sur chaque
    // fiche : titre, date et lieu y sont structurés. Rien à écrire, le
    // connecteur générique suffit.
    {
      sitemap: 'https://search.jobs.barclays/sitemap.xml',
      emp: 'Barclays',
      jobPathRe: /\/job\//,
      maxFiches: 120,
      delayMs: 200,
    },
    {
      sitemap: 'https://jobs.vinci.com/sitemap.xml',
      emp: 'Vinci',
      jobPathRe: /\/job\//,
      maxFiches: 150,
      delayMs: 200,
    },
    // KPMG interdit sa page de RECHERCHE dans son robots.txt, mais y publie
    // son sitemap : on lit donc ce qu'ils offrent et on laisse ce qu'ils
    // ferment. Soixante-six offres finance, invisibles jusqu'ici.
    {
      sitemap: 'https://emplois.kpmg.fr/sitemap.xml',
      emp: 'KPMG',
      jobPathRe: /\/emploi\//,
      maxFiches: 140,
      delayMs: 250,
    },
    {
      sitemap: 'https://careers.societegenerale.com/sitemap.xml',
      emp: 'Société Générale',
      jobPathRe: /(job-offers|offres-d-emploi)\//,
      // 1 043 offres distinctes dans leur sitemap (mesuré le 02/09/2026),
      // dont 609 n'existent qu'en anglais. Un plafond de 600 en coupait la
      // moitié — et chez eux, les postes de Paris sont souvent annoncés en
      // anglais, donc rangés en fin de tri.
      maxFiches: 1100,
      // 341 de ces offres sont en France (mesuré fiche par fiche le
      // 02/09/2026). Le pré-filtre sur l'adresse en écartait 40 % : on lit tout,
      // et ce sont les filtres du pipeline qui trient.
      filtrerSlug: false,
      delayMs: 200,
    },
  ],
  // Phenom People (API /api/jobs sur le domaine carrières)
  // TalentSoft (Cegid) : liste HTML publique du site carrières
  // SAP SuccessFactors : {host}/{tenant}/search/
  successfactors: [
    { host: 'careers.ey.com', tenant: 'ey', emp: 'EY' },
    { host: 'jobs.servier.com', tenant: 'servier', emp: 'Servier' },
    { host: 'careers.capgemini.com', tenant: 'capgemini', emp: 'Capgemini' },
    { host: 'apply.careers.hsbc.com', tenant: '', emp: 'HSBC France' },
    { host: 'careers.nomura.com', tenant: 'nomura', emp: 'Nomura' },
    { host: 'jobs.intesasanpaolo.com', tenant: 'intesa', emp: 'Intesa Sanpaolo' },
    // Armateur : ce sont ses fonctions financières qui nous intéressent —
    // trésorerie groupe, comptabilité, contrôle, assurance, crédit. Les postes
    // commerciaux en sont écartés par la règle générale, qui ne les retient que
    // chez les maisons financières.
    { host: 'jobs.cmacgm-group.com', tenant: '', emp: 'CMA CGM' },
    { host: 'carrieres.generali.fr', tenant: '', emp: 'Generali France' },
  ],
  talentsoft: [
    // L'Autorité des marchés financiers : supervision, audit interne,
    // inspection des activités de marché. Une institution que les étudiants en
    // finance visent, et qui n'avait aucun connecteur.
    { host: 'amf-career.talent-soft.com', emp: 'AMF' },
    // Stellantis : modélisation du risque de crédit, gestion des risques,
    // audit. Quinze offres finance dont trois alternances.
    { host: 'jobs.groupe-psa.com', emp: 'Stellantis' },
    { host: 'jobs.amundi.com', emp: 'Amundi' },
    { host: 'cnp-recrute.talent-soft.com', emp: 'CNP Assurances' },
    { host: 'matmut-recrute.talent-soft.com', emp: 'Matmut' },
    { host: 'candriam-recrute.talent-soft.com', emp: 'Candriam' },
    { host: 'aema.talent-soft.com', emp: 'Aema Groupe' },
    { host: 'verlingue-recrute.talent-soft.com', emp: 'Verlingue' },
    { host: 'airfrance-recrute.talent-soft.com', emp: 'Air France' },
    { host: 'sodexo-recrute.talent-soft.com', emp: 'Sodexo' },
    { host: 'recrutement.maif.fr', emp: 'MAIF' },
    { host: 'carrieres.malakoffhumanis.com', emp: 'Malakoff Humanis' },
  ],
  phenom: [
    // Marsh McLennan porte plusieurs marques sur le même portail, dont Oliver
    // Wyman. L'API v1 refuse (HTTP 500), la génération « widgets » répond.
    // Dix-huit offres, dont seize de courtage que le filtre réseau écarte : ce
    // qu'on vient chercher ici, c'est Oliver Wyman.
    { host: 'careers.marsh.com', widgets: true, emp: 'Marsh McLennan' },
    { host: 'careers.axa.com', emp: 'AXA' },
    { host: 'portal.careers.hsbc.com', pid: '563774609123718', domain: 'hsbc.com', emp: 'HSBC France' },
    { host: 'careers.bcg.com', widgets: true, emp: 'BCG' },
    { host: 'careers.allianz.com', widgets: true, emp: 'Allianz France' },
  ],
  ashby: [
    { company: 'qonto', emp: 'Qonto' },
    { company: 'pennylane', emp: 'Pennylane' },
    { company: 'alan', emp: 'Alan' },
    { company: 'seyna', emp: 'Seyna' },
    { company: 'swan', emp: 'Swan' },
    { company: 'finary', emp: 'Finary' },
    { company: 'akur8', emp: 'Akur8' },
    { company: 'spendesk', emp: 'Spendesk' },
  ],
  // Teamtailor : endpoint JSON Feed public https://{company}.teamtailor.com/jobs.json
  teamtailor: [
    // Modjo, éditeur français : deux alternances finance sur trois offres.
    { company: 'modjo', emp: 'Modjo' },
    // Antin Infrastructure Partners. Leur flux est vide aujourd'hui — le fonds
    // n'ouvre des postes qu'épisodiquement —, mais le connecteur est en place :
    // la prochaine offre entrera d'elle-même au passage du matin.
    // À ne pas confondre avec « Antin+ », un bailleur social sans rapport.
    { company: 'antininfrastructurepartners-1655458195', emp: 'Antin Infrastructure' },
    { company: 'payfit', emp: 'PayFit' },
    { company: 'shine', emp: 'Shine' },
    { company: 'trustpair', emp: 'Trustpair' },
    { company: 'floa', emp: 'FLOA' },
    { company: 'alptis', emp: 'Alptis' },
    { company: 'powens', emp: 'Powens' },
    { company: 'wakam', emp: 'Wakam' },
    { company: 'papernest', emp: 'Papernest' },
    { company: 'thales', emp: 'Thales' },
    { company: 'yousign', emp: 'Yousign' },
    { company: 'indy', emp: 'Indy' },
    { company: 'deezer', emp: 'Deezer' },
    { company: 'bridge', emp: 'Bridge' },
    { company: 'mangopay', emp: 'MangoPay' },
    { company: 'leocare', emp: 'Leocare' },
    { company: 'descartesunderwriting', emp: 'Descartes Underwriting' },
    { company: 'kilitechnology', emp: 'Kili Technology' },
    { company: 'adeo', emp: 'Adeo' },
    { company: 'verspieren', emp: 'Verspieren' },
    { company: 'linedata', emp: 'Linedata' },
    { company: 'redensolar', emp: 'Reden Solar' },
    { company: 'photosol', emp: 'Photosol' },
    { company: 'bdofrance', emp: 'BDO France' },
    { company: 'keplercheuvreux', emp: 'Kepler Cheuvreux' },
  ],
};

// Villes/régions françaises courantes, pour filtrer les résultats Workday (les
// grands groupes recrutent mondialement ; on ne garde que le site France).
// Régions françaises, pour les listes qui situent une offre à ce niveau plutôt
// qu'à la ville. Sans elles, une alternance annoncée en « Provence-Alpes-Côte
// d'Azur » n'était reconnue ni comme française ni comme étrangère.
const REGIONS_FR_RE =
  /[îi]le[- ]de[- ]france|auvergne|rh[ôo]ne[- ]alpes|provence|c[ôo]te d'azur|nouvelle[- ]aquitaine|occitanie|bretagne|normandie|hauts[- ]de[- ]france|grand[- ]est|pays de la loire|centre[- ]val de loire|bourgogne|franche[- ]comt[ée]|corse/i;

// Reconnaître qu'une offre est en France. Cette liste décide de l'entrée au
// catalogue sur une bonne partie des connecteurs : ce qu'elle ignore est jeté
// en silence, sans erreur ni trace. Elle omettait 32 des 63 villes d'un
// contrôle — dont LA DÉFENSE, premier quartier d'affaires d'Europe, où sont
// BNP CIB, SG CIB, Deloitte et EY, ainsi que Neuilly, Saint-Ouen et Montrouge
// où siègent plusieurs assureurs. Les offres y étaient perdues sans bruit.
//
// Deux familles y figurent : les grandes villes du pays, et les communes
// d'affaires d'Île-de-France, qui n'ont rien de grandes villes mais
// concentrent l'essentiel des sièges sociaux de la finance française.
const FRANCE_LOCATION_RE = new RegExp(
  [
    '\\bfrance\\b',
    // Formes d'adresse qui ne nomment pas la ville. « 16ème arrondissement »
    // ne désigne que Paris, Lyon ou Marseille ; « cedex » et un code postal
    // francilien n'existent qu'en France. Sans elles, une offre située par son
    // seul arrondissement ou son seul code postal était rejetée d'emblée.
    '\\d{1,2}\\s*(?:er|e|[èe]me)\\s+arrondissement|\\barrondissement\\b|\\bcedex\\b',
    '\\b(?:75|77|78|91|92|93|94|95)\\d{3}\\b',
    // Quartiers d'affaires et communes de sièges, Île-de-France
    'la d[ée]fense|puteaux|courbevoie|nanterre|neuilly|levallois|clichy|colombes',
    'bois-?colombes|asni[èe]res|gennevilliers|suresnes|rueil|saint-?cloud|s[èe]vres',
    'boulogne|issy|vanves|malakoff|montrouge|ch[âa]tillon|antony|massy|palaiseau',
    'saclay|guyancourt|v[ée]lizy|versailles|saint-?quentin|cergy|roissy|tremblay',
    'saint-?denis|aubervilliers|pantin|montreuil|bagnolet|vincennes|charenton',
    'ivry|villejuif|cr[ée]teil|gentilly|arcueil|le kremlin|saint-?ouen|noisy',
    'marne-?la-?vall[ée]e|serris|bussy|torcy|[ée]vry|corbeil|melun|meaux|poissy',
    // Grandes villes
    'paris|lyon|villeurbanne|marseille|aix-en-provence|toulouse|blagnac|nice',
    'sophia antipolis|nantes|montpellier|strasbourg|bordeaux|lille|roubaix',
    'tourcoing|villeneuve-?d.ascq|rennes|reims|toulon|saint-?[ée]tienne|le havre',
    'grenoble|dijon|angers|n[îi]mes|clermont-?ferrand|le mans|aix-?les-?bains',
    'brest|tours|amiens|limoges|annecy|perpignan|besan[çc]on|metz|orl[ée]ans',
    'mulhouse|rouen|caen|nancy|argenteuil|montreuil|saint-?paul|nanterre',
    'avignon|poitiers|dunkerque|aubagne|pau|la rochelle|calais|b[ée]ziers',
    'colmar|valence|qu[ii]mper|troyes|lorient|niort|chamb[ée]ry|beauvais',
    'la roche-?sur-?yon|ch[âa]lons|bayonne|biarritz|arras|belfort|vannes',
  ].join('|'),
  'i'
);

// Beaucoup de boards Greenhouse/Lever sont MONDIAUX (Forvis Mazars publie
// 185 offres tous pays confondus). Sans filtre géographique, on ferait entrer
// des postes à Londres ou New York — hors périmètre JJ (France uniquement).
async function fetchGreenhouse({ token, emp }) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
  try {
    const json = await getJSON(url);
    return (json.jobs || [])
      .filter((o) => FRANCE_LOCATION_RE.test(o.location?.name || ''))
      .filter((o) => isFinanceOfferFor(emp, o.title, o.departments?.map((d) => d.name).join(' ')))
      .map((o) => ({ __src: `greenhouse:${token}`, emp, raw: o }));
  } catch (err) {
    console.warn(`[sources] Greenhouse (${token}) indisponible:`, err.message);
    return [];
  }
}

async function fetchLever({ company, emp }) {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  try {
    const json = await getJSON(url);
    return (json || [])
      .filter((o) => FRANCE_LOCATION_RE.test(o.categories?.location || ''))
      .filter((o) => isFinanceOfferFor(emp, o.text, o.categories?.team))
      .map((o) => ({ __src: `lever:${company}`, emp, raw: o }));
  } catch (err) {
    console.warn(`[sources] Lever (${company}) indisponible:`, err.message);
    return [];
  }
}

// Va chercher le corps de l'annonce pour chaque offre retenue. SmartRecruiters
// expose la fiche complète sur /postings/{id}, où `jobAd.sections` contient la
// description et surtout les qualifications — la seule mention du niveau requis.
// Deux fiches à la fois : ce connecteur tourne déjà à l'intérieur de la file
// bornée de fetchAllATS, et sa propre rafale s'y ajouterait.
async function enrichirDescriptions(offres, id, concurrence = 2) {
  let idx = 0;
  await Promise.all(
    Array.from({ length: concurrence }, async () => {
      while (idx < offres.length) {
        const o = offres[idx++];
        try {
          const r = await fetch(
            `https://api.smartrecruiters.com/v1/companies/${id}/postings/${o.raw.id}`,
            {
              headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
              signal: AbortSignal.timeout(15000),
            }
          );
          if (!r.ok) continue;
          const fiche = await r.json();
          const sections = (fiche.jobAd && fiche.jobAd.sections) || {};
          // Uniquement le bloc « qualifications » : c'est là qu'est écrit le
          // niveau attendu. La présentation de l'entreprise ("nos 5 200
          // experts", "80 ans d'expérience") et le descriptif du poste
          // emploient des tournures qui déclencheraient à tort le filtre.
          o.raw.description = ((sections.qualifications && sections.qualifications.text) || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&#x?[0-9a-f]+;|&\w+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 3000);
        } catch {
          /* fiche indisponible : on garde l'offre, jugée sur son seul intitulé */
        }
      }
    })
  );
}

async function fetchSmartRecruiters({ id, emp }) {
  // country=fr : indispensable pour les groupes internationaux (Accor publie
  // des centaines d'offres monde entier sur le même compte) — JJ ne référence
  // que la France. On pagine, l'API plafonne à 100 par appel.
  const all = [];
  const pageSize = 100;
  try {
    for (let offset = 0; offset < 1000; offset += pageSize) {
      const url = `https://api.smartrecruiters.com/v1/companies/${id}/postings?country=fr&limit=${pageSize}&offset=${offset}`;
      const json = await getJSON(url);
      const page = json.content || [];
      all.push(...page);
      if (page.length < pageSize) break;
      if (json.totalFound > 0 && all.length >= json.totalFound) break;
    }
    const retenues = all
      .filter((o) => (o.location?.country || '').toLowerCase() === 'fr')
      .filter((o) => isFinanceOfferFor(emp, o.name, o.department?.label))
      .map((o) => ({
        __src: `smartrecruiters:${id}`,
        emp,
        // La liste ne contient PAS applyUrl (seulement `ref`, qui pointe vers
        // l'API). L'URL publique de l'annonce se reconstruit à partir de
        // l'identifiant de société et de l'id de l'offre (format vérifié).
        raw: { ...o, applyUrl: `https://jobs.smartrecruiters.com/${o.company?.identifier || id}/${o.id}` },
      }));

    // La liste ne porte pas le texte de l'annonce, or c'est le seul endroit où
    // le niveau requis est écrit : l'intitulé « ARBITRE / ANALYSTE CREDIT »
    // ne dit rien, et il fallait lire « 3 à 5 ans d'expérience » dans les
    // qualifications pour voir que le poste n'est pas junior. Sans cette
    // seconde requête, le filtre 0-3 ans du pipeline tourne à vide sur tout
    // ce connecteur. Une fiche par offre retenue (quelques dizaines), en
    // séquence limitée pour ne pas matraquer l'API.
    await enrichirDescriptions(retenues, id);
    return retenues;
  } catch (err) {
    console.warn(`[sources] SmartRecruiters (${id}) indisponible:`, err.message);
    return [];
  }
}

// Workday expose une API de recherche publique et non-authentifiée derrière
// chaque site carrière (c'est elle que le site web utilise lui-même) :
//   POST https://{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
// Vérifié manuellement sur Sanofi, Airbus et Air Liquide (voir commentaire
// TARGET_COMPANIES ci-dessus). Chaque tenant a ses propres identifiants de
// facette (opaques) donc on les découvre à chaque appel plutôt que de les
// coder en dur : on cherche la catégorie de métier dont le libellé contient
// "financ" (Finance, Finance & Controlling, ...).
async function workdayPost(tenant, dc, site, body) {
  const url = `https://${tenant}.${dc}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  return getJSON(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

// Cherche récursivement dans l'arbre de facettes (Workday imbrique le pays
// sous "locationMainGroup") la première valeur dont le libellé passe le test.
function findFacet(facets, testValue) {
  for (const facet of facets || []) {
    const match = (facet.values || []).find((v) => v.descriptor && testValue(v.descriptor));
    if (match && match.id) return { key: facet.facetParameter, id: match.id };
    // La récursion doit repartir du GROUPE imbriqué, pas de son parent. Chez
    // Sanofi, « locationMainGroup » ne contient aucune valeur feuille : son
    // unique élément est lui-même un groupe { facetParameter: "locationCountry",
    // values: [...] }. Passer `facet.values` tel quel envoyait la France en
    // profondeur, mais la clé remontée restait celle du parent — la France
    // n'était donc jamais trouvée, faute d'objet-groupe à explorer.
    for (const sousGroupe of facet.values || []) {
      if (sousGroupe && Array.isArray(sousGroupe.values)) {
        const nested = findFacet([sousGroupe], testValue);
        if (nested) return nested;
      }
    }
  }
  return null;
}

// Variante qui ramène TOUTES les valeurs correspondantes d'une même facette.
// Nécessaire pour les tenants dont l'arbre de lieux descend directement aux
// villes sans niveau "pays" : chez PwC ou BDO, cibler la France veut dire
// cocher Paris, Neuilly, Lyon... une par une.
function findFacetValues(facets, testValue, max = 25) {
  for (const facet of facets || []) {
    const matches = (facet.values || []).filter((v) => v.id && v.descriptor && testValue(v.descriptor));
    if (matches.length) return { key: facet.facetParameter, ids: matches.slice(0, max).map((v) => v.id) };
    // Même correction que findFacet ci-dessus : redescendre par le groupe
    // imbriqué et sa propre clé, pas par la liste brute du parent.
    for (const sousGroupe of facet.values || []) {
      if (sousGroupe && Array.isArray(sousGroupe.values)) {
        const nested = findFacetValues([sousGroupe], testValue, max);
        if (nested) return nested;
      }
    }
  }
  return null;
}

// Termes de recherche utilisés quand le tenant Workday n'a pas de catégorie
// "Finance" exploitable. C'est le cas des maisons dont les familles de métiers
// portent leur propre vocabulaire : chez PwC ce sont "Assurance", "Advisory",
// "Tax" ; chez les industriels, "Corporate Functions". Sans ce repli, ces
// tenants renvoyaient zéro offre alors qu'ils en publient des centaines.
const WORKDAY_RECHERCHES_FINANCE = [
  'finance', 'audit', 'comptab', 'accounting', 'contrôle de gestion', 'controlling',
  'trésorerie', 'treasury', 'risque', 'risk', 'conformité', 'compliance', 'fiscalité',
  'tax', 'analyste', 'analyst', 'investment', 'stage finance', 'alternance finance',
];

async function fetchWorkday({ tenant, dc, site, emp, locale = 'en-US' }) {
  try {
    const probe = await workdayPost(tenant, dc, site, { appliedFacets: {}, limit: 1, offset: 0, searchText: '' });

    const finance = findFacet(probe.facets, (d) => /financ/i.test(d));

    // Filtrer la France par FACETTE plutôt que par nom de ville : les
    // industriels recrutent dans des petites communes (Vendôme, Brive...) qu'une
    // liste de villes codée en dur ne contiendra jamais. La facette pays est
    // exhaustive et vient de la source elle-même.
    const country = findFacet(probe.facets, (d) => /^france$/i.test(d));

    // Certains tenants mondiaux (PwC, BDO) n'exposent pas de niveau "pays" :
    // l'arbre des lieux descend directement aux villes. On coche alors les
    // villes françaises une par une — sans quoi le balayage par mots-clés se
    // noierait dans les milliers de postes indiens ou américains avant d'avoir
    // atteint la moindre offre en France.
    const villesFr = country ? null : findFacetValues(probe.facets, (d) => FRANCE_LOCATION_RE.test(d));

    const facetsPays = country
      ? { [country.key]: [country.id] }
      : villesFr
        ? { [villesFr.key]: villesFr.ids }
        : {};
    const jobs = [];
    const vus = new Set();

    const collecte = async (appliedFacets, searchText, maxPages) => {
      const pageSize = 20;
      // Workday ne renvoie le total QUE sur la première réponse ; les
      // suivantes portent « total: 0 ». On le retient donc au passage.
      let total = 0;
      for (let page = 0; page < maxPages; page++) {
        const data = await workdayPost(tenant, dc, site, {
          appliedFacets,
          limit: pageSize,
          offset: page * pageSize,
          searchText,
        });
        const lot = data.jobPostings || [];
        for (const j of lot) {
          if (j.externalPath && !vus.has(j.externalPath)) {
            vus.add(j.externalPath);
            jobs.push(j);
          }
        }
        if (data.total) total = data.total;
        // Une page incomplète marque la fin. Un total absent, non : c'est le
        // cas normal dès la deuxième page, et le lire comme « zéro offre au
        // total » arrêtait la lecture au bout de vingt.
        if (lot.length < pageSize) break;
        if (total && vus.size >= total) break;
      }
    };

    // Chez une maison qui publie peu — les fonds, les boutiques — le catalogue
    // entier tient en quelques pages : on le prend tel quel et le filtre finance
    // du pipeline tranche sur les intitulés. C'est bien plus sûr qu'un balayage
    // par mots-clés, qui ratait tout ce qui ne les contient pas : « Private
    // Equity Buyout Stage » chez Ardian n'en portait aucun, et 26 de leurs 30
    // stages parisiens échappaient au connecteur.
    const petitCatalogue = (probe.total || 0) > 0 && (probe.total || 0) <= 600;
    if (petitCatalogue) {
      // Aucune facette de lieu ici, volontairement. Un petit catalogue se prend
      // en entier et se filtre ensuite sur le libellé du lieu — restreindre en
      // amont ne fait courir qu'un risque : chez Swiss Life, dont le site est
      // déjà franco-français, l'arbre des lieux n'expose aucune valeur
      // exploitable, et la restriction ramenait 1 offre sur 150.
      await collecte({}, '', 30);
    } else if (finance) {
      // La catégorie finance du tenant d'abord : c'est LUI qui sait ce qui
      // relève de la finance chez lui, et cela évite de ramener l'assistanat
      // administratif et le juridique des grands cabinets.
      await collecte({ ...facetsPays, [finance.key]: [finance.id] }, '', 10);
    }

    // Repli géographique : quand le tenant n'a pas de catégorie finance, ou
    // qu'elle ne rend rien — chez PwC, la seule famille contenant « financ »
    // est archivée — on prend tout ce que le périmètre France contient. Un
    // balayage par mots-clés raterait « Stage Auditeur Financier - Lyon ».
    if (jobs.length === 0 && Object.keys(facetsPays).length) {
      await collecte(facetsPays, '', 25);
    }

    // Repli, y compris quand une catégorie "finance" existe mais ne donne rien :
    // chez PwC la seule facette contenant "financ" est une famille de métiers
    // archivée ("(Inactive)"), croisée avec la France elle renvoie zéro. On
    // balaie alors les mots-clés dans le périmètre géographique, et le filtre
    // finance du pipeline fait le tri fin sur les intitulés.
    if (jobs.length === 0) {
      for (const terme of WORKDAY_RECHERCHES_FINANCE) {
        await collecte(facetsPays, terme, 3);
      }
    }

    return jobs
      // Si le tenant n'expose pas de facette pays, on retombe sur le filtre par
      // nom de ville (moins fiable, mais mieux que laisser passer l'étranger).
      // Garde-fou final : même avec les facettes ville, un tenant peut renvoyer
      // des lieux hors périmètre. On revérifie sur le libellé.
      .filter((j) => (country ? true : FRANCE_LOCATION_RE.test(j.locationsText || '')))
      .map((j) => ({
        __src: `workday:${tenant}`,
        emp,
        raw: {
          title: j.title,
          locationsText: j.locationsText,
          postedOn: j.postedOn,
          // La dernière valeur de bulletFields est le type de contrat :
          // « Stage », « Alternance », « CDD », « CDI ». Sans elle, le
          // pipeline devait le deviner sur le seul intitulé, et rangeait
          // toutes les alternances de la Banque de France en CDI.
          bulletFields: j.bulletFields || [],
          url: `https://${tenant}.${dc}.myworkdayjobs.com/${locale}/${site}${j.externalPath}`,
        },
      }));
  } catch (err) {
    console.warn(`[sources] Workday (${tenant}) indisponible:`, err.message);
    return [];
  }
}

// OpenDataSoft : plateforme d'open data générique (API publique documentée,
// aucune clé requise). Certains grands groupes y publient officiellement
// toutes leurs offres d'emploi comme jeu de données réutilisable — c'est le
// cas de Groupe BPCE. On filtre au niveau France, on exclut le VIE (pas
// d'onglet dédié sur JJ) et on applique le même filtre finance que les autres
// connecteurs ATS.
async function fetchOpenDataSoft({ domain, dataset, emp }) {
  const pageSize = 100;
  const maxPages = 25; // garde-fou : 2500 offres France max
  // « description » est indispensable : le filtre 0-3 ans ne peut juger une
  // offre que sur le texte de son annonce, et sans ce champ soixante offres
  // BPCE étaient écartées chaque matin faute d'être vérifiables — le pipeline
  // lisait un champ que la requête ne demandait pas.
  const fields = 'title,category,city,jobtype,apply_url,url,lastmodifieddate,organization,description';
  const jobs = [];
  try {
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        dataset,
        rows: String(pageSize),
        start: String(page * pageSize),
        'refine.country': 'France',
        fields,
      });
      const json = await getJSON(`https://${domain}/api/records/1.0/search/?${params}`);
      const records = json.records || [];
      jobs.push(...records);
      if (records.length < pageSize) break;
      if (json.nhits > 0 && jobs.length >= json.nhits) break;
    }
  } catch (err) {
    console.warn(`[sources] OpenDataSoft (${domain}) indisponible:`, err.message);
    return [];
  }

  return jobs
    .map((r) => r.fields)
    .filter((f) => f.jobtype !== 'VIE') // pas d'onglet VIE sur JJ
    .filter((f) => isFinanceOfferFor(f.organization || emp, f.title, f.category))
    .map((f) => ({
      __src: `opendatasoft:${domain}`,
      emp: f.organization || emp,
      raw: f,
    }));
}

// Recruitee — endpoint public, renvoie déjà le lien direct vers l'annonce.
// TalentLink (tal.net) — la plateforme des boutiques anglo-saxonnes de conseil
// financier. Elle expose un flux Atom par tableau d'offres, ce qui évite d'avoir
// à exécuter leur JavaScript : le flux porte l'intitulé, le lien, la date de
// publication et la date limite de candidature.
//
// Les boutiques ouvrent leurs promotions sur PLUSIEURS bureaux à la fois —
// « Off-Cycle Internship Programme (Paris / London) » — et le lieu ne figure
// que dans l'intitulé. On retient donc une offre dès que son titre nomme Paris
// ou la France : un candidat parisien est bien concerné par une promotion
// Paris/Londres, alors qu'une promotion Munich/Londres ne le regarde pas.
async function fetchTalentLink({ host, board = 2, emp, chemin }) {
  try {
    const url = chemin
      ? `https://${host}${chemin}`
      : `https://${host}/vx/mobile-0/appcentre-1/brand-4/candidate/jobboard/vacancy/${board}/feed`;
    const xml = await (await fetchAvecReprise(url, { headers: { 'user-agent': UA_HTML } })).text();

    const offres = [];
    for (const m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const titre = decodeEntities((e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '')
        .replace(/\s+/g, ' ')
        .trim();
      const lien = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1];
      if (!titre || !lien) continue;
      if (!/paris|\bfrance\b/i.test(titre)) continue;
      offres.push({
        __src: `talentlink:${host}`,
        emp,
        raw: {
          titre,
          // Le « ?instant=apply » ouvre directement le formulaire : on préfère
          // envoyer le candidat sur la description de l'offre.
          url: lien.replace(/\?instant=apply$/, ''),
          date: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || null,
          echeance: (e.match(/Application Deadline:\s*([^<]+)/i) || [])[1] || null,
        },
      });
    }
    return offres;
  } catch (err) {
    console.warn(`[sources] TalentLink (${host}) indisponible:`, err.message);
    return [];
  }
}

// LVMH — le groupe fait passer sa recherche Algolia par son propre serveur
// (/api/search), donc aucune clé n'est nécessaire. Sur 1195 offres françaises,
// 93 relèvent de la finance : on filtre sur leur propre facette « Finance »
// plutôt que sur l'intitulé, ce qui évite d'avoir à distinguer un contrôleur de
// gestion d'un conseiller de vente Sephora.
//
// L'employeur affiché est la MAISON (Moët Hennessy, Christian Dior, Sephora) et
// non « LVMH » : c'est le nom que le candidat reconnaît, et un contrôle de
// gestion chez Moët Hennessy ne se présente pas comme un poste au siège.
async function fetchLvmh({ emp = 'LVMH' } = {}) {
  const hits = [];
  try {
    for (let page = 0; page < 10; page++) {
      const j = await getJSON('https://www.lvmh.com/api/search', {
        method: 'POST',
        headers: {
          'user-agent': UA_HTML,
          'content-type': 'application/json',
          referer: 'https://www.lvmh.com/fr/nous-rejoindre/nos-offres',
        },
        body: JSON.stringify({
          queries: [
            {
              indexName: 'PRD-fr-fr-timestamp-desc',
              params: {
                hitsPerPage: 50,
                page,
                query: '',
                filters: 'countryRegionFilter:"France" AND functionFilter:"Finance"',
              },
            },
          ],
        }),
      });
      const res = (j.results || [])[0] || {};
      const lot = res.hits || [];
      hits.push(...lot);
      if (lot.length < 50) break;
      if (res.nbHits > 0 && hits.length >= res.nbHits) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    return hits
      .filter((h) => h.name && h.link)
      .map((h) => ({
        __src: 'lvmh',
        emp: h.maison || emp,
        raw: h,
      }));
  } catch (err) {
    console.warn('[sources] LVMH indisponible:', err.message);
    return [];
  }
}

// TalentView (talentview.io) — l'ATS de Tikehau Capital, entre autres. La
// campagne d'offres se lit directement, filtrée sur la France dès la requête
// (le site le fait lui-même via lat/lon/iso_country) : pas de tri à refaire.
// Chaque offre porte sa ville, son entité et sa date de dernière activation.
async function fetchTalentView({ tenant, companyWebsiteId, emp }) {
  try {
    const url =
      `https://api.talentview.io/funnel/v2/companies/${tenant}/campaigns` +
      `?company_website_id=${companyWebsiteId}&display_mode=list` +
      `&location[lat]=46.227638&location[lon]=2.213749&location[iso_country]=FR&offset_start=1`;
    const lot = await getJSON(url, { headers: { 'user-agent': UA_HTML } });

    return (Array.isArray(lot) ? lot : [])
      .filter((o) => o.name && o.slug)
      .filter((o) => isFinanceOfferFor(o.entity?.name || emp, o.name))
      .map((o) => ({
        __src: `talentview:${tenant}`,
        emp: o.entity?.name || emp,
        raw: {
          titre: o.name,
          ville: o.address?.city || '',
          date: o.last_activation_at,
          url: `https://${tenant}.talentview.io/jobs/${o.slug}`,
        },
      }));
  } catch (err) {
    console.warn(`[sources] TalentView (${tenant}) indisponible:`, err.message);
    return [];
  }
}

// AXA France — leur site de recrutement français expose une API JSON propre,
// bien plus complète que le portail mondial du groupe : 383 offres contre 5,
// avec la date d'ouverture, la description et les qualifications (donc de quoi
// juger la séniorité). Le portail mondial ne remontait aucun stage ni aucune
// alternance, alors qu'AXA est l'un des gros recruteurs d'étudiants du pays.
//
// La pagination est figée à dix par page — tous les paramètres de taille sont
// ignorés — d'où le nombre de pages plutôt qu'une taille de lot.
async function fetchAxaFrance({ emp = 'AXA France' } = {}) {
  const offres = [];
  try {
    for (let page = 1; page <= 45; page++) {
      const j = await getJSON(`https://recrutement.axa.fr/api/jobs?page=${page}`, {
        headers: { 'user-agent': UA_HTML },
      });
      const lot = j.data || [];
      if (!lot.length) break;
      offres.push(...lot);
      // Sans total exploitable, seule la page vide ci-dessus marque la fin.
      if (j.total > 0 && offres.length >= j.total) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    const slug = (s) =>
      decodeEntities(String(s || ''))
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    return offres
      .filter((o) => o.isActive !== false)
      .filter((o) => isFinanceOfferFor(emp, o.JobTitle, o.ReqTypeId))
      .map((o) => ({
        __src: 'axafr',
        emp: o.LegalEntity || emp,
        raw: {
          ...o,
          // L'adresse publique reprend l'identifiant puis l'intitulé en tirets.
          url: `https://recrutement.axa.fr/nos-offres-emploi/${o.ReqNo || o.avatureid}-${slug(o.JobTitle)}`,
        },
      }));
  } catch (err) {
    console.warn('[sources] AXA France indisponible:', err.message);
    return [];
  }
}

// Cornerstone OnDemand (csod.com) — l'ATS d'Eurazeo, et d'autres maisons.
// Son API de recherche exige un jeton Bearer de courte durée (cinq heures),
// mais ce jeton est servi dans le HTML de la page carrières : deux requêtes
// suffisent, aucune session à entretenir.
//
// Attention au pays : leur donnée est parfois fausse — une mission au
// Luxembourg y est étiquetée « US ». On accepte donc une offre dès qu'un de ses
// lieux est en France OU porte un nom de ville française, plutôt que de se fier
// au seul code pays.
async function fetchCornerstone({ tenant, siteId = 1, emp, cultureId = 13 }) {
  const base = `https://${tenant}.csod.com`;
  const accueil = `${base}/ux/ats/careersite/${siteId}/home?c=${tenant}`;
  try {
    const html = await (
      await fetchAvecReprise(accueil, { headers: { 'user-agent': UA_HTML } })
    ).text();
    const jeton = (html.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/) || [])[0];
    if (!jeton) throw new Error('jeton introuvable dans la page carrières');

    const offres = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetchAvecReprise(`https://eu-cdg.api.csod.com/rec-job-search/external/jobs`, {
        method: 'POST',
        headers: {
          'user-agent': UA_HTML,
          authorization: `Bearer ${jeton}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'CSOD-Accept-Language': 'fr-FR',
        },
        body: JSON.stringify({
          careerSiteId: siteId, careerSitePageId: siteId, pageNumber: page, pageSize: 50,
          cultureId, searchText: '', cultureName: 'fr-FR',
          states: [], countryCodes: [], cities: [], placeID: '', radius: null,
          postingsWithinDays: null, customFieldCheckboxKeys: [],
          customFieldDropdowns: [], customFieldRadios: [],
        }),
      });
      const lot = ((await res.json()).data || {}).requisitions || [];
      offres.push(...lot);
      if (lot.length < 50) break;
    }

    return offres
      .filter((o) =>
        (o.locations || []).some(
          (l) => /^fr$/i.test(l.country || '') || FRANCE_LOCATION_RE.test(l.city || '')
        )
      )
      .filter((o) => isFinanceOfferFor(emp, o.displayJobTitle))
      .map((o) => ({
        __src: `cornerstone:${tenant}`,
        emp,
        raw: {
          ...o,
          url: `${base}/ux/ats/careersite/${siteId}/home/requisition/${o.requisitionId}?c=${tenant}`,
        },
      }));
  } catch (err) {
    console.warn(`[sources] Cornerstone (${tenant}) indisponible:`, err.message);
    return [];
  }
}

async function fetchRecruitee({ company, emp }) {
  try {
    const json = await getJSON(`https://${company}.recruitee.com/api/offers/`);
    return (json.offers || [])
      .filter((o) => /france/i.test(o.country || '') || FRANCE_LOCATION_RE.test(o.city || ''))
      .filter((o) => isFinanceOfferFor(emp, o.title, o.department))
      .map((o) => ({ __src: `recruitee:${company}`, emp, raw: o }));
  } catch (err) {
    console.warn(`[sources] Recruitee (${company}) indisponible:`, err.message);
    return [];
  }
}

// Oracle Cloud HCM (Fusion Recruiting) — API publique du site carrières.
// La liste renvoie les offres ; le lien public suit le format /job/{id}.
// `keywords` : pour les tenants mondiaux (JPMorgan publie 7 183 offres, très
// majoritairement aux États-Unis), parcourir toute la liste puis filtrer côté
// client ne marche pas — les offres françaises se trouvent bien au-delà de la
// limite de pagination. On interroge alors le serveur ville par ville.
async function fetchOracleCloud({ host, site, emp, keywords, location }) {
  const jobs = [];
  const pageSize = 200;
  const queries = keywords && keywords.length ? keywords : [null];
  try {
    for (const kw of queries) {
      for (let offset = 0; offset < 2000; offset += pageSize) {
        const url =
          `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions` +
          `?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber=${site},` +
          (kw ? `keyword=${encodeURIComponent(kw)},` : '') +
          // Filtre de lieu natif : plus fiable qu'un mot-clé, qui cherche aussi
          // dans l'intitulé et rate les postes dont le titre ne dit pas la ville.
          (location ? `location=${encodeURIComponent(location)},` : '') +
          `limit=${pageSize},offset=${offset}`;
        const json = await getJSON(url);
        const bloc = (json.items || [])[0] || {};
        const list = bloc.requisitionList || [];
        jobs.push(...list);
        if (list.length < pageSize) break;
        if (bloc.TotalJobsCount > 0 && jobs.length >= bloc.TotalJobsCount) break;
      }
    }
  } catch (err) {
    console.warn(`[sources] Oracle Cloud (${host}) indisponible:`, err.message);
    return [];
  }

  const vus = new Set();
  return jobs
    .filter((r) => { if (vus.has(r.Id)) return false; vus.add(r.Id); return true; })
    .filter((r) => !/_ORA_DELETED$/.test(r.Id || '')) // offres supprimées côté Oracle
    .filter((r) => FRANCE_LOCATION_RE.test(r.PrimaryLocation || ''))
    .filter((r) => isFinanceOfferFor(emp, r.Title))
    .map((r) => ({
      __src: `oraclecloud:${host}`,
      emp,
      raw: {
        title: r.Title,
        location: r.PrimaryLocation,
        postedDate: r.PostedDate,
        url: `https://${host}/hcmUI/CandidateExperience/fr/sites/${site}/job/${r.Id}`,
      },
    }));
}

// SAP SuccessFactors (RCM) — plateforme carrières de très nombreux grands
// groupes (EY...). Pas d'API JSON publique, mais la page de résultats est du
// HTML serveur, paginée par un paramètre `startrow`, et le robots.txt autorise
// /search/ et /job/ (seuls /services/, /applybutton/, /talentcommunity/ sont
// interdits — on n'y touche pas). Chaque ligne porte le titre, le lien et le
// lieu ("Paris La Défense, FR, 92037").
async function fetchSuccessFactors({ host, tenant, emp, location = 'France', maxPages = 12, delayMs = 1200 }) {
  const offers = [];
  const pageSize = 25;
  try {
    for (let page = 0; page < maxPages; page++) {
      // Certaines instances (HSBC) n'ont pas de préfixe tenant dans leurs URL.
      const base = tenant ? `/${tenant}` : '';
      const url =
        `https://${host}${base}/search/?q=&locationsearch=${encodeURIComponent(location)}` +
        `&startrow=${page * pageSize}`;
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' } });
      if (!res.ok) break;
      const html = await res.text();

      // Lien d'offre = tout <a> portant la classe jobTitle-link. L'ordre des
      // attributs varie selon l'instance (EY met href d'abord, HSBC class
      // d'abord, avec des classes supplémentaires) : on lit le tag en entier.
      const aRe = /<a\b([^>]*jobTitle-link[^>]*)>\s*([^<]+?)\s*<\/a>/g;
      let m;
      let found = 0;
      const seenPage = new Set();
      while ((m = aRe.exec(html))) {
        const href = (m[1].match(/href="([^"]+)"/) || [])[1];
        // Une instance peut héberger plusieurs marques, chacune sous son propre
        // préfixe : CMA CGM sert ses offres sous « /job/ » et celles de CEVA
        // Logistics sous « /CEVALogistics/job/ ». Exiger le chemin en début
        // d'adresse écartait toute une moitié du catalogue. Il suffit que
        // l'adresse désigne une offre.
        if (!href || !href.includes('/job/') || seenPage.has(href)) continue;
        seenPage.add(href);
        const suite = html.slice(m.index + m[0].length, m.index + m[0].length + 1500);
        const locMatch = suite.match(/class="jobLocation[^"]*"[^>]*>\s*([^<]+?)\s*</);
        // Repli : certaines instances (HSBC) ne balisent pas le lieu dans la
        // liste, mais le slug SuccessFactors commence par la ville
        // ("/job/COURBEVOIE-Prudential-...-92-92400/123/").
        const slugVille = (decodeURIComponent(href).match(/\/job\/([A-Za-zÀ-ÿ' -]+?)-[A-Z]/) || [])[1] || '';
        // La balise peut exister et être VIDE — c'est le cas chez CMA CGM. Se
        // contenter de tester sa présence donnait alors un lieu vide, que le
        // filtre France rejetait ensuite : toutes leurs offres tombaient, sans
        // erreur. C'est le contenu qui décide du repli, pas la balise.
        const lieuBalise = locMatch ? locMatch[1].replace(/\s+/g, ' ').trim() : '';
        offers.push({
          title: m[2].replace(/\s+/g, ' ').trim(),
          url: `https://${host}${href}`,
          lieu: lieuBalise || slugVille,
        });
        found++;
      }
      if (found === 0) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  } catch (err) {
    console.warn(`[sources] SuccessFactors (${host}) indisponible:`, err.message);
    return [];
  }

  const vus = new Set();
  return offers
    .filter((o) => {
      if (vus.has(o.url)) return false;
      vus.add(o.url);
      return true;
    })
    // Le lieu SuccessFactors est de la forme "Paris La Défense, FR, 92037" :
    // on exige le code pays FR (ou une ville française reconnue).
    .filter((o) => /,\s*FR\s*(,|$)/i.test(o.lieu) || FRANCE_LOCATION_RE.test(o.lieu))
    .filter((o) => isFinanceOfferFor(emp, o.title))
    .map((o) => ({ __src: `successfactors:${host}`, emp, raw: o }));
}

// TalentSoft (Cegid Talentsoft) — plateforme carrières très répandue chez les
// grands groupes français (Amundi, CNP, Groupama...). Pas d'API JSON publique,
// mais la liste d'offres est du HTML statique parfaitement régulier, servi sans
// blocage et sans restriction robots.txt (vérifié pour Amundi : robots.txt vide).
// Chaque carte porte : titre, lien, type de contrat, entité, pays, ville.
async function fetchTalentSoft({ host, emp, maxPages = 20, delayMs = 1500 }) {
  const offers = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://${host}/offre-de-emploi/liste-offres.aspx?LCID=1036&page=${page}`;
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' } });
      if (!res.ok) break;
      const html = await res.text();

      // Les instances TalentSoft n'ont pas toutes le même habillage : certaines
      // portent la classe "ts-offer-list-item" (Amundi), d'autres pas du tout
      // (CNP). Le point commun stable est le lien vers la fiche
      // (/offre-de-emploi/emploi-...aspx) suivi du bloc <ul> des métadonnées.
      const cardRe =
        /href="(\/offre-de-emploi\/emploi[^"]+\.aspx)"[^>]*>\s*([^<]+?)\s*<\/a>([\s\S]{0,2500}?)<\/li>/g;
      let m;
      let found = 0;
      const seenOnPage = new Set();
      while ((m = cardRe.exec(html))) {
        if (seenOnPage.has(m[1])) continue;
        seenOnPage.add(m[1]);
        const ulMatch = m[3].match(/<ul[^>]*>([\s\S]*?)<\/ul>/);
        const items = ulMatch
          ? [...ulMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) =>
              x[1].replace(/<[^>]*>/g, '').replace(/&#\d+;|&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
            )
          : [];
        offers.push({
          title: m[2].replace(/\s+/g, ' ').trim(),
          url: new URL(m[1], `https://${host}`).href,
          contrat: items[0] || '',
          entite: items[1] || '',
          pays: items[2] || '',
          ville: items[3] || '',
          // Quand le bloc de métadonnées est absent, on ne connaît pas le pays :
          // ces instances sont des sites carrières FRANÇAIS, on l'assume.
          metaAbsente: items.length === 0,
        });
        found++;
      }
      if (found === 0) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  } catch (err) {
    console.warn(`[sources] TalentSoft (${host}) indisponible:`, err.message);
    return [];
  }

  // Dédoublonne (la pagination peut renvoyer la même page si le paramètre est ignoré)
  const seen = new Set();
  return offers
    .filter((o) => {
      if (seen.has(o.url)) return false;
      seen.add(o.url);
      return true;
    })
    .filter((o) => o.metaAbsente || /^france$/i.test(o.pays) || FRANCE_LOCATION_RE.test(o.ville))
    .filter((o) => isFinanceOfferFor(emp, o.title, o.entite))
    .map((o) => ({ __src: `talentsoft:${host}`, emp, raw: o }));
}

// Phenom People — plateforme carrières utilisée par de grands groupes
// (AXA...). Elle expose une API JSON publique sur le domaine carrières :
//   GET https://{host}/api/jobs?country=France&limit=...
// robots.txt d'AXA : "Allow: /" avec "crawl-delay: 5" — accès explicitement
// autorisé, on respecte le délai demandé entre les pages.
// Phenom se décline en deux générations d'API. La première expose /api/jobs ;
// la seconde, /api/apply/v2/jobs/{pid}/jobs, où pid identifie le portail de la
// maison — il se lit dans les requêtes que leur page carrières effectue. Les
// deux vivent dans le même connecteur : c'est la plateforme qu'on branche, pas
// l'entreprise, et une maison de plus reste une ligne de configuration.
async function fetchPhenomV2({ host, pid, domain, emp, country = 'France' }) {
  let positions;
  try {
    const url =
      `https://${host}/api/apply/v2/jobs/${pid}/jobs` +
      `?domain=${encodeURIComponent(domain)}&location=${encodeURIComponent(country)}&num=200`;
    const json = await getJSON(url);
    positions = json.positions || [];
  } catch (err) {
    console.warn(`[sources] Phenom v2 (${emp}) indisponible:`, err.message);
    return [];
  }

  return positions
    .filter((p) => new RegExp(`\\b${country}\\b`, 'i').test(p.location || ''))
    .filter((p) => isFinanceOfferFor(emp, p.name, p.business_unit || p.department || ''))
    .map((p) => ({ __src: `phenom:${host}`, emp, raw: p }));
}

// Troisième forme : le point d'entrée « widgets », interrogé en POST avec la
// charge utile standard de Phenom. C'est celle des sites récents (BCG), et elle
// pagine par tranches de 30. Comme les deux autres, une maison de plus n'est
// qu'une ligne de configuration.
async function fetchPhenomWidgets({ host, emp, country = 'France', maxPages = 12 }) {
  const jobs = [];
  try {
    for (let page = 0; page < maxPages; page++) {
      const corps = {
        lang: 'en_global', deviceType: 'desktop', country: 'global',
        pageName: 'search-results', ddoKey: 'refineSearch', sortBy: '', subsearch: '',
        from: page * 30, jobs: true, counts: true,
        all_fields: ['country', 'city', 'category'], size: 30, clearAll: false,
        jdsource: 'facets', isSliderEnable: false, pageId: 'page11',
        siteType: 'external', keywords: '', global: true,
        selected_fields: { country: [country] }, locationData: {},
      };
      const res = await fetchAvecReprise(`https://${host}/widgets`, {
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; JJ job board)',
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const lot = ((json.refineSearch || {}).data || {}).jobs || [];
      if (!lot.length) break;
      jobs.push(...lot);
      if (lot.length < 30) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    console.warn(`[sources] Phenom widgets (${emp}) indisponible:`, err.message);
    return jobs.length ? finaliserPhenomWidgets(jobs, host, emp, country) : [];
  }
  return finaliserPhenomWidgets(jobs, host, emp, country);
}

// L'API widgets ne renvoie qu'une URL de CANDIDATURE — chez Allianz le
// formulaire SuccessFactors, chez BCG un espace candidat qui demande de se
// connecter. Ni l'une ni l'autre ne montre l'annonce, alors que c'est tout
// ce que le visiteur veut voir avant de décider.
//
// Phenom construit l'adresse publique de chaque annonce à partir de
// `jobSeqNo` et du titre : /<pays>/<langue>/job/<jobSeqNo>/<titre-en-slug>.
// La locale porte les deux premiers segments (« en_GLOBAL » -> /global/en).
function urlFichePhenom(host, job) {
  if (!job || !job.jobSeqNo) return null;
  const [langue, pays] = String(job.locale || 'en_GLOBAL').split('_');
  const slug = String(job.title || 'poste')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (
    `https://${host}/${(pays || 'global').toLowerCase()}/${(langue || 'en').toLowerCase()}` +
    `/job/${encodeURIComponent(job.jobSeqNo)}/${slug}`
  );
}

function finaliserPhenomWidgets(jobs, host, emp, country) {
  return jobs
    .filter((j) => new RegExp(`^${country}$`, 'i').test(String(j.country || '')))
    .filter((j) => isFinanceOfferFor(emp, j.title, j.category || ''))
    .map((j) => ({
      __src: `phenom:${host}`,
      emp,
      raw: { ...j, __urlFiche: urlFichePhenom(host, j) },
    }));
}

async function fetchPhenom({ host, emp, country = 'France', crawlDelayMs = 5000, pid, domain, widgets }) {
  // Portails de deuxième et troisième génération : on passe la main.
  if (widgets) return fetchPhenomWidgets({ host, emp, country });
  if (pid) return fetchPhenomV2({ host, pid, domain: domain || host, emp, country });

  const all = [];
  const pageSize = 100;
  try {
    for (let offset = 0; offset < 2000; offset += pageSize) {
      const url = `https://${host}/api/jobs?country=${encodeURIComponent(country)}&limit=${pageSize}&offset=${offset}`;
      const json = await getJSON(url);
      const page = (json.jobs || []).map((j) => j.data || j);
      all.push(...page);
      if (page.length < pageSize) break;
      if (json.totalCount > 0 && all.length >= json.totalCount) break;
      await new Promise((r) => setTimeout(r, crawlDelayMs));
    }
  } catch (err) {
    console.warn(`[sources] Phenom (${host}) indisponible:`, err.message);
    return [];
  }

  return all
    .filter((j) => (j.country || '').toLowerCase() === country.toLowerCase())
    .filter((j) => isFinanceOfferFor(emp, j.title, (j.categories || j.category || []).join(' ')))
    .map((j) => ({ __src: `phenom:${host}`, emp, raw: j }));
}

// ---------------------------------------------------------------------------
// Radancy — la plateforme carrières de plusieurs grands groupes (McDonald's,
// Nestlé, Atos, Bouygues Telecom, Alstom). Adresses de la forme
// `/job/{VILLE}-{Titre}-{CodePostal}/{identifiant}/`.
//
// Ni API ni JSON-LD — c'est pourquoi le connecteur « sitemap + JSON-LD » ne
// rendait rien chez Atos. En revanche le sitemap est complet, et chaque fiche
// porte son titre en `og:title` et sa date de publication en clair.
// ---------------------------------------------------------------------------

// Le titre figure dans l'adresse ET dans og:title. En retirant le second du
// premier, il reste la ville devant et le code postal derrière — plus sûr que
// de découper au tiret, que « Issy-les-Moulineaux » contient deux fois.
function lieuDepuisAdresseRadancy(segment, titre) {
  const plat = (x) =>
    String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const segmentPlat = plat(segment);
  const titrePlat = plat(titre);
  let ville = segment;
  const i = titrePlat ? segmentPlat.indexOf(titrePlat) : -1;
  if (i > 0) {
    // On recoupe le segment d'origine à la même proportion de caractères.
    let vus = 0;
    let coupe = segment.length;
    for (let k = 0; k < segment.length; k++) {
      if (/[a-z0-9]/i.test(segment[k].normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) vus++;
      if (vus > i) { coupe = k; break; }
    }
    ville = segment.slice(0, coupe);
  }
  const propre = ville.replace(/[-_]+/g, ' ').replace(/\s*\d{5}\s*$/, '').replace(/\s+/g, ' ').trim();
  // Une voie n'est pas une commune : « 13 AVENUE DU MARECHAL JUIN » ne se
  // range dans aucune zone et n'apprend rien au candidat. Le code postal du
  // segment, lui, suffit au pipeline pour situer l'offre.
  const estUneVoie = /^\d|\b(?:avenue|rue|boulevard|bd|place|chemin|route|quai|impasse|allee|all[ée]e)\b/i.test(propre);
  if (estUneVoie) {
    const cp = (segment.match(/\b((?:0[1-9]|[1-8]\d|9[0-5])\d{3})\b/) || [])[1];
    if (cp) return cp;
  }
  return propre;
}

async function fetchRadancy({ host, emp, maxFiches = 80, delayMs = 250 }) {
  let sitemap;
  try {
    const r = await fetchAvecReprise(`https://${host}/sitemap.xml`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    sitemap = await r.text();
  } catch (err) {
    console.warn(`[sources] Radancy (${host}) indisponible:`, err.message);
    return [];
  }

  const adresses = [...sitemap.matchAll(/<loc>([^<]*\/job\/[^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, '&')
  );

  // Premier tri sur l'adresse seule : le slug porte le métier et le code
  // postal. Sans lui on irait chercher neuf cent soixante-deux fiches chez
  // Atos pour en retenir une poignée.
  const candidates = [];
  for (const adresse of adresses) {
    const segment = decodeURIComponent((adresse.match(/\/job\/([^/]+)\//) || [])[1] || '');
    if (!segment) continue;
    const texte = segment.replace(/[-_]+/g, ' ');
    // Deux repères plutôt qu'un : le code postal métropolitain seul laissait
    // passer l'Espagne et la Malaisie, qui en ont d'identiques. La liste de
    // villes françaises est celle qui sert déjà aux autres connecteurs.
    if (!/\b(?:0[1-9]|[1-8]\d|9[0-5])\d{3}\b/.test(segment)) continue;
    if (!FRANCE_LOCATION_RE.test(texte)) continue;
    if (!isFinanceOfferFor(emp, texte, '')) continue;
    candidates.push({ adresse, segment });
  }

  const offres = [];
  for (const { adresse, segment } of candidates.slice(0, maxFiches)) {
    try {
      const r = await fetchAvecReprise(adresse, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      const titre =
        (html.match(/property="og:title"\s+content="([^"]+)"/) || [])[1] ||
        ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').split('Détails du poste')[0];
      if (!titre) continue;
      const brutDate = (html.match(/\b[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{2}:\d{2}:\d{2} [A-Z]{3} \d{4}\b/) || [])[0];
      offres.push({
        __src: `radancy:${host}`,
        emp,
        raw: {
          title: decodeEntitesSimples(titre.trim()),
          ville: lieuDepuisAdresseRadancy(segment, titre),
          url: adresse,
          datePublication: brutDate || null,
        },
      });
    } catch {
      /* fiche injoignable : on passe, sans faire échouer la source */
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return offres;
}

// Les fiches Radancy encodent quelques entités dans leur og:title.
function decodeEntitesSimples(x) {
  return String(x)
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è');
}

// Ashby — ATS moderne, très utilisé par les scale-ups. Endpoint public
// documenté, renvoie directement l'URL de l'annonce et la localisation.
// Fiable pour la détection : répond 404 sur un identifiant inexistant.
async function fetchAshby({ company, emp }) {
  try {
    const json = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${company}`);
    return (json.jobs || [])
      .filter((o) => o.isListed !== false)
      .filter((o) => FRANCE_LOCATION_RE.test([o.location, ...(o.secondaryLocations || []).map((l) => l.location || '')].join(' ')))
      .filter((o) => isFinanceOfferFor(emp, o.title, o.department, o.team))
      .map((o) => ({ __src: `ashby:${company}`, emp, raw: o }));
  } catch (err) {
    console.warn(`[sources] Ashby (${company}) indisponible:`, err.message);
    return [];
  }
}

// Teamtailor — flux JSON Feed public du site carrières.
// La localisation n'est pas dans les champs du feed lui-même mais dans le bloc
// schema.org `_jobposting.jobLocation` : indispensable ici, car ces flux
// mélangent les pays (PayFit publie France + Espagne + UK sur le même flux) et
// JJ ne référence que la France.
function teamtailorPlace(item) {
  const loc = (item._jobposting || {}).jobLocation;
  const addr = (Array.isArray(loc) ? loc[0] : loc || {}).address || {};
  return { city: addr.addressLocality || '', country: addr.addressCountry || '' };
}

async function fetchTeamtailor({ company, emp }) {
  try {
    const json = await getJSON(`https://${company}.teamtailor.com/jobs.json`);
    return (json.items || [])
      .map((o) => ({ item: o, place: teamtailorPlace(o) }))
      .filter(({ place }) => place.country === 'FR')
      .filter(({ item }) => isFinanceOfferFor(emp, item.title))
      .map(({ item, place }) => ({
        __src: `teamtailor:${company}`,
        emp,
        raw: { ...item, city: place.city },
      }));
  } catch (err) {
    console.warn(`[sources] Teamtailor (${company}) indisponible:`, err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Avature — TotalEnergies, L'Oréal et plusieurs autres grands groupes français.
//
// Ces portails n'ont NI API publique NI JSON-LD sur les fiches. En revanche
// leur robots.txt autorise explicitement /careers et publie un sitemap par
// langue, et chaque fiche affiche ses caractéristiques dans des paires
// <dt>libellé</dt><dd>valeur</dd> — dont "Pays", "Lieu de travail", "Type de
// contrat" et, cadeau, "Expérience" ("Moins de 3 ans").
//
// Le sitemap contient l'intitulé du poste dans l'URL. On s'en sert pour ne
// TÉLÉCHARGER que les fiches plausibles (finance / junior) : sur 1 057 fiches
// TotalEnergies, ça descend à ~200 requêtes au lieu de tout aspirer.
// ---------------------------------------------------------------------------

// Indice de "francité" d'un slug de fiche : les portails Avature sont mondiaux
// et le titre est le seul signal disponible avant de télécharger la page.
function scoreSlugFr(u) {
  return (
    (/alternance|apprenti|stage|stagiaire|charg|chef-de|responsable|conseiller|juriste|comptab|tr-sorerie|gestionnaire|analyste|d-butant/i.test(u) ? 2 : 0) +
    (/-h-f|-f-h|-hf$/i.test(u) ? 1 : 0)
  );
}

// Filtre grossier appliqué au slug de l'URL, avant tout téléchargement.
const AVATURE_SLUG_INTERESSANT =
  /financ|audit|comptab|accounting|gestion|controlling|controller|contr-le|tr-sorerie|treasury|fiscal|tax|risque|risk|conformit|compliance|stage|intern|alternance|apprentice|analyst|analyste|junior|graduate|m-a|invest/i;

// En-tête commune aux connecteurs qui lisent du HTML plutôt qu'une API.
const UA_HTML = 'Mozilla/5.0 (compatible; JJ job board)';

// Les fiches Avature sont du HTML brut : &amp;, &#39;, &eacute; s'y baladent.
function decodeEntities(t) {
  return (t || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// Deux mises en page cohabitent sur Avature selon le portail :
//   - TotalEnergies affiche les caractéristiques en <dt>libellé</dt><dd>valeur</dd> ;
//   - L'Oréal ne les affiche pas du tout, mais pousse un objet dataLayer
//     (jobCountry, jobLocation, jobPositionType) pour son marquage analytique.
// On lit les deux, sinon on ne saurait pas dans quel pays est le poste — et une
// offre dont on ne peut pas confirmer qu'elle est en France n'entre pas.
function avatureChamps(html) {
  const champs = {};
  for (const m of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    const cle = decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()).toLowerCase();
    const val = decodeEntities(m[2].replace(/<[^>]+>/g, '').trim());
    if (cle && val && !champs[cle]) champs[cle] = val;
  }

  const dl = html.match(/dataLayer\.push\s*\(\s*\{([\s\S]{0,1500}?)\}\s*\)/);
  if (dl) {
    for (const m of dl[1].matchAll(/(\w+)\s*:\s*"([^"]*)"/g)) {
      const cle = { jobCountry: 'pays', jobLocation: 'lieu de travail', jobPositionType: 'type de contrat', jobEmploymentType: 'temps de travail' }[m[1]];
      if (cle && m[2] && !champs[cle]) champs[cle] = decodeEntities(m[2]);
    }
  }
  return champs;
}

// "SOLAIZE-CHEMIN DU CANAL(FRA)" -> "Solaize" ; "Paris, Île-de-France" -> "Paris".
// Attention : on ne peut pas couper sur le premier tiret venu, sinon
// "Île-de-France" devient "Île" et "Aix-en-Provence" devient "Aix". On coupe
// donc d'abord sur la virgule (forme "Ville, Région"), et seulement ensuite sur
// le tiret de la forme "VILLE-ADRESSE" propre à TotalEnergies, qui est toute en
// majuscules.
function avatureVille(brut) {
  let v = (brut || '').replace(/\([A-Z]{2,4}\)\s*$/, '').trim();
  v = v.split(',')[0].trim();
  if (v === v.toUpperCase()) v = v.split(/\s*-\s*/)[0].trim();
  return v
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])([a-zà-öø-ÿ])/g, (_, sep, c) => sep + c.toUpperCase())
    // Les particules des noms composés redescendent en minuscules :
    // Aix-en-Provence, Boulogne-sur-Mer, Neuilly-sur-Seine.
    .replace(/-(En|De|Du|Des|La|Le|Les|Sur|Sous|Aux|Lès)(?=-|$)/g, (_, mot) => '-' + mot.toLowerCase());
}

// Cache des fiches Avature déjà lues.
//
// Une annonce ne change plus une fois publiée. Sans cache, chaque passage
// quotidien retéléchargeait 200 fiches par maison — TotalEnergies a fini par
// répondre 406 à toutes nos requêtes, et il avait raison. Avec le cache, le
// premier passage paie le coût, les suivants ne vont chercher que les URL
// nouvelles (une poignée par jour). Les entrées absentes du sitemap du jour
// sont oubliées : le fichier ne gonfle pas indéfiniment.
const CACHE_AVATURE_PATH = path.join(__dirname, 'cache-avature.json');

function chargerCacheAvature() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_AVATURE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function sauverCacheAvature(cache) {
  try {
    fs.writeFileSync(CACHE_AVATURE_PATH, JSON.stringify(cache));
  } catch (err) {
    console.warn('[sources] cache Avature non écrit :', err.message);
  }
}

async function fetchAvature({ sitemap, emp, maxFiches = 150, concurrence = 1, delayMs = 1200 }) {
  try {
    const res = await fetch(sitemap, { headers: { 'user-agent': UA_HTML }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error('sitemap HTTP ' + res.status);
    const xml = await res.text();

    // Ces sitemaps sont mondiaux (L'Oréal : 1 736 fiches, une poignée en France).
    // On lit d'abord les fiches dont le titre est en français : c'est le meilleur
    // indice disponible avant téléchargement, et ça évite de dépenser le budget
    // de requêtes sur des postes à Copenhague ou Taipei.
    const fiches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => /JobDetail\//.test(u))
      .filter((u) => AVATURE_SLUG_INTERESSANT.test(u))
      .sort((a, b) => scoreSlugFr(b) - scoreSlugFr(a))
      .slice(0, maxFiches);

    const cacheGlobal = chargerCacheAvature();
    const cacheMaison = cacheGlobal[emp] || {};
    const nouveauCache = {};
    const aTelecharger = [];

    for (const url of fiches) {
      if (cacheMaison[url]) nouveauCache[url] = cacheMaison[url];
      else aTelecharger.push(url);
    }

    let i = 0;
    await Promise.all(
      Array.from({ length: concurrence }, async () => {
        while (i < aTelecharger.length) {
          const url = aTelecharger[i++];
          await new Promise((r) => setTimeout(r, delayMs));
          try {
            const r = await fetch(url, { headers: { 'user-agent': UA_HTML }, signal: AbortSignal.timeout(20000) });
            // 406/429 = le portail nous demande de lever le pied. On arrête là
            // pour cette maison plutôt que d'insister 150 fois.
            if (r.status === 406 || r.status === 429) {
              console.warn(`[sources] Avature (${emp}) nous limite (HTTP ${r.status}) — arrêt du passage.`);
              i = aTelecharger.length;
              break;
            }
            if (!r.ok) continue;
            const html = await r.text();
            const champs = avatureChamps(html);
            const pays = champs['pays'] || champs['country'] || '';
            // og:title ajoute souvent le nom du portail : "Poste | L'Oréal Careers".
            const titre = decodeEntities(
              (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || ''
            )
              .replace(/\s*\|[^|]*$/, '')
              .trim();
            nouveauCache[url] = {
              titre,
              pays,
              lieu: avatureVille(champs['lieu de travail'] || champs['location'] || ''),
              contrat: champs['type de contrat'] || champs['contract type'] || '',
              experience: champs['expérience'] || champs['experience'] || '',
              domaine: champs['domaine'] || '',
            };
          } catch {
            /* une fiche qui tombe ne doit pas emporter la maison entière */
          }
        }
      })
    );

    cacheGlobal[emp] = nouveauCache;
    sauverCacheAvature(cacheGlobal);

    const offres = [];
    for (const [url, f] of Object.entries(nouveauCache)) {
      // Pas de pays lisible = on ne peut pas garantir que c'est en France.
      // Ces portails sont mondiaux : dans le doute, on n'ingère pas.
      if (!f.titre || !/^france$/i.test(f.pays || '')) continue;
      // Même filtre finance que les autres connecteurs : sans lui, un stage de
      // communication chez L'Oréal entrait sur le site.
      if (!isFinanceOfferFor(emp, f.titre, f.domaine)) continue;
      offres.push({
        __src: 'avature',
        emp,
        raw: {
          title: f.titre,
          location: f.lieu,
          contract: f.contrat,
          experience: f.experience,
          url,
        },
      });
    }

    return offres;
  } catch (err) {
    console.warn(`[sources] Avature (${emp}) indisponible:`, err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Choisir le service public — AMF, Caisse des Dépôts, Direction générale du
// Trésor (qui abrite l'Agence France Trésor).
//
// Exception assumée à la règle du lien direct. Ces institutions n'ont PAS de
// site carrières propre : le portail de l'État est leur unique canal de
// publication, il n'y a donc pas d'annonce "chez l'employeur" à préférer. Le
// candidat le saura : la carte porte un badge "via Service Public", comme pour
// France Travail et Adzuna.
//
// Le robots.txt n'interdit que /wp-admin/ et les PDF. La liste est rendue côté
// serveur, filtrable par organisme : /nos-offres/filtres/organisme/{id}/ —
// l'identifiant vient des cases à cocher "employeur" du moteur de recherche.
// Chaque carte porte l'intitulé, le lieu, l'employeur et la date de mise en
// ligne : aucune fiche à visiter, une requête par page suffit.
// ---------------------------------------------------------------------------

const MOIS_FR = {
  janvier: 0, 'février': 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, 'août': 7, aout: 7, septembre: 8, octobre: 9, novembre: 10,
  'décembre': 11, decembre: 11,
};

// "En ligne depuis le 30 juin 2026" -> date ISO.
function dateServicePublic(txt) {
  const m = /en ligne depuis le (\d{1,2}) ([a-zà-ÿ]+) (\d{4})/i.exec(txt || '');
  if (!m) return null;
  const mois = MOIS_FR[m[2].toLowerCase()];
  if (mois === undefined) return null;
  return new Date(Date.UTC(+m[3], mois, +m[1])).toISOString();
}

function texteBrut(html) {
  return decodeEntities((html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

async function fetchServicePublic({ organisme, emp, maxPages = 5, delayMs = 800 }) {
  if (!AGREGATEURS_PUBLICS_ACTIFS) return [];
  const offres = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const url =
        `https://choisirleservicepublic.gouv.fr/nos-offres/filtres/organisme/${organisme}/` +
        (page > 1 ? `page/${page}/` : '');
      const res = await fetch(url, { headers: { 'user-agent': UA_HTML }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) break;
      const html = await res.text();

      // Chaque offre est une carte <div class="... fr-card--offer"> ... </div>.
      // On découpe sur le marqueur d'ouverture plutôt que d'essayer d'apparier
      // les balises : le HTML est généré, la structure est stable.
      const morceaux = html.split('fr-card--offer').slice(1);
      if (morceaux.length === 0) break;

      for (const bloc of morceaux) {
        const carte = bloc.slice(0, 4000);
        // Le HTML est indenté à la tabulation : l'attribut href peut être séparé
        // du <a> par plusieurs retours à la ligne. On tolère l'espace.
        const lien = /<a\s[^>]*href="(https:\/\/choisirleservicepublic\.gouv\.fr\/offre-emploi\/[^"]+)"/.exec(carte);
        if (!lien) continue;
        const titreBrut = /<h3 class="fr-card__title">([\s\S]*?)<\/h3>/.exec(carte);
        const titre = titreBrut ? texteBrut(titreBrut[1]) : '';
        if (!titre) continue;

        // Les <li> de la description portent chacun un libellé lecteur d'écran.
        const champ = (etiquette) => {
          const re = new RegExp('<span class="sr-only">' + etiquette + '\\s*:\\s*<\\/span>([\\s\\S]*?)<\\/li>', 'i');
          const m = re.exec(carte);
          return m ? texteBrut(m[1]) : '';
        };
        const lieu = champ('Localisation').replace(/\s*\(\d{2,3}\)\s*$/, '').trim();
        const employeur = champ('Employeur');
        const domaine = (/(class="fr-tag[^"]*"\s*>)([\s\S]*?)<\/p>/.exec(carte) || [])[2];

        const dateLi = /<li class="fr-icon-calendar-line[^"]*">([\s\S]*?)<\/li>/.exec(carte);
        const postedAt = dateServicePublic(dateLi ? texteBrut(dateLi[1]) : '');

        if (!isFinanceOfferFor(emp, titre, domaine || '')) continue;

        offres.push({
          __src: 'servicepublic',
          emp,
          raw: {
            title: titre,
            // On garde le nom exact renvoyé par le portail quand il est là :
            // "Autorité des Marchés Financiers (AMF)" vaut mieux que notre
            // étiquette interne.
            employeur: employeur || emp,
            location: lieu,
            domaine: domaine ? texteBrut(domaine) : '',
            postedAt,
            url: lien[1],
          },
        });
      }

      // Dernière page atteinte ?
      const titrePage = /<title>([^<]*)<\/title>/.exec(html);
      const pagination = /page (\d+) sur (\d+)/i.exec(titrePage ? titrePage[1] : '');
      if (!pagination || +pagination[1] >= +pagination[2]) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return offres;
  } catch (err) {
    console.warn(`[sources] Service Public (${emp}) indisponible:`, err.message);
    return offres;
  }
}

// Exécute des tâches par vagues, jamais plus de `largeur` à la fois.
// Les tâches sont des fonctions, pas des promesses : une promesse est déjà
// lancée au moment où on la crée, et tout serait reparti d'un coup.
async function enFile(taches, largeur) {
  const resultats = new Array(taches.length);
  let curseur = 0;
  await Promise.all(
    Array.from({ length: Math.min(largeur, taches.length) }, async () => {
      while (curseur < taches.length) {
        const i = curseur++;
        resultats[i] = await taches[i]();
      }
    })
  );
  return resultats;
}

// Le 1er septembre 2026, une trentaine d'hôtes ont répondu « fetch failed »
// simultanément sur le runner GitHub — Workday en entier, Goldman, BPCE,
// Phenom, Eightfold. Aucun code HTTP : la connexion n'aboutissait pas. Le
// pipeline lançait alors ses 151 connecteurs d'un seul coup, et la lecture des
// fiches SmartRecruiters, ajoutée la veille, y ajoutait sa propre rafale. La
// machine a saturé, et le catalogue a été publié amputé de 28 %.
//
// Rien n'oblige à tout demander en même temps : le passage a la nuit devant
// lui. On borne donc les requêtes simultanées — c'est aussi plus courtois pour
// les sites interrogés, dont certains nous avaient déjà répondu 403.
const CONCURRENCE_ATS = 8;

// ---------------------------------------------------------------------------
// WordPress REST — les sites carrières bâtis sur WordPress
//
// WordPress expose chaque type d'article en JSON, sans clé ni compte :
//     https://{host}/wp-json/wp/v2/{type}?per_page=100&page=N
//
// L'en-tête « x-wp-totalpages » dit combien de pages lire, donc on ne devine
// pas. Les champs métier sont dans « acf » (Advanced Custom Fields, l'extension
// que tous ces sites emploient) ; on retombe sur le titre WordPress si elle
// manque.
//
// Avantage sur la lecture du HTML : la réponse porte le TEXTE de l'annonce.
// Un CDI peut donc être jugé sur son contenu par le filtre 0-3 ans, au lieu de
// passer sur la foi de son seul intitulé.
async function fetchWordpressOffres({ host, emp, type = 'offre', maxPages = 12 }) {
  const retenues = [];
  for (let page = 1; page <= maxPages; page++) {
    let res;
    try {
      res = await fetchAvecReprise(`${host}/wp-json/wp/v2/${type}?per_page=100&page=${page}`, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; JJ job board)', accept: 'application/json' },
        signal: AbortSignal.timeout(25000),
      });
    } catch (err) {
      console.warn(`[sources] WordPress ${emp} indisponible :`, err.message);
      break;
    }
    if (!res.ok) {
      if (page === 1) console.warn(`[sources] WordPress ${emp} : HTTP ${res.status}.`);
      break;
    }
    let items;
    try {
      items = await res.json();
    } catch {
      break;
    }
    if (!Array.isArray(items) || !items.length) break;

    for (const it of items) {
      const acf = it.acf || {};
      const titre = decodeEntitesSimples(acf.job_label || (it.title && it.title.rendered) || '');
      const url = it.link;
      if (!titre || !url) continue;
      const entite = decodeEntitesSimples(acf.employer_name || '');
      if (!isFinanceOfferFor(entite || emp, titre)) continue;
      retenues.push({
        __src: `wordpress:${emp}`,
        emp,
        raw: {
          titre,
          url,
          entite,
          lieu: decodeEntitesSimples(acf.employer_ville || ''),
          type: acf.contract_type || '',
          date: acf.date_publication || it.date || '',
          description: acf.job_description || '',
        },
      });
    }

    const pages = Number(res.headers.get('x-wp-totalpages') || 1);
    if (page >= pages) break;
  }

  if (!retenues.length) {
    console.warn(`[sources] WordPress ${emp} : aucune offre — type d'article peut-être renommé.`);
  }
  return retenues;
}

async function fetchAllATS(recoltes = {}) {
  // Chaque connecteur a sa propre entrée dans le magasin : quand un tenant
  // Workday tombe, lui seul reprend sa récolte de la veille, les 150 autres
  // sont rafraîchis normalement. C'est ce grain fin qui rendra possible la
  // collecte étalée sur la journée.
  const groupes = [
    ['greenhouse', fetchGreenhouse],
    ['lever', fetchLever],
    ['smartrecruiters', fetchSmartRecruiters],
    ['workday', fetchWorkday],
    ['opendatasoft', fetchOpenDataSoft],
    ['recruitee', fetchRecruitee],
    ['cornerstone', fetchCornerstone],
    ['oraclecloud', fetchOracleCloud],
    ['teamtailor', fetchTeamtailor],
    ['ashby', fetchAshby],
    ['phenom', fetchPhenom],
    ['talentsoft', fetchTalentSoft],
    ['successfactors', fetchSuccessFactors],
    ['radancy', fetchRadancy],
    ['sitemapld', fetchSitemapJsonLd],
    ['eicards', fetchEiCards],
    ['avature', fetchAvature],
    ['servicepublic', fetchServicePublic],
    ['wordpress', fetchWordpressOffres],
  ];

  const taches = [];
  for (const [famille, fn] of groupes) {
    for (const cfg of TARGET_COMPANIES[famille]) {
      const nom = `${famille}:${cfg.id || cfg.emp || cfg.host || cfg.tenant || 'x'}`;
      taches.push(() => recolter(nom, recoltes, () => fn(cfg)));
    }
  }

  // Relevé des familles réellement mises en file. Une famille configurée mais
  // absente d'ici ne sera jamais interrogée, et rien ne le signalerait : le
  // connecteur Radancy est resté muet un après-midi entier pour une raison
  // que ce compte aurait donnée tout de suite.
  {
    const parFamille = {};
    for (const [famille] of groupes) parFamille[famille] = (TARGET_COMPANIES[famille] || []).length;
    console.log(
      '[sources] Familles mises en file : ' +
        Object.entries(parFamille).map(([k, v]) => k + ' ' + v).join(', ')
    );
  }

  if (taches.length === 0) return DEMO_DATA ? SAMPLE_ATS : [];
  const results = await enFile(taches, CONCURRENCE_ATS);
  return results.flat();
}

// ---------------------------------------------------------------------------
// Point d'entrée : agrège toutes les sources (brutes, non normalisées)
// ---------------------------------------------------------------------------
function fetchManual() {
  return MANUAL_OFFERS.map((o) => ({ __src: 'manuel', emp: o.emp, raw: o }));
}

// ---------------------------------------------------------------------------
// VIE — Business France (portail Mon VIE-VIA / API Civiweb)
//
// Mode "référencement seul" (voie B) : on n'affiche que titre, entreprise, lieu
// et durée, et le clic renvoie TOUJOURS vers la fiche officielle pour
// candidater. On ne reproduit PAS la description de la mission (contenu de
// Business France) — c'est ce qui distingue le référencement de la
// republication, et ce qui rend l'usage défendable sans accord préalable.
//
// Stratégie : le vivier VIE mondial est petit (~660 offres tous secteurs) et
// l'API renvoie un champ `count` avec le total. Plutôt que d'interroger par
// mots-clés — où chaque terme est PLAFONNÉ à 50 résultats (on perdait ainsi
// jusqu'à ~90 offres sur un mot large comme "analyst") — on récupère TOUT le
// vivier page par page, puis on filtre finance en local avec le même filtre
// que les autres sources. Résultat : couverture finance exhaustive, aucun trou.
const VIE_API_URL = 'https://civiweb-api-prd.azurewebsites.net/api/Offers/search';
const VIE_API_KEY = process.env.VIE_API_KEY || '';

async function fetchViePage(query, skip, limit) {
  const res = await fetchAvecReprise(VIE_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'X-API-KEY': VIE_API_KEY },
    body: JSON.stringify({
      limit,
      skip,
      query,
      activitySectorId: [],
      missionsTypesIds: [],
      missionsDurations: [],
      gerographicZones: [],
      countriesIds: [],
      studiesLevelId: [],
      companiesSizes: [],
      specializationsIds: [],
      entreprisesIds: [0],
      missionStartDate: null,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchVie() {
  if (!VIE_API_KEY) return DEMO_DATA ? [] : [];

  const parId = new Map();
  let total = Infinity;
  let echec = false;

  // Pagination complète : on suit le `count` renvoyé par l'API. Garde-fou à
  // 2000 (soit ~40 pages) au cas où le total exploserait un jour — le pipeline
  // ne doit jamais boucler sans fin.
  for (let skip = 0; skip < total && skip < 2000; skip += 50) {
    let j;
    try {
      j = await fetchViePage('', skip, 50);
    } catch {
      // Un échec réseau en cours de route : on garde ce qu'on a déjà et on sort.
      echec = true;
      break;
    }
    total = j.count || 0;
    const lot = j.result || [];
    if (!lot.length) break;
    for (const o of lot) {
      if (o.id && !parId.has(o.id)) parId.set(o.id, o);
    }
    // Petit délai entre les pages pour rester sous la limite de débit de l'API.
    await new Promise((r) => setTimeout(r, 120));
  }

  if (echec) {
    console.warn('[sources] VIE (Business France) : pagination interrompue (réseau), le reste est conservé.');
  }

  // On filtre finance avec le même filtre que les autres sources, sur
  // l'intitulé de mission. Le vivier VIE couvre tous les secteurs ; ce filtre
  // ne retient que la finance / comptabilité / marchés / assurance / économie.
  return [...parId.values()]
    .filter((o) => isFinanceOfferFor(o.organizationName, o.missionTitle))
    .map((o) => ({ __src: 'vie', emp: o.organizationName, raw: o }));
}

// ---------------------------------------------------------------------------
// Magasin des récoltes
// ---------------------------------------------------------------------------
// Chaque source y dépose sa dernière moisson réussie. Deux usages, l'un
// immédiat, l'autre à venir.
//
// Aujourd'hui : quand une source échoue — panne réseau, API fermée — on
// republie sa dernière récolte au lieu de rendre une liste vide. Sans ce
// magasin, un seul connecteur capricieux fait chuter le catalogue et le
// garde-fou bloque alors TOUTE la mise à jour : le site se fige entièrement à
// cause d'une source sur cent cinquante.
//
// Demain : c'est ce qui permettra d'étaler la collecte dans la journée — BNP et
// Rothschild à 7h, Crédit Agricole à 8h — chaque passage ne rafraîchissant que
// ses sources tout en publiant le catalogue complet, lu ici.
//
// Une récolte trop vieille n'est plus servie : mieux vaut un catalogue amputé,
// que le garde-fou verra, qu'un catalogue plein d'offres pourvues depuis une
// semaine.
const zlib = require('zlib');
const RECOLTES_PATH = path.join(__dirname, 'cache-recoltes.json.gz');
const RECOLTE_MAX_JOURS = 4;

function lireRecoltes() {
  try {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(RECOLTES_PATH)).toString('utf8'));
  } catch {
    return {}; // premier passage, ou cache illisible : on repart de zéro
  }
}

function ecrireRecoltes(recoltes) {
  try {
    fs.writeFileSync(RECOLTES_PATH, zlib.gzipSync(JSON.stringify(recoltes)));
  } catch (err) {
    console.warn('[sources] magasin des récoltes non écrit :', err.message);
  }
}

// Exécute une source et range son résultat. En cas d'échec ou de moisson vide,
// ressort la dernière récolte connue si elle est encore fraîche.
async function recolter(nom, recoltes, fn) {
  let obtenu = null;
  try {
    obtenu = await fn();
  } catch (err) {
    console.warn(`[sources] ${nom} a échoué :`, err.message);
  }

  if (obtenu && obtenu.length) {
    recoltes[nom] = { le: new Date().toISOString(), offres: obtenu };
    return obtenu;
  }

  const precedente = recoltes[nom];
  if (!precedente) return [];
  const jours = (Date.now() - new Date(precedente.le).getTime()) / 86400000;
  if (jours > RECOLTE_MAX_JOURS) {
    console.warn(`[sources] ${nom} muette et sa dernière récolte a ${Math.round(jours)} j : abandonnée.`);
    return [];
  }
  sourcesReprises.push({ nom, le: precedente.le, offres: precedente.offres.length, jours });
  console.warn(
    `[sources] ${nom} muette : on reprend sa récolte du ${precedente.le.slice(0, 10)} ` +
      `(${precedente.offres.length} offres).`
  );
  return precedente.offres;
}

// Sources servies depuis le magasin faute d'avoir répondu. Le catalogue reste
// complet, mais ces maisons ne sont plus à jour : sans ce relevé, l'une d'elles
// pourrait se dégrader quatre jours en silence avant que le garde-fou ne s'en
// aperçoive. Le passage doit le dire.
const sourcesReprises = [];

async function fetchAllSources() {
  const recoltes = lireRecoltes();
  sourcesReprises.length = 0;

  // Les grandes familles sont récoltées séparément : si l'une tombe, les
  // autres n'en savent rien et le magasin ne rend que celle-là périmée.
  const [franceTravail, lba, ats, adzuna, vie, listes, bpce, axafr, lvmh, tikehau, jef, evr, pwp, mck, yello, gs, ef, bofa] = await Promise.all([
    recolter('France Travail', recoltes, fetchFranceTravail),
    recolter('La Bonne Alternance', recoltes, fetchLaBonneAlternance),
    fetchAllATS(recoltes), // découpé par connecteur, chacun a sa propre entrée
    recolter('Adzuna', recoltes, fetchAdzuna),
    recolter('VIE (Business France)', recoltes, fetchVie),
    fetchToutesListesHtml(recoltes), // découpé par enseigne
    fetchToutesApisBpce(recoltes), //   idem
    recolter('AXA France', recoltes, fetchAxaFrance),
    recolter('LVMH', recoltes, fetchLvmh),
    recolter('Tikehau Capital (TalentView)', recoltes, () => fetchTalentView({ tenant: 'tikehau-capital-career', companyWebsiteId: 2718, emp: 'Tikehau Capital' })),
    // Deux banques d'affaires américaines qui recrutent des stagiaires en
    // banque d'investissement à Paris. Leur API ne renseigne pas le champ
    // « lieu » : c'est l'intitulé qui nomme le bureau (« Paris Off-Cycle
    // Internship »), et le connecteur sait déjà l'y lire.
    recolter('Jefferies', recoltes, () =>
      fetchTalentLink({ host: 'jefferies.tal.net', emp: 'Jefferies' })
    ),
    recolter('Evercore', recoltes, () =>
      fetchTalentLink({ host: 'evercore.tal.net', emp: 'Evercore' })
    ),
    recolter('Perella Weinberg', recoltes, () =>
      Promise.all(
        [1, 2, 3].map((board) =>
          fetchTalentLink({ host: 'pwpcareers.tal.net', board, emp: 'Perella Weinberg' })
        )
      ).then((lots) => lots.flat())
    ),
    // McKinsey est coupé. Leur API de recherche continue de servir des postes
    // que leur propre site déclare fermés : « This position is no longer
    // available ». Deux offres différentes l'ont montré à deux jours d'écart,
    // dont une qui passait tous nos filtres (moins de 5 villes, date valide).
    // La page ne le dit qu'une fois le JavaScript exécuté : aucun contrôle
    // possible côté serveur, donc aucun moyen de savoir si un lien est vivant.
    //
    // Un lien mort ruine la seule promesse de JJ. Trois offres ne valent pas ça.
    // À rouvrir le jour où McKinsey expose un état de publication fiable.
    Promise.resolve([]),
    recolter('Yello', recoltes, fetchTousYello),
    recolter('Goldman Sachs', recoltes, fetchGoldmanSachs),
    recolter('Eightfold', recoltes, fetchTousEightfold),
    recolter('Bank of America', recoltes, fetchBankOfAmerica),
  ]);

  ecrireRecoltes(recoltes);
  return [...franceTravail, ...lba, ...ats, ...adzuna, ...vie, ...listes, ...bpce, ...axafr, ...lvmh, ...tikehau, ...jef, ...evr, ...pwp, ...mck, ...yello, ...gs, ...ef, ...bofa, ...fetchManual()];
}

// ---------------------------------------------------------------------------
// Données d'exemple — utilisées hors-ligne (pas de clé API / pas d'entreprise
// configurée). Couvrent les 3 volets ingérés, plusieurs familles métier et
// types de structure, + un cas de doublon (même poste vu par 2 sources) et un
// cas "senior" à filtrer pour tester la logique du pipeline.
// ---------------------------------------------------------------------------

const SAMPLE_FRANCE_TRAVAIL = [
  {
    __src: 'francetravail',
    raw: {
      id: 'ft-001',
      intitule: 'Stage Analyste Crédit F/H',
      entreprise: { nom: 'Société Générale CIB' },
      typeContrat: 'MIS', // stage
      lieuTravail: { libelle: 'Paris (75)' },
      lieuTravail_ville: 'Paris',
      salaire: { libelle: '1200€/mois' },
      dateActualisation: '2026-08-27T09:00:00.000Z',
      origineOffre: { urlOrigine: 'https://www.societegenerale.com/carrieres/offre/ft-001' },
      romeLibelle: 'Analyse et ingénierie financière',
    },
  },
  {
    __src: 'francetravail',
    raw: {
      id: 'ft-002',
      intitule: 'Contrôleur de Gestion Junior H/F (0-2 ans)',
      entreprise: { nom: 'TotalEnergies' },
      typeContrat: 'CDI',
      lieuTravail: { libelle: 'Courbevoie (92)' },
      lieuTravail_ville: 'Courbevoie',
      dateActualisation: '2026-08-26T09:00:00.000Z',
      origineOffre: { urlOrigine: 'https://www.francetravail.fr/offre/ft-002' },
      romeLibelle: 'Contrôle de gestion',
    },
  },
  {
    __src: 'francetravail',
    raw: {
      id: 'ft-003',
      intitule: 'Directeur Administratif et Financier Senior H/F (10 ans exp.)',
      entreprise: { nom: 'Groupe Industriel Confidentiel' },
      typeContrat: 'CDI',
      lieuTravail: { libelle: 'Lyon (69)' },
      lieuTravail_ville: 'Lyon',
      dateActualisation: '2026-08-20T09:00:00.000Z',
      origineOffre: { urlOrigine: 'https://www.francetravail.fr/offre/ft-003' },
      romeLibelle: 'Direction administrative et financière',
    },
  },
];

const SAMPLE_LBA = [
  {
    __src: 'labonnealternance',
    raw: {
      id: 'lba-001',
      title: 'Alternance Chargé de Clientèle Banque Privée',
      company: { name: 'BNP Paribas' },
      place: { city: 'Paris', fullAddress: 'Paris, France' },
      contact: { url: 'https://mycareer.bnpparibas/offre/lba-001' },
      job: { romeLabel: 'Conseil en gestion de patrimoine' },
      createdAt: '2026-08-25T09:00:00.000Z',
    },
  },
  {
    __src: 'labonnealternance',
    raw: {
      id: 'lba-002',
      title: 'Alternance Actuariat Vie H/F',
      company: { name: 'AXA France' },
      place: { city: 'Nanterre', fullAddress: 'Nanterre, France' },
      contact: { url: 'https://axa.wd3.myworkdayjobs.com/offre/lba-002' },
      job: { romeLabel: 'Management en assurances' },
      createdAt: '2026-08-24T09:00:00.000Z',
    },
  },
];

const SAMPLE_ATS = [
  // Doublon volontaire : même poste que ft-001 mais vu via l'ATS de la boîte
  // (source de vérité) -> le pipeline doit garder celui-ci et noter l'autre.
  {
    __src: 'greenhouse:societegenerale',
    emp: 'Société Générale CIB',
    raw: {
      id: 42,
      title: 'Stage Analyste Crédit F/H',
      absolute_url: 'https://boards.greenhouse.io/societegenerale/jobs/42',
      location: { name: 'Paris, France' },
      updated_at: '2026-08-28T09:00:00.000Z',
      content: 'Stage de 6 mois au sein de la direction des risques crédit.',
    },
  },
  {
    __src: 'lever:qonto',
    emp: 'Qonto',
    raw: {
      id: 'lever-qonto-001',
      text: "Analyste M&A / Corporate Finance - Stage",
      hostedUrl: 'https://jobs.lever.co/qonto/lever-qonto-001',
      categories: { location: 'Paris', commitment: 'Stage' },
      createdAt: 1756300800000,
    },
  },
  {
    __src: 'smartrecruiters:ardian',
    emp: 'Ardian',
    raw: {
      id: 'sr-ardian-001',
      name: 'Analyste Private Equity Junior H/F',
      location: { city: 'Paris', country: 'fr' },
      releasedDate: '2026-08-23T09:00:00.000Z',
      applyUrl: 'https://jobs.smartrecruiters.com/Ardian/sr-ardian-001',
      typeOfEmployment: { label: 'CDI' },
    },
  },
];

module.exports = {
  fetchRadancy,
  fetchAllSources,
  sourcesReprises, // relevé des maisons servies depuis le magasin, pour le bilan
  fetchFranceTravail,
  fetchLaBonneAlternance,
  fetchAllATS,
  fetchAdzuna,
  fetchTalentSoft,
  fetchSuccessFactors,
  fetchSitemapJsonLd,
  fetchEiCards,
  fetchAvature,
  fetchServicePublic,
  fetchWorkday,
  fetchPhenom,
  fetchOracleCloud,
  fetchAshby,
  fetchTeamtailor,
  fetchRecruitee,
  fetchCornerstone,
  fetchAxaFrance,
  fetchLvmh,
  fetchTalentView,
  fetchTalentLink,
  fetchListeHtml,
  fetchWordpressOffres,
  looksLikeFinance,
  isFinanceOfferFor,
  LISTES_HTML,
  fetchSmartRecruiters,
  fetchLever,
  fetchGreenhouse,
  ROME_FINANCE,
  TARGET_COMPANIES,
  SAMPLE_FRANCE_TRAVAIL,
  SAMPLE_LBA,
  SAMPLE_ATS,
};
