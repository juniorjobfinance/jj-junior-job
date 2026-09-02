# JJ — Junior Job · Brief de projet pour Claude Code

> **Ce document est le brief fondateur, écrit le 30 août 2026.** Il dit
> pourquoi le site existe, pour qui, et ce qui le distingue — cela n'a pas
> changé et fait toujours autorité.
>
> En revanche, il décrit aussi un état du monde qui a bougé. Ne pas s'y fier
> pour :
>
> - **les sources** (§7.3, §7.4, §13) — France Travail et La Bonne Alternance
>   y sont présentées comme des sources à câbler ; elles ont été branchées,
>   puis **débranchées le 1er septembre 2026** parce que leurs annonces ne
>   renvoient pas vers l'employeur. Mesure refaite le 2 septembre, même
>   conclusion. Voir `DECISIONS.md` §2.
> - **les listes de familles et de structures** (§4.2) — refondues le
>   1er septembre. Le code fait foi.
> - **la roadmap** (§13) — largement dépassée.
>
> Pour l'état réel : **`ETAT.md`** (chiffres du jour), **`DECISIONS.md`**
> (les arbitrages et leur pourquoi), **`CLAUDE.md`** (les règles en vigueur).

> À lire en premier. Ce document est le contexte complet du projet. Il a été
> construit lors d'une longue réflexion en amont. Objectif : bâtir une **première
> version solide et propre** du site. Le go-to-market, la publicité et la
> monétisation viendront **après** — ne pas les coder maintenant.

---

## 1. Le projet en une phrase
**JJ (Junior Job)** = la plateforme du **vivier junior finance français**. On y trouve
toutes les offres **finance**, pour **juniors** (stage, alternance, CDI/CDD 0-3 ans),
en **France**, rangées **par métier**, chaque offre renvoyant **directement à l'annonce
officielle** de la maison.

## 2. Positionnement & différenciation (le pourquoi on gagne)
- **Tri par POSTE, pas par entreprise.** Un junior sait ce qu'il veut *faire* avant de
  savoir *où*. Ranger par métier = notre différence + ça apprend la carte du secteur.
- **Lien DIRECT vers l'annonce** (jamais la page carrières générique). 90 % des
  agrégateurs sont pourris là-dessus : ils renvoient sur une home et le candidat abandonne.
- **Qualité obsessionnelle : zéro doublon, zéro ghost job.** C'est le vrai moat, pas le volume.
- On reste **100 % finance** (le métier), même si les employeurs viennent de partout.
- Le moat n'est PAS « être le premier » (un JobTeaser/eFinancialCareers peut ajouter un
  filtre finance-junior en un trimestre). Le moat = **profondeur + qualité + carte des métiers**.

## 3. Périmètre « finance »
Large mais borné : banque (détail, privée, BFI/CIB), gestion d'actifs & wealth, private
equity / VC / infra, assurance & actuariat, audit / conseil / transaction services,
finance d'entreprise (DAF, contrôle de gestion, trésorerie, M&A corporate), fintech,
immobilier financier, trading & matières premières, risk / conformité, data/quant finance.
**Important : la finance existe dans TOUTES les boîtes** (contrôle de gestion, trésorerie,
M&A interne chez TotalEnergies, LVMH, Airbus…), pas seulement chez les acteurs financiers.

---

## 4. Structure du site (architecture de l'information)

