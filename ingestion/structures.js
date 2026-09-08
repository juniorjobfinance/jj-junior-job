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

const STRUCTURES = {
  bfi: "Banque de financement & d'investissement",
  'banque-affaires': 'Banque d\'affaires indépendante',
  'banque-detail': 'Banque de détail',
  'societe-gestion': 'Société de gestion',
  fonds: 'Fonds d\'investissement',
  assurance: 'Assurance, mutuelle & courtage',
  big4: 'Big Four & cabinets d’audit',
  conseil: 'Cabinet de conseil & stratégie',
  fintech: 'Fintech & services financiers spécialisés',
  entreprise: 'Entreprise (direction financière)',
  institution: 'Institution publique & régulateur',
};

const EMPLOYER_STRUCTURE = {
  'amazon':                            'entreprise', // Amazon — commerce et informatique en nuage
  'coca cola europacific partners':    'entreprise', // CCEP — embouteilleur, siege France a Issy-les-Moulineaux
  // --- Ecartees faute de structure, inscrites le 04/09/2026 --------------
  // 37 offres rejetees par « gate:publication-sans-structure », dont les 37
  // etaient deja classables par leur seul intitule : ce n'etaient pas des
  // rejets de perimetre, c'etaient des maisons absentes de cette table.
  //
  // L'axe STRUCTURE decrit l'EMPLOYEUR, jamais l'offre. Akur8 est inscrite en
  // fintech — editeur de logiciel de tarification qui vend aux assureurs —
  // et non en assurance, bien que son unique offre soit « Senior Life
  // Actuary ». Laisser une offre decider de la nature de sa maison inverserait
  // le principe des deux axes : le metier se lit dans le titre, la structure
  // se lit dans la maison.
  'accenture': 'conseil',
  // Signalees par le releve « maisons vues et jetees » : elles publiaient sans
  // figurer dans maisons.txt. Inscrites dans les deux tables le 04/09/2026.
  'repossi': 'entreprise',
  'val de loire': 'entreprise',
  'adeo': 'entreprise',
  'aema groupe': 'assurance',
  'air liquide': 'entreprise',
  'akur8': 'fintech',
  'amf': 'institution',
  'bforbank': 'banque-detail',
  // Filiale de services immobiliers du groupe BPCE, pas un etablissement de
  // credit : DECISIONS.md §30 tranche sur l'employeur, pas sur l'actionnaire.
  'bpce solutions immobilieres': 'entreprise',
  'givenchy': 'entreprise',
  'idia capital investissement': 'fonds',
  // Banque privee du groupe Credit Agricole. « banque-affaires » est le moins
  // faux, pas le juste : son libelle dit « independante », ce qu'Indosuez
  // n'est pas. Tension notee dans ETAT.md — a revoir si trois ou quatre
  // maisons se retrouvent dans ce cas, pas pour une seule.
  'indosuez wealth management': 'banque-affaires',
  'intesa sanpaolo': 'bfi',
  'morgan stanley': 'bfi',
  'reden solar': 'entreprise',
  'swile': 'fintech',
  'teora': 'assurance',
  'trustpair': 'fintech',

  // --- Ecartes faute de structure le 04/09/2026 --------------------------
  // 34 offres perdues chez des maisons souvent DEJA dans maisons.txt : le
  // paragraphe 24, deux tables et deux portes. Inscrire ici ne fait entrer
  // aucune mauvaise offre — elle passe a la porte suivante, qui exige un
  // marqueur finance dans l'intitule.
  'agicap': 'fintech',
  'air france': 'entreprise',
  'alptis': 'assurance',
  'leocare': 'assurance',       // neo-assureur auto & habitation
  'bpce achats & services': 'banque-detail',
  'bpce factor': 'fintech',
  'bpce lease': 'fintech',
  'beiersdorf': 'entreprise',
  'caisse de depot et placement du quebec': 'fonds',
  'capitole finance': 'fintech',
  'compass lexecon': 'conseil',
  'ecm technologies': 'entreprise',
  'evercore': 'banque-affaires',
  'groupe voltaire': 'entreprise',
  'icape': 'entreprise',
  'lucca': 'entreprise',
  'merck': 'entreprise',
  'michelin': 'entreprise',
  'morningstar': 'fintech',
  'on train': 'entreprise',
  'rail logistics': 'entreprise',
  'servier': 'entreprise',
  'sesamm': 'fintech',
  'shine': 'fintech',
  'societe des brasseries': 'entreprise',
  'sodexo': 'entreprise',
  'verspieren': 'assurance',
  'yousign': 'entreprise',     // editeur de signature electronique, pas un
                               // service financier : l'axe decrit l'employeur
  'koni': 'entreprise',
  // --- Vues a la collecte du 03/09/2026, sans structure -------------------
  'sar': 'entreprise',
  'vf haute provence': 'entreprise',
  'hestia': 'entreprise',
  'sunmind': 'entreprise',
  'division des grands projets': 'entreprise',
  // Les marques LVMH et VINCI passent par leur maison mere dans maisons.txt,
  // mais la carte affiche l'entite qui recrute : il leur faut donc AUSSI une
  // structure ici, sinon elles resolvent la maison sans resoudre le type.
  'credit foncier': 'banque-detail',
  'banque de savoie': 'banque-detail',
  'ensemble protection sociale': 'assurance',
  'vinci': 'entreprise',
  'axians': 'entreprise',
  'citeos': 'entreprise',
  'sephora': 'entreprise',
  'chaumet': 'entreprise',
  'rimowa': 'entreprise',
  'tiffany': 'entreprise',
  'krug': 'entreprise',
  'benefit cosmetics': 'entreprise',
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

  // --- Filiales et cas que la resolution par prefixe traiterait mal -------
  // La resolution prend le prefixe le PLUS LONG. Sans ces entrees explicites,
  // "Natixis Investment Managers" tomberait sur "natixis" (BFI) et
  // "Credit Agricole Assurances" sur "credit agricole" (banque de detail).
  'natixis investment managers': 'societe-gestion',
  'natixis investment managers, l': 'societe-gestion',
  'credit agricole assurances': 'assurance',
  'credit agricole personal finance & mobility': 'fintech',
  'credit agricole transitions et energies': 'banque-detail',
  aew: 'societe-gestion',

  // Filiales servies sous un nom different de leur maison de reference
  'parfums christian dior': 'entreprise',
  'maison francis kurkdjian': 'entreprise',
  'groupe bon marche': 'entreprise',
  'officine universelle buly': 'entreprise',
  repossi: 'entreprise',
  'direct assurance': 'assurance',
  'gie axa': 'assurance',
  'mutuelle saint christophe': 'assurance',
  socfim: 'fintech',
  oney: 'fintech',
  'bpce solutions informatiques': 'fintech',

  // Employeurs vus dans les rejets et absents de la table
  matmut: 'assurance',
  'generali france': 'assurance',
  coface: 'assurance',
  jefferies: 'banque-affaires',
  'eight advisory': 'conseil',
  capco: 'conseil',
  lseg: 'fintech',
  mufg: 'bfi',
  'bank of america': 'bfi',
  bbva: 'banque-detail',
  santander: 'banque-detail',
  'saint gobain': 'entreprise',
  getlink: 'entreprise',

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
  ocde: 'institution',
  // Branchees le 07/09/2026 au soir, chacune mesuree au connecteur.
  chanel: 'entreprise',          // Chanel — maison de luxe, direction financiere
  'fdj united': 'entreprise',    // FDJ United — loterie et paris sportifs, cotee
  nabla: 'entreprise',
  'pernod ricard': 'entreprise', // Pernod Ricard — spiritueux, direction financiere           // Nabla — editeur d'IA medicale
  oecd: 'institution',           // OCDE, graphie anglaise — maisons.txt reconnait les deux           // OCDE — organisation internationale, siege a Paris

  // Inscrites le 07/09/2026. Leurs offres VIE mouraient sur
  // gate:publication-sans-structure : pour le VIE, maisons.txt est saute et
  // c'est structures.js SEULE qui decide. Meotec passait sans etre dans
  // maisons.txt, parce quelle avait une structure.
  //
  // Les sept clefs ont ete verifiees contre le nom sous lequel chaque
  // employeur PUBLIE dans la recolte, pas contre le nom d'une liste : trois
  // clefs ecrites le meme jour depuis des noms courts etaient inertes.
  'nexans france':                'entreprise',    // Nexans France — cablier industriel
  'elior group':                  'entreprise',    // Elior Group — restauration collective
  'virya energy services france': 'entreprise',    // Virya Energy Services — energeticien
  'naos':                         'entreprise',    // NAOS — cosmetique (Bioderma)
  'albioma':                      'entreprise',    // Albioma — energie renouvelable
  'shift technology':             'fintech',       // Shift Technology — detection de fraude vendue aux assureurs
  'pramex international':         'conseil',       // Pramex International — filiale BPCE, conseil en developpement international

  // --- Les 34 maisons a moitie inscrites, plus Alantra --------------------
  // Elles etaient dans maisons.txt sans etre ici : § 24, une maison presente
  // dans UNE SEULE des deux tables rend zero offre, et le pipeline refuse de
  // publier une offre sans structure (gate:publication-sans-structure).
  // Inscrites le 07/09/2026 apres validation.
  //
  // TROIS CLEFS DU LOT ONT ETE RETIREES LE JOUR MEME : « sycomore am »,
  // « swiss life am france », « marsh france ». Elles etaient INERTES — les
  // employeurs publient sous « sycomore asset management », « swiss life
  // france » et « marsh mclennan », qui figuraient deja ici. Une clef qui ne
  // peut jamais matcher ne se plaint jamais : elle donne l illusion d une
  // couverture qu on n a pas.
  'ostrum am':                     'societe-gestion',   // Ostrum AM — gestion obligataire, filiale Natixis IM
  'carmignac':                     'societe-gestion',   // Carmignac — societe de gestion independante
  'la financiere de l echiquier':  'societe-gestion',   // La Financiere de l'Echiquier — groupe LBP AM
  'groupama am':                   'societe-gestion',   // Groupama AM — gestion d actifs du groupe Groupama
  'cpr am':                        'societe-gestion',   // CPR AM — filiale de gestion d Amundi
  'accuracy':                      'conseil',           // Accuracy — conseil financier, transaction services
  'oliver wyman':                  'conseil',           // Oliver Wyman — conseil en strategie, groupe Marsh McLennan
  'rsm france':                    'big4',              // RSM France — reseau d audit et d expertise comptable
  'macif':                         'assurance',         // MACIF — mutuelle d assurance
  'mma':                           'assurance',         // MMA — assureur, groupe Covea
  'groupama':                      'assurance',         // Groupama — mutuelle d assurance
  'gmf':                           'assurance',         // GMF — mutuelle, groupe Covea
  'astorg':                        'fonds',             // Astorg — capital-investissement, LBO europeen
  'antin infrastructure partners': 'fonds',             // Antin Infrastructure Partners — infrastructure
  'andera partners':               'fonds',             // Andera Partners — capital-investissement et biotech
  'siparex':                       'fonds',             // Siparex — capital-investissement regional
  'lbo france':                    'fonds',             // LBO France — capital-investissement
  'sagard':                        'fonds',             // Sagard — capital-investissement, groupe Power Corporation
  'partech':                       'fonds',             // Partech — capital-risque international
  'alven':                         'fonds',             // Alven — capital-risque francais
  'messier & associes':            'banque-affaires',   // Messier & Associes — boutique de conseil en M&A
  'centerview france':             'banque-affaires',   // Centerview France — boutique americaine de M&A
  'swan':                          'fintech',           // Swan — banking-as-a-service
  'spendesk':                      'fintech',           // Spendesk — gestion des depenses
  'silvr':                         'fintech',           // Silvr — financement fonde sur les revenus
  'ledger':                        'fintech',           // Ledger — securite des actifs numeriques
  'payfit':                        'fintech',           // Payfit — paie et gestion sociale
  'bpifrance':                     'institution',       // Bpifrance — banque publique d investissement
  'agence france tresor':          'institution',       // Agence France Tresor — gestion de la dette de l Etat
  'acpr':                          'institution',       // ACPR — superviseur bancaire et assurantiel
  'cdc habitat':                   'entreprise',        // CDC Habitat — bailleur social, pas un regulateur
  'alantra':                       'banque-affaires',   // Alantra — boutique M&A. La clef `alan` l avalait par prefixe et la rendait fintech
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
  // Le prefixe doit s arreter sur une LIMITE DE MOT.
  //
  // Sans cette condition, la clef `alan` (Alan, la mutuelle sante) capturait
  // « alantra » — boutique M&A — et l aurait publiee en « fintech ». Aucune
  // erreur, aucun signal : une maison sous un type faux, en silence.
  //
  // 56 clefs de la table font cinq caracteres ou moins : `axa`, `ey`, `cic`,
  // `mma`, `sar`, `edf`, `amf`... Chacune est un prefixe pour des noms qu on
  // ne connait pas encore. Le cas particulier se serait repete.
  //
  // La mesure du 07/09 : exiger la limite de mot ne change RIEN sur les 920
  // offres publiees ni sur les 344 employeurs de la recolte. Les 41 offres
  // qui resolvent par prefixe le font toutes sur une limite de mot — ce sont
  // les declinaisons voulues, « Caisse d Epargne Hauts de France ».
  //
  // C est deja ce que fait contientVille pour les villes ; cette table etait
  // la derniere a comparer sans limite de mot.
  for (const key of Object.keys(EMPLOYER_STRUCTURE)) {
    if (!name.startsWith(key) || key.length <= bestLen) continue;
    const suivant = name[key.length];
    if (suivant !== undefined && /[a-z0-9à-öø-ÿ]/.test(suivant)) continue;
    best = EMPLOYER_STRUCTURE[key];
    bestLen = key.length;
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
