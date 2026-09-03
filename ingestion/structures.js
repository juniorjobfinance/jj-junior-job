/**
 * JJ — Table employeur -> type de structure
 *
 * Construite a la main a partir du catalogue des 998 offres du 2026-09-03.
 * C'est le socle du classifieur : l'employeur est une donnee fiable, contrairement
 * a l'intitule. Toute nouvelle source doit alimenter cette table.
 *
 * Cle = nom d'employeur normalise (minuscules, sans accents, sans ponctuation).
 * La resolution se fait par egalite stricte puis par prefixe le plus long,
 * ce qui fait que "caisse d epargne" couvre toutes les caisses regionales.
 */

// Les libellés sont EXACTEMENT ceux que le site affiche déjà dans le filtre
// « Type de structure ». Ne pas les reformuler : un visiteur qui connaît le
// site n'a aucune raison de voir ses repères changer, et le libellé n'est
// jamais utilisé comme clé — les identifiants ci-dessous le sont.
const STRUCTURES = {
  bfi: "Banque de financement & d'investissement",
  'banque-affaires': "Banque d'affaires indépendante",
  'banque-detail': 'Banque de détail',
  'societe-gestion': 'Société de gestion',
  fonds: "Fonds d'investissement",
  assurance: "Compagnie d'assurance & mutuelle",
  big4: 'Big Four & cabinets d’audit',
  conseil: 'Cabinet de conseil & stratégie',
  fintech: 'Fintech & services financiers spécialisés',
  entreprise: 'Entreprise (direction financière)',
  institution: 'Institution publique & régulateur',
};

