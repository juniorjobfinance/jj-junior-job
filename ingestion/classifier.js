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
      [/\bcoverage\b/, 8],
      [/\bcorporate banking\b/, 8],
      [/\bnetwork banking\b/, 8],
      [/\btransaction banking\b/, 8],
      [/\btrade finance\b/, 9],
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
      [/\basset management\b/, 8],
      [/\bgestion d actifs\b/, 8],
      [/\bgerant(?:e)? (?:de )?portefeuille\b/, 9],
      [/\bgestionnaire de portefeuille\b/, 9],
      [/\bportfolio (?:manager|management|analyst)\b/, 8],
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
      [/\bsolvabilite ?(?:2|ii)\b/, 9],
      [/\bsolvency ?(?:2|ii)\b/, 9],
      [/\breassurance\b/, 9],
      [/\bretrocession\b/, 9],
      [/\bsouscript/, 8],
      [/\bunderwrit/, 8],
      [/\bsinistres?\b/, 8],
      [/\bindemnisation\b/, 8],
      [/\biard\b/, 8],
      [/\bprevoyance\b/, 8],
      [/\bassurance vie\b/, 7],
      [/\betudes? statistiques? (?:et )?(?:actuarielles|techniques)\b/, 9],
      [/\bcomptab.{0,15}(?:technique )?assurance\b/, 8],
      [/\breinsurance\b/, 9],
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
      [/\bcomptab/, 7],
      [/\baccountant\b/, 7],
      [/\baccounting\b/, 7],
      [/\bconsolid/, 8],
      [/\bexpertise comptable\b/, 9],
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
      [/\bcontrole de gestion\b/, 9],
      [/\bcontroleur(?:se)? de gestion\b/, 9],
      [/\bcontrolling\b/, 8],
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

  // Etape 1 — pre-filtre, sauf si l'intitule porte une exception explicite
  const exempte = PREFILTER_EXCEPTIONS.some((re) => re.test(title));
  if (!exempte) {
    for (const [re, reason] of PREFILTER) {
      if (re.test(title)) {
        return { status: 'rejected', reason: `prefilter:${reason}`, structure, tags };
      }
    }
  }

  // Etape 2 — porte finance
  const gated = GATED_STRUCTURES.has(structure);
  if (gated && !hasFinanceMarker(title)) {
    return {
      status: 'rejected',
      // « absent-de-structures » et non « inconnu » : dans le pipeline de JJ, ces
      // employeurs sont bien connus — ils sont dans maisons.txt — c'est la table
      // des structures qui ne les porte pas encore. Le motif doit nommer ce qu'il
      // mesure, sinon il oriente vers la mauvaise correction.
      //
      // ATTENTION : ce renommage a déjà été perdu DEUX fois par une recopie de
      // classifier.js depuis Downloads. Le reporter dans le fichier source.
      reason: structure ? `gate:${structure}-sans-marqueur` : 'gate:employeur-absent-de-structures',
      structure,
      tags,
    };
  }

  // Etape 3 — famille par score de specificite
  let winner = null;
  let winnerScore = 0;
  for (const family of FAMILIES) {
    const score = scoreFamily(family, title);
    if (score > winnerScore) {
      winner = family;
      winnerScore = score;
    }
  }

  // Coups de pouce structure : quand l'intitule est generique, l'employeur tranche.
  const byId = (id) => FAMILIES.find((f) => f.id === id);

  // Chez un fonds, un intitule generique releve du capital-investissement.
  if ((!winner || winnerScore <= 4) && structure === 'fonds') {
    winner = byId('capital-investissement');
    winnerScore = 5;
  }

  // Chez une banque d'affaires, "Advisory" ou "Analyst" seuls, c'est du deal.
  if (structure === 'banque-affaires' && (!winner || (winner.id === 'conseil-transformation' && winnerScore <= 4))) {
    winner = byId('fusions-acquisitions');
    winnerScore = 5;
  }

  // L'analyste financier generique. "Financial Analyst" ne dit pas le metier :
  // en entreprise c'est du controle de gestion, en banque ou en gestion c'est
  // de l'analyse de marche. L'employeur tranche, pas l'intitule.
  const ANALYSTE_GENERIQUE = /\b(?:analyste financi(?:er|ere)|financial analyst|finance analyst|finance officer|analyste finance)\b/;
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
