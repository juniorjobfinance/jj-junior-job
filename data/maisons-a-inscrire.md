Le passage du 2026-09-03 a produit un catalogue **juste mais incomplet**. Rien n'est cassé : ces
offres manquent, celles qui sont en ligne restent exactes.

## 18 maison(s) vues et jetées — 29 offre(s)

Elles ont servi une offre de finance sans figurer dans `ingestion/maisons.txt`.

| Maison | Offres |
|---|---:|
| Mutuelle Saint-Christophe | 10 |
| AEW | 2 |
| Jefferies | 2 |
| Crédit Foncier | 1 |
| Ensemble Protection Sociale | 1 |
| Banque de Savoie | 1 |
| Axians Fibre IDF | 1 |
| SAR | 1 |
| Citeos Grenoble | 1 |
| VF HAUTE Provence | 1 |
| Hestia | 1 |
| Division des Grands Projets | 1 |
| Sunmind | 1 |
| Chaumet | 1 |
| Rimowa | 1 |
| Tiffany & Co. | 1 |
| BeneFit Cosmetics | 1 |
| Krug | 1 |

**Attention avant d'inscrire** : une filiale ou une marque s'ajoute en ALIAS
sur la ligne de sa maison mère, jamais comme maison à part entière.

## 42 employeur(s) sans structure

Ils publient, mais `ingestion/structures.js` ne leur donne pas de type :
la porte finance rejette toutes leurs offres, en silence.

| Employeur | Offres |
|---|---:|
| Sephora | 8 |
| Teora | 5 |
| Air Liquide | 4 |
| Morgan Stanley | 4 |
| Indosuez Wealth Management | 4 |
| Adeo | 3 |
| Servier | 3 |
| Accenture | 2 |
| BPCE Solutions Immobilieres | 2 |
| Trustpair | 2 |
| Yousign | 2 |
| Reden Solar | 2 |
| BforBank | 2 |
| Swile | 1 |
| Agicap | 1 |
| Crédit Foncier | 1 |
| Ensemble Protection Sociale | 1 |
| BPCE Factor | 1 |
| Banque de Savoie | 1 |
| BPCE Lease | 1 |
| Alptis | 1 |
| Leocare | 1 |
| Akur8 | 1 |
| AMF | 1 |
| Aema Groupe | 1 |
| Intesa Sanpaolo | 1 |
| Axians Fibre IDF | 1 |
| SAR | 1 |
| Citeos Grenoble | 1 |
| VINCI Energies France Tertiaire NORD EST | 1 |
| VF HAUTE Provence | 1 |
| Hestia | 1 |
| Division des Grands Projets | 1 |
| Sunmind | 1 |
| KONI France FAB Amortisseurs | 1 |
| IDIA Capital Investissement | 1 |
| Chaumet | 1 |
| Rimowa | 1 |
| Givenchy | 1 |
| Tiffany & Co. | 1 |
| BeneFit Cosmetics | 1 |
| Krug | 1 |

---

*Les deux tables sont indépendantes : `maisons.txt` décide de ce qui entre,
`structures.js` décide du type affiché. Inscrire dans l'une ne sert à rien
sans l'autre (DECISIONS.md §24).*

<!-- signature: fafae15d78fa -->