const EMPLOYER_STRUCTURE = {
  // --- Banques de financement et d'investissement -------------------------
  'bnp paribas': 'bfi',
  'societe generale': 'bfi',
  'credit agricole cib': 'bfi',
  natixis: 'bfi',
  'hsbc france': 'bfi',
  barclays: 'bfi',
  'goldman sachs': 'bfi',
  jpmorgan: 'bfi',
  citi: 'bfi',
  'deutsche bank': 'bfi',
  'oddo bhf': 'bfi',
  'groupe bpce': 'bfi',

  // --- Banques d'affaires independantes -----------------------------------
  lazard: 'banque-affaires',
  'rothschild & co': 'banque-affaires',
  'perella weinberg': 'banque-affaires',
  'pjt partners': 'banque-affaires',
  'houlihan lokey': 'banque-affaires',
  'kepler cheuvreux': 'banque-affaires',
  'euro latina finance': 'banque-affaires',
  'i deal development': 'banque-affaires',
  'edmond de rothschild': 'banque-affaires',
  'banque transatlantique': 'banque-affaires',
  'banque palatine': 'banque-affaires',

  // --- Banque de detail ----------------------------------------------------
  'credit agricole': 'banque-detail',
  'la banque postale': 'banque-detail',
  lcl: 'banque-detail',
  cic: 'banque-detail',
  'credit mutuel': 'banque-detail',
  'caisse d epargne': 'banque-detail',
  'banque populaire': 'banque-detail',
  casden: 'banque-detail',
  'casden banque populaire': 'banque-detail',
  bred: 'banque-detail',
  'bred banque populaire': 'banque-detail',
  'banque bcp': 'banque-detail',
  'groupe credit cooperatif': 'banque-detail',
  n26: 'banque-detail',

  // --- Societes de gestion -------------------------------------------------
  amundi: 'societe-gestion',
  mirova: 'societe-gestion',
  'ostrum asset management': 'societe-gestion',
  candriam: 'societe-gestion',
  comgest: 'societe-gestion',
  'sycomore asset management': 'societe-gestion',
  'natixis investment managers': 'societe-gestion',
  'vega investment solutions': 'societe-gestion',
  schroders: 'societe-gestion',

  // --- Fonds d'investissement ---------------------------------------------
  ardian: 'fonds',
  eurazeo: 'fonds',
  'tikehau capital': 'fonds',
  'pai partners': 'fonds',
  'ik partners': 'fonds',
  meridiam: 'fonds',
  revaia: 'fonds',
  'supernova invest': 'fonds',
  cdpq: 'fonds',
  ere: 'fonds',

  // --- Assurances et mutuelles --------------------------------------------
  axa: 'assurance',
  'allianz france': 'assurance',
  covea: 'assurance',
  maif: 'assurance',
  'swiss life france': 'assurance',
  'cnp assurances': 'assurance',
  scor: 'assurance',
  'ag2r la mondiale': 'assurance',
  'malakoff humanis': 'assurance',
  'bpce assurances': 'assurance',
  'bpce assurances holding': 'assurance',
  'bpce assurances iard': 'assurance',
  'bpce vie': 'assurance',
  'credit agricole assurances': 'assurance',
  wakam: 'assurance',
  seyna: 'assurance',
  'descartes underwriting': 'assurance',
  verlingue: 'assurance',
  'marsh mclennan': 'assurance',

  // --- Big 4 et cabinets d'audit ------------------------------------------
  deloitte: 'big4',
  ey: 'big4',
  kpmg: 'big4',
  pwc: 'big4',
  'forvis mazars': 'big4',
  'grant thornton': 'big4',
  'bdo france': 'big4',
  orbiss: 'big4',

  // --- Conseil et strategie ------------------------------------------------
  bcg: 'conseil',
  'roland berger': 'conseil',
  'sia partners': 'conseil',
  'julhiet sterwen': 'conseil',
  talan: 'conseil',
  'capgemini technology services': 'conseil',
  'sopra steria group': 'conseil',
  'altran technologies': 'conseil',
  'amaris france': 'conseil',
  extia: 'conseil',
  'davidson nord': 'conseil',
  scalian: 'conseil',
  meotec: 'conseil',
  alten: 'conseil',
  'mission conseil assistance ingenierie': 'conseil',
  'isalys consulting france': 'conseil',
  'efe international': 'conseil',
  'easy skill': 'conseil',
  'morgan philips': 'conseil',
  'cleeven nd': 'conseil',
  aerow: 'conseil',
  'altios france': 'conseil',
  bizline: 'conseil',

  // --- Fintech et services financiers specialises -------------------------
  qonto: 'fintech',
  alan: 'fintech',
  pennylane: 'fintech',
  younited: 'fintech',
  finary: 'fintech',
  meilleurtaux: 'fintech',
  euronext: 'fintech',
  caceis: 'fintech',
  eurotitres: 'fintech',
  uptevia: 'fintech',
  'bpce payment services': 'fintech',
  'credit agricole payment services': 'fintech',
  'bpce financement': 'fintech',
  'bpce equipment solutions': 'fintech',
  'bpce compagnie europeenne de garanties et cautions': 'fintech',
  'bpce ig': 'fintech',
  'ca consumer finance': 'fintech',
  'rci banque': 'fintech',
  'credit agricole leasing & factoring': 'fintech',

  // --- Institutions publiques et regulateurs ------------------------------
  'banque de france': 'institution',
  'caisse des depots': 'institution',

  // --- Entreprises (direction financiere) ---------------------------------
  lvmh: 'entreprise',
  'lvmh fragrance brands': 'entreprise',
  'christian dior couture': 'entreprise',
  'louis vuitton': 'entreprise',
  celine: 'entreprise',
  kenzo: 'entreprise',
  berluti: 'entreprise',
  guerlain: 'entreprise',
  'make up for ever': 'entreprise',
  'moet hennessy': 'entreprise',
  'bulgari france': 'entreprise',
  'l oreal': 'entreprise',
  valeo: 'entreprise',
  thales: 'entreprise',
  airbus: 'entreprise',
  stellantis: 'entreprise',
  'faurecia interiors holding': 'entreprise',
  'compagnie de saint gobain': 'entreprise',
  'orano nuclear packages and services': 'entreprise',
  edf: 'entreprise',
  'edf power solutions': 'entreprise',
  'engie global markets': 'entreprise',
  totalenergies: 'entreprise',
  photosol: 'entreprise',
  'akuo energy': 'entreprise',
  'enerparc solaire': 'entreprise',
  'veolia environnement': 'entreprise',
  orange: 'entreprise',
  'sncf voyages developpement': 'entreprise',
  'technip energies france': 'entreprise',
  'cma cgm': 'entreprise',
  accor: 'entreprise',
  nexity: 'entreprise',
  altarea: 'entreprise',
  'credit agricole immobilier': 'entreprise',
  nestle: 'entreprise',
  sanofi: 'entreprise',
  'sanofi winthrop industrie': 'entreprise',
  ipsen: 'entreprise',
  'ipsen pharma': 'entreprise',
  'janssen cilag': 'entreprise',
  'mcdonald s': 'entreprise',
  boulanger: 'entreprise',
  rexel: 'entreprise',
  veepee: 'entreprise',
  'criteo technology': 'entreprise',
  'schneider electric industries': 'entreprise',
  'cnh industrial france': 'entreprise',
  'iveco france': 'entreprise',
  'john cockerill services france sud': 'entreprise',
  'bouygues travaux publics': 'entreprise',
  'eurofins gsc france': 'entreprise',
  'louis dreyfus company distribution france': 'entreprise',
  'act commodities': 'entreprise',
  'sibelco france': 'entreprise',
  'grimaldi france': 'entreprise',
  'norac missions': 'entreprise',
  'groupe idec international': 'entreprise',
  'maison kyka': 'entreprise',
  'verescence france': 'entreprise',
  'telco oi': 'entreprise',
  'hello watt': 'entreprise',
  'flash contract': 'entreprise',
  'laboratoires arkopharma': 'entreprise',
  geopost: 'entreprise',
  'blue cube': 'entreprise',
  'efectis france': 'entreprise',
  'societe pour l informatique industrielle': 'entreprise',
  'societe air france': 'entreprise',
  planisware: 'entreprise',
  numberly: 'entreprise',
};

/** Normalise un nom d'employeur pour la resolution. */
function normalizeEmployer(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim();
}

/**
 * Resout la structure d'un employeur.
 * Egalite stricte d'abord, puis prefixe le plus long (pour couvrir les
 * declinaisons regionales : "Caisse d'Epargne Hauts de France" -> "caisse d epargne").
 * Retourne null si inconnu : c'est le signal qu'il faut enrichir la table.
 */
function resolveStructure(rawEmployer) {
  const name = normalizeEmployer(rawEmployer);
  if (!name) return null;
  if (EMPLOYER_STRUCTURE[name]) return EMPLOYER_STRUCTURE[name];

  let best = null;
  let bestLen = 0;
  for (const key of Object.keys(EMPLOYER_STRUCTURE)) {
    if (name.startsWith(key) && key.length > bestLen) {
      best = EMPLOYER_STRUCTURE[key];
      bestLen = key.length;
    }
  }
  return best;
}

/** Structures dont on considere que l'activite est financiere par nature. */
const FINANCE_STRUCTURES = new Set([
  'bfi',
  'banque-affaires',
  'banque-detail',
  'societe-gestion',
  'fonds',
  'assurance',
  'fintech',
  'institution',
]);

module.exports = {
  STRUCTURES,
  EMPLOYER_STRUCTURE,
  FINANCE_STRUCTURES,
  normalizeEmployer,
  resolveStructure,
};
