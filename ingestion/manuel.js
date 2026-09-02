// ingestion/manuel.js
//
// Offres ajoutées à la main — pour les entreprises dont l'ATS ne peut pas être
// câblé automatiquement (portail fermé, pare-feu anti-bot, backend
// propriétaire non documenté...). Voir PROJET.md §7.3 : c'est le mécanisme de
// "soumission" prévu dès le brief pour couvrir ces cas.
//
// Chaque entrée est un format BRUT minimal, exactement comme un item renvoyé
// par n'importe quel connecteur de sources.js. Le pipeline (pipeline.js) les
// fait passer par EXACTEMENT le même traitement que les offres automatisées :
// classement dans l'onglet, inférence de la famille métier et du type de
// structure, filtre junior, déduplication, fraîcheur. Le résultat final est
// donc rigoureusement identique dans sa forme à une offre automatisée — seule
// la collecte initiale est manuelle.
//
// Règle d'or : une offre ajoutée ici doit être VÉRIFIÉE (lien cliqué, annonce
// réelle et actuellement ouverte) avant d'être commitée. Ne jamais inventer
// une URL ou un intitulé — le moat du site (§2 du brief) est zéro ghost job.
//
// SECONDE RÈGLE, tout aussi importante : l'URL doit pointer vers le SITE DE
// L'ENTREPRISE (ou son ATS). Jamais vers JobTeaser, Welcome to the Jungle,
// Wizbii, HelloWork, Indeed, LinkedIn... Un candidat qui clique sur une offre
// EY doit arriver chez EY, pas sur un job board qui lui demandera un compte.
// Le pipeline rejette désormais automatiquement ces domaines (INTERMEDIAIRE_RE),
// donc une entrée fautive disparaîtra silencieusement du site.
//
// Champs par entrée :
//   emp          — nom de l'entreprise (tel qu'affiché)
//   title        — intitulé exact du poste
//   url          — lien DIRECT vers l'annonce (jamais une page carrières générique)
//   loc          — ville
//   typeContrat  — texte libre décrivant le contrat (ex: "Stage", "CDI",
//                  "Alternance", "VIE") — passe par le même classifyVolet()
//                  que les autres sources, donc les mots-clés français/anglais
//                  habituels suffisent.
//   category     — (optionnel) intitulé de département/famille tel qu'affiché
//                  par l'entreprise, aide à l'inférence de famille métier.
//   addedOn      — date (YYYY-MM-DD) à laquelle l'entrée a été vérifiée, pour
//                  savoir quand la revérifier.

'use strict';

