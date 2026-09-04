# Où en est JJ

**Dernière mise à jour : 3 septembre 2026, au soir.**

Ce fichier dit l'état du projet à date. Il est réécrit à la fin de chaque
séance de travail — c'est la première chose à lire pour reprendre, et la
dernière à écrire avant de s'arrêter.

---

## Le catalogue en ligne

**998 offres** · **104 maisons** servies sur **206** référencées.

> Les 103 maisons qui ne servent rien **ne sont pas 103 pannes**. Une maison
> sans poste junior ouvert en ce moment est dans son état normal, et c'est le
> cas de la plupart : vérifié le 03/09 sur Air Liquide (4 offres finance en
> France, pas une de plus à prendre) et sur Santander (portail vide). Le
> sous-ensemble réellement actionnable est bien plus étroit — les maisons dont
> le site AFFICHE des offres et dont on collecte zéro. Un seul cas prouvé à ce
> jour : Capgemini.

| Onglet | Offres |
|---|---|
| Stage | 500 |
| CDI · CDD | 305 |
| Alternance | 102 |
| VIE | 91 |

Les deux séances des 2 et 3 septembre ont fait passer le catalogue de **798 à
1006 offres**, et l'alternance de **60 à 116** — elle était le point faible
depuis le début.

**Qualité mesurée le 03/09/2026 :**

- 900/1006 datées (89 %) ; les autres affichent « toujours en ligne chez
  l'employeur, date inconnue » et passent en fin de liste ;
- plus ancienne offre datée : 120 jours. Il y a **deux** seuils, et le récap
  n'en citait qu'un : **60 jours pour un CDI·CDD** (`MAX_AGE_JOURS_CDI_CDD`),
  120 pour les autres volets chez un employeur direct, 30 sur un agrégateur ;
- résidu « Autres métiers de la finance » : 5,9 % ;
- les 13 familles métier tiennent entre 3,9 % et 15,8 % ;
- les 11 types de structure entre 3,5 % et 20,6 % ;
- 0 poste senior sur les 311 offres de l'onglet CDI · CDD ;
- 2 offres sur 1006 mal rangées d'onglet (`audit-catalogue.js`).

**Douze premières maisons** : PME et start-ups (72, uniquement du VIE),
BPCE 68, Deloitte 67, Banque de France 41, LVMH 39, Société Générale 36,
Natixis 34, Crédit Agricole CIB 32, Oddo BHF 32, Lazard 31, Eurazeo 30,
BNP Paribas 30.

Le matin même, ce classement était dominé par Airbus (97), Air Liquide (71) et
Thales (69) — le fourre-tout « Autres métiers de la finance » avait enflé à
26,7 % du catalogue et publiait des ajusteurs composite. Voir `DECISIONS.md`
§15.

---

## Où chercher du volume — mesuré le 03/09/2026 au soir

Passage complet de `ingestion/rendement.js` (147 sources, un quart d'heure) :

> **6 840 offres collectées · 3 363 « publiables » · 998 publiées.**

**Attention au mot « publiable ».** Dans cet outil il signifie seulement
« passe `normalize()` et le filtre des grandes villes ». Il **n'inclut pas** le
contrôle de séniorité sur la description, les seuils d'âge (60 j pour un
CDI·CDD, 120 sinon), ni la
déduplication. L'écart de 2 365 n'est donc PAS un stock d'offres récupérables :
une part inconnue est légitime. **Mesurer la composition de cet écart est en
soi le prochain chantier** — sans elle, on optimiserait à l'aveugle.

### Ce qui est établi, en revanche

**Treize sources collectent et ne publient rien** (~106 offres). Les deux
premières ont été vérifiées à la main le soir même :

- `workday:santander` — 79 dans le rapport, mais **0 en direct** : le chiffre
  venait du magasin de récoltes (repli à 4 jours). **Ce n'est PAS une panne** :
  Victor a vérifié leur portail, il n'y a effectivement pas d'offre. Le
  connecteur qui rend zéro a raison. Le premier diagnostic écrit ici — « pointe
  dans le vide » — était faux, et sa correction tient en une leçon : un zéro
  n'accuse pas le connecteur tant qu'on n'a pas regardé le site.
- `phenom:careers.capgemini.com` — collecte **zéro**, si silencieusement qu'il
  n'apparaît même pas dans la liste des muettes. La seule offre Capgemini
  publiée vient du flux VIE. Leur vraie liste est sur `www.capgemini.com`,
  **rendue côté serveur** : un connecteur `liste` la lirait, comme pour Crédit
  Agricole ou BNP.

**Air Liquide n'est pas un gisement**, contrairement à ce que son absence
laissait croire. Le connecteur marche ; c'est la maison qui ne recrute presque
pas en finance en France. Mesuré sur leur API Workday : 1 125 offres dans le
monde, 292 en France, mais **4** en « Finance & Controlling » France et **1** en
« Group Control & Compliance ». Les deux familles que le connecteur ne voit pas
rapporteraient UNE offre.

