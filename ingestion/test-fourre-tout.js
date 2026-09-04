/** Les 73 offres du fourre-tout, passees dans le nouveau classifieur. */
const { classify } = require('./classifier');

const OFFRES = [
  ['Banque de France', 'Contrôleur bancaire sur place'],
  ['Banque de France', 'Gestionnaire de dossiers de surendettement'],
  ['Banque de France', 'Gestionnaire de dossiers de surendettement'],
  ['Banque de France', 'Analyste entreprise'],
  ['Banque de France', 'Gestionnaire adjudications'],
  ['Banque de France', 'Analyste groupes'],
  ['Banque de France', 'Occitanie - Gestionnaire de dossiers de surendettement à Montpellier'],
  ['Banque de France', 'Analyste de données monétaires'],
  ['Banque de France', 'Assistant au service des affaires internationales assurance'],
  ['Banque de France', "Analyste / économiste de l'environnement"],
  ['Banque de France', 'Analyste crypto-actifs et innovation'],
  ['Banque de France', 'Contrôleur qualité des données'],
  ['Banque de France', "Contrôleur entreprises d'investissement"],
  ['Crédit Agricole CIB', 'Gestion de projets - Direction Financière'],
  ['Crédit Agricole CIB', 'Gestionnaire Référentiels Tiers'],
  ['Crédit Agricole CIB', 'Sales Business Manager Assistant'],
  ['Crédit Agricole CIB', 'Assistant(e) Gestionnaire de Liquidité'],
  ['Crédit Agricole CIB', 'Gestionnaire données réglementaires'],
  ['Rothschild & Co', 'Analyst Financier Buy Side'],
  ['Rothschild & Co', 'Junior AI Adoption & Automation Officer'],
  ['Rothschild & Co', 'Digital, IA & Employee Experience'],
  ['Rothschild & Co', 'Venture Philanthropy Analyst'],
  ['Scor', 'Retrocession Analyst'],
  ['Scor', 'Chargé(e) Des Moyens Généraux'],
  ['Scor', 'AI & Data Apprentice'],
  ['Scor', 'Prudential Regulation & Strategy Analyst'],
  ['Barclays', 'Banking Off Cycle Programme Paris'],
  ['Barclays', 'Banking Graduate Programme Paris'],
  ['Barclays', 'Global Transaction Banking Off Cycle Programme Paris'],
  ['Caceis', 'Client Relationship Manager'],
  ['Caceis', 'Depositary Control Assistant'],
  ['Caceis', 'Business Coordinator'],
  ['Caisse des Dépôts', 'Chargé(e) de mission veille et prospective'],
  ['Caisse des Dépôts', 'Apprenti.e au département Gestion du Bilan'],
  ['Caisse des Dépôts', 'sein du service Projections et Stress-tests'],
  ['Eurazeo', 'Growth'],
  ['Eurazeo', 'Venture Digital'],
  ['Eurazeo', 'Eurazeo Planetary Boundaries Fund (epbf)'],
  ['AG2R La Mondiale', 'Assistant Techniques Financieres'],
  ['AG2R La Mondiale', "Charge D'etudes"],
  ['AXA', 'Chargé de Formation'],
  ['AXA', 'Gestionnaire rédacteur'],
  ['BNP Paribas', 'Analyste Transactions Immobilières'],
  ['BNP Paribas', 'Assistant pôle SOFICA'],
  ['CDPQ', 'Investissements en infrastructures'],
  ['CDPQ', 'Investissements en Immobilier'],
  ['Crédit Agricole', 'Inspecteur-rice Data'],
  ['Crédit Agricole', 'Inspecteur-rice généraliste'],
  ['Deloitte', "Ingénieurs de fin d'études"],
  ['Deloitte', 'Deloitte Digital Customer & Digital Strategy'],
  ['PwC', 'Chargé(e) de projets innovation'],
  ['PwC', 'Energie et Utilities'],
  ['Schneider Electric Industries', 'Quality Assurance Engineer - Horgen (Switzerland)'],
  ['Schneider Electric Industries', 'Connected Services Hub Predictive Analyst'],
  ['Allianz France', 'Appui en Référentiels SI et Architecture'],
  ['Amundi', 'Inside Sales - Data-as-a-Service'],
  ['Banque Populaire Rives de Paris', 'Chargé(e) de gestion contrat financement'],
  ['BCG', 'Talent & Career Management Assistant'],
  ['BPCE VIE', 'Chargé de projets ADE'],
  ['CMA CGM', 'Duty Officer'],
  ['Crédit Agricole Immobilier', 'Property Manager'],
  ['Euronext', 'Operational Excellency Apprentice'],
  ['FLASH Contract', 'Paid Acquisition Manager - VIE - Barcelona'],
  ['JPMorgan', 'Sales – Summer'],
  ['La Banque Postale', 'Analyste Financements Structurés'],
  ['MAIF', "Chargé d'études réassurance"],
  ['Malakoff Humanis', 'Analyste ISR'],
  ['Natixis', 'Client Strategy And Management Officer'],
  ['Qonto', 'Fraud Analyst - French Market'],
  ['Rexel', 'CHARGE(E) DE PROJETS / DATA ANALYST - Paris 17ème'],
  ['Societe AIR France', 'Financial Planning & Analysis Specialist'],
  ['Supernova Invest', 'Analyste'],
  ['Swiss Life France', 'Assistant(e) gestion'],
];

const buckets = { classified: {}, rejected: {}, unclassified: [] };

for (const [employer, title] of OFFRES) {
  const r = classify({ employer, title });
  if (r.status === 'classified') {
    (buckets.classified[r.familleLabel] ||= []).push(`${employer} — ${title}`);
  } else if (r.status === 'rejected') {
    (buckets.rejected[r.reason] ||= []).push(`${employer} — ${title}`);
  } else {
    buckets.unclassified.push(`${employer} — ${title}`);
  }
}

const nbClassees = Object.values(buckets.classified).flat().length;
const nbRejetees = Object.values(buckets.rejected).flat().length;

console.log(`\n${OFFRES.length} offres du fourre-tout passees dans le nouveau classifieur\n`);
console.log(`  ${nbClassees} rangees dans une vraie famille`);
console.log(`  ${nbRejetees} rejetees (hors perimetre)`);
console.log(`  ${buckets.unclassified.length} encore sans famille\n`);

console.log('=== RANGEES ===');
for (const [fam, list] of Object.entries(buckets.classified).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${fam} (${list.length})`);
  list.forEach((l) => console.log(`   ${l}`));
}

console.log('\n=== REJETEES ===');
for (const [reason, list] of Object.entries(buckets.rejected).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${reason} (${list.length})`);
  list.forEach((l) => console.log(`   ${l}`));
}

console.log(`\n=== ENCORE SANS FAMILLE (${buckets.unclassified.length}) ===`);
buckets.unclassified.forEach((l) => console.log(`   ${l}`));

// Code de sortie : le residu ne doit pas remonter au-dessus de son niveau
// connu. S'il remonte, une regle a ete perdue ou affaiblie.
const SEUIL_RESIDU = 8;
if (buckets.unclassified.length > SEUIL_RESIDU) {
  console.log(`\nECHEC : ${buckets.unclassified.length} sans famille, seuil ${SEUIL_RESIDU}`);
  process.exit(1);
}
process.exit(0);