### 4.1 Les onglets (par type de contrat)
Trois onglets portent les offres ingérées :
1. **Stage**
2. **Alternance**
3. **CDI / CDD (0-3 ans d'expérience)**

Plus un onglet spécial :
4. **VIE** — traité à part : **pas d'ingestion**, c'est un **bouton/lien de redirection**
   vers la page officielle Business France déjà filtrée finance (voir §6). Pas de familles dessus.

### 4.2 et 4.3 — Les deux axes de tri

> **Les listes qui figuraient ici sont périmées.** Le brief décrivait neuf
> familles métier et huit types de structure ; l'un et l'autre ont été
> refondus le 1er septembre 2026. Un brief qui contredit le code est pire
> qu'un brief absent, puisqu'on le lit en confiance — cette section ne garde
> donc que le principe, et renvoie au code pour le détail.

Le site trie sur **deux axes**, et l'un ne doit jamais empiéter sur l'autre :

- **la famille métier** répond à « quel travail ferai-je ? » ;
- **le type de structure** répond à « chez qui ? ».

Trois règles gouvernent ce découpage :

1. Une famille nomme un **métier**, jamais un secteur. « Assurance » et
   « Banque » ne sont pas des familles : ce sont des employeurs.
2. **Aucun libellé n'est partagé entre les deux axes.** Le métier s'appelle
   « Gestion d'actifs », l'employeur « Société de gestion ». Sans quoi on ne
   sait plus lequel des deux filtres on manipule.
3. Une catégorie fourre-tout doit rester **marginale** — sous 5 %. Au-delà,
   elle cesse d'être une marge et redevient une catégorie, ce qui est le
   défaut qu'elle était censée éviter.

Les listes en vigueur vivent dans le code, à un seul endroit chacune :
`FAMILLES` et `STRUCTURES` dans `ingestion/pipeline.js`, dupliquées en dur
dans `index.html` pour l'affichage — **les deux doivent être comparées après
toute modification**, elles ont déjà divergé une fois.

Le raisonnement qui a mené au découpage actuel est dans `DECISIONS.md` §4.
Les chiffres du jour sont dans `ETAT.md`.
### 4.4 Extensibilité (roadmap multi-secteurs)
Plus tard : Finance → Marketing → Communication → Immobilier… La nav gagnera un niveau
**Secteur** au-dessus : **Secteur → Onglet contrat → Familles**. Les 4 onglets contrat
restent identiques pour tous les secteurs ; seules les familles changent par secteur.

---

## 5. La fiche offre (carte)
Ordre de lecture (le poste passe devant l'entreprise d'un cheveu, car c'est la clé d'entrée
quand on parcourt 40 offres) :
1. **Titre du poste** (le plus visible)
2. **Entreprise** (juste dessous, bien visible — les juniors courent après les marques)
3. **Infos** : famille métier, type de structure, lieu, type de contrat, salaire ou deadline
4. **Badge de fraîcheur** : « vérifiée aujourd'hui » / « publiée il y a X jours »
5. **Lien direct vers l'annonce** (ouvre un nouvel onglet, `rel="noopener"`)

Marqueur « Vérifiée » (zéro ghost job). VIE = badge spécifique + ville étrangère.

## 6. Esthétique
Sobre, crédible, **finance** — encre/navy + un seul accent **laiton/brass**, les **données
en police mono** (salaires, deadlines, compteurs) comme un terminal. **PAS** le style
coloré-startup de Welcome to the Jungle. Doit rester **simple et lisible pour un étudiant
paumé**. Responsive, accessible (focus visible, prefers-reduced-motion, contrastes).

---

## 7. Sourcing des offres (le pipeline)

### 7.1 Principe d'architecture (crucial)
L'ingestion **ne se fait PAS dans la page**. Un **backend** tourne **1x/jour le matin**
(cron), récupère les offres, les classe, filtre, déduplique, et écrit un fichier
(`offres.js` → `window.__OFFRES__`) que la page lit. Raisons : les API demandent des
identifiants secrets (jamais dans du code navigateur) ; CORS ; le traitement (dédup/classement).

### 7.2 Fréquence
**1x/jour le matin** = ingestion + retrait des mortes. C'est l'équilibre parfait (les offres
junior ne tournent pas à l'heure). Implémentation la plus simple pour un solo : **GitHub
Action planifiée** (gratuit, zéro serveur) qui lance `pipeline.js` et met à jour `offres.js`.
Plus tard, possibilité de vérifier les liens plus souvent (tâche légère séparée).

### 7.3 Sources — statut
**Sources publiques légales (l'épine dorsale) :**
- **France Travail — API Offres d'emploi** : officielle, gratuite, temps réel. Agrège déjà FT
  **+ ses partenaires consentants** (donc une grosse part du marché). Auth OAuth2
  (client_credentials, à créer sur francetravail.io). Filtres par **code ROME** (métiers finance),
  typeContrat, localisation. → à câbler dans `sources.js`.
- **La Bonne Alternance — API** : gratuite, temps réel, **alternance**. Filtres ROME/RNCP/géo/
  diplôme. Bonus : « marché caché » (entreprises à fort potentiel d'embauche). Tout ce qui en
  sort = onglet Alternance.
- **APEC** : LA référence cadres (fort pour le CDI junior). ⚠️ **pas d'API ouverte** trouvée →
  à vérifier / demander un flux partenaire. Ne pas supposer que c'est plug-and-play.
- **Backfill agrégateurs** (Adzuna, Jooble, Talent.com) : légaux, en **appoint**, filtrés dur
  finance-junior. Ne pas noyer la curation.
- **Finance publique** (Banque de France, AMF, ACPR, Caisse des Dépôts, Bpifrance) : via les
  plateformes publiques d'emploi de l'État. Angle « finance publique » que personne ne couvre.
- **API « Mes évènements emploi »** (bonus, pas des offres) : forums / job datings finance à
  afficher dans un coin « événements recrutement ».

**À NE PAS ingérer :**
- **1jeune1solution** : ré-agrège France Travail + La Bonne Alternance → doublons. Aller aux
  sources primaires.
- **VIE / Business France (Mon VIE-VIA / Civiweb)** : ⚠️ **pas d'API de réutilisation, NE PAS
  SCRAPER.** L'onglet VIE = **lien-sortant** vers leur page de recherche déjà filtrée
  Finance/Compta/Gestion/Banque. (Optionnel plus tard : demander un flux/partenariat à Business France.)
- **LinkedIn** : pas d'API publique jobs ; scraping = violation des CGU + risque RGPD. Les
  offres « cachées » que des recruteurs postent sur LinkedIn → **soumission communautaire**
  (formulaire « soumettre une offre » / boîte mail de forward, modérée), **pas de scraping**.

### 7.4 Les grosses boîtes en direct (ATS) — auto-sync
Objectif : le **top 50-100 (voire 200) maisons finance**. Quand une offre est publiée sur
leur site → elle apparaît sur JJ ; retirée → elle disparaît. C'est **le diff quotidien** du
pipeline (comparer la liste ATS d'aujourd'hui avec la veille).

Astuce clé : **un connecteur PAR TYPE d'ATS**, pas par entreprise. Un connecteur Greenhouse
branche toutes les boîtes sous Greenhouse ; tu ajoutes juste le « token »/tenant.
- Greenhouse : `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
- Lever : `https://api.lever.co/v0/postings/{company}?mode=json`
- SmartRecruiters : `https://api.smartrecruiters.com/v1/companies/{id}/postings`
- Workable, Teamtailor : endpoints publics par entreprise
- Workday, SuccessFactors, Avature : par tenant, à mapper au cas par cas (portails plus fermés)

**Reality check** : certaines grosses banques ont des portails fermés (Workday/SuccessFactors).
Mais elles **publient aussi sur France Travail** → on les rattrape là, avec un cran de fraîcheur
en moins. Donc : ATS direct pour celles qui l'exposent (instantané) + France Travail comme filet.

**Filtre finance strict pour les corporates** : chez TotalEnergies/LVMH/etc. il y a aussi des
ingénieurs, juristes, marketing. Ne remonter QUE les postes finance (filtre code ROME + intitulé).

---

## 8. Logique du pipeline (déjà prototypée — à reprendre et durcir)
Un pipeline Node.js existe déjà dans le dossier (`ingestion/pipeline.js` + `ingestion/sources.js`),
testé hors-ligne sur des données d'exemple. Il fait, dans l'ordre :
1. **Normalisation** vers un schéma unique.
2. **Classement dans l'onglet** (déterministe) : la source tranche si univoque (LBA→alternance,
   VIE→vie) ; sinon le type de contrat ; sinon fallback mots-clés de l'intitulé.
3. **Inférence** de la famille métier (les 9) + du type de structure.
4. **Filtre junior 0-3 ans** : stage/alternance/VIE = junior par nature ; pour CDI/CDD, écarte
   senior/confirmé/≥4 ans, garde junior/débutant/graduate.
5. **Déduplication** : clé canonique (entreprise + intitulé nettoyé + lieu) + match fuzzy sur les
   variantes de titre ; on garde la **source de vérité** (ATS de la boîte) et on note les autres.
6. **Retrait des offres mortes** (à ajouter/durcir) : une offre absente sur **2-3 passages
   consécutifs** OU dont le **lien renvoie une erreur (404/expiré)** est retirée. Marge de
   sécurité anti-faux-positif (ne pas vider le site si une source déconne). Deux champs cachés :
   *vue pour la dernière fois le…* + *statut du lien*. Alimente le badge de fraîcheur.

Schéma d'offre (unifié) consommé par la page :
`{ emp, title, sector (type de structure), famille, volet, loc, place, sal?, dl?, url, source, alsoOn? }`

## 9. Volume & performance
Cible : **1000-2000 offres propres**. Le vrai enjeu n'est pas d'en trouver assez (le marché en a
des dizaines de milliers) mais de **rester propre** à ce volume. Afficher 2000 cartes d'un coup
rame → **pagination ou défilement infini** (ne rendre que le visible). **Démarrer à quelques
centaines bien triées** sur les segments phares, prouver la qualité, puis ouvrir les vannes.

## 10. Stack suggérée (simple, solo-friendly)
- **Front** : le proto HTML/CSS/JS actuel suffit pour v1 (ou migrer vers un framework léger si besoin).
- **Pipeline** : Node.js (déjà en place), dépendances minimales.
- **Planification** : GitHub Action cron (gratuit).
- **Données** : `offres.js` pour commencer ; passer à une petite base (SQLite / Supabase) quand
  le volume et le suivi « vu le… / statut lien » le justifient.
- **Déploiement** : Vercel / Netlify / GitHub Pages (gratuit).

## 11. Juridique — à cadrer AVANT mise en ligne publique (ne pas coder, mais prévoir)
RGPD (dès qu'on stocke des données perso, ex. soumissions communautaires) ; mentions légales ;
respect des CGU des sources (lien-sortant OK, recopie non autorisée = non, cf. VIE). Prévoir une
page mentions légales + politique de confidentialité.

## 12. Monétisation (PHASE 2 — pour info, ne rien coder maintenant)
Le candidat ne paie **jamais**. Revenus B2B, une fois l'audience construite : CVthèque (accès aux
candidats), marque employeur / pages sponsorisées, offres mises en avant, partenariats cabinets de
recrutement. **Ne pas construire pour la pub d'abord — construire pour l'audience.**

## 13. Roadmap de build
- **v0** : proto (fait — page + pipeline + données d'exemple).
- **v1 (maintenant)** : câbler France Travail + La Bonne Alternance en live ; ATS de **20-30 maisons
  phares** ; page solide (pagination, familles, filtres, lien direct) ; retrait des mortes ;
  déploiement + cron quotidien.
- **v2** : élargir à 50-100 (puis 200) boîtes ; soumission communautaire ; badges de fraîcheur ; VIE en redirection.
- **v3** : monétisation. **Futur** : autres secteurs.

## 14. Restant à décider (hors build)
Go-to-market (amorçage étudiants + boîtes) · monétisation détaillée · juridique · nom définitif
(**JJ = provisoire**) · design final.

---

## 15. Liste de départ des maisons cibles (top finance en France)
> Instruction à Claude Code : **pars de cette liste**, puis (a) pour chacune, **identifie le type
> d'ATS** (sonde la page carrières : Greenhouse/Lever/SmartRecruiters/Workable/Teamtailor/Workday/
> SuccessFactors/portail custom) et note l'endpoint quand il existe ; (b) **complète jusqu'à 100-200**
> en cherchant les acteurs manquants ; (c) marque celles à prendre via ATS direct vs via France Travail.
> Vérifier chaque nom (des sociétés fusionnent/changent de nom).

**BFI / banques d'investissement (Paris)**
BNP Paribas CIB · Société Générale CIB · Natixis (BPCE) · Crédit Agricole CIB · Goldman Sachs ·
JPMorgan · Morgan Stanley · Bank of America · Citi · Barclays · Deutsche Bank · HSBC · UBS · Nomura · Jefferies

**M&A / conseil financier (boutiques)**
Rothschild & Co · Lazard · Messier & Associés · Centerview · Perella Weinberg · DC Advisory ·
Alantra · Bryan Garnier · Natixis Partners · Cambon · Clipperton · Transaction R · Sycomore Corporate Finance · Degroof Petercam

**Gestion d'actifs**
Amundi · AXA IM · BNP Paribas AM · Natixis IM (Ostrum, Mirova, DNCA) · Carmignac · Comgest ·
La Financière de l'Échiquier · Edmond de Rothschild AM · Groupama AM · Tikehau · Sycomore ·
Lazard Frères Gestion · La Banque Postale AM · CPR AM

**Private Equity / VC / Infra**
Ardian · Eurazeo · PAI Partners · Tikehau Capital · Antin Infrastructure · Meridiam · Astorg ·
Sagard · Andera Partners · LBO France · Wendel · Bpifrance · Cathay Capital · IK Partners ·
Siparex · Partech · Alven · Elaia · Isai · Serena

**Assurance / réassurance**
AXA · Allianz France · CNP Assurances · Covéa (MAAF/MMA/GMF) · Groupama · Generali France ·
Scor · AG2R La Mondiale · Malakoff Humanis · MACIF · MAIF · Abeille Assurances

**Audit & conseil (Big 4 + boutiques + strat)**
Deloitte · EY · KPMG · PwC · Forvis Mazars · Grant Thornton · BDO · RSM · Eight Advisory ·
Accuracy · Advolis · Oliver Wyman · McKinsey · BCG · Bain · Roland Berger · Kearney

**Banque de détail / groupes**
BNP Paribas · Société Générale · Crédit Agricole · BPCE (Banque Populaire, Caisse d'Épargne) ·
Crédit Mutuel / CIC · La Banque Postale · HSBC France · BoursoBank · Fortuneo · Hello bank

**Fintech**
Qonto · Swile · Pennylane · Spendesk · Alan · Ledger · Younited · October · Sumeria (Lydia) ·
Shine · Payfit · Libeo · Defacto · Memo Bank · Kyriba · Silvr · Karmen

**Corporate / DAF (grands groupes — remonter UNIQUEMENT les postes finance)**
TotalEnergies · LVMH · L'Oréal · Airbus · Sanofi · Kering · Schneider Electric · Vinci · Danone ·
Air Liquide · Safran · Michelin · Renault · Stellantis · Orange · Thales · Capgemini · Publicis ·
Carrefour · Saint-Gobain · EDF · Engie · Bouygues · Veolia · Pernod Ricard · Hermès ·
Dassault Systèmes · Legrand · Sodexo · Alstom

**Finance publique / régulateurs / institutions**
Banque de France · AMF · ACPR · Caisse des Dépôts · Bpifrance · Agence France Trésor · DG Trésor · CDC Habitat

---

## 16. Fichiers déjà présents dans le projet
- `index.html` — la page (4 onglets, familles métier en axe principal, filtres, cartes
  cliquables vers l'annonce). *(à renommer JJ / à faire évoluer.)*
- `offres.js` — données générées par le pipeline (`window.__OFFRES__`).
- `ingestion/pipeline.js` — normalise, classe, filtre junior, déduplique, écrit `offres.js`.
- `ingestion/sources.js` — connecteurs (stubs à câbler) + données d'exemple.
- `ingestion/README.md` — architecture + étapes.

**Première tâche suggérée à Claude Code** — *périmée, conservée pour mémoire.* Elle proposait
de câbler France Travail et La Bonne Alternance : les deux ont été branchées, puis débranchées
le 1er septembre 2026 parce que leurs annonces ne renvoient pas vers l'employeur. Pour reprendre
le projet aujourd'hui : lire `ETAT.md`, puis `DECISIONS.md`.
