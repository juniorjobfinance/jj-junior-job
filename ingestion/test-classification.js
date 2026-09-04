/**
 * Jeu de test : les offres mal classees reperees dans le catalogue du 2026-09-03.
 * `expect` = famille attendue, 'REJET' = ne doit pas entrer sur le site.
 */
const { classify } = require('./classifier');

const CASES = [
  // --- doivent etre rejetees (hors finance) ------------------------------
  ['Christian Dior Couture', 'Assistant Merchandising Business Analyst Europe', 'REJET'],
  ['Bulgari France', 'Perfume Business Analyst - Americas', 'REJET'],
  ['Veolia Environnement', 'PANGEO Project Manager Officer Global', 'REJET'],
  ['Sanofi Winthrop Industrie', 'Global Pharmacovigilance Quality Audit & Inspection Readiness Coordinator', 'REJET'],
  ['Janssen CILAG', 'Preclinical Compliance and Safety Associate', 'REJET'],
  ['Altarea', 'Audit Administratif de Chantier', 'REJET'],
  ['Sanofi', 'Digital Consumer Experience Strategy & Research', 'REJET'],
  ['SNCF Voyages Developpement', 'Data Analyst', 'REJET'],
  ['BCG', 'Talent & Career Management Assistant', 'REJET'],
  ['AXA', 'Chargé de Formation', 'REJET'],
  ['Scor', 'Chargé(e) Des Moyens Généraux', 'REJET'],
  ['Talan', 'Assistant Administration des ventes', 'REJET'],
  ['Sia Partners', 'Consultant – Energy & Utilities', 'REJET'],
  ['Sia Partners', 'Consultant - Télécoms', 'REJET'],
  ['EY', "Consultant(e) débutant(e) en Subventions", 'REJET'],
  ['Deloitte', 'Conseil : Secteur Public', 'REJET'],
  ['CMA CGM', 'Duty Officer', 'REJET'],
  ['Crédit Agricole Immobilier', 'Property Manager', 'REJET'],

  // --- retail : doivent etre rejetees ------------------------------------
  ['Casden - Banque Populaire', 'Conseiller spécialisé en crédit', 'REJET'],
  ['Banque Populaire Alsace Lorraine Champagne', 'Conseiller clientèle vente à distance, spécialisé en crédit à la consommation', 'REJET'],
  ['Banque Populaire du Nord', 'Conseiller-ère Monétique', 'REJET'],
  ['Caisse d\'Epargne Grand Est Europe', 'Charge de Recouvrement Amiable', 'REJET'],
  ['Banque de France', 'Gestionnaire de dossiers de surendettement', 'REJET'],

  // --- reclassements attendus --------------------------------------------
  ['EY', "Consultant(e) en Évaluation Financière - Complex Capital Structure", 'fusions-acquisitions'],
  ['EY', "Consultant(e) Débutant(e) en Business Modeling", 'fusions-acquisitions'],
  ['Lazard', 'offer - Sovereign Advisory Group', 'fusions-acquisitions'],
  ['Perella Weinberg', 'Advisory Off-Cycle Programme (Paris / London)', 'fusions-acquisitions'],
  ['Oddo BHF', 'Back Office Produits Dérivés', 'operations-middle-office'],
  ['Oddo BHF', 'Middle Office - Fixed Income', 'operations-middle-office'],
  ['Société Générale', 'Assistant Trader - Middle Office - Indexation', 'operations-middle-office'],
  ['Caceis', 'Credit Risk Analyst VIE', 'risques-conformite'],
  ['Crédit Agricole CIB', 'Analyste risque de crédit et de portefeuille - Secteur Transport', 'risques-conformite'],
  ['La Banque Postale', 'Analyste Risque de Crédit Entreprises', 'risques-conformite'],
  ['Rothschild & Co', 'Controleur permanent lcb fthf', 'risques-conformite'],
  ['Groupe BPCE', 'Contrôleur Permanent de Conformité', 'risques-conformite'],
  ['Crédit Agricole CIB', 'Global Markets Monitoring Compliance Officer', 'risques-conformite'],
  ['Crédit Agricole CIB', "Chargé(e) de surveillance des marchés financiers", 'risques-conformite'],
  ['Banque de France', 'Contrôleur bancaire sur place', 'risques-conformite'],
  ['Wakam', 'Pricing Actuary (Motor)', 'actuariat-assurance'],
  ['AG2R La Mondiale', "Charge D'etudes Actuarielles", 'actuariat-assurance'],
  ['Deloitte', 'Actuariat', 'actuariat-assurance'],
  ['MAIF', "Chargé d'études réassurance", 'actuariat-assurance'],
  ['Scor', 'Retrocession Analyst', 'actuariat-assurance'],
  ['La Banque Postale', 'Analyste Tarification', 'actuariat-assurance'],
  ['Covéa', 'Charge d etudes statistiques actuarielles pilotage de la performance', 'actuariat-assurance'],
  ['Verlingue', 'Comptable Technique Assurance', 'actuariat-assurance'],
  ['Wakam', 'Reinsurance Technical Accountant', 'actuariat-assurance'],
  ['Crédit Agricole CIB', "Analyste Chargé d'affaires - Financements Structurés Immobiliers", 'financements-coverage'],
  ['Barclays', 'International Corporate Banking Graduate Programme Paris', 'financements-coverage'],
  ['Barclays', 'Global Transaction Banking Off Cycle Programme Paris', 'financements-coverage'],
  ['HSBC France', 'Coverage Global Network Banking', 'financements-coverage'],
  ['HSBC France', 'Financements syndiqués Corporate (TM Syndicated Loan Executions)', 'financements-coverage'],
  ['Natixis', 'Assistant Coverage & Advisory', 'financements-coverage'],
  ['Société Générale', 'Chargé de financement commerce international matières premières', 'financements-coverage'],
  ['Talan', 'Business Analyst Trade Finance', 'financements-coverage'],
  ['CDPQ', 'Investissements en infrastructures', 'capital-investissement'],
  ['Eurazeo', 'Venture Digital', 'capital-investissement'],
  ['Supernova Invest', 'Analyste', 'capital-investissement'],
  ['Malakoff Humanis', 'Analyste ISR', 'gestion-actifs'],
  ['Rothschild & Co', 'Analyst Financier Buy Side', 'gestion-actifs'],
  ['Oddo BHF', 'Compliance Asset Management', 'risques-conformite'],
  ['Qonto', 'Fraud Analyst - French Market', 'risques-conformite'],
  ['BNP Paribas', 'Comptable de fonds - Private Capital', 'comptabilite-consolidation'],
  ['Caceis', 'Fund Accountant OPC (Comptable OPC-Mandats)', 'comptabilite-consolidation'],
  ['Natixis', 'Expert en Finance Durable', 'gestion-actifs'],
  ['Banque de France', 'Analyste crypto-actifs et innovation', 'autres'],
  ['AG2R La Mondiale', 'Assistant macroéconomiste', 'autres'],

  // --- doivent rester ou elles sont --------------------------------------
  ['Louis Vuitton', 'Assistant.e Contrôle de Gestion', 'controle-gestion-tresorerie'],
  ['Deloitte', "Auditeur de fin d'études", 'audit-controle-interne'],
  ['Goldman Sachs', 'FICC & Equities (Sales & Trading) - Summer Analyst', 'marches-financiers'],
  ['Lazard', 'M&A - Generalist team', 'fusions-acquisitions'],
  ['Ardian', 'Private Equity Buyout I Paris', 'capital-investissement'],
  ['Mirova', 'Analyste Quantitatif', 'data-quant'],
  ['Rothschild & Co', 'Assistant(e) Banquier privé', 'banque-privee-patrimoine'],
  ['Deloitte', 'Transformation de la Fonction Finance', 'conseil-transformation'],
  ['Forvis Mazars', 'Collaborateur Comptable Junior', 'comptabilite-consolidation'],
];

let ok = 0;
const fails = [];
for (const [employer, title, expected] of CASES) {
  const r = classify({ employer, title });
  const got = r.status === 'classified' ? r.famille : 'REJET';
  if (got === expected) ok += 1;
  else fails.push({ employer, title, expected, got, reason: r.reason, structure: r.structure });
}

console.log(`\n${ok}/${CASES.length} cas conformes\n`);
if (fails.length) {
  console.log('Ecarts :');
  for (const f of fails) {
    console.log(`  [${f.structure || 'structure inconnue'}] ${f.employer} — ${f.title}`);
    console.log(`      attendu ${f.expected} / obtenu ${f.got}${f.reason ? ' (' + f.reason + ')' : ''}`);
  }
}

// Code de sortie : sans lui, la suite reussit toujours et le workflow publie
// par-dessus n'importe quelle regression. Ne jamais le retirer.
process.exit(fails.length === 0 ? 0 : 1);