> Piège à ne pas répéter : leur troisième famille, « HSE / Risk Mgt / Quality /
> Security » (11 en France), n'est PAS du risque financier — c'est la sécurité
> industrielle. L'ajouter parce qu'elle contient « Risk » rouvrirait exactement
> le fourre-tout du 2 septembre (`DECISIONS.md` §15).
>
> Anomalie restée ouverte : l'entonnoir retient les 4 offres Air Liquide, mais
> aucune n'est dans `offres.js`. À élucider — c'est un étage postérieur à
> `normalize()` qui les mange.

### Ordre de travail proposé

1. **Réparer les connecteurs muets** — Capgemini, Santander, puis les onze
   autres. Borné, vérifiable, et sans toucher à un seul filtre.
2. **Mesurer la composition de l'écart 3 363 → 998** (séniorité sur
   description, seuils d'âge 60/120 j, doublons). C'est la mesure qui manque.
   **Candidat n° 1 de ce chantier : le seuil de 60 jours sur les CDI·CDD.**
   Mesuré le 04/09/2026 : sur 179 offres écartées par le verdict de séniorité
   et absentes du catalogue, **59 sont mortes de ce seul seuil** — un tiers.
   Une annonce de CDI de deux mois et demi n'est pas forcément pourvue. Rien
   n'a été changé : c'est une mesure, pas une décision.
3. **Le type de contrat deviné au lieu d'être lu** dans sept familles de
   connecteurs — c'est ce qui étouffe l'alternance (voir plus bas).

---

## Le 3 septembre, plus tard : interface et Pépites JJ

Un passage manuel supplémentaire (hors cron du 4 à 06h30) a été poussé le soir
même pour appliquer ces changements, ce qui explique un catalogue légèrement
différent du tableau ci-dessus au moment d'écrire ces lignes : **994 offres**
(stage 499, cdi-cdd 302, alternance 102, vie 91) — l'écart avec les chiffres du
matin est de la variation normale de sources, pas un effet des changements
décrits ici, qui ne touchent ni au filtrage ni à la classification.

