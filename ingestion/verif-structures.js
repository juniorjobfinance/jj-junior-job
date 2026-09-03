const { resolveStructure } = require('./structures');
const cas = [
  ['Groupe BPCE', 'bfi'], ['La Banque Postale', 'banque-detail'],
  ['Groupe Bon Marché', 'entreprise'], ['Parfums Christian Dior', 'entreprise'],
  ['Maison Francis Kurkdjian', 'entreprise'], ['Officine Universelle Buly', 'entreprise'],
  ['Direct Assurance', 'assurance'], ['GIE AXA', 'assurance'],
  ['Mutuelle Saint-Christophe', 'assurance'], ['Socfim', 'fintech'], ['ONEY', 'fintech'],
  ['Natixis', 'bfi'], ['Natixis Investment Managers', 'societe-gestion'],
  ['Crédit Agricole', 'banque-detail'], ['Crédit Agricole CIB', 'bfi'],
  ['Crédit Agricole Assurances', 'assurance'], ['Crédit Agricole Immobilier', 'entreprise'],
  ["Caisse d'Epargne Grand Est Europe", 'banque-detail'], ['Banque Populaire du Nord', 'banque-detail'],
  ['Matmut', 'assurance'], ['Generali France', 'assurance'], ['Coface', 'assurance'],
  ['Jefferies', 'banque-affaires'], ['AEW', 'societe-gestion'], ['LSEG', 'fintech'],
  ['MUFG', 'bfi'], ['Bank of America', 'bfi'], ['Amundi', 'societe-gestion'],
];
let ok = 0;
for (const [e, exp] of cas) {
  const g = resolveStructure(e);
  if (g === exp) ok += 1;
  else console.log(`  ECART ${e} : attendu ${exp}, obtenu ${g}`);
}
console.log(`${ok}/${cas.length} resolutions de structure conformes`);
if (ok !== cas.length) process.exitCode = 1;