const MANUAL_OFFERS = [
  // --- Grandes banques (bloquées côté automatisation, ajoutées via agrégateur légal Adzuna) ---
  {
    emp: 'BNP Paribas',
    title: 'Conseiller Bancaire en Ligne - H/F',
    url: 'https://www.adzuna.fr/details/5852109657',
    loc: 'Nantes',
    typeContrat: 'CDD',
    category: 'Banque de détail',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Société Générale',
    title: 'Stage : Conseil en banque privée-(H/F)',
    url: 'https://www.adzuna.fr/details/5796587342',
    loc: 'Villefranche-sur-Saône',
    typeContrat: 'Stage',
    category: 'Gestion de patrimoine',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Crédit Agricole CIB',
    title: 'Analyste quantitatif H/F',
    url: 'https://groupecreditagricole.jobs/en/our-jobs-offer/577-170470-4-analyste-quantitatif-hf-reference--2026-107489--/',
    loc: 'Montrouge',
    typeContrat: 'CDI',
    category: 'Risk Management / Control',
    addedOn: '2026-08-29',
  },

  // --- Banques d'investissement (BFI) — portails fermés, vérifiées à la main ---
  // Note : les postes juridiques (juriste, legal counsel) trouvés chez Nomura et
  // CIC ne sont pas repris : le juridique n'est pas une des 9 familles de JJ.
  {
    emp: 'Bank of America',
    title: 'Investment Banking Associate, Paris',
    url: 'https://careers.bankofamerica.com/en-us/job-detail/26006566/investment-banking-associate-paris-paris-france',
    loc: 'Paris',
    typeContrat: 'CDI',
    category: "M&A / Banque d'investissement",
    addedOn: '2026-08-29',
  },

  // --- Audit / conseil (Big 4 et cabinets) ---
  {
    emp: 'Accuracy',
    title: 'Finance & Strategy Junior Consultants',
    url: 'https://www.consultor.fr/carrieres/offre-d-emploi/finance-strategy-junior-consultants',
    loc: 'Paris',
    typeContrat: 'CDI',
    category: 'Conseil financier',
    addedOn: '2026-08-29',
  },

  // --- Banques (portails fermés ou propriétaires) ---
  {
    emp: 'Fortuneo',
    title: 'Conseiller Clientèle H/F',
    url: 'https://www.welcometothejungle.com/fr/companies/fortuneo/jobs/conseiller-clientele-h-f_FORTU_60D1oo3',
    loc: 'Brest',
    typeContrat: 'CDD',
    category: 'Banque',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Hello bank!',
    title: 'Conseiller Bancaire en ligne - Hello bank! H/F',
    url: 'https://group.bnpparibas/emploi-carriere/offre-emploi/conseiller-bancaire-en-ligne-h-f-21',
    loc: 'Lille',
    typeContrat: 'CDI',
    category: 'Banque',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Lazard',
    title: 'Contrôleur dépositaire - H/F',
    url: 'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/LazardProfessionalCareers/job/6501',
    loc: 'Paris',
    typeContrat: 'CDI',
    category: 'Contrôle dépositaire',
    addedOn: '2026-08-29',
  },

  // --- M&A / Gestion d'actifs ---
  {
    emp: 'Alantra',
    title: 'Stage M&A - Juillet / Septembre 2026',
    url: 'https://www.welcometothejungle.com/en/companies/alantra/jobs/stage-m-a-juillet-septembre-2026_paris',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: 'M&A',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Cambon Partners',
    title: 'Analyste M&A - Stage septembre 2026',
    url: 'https://www.welcometothejungle.com/en/companies/cambon-partners/jobs/analyste-m-a-stage-juillet-ou-septembre-2026_paris',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: 'M&A',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Clipperton',
    title: 'Technology M&A Analyst (Internship)',
    url: 'https://www.hellowork.com/fr-fr/emplois/80799900.html',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: 'M&A',
    addedOn: '2026-08-29',
  },
  {
    emp: 'BNP Paribas Asset Management',
    title: 'Stage Analyste Quantitatif H/F',
    url: 'https://www.wizbii.com/company/bnp-paribas/job/stage-analyste-quantitatif-h-f-2',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: "Gestion d'actifs",
    addedOn: '2026-08-29',
  },
  {
    emp: 'Ostrum Asset Management',
    title: 'Gérant Analyste Actions Europe Junior (H/F)',
    url: 'https://www.wizbii.com/company/groupe-bpce/job/gerant-analyste-actions-europe-junior-h-f-ostrum-am',
    loc: 'Paris',
    typeContrat: 'CDI',
    category: "Gestion d'actifs",
    addedOn: '2026-08-29',
  },
  {
    emp: 'Mirova',
    title: 'Stage - Analyste Fonds Infrastructures (H/F)',
    url: 'https://www.wizbii.com/company/mirova/job/stage-analyste-fonds-infrastructures-h-f',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: "Gestion d'actifs",
    addedOn: '2026-08-29',
  },
  {
    emp: "La Financière de l'Échiquier",
    title: 'Stagiaire Analyste ISR - 6 mois (H/F)',
    url: 'https://www.wizbii.com/company/la-financiere-de-l-echiquier/job/stagiaire-analyste-isr-6-mois-h-f',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: "Gestion d'actifs",
    addedOn: '2026-08-29',
  },
  {
    emp: 'Edmond de Rothschild Asset Management',
    title: 'Stage Analyste Private Equity H/F',
    url: 'https://www.wizbii.com/company/edmond-de-rothschild/job/stage-analyste-private-equity-h-f-1',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: "Gestion d'actifs / Private Equity",
    addedOn: '2026-08-29',
  },

  // --- Private Equity / VC / Infrastructure ---
  {
    emp: 'Astorg',
    title: 'Private Equity Internship (Paris) - September 2026 / January 2027 (6 months)',
    url: 'https://www.jobteaser.com/en/job-offers/7ca3e351-07e5-407a-aef6-6d65bbbbda4f-astorg-partners-private-equity-internship-paris-september-2026-january-2027-6-months',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: 'Private Equity',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Siparex',
    title: 'Analyste Private Equity – Fonds France Nucléaire',
    url: 'https://www.welcometothejungle.com/fr/companies/siparex/jobs/analyste-private-equity-fonds-france-nucleaire_paris',
    loc: 'Paris',
    typeContrat: 'Stage',
    category: 'Private Equity',
    addedOn: '2026-08-29',
  },

  // --- Assurance / Actuariat ---
  {
    emp: 'Allianz France',
    title: "Chargé(e) d'études actuarielles (H/F) - Alternance",
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/emploi/offres_emploi_partenaires/69d979035f615d8918dba83a/conseil-vente-de-produits-bancaires-ou-d-assurance-gestion-de-client%C3%A8le',
    loc: 'Courbevoie',
    typeContrat: 'Alternance',
    category: 'Actuariat',
    addedOn: '2026-08-29',
  },
  {
    emp: 'CNP Assurances',
    title: 'Actuaire Confirmé - Tarification Emprunteur Individuel (H/F)',
    url: 'https://cnp-recrute.talent-soft.com/Pages/Offre/detailoffre.aspx?idOffre=7627&idOrigine=502&LCID=1036&offerReference=2026-7627',
    loc: 'Issy-les-Moulineaux',
    typeContrat: 'CDI',
    category: 'Actuariat',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Covéa',
    title: 'Data Scientist F/H',
    url: 'https://recrutement.covea.com/job/data-scientist-f-h-in-paris-fr-jid-988',
    loc: 'Paris',
    typeContrat: 'CDI',
    category: 'Actuariat / Data',
    addedOn: '2026-08-29',
  },
  {
    emp: 'Generali France',
    title: "Alt - Technicien d'Actuariat H/F",
    url: 'https://www.jobijoba.com/fr/annonce/54/2cba48a7454f2ee574229d1edc4d3ac4',
    loc: 'Saint-Denis',
    typeContrat: 'Alternance',
    category: 'Actuariat',
    addedOn: '2026-08-29',
  },

];

module.exports = { MANUAL_OFFERS };
