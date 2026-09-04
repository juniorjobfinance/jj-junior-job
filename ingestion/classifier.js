/**
 * JJ — Classifieur d'offres (remplace FAMILLE_RULES dans ingestion/pipeline.js)
 *
 * Quatre etapes, dans cet ordre :
 *   1. PRE-FILTRE     : metiers hors perimetre (banque de detail commerciale, RH/support)
 *                       -> rejet immediat, avant toute regle famille.
 *   2. PORTE FINANCE  : pour les employeurs non financiers par nature, l'intitule doit
 *                       porter un marqueur finance. Sinon rejet.
 *   3. FAMILLE        : scoring par specificite. Le motif le plus specifique gagne,
 *                       PAS le premier motif rencontre. C'est le changement central.
 *   4. RESIDU         : ce qui passe la porte sans matcher de famille part dans
 *                       unclassified, jamais dans "Autres".
 *
 * Tags transversaux (esg, real-assets, international) : cumulables, independants
 * de la famille. Un analyste ESG chez Mirova est "Gestion d'actifs" + tag esg.
 */

const { resolveStructure, FINANCE_STRUCTURES } = require('./structures');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Structures pour lesquelles l'intitule DOIT porter un marqueur finance.
 * Retirer 'conseil' et 'big4' de cette liste rend le site plus permissif :
 * on recupere alors les "Conseil en Transformation" generiques des Big 4
 * (environ +25 offres, mais sans lien avec la finance).
 */
