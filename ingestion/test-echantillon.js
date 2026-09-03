/** Echantillon reel tire des 880 unclassified du 2026-09-03 20:47. */
const { classify } = require('./classifier');

const CAS = [
  // --- distribution d'assurance : doit etre rejete -----------------------
  ['AXA', 'Mandataire d’Assurance - Indépendant - Dpt 92', 'REJET'],
  ['AXA', 'Agent spécialisé en Assurances Collectives - Dpt 45', 'REJET'],
  ['AXA', 'Expert en Assurances Collectives - Dpt 68', 'REJET'],
  ['Swiss Life France', 'Agent Spécialisé en Assurance de personnes', 'REJET'],
  ['Swiss Life France', 'Technico-Commercial', 'REJET'],
  ['Matmut', 'Conseiller(ère) en Assurance', 'REJET'],
  ['AG2R La Mondiale', 'Technico-commercial', 'REJET'],
  ['Malakoff Humanis', 'Technico-Commercial Assurances', 'REJET'],
  ['Meilleurtaux', 'Courtier en crédits immobiliers MANDATAIRE INDEPENDANT', 'REJET'],
  ['Allianz France', 'Agent Expert en Patrimoine et Protection Sociale - NANTES (44)', 'REJET'],

  // --- retail bancaire : doit etre rejete --------------------------------
  ["Caisse d'Epargne Grand Est Europe", 'Conseiller Banque et Assurances', 'REJET'],
  ['Banque Populaire Grand Ouest', 'Conseiller Particulier', 'REJET'],
  ["Caisse d'Epargne Normandie", 'Responsable Clientèle', 'REJET'],
  ["Caisse d'Epargne CEPAC", 'Chargé d’Affaires Professionnels', 'REJET'],
  ['CIC', 'Chargée/Chargé d\'affaires agriculture-viticulture', 'REJET'],
  ["Caisse d'Epargne Aquitaine Poitou Charentes", 'Assistant de Clientèle', 'REJET'],
  ['Société Générale', 'Attache Relation Commerciale', 'REJET'],
  ['BRED Banque Populaire', 'Responsable commercial PME', 'REJET'],
  ['LCL', "Chargé d'Assurances Professionnelles - Reims/F", 'REJET'],
  ['BNP Paribas', 'Conseiller Banque et Assurance', 'REJET'],
  ['BRED Banque Populaire', 'Candidatures spontanées stages, alternances', 'REJET'],

  // --- vraies offres finance a recuperer ---------------------------------
  ['Crédit Agricole CIB', 'Originateur Global Trade & Commodities Finance', 'financements-coverage'],
  ['Crédit Agricole CIB', 'Originateur Small Cap STRASBOURG', 'financements-coverage'],
  ['Crédit Agricole CIB', "Chargé d'affaires Leverage Finance Confirmé (VP)", 'financements-coverage'],
  ['Crédit Agricole CIB', "Chargé d'affaires Agency & Transaction Management Funds Solutions Group", 'financements-coverage'],
  ['La Banque Postale', 'Senior Banker - Institutions Financières', 'financements-coverage'],
  ['Crédit Agricole CIB', 'Analyste IPV Equity', 'marches-financiers'],
  ['Crédit Agricole CIB', 'Gestionnaire Titrisations Synthétiques', 'marches-financiers'],
  ['Crédit Agricole CIB', 'Responsable Market Data Administration', 'marches-financiers'],
  ['Caceis', 'Middle Officer (Trade Management)', 'operations-middle-office'],
  ['Caceis', 'Client Operations Officer - Coupons/Remboursements', 'operations-middle-office'],
  ['Caceis', 'Data Officer (Static Data)', 'operations-middle-office'],
  ['Caceis', 'Client Operation Officer - Clearing Services', 'operations-middle-office'],
  ['La Banque Postale', 'Gestionnaire de portefeuille', 'gestion-actifs'],
  ['Amundi', 'Fund Manager', 'gestion-actifs'],
  ['BNP Paribas', 'Assistant Gérant Solution Portfolio Management', 'gestion-actifs'],
  ['BNP Paribas', 'Investment Guidelines Officer', 'gestion-actifs'],
  ['BNP Paribas', 'Spécialiste en investissements durables', 'gestion-actifs'],
  ['Oddo BHF', 'Family Officer Junior', 'banque-privee-patrimoine'],
  ['La Banque Postale', 'Analyste rétablissement', 'risques-conformite'],
  ['La Banque Postale', 'Analyste résolution', 'risques-conformite'],
  ['Banque de France', 'Analyste agréments et autorisations', 'risques-conformite'],
  ['Banque de France', 'Charge en Resolution de Crises Bancaires', 'risques-conformite'],
  ['Banque de France', 'Contrôleur des organismes d\'assurances', 'risques-conformite'],
  ['Groupe BPCE', 'Responsable de projet BCBS 239', 'risques-conformite'],
  ['Natixis', 'Head of Solvency Metrics Analytics and Controls', 'risques-conformite'],
  ['LCL', 'Responsable Validation des Modèles Quantitatifs', 'data-quant'],
  ['Scor', 'Analyse des Données Modèle Interne (Vie)', 'data-quant'],
  ['Scor', 'Data Modeler – Finance', 'data-quant'],
  ['CNP Assurances', 'Actuaire Confirme', 'actuariat-assurance'],
  ['Casden - Banque Populaire', 'Actuaire', 'actuariat-assurance'],
  ['Crédit Agricole Assurances', 'Actuaire - Responsable Gestion Financière', 'actuariat-assurance'],
  ['Swiss Life France', 'Gestionnaire Prestations Santé', 'actuariat-assurance'],
  ['Swiss Life France', 'Gestionnaire retraite collective', 'actuariat-assurance'],
  ['Generali France', 'Technicien Operations Assurance', 'actuariat-assurance'],
  ['Malakoff Humanis', 'Courtage Epargne', 'actuariat-assurance'],
  ['CMA CGM', 'Group Transfer Pricing Expert', 'controle-gestion-tresorerie'],
  ['Thales', 'Gestionnaire Financier des Contrats', 'controle-gestion-tresorerie'],
  ['Rexel', 'Gestionnaire de Recouvrement', 'controle-gestion-tresorerie'],
  ['BDO France', 'Responsable Administratif et Financier', 'controle-gestion-tresorerie'],
  ['Altarea', 'Analyste Finance Corporate', 'controle-gestion-tresorerie'],
  ['AEW', 'Analyste Fonds d’Investissement Immobiliers', 'capital-investissement'],
  ['Bank of America', 'GCIB Credit Summer Analyst', 'risques-conformite'],
];