**Barre d'onglets** : le total (« 994 offres au total ») est revenu SUR la
même ligne que Stage/Alternance/VIE/CDI-CDD (un essai en ligne séparée en
dessous a été rejeté — « c'est moche »). Les onglets débordaient déjà de
375 px avec leurs compteurs intégrés (« Alternance103 »), ce qui rendait la
barre défilable au toucher ; les compteurs par onglet disparaissent donc sous
900 px (pas seulement au format téléphone — le même débordement apparaît dès
qu'on repasse sous ~750 px, en fenêtre de bureau réduite ou en tablette), et le
total raccourcit à « 994 offres » sur cette largeur. Vérifié sans débordement
à 360, 375, 700 et 901 px.

**Filet orange sous l'en-tête** : il dépassait le contenu de chaque côté sur
grand écran, parce que `header.site` est en pleine largeur alors que son
contenu (`.brand`) est centré sur 1200 px. La bordure est devenue transparente
et un pseudo-élément dessine le vrai filet, centré sur les mêmes 1200 px.

**Pépites JJ, de 32 vitrines à 5 vraies trouvailles** — voir `DECISIONS.md`
§20 pour le détail des trois critères devenus obligatoires (énorme maison,
poste disputé, offre récente ≤ 21 jours). Le jour du changement : Ardian,
Natixis, Eurazeo, Lazard, Barclays, toutes publiées entre 0 et 14 jours plus
tôt.

---

## Le 3 septembre : la pagination qui tourne à vide

Trois corrections, poussées en fin de journée. Elles ne sont **pas** encore
visibles en ligne : le catalogue ci-dessus date du 2 au soir, et c'est le
passage automatique du 4 à 06h30 qui les appliquera.

1. **Phenom ignorait « offset ».** L'API de `careers.axa.com` n'accepte que
   `page` ; `offset`, `from`, `start` et `skip` sont acceptés **sans effet** et
   renvoient tous la première page. La boucle relisait donc six fois les cent
   premières offres, atteignait 600 ≥ `totalCount` (560) et se croyait au bout.
   Quatre cent soixante offres n'avaient jamais été vues. AXA passe de
   12 offres retenues, toutes en CDI, à 24 dont 6 stages et 3 alternances.

   Le garde-fou ajouté vaut pour toutes les sources à venir : **on s'arrête dès
   qu'une page n'apporte aucune offre nouvelle.** Un paramètre de pagination
   ignoré ne peut plus se déguiser en catalogue complet.

   Les deux autres branches Phenom ont été vérifiées et sont saines : Allianz
   pagine correctement par `from` (253 offres distinctes), HSBC lit ses neuf
   offres en une requête.

2. **La cybersécurité anglophone passait sous le contre-filtre.**
   `NON_FINANCE_RE` connaissait « cyber » et « sécurité informatique », mais
   pas « Red Team Analyst », « Security Assurance Officer » ni « Backup
   Engineer Analyst ». Le plus gênant : « Security Risk Assessment Analyst » se
   rangeait dans **Risques & Conformité**, où le candidat ne peut pas
   distinguer le risque informatique du risque financier.

3. **Comgest branchée** — la première des sociétés de gestion qui manquaient.
   Elle ne publie sur aucune plateforme : ses offres vivent dans un accordéon
   de son propre site, sur deux pages (stages, emplois).

---

## Les neuf pannes silencieuses corrigées le 2 septembre

Toutes rendaient zéro sans le moindre message. Le détail est dans les messages
de commit du jour ; voici de quoi les reconnaître si elles reviennent.

1. **Le lieu coupé au premier tiret.** « Saint-Quentin-en-Yvelines - France »
   devenait « Saint », donc petite commune, donc écarté. Toutes les communes à
   nom composé, sur toutes les listes HTML.
2. **La limite de mot du diplôme CAP prise au pied de la lettre.** Elle
   écartait « M&A Large Cap » — le cœur du sujet.
3. **La pagination Workday arrêtée à la vingtième offre.** Leur API ne renvoie
   le total que sur la première page ; le lire comme « zéro » arrêtait la
   lecture. Trente-cinq maisons concernées.
4. **La même faute dans six autres connecteurs** : SmartRecruiters,
   SuccessFactors, Oracle Cloud, OpenDataSoft, TalentView, AXA France.
5. **Le contrat Workday deviné au lieu d'être lu.** Les alternances de la
   Banque de France étaient publiées en CDI, puis tuées par le filtre 0-3 ans.
6. **« il y a 30 jours » lu « aujourd'hui »** : la fonction ne connaissait que
   l'anglais, et datait du jour tout ce qu'elle ne comprenait pas.
7. **BPCE jugé comme un agrégateur**, donc à 30 jours au lieu de 120.
8. **La Banque Postale lue quarante fois sur la même page** : leur pagination
   est dans le nom du fichier (« .p-2.html »).
9. **Soixante-cinq maisons branchées absentes de `maisons.txt`** : leur
   connecteur tournait chaque matin, et le pipeline jetait tout.

La neuvième est désormais impossible à commettre en silence :
`controle-avant-passage.js` compare les maisons branchées à la liste de
référence et nomme les orphelines.

---

## Trois outils nés de cette séance

- **`ingestion/atelier.js`** charge le vrai pipeline sans le lancer et rend ses
  fonctions internes. En ligne de commande, il dit quelle porte bloque une
  offre donnée. À employer SYSTÉMATIQUEMENT plutôt que de recopier une fonction
  du pipeline pour la tester : cette recopie a donné trois diagnostics faux
  dans la même séance.
- **`ingestion/entonnoir.js`** rejoue une source et compte les sorties par
  motif. C'est lui qui a montré les 93 offres manquées du Crédit Agricole et
  les 266 conseillers d'agence de Société Générale.
- **`ingestion/rendement.js`** pose la même question à toutes les sources en
  une seule collecte, et nomme celles qui ne publient rien. Quinze minutes.

---

## Ce qui tourne tout seul

Passage quotidien à **06h30 Paris** (GitHub Actions → `pipeline.js` → commit →
Vercel). Une offre publiée par une maison branchée apparaît le lendemain ; une
offre retirée **disparaît le lendemain aussi** — le pipeline ne publie que ce
qu'il vient de collecter, il ne réinjecte jamais une annonce qu'il ne voit plus.

Les trois jours de `MAX_JOURS_ABSENCE` ne retardent pas ce retrait : c'est la
durée pendant laquelle on se SOUVIENT de l'offre, pour ne pas la re-signaler
comme nouvelle si elle réapparaît après un hoquet d'API.

Ce qui protège d'une panne, ce sont les deux autres mécanismes : le magasin de
récoltes ressert la dernière collecte d'une source muette pendant quatre jours,
et le garde-fou refuse de publier si le catalogue s'effondre malgré tout. Il a
joué deux fois le 2 septembre, en voyant le catalogue chuter de 26 % — la
baisse était voulue, et il a fallu `--forcer` pour publier.

**Conséquence à connaître** : le garde-fou se compare au fichier EN LIGNE. Avec
996 offres comme référence, un passage qui en rendrait moins de 847 serait
bloqué et garderait le catalogue de la veille.

Domaines : `juniorjobfinance.com` sert le site ; `www.` et
`juniorjobfinance.vercel.app` redirigent en 308 ; `http://` bascule en `https`.

---

## Ce qui reste à faire

**1. L'alternance — mais en lisant le compteur au bon moment.** 102 offres.

> **Ce n'est pas forcément un point faible : c'est la saison.** Un contrat
> d'alternance démarre en septembre, donc les annonces se publient de février à
> juillet. Mesurer le volume d'alternance EN SEPTEMBRE, c'est le relever au
> creux du cycle. Ne pas conclure à une panne, ni durcir ou assouplir quoi que
> ce soit sur cette base : la bonne mesure est le printemps.

Reste un défaut réel, lui, et indépendant de la saison : **le type de contrat
n'est pas lu** chez sept familles de connecteurs — Greenhouse, Oracle Cloud,
Teamtailor, SuccessFactors, Phenom, Cornerstone, Radancy. Elles le devinent sur
l'intitulé et rangent donc en CDI toute alternance dont le titre ne dit pas
« alternance ». C'est exactement le défaut corrigé chez Workday, qui avait
rendu 24 offres à la seule Banque de France. À corriger avant la saison
prochaine, pour qu'elle profite pleinement.

**2. Quatre gros groupes identifiés, pas encore branchés.** Leur plateforme est
connue, il manque leur identifiant, qui se lit dans l'adresse d'une offre :
Engie (SuccessFactors), Orange (Phenom), Schneider Electric (TalentSoft ou
Phenom). EDF est branché depuis ce soir mais rend peu — leurs juniors sont
techniciens de maintenance et nucléaire.

**3. Deux sources collectent beaucoup et ne publient rien** : `workday:morningstar`
(220 offres) et `workday:santander` (76). À passer à l'entonnoir.

**4. Deux maisons dont la liste est en JavaScript** : Société Générale (leur
sitemap ne porte que 346 offres France sur 1 094) et La Banque Postale (69
offres rendues côté serveur). Il faudrait la requête que leur page appelle —
Victor peut la capturer dans l'onglet Réseau du navigateur.

**5. Une offre morte dans `manuel.js`.** Le passage la signale à chaque fois ;
sa ligne est à retirer du fichier.

**6. Visibilité — reporté à la demande de Victor.** Google Search Console,
vérification que le pare-feu Vercel ne bloque pas Googlebot, données
structurées JobPosting, analytics, poids de `offres.js`.

---

## Pistes ouvertes, à reprendre

**Bain — hors de portée, et pas seulement difficile.** Toutes les voies ont été
essayées : sitemap principal et sitemap campus (huit URL, aucune offre), pages
de liste, POST du formulaire, flux RSS et XML, recherche d'iframe ou de
domaine tiers. Leur liste n'existe qu'après exécution du JavaScript.

Et même en la trouvant, le pipeline ne pourrait pas la lire : il tourne sur
GitHub Actions en Node pur, sans navigateur. Y embarquer un navigateur headless
pour une seule maison multiplierait la durée et la fragilité de chaque passage.
Le portail est pourtant ouvert et bien balisé — c'est la seule maison rencontrée
dont l'obstacle soit architectural et non juridique.

**Seize start-ups technologiques débranchées le 02/09** — Doctolib, Deezer,
BlaBlaCar, Dataiku, Algolia, Mirakl, Contentsquare, Believe, Brevo,
Dailymotion, Pigment, Papernest, Kili, Sellsy, Modjo, Qare. Mesure avant de
trancher : 34 offres collectées, 9 franchissant les filtres de titre, et ces
neuf étant « Head of International Accounting », « Chief Operations Officer »,
« Senior Payment Operation Analyst »… du senior ou du non-finance. Rebrancher
tient en une ligne si l'une d'elles se met à recruter des juniors en finance.

## Hors d'atteinte, et pourquoi

**Pare-feu** — Bpifrance (répond 403 à tout robot, jusqu'à son propre
`robots.txt`), Morgan Stanley (tal.net), Alvarez & Marsal (Cloudflare). On ne
contourne pas.

**Saint-Gobain** — leur vrai site, joinus.saint-gobain.com, répond 403 à
tout robot. Leur tenant SmartRecruiters, lui, existe mais ne porte que 18
offres. Hors d atteinte.

**Plateformes sans API lisible** — UBS (Taleo), Stifel (50skills), Alstom,
Atos, Exiom, Capza (Taleez : application JavaScript, API sous clé, sitemap
réduit à la page d'accueil).

**McKinsey** — coupé volontairement : leur API sert des postes que leur propre
site déclare fermés.

**France Travail et La Bonne Alternance** — débranchés le 01/09, mesure refaite
le 02/09 : 26 offres finance sur les huit plus gros bassins, dont une seule
maison de finance. Voir `DECISIONS.md` §2.

---

## La refonte de la classification — sur branche, en attente de fusion

**Mesuré le 04/09/2026 sur `refonte-classification`. Le catalogue en ligne
reste celui de `main` : rien de ce qui suit n'est publié.**

**954 offres** — stage 444 (47 %), CDI·CDD 371 (39 %), alternance 90 (9 %),
VIE 49 (5 %). Quinze familles métier, onze types de structure.

Ce chiffre n'est PAS comparable aux 998 de production : deux collectes de
jours différents, et `main` n'a pas `--depuis-cache`, donc la comparaison à
entrée identique est impossible. La seule mesure propre porte sur la bascule
du filtre de séniorité, rejouée sur la même photo : **886 → 953**, soit
65 offres regagnées et 8 retirées.

### Le VIE est l'onglet le plus sensible aux portes

Il affiche le meilleur taux de survie APRÈS classement — 49 publiées — mais il
perd **54 offres avant**, soit la moitié de ses candidates. La raison est
structurelle : le VIE se fait par nature **chez des industriels et des cabinets
à l'étranger**, précisément les employeurs que `gate:entreprise-sans-marqueur`
(28 rejets) et `gate:conseil-sans-marqueur` (10) gardent.

**C'est le premier endroit à regarder le jour où l'on voudra élargir.** Avec
une réserve mesurée le 04/09 : sur ces 54, aucun n'est récupérable en
inscrivant une maison. Les 28 de `gate:entreprise` sont des postes de vente
ou de data chez des industriels, les 10 de `gate:conseil` des business
analysts informatiques, et les 9 de `employeur-absent-de-structures` neuf
postes commerciaux. Le gisement éventuel est dans les intitulés de contrôle de
gestion que ces portes attrapent au passage — Bouygues « Cost Control Sweden »,
TotalEnergies « Cost Data Analyst », Eurofins « Performance Analyst ».

### Deux anomalies relevées et non corrigées

**34 offres écartées faute de structure**, chez des maisons qui SONT dans
`maisons.txt` mais pas dans `structures.js` — le §24 une fois de plus :
BPCE Lease (3), Air France (3), Compass Lexecon (2), Alptis (2), Verspieren
(2), Sesamm, Agicap, et la Caisse de dépôt et placement du Québec dont un
stage « Investissements en infrastructures ». **C'est le seul motif de rejet
où inscrire une maison récupère vraiment des offres**, et c'est ce que l'issue
« Maisons à inscrire » liste désormais.

**Une offre publiée sans structure** : KONI France FAB Amortisseurs,
« Commercial Controller », VIE. Le VIE contourne la maison de référence, donc
un employeur inconnu publie quand même — mais sans type, le filtre de
structure du site ne la trouve nulle part. Le contrôle « deux tables » ne l'a
pas vue : il vérifie les employeurs VUS à la collecte, pas les employeurs
PUBLIÉS.

### Le résidu sans famille : 444

cdi-cdd 358 (81 %), stage 47, alternance 38, VIE 1. Le classifieur recopié le
04/09 — trou ESG comblé, motifs de relation client institutionnelle — a fait
passer le stage de 57 à 47 et l'alternance de 40 à 38.

### Le premier passage réel a lieu le 05/09/2026 à 06h30

La refonte est fusionnée sur `main`, mais **aucun catalogue n'a été commité** :
`offres.js` reste celui du 03/09, avec l'ancienne taxonomie. C'est le passage
automatique de demain matin qui produira le premier catalogue traversant toute
la chaîne — classifieur, séniorité sur texte entier, rejet des offres sans
structure — et qui exercera pour la première fois les cinq contrôles en
conditions réelles sur la branche de production.

D'ici là, le site sert la nouvelle interface avec l'ancien catalogue. Mesuré :
zéro offre hors filtre, et deux familles vides — Financements & Coverage,
Actuariat & Assurance technique — jusqu'au passage.

**Si ce passage échoue, l'issue « Passage quotidien en échec » s'ouvrira en
nommant le contrôle fautif, et le site gardera le catalogue de la veille.**

### Le vrai gain de la nuit : un second fourre-tout, invisible parce qu'il avait un nom crédible

« Autres métiers de la finance » était le fourre-tout qu'on regardait — 73
offres, 7,3 %. **« Conseil & Transformation » en était un second, plus gros :
154 offres, 15,4 % du catalogue.** Personne ne le voyait, parce qu'il portait
le nom d'une vraie famille.

Suivies une par une après la refonte : 63 sont toujours au catalogue, dont 43
restées dans la famille et 20 réparties vers M&A, Capital-investissement,
Comptabilité, Financements et Actuariat. **91 en sont sorties, et elles ne sont
pas de la finance** — « Conseil en Transformation » et « Conseil : Secteur
Public » chez Deloitte, « Stratégie IT » et « PMO Aéronautique », « Business
Analyst » chez des ESN. Trente d'entre elles par `gate:big4-sans-marqueur`,
les autres par retrait de l'annonce.

C'est le vrai gain : le fourre-tout visible perd 59 offres, celui qu'on ne
voyait pas en perd 91.

**La leçon vaut au-delà de ce cas : une famille dont le nom est assez large
pour tout accueillir devient un fourre-tout sans jamais en porter le nom.** Le
compteur à surveiller n'est pas « Autres », c'est la famille la plus grosse.

### Imprécision connue et chiffrée : 4 doublons résiduels

La clé de déduplication compare l'employeur, l'intitulé et la ville. Elle est
calculée **avant** le dernier nettoyage du titre : la mention « (Télétravail
complet possible) » lui sert à poser `loc = a-distance`, elle n'est donc retirée
qu'après. Deux annonces du même poste écrites différemment — « (Télétravail
complet) » contre « (Télétravail complet possible) », « Limousin Dordogne Lot
Garonne » contre « depuis Limoges » — reçoivent deux clés et survivent toutes
les deux.

**Mesuré le 04/09/2026 : 4 offres sur 3 183, toutes chez Pennylane.** C'est
l'habitude d'écriture d'un employeur, pas une classe de titres — 0,1 % du
catalogue.

**On ne le corrige pas**, et c'est délibéré : un motif taillé pour quatre
offres casserait à la première variation d'écriture, tout en ayant l'air de
protéger. À la place :

- la page **fond les villes en double** sur une carte groupée (une ville, un
  lien, la pastille compte les villes distinctes) ;
- le pipeline **compte** ces doublons à chaque passage et l'écrit au journal :
  `N doublons résiduels : même employeur, même intitulé, même ville`.

**Si ce nombre grossit, c'est que la clé se dégrade** — et on le verra dans le
journal, pas sur une carte. Le seuil à partir duquel il vaut une règle a été
posé à 15 : en dessous, c'est du sur-mesure.

### Le prochain chantier : faire lire la description au classifieur

Le classifieur ne lit que l'**intitulé**. C'est ce qui a rendu la refonte
possible — un titre est court, stable, et présent chez toutes les sources —
et c'est désormais sa limite principale.

**Mesuré le 04/09/2026 : 149 offres sur les seules structures financières
portent un intitulé générique, illisible ou tronqué** — « Gestionnaire
contrat », « Chargé d'études et statistiques sur… », « Head of Performance
Management WEAR », « Assistant Technique ». Aucun motif ne peut les ranger,
parce qu'il n'y a rien à lire. Elles sortent au résidu, comptées mais perdues.

Ces 149 ne sont pas un stock qui s'épuise : c'est le débit quotidien. Chaque
matin ramène sa part d'intitulés maison qu'aucune règle de vocabulaire
n'atteindra.

**La description, elle, dit le métier.** Le pipeline la récupère déjà — c'est
`descrComplet`, le texte entier, qui sert au filtre de séniorité depuis cette
nuit. Le classifieur pourrait l'interroger **quand, et seulement quand,
l'intitulé ne suffit pas** : le résidu deviendrait alors une seconde chance
plutôt qu'une sortie.

**C'est un changement d'architecture, pas un motif de plus.** Trois questions
à trancher avant d'écrire une ligne :

1. le classifieur reçoit aujourd'hui `{ title, employer }` ; lui passer la
   description change sa signature et le contrat de tous ses appelants,
   `atelier.js` et les cinq suites de tests compris ;
2. une description est mille fois plus longue qu'un titre, et elle contient le
   vocabulaire de TOUTE la maison — le risque n'est pas de rater, il est de
   ranger n'importe où. Il faudra pondérer autrement, et sans doute n'accepter
   qu'un score très élevé ;
3. les offres sans description restent aveugles : au 04/09/2026, le journal en
   compte quatorze écartées « faute de description lisible ».

**C'est le plus gros gisement après les nouveaux employeurs**, et le seul qui
ne se règle pas en ajoutant du vocabulaire.

### Le plafond structurel du chantier « lire la description »

**Mesuré le 04/09/2026, avant d'écrire une ligne.**

Le résidu sans famille sur structures financières compte **184 offres** par
passage. Leur description n'est pas acquise :

| | offres |
|---|---:|
| description présente dans le brut du connecteur | 60 (33 %) |
| récupérées en allant lire la fiche | +101 |
| **couverture atteignable** | **161 / 184 — 88 %** |
| **aveugles quoi qu'on fasse** | **23 (12 %)** |

Les 23 n'ont ni JSON-LD ni corps de page exploitable. **Ce n'est pas un réglage,
c'est un plafond** : le second passage doit les laisser sortir proprement — pas
planter, pas deviner, pas les compter comme un échec du classement.

Le rattrapage ciblé — le résidu des structures financières seulement, jamais
les 6 800 offres collectées — **coûte 34 secondes**, délais par hôte compris
(3 000 ms chez `groupecreditagricole.jobs`, 1 500 ms chez `group.bnpparibas`).
C'est mesuré en conditions réelles : la même mesure sans les délais annonçait
17 secondes, un chiffre qu'on n'aurait jamais retrouvé en production.

**Et un second plafond, plus dur que le premier.** Sur les descriptions
disponibles, les motifs de familles ne désignent pas un gagnant net :

- une description fait **4 093 caractères en médiane contre 34 pour un
  intitulé** — un rapport de 120, pas de 1 000 ;
- en ne comptant que les motifs de poids ≥ 8, **2,4 familles** marquent en
  moyenne, et **21 offres sur 60 ont une égalité en tête** ;
- en montant à ≥ 9, le bruit tombe mais **33 offres sur 60 ne marquent plus
  rien du tout**.

Autrement dit : la règle « le score le plus haut gagne, l'ordre de déclaration
départage » — qui fonctionne sur un intitulé — ferait trancher **un tiers des
cas par l'ordre de déclaration** sur une description. Le second passage devra
donc exiger un **écart strict** entre le premier et le second, et s'abstenir
sinon. S'abstenir est le comportement correct : l'offre retourne au résidu, qui
est compté au journal.

### Le catalogue est écrit dans index.html — 04/09/2026

Google recevait **1 033 caractères** : les offres arrivaient par `offres.js`,
en JavaScript. Le pipeline écrit désormais les cartes directement dans
`index.html`, entre deux bornes `<!--JJ:OFFRES:-->`.

**Le gabarit n'est pas recopié.** `ingestion/ecrire-catalogue-html.js` découpe
le vrai gabarit dans `index.html` entre les bornes `JJ:GABARIT` et l'exécute
tel quel — le procédé d'`atelier.js`. Un DOM inerte est fourni le temps de
l'évaluation, puis **verrouillé** : si le gabarit se mettait à lire la page, le
pipeline lèverait au lieu de produire des cartes silencieusement fausses.

| | brut | brotli |
|---|---:|---:|
| socle `index.html` | 93,6 Ko | 25,1 Ko |
| les 832 cartes (912 offres) | 664,6 Ko | 33,2 Ko |
| **page complète** | **758,9 Ko** | 58,4 Ko en local — **77,0 Ko servis par Vercel** |

Le brotli de Vercel est nettement moins agressif que celui de `zlib` en qualité
11 : 77,0 Ko contre 58,4. La projection faite avant le déploiement annonçait
69 Ko, elle était optimiste de 12 %. Le chiffre qui fait foi est celui mesuré
sur le site, à la source.

| | avant | après |
|---|---:|---:|
| `index.html` sur le fil | 29,4 Ko | **77,0 Ko** |
| `offres.js` sur le fil | 50,0 Ko | 49,5 Ko |
| **total** | **79,4 Ko** | **126,5 Ko** |
| **chemin critique** | **79,4 Ko**, deux requêtes en série, bloquantes | **77,0 Ko**, le HTML seul |

**Le gain n'est donc pas en octets : il est structurel.** Le total monte de
59 %, et le chemin critique ne bouge pratiquement pas. Ce qui change, c'est que
le contenu est peint avant qu'une ligne de JavaScript ne s'exécute, qu'il n'y a
plus deux requêtes en série, et qu'aucun script bloquant ne peut plus être
escamoté par Chrome sur connexion lente.

**Mesuré sur le site déployé le 04/09/2026 :** Googlebot recevait
**1 033 caractères** de texte visible et 3 cartes ; il en reçoit
**143 860 et 835**.

`document.write` a disparu au passage — c'était le vrai défaut, plus grave que
le SEO : Chrome refuse d'exécuter un script ainsi injecté sur connexion lente,
et un visiteur en 3G pouvait voir la page **sans aucune offre**. Remplacé par
`<script defer>`, le démarrage déplacé dans `demarrer()` sur
`DOMContentLoaded`. Le commutateur `?refonte=1` est abandonné avec lui :
échafaudage local, jamais déployé.

**Piste écartée pour aujourd'hui, volontairement.** La donnée transite deux
fois : en cartes HTML pour Google, en JSON pour le filtrage. On pourrait ne
charger `offres.js` qu'au premier filtre, ou faire lire le DOM au filtrage et
supprimer `offres.js` — ce qui ramènerait la page à ~69 Ko au lieu de 119.
**Simple d'abord** : la mesure ne montre aucun problème de poids à 119 Ko, et
les deux options touchent au filtrage, qui marche.

### Ce que le contrôle du HTML garde

`controle-avant-passage.js` régénère le bloc attendu avec le vrai gabarit et le
compare **caractère par caractère** à celui du fichier. Aucun seuil à régler :
même catalogue et même gabarit donnent la même sortie, donc toute différence
est une panne.

Un premier essai comparait les ENSEMBLES D'URL. Il échouait sur un catalogue
sain : `cardGroupeHTML` dédoublonne les villes d'un groupe, donc deux offres au
même endroit ne rendent qu'un lien, et deux URL manquent légitimement du HTML.
**Un contrôle qui échoue sur l'état correct ne protège de rien**, il apprend à
ignorer les échecs.

Éprouvé le 04/09/2026 en provoquant les pannes : état correct **vert**,
génération tronquée à mi-chemin **bloquée**, HTML périmé à nombre de cartes
identique **bloqué**, bornes disparues **bloquées**.

`index.html` est désormais un **fichier généré**. Le workflow le commite avec
`offres.js`, `offres.xml` et `sitemap.xml` : sans cela le site servirait le
HTML de la veille pendant que le JSON se met à jour, et c'est le périmé que
Google lirait.

### PageSpeed Insights — 04/09/2026, après le passage au HTML

Lighthouse 13.4.1. Mobile : Moto G Power émulé, 4G lente, processeur bridé
1,2×. Bureau : émulation ordinateur, limitation personnalisée.

| | mobile | bureau |
|---|---:|---:|
| **Performances** | **88** | **84** |
| Accessibilité | 91 | 91 |
| Bonnes pratiques | **100** | 100 |
| SEO | **100** | 100 |
| First Contentful Paint | 1,9 s | 0,4 s |
| Largest Contentful Paint | 2,3 s | 0,5 s |
| Total Blocking Time | 310 ms | 0 ms |
| **Cumulative Layout Shift** | **0** | **0,317** |
| Speed Index | 4,0 s | 0,6 s |

CrUX ne rend rien : pas assez de trafic pour que Google agrège des données de
vrais visiteurs. Le laboratoire est donc le seul chiffre disponible.

**Ce qui coûte des points sans gêner personne** — la minification du JS (10 Kio
annoncés) et du CSS (2 Kio) : sur une page servie en brotli le gain réel est une
fraction de ça, et le prix serait une étape de construction ou un `index.html`
illisible, contre la règle du dépôt. « Optimiser la taille du DOM » sanctionne
les 832 cartes, c'est-à-dire le choix qu'on vient de faire exprès.

**Ce qui gêne réellement, même sans coûter de points :**

1. **CLS 0,317 sur bureau** — la page bougeait sous les yeux au premier
   chargement. Seule métrique en zone rouge, et **la totalité** de l'écart
   entre le 84 du bureau et le ~100 que le reste mérite : FCP 0,4 s,
   LCP 0,5 s, TBT 0 ms.

   **Cause retenue : le bandeau des Pépites**, 558 px de haut à 302 px du
   sommet, écrit avec `hidden` dans le HTML puis dévoilé par le JS — donc
   après le premier affichage sur bureau, où le FCP tombe à 0,4 s. Sur mobile
   le FCP est à 1,9 s : tout arrive avant, et le CLS y est de 0.

   **La piste « font-display: swap sur Manrope » n'a jamais été établie**, et
   il ne faut pas la ressortir : elle a été écrite ici comme « la plus
   crédible » sur la foi de mesures qui ne mesuraient rien.

   Corrigé le 04/09 : le pipeline écrit le bandeau comme il écrit les cartes.
   Vérifié en retardant `offres.js` de 3 s — le HTML de la piste est
   **identique au caractère près** avant et après l'exécution du JS, et la
   hauteur du bandeau ne change pas. Cinq offres mises en avant deviennent au
   passage lisibles par Google.
2. **Total Blocking Time 310 ms sur mobile**, dont une tâche longue de 358 ms
   attribuée à `offres.js`. Le contenu est peint — c'est le gain du chantier —
   mais pendant un tiers de seconde sur un téléphone d'entrée de gamme, taper
   dans la recherche ou changer d'onglet ne répond pas. C'est exactement la
   piste notée plus haut : ne charger `offres.js` qu'au premier filtre.
3. **Speed Index 4,0 s sur mobile** contre un LCP de 2,3 s : la page continue
   de se peindre bien après le premier contenu utile. 832 cartes à dessiner.

### Accessibilité — les trois défauts corrigés le 04/09/2026

| | avant | après |
|---|---|---|
| `.pepites-titre` | 3,22 | **4,69** |
| `.pepite-cta` | 3,22 | **4,69** |

Aucune couleur inventée : `--accent-fort` (#c2410c) était **déjà dans la
palette** et déjà utilisé par `.pepite-emp`, juste à côté. Le titre et le nom
de l'employeur partagent désormais le même orange.

`aria-hidden="true"` retiré de `.pepites-nav` et de `#pepites-points` : les
deux masquaient aux lecteurs d'écran des boutons qui restaient dans l'ordre de
tabulation — une personne au clavier atteignait un bouton dont son lecteur ne
disait rien. Les points du carrousel, qui n'avaient aucun nom, s'annoncent
maintenant « Pépite 1 » à « Pépite 5 ».

Enchaînement des titres : il sautait de `H1 Offres` aux `H3` des cartes. Un
`<h2 class="sr-only">Résultats</h2>` comble le trou — invisible à l'œil
(1 × 1 px), lu par les lecteurs d'écran. Le gabarit des cartes n'est pas touché :
il est partagé avec le pipeline.

### La preuve par le résultat — 04/09/2026, 15h08

Après avoir fait écrire le bandeau des Pépites par le pipeline, **bureau** :

| | avant | après |
|---|---:|---:|
| **Performances** | 84 | **98** puis **96** (deux passages) |
| **Cumulative Layout Shift** | **0,317** | **0,035** puis **0,028** |
| Accessibilité | 91 | **96** |
| First Contentful Paint | 0,4 s | 0,4 – 0,7 s |
| Largest Contentful Paint | 0,5 s | 0,5 – 0,8 s |
| Total Blocking Time | 0 ms | 40 – 170 ms |
| Speed Index | 0,6 s | 0,7 – 1,3 s |
| Bonnes pratiques / SEO | 100 / 100 | 100 / 100 |

**Le CLS tombe de 0,317 à 0,03**, soit d'une zone rouge (> 0,25) au vert
(< 0,1). Le diagnostic est confirmé par le résultat : c'était bien le bandeau,
et jamais la police.

Les autres métriques bougent un peu — la page est plus lourde de cinq pépites
écrites en dur — mais toutes restent au vert, et le TBT reste sous les 200 ms.
L'écart entre les deux passages est la variabilité normale de Lighthouse.

**Le mobile n'a pas pu être mesuré** : l'API publique répond 429 (quota
anonyme épuisé pour la journée) et l'interface a échoué côté Google —
`THROTTLED_TASK_LIMIT`, « too many render requests ». À reprendre demain. Le
mobile était déjà à CLS 0 et n'avait donc rien à gagner de ce correctif ; la
seule question ouverte de son côté reste le TBT de 310 ms, qui attend la
décision sur `offres.js`.

Accessibilité : **91 → 96**, les trois défauts nommés étant corrigés.