const GATED_STRUCTURES = new Set(['entreprise', 'conseil', 'big4', null]);

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalize(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    // La marque du feminin ne doit pas separer deux mots. « gerant(e) de
    // portefeuille » devenait « gerant e de portefeuille » — les parentheses
    // deviennent des espaces a la ligne suivante, et le « e » devient un MOT
    // qui coupe le metier en deux. Le motif valait 9, il ne pouvait plus
    // s'appliquer. 93 titres sur 1389 portent une de ces formes le 04/09/2026,
    // dont 34 dans le residu : « (e) », « .e », « -e », « (trice) », « -rice »,
    // « (se) », « .se », « (rice) », « ·e ».
    //
    // On la retire ICI, avant la ponctuation : un seul endroit repare tous les
    // motifs, la ou les reecrire un par un en aurait rate.
    .replace(/(?<=[a-z])[(.·\-–]\s*(?:e|se|ne|rice|trice|euse|iere)\s*\)?(?![a-z])/g, '')
    .replace(/[^a-z0-9&+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 1. Pre-filtre — rejet avant toute autre regle
// ---------------------------------------------------------------------------

/**
 * Metiers qui contiennent un mot du pre-filtre mais qui restent dans le
 * perimetre. Verifie AVANT le pre-filtre : "Conseiller en Gestion de
 * Patrimoine" n'est pas de la vente en agence.
 */
// Le mot « patrimoine » n'exempte que lorsqu'il nomme le METIER. « AXA
// Prevoyance & Patrimoine » est le nom d'un RESEAU D'AGENCES : onze offres de
// mandataires passaient par cette porte le 04/09/2026 — « Entrepreneur
// specialise », « Animateur Commercial », « Chef(fe) d'entreprise ». Aucune
// n'est de la gestion de patrimoine.
const DISTRIBUTION_ASSURANCE =
  /\b(?:entre?preneur|animateur|animatrice|chef(?:fe)? d entreprise|mandataire|agence|reseau)\b/;

// LE SUJET, PAS LE DECOR. Un intitule generique de projet ou de systeme sort
// du perimetre — sauf s'il nomme la finance, auquel cas le systeme n'est que
// l'outil. « Business Analyst » dehors, « ERP Oracle / Finance » dedans.
const TITRE_DE_SYSTEME =
  /\b(?:pmo|project management officer|business analyst|business analyste|moa|amoa|maitrise d ouvrage|agile|scrum|product owner|testing|support fonctionnel)\b/;

// Ce qui fait de la finance le SUJET : on reutilise hasFinanceMarker, la
// definition que la porte finance emploie deja. Une liste ecrite a la main
// ici ignorait « capital market », « front office », « post trade », « asset
// management » et « lutte anti blanchiment » — 159 rejets au lieu de 7.

// Le recouvrement de creances est du traitement de dossier — sauf quand
// l'intitule ANALYSE ou PILOTE, ce qui est un autre metier.
const RECOUVREMENT_DOSSIER =
  /\b(?:gestionnaire|charge|chargee)\b[^,]{0,40}\brecouvrement\b|\brecouvrement\b[^,]{0,20}\b(?:contentieux|pre contentieux)\b/;
const RECOUVREMENT_PILOTAGE = /\b(?:analyste|pilotage|suivi|controle)\b/;

const PREFILTER_EXCEPTIONS = [
  /\bgestion de patrimoine\b/,
  /\bpatrimonial(?:e)?\b/,
  /\bingenierie patrimoniale\b/,
  /\bbanquier(?:e)? prive(?:e)?\b/,
  /\bprivate bank/,
  /\bwealth\b/,
  /\bfamily office\b/,
  /\binvestissement financier\b/,
  /\bcharge(?:e)? d affaires (?:entreprises?|corporate|grands comptes|institutionnels?)\b/,
  /\bcharge(?:e)? d affaires (?:leverage|leveraged|structur|transaction|agency|infra)/,
  /\bbanquier(?:e)? prive/,
];

const PREFILTER = [
  // Banque de detail commerciale (exclusion assumee par Victor).
  // "Conseiller" seul suffit : sur le marche francais c'est un intitule de
  // vente en agence dans l'immense majorite des cas. Les metiers de conseil
  // au sens cabinet s'ecrivent "conseil", "consultant" ou "advisory", jamais
  // "conseiller". Les exceptions patrimoniales sont traitees juste au-dessus.
  [/\bconseill(?:er|ere|ers|eres)\b/, 'retail'],
  [/\bcharg(?:e|ee|es)\b (?:de )?clientele\b/, 'retail'],
  [/\bgestionnaire (?:de )?clientele\b/, 'retail'],
  [/\bconseiller (?:specialise|commercial|financier)\b/, 'retail'],
  [/\b(?:directeur|adjoint) d agence\b/, 'retail'],
  [/\b(?:guichetier|teleconseiller)\b/, 'retail'],
  [/\bagent general\b/, 'retail'],
  [/\bcharg(?:e|ee) d accueil\b/, 'retail'],
  [/\brecouvrement (?:amiable|commercial)\b/, 'retail'],
  [/\bsurendettement\b/, 'retail'],
  // « Inspecteur commercial » est un poste de reseau, pas d'audit. Le mot
  // « inspecteur » seul reste accepte : dans la banque francaise, c'est le
  // titre de l'audit interne — Inspection Generale, Inspecteur Modeles,
  // Inspecteur-Auditeur. Refuser « inspecteur » non qualifie couterait cinq
  // offres legitimes pour en attraper une.
  [/\binspect(?:eur|rice|ion)[^,]{0,12} commercial/, 'retail'],

  // --- HORS PERIMETRE, arbitre le 04/09/2026 (DECISIONS.md paragraphe 30) --
  //
  // TRAITEMENT DE DOSSIER. Le sinistre et la gestion de contrat ne produisent
  // ni n'analysent d'information financiere : ils appliquent un bareme a un
  // dossier. Dix-sept offres de sinistres et neuf de gestion de contrats
  // etaient rangees en « Actuariat & Assurance technique ». La SOUSCRIPTION
  // reste : un souscripteur junior fait de la tarification et de l'analyse de
  // risque, c'est le poste voisin de l'actuaire.
  [/\bsinistres?\b/, 'traitement-dossier'],
  [/\bindemnisation\b/, 'traitement-dossier'],
  [/\bregleur\b/, 'traitement-dossier'],
  [/\bgestionnaire (?:de )?recours\b/, 'traitement-dossier'],
  [/\bgestionnaire (?:en )?assurance/, 'traitement-dossier'],
  [/\bgestionnaire back office sante\b/, 'traitement-dossier'],
  [/\bgestionnaire redacteur\b/, 'traitement-dossier'],
  [/\bcharge de compte en assurance/, 'traitement-dossier'],
  [/\btechnicien operations assurance\b/, 'traitement-dossier'],

  // SYSTEME D'INFORMATION. Un candidat qui clique sur « Audit & Controle
  // interne » cherche de l'audit FINANCIER ; lui servir de l'audit de
  // systemes lui fait perdre son temps au clic et a l'entretien. Huit offres
  // Big Four le 04/09/2026. Exception explicite : « transformation SI/Finance »
  // porte sur la fonction finance elle-meme, elle reste en Conseil.
  [/\baudit it\b/, 'systeme-information'],
  [/\bit audit\b/, 'systeme-information'],
  [/\bauditeur des systemes d information\b/, 'systeme-information'],
  [/\brisques des si\b/, 'systeme-information'],
  [/\bcyber risk\b/, 'systeme-information'],
  [/\baudit financier ?\/ ?tech\b/, 'systeme-information'],

  // Distribution d'assurance : agents, mandataires, technico-commerciaux.
  // C'est le premier gisement du fourre-tout (AXA, Swiss Life, Matmut, AG2R).
  [/\bmandataire d assurance/, 'retail'],
  [/\bagent (?:independant )?specialise/, 'retail'],
  [/\bexpert en assurances collectives\b/, 'retail'],
  [/\btechnico ?-? ?commercial/, 'retail'],
  [/\bagent expert en patrimoine\b/, 'retail'],
  [/\bcourtier (?:mandataire|en credits?)\b/, 'retail'],

  // Marche des particuliers et des professionnels en agence.
  // "Charge d'affaires ENTREPRISES / corporate / grands comptes" reste dans
  // le perimetre : il est protege par PREFILTER_EXCEPTIONS.
  [/\bcharge(?:e)? d affaires professionnels?\b/, 'retail'],
  [/\bcharge(?:e)? d affaires (?:agricole|viticulture|agriculture)/, 'retail'],
  [/\bcharge(?:e)? d assurances professionnelles\b/, 'retail'],
  [/\bresponsable (?:de )?clientele\b/, 'retail'],
  [/\bassistant(?:e)? de clientele\b/, 'retail'],
  [/\battach(?:e|ee) (?:de clientele|relation commerciale)\b/, 'retail'],
  [/\bresponsable commercial\b/, 'retail'],
  [/\bassistant(?:e)? commercial/, 'retail'],
  [/\bcandidatures? spontanee/, 'retail'],
  [/\brejoignez la\b/, 'retail'],

  // Fonctions support / hors finance
  // 'talent' seul rejetait les "Talent Program", qui sont des programmes
  // graduate : il faut le qualifier.
  [/\b(?:ressources humaines|charge de formation|career management|recrutement)\b/, 'support'],
  [/\btalent(?:s)? (?:acquisition|management|partner|culture)\b/, 'support'],
  [/\bgestion des talents\b/, 'support'],
  [/\bmoyens generaux\b/, 'support'],
  [/\bgestionnaire de paie\b/, 'support'],
  [/\badministration des ventes\b/, 'support'],
  [/\bproperty manager\b/, 'support'],
  [/\bpharmacovigilance\b/, 'support'],
  [/\bquality assurance engineer\b/, 'support'],
  [/\bmerchandising\b/, 'support'],
  [/\b(?:paid acquisition|duty officer)\b/, 'support'],

  // Domaines clairement hors finance, meme quand l'intitule contient
  // un mot finance ("Preclinical Compliance", "Audit de Chantier")
  [/\bpre ?-? ?clinical\b/, 'hors-domaine'],
  [/\bclinical\b/, 'hors-domaine'],
  [/\bchantier\b/, 'hors-domaine'],
  [/\bgenie civil\b/, 'hors-domaine'],
  [/\bsupply chain\b/, 'hors-domaine'],
  [/\blogistique\b/, 'hors-domaine'],
  [/\bseo\b/, 'hors-domaine'],
];

// ---------------------------------------------------------------------------
// 2. Porte finance — marqueurs acceptes dans l'intitule
// ---------------------------------------------------------------------------

const FINANCE_MARKERS = [
  // Ajoute le 04/09/2026 : un diplome comptable francais est un marqueur
  // finance. Forvis Mazars « DCG / DSCG Agricole » etait rejete a la PORTE
  // alors que Deloitte « Comptable - DSCG » etait classe. Mesure avant
  // pose : 1 seule offre entre, aucune hors cabinet comptable.
  /\bd[cs]cg\b/,
  // Ajoutes le 04/09/2026 : du vocabulaire de metier absent de la porte, qui
  // bloquait des offres reelles — Talan « Post trade Business Analyst » et
  // « Business Analyst Lutte Anti Blanchiment », Banque de France « PMO MNBC
  // Interbancaire ». Mesure chez les industriels faite avant/apres, comme
  // CLAUDE.md l'exige pour tout ajout au FILTRE D'ENTREE.
  /\bpost[\s-]?trade\b/,
  /\bblanchiment\b/,
  /\banti[\s-]?money[\s-]?laundering\b/,
  /\bmnbc\b/,
  /\bmonnaie numerique\b/,
  /\bfinanc/, /\bcomptab/, /\baccount/, /\bconsolid/, /\baudit/, /\bfiscal/,
  /\bcontrol(?:e|eur|ling|ler)\b/, /\bcontrole de gestion\b/, /\bfp&a\b/,
  /\btresorerie\b/, /\btreasury\b/, /\bcash management\b/,
  /\bm&a\b/, /\bfusions?\b/, /\btransaction services\b/, /\bdue diligence\b/,
  /\bvaluation\b/, /\bevaluation d entreprise\b/, /\bcorporate finance\b/,
  /\binvestment\b/, /\binvestissement\b/, /\binvestisseur\b/, /\binvestor\b/,
  /\bcredit\b/, /\bdette\b/, /\bdebt\b/, /\bequity\b/, /\bobligataire\b/,
  /\brisqu(?:e|es)\b/, /\brisk\b/, /\bconformite\b/, /\bcompliance\b/, /\bkyc\b/,
  /\bactuar/, /\bassurance\b/, /\bsinistre/, /\bsouscript/, /\breassurance\b/,
  // "market" et non "market/" : sinon "marketing" passe la porte finance
  /\btrading\b/, /\btrader\b/, /\bmarch(?:e|es)\b/, /\bmarkets?\b/, /\bfront office\b/,
  /\bmiddle office\b/, /\bback office\b/, /\bportefeuille\b/, /\bportfolio\b/,
  /\bfonds\b/, /\bfund\b/, /\basset management\b/, /\bgestion d actifs\b/,
  /\bbanqu(?:e|ier)\b/, /\bbanking\b/, /\bpatrimoine\b/, /\bpatrimonial/,
  /\bquant/, /\betudes statistiques\b/, /\bstatisticien\b/, /\bmodelisation\b/,
  /\bbudget/, /\breporting reglementaire\b/, /\bp&l\b/, /\balm\b/,
  /\bpricing\b/, /\bfacturation\b/, /\brecouvrement\b/, /\bcapital\b/,
  /\bbusiness modeling\b/, /\bbuy ?-? ?side\b/, /\bfraud\b/, /\bcoverage\b/,
  // 'insurance' (EN) manquait : aucun intitule anglais d'assurance ne passait.
  // 'expertise conseil' designe l'expertise comptable chez les cabinets francais.
  /\binsurance\b/, /\bexpertise conseil\b/, /\bexpertise comptable\b/,
];

function hasFinanceMarker(title) {
  return FINANCE_MARKERS.some((re) => re.test(title));
}

// ---------------------------------------------------------------------------
// 3. Familles — motifs ponderes
//    Poids : 9-10 = sans ambiguite | 6-8 = fort | 3-5 = moyen | 1-2 = faible indice
//    Le score le plus haut gagne ; a egalite, l'ordre de declaration tranche.
// ---------------------------------------------------------------------------

const FAMILIES = [
  {
    id: 'fusions-acquisitions',
    label: 'Fusions & Acquisitions',
    patterns: [
      // Restructuring et situations speciales : Forvis Mazars, EY, Eight
      // Advisory. Lazard « Restructuring & Debt Advisory » reste en M&A.
      [/\b(?:restructuring|turnaround|special situations?)\b/, 8],
      [/\bm&a\b/, 9],
      [/\bfusions? ?-? ?acquisitions?\b/, 9],
      [/\btransaction services\b/, 9],
      [/\bdue diligence\b/, 8],
      [/\bevaluation financiere\b/, 9],
      [/\bevaluation d entreprise\b/, 9],
      [/\bvaluation\b/, 8],
      [/\bbusiness modeling\b/, 8],
      [/\bcorporate finance\b/, 8],
      [/\binvestment banking\b/, 8],
      [/\bbanque d affaires\b/, 8],
      [/\bstrategic advisory\b/, 8],
      [/\bsovereign advisory\b/, 8],
      [/\bdebt (?:advisory|restructuring)\b/, 8],
      [/\brestructuring\b/, 7],
      [/\bcorporate development\b/, 7],
      [/\bdeal advisory\b/, 8],
      [/\bstrategy (?:and|&) transactions\b/, 8],
      [/\bintroduction en bourse\b/, 8],
      [/\bipo\b/, 7],
    ],
  },
  {
    id: 'marches-financiers',
    label: 'Marchés financiers',
    patterns: [
      [/\bsales (?:and|&) trading\b/, 9],
      [/\bsalle des marches\b/, 9],
      [/\bfront office\b/, 7],
      [/\btrading\b/, 6],
      [/\btrader\b/, 6],
      [/\bequity research\b/, 9],
      [/\banalyse (?:secteur|secteurs)\b/, 6],
      [/\banalyste actions?\b/, 8],
      [/\bfixed income\b/, 6],
      [/\bcross ?asset\b/, 8],
      [/\bproduits? (?:derives?|structures?)\b/, 6],
      [/\bderivativ/, 6],
      [/\bstructur(?:ation|ing|eur)\b/, 6],
      [/\bmarches financiers\b/, 7],
      [/\bfinance de marche\b/, 8],
      [/\bcapital market/, 7],
      [/\bglobal markets\b/, 7],
      [/\bopérateur de marche\b/, 8],
      [/\boperateur de marche\b/, 8],
      [/\btitrisations?\b/, 8],
      [/\bipv\b/, 8],
      [/\bmarket data\b/, 7],
      [/\bmarche de l energie\b/, 8],
      [/\bsecuritised\b/, 8],
      [/\bhigh yield\b/, 7],
      [/\btaux et change\b/, 8],
      [/\bcommodities trading\b/, 9],
      [/\bpricing (?:analyst|quant)\b/, 6],
    ],
  },
  {
    id: 'financements-coverage',
    label: 'Financements & Coverage',
    patterns: [
      // Cautions et garanties internationales : BNP « Redacteur - Garanties
      // Internationales », HSBC, SG, Allianz, Coface. « garanties » seul est
      // partout en assurance (les garanties d'un contrat) : d'ou la
      // qualification. Verifie le 04/09 : Natixis « Gestionnaire Back Office
      // Garanties » reste en Operations.
      [/\b(?:garanties? internationales?|caution)\b/, 8],
      [/\bcoverage\b/, 8],
      [/\bcorporate banking\b/, 8],
      [/\bnetwork banking\b/, 8],
      [/\btransaction banking\b/, 8],
      [/\btrade finance\b/, 9],
      // Le financement de PROJET, jamais « financement » seul : « Charge de
      // financements aupres de la clientele Professionnelle » (SG) est du
      // credit d'agence, « Infra & Energy finance » (Natixis) est du
      // financement d'infrastructure. Cinq offres le 04/09/2026.
      [/\bfinancements? de projets?\b|\bproject finance\b/, 9],
      [/\bfinancements? specialises?\b/, 9],
      [/\binfra(?:structure)? (?:& |et )?energy finance\b/, 9],
      [/\bfinancement d infrastructure/, 9],
      [/\bcredits? documentaires?\b/, 8],
      [/\bfinancements? structur/, 9],
      [/\bfinancements? syndiqu/, 9],
      [/\bsyndicated loan\b/, 9],
      [/\bleverage[d]? finance\b/, 8],
      [/\btransaction management\b/, 8],
      [/\bsenior loans?\b/, 8],
      [/\bbanker\b/, 7],
      [/\bsmall cap\b/, 6],
      [/\bfinancement de projet\b/, 8],
      [/\bproject finance\b/, 8],
      [/\bfinancement immobilier\b/, 8],
      [/\bfinancement (?:du )?commerce international\b/, 9],
      [/\bcash management\b/, 7],
      [/\bdebt capital market/, 9],
      [/\bequity capital market/, 9],
      [/\bdcm\b/, 8],
      [/\becm\b/, 8],
      [/\borigination\b/, 6],
      [/\boriginat(?:eur|rice)\b/, 7],
      [/\bcommodities finance\b/, 9],
      [/\btrade (?:&|et|and) commodities\b/, 9],
      [/\bsyndication\b/, 6],
      [/\bbanquier conseil\b/, 7],
      [/\bcharg(?:e|ee) d affaires? (?:entreprises?|corporate|grands comptes)\b/, 7],
    ],
  },
  {
    id: 'capital-investissement',
    label: 'Capital-investissement',
    patterns: [
      [/\bprivate equity\b/, 9],
      [/\bprivate (?:debt|credit|assets|capital)\b/, 9],
      [/\bcapital ?-? ?investissement\b/, 9],
      // « Real Estate Investment » chez un gerant : de l'investissement
      // immobilier, jamais de la banque d'affaires. ERE et Schroders.
      [/\breal estate investment\b|\binvestissement immobilier\b/, 8],
      [/\bcapital developpement\b/, 9],
      [/\bventure capital\b/, 9],
      [/\bgrowth (?:equity|capital)\b/, 9],
      [/\bbuyout\b/, 9],
      [/\bmlbo\b/, 9],
      [/\blbo\b/, 8],
      [/\bdirect lending\b/, 9],
      [/\bmezzanine\b/, 8],
      [/\bdette privee\b/, 9],
      [/\bsecondaries\b/, 9],
      [/\bco ?-? ?investment\b/, 8],
      [/\bfund (?:finance|management|operations)\b/, 7],
      [/\binfrastructure (?:fund|equity|debt)\b/, 8],
      [/\bportfolio monitoring\b/, 8],
      [/\bfive arrows\b/, 9],
      [/\binfrastructures?\b/, 6],
      [/\bfonds d investissement\b/, 8],
      [/\binvestissements? en\b/, 6],
      [/\bventure\b/, 6],
    ],
  },
  {
    id: 'gestion-actifs',
    label: 'Gestion d\'actifs',
    patterns: [
      // Investissement comme METIER. Ne doit JAMAIS attraper « Investment
      // Banking » : verifie le 04/09 chez Goldman, Lazard, JPMorgan et
      // Rothschild, tous restent en Fusions & Acquisitions.
      [/\b(?:analyst investment|investissements? actions)\b/, 7],
      // Reponse aux appels d'offres institutionnels. En minuscules et sans
      // apostrophe : normalize() abaisse la casse et remplace l'apostrophe
      // par une espace.
      [/\b(?:rfp|appels? d offres?)\b/, 6],
      // Recherche buy-side, chez Natixis Investment Managers. Verifie : les
      // « Equity Research » d'Oddo restent en Marches financiers, leur motif
      // y pese davantage.
      [/\b(?:research analyst|analyste recherche)\b/, 8],
      [/\basset management\b/, 8],
      [/\bgestion d actifs\b/, 8],
      [/\bgerant(?:e)? (?:de )?portefeuille\b/, 9],
      [/\bgestionnaire de portefeuille\b/, 9],
      [/\bportfolio (?:manager|management|analyst)\b/, 8],
      // Le suivi du portefeuille d'investissement d'un assureur : « Investment
      // Reporting Officer » (Scor), « Investissement Responsable » (CNP). Deux
      // expressions qui nomment la GESTION, jamais le deal — a la difference
      // d'« investment » seul, qui referait le fourre-tout M&A a l'envers.
      [/\binvestment reporting\b|\breporting investissement\b/, 8],
      [/\binvestissement responsable\b|\bresponsible investment\b/, 8],
      [/\bfund manager\b/, 9],
      [/\bassistant(?:e)? gerant\b/, 8],
      [/\bgestion (?:individuelle|conseillee)\b/, 8],
      [/\binvestment guidelines\b/, 8],
      [/\binvestissements? durables?\b/, 7],
      [/\bsustainable investment\b/, 7],
      [/\bgestion (?:institutionnelle|collective|obligataire)\b/, 8],
      [/\bassistant(?:e)? (?:de )?gestion (?:de )?fonds?\b/, 8],
      [/\bselection de fonds\b/, 9],
      [/\bmultigestion\b/, 9],
      [/\bopcvm\b/, 7],
      [/\bproduct specialist\b/, 7],
      [/\bclient servicing\b/, 7],
      [/\bbusiness development rfp\b/, 8],
      [/\binvestor relations\b/, 6],
      [/\bfundraising\b/, 6],
      [/\bbuy ?-? ?side\b/, 9],
      [/\bservice(?:s)? clients? institutionnels?\b/, 8],
      [/\bclients? institutionnels?\b/, 7],
      [/\binside sales\b/, 6],
      [/\brelations? investisseurs?\b/, 8],
      [/\bchargee? de projets? isr\b/, 8],
      [/\bmonitoring portefeuille\b/, 8],
      // ESG cote investissement uniquement (le RSE corporate n'est qu'un tag)
      [/\banalyste? esg\b/, 8],
      [/\besg analyst\b/, 8],
      [/\banalyste? isr\b/, 8],
      [/\brecherche.{0,15}esg\b/, 8],
      [/\bsustainable finance\b/, 7],
      [/\bfinance durable\b/, 7],
      [/\bfinancement durable\b/, 7],
      [/\bsustainable (?:debt|banking)\b/, 7],
    ],
  },
  {
    id: 'banque-privee-patrimoine',
    label: 'Banque privée & Patrimoine',
    patterns: [
      [/\bbanque privee\b/, 9],
      [/\bbanquier(?:e)? prive(?:e)?\b/, 9],
      [/\bprivate bank/, 9],
      [/\bgestion privee\b/, 9],
      [/\bgestion de patrimoine\b/, 9],
      [/\bingenierie patrimoniale\b/, 9],
      [/\bingenieur patrimonial\b/, 9],
      [/\bpatrimonial(?:e)?\b/, 6],
      [/\bwealth\b/, 8],
      [/\bfamily office(?:r)?\b/, 9],
    ],
  },
  {
    id: 'actuariat-assurance',
    label: 'Actuariat & Assurance technique',
    patterns: [
      [/\bactuai?r/, 9],  // 'actuaire' (FR) ET 'actuarial' (EN) : \bactuar seul rate actuaire
      [/\bprovisionnement\b/, 9],
      [/\btarification\b/, 7],
      [/\bpricing actuary\b/, 10],
      // « Responsable Bilan » chez un assureur : c'est l'arrete des comptes
      // techniques, pas un poste de direction. Sortait sans famille.
      [/\bresponsable bilan\b/, 7],
      [/\bsolvabilite ?(?:2|ii)\b/, 9],
      [/\bsolvency ?(?:2|ii)\b/, 9],
      [/\breassurance\b/, 9],
      [/\bretrocession\b/, 9],
      [/\bsouscript/, 8],
      [/\bunderwrit/, 8],
      // Sinistres et indemnisation sont sortis du perimetre le 04/09/2026 :
      // le pre-filtre les ecarte, ces motifs ne peuvent plus se declencher.
      [/\biard\b/, 8],
      [/\bprevoyance\b/, 8],
      [/\bassurance vie\b/, 7],
      [/\betudes? statistiques? (?:et )?(?:actuarielles|techniques)\b/, 9],
      [/\bcomptab.{0,15}(?:technique )?assurance\b/, 8],
      [/\breinsurance\b/, 9],
      [/\binsurance\b/, 7],
      [/\binspecteur assurance\b/, 8],
      [/\bgestionnaire de contrats?\b/, 7],
      [/\bgestionnaire redacteur\b/, 7],
      [/\bassurance (?:des )?emprunteur/, 8],
      [/\bprestations? (?:sante|retraite|beneficiaires?)\b/, 8],
      [/\bgestionnaire (?:retraite|prevoyance|assurance)\b/, 8],
      [/\bretraite complementaire\b/, 8],
      [/\boperations? (?:d )?assurance\b/, 8],
      [/\bassurances? collectives?\b/, 7],
      [/\bassurance de personnes\b/, 7],
      [/\bcourtage\b/, 6],
    ],
  },
  {
    id: 'comptabilite-consolidation',
    label: 'Comptabilité & Consolidation',
    patterns: [
      // Categories fiscales francaises. La barre oblique devient une espace
      // apres normalize() : « BIC/BNC » y est « bic bnc ».
      [/\bbic bnc\b/, 8],
      // Diplomes comptables francais. Aussi ajoutes aux MARQUEURS FINANCE :
      // Forvis Mazars « DCG / DSCG Agricole » etait rejete a la porte alors
      // que Deloitte « Comptable - DSCG » etait classe.
      [/\bd[cs]cg\b/, 9],
      // L'arrete comptable. Mesure sur les 912 publiees : le mot n'y apparait
      // nulle part ailleurs, aucune ambiguite constatee.
      [/\barretes?\b/, 8],
      // La fiscalite nomme une DISCIPLINE, pas une chaine accidentelle : le
      // catalogue porte deja « Comptabilite Fiscale » (Rothschild) et
      // « reglementations fiscales » (CACIB). Le bon test n'est pas « combien
      // aujourd'hui » mais « ce mot designera-t-il encore un metier dans six
      // mois ».
      [/\bfiscalist|\banalyste fiscal|\bfiscalite\b|\btax (?:analyst|manager|officer|specialist)\b/, 8],
      [/\bcomptab/, 7],
      [/\baccountant\b/, 7],
      [/\baccounting\b/, 7],
      [/\bconsolid/, 8],
      [/\bexpertise comptable\b/, 9],
      // Chez un cabinet francais, 'Expertise Conseil' = expertise comptable,
      // pas conseil en transformation.
      [/\bexpertise conseil\b/, 9],
      [/\bcommissariat aux comptes\b/, 9],
      [/\bcloture comptable\b/, 9],
      [/\brevision comptable\b/, 9],
      [/\bifrs\b/, 7],
      [/\bfund accountant\b/, 10],
      [/\bcomptable de fonds\b/, 10],
      [/\bcomptab.{0,10}(?:opc|fonds)\b/, 10],
      [/\bfacturation\b/, 6],
      [/\bfiscalite\b/, 7],
      [/\bfiscal(?:e|iste)\b/, 6],
    ],
  },
  {
    id: 'controle-gestion-tresorerie',
    label: 'Contrôle de gestion & Trésorerie',
    patterns: [
      // Analyse de performance economique, chez Louis Vuitton. Mesure faite :
      // n'attrape rien d'autre dans les 912 publiees.
      [/\b(?:analyse (?:de )?performance economique|business performance analyst)\b/, 6],
      // La version francaise de « transfer pricing », qui fonctionnait deja.
      [/\bprix de transfert\b/, 8],
      // Au SINGULIER, et c'est deliberé : CACIB a « Data analyst Cash
      // Management » et « Global Cash Management Inbound Origination » en
      // Financements, qui ne doivent pas bouger.
      [/\bcash manager\b/, 7],
      [/\bcontrole de gestion\b/, 9],
      [/\bcontroleur(?:se)? de gestion\b/, 9],
      // « non controlling interests » = interets minoritaires, du vocabulaire
      // comptable standard. Ce n'est pas du controle de gestion.
      [/(?<!\bnon[\s-])\bcontrolling\b/, 8],
      [/\bcontroller\b/, 8],
      [/\bfp&a\b/, 9],
      [/\bfinancial planning\b/, 9],
      [/\bcontrole financier\b/, 8],
      [/\bcontroleur(?:se)? financi/, 8],
      [/\bcost control/, 8],
      [/\bpilotage financier\b/, 8],
      [/\bbudget/, 6],
      [/\bperformance (?:analyst|financiere|operationnelle)\b/, 6],
      [/\bbusiness (?:controller|controlling|performance)\b/, 8],
      [/\bp&l\b/, 6],
      [/\btresorerie\b/, 9],
      [/\btresorier(?:e)?\b/, 9],
      [/\btreasury\b/, 8],
      [/\balm\b/, 7],
      [/\basset (?:&|and) liability\b/, 8],
      [/\bactif passif\b/, 8],
      [/\bcredit management\b/, 8],
      [/\brecouvrement\b/, 6],
      [/\bfinance corporate\b/, 8],
      [/\btransfer pricing\b/, 9],
      [/\bgestion(?:naire)? financier(?:e)? (?:des contrats)?\b/, 7],
      [/\badministratif et financier\b/, 7],
      [/\bgestion du bilan\b/, 9],
      [/\bliquidite\b/, 8],
    ],
  },
  {
    id: 'audit-controle-interne',
    label: 'Audit & Contrôle interne',
    patterns: [
      [/\baudit(?:eur|rice|ing)?\b/, 7],
      [/\bcommissaire aux comptes\b/, 9],
      [/\bcontrole interne\b/, 8],
      [/\bcontroleur(?:s)? interne\b/, 8],
      [/\binternal control\b/, 8],
      [/\binternal audit/, 8],
      [/\binspection generale\b/, 9],
      [/\binspecteur(?:-)?(?:rice )?(?:audit|auditeur)\b/, 9],
      [/\bcontrole permanent\b/, 6],
      [/\bcontroleur permanent\b/, 6],
      // "Inspecteur-rice generaliste" chez une banque = inspection generale.
      // "Inspecteur assurance" est un metier commercial, capte plus haut par
      // Actuariat & Assurance avec un poids superieur.
      [/\binspect(?:eur|rice)\b/, 6],
    ],
  },
  {
    id: 'risques-conformite',
    label: 'Risques & Conformité',
    patterns: [
      // Investigation et litiges, chez PwC.
      [/\b(?:investigation et litiges|forensic)\b/, 7],
      // Controle de niveau 2 : vocabulaire bancaire standard, sans ambiguite.
      [/\bcontroleu?r? de niveau 2\b/, 9],
      [/\brisques? (?:de )?credit\b/, 9],
      [/\bcredit risk\b/, 9],
      [/\brisques? (?:de )?marche\b/, 9],
      [/\bmarket risk\b/, 9],
      [/\brisques? operationnels?\b/, 9],
      [/\brisques?\b/, 6],
      [/\brisk\b/, 6],
      [/\bconformite\b/, 9],
      [/\bcompliance\b/, 9],
      [/\bfraud\b/, 8],
      [/\bkyc\b/, 9],
      [/\blcb ?-? ?ft\b/, 10],
      [/\baml\b/, 9],
      [/\bblanchiment\b/, 9],
      [/\bsecurite financiere\b/, 9],
      [/\bsanctions\b/, 8],
      [/\bembargos?\b/, 9],
      [/\bfraude\b/, 8],
      [/\bfinancial crime\b/, 9],
      [/\bdeontolog/, 9],
      [/\breporting reglementaire\b/, 8],
      [/\bregulatory reporting\b/, 8],
      [/\bstress ?-? ?tests?\b/, 8],
      [/\bsurveillance des marches\b/, 9],
      [/\bcontroleur bancaire\b/, 9],
      [/\bcontroleur entreprises d investissement\b/, 9],
      [/\bprudential(?:le)?\b/, 8],
      [/\bprudentiel(?:s|le)?\b/, 8],
      [/\bsolvabilite\b/, 7],
      [/\bcontrole permanent (?:de )?conformite\b/, 10],
      [/\bcontroleur permanent.{0,10}(?:lcb|conformite)\b/, 10],
      [/\bdonnees reglementaires\b/, 7],
      // Cotation des entreprises a la Banque de France = analyse credit
      [/\banalyste (?:entreprises?|groupes?)\b/, 7],
      [/\bretablissement\b/, 8],
      [/\bresolution\b/, 7],
      [/\bsupervision de la notation\b/, 8],
      [/\bagrements?\b/, 8],
      [/\bcrises? bancaires?\b/, 9],
      [/\bcredit\b/, 4],
      [/\bcontroleur des (?:assurances|organismes)/, 9],
      [/\bbcbs\b/, 9],
      [/\bsolvency\b/, 8],
    ],
  },
  {
    id: 'operations-middle-office',
    label: 'Opérations & Middle-office',
    patterns: [
      // Qualifie a dessein. Le generique « operations financieres » deplacait
      // PwC « Consultant en operations financieres » de Conseil vers ici, et
      // ce a n'importe quel poids — teste a 7, 5 et 4.
      [/\bcharge d operations financieres\b/, 7],
      // Retrocessions de commissions. ATTENTION : « Retrocession Analyst » chez
      // Scor est de la REASSURANCE et doit rester en Actuariat — verifie le
      // 04/09, son motif actuariel l'emporte.
      [/\b(?:trailer fees|retrocessions?)\b/, 8],
      [/\bmiddle ?-? ?office\b/, 8],
      [/\bback ?-? ?office\b/, 8],
      [/\bfront to back\b/, 9],
      [/\bpost ?-? ?marche\b/, 9],
      [/\bdepositaire\b/, 9],
      [/\bcustody\b/, 9],
      [/\bfund admin/, 9],
      [/\breglement ?-? ?livraison\b/, 9],
      [/\bsettlement\b/, 9],
      [/\bcorporate actions\b/, 9],
      [/\bost\b/, 7],
      [/\bcollateral\b/, 8],
      [/\bswift\b/, 8],
      [/\bmoyens de paiement\b/, 8],
      [/\bmonetique\b/, 8],
      [/\bclient onboarding\b/, 8],
      [/\bgestionnaire (?:d )?operations?\b/, 8],
      [/\boperations? (?:bancaires?|titres?|de marche|transverses?)\b/, 8],
      [/\boperations? et processus\b/, 8],
      [/\bbanking operations\b/, 8],
      [/\bvalorisation (?:de fonds|opc)\b/, 9],
      [/\binstruments? financiers?\b/, 7],
      [/\bunites? de comptes?\b/, 8],
      [/\bbusiness management\b/, 5],
      [/\bdepositary\b/, 9],
      [/\breferentiels?\b/, 7],
      [/\bcontrat(?:s)? financement\b/, 7],
      [/\brelationship manager\b/, 5],
      [/\bmiddle officer\b/, 9],
      [/\bclient operations? officer\b/, 9],
      [/\bdata officer\b/, 7],
      [/\bpositions keeping\b/, 9],
      [/\btrade management\b/, 8],
      [/\bfund (?:execution|distribution services)\b/, 9],
      [/\bclearing\b/, 8],
      [/\bcoupons?\b/, 7],
      [/\bgestion documentaire\b/, 6],
    ],
  },
  {
    id: 'data-quant',
    label: 'Data & Quant',
    patterns: [
      [/\bquantitatif?\b/, 9],
      [/\bquantitative\b/, 9],
      [/\bquant\b/, 9],
      [/\bdata scien/, 8],
      [/\bdata analyst\b/, 7],
      [/\banalyste data\b/, 7],
      [/\bmachine learning\b/, 8],
      [/\bmodelisation\b/, 8],
      [/\bmodelisateur\b/, 8],
      [/\bvalidation de modeles\b/, 9],
      [/\bscoring\b/, 8],
      [/\bbusiness intelligence\b/, 8],
      [/\bdataviz/, 8],
      [/\bchief data officer\b/, 8],
      [/\bdata (?:engineer|manager|steward)\b/, 8],
      [/\betudes? statistiques?\b/, 6],
      [/\bstatisticien\b/, 7],
      [/\bdonnees financieres\b/, 7],
      [/\bdonnees monetaires\b/, 7],
      [/\bqualite des donnees\b/, 7],
      [/\b(?:ia|ai) (?:&|et|and) data\b/, 6],
      [/\banalyse de(?:s)? modeles?\b/, 8],
      [/\bmodele interne\b/, 8],
      [/\bmodeles? quantitatifs?\b/, 9],
      [/\bdata modeler\b/, 8],
    ],
  },
  {
    id: 'conseil-transformation',
    label: 'Conseil & Transformation',
    patterns: [
      // Conseil a la fonction finance : exactement le perimetre qu'on garde.
      [/\bcfo advisory\b/, 8],
      [/\bconsultant(?:e)?\b/, 4],
      [/\bconseil\b/, 4],
      [/\badvisory\b/, 4],
      [/\btransformation\b/, 4],
      [/\bbusiness analyst\b/, 4],
      [/\bmoa\b/, 5],
      [/\bamoa\b/, 5],
      [/\bmaitrise d ouvrage\b/, 6],
      [/\bchef(?:fe)? de projet\b/, 4],
      [/\bgestion de projets?\b/, 4],
      [/\bproject manag/, 4],
      [/\bpmo\b/, 4],
      [/\bproduct owner\b/, 4],
      [/\bsystemes? d informations?\b/, 5],
    ],
  },
  {
    id: 'autres',
    label: 'Autres métiers de la finance',
    patterns: [
      [/\beconomiste\b/, 8],
      [/\beconomist\b/, 8],
      [/\bmacroeconomiste\b/, 9],
      [/\betudes economiques\b/, 8],
      [/\bveille economique\b/, 8],
      [/\banalyste economique\b/, 8],
      [/\bjuriste (?:financier|bancaire|fonds)\b/, 8],
      [/\btransactions? immobilieres?\b/, 8],
      [/\bcrypto ?-? ?actifs?\b/, 8],
      [/\bdigital assets\b/, 8],
      [/\badjudications?\b/, 8],
      [/\bveille et prospective\b/, 7],
      [/\bsofica\b/, 8],
    ],
  },
];

// ---------------------------------------------------------------------------
// Tags transversaux
// ---------------------------------------------------------------------------

const TAGS = [
  ['esg', [/\besg\b/, /\bisr\b/, /\brse\b/, /\bsustainab/, /\bdurable\b/, /\bimpact\b/, /\bclimat\b/, /\bcsrd\b/, /\bsfdr\b/, /\bextra ?-? ?financier\b/]],
  ['real-assets', [/\bimmobilier\b/, /\breal estate\b/, /\binfrastructure/, /\breal assets\b/, /\bhospitality\b/]],
  ['international', [/\bvie\b/, /\binternational\b/, /\bemea\b/, /\bcross ?-? ?border\b/]],
];

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function scoreFamily(family, title) {
  let best = 0;
  for (const [re, weight] of family.patterns) {
    if (weight > best && re.test(title)) best = weight;
  }
  return best;
}

/**
 * @param {{title: string, employer: string}} offer
 * @returns {{status: 'rejected'|'unclassified'|'classified',
 *            reason?: string, structure: string|null,
 *            famille?: string, familleLabel?: string, score?: number, tags: string[]}}
 */
function classify(offer) {
  const title = normalize(offer.title);
  const structure = resolveStructure(offer.employer);
  const tags = TAGS.filter(([, res]) => res.some((re) => re.test(title))).map(([id]) => id);

  // Score de famille, calcule avant le pre-filtre : il sert de garde-fou.
  let winner = null;
  let winnerScore = 0;
  for (const family of FAMILIES) {
    const score = scoreFamily(family, title);
    if (score > winnerScore) {
      winner = family;
      winnerScore = score;
    }
  }

  // Etape 1 — pre-filtre, sauf si l'intitule porte une exception explicite.
  //
  // Garde-fou sur le motif 'retail' uniquement : un intitule qui porte un
  // metier SANS AMBIGUITE (score >= 9) n'est pas de la vente en agence, meme
  // s'il commence par "Conseiller". C'est ce qui sauve "Conseiller d'Etudes
  // Actuarielles & Pilotage de Provisionnement" sans rouvrir la porte a
  // "Conseiller Banque et Assurances" ni a "Conseiller-ere Monetique",
  // qui plafonnent a 8.
  // Les motifs 'support' et 'hors-domaine' ne beneficient pas du garde-fou :
  // une offre de pharmacovigilance reste hors perimetre quoi qu'elle porte.
  // Un titre qui nomme la DISTRIBUTION ne peut pas etre exempte, meme s'il
  // contient « patrimoine » : c'est le nom du reseau, pas celui du metier.
  const exempte =
    PREFILTER_EXCEPTIONS.some((re) => re.test(title)) && !DISTRIBUTION_ASSURANCE.test(title);
  // Le recouvrement de creances : traitement de dossier (§30). « Analyste
  // Suivi et Pilotage Recouvrement » n'en est pas — il analyse et pilote.
  // Le recouvrement se juge sur l'EMPLOYEUR, pas sur le titre. Chez un
  // industriel c'est du credit management — relancer les clients, piloter le
  // DSO — donc un poste de direction financiere. Chez une banque, un Big Four
  // ou un assureur, c'est du recouvrement de creances : gestion de dossier.
  //
  // Rexel « Gestionnaire de Recouvrement » reste ; Societe Generale « Charge
  // de Recouvrement » sort. Le titre est le meme, l'employeur tranche.
  if (
    RECOUVREMENT_DOSSIER.test(title) &&
    !RECOUVREMENT_PILOTAGE.test(title) &&
    structure !== 'entreprise'
  ) {
    return { status: 'rejected', reason: 'prefilter:traitement-dossier', structure, tags };
  }

  // Le systeme comme SUJET : « Business Analyst », « PMO », « Agile BA ».
  // Le systeme comme OUTIL de la finance reste : « ERP Oracle / Finance »,
  // « transformation SI/Finance », « PMO monnaie numerique de banque
  // centrale ». C'est le test du §30 : qui est le sujet, qui est le decor.
  if (TITRE_DE_SYSTEME.test(title) && !hasFinanceMarker(title)) {
    return { status: 'rejected', reason: 'prefilter:systeme-information', structure, tags };
  }

  if (!exempte) {
    for (const [re, reason] of PREFILTER) {
      if (!re.test(title)) continue;
      if (reason === 'retail' && winnerScore >= 9) break;
      return { status: 'rejected', reason: `prefilter:${reason}`, structure, tags };
    }
  }

  // Etape 2 — porte finance
  const gated = GATED_STRUCTURES.has(structure);
  if (gated && !hasFinanceMarker(title)) {
    return {
      status: 'rejected',
      // Nom du motif : ces employeurs SONT dans maisons.txt, c'est la table des
      // structures qui ne les porte pas encore. Le motif doit nommer ce qu'il
      // mesure, sinon il oriente vers la mauvaise correction.
      reason: structure ? `gate:${structure}-sans-marqueur` : 'gate:employeur-absent-de-structures',
      structure,
      tags,
    };
  }

  // Etape 3 — famille : le score a deja ete calcule plus haut.

  // Coups de pouce structure : quand l'intitule est generique, l'employeur tranche.
  const byId = (id) => FAMILIES.find((f) => f.id === id);

  // Le credit management d'un industriel : « Gestionnaire de Recouvrement »
  // chez Rexel n'est pas un intitule generique, c'est le pilotage du poste
  // client. Il se range en Controle de gestion & Tresorerie.
  if (!winner && structure === 'entreprise' && /\brecouvrement\b/.test(title)) {
    winner = byId('controle-gestion-tresorerie');
    winnerScore = 6;
  }

  // Chez un fonds, un intitule generique releve du capital-investissement.
  if ((!winner || winnerScore <= 4) && structure === 'fonds') {
    winner = byId('capital-investissement');
    winnerScore = 5;
  }

  // Chez une banque d'affaires, "Advisory" ou "Analyst" seuls, c'est du deal.
  // ... mais SEULEMENT si le titre porte deja un indice de metier financier.
  // Sans cette condition le coup de pouce servait de FILET : douze offres sur
  // 78 n'avaient aucun vocabulaire de deal — « Product Owner e-banking »,
  // « Junior AI Adoption », « Services Bancaires ». C'etait le fourre-tout du
  // Conseil revenu sous un nom credible. Mieux vaut un fourre-tout honnete
  // qu'un M&A faux.
  // Quatre metiers que personne ne nommait, trouves dans le residu du
  // 04/09/2026. On les NOMME plutot que de les rattraper par la structure :
  // un coup de pouce d'employeur ferait rentrer avec eux tout ce qui traine.
  if (!winner) {
    if (/\bstructured product|\bproduits? structures?\b/.test(title)) {
      winner = byId('marches-financiers');
      winnerScore = 7;
    } else if (/\breporting reglementaire|\breporting prudentiel|\bcorep\b|\bfinrep\b/.test(title)) {
      winner = byId('risques-conformite');
      winnerScore = 7;
    } else if (/\bcharge d affaires internationa|\btrade finance\b|\bfinancement du commerce\b/.test(title)) {
      // Le commerce international se finance : c'est du coverage, pas du M&A.
      winner = byId('financements-coverage');
      winnerScore = 7;
    }
  }

  const INDICE_METIER_BA =
    /\b(?:analyst|analyste|advisory|conseil|associate|banker|banquier|deal|transaction|corporate|finance|financier|financiere|investment|fusion|acquisition|lbo|valuation|due diligence|ecm|dcm|leveraged|restructuring|capital|equity|credit|debt|asset|gestion)\b/;
  if (
    structure === 'banque-affaires' &&
    (!winner || (winner.id === 'conseil-transformation' && winnerScore <= 4)) &&
    INDICE_METIER_BA.test(title)
  ) {
    winner = byId('fusions-acquisitions');
    winnerScore = 5;
  }

  // L'analyste financier generique. "Financial Analyst" ne dit pas le metier :
  // en entreprise c'est du controle de gestion, en banque ou en gestion c'est
  // de l'analyse de marche. L'employeur tranche, pas l'intitule.
  // « Charge d'etudes financieres » rejoint la liste : c'est un intitule
  // standard du secteur, et il route DEJA selon la structure — chez un
  // assureur il va au controle de gestion, chez un gerant a l'analyse de
  // marche, chez un regulateur a l'analyse prudentielle. Une ligne suffit la
  // ou trois familles en dur auraient fige un choix par employeur.
  const ANALYSTE_GENERIQUE = /\b(?:analyste financi(?:er|ere)|financial analyst|finance analyst|finance officer|analyste finance|charge d etudes financieres|chargee d etudes financieres|etudes financieres)\b/;
  if (!winner && ANALYSTE_GENERIQUE.test(title)) {
    const versMarches = new Set(['bfi', 'banque-affaires', 'societe-gestion', 'fonds']);
    // Chez un regulateur ou une banque centrale, l'analyste financier fait de
    // la cotation d'entreprises et de l'analyse prudentielle.
    let cible = 'controle-gestion-tresorerie';
    if (versMarches.has(structure)) cible = 'marches-financiers';
    else if (structure === 'institution') cible = 'risques-conformite';
    winner = byId(cible);
    winnerScore = 5;
  }

  // Une offre dont le SEUL signal finance est l'ESG n'a, par construction,
  // aucune famille : l'ESG est un tag transverse et non une famille. Sans ce
  // rattrapage elle tombe mecaniquement dans le residu. On la range sur son
  // metier sous-jacent, que l'employeur permet de deviner.
  // Restreint aux societes de gestion et aux fonds : chez eux, l'ESG est un
  // metier d'investissement. Ailleurs — banque, assurance, entreprise — c'est
  // le plus souvent de la RSE d'entreprise, qui n'est pas dans le perimetre.
  const ESG_METIER = new Set(['societe-gestion', 'fonds']);
  if (!winner && tags.includes('esg') && ESG_METIER.has(structure)) {
    winner = byId('gestion-actifs');
    winnerScore = 4;
  }

  // Chez une BFI, les programmes generiques : "Banking" c'est le financement
  // et la couverture client, "Sales" c'est la vente de produits de marche.
  if (structure === 'bfi' && !winner) {
    if (/\bbanking\b/.test(title)) {
      winner = byId('financements-coverage');
      winnerScore = 5;
    } else if (/\bsales\b/.test(title)) {
      winner = byId('marches-financiers');
      winnerScore = 5;
    }
  }

  if (!winner) {
    return { status: 'unclassified', structure, tags };
  }

  return {
    status: 'classified',
    structure,
    famille: winner.id,
    familleLabel: winner.label,
    score: winnerScore,
    tags,
  };
}

/**
 * Test large, destine au FILTRE D'ENTREE de sources.js.
 *
 * Reunit tous les motifs de familles et tous les marqueurs finance : c'est
 * volontairement permissif. Le tri fin est fait ensuite par classify(), qui
 * dispose de l'employeur et de la structure. Une offre acceptee ici et rejetee
 * plus loin ne coute rien ; une offre refusee ici est perdue sans trace.
 *
 * Regle : le filtre d'entree optimise le rappel, le classifieur la precision.
 * Jamais l'inverse. Ne pas dupliquer de liste de mots dans sources.js —
 * appeler cette fonction, pour qu'il n'y ait qu'une seule source de verite.
 */
function isFinanceCandidate(rawTitle) {
  const title = normalize(rawTitle);
  if (!title) return false;
  if (hasFinanceMarker(title)) return true;
  return FAMILIES.some((family) => family.patterns.some(([re]) => re.test(title)));
}

module.exports = {
  classify,
  isFinanceCandidate,
  normalize,
  FAMILIES,
  PREFILTER,
  FINANCE_MARKERS,
  TAGS,
  GATED_STRUCTURES,
};