const buckets = { classified: {}, rejected: {}, unclassified: [] };
let ok = 0;
const fails = [];

for (const [employer, title, expected] of CAS) {
  const r = classify({ employer, title });
  const got = r.status === 'classified' ? r.famille : 'REJET';
  if (got === expected) ok += 1;
  else fails.push({ employer, title, expected, got, reason: r.reason, status: r.status });
}

console.log(`\n${ok}/${CAS.length} cas de l'echantillon conformes\n`);
for (const f of fails) {
  console.log(`  ${f.employer} — ${f.title}`);
  console.log(`      attendu ${f.expected} / obtenu ${f.got} [${f.status}]${f.reason ? ' ' + f.reason : ''}`);
}

// --- les 6 VIE perdues, ajoutees apres le rapport du 2026-09-03 ---
const VIE = [
  ['Schneider Electric Industries', 'Finance Analyst', 'controle-gestion-tresorerie'],
  ['Natixis Investment Managers', 'Analyste opérations et processus junior', 'operations-middle-office'],
  ['Planisware', 'Junior Financial Analyst', 'controle-gestion-tresorerie'],
  ['Caceis', 'Finance Officer', 'controle-gestion-tresorerie'],
  ['TotalEnergies', 'Analyste Asset Marché de l’Énergie', 'marches-financiers'],
  ['Comgest', 'FINANCIAL ANALYST - TALENT PROGRAM (Paris)', 'marches-financiers'],
  ['Banque de France', 'Analyste financier', 'risques-conformite'],
  ['Louis Vuitton', 'Analyste financier', 'controle-gestion-tresorerie'],
];
let ok2 = 0;
for (const [e, t, exp] of VIE) {
  const r = classify({ employer: e, title: t });
  const g = r.status === 'classified' ? r.famille : 'REJET';
  if (g === exp) ok2 += 1;
  else console.log(`  VIE ECART ${e} — ${t} : attendu ${exp}, obtenu ${g}`);
}
console.log(`${ok2}/${VIE.length} cas VIE conformes`);

// --- faux positifs releves sur les 120 tirages du 2026-09-03 ---
const FP = [
  ['AXA', "Conseiller d'Études Actuarielles & Pilotage de Provisionnement", 'actuariat-assurance'],
  ['Grant Thornton', 'Expertise Conseil', 'comptabilite-consolidation'],
  ['Grant Thornton', 'Assistant Débutant - Expertise Conseil', 'comptabilite-consolidation'],
  ['Grant Thornton', 'Senior - Expertise Conseil', 'comptabilite-consolidation'],
  ['CMA CGM', 'Insurance Officer', 'actuariat-assurance'],
  ['CMA CGM', 'Group Insurance Officer', 'actuariat-assurance'],
  // ...sans rouvrir la porte au retail
  ["Caisse d'Epargne Grand Est Europe", 'Conseiller Banque et Assurances', 'REJET'],
  ['Banque Populaire du Nord', 'Conseiller-ère Monétique', 'REJET'],
  ['Matmut', 'Conseiller(ère) en Assurance', 'REJET'],
  ['AXA', 'Mandataire d’Assurance - Dpt 13', 'REJET'],
  ['AXA', 'Agent spécialisé en Assurances Collectives', 'REJET'],
  ['Schneider Electric Industries', 'Quality Assurance Engineer - Horgen (Switzerland)', 'REJET'],
];
let ok3 = 0;
for (const [e, t, exp] of FP) {
  const r = classify({ employer: e, title: t });
  const g = r.status === 'classified' ? r.famille : 'REJET';
  if (g === exp) ok3 += 1;
  else console.log(`  FP ECART ${e} — ${t} : attendu ${exp}, obtenu ${g} ${r.reason || ''}`);
}
console.log(`${ok3}/${FP.length} faux positifs corriges`);
