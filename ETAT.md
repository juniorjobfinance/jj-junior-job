# Où en est JJ

**Dernière mise à jour : 10 septembre 2026.**

Ce fichier dit l'état du projet à date. Il est réécrit à la fin de chaque
séance de travail — c'est la première chose à lire pour reprendre, et la
dernière à écrire avant de s'arrêter.

---

## Le catalogue en ligne

**912 offres** · **200 employeurs** distincts · **15 familles** · **11 types
de structure**, tous représentés. Mesuré sur `offres.js` le 04/09/2026 au soir.

> Le chiffre a baissé — 1 006 le 03/09, 912 le 04/09 — et c'est voulu. Le
> durcissement du périmètre (956 → 900 offres retenues) et la porte
> « publication sans structure » écartent désormais ce qui aurait été publié
> et introuvable. *Moins d'offres, mais toutes justes.*

| Onglet | Offres |
|---|---:|
| Stage | 450 |
| CDI · CDD | 331 |
| Alternance | 83 |
| VIE | 48 |

> **L'alternance est saisonnière.** Un catalogue d'alternance maigre relevé en
> septembre ne prouve rien : le contrat démarre à la rentrée, donc les annonces
> se publient de février à juillet. La mesure qui compte est celle du
> printemps. Ne rien durcir ni assouplir sur la foi de ce compteur.

**Les cinq familles les plus fournies** : Comptabilité & Consolidation 117,
Risques & Conformité 117, Contrôle de gestion & Trésorerie 101, Audit &
Contrôle interne 73, Capital-investissement 70. Le résidu « Autres métiers de
la finance » tient à **14 offres, soit 1,5 %** — il était à 26,7 % le
2 septembre.

**Les cinq structures les plus fournies** : BFI 189, Entreprise 131, Big Four
110, Assurance 88, Banque d’affaires 78.

**Les tables** : `maisons.txt` 214 lignes, `structures.js` 290 employeurs.

**Le poids servi** : `offres.js` 712 Ko, `index.html` 784 Ko, les quinze pages
de famille 2 337 Ko au total. Le sitemap déclare **18 URL**.

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

**6. Visibilité — fait le 04/09/2026.** Search Console, mesure d'audience et
poids de `offres.js` sont traités ; voir le bilan en fin de fichier. Reste
ouvert : les données structurées `JobPosting`, **hors d'atteinte par
construction** — Google interdit le balisage sur une page de liste et exige la
description complète, que JJ ne reproduit pas (§6 des mentions légales). Ce
n'est pas un chantier en attente, c'est une porte fermée par deux règles
fondatrices du projet.

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

### PISTE ÉCARTÉE — le chargement paresseux de `offres.js`

**Écartée le 04/09/2026. Ce n'est pas « à faire plus tard ».**

L'idée : ne charger `offres.js` qu'au premier filtre, pour sortir du chemin
critique la tâche longue de 358 ms que Lighthouse lui attribue.

Le gain était réel et chiffré — calculateur des courbes Lighthouse 10, éprouvé
sur les quatre passages connus à **1 point près** :

| | aujourd'hui | après |
|---|---:|---:|
| TBT mobile | 310 ms | ~0 ms |
| **mobile** | 88 | **95** |
| **bureau** | 96 | **100** |

**Et on ne le fait pas, pour trois raisons qui tiennent toutes seules.**

1. **L'onglet mentirait.** Le HTML porte les 912 offres, tous volets confondus ;
   l'onglet actif au chargement est « Stage », qui en compte 450. Aujourd'hui le
   JS résorbe l'écart en ~200 ms. Sans lui, un visiteur qui ne filtre jamais
   voit **912 offres sous un onglet qui en annonce 450**, un VIE et un CDI
   compris, avec les compteurs et les menus lieu/entreprise vides. La seule
   alternative — ne rendre que les 450 du volet — ferait retomber Google à
   **49 % du catalogue**, ce qui défait le chantier du même jour.
2. **Le coût ne disparaît pas, il se déplace.** Mesuré : le réveil coûte 25 ms
   sur un bureau rapide, 358 ms sur le Moto G de Lighthouse. Le chargement
   paresseux déplace ces ~350 ms **du chargement au premier clic**. Or une
   latence au chargement est attendue ; une latence après un clic est perçue
   comme une panne. Lighthouse ne le verrait jamais — il ne mesure que le
   chargement — donc le score monterait pendant que la sensation se
   dégraderait.
3. **Le coût en code est diffus.** 24 écouteurs plus 18 cases posées en boucle,
   tous à rendre asynchrones ; sept fonctions qui lisent le catalogue au
   démarrage, dont `remplirSelect` qui **construit** les menus lieu et
   entreprise ; et une branche à part pour le lien partagé, qui a besoin des
   données immédiatement pour appliquer le filtre annoncé dans son adresse.

**Si on rouvre cette piste, c'est en ayant répondu au point 1**, pas en voyant
seulement le +7.

### Pourquoi `firstSeenAt`, `source` et `alsoOn` restent

Trois champs de `offres.js` ne sont lus par aucune ligne de la page. **Ils
restent quand même**, et il ne faut pas les supprimer en les croyant inutiles.

**La règle, et elle servira au-delà de ce cas : un champ dérivé se
recalcule, un fait de collecte ne se retrouve pas.** `familleId` se déduit du
libellé de la famille ; `source` et `alsoOn` n'existent nulle part ailleurs.
Le critère n'est donc pas « est-ce utilisé ? » — un champ pas encore utilisé
n'est pas un champ mort — mais « **est-ce reconstituable ?** ».

`offres.js` est commité chaque matin : git en garde toutes les versions, le
catalogue est donc déjà une série temporelle. Tout fait de collecte qu'il porte
est archivé de fait.

- **`firstSeenAt`** — quand JJ a vu l'offre pour la première fois. La seule
  donnée temporelle que le projet produise, et la matière d'un éventuel
  observatoire du recrutement junior en finance : qui recrute, quand, dans quel
  métier.
- **`source`** — la plateforme par laquelle l'offre a été collectée.
  Mesuré : **106 sources distinctes pour 200 employeurs**, et l'employeur ne
  détermine PAS la source — une maison peut être collectée par plusieurs
  connecteurs. Ce n'est donc pas reconstituable depuis le catalogue publié.
- **`alsoOn`** — les autres connecteurs qui ont vu la même offre, sur 167 des
  912. Fait de collecte, non reconstituable.

**Un champ pas encore utilisé n'est pas un champ mort.**

### Élagage fait — trois champs dérivés retirés

`familleId`, `structureId` et `maisonReference` sont partis. Mesuré avant de
les retirer : les trois relations sont **bijectives** — 15 familles pour 15
`familleId`, 11 secteurs pour 11 `structureId`, et `maison` détermine
`maisonReference` via `maisons.txt`. Ils transportaient deux fois la même
information, ce qui est exactement ce que la règle « ne jamais stocker une
valeur dérivée » interdit.

**Une réserve, à garder en tête le jour où une famille sera renommée.**
Les identifiants retirés étaient stables là où les libellés ne le sont pas : si
« Marchés financiers » devient autre chose, les catalogues archivés porteront
l'ancien libellé et plus aucune clé pour les relier au nouveau. C'est
reconstituable — le code de chaque jour est dans git, et la table des familles
avec — mais c'est pénible. Y penser avant de renommer, pas après.

$1

| | avant | après |
|---|---:|---:|
| `offres.js` brut | 711,6 Ko | **601,0 Ko** (−15,5 %) |
| `offres.js` compressé | 36,3 Ko | **35,1 Ko** (−3,1 %, soit 1,1 Ko) |

**Le gain est du calcul, pas de la bande passante.** Les noms de champ répétés
912 fois se compressent presque à zéro : sur le fil on économise 1,1 Ko. En
revanche le navigateur analyse 15,5 % de texte en moins, ce qui devrait retirer
**~56 ms** des 358 ms de tâche longue — une estimation proportionnelle, pas une
mesure. Seul PageSpeed tranchera, et son quota est épuisé jusqu'à demain.

Vérifié dans le navigateur sur le catalogue élagué : onglets (stage 450,
cdi-cdd 331, alternance 83, vie 48), filtre famille, filtre structure (147, 55
et 9 offres, conformes aux libellés), menus lieu (18), entreprise (68) et
structure (12) toujours construits, et un lien partagé
`?contrat=vie&familles=Marchés financiers&tri=entreprise` qui restaure bien
l'onglet VIE, la case cochée, le tri et ses 3 offres. Les cinq suites au vert.

### Search Console — inscrite le 04/09/2026

Propriété **validée** par enregistrement TXT chez Gandi, où se trouve la zone
DNS du domaine. `sitemap.xml` **envoyé** — opération effectuée, **3 pages
découvertes** — et l'indexation de la page d'accueil **demandée**.

Ce que Google trouve en arrivant, mesuré le même jour avec l'agent
`Googlebot/2.1` : **143 860 caractères de texte visible et 835 cartes**, là où
il en recevait 1 033 et 3 le matin.

Les 3 pages du sitemap sont l'accueil et les deux pages légales. **C'est le
plafond d'indexation du site** : le `canonical` ramène tous les filtres à `/`,
ce qui est le bon réglage contre le contenu dupliqué et supprime toute longue
traîne. La suite, si on la veut, ce sont les **15 pages par famille** — toutes
avec au moins 5 offres, ~0,5 Mo compressé, générables par le pipeline comme
`sitemap.xml` l'est déjà. Ni page par offre, ni lien sortant abandonné : les
deux règles fondatrices tiennent.
$1

Umami Cloud, palier gratuit, compte en **région européenne**. Relayée par deux
réécritures Vercel — `/mesure.js` et `/api/send` — pour que le navigateur ne
parle qu'à `juniorjobfinance.com` : la Content-Security-Policy n'a pas bougé
d'un octet, et aucune ressource tierce n'est chargée.

**Le détail décisif, à ne pas perdre : `data-host-url`.** Le script Umami
contient `K = \`${(x || "https://gateway.umami.is")}/api/send\``, où `x` est
cet attribut. **Sans lui, le relais ne sert à rien** : le script écrirait
`gateway.umami.is` en dur et la collecte partirait directement, par-dessus la
réécriture. C'est le genre de configuration qui « marche » en apparence tout
en ne faisant pas ce qu'on croit.

**Ce qu'on n'a PAS pu établir, et qu'il ne faut pas ré-affirmer à la légère :**
que la collecte transite exclusivement par l'Europe. `eu.umami.is` redirige
(301) vers `cloud.umami.is`, la documentation ne décrit aucun point de
collecte régional, et **sonder les hôtes ne prouve rien** — `*.umami.is` est
un joker : `ceci-nexiste-pas-du-tout.umami.is` répond exactement comme
`eu-gateway.umami.is`. Sans ce test de contrôle, une fausse passerelle
européenne partait au rapport.

Ce qui est donc écrit au §6 de la politique de confidentialité, et rien de
plus : les statistiques sont stockées en région européenne, Umami Software,
Inc. est une société américaine, la collecte passe par un réseau de diffusion
mondial, et le tout relève des garanties du chapitre V du RGPD.

**Piste, pas chantier — si un jour on veut zéro exposition américaine.**
Deux voies, et aucune n'est gratuite :

- **héberger Umami soi-même** — un serveur Node et une base PostgreSQL à tenir,
  sauvegarder et mettre à jour : le contraire exact de l'architecture du site,
  qui n'a rien qui tourne ;
- **passer à GoatCounter** — serveurs chez Hetzner en Finlande et en Allemagne,
  **aucune adresse IP jamais écrite en base**, identifiant de session en mémoire
  huit heures au plus. Le meilleur profil des quatre outils comparés, au prix
  d'un projet porté par une personne et financé par dons.

La situation actuelle est celle de presque tous les petits sites européens,
elle est déclarée honnêtement, et elle est proportionnée au traitement. À
rouvrir seulement si l'exigence change, pas parce qu'on relit ce paragraphe.

---

## Le bilan du 4 septembre 2026

Six chantiers en une journée, et **chaque chiffre ci-dessous est mesuré, pas
estimé** :

| | avant | après |
|---|---:|---:|
| texte reçu par Googlebot | **1 033 caractères** | **143 860** |
| cartes dans le HTML servi | 3 | **835** |
| CLS bureau | **0,317** 🔴 | **0,03** ✅ |
| PageSpeed bureau | **84** | **98** |
| Accessibilité | 91 | **96** |
| SEO mobile et bureau | 100 | **100** |

Et deux acquis qui ne se comptent pas en points :

- **`document.write` retiré.** C'était le défaut le plus grave de la journée,
  et il n'avait rien à voir avec le référencement : Chrome refuse d'exécuter un
  script ainsi injecté sur connexion lente et hors cache. Un visiteur en 3G
  pouvait voir la page **sans aucune offre**, sans que rien ne le signale. Le
  site ne peut plus être escamoté.
- **Search Console et Umami en place, RGPD documenté.** La mesure est relayée
  par le domaine, sans cookie, sans identifiant persistant, et le §4 de la
  politique porte le fondement réel de l'exemption de consentement plutôt
  qu'une formule commode. Ce qu'on n'a pas pu établir — que la collecte
  transite exclusivement par l'Europe — est écrit comme tel.

**Ce qui reste une estimation, et qui doit le rester jusqu'à mesure :** les
~56 ms que l'élagage de `offres.js` devrait retirer de la tâche longue. C'est
une proportion, pas un relevé. PageSpeed mobile tranchera — son quota était
épuisé le 4 au soir.

**Et la leçon de la journée**, qui vaut mieux que ses six chantiers : deux
fois, un instrument a menti sans le dire. Le panneau de navigation rendait
`CLS = 0` sur une page que Lighthouse notait 0,317 ; `*.umami.is` répondait
normalement sur un sous-domaine inventé. Les deux ont été démasqués de la même
façon — **en faisant dire à l'appareil quelque chose dont on connaissait déjà
la réponse** : un décalage de 400 px provoqué exprès, un nom d'hôte qui n'existe
pas. Sans ces deux contrôles, deux fausses conclusions partaient au rapport, et
l'une était déjà écrite dans ce fichier comme une piste établie.

### Le 04/09 au soir : la première fois qu'un contrôle mord sur du réel

Tous les contrôles du projet avaient été éprouvés sur des pannes **provoquées** :
on cassait exprès, on vérifiait que ça bloquait. Le contrôle du catalogue dans
le HTML vient d'attraper une panne que personne n'avait organisée.

Un script d'analyse sauvegarde `index.html`, le tronque volontairement pour
éprouver le contrôle, puis le restaure. Il a été lancé en canalisant sa sortie
dans `head -11`. **`head` ferme le tuyau après onze lignes et tue le script par
SIGPIPE** — avant sa restauration. `index.html` est resté tronqué à **425 cartes
sur 832**, soit 455 Ko au lieu de 771.

Rien ne le signalait : le fichier était valide, la page s'affichait, le site
fonctionnait. Seul le contrôle a vu que le HTML ne correspondait plus au
catalogue, et il l'a dit en deux lignes — le compte, puis la position exacte de
la première divergence.

**C'est la preuve que ces contrôles servent**, et elle est arrivée par accident
plutôt que par démonstration. La leçon secondaire vaut aussi : **ne jamais
canaliser dans `head` un script qui restaure quelque chose.** Il ne meurt pas
proprement, il meurt au milieu.

### Une tension notee, pas encore un chantier : le libelle « banque-affaires »

Indosuez Wealth Management est inscrite en `banque-affaires` le 04/09/2026.
C'est le moins faux des onze choix disponibles, pas le juste : le libelle de
cette structure dit **« Banque d'affaires independante »**, ce qu'une filiale
de Credit Agricole n'est pas.

On n'ajoute PAS de douzieme structure pour autant. L'axe metier porte deja
« Banque privee & Patrimoine », et c'est la que ces offres atterrissent quel
que soit l'employeur. Deux axes, chacun son travail : le metier se lit dans
le titre, la structure se lit dans la maison.

**A revoir le jour ou trois ou quatre maisons se retrouveront dans ce cas** —
une banque privee filiale d'un grand groupe. Pour une seule, le libelle
imparfait coute moins cher qu'une structure de plus.

### Les 17 maisons ne rapportent RIEN aujourd'hui — et c'est normal

**À lire avant de relire ce chantier en croyant qu'il a rapporté 37 offres.**

Les 17 maisons inscrites le 04/09/2026 l'ont été sur la foi d'un compteur de
37 offres rejetées. **Elles en publient zéro.** Mesuré après inscription : les
37 franchissent bien la porte de structure, et meurent aux portes suivantes.

| | |
|---:|---|
| **18** | séniorité — « Manager », « Senior », « Vice President », et cinq fiches annonçant 5 à 10 ans d'expérience |
| **9** | âge — de 64 à 235 jours, pour un seuil CDI·CDD de 60 |

Air Liquide « Consolideur **Manager** », Morgan Stanley « Senior Quantitative
Valuation Model Reviewer – **Vice President** », Indosuez « Banquier Conseil »
à **10 ans**. Ce ne sont pas des offres juniors.

**Un compteur de rejets n'est pas un compteur de gains.** C'est la sixième
forme du défaut de comparaison consigné dans `CLAUDE.md` : on a lu un nombre
d'offres bloquées à une porte comme s'il annonçait ce qui passerait toutes les
autres. Personne n'avait mesuré ce qui arrivait ensuite.

**L'inscription reste juste** : c'est un investissement pour le jour où ces
maisons publieront un poste junior, pas un gain d'aujourd'hui. Un industriel du
CAC 40 a une direction financière permanente ; ces postes se renouvelleront.

### Le mécanisme d'alerte est sain — le maillon faible était le lecteur

L'issue « Maisons à inscrire » **fonctionnait**. Vérifié le 04/09 : la
détection est exacte (17 maisons, 37 offres, la même liste que les rejets
`gate:`, comparée nom par nom : zéro d'un côté seulement), le script rend un
corps complet, la logique du workflow est correcte, l'issue existe, elle est
unique, elle porte deux commentaires, et elle contenait ces 17 maisons depuis
le matin même.

**Ces 17 maisons n'étaient donc pas une découverte : elles étaient signalées et
non lues.** Une alerte que personne ne lit n'est pas une alerte — c'est le
même défaut qu'un contrôle qu'on n'a jamais vu échouer, transposé à l'humain.
Le correctif n'est pas technique : Victor s'abonne à l'issue et la regarde
chaque matin.

**Une fragilité réelle a quand même été corrigée** : l'étape « Maisons à
inscrire » passait APRÈS les contrôles bloquants. Un matin où un contrôle est
rouge, le job s'arrêtait avant — donc on n'apprenait pas ce qui manquait au
catalogue précisément le matin où on voulait le savoir. Elle passe désormais
juste après l'ingestion : le relevé de ce qui MANQUE ne dépend plus du succès
de ce qu'on PUBLIE.

### Evercore : le §24 pris en flagrant délit

Evercore figurait dans `structures.js` en `banque-affaires` **mais était
absente de `maisons.txt`**. Or c'est `maisons.txt` qui décide de ce qui
ENTRE : ses offres étaient jetées à la première porte, avant que sa structure
ne serve à quoi que ce soit.

Son offre « Paris Off-Cycle - Telecoms Team » avait été classée « perte
assumée », faute d'un motif capable de reconnaître le M&A sectoriel sans
ouvrir un fourre-tout. **Le diagnostic était faux** : ce n'était pas un
problème de vocabulaire, c'était une maison absente d'une table sur deux.

Inscrites dans les deux tables le 04/09 : Evercore (`banque-affaires`),
Repossi et VAL DE LOIRE Maintenance (`entreprise`).

**Et le relevé des employeurs inconnus est une FENÊTRE GLISSANTE.** Trois
relevés successifs donnaient 26, 18 puis 17 employeurs : ceux qui disparaissent
entre deux relevés ne sont pas réglés, leurs offres ont simplement expiré et
les maisons reviendront. **Inscrire l'union des relevés, jamais le dernier.**
Vérifié à cette occasion : BPCE Factor, BPCE Lease et Agicap étaient déjà
couverts — les deux premiers par la regex `bpce` de `maisons.txt`.


---

## Le 4 septembre au soir : les pages de famille, la fiche métier, le registre

### Quinze pages de famille, en ligne

Chaque famille a sa page — `/familles/<slug>.html` — avec le texte que Victor
a écrit pour elle. Ce texte est le produit, pas du remplissage de
référencement : il explique un métier à quelqu’un qui ne le connaît pas.

- **15 pages**, le sitemap passe de 3 à **18 URL** ;
- **état neutre par défaut** : la page montre TOUTE la famille, et ses quatre
  boutons de contrat filtrent à l’intérieur. Ce sont des filtres relâchables
  (`aria-pressed`), pas des onglets — un onglet ne se relâche pas. Les volets
  vides sont masqués.

Mesuré sur Comptabilité & Consolidation : **117 offres** à l’arrivée, **79**
sur CDI · CDD, **11** sur Stage, **18** sur Alternance, et **117** au
relâchement. Exclusivité respectée, couleurs par contrat conservées.

### Le « ? » et sa bulle — un composant, deux emplacements

Le texte ne s’étale plus sur la page : un **« ? »** à côté du h1 l’ouvre dans
une petite bulle. Le même « ? » est à côté de chaque famille dans la colonne
de l’accueil, avec la même implémentation (`.jj-aide` + `.jj-bulle`,
`brancherAide()`). Voir `DECISIONS.md` §32 et §33.

**Ce que la mesure a tranché**, sur un téléphone de 375 × 812 :

| | intro visible sous le h1 | bulle au clic |
|---|---:|---:|
| part d’écran (pire cas) | **58 %** | **0 %** au repos |
| première carte, pire cas | y = **834** ❌ hors écran | y = **613** ✅ |
| pages où la 1ʳᵉ carte est visible | 14 / 15 | **15 / 15** |

Et les propriétés vérifiées une à une :

- **la page ne bouge pas** à l’ouverture — 219 → 219 sur ordinateur,
  369 → 369 sur téléphone. La bulle est en `position: fixed`, donc hors flux
  ouverte comme fermée ;
- **le texte est dans le HTML servi, bulle fermée**, sur les quinze pages —
  c’est toute la raison d’être de ces pages ;
- **rien n’est coupé** : aucune des quinze bulles ne déborde son cadre
  — 304 x 441 px sur ordinateur, 304 x 424 px sur telephone ;
- **le clic sur le « ? » ne fait rien d’autre** : aucune case cochée,
  compteur inchangé, mêmes cartes — mesuré avant et après ;
- trois fermetures : deuxième clic sur le « ? », clic à côté, Échap — et
  Échap **rend le focus au bouton** ;
- un clic DANS la bulle ne la ferme pas : on peut y sélectionner du texte.

### Le registre des employeurs vus — la fenêtre glissante

`data/employeurs-inconnus.json` était une PHOTO, écrasée chaque matin. Trois
relevés successifs comptaient 26, 18 puis 17 employeurs : la photo du jour
sous-déclarait d'au moins un tiers, et reconstituer l'union demandait de
relire trois commentaires d'issue à la main.

`ingestion/registre-employeurs.js` fusionne au lieu d’écraser :

- **`data/employeurs-vus.json`**, commité (vérifié : non exclu par
  `.gitignore`), une entrée par employeur avec `premiereVue`, `derniereVue`,
  `passages` et `offresMax` ;
- l'issue liste les employeurs vus **au moins une fois dans les 30 derniers
  jours** — trente jours couvrent un cycle de publication complet — et affiche
  depuis quand chacun n'a plus été vu ;
- **il se nettoie tout seul** : un employeur inscrit dans `structures.js`
  cesse d’apparaître dès le lendemain. La seule chose qui sort un nom de la
  liste, c’est de régler le problème ;
- oubli à 180 jours, pour que le fichier ne croisse pas indéfiniment ;
- le SUFFIXE le suit : un passage `--depuis-cache` écrit dans son propre
  fichier et ne touche jamais au registre commité.

`ingestion/test-registre.js` : **24 assertions**, horloge simulée — sans quoi
la fenêtre de 30 jours et l'oubli à 180 ne seraient testables qu'en six mois.
La suite a été **éprouvée en la cassant** : en remplaçant la fusion par
l'ancien écrasement, elle sort en erreur sur quatre assertions dont celle qui
porte le sens (« absente du relevé, TOUJOURS au registre »).

**Un défaut trouvé par cette épreuve** : `ecartJours` comparait une date-jour
à un instant. L'écart valait 0,66 jour, arrondi à 1 — une maison vue ce matin
s'affichait « hier ». La fenêtre de trente jours n'en souffrait pas ; c'est ce
qui rend ce défaut long à trouver : il ne casse que ce qu'on lit, jamais ce
qu'on filtre.

### Les cinq maisons arbitrées : quatre l’étaient déjà

Sur Servier, Yousign, Alptis, Leocare et KONI France, **quatre étaient déjà
inscrites**. Seule Leocare manquait (→ `assurance`). Et Yousign était rangée
en `fintech` : corrigée en `entreprise`, car elle vend de la signature
électronique — l'axe structure décrit l'employeur, pas ses clients.

**La première mesure s'était trompée de fonction** : elle interrogeait
`inferSector`, qui rend un libellé par défaut, au lieu de `resolveStructure`,
qui est la vraie porte. Les cinq paraissaient couvertes. C’est le piège du
champ lu qui n’est pas le champ demandé, appliqué à une fonction.

### Ce qui reste ouvert

- Le registre **part de zéro** : il se remplira au premier passage du matin.
  L'union des trois relevés de Victor n'a pas pu être reprise — elle ne vit
  que dans les commentaires de l'issue. Quelques passages suffiront à la
  reconstituer.
- PageSpeed mobile n’a pas été remesuré depuis l’élagage de `offres.js`
  (quota épuisé le 04/09 au soir). Les ~56 ms attendus restent une estimation.

---

## Le sondage des 92 candidates — 7 septembre 2026, abandonné

Quatre-vingt-onze domaines sondés, **une seule maison validée** avec une offre
réelle en France : Memo Bank, sur Teamtailor. Ce n’est pas une conclusion sur
les maisons — c’est une conclusion sur la **méthode**, et elle est à garder
pour ne pas la refaire dans trois mois.

### Les trois défauts qui ont produit ce résultat

**1. Les domaines venaient de mémoire.** Un domaine faux rend « aucune
plateforme reconnue » sans le dire. Sur 91 sondages, 77 ont rendu ce message :
impossible de distinguer une maison sans site carrières d’un domaine mal
écrit. Le silence n’est pas une réponse.

**2. Le sondeur capte la signature de la PLATEFORME, pas le locataire.**
Trois maisons différentes — Breega, Mooncard, Memo Bank — ont rendu le même
slug Teamtailor `app`. Daphni a rendu `NielsenIQ`, Frst a rendu `maki`,
Optimind a rendu le Workday d’**Accenture**. Sur quatorze « OK », **douze
étaient faux**. Le validateur nomme ce défaut dans son propre en-tête depuis
longtemps — il n’a pas été relu avant de lancer le sondage.

**3. Le sondeur et les connecteurs ne parlent pas la même langue.** Le sondeur
écrit `slug`, `fetchTeamtailor` et `fetchRecruitee` attendent `company`,
`fetchSmartRecruiters` attend `id`. Le premier passage du validateur a donc
appelé `https://undefined.teamtailor.com/` et rendu « 0 offre » pour tout le
monde — un verdict entièrement faux, qui aurait fait écarter des maisons
saines. C’est « un champ lu doit être un champ demandé », entre deux outils du
même dépôt.

### Ce qu’il faudrait avant de recommencer

1. **Une source de domaines vérifiée**, pas une liste écrite de mémoire.
2. **Le sondeur doit refuser les slugs génériques** — `app`, `www`, `tt`, `jobs`
   — au lieu de les rendre comme des locataires.
3. **Un vocabulaire commun** entre `sonder-carrieres.js` et les connecteurs :
   tant que l’un écrit `slug` et l’autre lit `company`, toute validation est
   fausse.
4. **Le lecteur de lieu du validateur ne lit pas SmartRecruiters** (il rend
   « [object Object] ») : son verdict « aucune en France » est faux sur cette
   plateforme. Noté dans `valider-maisons.js`.

### La veine à creuser à la place

Les offres qu’on **ramène déjà et qu’on jette**. Aucun connecteur à écrire,
aucun domaine à deviner :

- **74 sur le seul VIE** (122 collectées, 48 survivantes, 45 publiées) ;
- **804 sur l’ensemble du catalogue** — 371 sans famille, 433 aux portes sans
  marqueur.

Sur les 74 du VIE, la décomposition du 07/09 donne **sept offres de vraie
finance junior** qu’une ligne dans `structures.js` suffirait à publier :
Nexans (Installation financial analyst), Elior (Contrôleur de gestion
financier), Pramex International (Analyste M&A), Virya Energy (M&A Analyst),
NAOS (Technicien comptable), Shift Technology (Analyst FP&A), Albioma
(Corporate finance). Les 67 autres sont écartées à juste titre — commerciaux,
data, qualité, PMO informatique.

**Et un défaut à corriger dans le registre lui-même : 19 des 74 sont refusées
sans qu’aucun motif ne soit enregistré.** Un rejet sur quatre ne laisse aucune
trace, et personne ne peut dire s’il est légitime sans rejouer le pipeline à
la main.

---

## Le 7 septembre 2026 — la journée où rien n’a été corrigé sans être mesuré

Sept correctifs, tous précédés d’une mesure, et **quatre instruments pris en
faute avant d’avoir servi à conclure**. C’est le fait marquant de la journée :
ce n’est pas la liste des corrections qui compte, c’est que chacune a été
chiffrée avant d’être écrite, et que les mesures fausses ont été attrapées
par la personne qui les avait faites.

### Ce qui a été corrigé

**Le passage obligé des dates.** L’API de Bank of America date en MM/JJ/AAAA,
le pipeline lisait en JJ/MM/AAAA : le 1ᵉʳ septembre devenait le 9 janvier, et
les dix offres franchissaient le seuil d’âge le même matin. Pire, une chaîne
« 25/12/2026 » levait une `RangeError` qui **tuait le passage entier**.
Désormais une seule fonction lit toute date, le format se **déclare** par
source, et une date illisible refuse l’OFFRE, jamais le PASSAGE.

**Le garde-fou proportionné.** Un connecteur muet ne bloque plus la
publication au premier jour : il est suivi trois passages, et l’alerte nomme
le coupable au lieu de dire « le réseau ou l’employeur ».

**Le tag « international », retiré.** 12 offres sur 920 le portaient, **dix
étaient en France**, dont « International Corporate Banking Graduate
Programme *Paris* ». Le tag était posé sur l’intitulé, jamais sur le lieu :
son premier motif était `/\bvie\b/`, il attrapait un TYPE DE CONTRAT en
croyant attraper un PAYS.

**Les villes.** `nettoyerLieu` gardait le dernier mot de tout libellé en
capitales : « SAINT LÔ » devenait « Lô », « FONTENAY SOUS BOIS » devenait
« Bois ». Le correctif regarde le CONTENU (un marqueur de voie) et non la
casse. Avec 23 communes de banlieue inscrites, **28 offres réelles gagnées**,
attribuées en comparant les deux catalogues sur l’URL.

**Les zones, et le contrôle qui va avec.** Ces 28 offres étaient au catalogue
et **introuvables** : `GRANDES_VILLES` avait été rempli, `ZONES` non, et
elles tombaient dans « Autres villes ». C’était la **cinquième fois de la
semaine** que deux tables se désynchronisaient. Un contrôle permanent le dit
désormais, et il a mordu à son premier passage sur `guipavas`, un oubli réel
que personne n’avait vu.

**Les préfixes d’employeur.** La clef `alan` capturait « Alantra » et l’aurait
publiée en « fintech ». Le préfixe exige maintenant une limite de mot — 0
changement sur 920 offres, 6 verdicts changés sur des noms inventés.

**Plus aucun rejet n’est muet.** Seize offres VIE sortaient de `normalize`
sans laisser de trace, et **deux étaient de vraies offres de contrôle de
gestion**. Huit sorties sont instrumentées, et un FILET attrape toute porte
future : `normalize` enveloppe la fonction réelle et écrit lui-même si aucun
des six registres n’a bougé. Mesure : **3 494 rejets, 3 494 motifs, zéro
muet**. Éprouvé en désarmant le filet — le contrôle échoue et compte
exactement les muets.

**Le faux ami « commercial ».** En anglais `commercial` veut dire « lié à
l’activité », pas « vendeur ». `VENTE_HORS_FINANCE_RE` écartait **quatre**
offres sur toute la récolte, et **les quatre étaient des erreurs** — Airbus,
CMA CGM, Ipsen, KONI, toutes du contrôle de gestion. Rendement du motif :
zéro rejet légitime. L’exception exige les deux mots ; huit intitulés de vente
pure restent dehors.

Les autres mots à double sens ont été mesurés et ne font **aucun dégât** :
`assurance` (278 intitulés, 5 au sens « Quality Assurance », 0 publiée),
`contrôle`, `action`, `formation`, `bourse`, `exercice`, `prime`.

**Sept maisons VIE inscrites** — Nexans, Elior, Virya, NAOS, Albioma, Shift
Technology, Pramex. Pour le VIE, `maisons.txt` est sauté : c’est
`structures.js` SEULE qui décide.

### Les quatre instruments pris en faute

Ils valent plus que les correctifs, parce qu’ils disent comment se tromper.

| ce que l’instrument disait | ce qui était vrai |
|---|---|
| « 19 rejets muets » | **16** — trois traçaient dans `nonClasses`, un registre non lu sur six |
| « 391 rejets sans motif » | le filet ne comptait qu’`ecartees` ; ils traçaient ailleurs |
| « 109 captures suspectes dans `maisons.txt` » | la table faisait son travail : rattacher Guerlain à LVMH |
| « 9 motifs de famille sur 10 rendent zéro » | `normaliserPourClassement` n’est pas la normalisation du classifieur — les motifs étaient **inertes** |

Le dernier est le piège du 04/09 dans sa forme exacte : *un motif qui ne peut
jamais matcher ne se plaint jamais*. Neuf zéros d’affilée l’ont trahi. Depuis,
tout motif est éprouvé sur un cas connu avant d’être cru : `C.normalize("Chargé
d'Affaires")` doit rendre `charge d affaires`, et on le VÉRIFIE.

### Ce qui reste, mesuré, prêt à décider

**384 offres sans famille** (et non 371 : la récolte a bougé). Elles passent
la porte d’entrée — le pipeline les reconnaît comme de la finance — mais
aucune famille ne sait les nommer. Réparties surtout en banque de détail (90),
fintech (73), assurance (66), BFI (59), et à 76 % dans l’onglet CDI·CDD.

Neuf motifs candidats en couvriraient **81**, dont deux qui portent presque
tout :

- **`chargé d’affaires` → 38 offres.** Métier bancaire français, stable, et le
  contre-test chez l’industriel n’en fait entrer **qu’une**.
- **`gestionnaire` → 35 offres**, mais **8 chez un industriel** et des
  intitulés hétérogènes (« Gestionnaire Adhésions », « Gestionnaire Technique
  Immobilier »). Ce mot nomme un NIVEAU, pas un métier — à ne pas poser seul.

**433 offres aux portes sans marqueur** — non encore décomposées. Cette porte
est celle qui a fait tomber le fourre-tout de 26,7 % à 1,4 % : l’assouplir
rouvre le 2 septembre. Tout mot proposé pour elle doit être mesuré **chez un
industriel** avant d’être écrit, sans exception.

### Le mot « chargé d’affaires » est mort, et son contre-test aussi

Il attrapait 38 des 384 sans-famille — le plus gros gisement apparent. **32,
soit 84 %, viennent de la banque de détail.** Ce sont des postes de réseau :
ils vendent un produit, ils ne produisent ni n’analysent d’information
financière. Le site les exclut depuis le premier jour, et §30 le redit.

**Et la forme qualifiée ne sauve rien.** Mesurée sur les mêmes 38 :

| qualificatif | offres | hors réseau |
|---|---|---|
| financements structurés | 0 | 0 |
| LBO / acquisition | 0 | 0 |
| corporate finance | 0 | 0 |
| ETI / grandes entreprises | 5 | **0** |
| immobilier / actifs | 3 | **0** |
| international / européennes | 1 | 1 |

Les six offres hors réseau, jugées une par une, n’en laissent **qu’une** de
vraie finance : « Chargé d’affaires Junior » chez Edmond de Rothschild. Et
elle ne porte **aucun qualificatif** — aucun des motifs ci-dessus ne la
prendrait. Les cinq autres sont « Chargé d’affaires européennes » à la Banque
de France (relations institutionnelles), « Chargé d’Affaires PME » chez BPCE
Factor (commercial de l’affacturage), « Chargé d’Affaires Entrepreneurs » chez
BNP Paribas (banque privée commerciale), « Assistant Chargé d’Affaires » chez
Groupe BPCE (entité générique, poste indéterminable) et « Chargé d’Affaires
Patrimoine » chez EDF (patrimoine immobilier d’un énergéticien).

**La leçon de méthode, et elle est plus large que ce mot.** Mon contre-test
cherchait le danger *chez l’industriel* — c’est celui que « stress test » chez
Safran avait imposé. Il n’a rien vu, parce que le danger n’était pas là : il
était chez le **réseau bancaire**, qui est un employeur de finance et franchit
donc toutes les portes. Un contre-test ne vaut que contre le danger qu’il
vise ; il faut nommer le danger avant de choisir la population de contrôle.

Si le mot doit entrer un jour, ce ne sera pas par l’intitulé mais par
l’EMPLOYEUR — « chargé d’affaires chez une banque d’affaires ou une BFI » —,
ce qui rapporte trois offres aujourd’hui, dont deux indéterminables.

### Deux titres vides, à traiter au nettoyage d’intitulé

Repérés dans le tirage des quarante, ils ne relèvent pas de la famille :

- **« Portzamparc »** (BNP Paribas) — un nom de filiale, pas un métier ;
- **« Assistant »** (Crédit Agricole Assurances) — un niveau, pas un métier.

`titreNommeUnMetier` aurait dû les prendre. À regarder quand le nettoyage
d’intitulé passera sur l’établi — pas ce soir.

Le filtre de lieu, lui, tient : les deux offres BBVA de Cancún et San Luis
Potosí figurent bien dans le résidu et non au catalogue.

### Les 438 aux portes « sans marqueur » — 43 % sont indécidables au titre

Mesure du 07/09/2026. La répartition réelle est **178 Big Four, 166
entreprise, 94 conseil**, soit 438 et non 433 : la récolte a bougé avec les
correctifs du jour.

Les 438, rangées par ce que leur TITRE permet de savoir :

| | offres | part |
|---|---|---|
| **A.** hors finance au titre — un domaine est nommé, ce n’est pas la finance | 234 | 53 % |
| **B.** INDÉCIDABLE au titre seul — aucun domaine nommé | **190** | **43 %** |
| **C.** finance nommée au titre, et pourtant refusée | 14 | 3 % |

Et les 14 du groupe C fondent : sept venaient d’un motif `performance` trop
large **écrit dans le script de mesure, pas dans le classifieur** — vérifié en
interrogeant `classify()`, qui rejette bien « Responsable performance
énergétique » (Sanofi) et « Business Performance Analyst » (Criteo) tout en
classant « Business Performance Analyst Finance ». Ses motifs sont bornés
(`/\bperformance (?:analyst|financiere|operationnelle)\b/`), jamais nus.

**Il reste donc sept offres que le vocabulaire pourrait prendre, contre 190
que rien ne tranchera jamais au titre** : « Manager » chez Forvis Mazars,
« Césure » chez Altarea, « Conseil en Transformation » chez Deloitte, « Junior
Consultant » chez Roland Berger, « Consultant PhD » chez BCG.

C’est l’argument chiffré du chantier de LECTURE DES FICHES : 43 % du gisement
est hors d’atteinte du vocabulaire **par construction**. Il est bloqué sur le
corpus de cinquante offres — `corpus-etiquetage.md`, 518 lignes, commité le
07/09 et jamais relu depuis. À regarder en premier : il est peut-être plus
avancé qu’on ne le croit.

#### Trois mots gardés, prouvés, à poser en cinq minutes

Contre-test fait sur QUATRE populations — big4 (1 163 intitulés), conseil
(258), entreprise (612), industriel (304) — parce qu’on ne sait pas d’avance
où le danger dort.

| motif | big4 | conseil | entreprise | industriel | gain |
|---|---|---|---|---|---|
| `restructuring` / `turnaround` | 4 | 5 | **0** | **0** | 3 offres |
| `special situations` | 2 | 0 | **0** | **0** | 2 offres |
| `BIC / BNC` | 1 | 0 | **0** | **0** | 1 offre |

Les trois nomment des métiers et les nommeront encore dans six mois. Aucun ne
nomme un niveau. Gain total : **six offres** — ce qui ne valait pas d’ouvrir
cette porte le soir du 7 septembre, après quatorze heures de travail.

#### Deux mots écartés définitivement, avec leur raison

- **`due diligence`** — son unique entrée « entreprise » au contre-test est
  *« Country, Geopolitical Risk & Due diligence Analyst »* chez **Geopost**,
  exactement l’offre signalée comme mal rangée en Fusions & Acquisitions. Le
  mot fait entrer du **risque pays**. Et il ne gagnerait rien : ses 38 offres
  Big Four passent déjà.
- **`prix de transfert`** — fait entrer du **sénior chez l’industriel** :
  « Senior Manager Prix de transfert » (Ipsen), « Group Transfer Pricing
  Expert » (CMA CGM).

### Le garde-fou a mordu au bon moment, avec le bon message

Le 07/09 à 21h13, la collecte du soir a refusé de publier. Le message :

> *le connecteur « bofa » passe de 10 offres à zéro — **14 collectée(s), 0
> retenue(s) : LA SOURCE A RÉPONDU, ce sont nos filtres qui les ont écartées**
> (10 age:apres-datation, 3 seniorite:premier-passage, 1 normalize)*

**C’est la première fois de la semaine qu’une alerte nomme sa cause du premier
coup.** Sans la ventilation par étage ajoutée le matin même, le réflexe aurait
été d’accuser le connecteur — et de « réparer » ce qui marche, l’erreur déjà
payée deux fois avec Air Liquide et Santander.

La cause réelle, trouvée en dix minutes grâce à ce message : le lecteur de
fiches convertit les dates à l’européenne **en dur**, ligne 3899. La liste dit
`2026-09-01`, la fiche rend `2026-01-09` — **235 jours**. C’est la jumelle des
deux conversions retirées de `normalize()` le matin, et mon inventaire ne
l’avait pas vue parce qu’il couvrait les branches de `normalize`, pas le
chemin des fiches. **556 offres y sont datées à chaque passage.**

La détection est donc à garder telle quelle. C’est la RÉACTION qui était
disproportionnée — voir `DECISIONS.md` §39.

---

## L’ordre de travail du 8 septembre 2026, arrêté par Victor

**1. La ligne 3899** — la conversion européenne codée en dur du lecteur de
fiches. C’est la jumelle des deux retirées de `normalize()` le 07/09, elle
date **556 offres par passage**, et c’est elle qui bloque `bofa`. La faire
passer par `lireDatePublication` avec un format déclaré.

> **L’épreuve est écrite d’avance** : les dix offres BofA doivent ressortir au
> **1ᵉʳ septembre**. Aujourd’hui la liste dit `2026-09-01` et la fiche rend
> `2026-01-09` — 235 jours d’écart, l’inversion jour/mois.

**2. Les institutions internationales de Paris.** L’OCDE est branchée mais son
intérêt est différé : elle publie des analystes de politiques publiques et
d’énergie (l’AIE est hébergée chez elle). Ses voisines, elles, recrutent de la
finance junior toute l’année, et **aucune n’est branchée** :

| institution | où | ce qu’elle recrute |
|---|---|---|
| **EBA** — Autorité bancaire européenne | Paris La Défense depuis 2019 | régulation bancaire, stress tests, analystes juniors |
| **ESMA** — Autorité européenne des marchés financiers | Paris | supervision des marchés, données, risques |
| **AFD** et sa filiale **Proparco** | Paris | financement de projet, analyse crédit souverain, analystes financiers juniors |
| **Expertise France** (filiale AFD) | Paris | — |
| **Banque européenne d’investissement** | bureau de Paris | — |

La méthode est celle appliquée à l’OCDE, et ses deux leçons :

1. **La plateforme d’abord** (`sonder-carrieres.js`), puis les offres lues
   **directement au connecteur** — `valider-maisons.js` ne sait pas lire le
   lieu SmartRecruiters et rend « aucune en France » à tort (défaut noté dans
   son en-tête).
2. **Avant de brancher, la mesure du 07/09** : inscrire la maison pour de vrai
   dans `structures.js`, mesurer ce que le classement en fait, restaurer dans
   un `finally`. `classify()` résout la structure lui-même — lui passer un
   paramètre `structure` ne simule **rien**.

Pour chacune : combien d’offres à Paris, combien passent le classement,
combien restent au résidu. **Zéro aujourd’hui ne disqualifie pas** : si la
maison recrute de la finance en temps normal, le branchement vaut la peine —
coût d’une ligne, et l’offre entre le jour où elle paraît. C’est le
raisonnement qui a fait brancher l’OCDE.

Réserve de méthode : la règle 2 ne se discute pas. Une institution derrière un
pare-feu ou dont le `robots.txt` nous ferme la porte reste hors d’atteinte, et
se note comme telle.

**3. Le compteur d’escalade** — `DECISIONS.md` §39. Il n’incrémente que
lorsque la SOURCE ne répond pas ; quand elle répond et que nos filtres
écartent tout, ça crie fort et ça n’escalade jamais.

**4. Les trois mots prouvés** — `restructuring` / `turnaround`, `special
situations`, `BIC / BNC`. Contre-test déjà fait sur quatre populations, gain
de six offres. Cinq minutes.

**5. `corpus-etiquetage.md`** — 518 lignes commitées le 07/09 et jamais
relues. C’est lui qui débloque les **190 offres indécidables au titre**.

#### Deux candidats trouvés en cliquant sur une annonce Nestlé — l’un est tranché

**`cash` tout nu : NON.** Jugement de Victor le 07/09 au soir, et c’est le
piège de la porte des 433 dans sa forme la plus pure. « Cash & Carry » est un
format de distribution, « cashier » est un caissier : chez un employeur de
type entreprise, le mot ferait entrer du commerce de gros. C’est le mécanisme
de « stress test » chez Safran.

**Et la mesure montre pourquoi le contre-test seul n’aurait pas suffi.** Sur
les 6 511 intitulés de la récolte du 07/09 : `cash & carry` → **0**,
`cashier`/`caissier` → **0**, `VFX` → **0**, `FX` au sens effets spéciaux →
**0**. Le danger est **latent, pas présent**. Un contre-test ne voit que la
population du jour — c’est la leçon de « chargé d’affaires », où il regardait
l’industriel pendant que le danger dormait chez le réseau bancaire. **Un mot
se juge sur ce qu’il NOMME, pas sur ce qu’il attrape ce soir.**

Il n’entre donc que **qualifié**, et la forme qualifiée est mesurée propre :

| motif | big4 | conseil | entreprise | industriel |
|---|---|---|---|---|
| `cash management` / `pooling` / `flow` / `collection` | 2 | 1 | **0** | **0** |

**Mais elle ne récupère pas l’offre qui a lancé la conversation** : « Cash &
FX Manager » (Nestlé) ne porte ni *management*, ni *pooling*, ni *flow*. Ni
« CASH MANAGER » (Celine), qui est de la trésorerie aussi. Il faudrait
`cash manager` comme paire qualifiée — **non mesurée**, à faire avec les autres.

**Deux motifs SÉPARÉS, et pas un motif élargi.** Après `normalize`, « Cash &
FX Manager » devient `cash fx manager` : les deux mots ne sont pas adjacents,
donc un `cash manager` collé ne l’attrape pas. Et **tolérer un mot intercalé
ferait entrer « Cash & Carry Manager »**, poste de commerce de gros — le
danger revient par la porte qu’on vient de fermer. Les deux motifs se
complètent sans rien assouplir :

- **`cash manager` adjacent** prend « CASH MANAGER » (Celine) ;
- **`fx`** prend « Cash & FX Manager » (Nestlé), si son contre-test passe.

**`fx` : à mesurer.** Propre sur le fond — *foreign exchange* ne veut rien dire
d’autre en finance — mais « FX » désigne aussi les effets spéciaux, et chez un
industriel ou une agence ça peut mordre. Ce soir : 2 occurrences, aucune en ce
sens — latent là aussi.

**Et le contre-test de `cash manager` porte explicitement les libellés du
commerce de gros**, même s’ils rendent zéro dans la récolte du 07/09 :
« Cash & Carry Manager », « Responsable Cash & Carry », « Chef de secteur Cash
& Carry ». C’est la règle qui sort de la journée — *un contre-test ne voit que
la population du jour, et le danger de `cash` est latent, pas absent.*

### Les cinq institutions parisiennes — sondées le 07/09/2026 au soir

**Aucune n’est du paquet A.** La seule qui soit sur une plateforme déjà
branchée refuse l’accès non authentifié.

| institution | plateforme | verdict |
|---|---|---|
| **AFD** | Cornerstone, tenant `afd` | **HTTP 401** — API fermée |
| **Proparco** | Cornerstone, **même tenant** `afd` | idem, filiale sur le même portail |
| **Expertise France** | **Gestmax** (`expertise-france.gestmax.fr`) | paquet B |
| **EBA** | portail propre `careers.eba.europa.eu` | plateforme non identifiée, **zéro vacance ce soir** |
| **ESMA** | **Adequasys** (`esmacareers.adequasys.com`) | paquet B |
| **BEI** | **PeopleSoft** (`erecruitment.eib.org/psc/hr/`) | paquet B — et siège au **Luxembourg** |

#### AFD : le refus est de leur côté, prouvé

Le connecteur Cornerstone a été éprouvé sur un cas connu avant d’accuser :
**Eurazeo rend 35 offres**, l’AFD rend `HTTP 401` sur `siteId` 1 et 2. Le
connecteur fonctionne ; c’est l’instance de l’AFD qui exige une
authentification. **Règle 2 : on ne contourne pas.** À noter injoignable
comme Bpifrance et Alvarez & Marsal, sauf si un autre point d’entrée public
existe — non cherché ce soir.

#### Les étapes 3 et 4 sont sans objet

Compter les offres parisiennes puis simuler l’inscription n’a de sens que si
un connecteur peut les ramener. Les étapes 1 et 2 les arrêtent toutes les
cinq avant. Ce n’est **pas** le cas de l’OCDE, où le connecteur marchait et
où la mesure a donc pu trancher.

#### Ce qu’il faudrait pour le paquet B

La règle de Victor : *une plateforme qui sert dix maisons vaut le connecteur,
une qui en sert une ne le vaut pas.* Sur les trois trouvées, **je n’ai pas
mesuré combien de maisons les partagent** — et c’est ce qui décide :

- **Gestmax** — très répandu dans le secteur public français ; à sonder sur
  d’autres agences avant de conclure.
- **PeopleSoft** — répandu chez les institutions internationales et les
  grands groupes ; même remarque.
- **Adequasys** — paraît confidentiel ; sans doute une maison pour une.

Réserve sur la **BEI** : son siège est au Luxembourg, et le périmètre est la
France (décision du 07/09). Son portail listera surtout du luxembourgeois.

Réserve sur l’**EBA** : son portail est en ligne et fonctionne, il affiche
*« No current vacancies »* ce soir. Zéro aujourd’hui ne disqualifie pas — mais
ici il n’y a même pas de connecteur pour le savoir demain.

### Sept annonces pointées le 07/09 au soir — ce qu’elles ont révélé

Victor a envoyé sept URL depuis une session de navigation. Mesuré à chaque
fois au connecteur, jamais par le validateur.

| maison | plateforme | verdict |
|---|---|---|
| Nestlé | connectée | l’offre meurt faute de `cash` / `fx` |
| Groupe BPCE (`ekez`) | connectée | publie normalement |
| Crédit Mutuel | connectée | 9 collectées, 2 publiées |
| **Ipsen** | connectée | **l’offre pointée EST au catalogue** |
| **Nabla** | **Ashby — branché** | 1 stage Finance à Paris, **bloqué** |
| **P&G** | **Phenom — branché** | absente des trois tables |
| ~~Stifel~~ | 50skills | **INJOIGNABLE** — coquille JavaScript, API sous clé |

#### Deux paquets A à une ligne

- **Nabla** rend exactement une offre : *« Internship - Finance Analyst »,
  Paris office, département Finance*. Elle meurt sur `employeursInconnus` —
  Nabla n’est dans aucune des deux tables. Ashby est branché.
- **P&G** est sur Phenom, que nous lisons pour cinq maisons déjà. Le
  « Strategic Finance Internship » pointé est notre cible exacte.

#### Stifel : le gisement n’existait pas, et l’erreur est instructive

**J’avais annoncé « 24 offres, dont 14 à Paris ». C’est faux.** `ETAT.md` se
contredisait avec sa propre ligne 326 — *« Plateformes sans API lisible — UBS
(Taleo), Stifel (50skills)… »* —, et c’est la ligne 326 qui avait raison.

Le test qui tranche est un `fetch` Node **pur**, exactement ce que le pipeline
fera à 6h30 : pas de navigateur, pas de rendu JavaScript, pas de clé.

```
page liste   HTTP 200   2 422 octets   <script> : 2   charge JSON : aucune
une offre    HTTP 200   2 428 octets   ← la MÊME coquille que la liste
robots.txt   HTTP 404
api.50skills.com   HTTP 401  {"detail":"Authentication credentials were not provided."}
```

Une coquille de 2 422 octets, un `<title>50skills Careers</title>` générique,
et **zéro offre**. La page d’une annonce précise rend le même document que la
liste. C’est **Bain** : lisible dans un navigateur qui exécute le JavaScript
appelant l’API authentifiée, illisible pour le pipeline.

**La leçon de méthode, et c’est elle qui compte.** J’ai mesuré avec le
navigateur alors que l’instrument qui décide est `fetch`. C’est « ne jamais
recopier une fonction du pipeline pour la tester », généralisé :

> **Ne jamais mesurer avec un instrument plus puissant que celui qui fera le
> travail.** Un connecteur qu’on ne peut pas faire tourner à 6h30 ne vaut
> rien, et un portail lu au navigateur n’est pas un portail lu.

Le sondage de l’OCDE, de Nabla et de l’AFD n’est pas touché : ceux-là ont été
lus **au connecteur**, en Node, comme il fallait. Seul Stifel a été jugé sur
une page rendue.

Il n’y a donc **aucun arbitrage Stifel / Taleez à écrire** : il n’y a pas de
décision à prendre, la source est hors d’atteinte. Stifel reste à sa place,
ligne 326.

#### Trois prises manquées, trouvées en chemin

- **`fiscaliste`** — « Fiscaliste - H/F » (Ipsen) meurt à `porte-finance`.
  Métier français stable et sans ambiguïté, mais c’est le **filtre d’entrée**,
  et Ipsen est un industriel : contre-test obligatoire.
- **L’analyse sectorielle en banque d’affaires** — « Analyste Healthcare
  Industry Group » (BPCE) meurt à `porte-finance`, « Analyste - Healthcare
  Sector » (Natixis) est au résidu sans famille. Deux fois le même trou.
- **« Stagiaire Finance Commercial & Global Alliances »** (Ipsen) — résidu
  sans famille.

Aucun de ces mots n’a été posé : ils rejoignent la file du jugement des
intitulés, avec `restructuring`, `special situations`, `BIC / BNC`,
`cash manager` et `fx`.

### Quinze annonces pointées le 07/09 au soir — quatre maisons à brancher

Victor a envoyé quinze URL depuis une session de navigation. **Elles ont
produit plus que le sondage systématique des 92 candidates.** Chaque
plateforme testée en `fetch` Node pur, chaque connecteur appelé en Node.

#### Quatre paquets A, mesurés au connecteur, prêts à poser

| maison | plateforme | offres | en France | ce qui manque |
|---|---|---|---|---|
| **Chanel** | Workday `cc` / wd3 / `ChanelCareers` | 24 | **23** | `sources.js` **et** `structures.js` |
| **FDJ United** | Workday `groupefdj` / wd103 / `FDJ-UNITED` | 24 | **18** | les trois tables |
| **Photosol** | Teamtailor `photosol` | 7 | 5 | **`sources.js` seul** — les deux tables l’ont déjà |
| **Nabla** | Ashby `nabla` | 1 | 1 | les trois tables |

Chanel à elle seule porte une douzaine de stages finance : *STAGE - TREASURY
ANALYST - Corporate*, *STAGE - Audit interne*, *Assistant Contrôleur de
gestion*, *Analyste Financier Projets Stratégiques*, *Comptabilité générale*.
FDJ porte un *Analyste M&A - Stage* à Boulogne-Billancourt.

**Chanel figurait déjà dans la liste des « maisons sans aucune offre »** de
chaque passage. Elle n’était pas muette : elle n’était pas branchée.

#### Un défaut de notre connecteur Teamtailor

`fetchTeamtailor` construit `https://<company>.teamtailor.com/jobs.json`.
Les maisons sur **domaine propre** lui échappent : ChapsVision publie sur
`careers.chapsvision.com`, dont le `jobs.json` répond **HTTP 200 avec 473 Ko
et 5 entrées**, quand `chapsvision.teamtailor.com` rend 404.

Ce n’est pas une source injoignable, c’est **une limite de notre code**. Reste
à savoir combien de maisons Teamtailor sont dans ce cas — non mesuré.

#### Deux plateformes nouvelles, un paquet B chacune

- **Flatchr** (`careers.flatchr.io`) — lisible en `fetch` pur, 171 Ko, titre et
  employeur présents ; `robots.txt` ne bloque que FacebookBot, bingbot et
  quelques robots de mesure. L’offre pointée est un *Fund Analyst H/F stage*
  chez **ClubFunding AM**, société de gestion parisienne.
- **iCIMS** (`careers-stifel.icims.com`) — lisible, `robots.txt` permissif,
  sitemap publié. Sans intérêt pour Stifel (offres américaines) mais **Aon
  France est sur iCIMS** : à mesurer, combien de maisons françaises ?

#### Deux injoignables

- **Stifel Europe** — 50skills, coquille JavaScript, API sous clé. Sa page
  « EU campus » ne fait que renvoyer vers 50skills : la boucle est fermée.
- **PVH** (Tommy Hilfiger, Calvin Klein) — `HTTP 202` avec **0 octet** sur un
  `fetch` sans navigateur : filtre anti-robot. Règle 2.

#### Déjà chez nous, vérifié

Ipsen (*FP&A / Junior Financial Analyst* — **au catalogue**), Valeo (*Stagiaire
Front Office* — **au catalogue**, 8 offres publiées), Groupe BPCE, Crédit
Mutuel, Schroders (`ekbq`), Nestlé.

### Forcer une publication remet le compteur d’escalade à zéro le lendemain

**Effet de bord découvert le 08/09/2026 au matin. Ni voulu, ni faux — mais il
faut le connaître.**

Le 07/09 au soir, `bofa` était au **cinquième** passage consécutif à zéro et
bloquait la publication. Nous avons forcé, en connaissance de cause : le
catalogue était incomplet de dix offres, pas faux (§35).

Le lendemain matin, le passage de 6h30 **a publié normalement**, et `bofa`
n’a pas bloqué. Pourquoi : **le garde-fou compare une source à ce qu’elle
rendait au passage PRÉCÉDENT.** En publiant un catalogue où `bofa` valait
déjà zéro, la publication forcée a **acté la baisse**. Le lendemain, la
source ne « passe » plus de dix à zéro : elle reste à zéro, ce qui n’est plus
une chute. Le compteur repart de zéro.

**Le danger, s’il n’est pas connu :** quelqu’un force un soir en croyant
seulement publier, et découvre trois jours plus tard que le compteur ne monte
jamais — parce que chaque publication forcée réarme la référence. Une source
réellement morte deviendrait alors invisible.

**Ce n’est pas un défaut à corriger tel quel.** Le garde-fou fait ce pour quoi
il est écrit : comparer à la veille. Mais il se combine avec `--forcer` d’une
façon que personne n’avait prévue, et cela s’écrit AVANT que quelqu’un ne s’y
fie. À reprendre avec la correction du compteur (`DECISIONS.md` §39), qui doit
de toute façon distinguer « la source ne répond pas » de « nos filtres ont
tout écarté » — les deux chantiers touchent le même code.



## Le 8 septembre 2026 — six portails sondés, et le verdict le plus sûr renversé

Victor a fourni les URL, ce qui a supprimé la part de devinette : six
portails jugés en une matinée, contre une maison validée sur 91 domaines
devinés le 7. La division du travail est actée — il ouvre les pages, le
dépôt mesure.

### Bpifrance — le seul verdict que j’avais rendu faux, et il était le plus assuré

`talents.bpifrance.fr` a été mesuré « WordPress ouvert, lisible en fetch
pur, 153 Ko, `robots.txt` autorisant `/opportunites/`, aucun `Crawl-delay`,
JSON-LD complet sur chaque fiche, **86 offres** déroulées sur neuf pages ».
Les intitulés étaient exactement la cible : six *Analyste Private Equity*,
*Analyste Mid Cap Dette Privée*, *Analyste Fonds Build-Up International*.
La conclusion était de brancher, et Victor l’avait validée.

Le même URL, avec l’en-tête que le dépôt envoie réellement — `UA_HTML`,
« Mozilla/5.0 (compatible; JJ job board) » — rend **403 en 919 octets**.
Liste et fiche, les deux.

| | en-tête navigateur | en-tête `JJ job board` |
|---|---|---|
| Bpifrance liste | 200, 153 047 o | **403, 919 o** |
| Bpifrance fiche | 200, 139 257 o, JSON-LD | **403, 919 o** |
| RSM sitemap et fiche | 200 | 200, à l’identique |
| Carmignac | 200 | 200, à l’identique |
| Groupama | 200 | 200, à l’identique |

Bpifrance était **la seule des six** à trier sur l’en-tête. Toutes mes
sondes de la matinée se présentaient en Chrome ; sur cinq portails cela ne
changeait rien, sur le sixième cela inventait un gisement de 86 offres.

La règle qui manquait est écrite dans `CLAUDE.md`, sous la règle 2 : « ne
jamais mesurer avec un instrument plus PUISSANT que celui qui travaille »
ne s’arrête pas au moteur, elle va jusqu’à **l’en-tête**. Rester en Node
ne suffisait pas.

Bpifrance reste donc **hors d’atteinte**, et la note d’origine avait
raison — mais pas pour la raison qu’on croyait : `bpifrance.fr` ferme
franchement, `talents.bpifrance.fr` ouvre aux navigateurs et ferme aux
robots qui se nomment. La lire supposerait de se déguiser en navigateur
qu’on n’est pas.

### Renault — mesuré, et refusé sur le rendement

Workday, tenant `alliancewd` / `wd3` / `renault-group-careers` (celui de
l’Alliance). Le connecteur existant marche sans une ligne de code :
**201 offres**. La simulation, en processus séparés :

| état | offres au catalogue | motif dominant |
|---|---:|---|
| sans `structures.js` | **0** / 201 | `gate:employeur-absent-de-structures` (122) |
| avec `renault: entreprise` | **7** / 201 | `gate:entreprise-sans-marqueur` (122) |

Sur ces 7, deux ou trois seulement tiennent : *Analyste financier
entreprises junior*, *Pricing Analyst*, *Chargé de recouvrement*. Les
autres sont un *Consolideur **senior***, un *Analyste **senior*** en
réglementation bancaire, un *Responsable Cybersécurité* rangé en
« risques-conformité », et une thèse CIFRE.

**Et un défaut d’affichage qui tranche avant le rendement :**
`locationsText` est **`undefined`** chez ce tenant — le lieu est dans
`bulletFields[0]` (« Noisy-Le-Grand »). Les sept sortiraient **sans ville**,
donc introuvables au filtre des lieux.

Lire `bulletFields[0]` comme lieu n’est **pas** une correction générique.
Mesuré sur les 30 tenants Workday de la récolte : `locationsText` est
présent sur **100 %** d’entre eux (401/401 chez `fina`, 154/154 chez `pwc`,
128/128 chez `bdf`…), et `bulletFields[0]` y est un **numéro de
réquisition** — « R-8093 », « JR016405 », « REQ2026077834 » —, un type de
contrat chez AG2R, `null` chez Ardian et PJT. Nulle part une ville. La
correction serait donc une déclaration PAR TENANT, comme le format de date.

**Verdict : non.** 201 offres collectées chaque matin pour deux ou trois
publiables, plus une déclaration par tenant à maintenir. À rouvrir si le
tenant se met à servir `locationsText`.

### Hermès — 403, la note de `sources.js:1721` tient

TalentLink sur `hermes.recruitmentplatform.com`. Les 24 combinaisons
`brand × board` du flux Atom : rien. La racine rend **403 Forbidden**,
239 octets. `sources.js:1721` la notait déjà « sondée, sans accès public
trouvé » — la note était juste, et elle a été trouvée en élargissant à
`sources.js` la vérification qu’on ne faisait que sur `ETAT.md`.

### RSM France — ni Flatchr ni une maison : DigitalRecruiters (Cegid HR)

La forme `/fr/annonces` et `/fr/annonce/<id>-<slug>` ressemblait à Flatchr ;
c’est **DigitalRecruiters**. `robots.txt` autorise (`Allow: /`, seul
`/dashboard` fermé, **`Crawl-delay: 10`**). La liste est une application
Nuxt qui affiche « Loading… » : aucune annonce dans son HTML.

Ce qui marche : **`/sitemap.xml` → 103 annonces**, et le slug porte
l’intitulé, la ville et le code postal
(`4358717-stage-en-audit-janvier-2027-hf-75009-paris`).

**La question qui décidait — une offre sans date vieillit-elle ?** Non, et
c’est écrit comme une règle : `pipeline.js:5142`, `if (!dateCredible)
return true;` **exempte** de la porte d’âge toute offre dont la date n’est
pas crédible. Brancher RSM sur le seul sitemap injecterait donc 103
annonces immortelles (`DECISIONS.md` §34).

Mais les fiches, elles, sont datées : **6 sur 6** portent un JSON-LD avec
`datePosted: "2026-09-07"` en ISO. Le connecteur générique
`fetchSitemapJsonLd` lit exactement cela, et `_dateRecuperee` passe alors à
`true` : les offres vieilliraient normalement.

Le coût est le vrai obstacle : **103 fiches × 10 s de `Crawl-delay` ≈ 17
minutes** pour une seule maison, sur un passage qui en dure 18. À décider
contre le rendement, pas contre la faisabilité. Le chemin est propre.

### Carmignac et Groupama — pas de liste publique, et c’est définitif

**Carmignac** (`carmignac.com/fr-fr/nous-connaitre/carrieres`) : la page
rend 200 Ko de vrai HTML, identique aux deux en-têtes, et **zéro
vocabulaire d’offre** — 0 « stage », 0 « alternance », 0 « CDI », 0 « CDD »,
0 « analyste ». Aucun iframe, aucune plateforme citée, `__NEXT_DATA__` sans
offres, sitemap sans URL d’emploi. Le seul chemin de candidature est un
`mailto:`. **Ce n’est pas un portail difficile à lire : il n’y a pas de
liste.**

**Groupama** (`groupama-gan-recrute.com/nos-offres/`) : WordPress, API REST
ouverte — et **aucun type de contenu « offre »**. Les types déclarés sont
les onze types standard (`post`, `page`, `attachment`, `wp_block`…). Ses
annonces ne sont donc pas des articles WordPress. Rien dans le HTML servi,
aucune action AJAX citée, sitemap sans section emploi.

C’est la réponse à la question des petites maisons : **certaines n’ont
vraiment pas de liste publique**, et il faut que ce soit écrit pour ne pas
le rechercher dans six mois.

### Le champ d’entité — onze, pas quatre-vingts

Mesuré sur toute la récolte (6 881 offres brutes), sur douze noms de champ
susceptibles de porter une entité :

| | |
|---|---:|
| entités distinctes lisibles | 119 |
| entités **différant** du nom affiché | **11** |
| déjà résolues par `structures.js` | **10** |
| à inscrire | **1** (aixigo AG, allemande) |
| offres concernées | **271** |

Le détail, par volume :

| entité | offres | affichée aujourd’hui sous | `resolveStructure` |
|---|---:|---|---|
| LCL | **134** | Crédit Agricole | banque-detail |
| CACEIS | 54 | CACEIS, Crédit Agricole | fintech |
| Direct Assurance | 27 | AXA | assurance |
| MUTUELLE SAINT-CHRISTOPHE | 22 | AXA | assurance |
| Amundi | 15 | Crédit Agricole | societe-gestion |
| GIE AXA | 6 | AXA | assurance |
| BforBank | 4 | Crédit Agricole | banque-detail |
| UPTEVIA | 4 | Crédit Agricole | fintech |
| Indosuez Wealth Management | 3 | Crédit Agricole | banque-affaires |
| aixigo AG | 1 | Amundi | — absente — |
| IDIA Capital Investissement | 1 | Crédit Agricole | fonds |

**Le chantier est donc petit** : dix des onze entités sont déjà typées, il
ne manque qu’une société allemande que la porte France écarterait de toute
façon. Ce qui reste à écrire, c’est la LECTURE du champ, pas la table.

Deux choses à noter avant de le faire. **LCL, 134 offres affichées
« Crédit Agricole »** : c’est la première marque du lot, loin devant.
**Amundi, 15 offres affichées « Crédit Agricole »** alors qu’Amundi a son
propre connecteur — la même maison paraît donc à deux endroits sous deux
noms. Et **CACEIS et UPTEVIA sont typées `fintech`** : un dépositaire et un
teneur de comptes-titres, ce qui mérite d’être revu, mais séparément.

**Ce que la mesure ne dit pas** : ni AXA IM ni CPR AM n’apparaissent nulle
part dans la récolte. Elles sont vraiment absentes, pas cachées sous le
parent.

### Quatre instruments qui ont eu tort avant le sujet mesuré

Tous les quatre relèvent de la même famille — l’outil ment sans se plaindre
— et trois ont été pris en flagrant délit par une INVRAISEMBLANCE, pas par
une erreur.

1. **Le registre lu au mauvais nom de champ.** `noterEcartee` écrit `etage`
   et `precision` ; ma mesure lisait `motif`. Résultat : « (sans motif) »
   **198 fois**. Un motif inconnu passe encore ; 198 sur 198, c’est
   l’instrument.
2. **`require.cache` a rendu deux états identiques.** La mesure Renault
   « avant / après inscription » rendait les mêmes 122 rejets
   `gate:employeur-absent-de-structures` — **après** avoir inscrit Renault,
   alors que `resolveStructure` répondait bien « entreprise ». Le pipeline
   chargé par `new Function` gardait l’ancien `structures.js` en cache.
   Deux mesures dans le même processus ne sont pas deux mesures : refait
   **un processus par état**.
3. **Un événement Vue pris pour un point d’entrée d’API.** `get-job-ads`,
   trouvé dans le bundle Nuxt de RSM, est un `$emit`, pas une URL. Six
   requêtes en 404 avant de relire le contexte.
4. **Un champ `tags3` qui porte une DATE.** Le premier compte d’entités
   rendait « 51 divergentes, 41 à inscrire » — dont « 04/09/2026 »,
   « 07/09/2026 », quarante dates. Chez AXA-Phenom `tags3` porte l’entité
   légale, chez Talentsoft il porte la date de publication. **Le même nom
   de champ ne veut pas dire la même chose d’une plateforme à l’autre** —
   c’est « un nom de facette n’est pas un domaine », appliqué aux champs.
   Après filtre : 11, pas 51.

### Ce qui reste ouvert après cette séance

- **La lecture du champ d’entité** : 271 offres, 11 entités, 10 déjà typées.
  Petit chantier, gain visible — c’est le meilleur rapport du jour.
- **RSM** : chemin propre, 17 minutes de coût. À trancher au rendement.
- **CACEIS et UPTEVIA typées `fintech`** : à revoir, hors de ce chantier.
- Les huit petites maisons (Messier, Centerview, LBO France, IDIA, Andera,
  Alven, Partech, Sagard) : **absentes de la récolte**, portail non vérifié.
  Elles ne sont **pas** notées « sans portail » — c’est Victor qui les
  ouvrira, et c’est là que son aide vaut le plus.

## Le 8 septembre, deuxième partie — un chiffre corrigé, une lecture posée

### Le champ d’entité — la correction : dix offres, pas 271

**Le chiffre écrit plus haut dans ce fichier était faux, et l’erreur est la
plus coûteuse de la journée : j’ai mesuré l’ENTRÉE et l’ai rapportée comme
la SORTIE.** Le compte des entités divergentes portait sur `o.emp` dans la
récolte brute. Or `normalize()` réécrit l’employeur : une offre brute
« Crédit Agricole » portant `entite: Amundi` ressort déjà « **Amundi** ».

La bonne mesure compare l’entité au nom **après** `normalize()` :

| | |
|---|---:|
| offres brutes portant une entité lisible | 1 336 |
| survivant à `normalize()` — les seules qui s’affichent | 528 |
| portant **déjà** le bon nom | **518** |
| affichant encore un nom différent | **10** |

Les 134 offres LCL et les 15 Amundi que j’avais comptées comme un défaut
étaient **déjà corrigées**. Le pipeline lit l’entité presque partout ; il
restait un seul connecteur, `phenom:careers.axa.com`, et trois marques :
Mutuelle Saint-Christophe (4), GIE AXA (4), Direct Assurance (2).

C’est « toute vérification compare un APRÈS à un AVANT » pris à l’envers :
j’avais comparé **deux AVANT**.

### Ce qui a été posé, et pourquoi c’est borné

`CHAMP_ENTITE_PAR_SOURCE` + `entiteQuiRecrute()` dans `pipeline.js`, appelés
dans la branche Phenom. Deux bornes, chacune imposée par une mesure :

1. **Le champ se déclare par SOURCE, pas par plateforme.** `tags3` porte
   l’entité chez AXA-Phenom et la DATE chez Talentsoft. Sur les cinq tenants
   Phenom de la récolte, seul AXA remplit `tags3` — une règle « chez Phenom »
   aurait été fausse dès le premier tenant qui le remplirait autrement.
2. **Une déclinaison de la même maison ne se substitue pas.** Sans cette
   borne, **371 offres « AXA » deviendraient « AXA France »** — ce qui
   n’apprend rien au candidat et casse la déduplication, `canonicalKey`
   commençant par `slugEmp(offer.emp)`.

L’écart mesuré, les deux pipelines chargés côte à côte sur la même récolte :
**3 308 offres avant, 3 308 après, 10 employeurs changent.** Et un effet
qu’on n’attendait pas : ces trois marques existaient **déjà** au catalogue
via l’autre source AXA (`axafr`, qui lit `LegalEntity`). Le changement les
fusionne au lieu de les éparpiller entre « AXA » et leur nom.

`ingestion/test-entite.js` — 26 assertions, câblé au Contrôle 1. Éprouvé sur
deux défauts provoqués : borne retirée → 7 échecs, lecture par nom de champ
→ 4 échecs, pipeline restauré à l’identique.

### CACEIS et UPTEVIA sont typées `fintech` — relevé, non corrigé

CACEIS est un dépositaire, UPTEVIA un teneur de comptes-titres. Ni l’un ni
l’autre n’est une fintech. 58 offres au total. **Relevé le 08/09/2026, à
traiter séparément** : changer un type de structure déplace des offres entre
les filtres du site, et cela ne se fait pas en marge d’un autre chantier.

### RSM — le coût tombe à 4,7 minutes, et le levier existait déjà

Le filtrage au slug avant de visiter la fiche, mesuré avec les vraies portes :

| filtre | fiches à visiter | coût (`Crawl-delay: 10`) |
|---|---:|---:|
| sitemap entier | 103 | 17,2 min |
| + `isFinanceOfferFor` + lieu | 75 | 12,5 min |
| + **`SENIOR_RE` sur le titre** | **28** | **4,7 min** |

Les 28 sont la cible : *auditeur financier junior*, *apprenti collaborateur
comptable*, *stagiaire transaction services*, *stage en audit janvier 2027*.

**La réserve à connaître avant de brancher** : ce pré-filtre est plus STRICT
que le pipeline, pas équivalent. `normalize()` n’applique pas `SENIOR_RE` au
titre — il lit la séniorité sur la description. Les 47 écartés le seraient
de toute façon, mais après lecture de leur fiche. Les cas limites se perdent :
« assistant manager en transaction services » tombe sur le mot *manager*,
alors qu’en cabinet c’est souvent 2-4 ans.

### Trois portails de plus, et un déjà branché

- **Amazon** (`amazon.jobs`) — `search.json?country=FRA&base_query=finance`
  répond **200 avec l’en-tête du dépôt**, 24 offres, avec ville, date
  (« June 3, 2026 »), `is_intern`, `job_family` et la description complète.
  `robots.txt` ne ferme que `/internal`. **Branchable.** La date est en
  anglais long — sans ambiguïté, mais `lireDatePublication` doit savoir la
  lire.
- **CCEP** (`ccep.jobs`, Coca-Cola Europacific Partners) — SuccessFactors +
  Radancy, JSON-LD `JobPosting` avec `datePosted: "2026-8-19"` (ISO sans
  zéro initial, le cas déjà couvert le 07/09), `addressCountry: France`,
  sitemap de 737 URL. **Branchable.**
- **Aareal Bank** (`aareal-bank-group.onlyfy.jobs`) — plateforme Onlyfy/XING,
  lisible aux deux en-têtes, `robots.txt` permissif (`Crawl-delay: 1`), mais
  **aucun JSON-LD** et des fiches en `/de/job/`. Banque allemande : le
  gisement français reste à établir.
- **Thales** — `careers.thalesgroup.com` est **déjà branchée deux fois** :
  `workday:thales` (`sources.js:1843`) et Phenom (`sources.js:2103`),
  30 offres dans la récolte du 07/09. Rien à faire.

### Un sondeur d’URL, hors dépôt

Victor envoie des URL plus vite qu’on ne réécrit des scripts. Un sondeur
réutilisable vit dans le répertoire de travail temporaire : il fait toujours
les mêmes gestes — `robots.txt` d’abord, **les deux en-têtes** ensuite, la
signature de plateforme, le JSON-LD, la comparaison liste/fiche, le sitemap.
Il n’est pas dans le dépôt : il n’a pas été demandé, et `sonder-carrieres.js`
y occupe déjà la place voisine.

## Le 8 septembre, troisième partie — deux principes, deux connecteurs, un défaut en ligne

### ⚠ `index.html` et `offres.js` sont désynchronisés SUR LE SITE

**Constat, non corrigé — à trancher.** Le contrôle échoue sur le dépôt tel
qu’il est publié, et l’échec **préexiste à tout le travail du jour** : mesuré
en remettant les cinq fichiers modifiés à `HEAD`, les deux mêmes échecs
apparaissent, et **zéro n’est introduit par le travail du jour**.

| | |
|---|---:|
| `offres.js`, généré le 2026-09-08T04:46Z | **999 offres** |
| compteur écrit dans `index.html` | **« 1004 offres »** |
| cartes dans `index.html` | 917 |
| URL d’`offres.js` absentes du HTML | 72 |

**1004 est le chiffre de la publication forcée d’hier soir** (`c795ecb`). Le
passage de 6h30 a donc réécrit `offres.js` à 999 **sans régénérer le
catalogue du HTML**. La page en ligne sert le catalogue d’hier soir avec le
compteur d’hier soir, pendant qu’`offres.js` porte celui de ce matin.

Le remède que le contrôle lui-même indique est de relancer le passage. Ce
n’est pas fait : un passage complet republierait le catalogue, et cela se
décide.

### Principe 1 — brancher une filiale peut créer des doublons

`canonicalKey` vaut `slugEmp(emp)|slugTitleFuzzy(title)|lieu` : **le nom de
l’employeur fait partie de la clé**, donc deux offres identiques publiées sous
deux noms ne peuvent jamais se dédupliquer. Comme on branche des maisons tous
les jours et que plusieurs sont des filiales de maisons déjà collectées, le
risque est quotidien.

La règle est dans `CLAUDE.md` : avant de brancher, vérifier que le parent ne
publie pas déjà — et si oui, que les deux noms se normalisent vers la MÊME
chaîne. Le contrôle « une URL, un employeur » fait échouer le passage sur ce
cas ; mesuré avant d’être posé (995 URL au catalogue, 3 167 dans la récolte,
zéro partagée), puis éprouvé en le faisant mordre sur un doublon fabriqué.

Il ne crie pas sur une URL répétée sous le MÊME employeur : quatre cas chez
BPCE, tous légitimes — une annonce ouverte sur deux sites, l’URL le dit
elle-même (`charge-de-conformite-f-h-dijon-paris`).

### Principe 2 — le pré-filtre RSM est ABANDONNÉ, la mesure l’interdit

Le critère était clair : le pré-filtre ne doit écarter **aucune** offre que le
pipeline aurait gardée, sinon c’est un filtre caché qui retire des offres sans
laisser de motif de rejet.

Mesuré en allant chercher la fiche de chaque offre coupée et en demandant son
verdict au pipeline :

| version du pré-filtre | fiches à visiter | offres perdues |
|---|---:|---:|
| `SENIOR_RE` entier | 28 | non mesuré |
| sous-ensemble conservateur | 38 | **30 sur 37 coupées** |

**Trente offres perdues sur trente-sept coupées.** Même « senior », « manager »
et « head of » — ce que Victor jugeait indiscutable — écartent des offres que
le pipeline garde : *collaborateur comptable senior*, *manager expertise
comptable*, *auditeur financier senior*.

**Ce que ça révèle, et qui dépasse RSM** : le pipeline **publie aujourd’hui des
offres titrées « senior »**. Sa séniorité se lit sur la DESCRIPTION, pas sur
le titre, et les descriptions de ces annonces n’énoncent pas de durée
d’expérience. C’est un écart à la règle 3 (0-3 ans) qui n’a rien à voir avec
RSM et qui n’est **pas** corrigé ici : durcir la séniorité sur le titre
toucherait tout le catalogue, et cela se mesure séparément.

RSM reste donc brancheable au coût plein — 103 fiches, 17,2 minutes — ou pas
du tout. Le raccourci n’existe pas.

### Amazon et CCEP — branchés, 6 offres

**La vérification du principe 1 d’abord** : aucune des deux n’apparaît au
catalogue ni dans la récolte sous quelque nom que ce soit. Aucun risque de
doublon.

**Amazon** — `amazon.jobs/en/search.json`, API publique, `robots.txt` ne ferme
que `/internal`, 200 avec l’en-tête du dépôt. 216 offres en France, 13 après
`isFinanceOfferFor`, **4 au catalogue**.

> **Leur facette métier est acceptée SANS EFFET.**
> `business_category=finance` rend les 216 offres de France, fulfillment-ops
> et AWS comprises. C’est le piège Phenom, et le seul moyen de le voir est de
> vérifier que le paramètre CHANGE le résultat. Le connecteur prend donc la
> France entière et laisse `isFinanceOfferFor` trancher.

**CCEP** (Coca-Cola Europacific Partners) — sitemap de 306 fiches, JSON-LD
complet sur chacune, par le connecteur générique `fetchSitemapJsonLd`.
35 offres rendues, **2 au catalogue** : *Contrôleur de Gestion – Siège* et
*Manager Contrôle de Gestion FP&A*, toutes deux à Issy-les-Moulineaux.
Leur `robots.txt` ferme `/search-jobs/` : on ne touche qu’au sitemap et aux
fiches.

Les deux inscrites dans **les deux tables** (§24) — elles rendaient zéro tant
que `structures.js` était vide. Le garde de préfixe posé ce matin tient :
« Amazonas Conseil » et « Cocalico » restent à `null`.

### « June 3, 2026 » reculait la date d’un jour

Le mois est écrit en toutes lettres, donc **rien n’est ambigu** — mais
`new Date('June 3, 2026')` lit en heure LOCALE : minuit à Paris vaut 22 h UTC
la veille. Six formes étaient décalées.

C’est le défaut de « 2026-8-25 » (corrigé le 07/09) sur une **autre branche de
la même fonction**. La leçon tient en une phrase : ne jamais laisser
`new Date` deviner le fuseau, lui donner une chaîne en Z.

**Aucune source ne l’envoyait avant Amazon** — le défaut attendait un
connecteur. Onze assertions ajoutées à `test-passage-date.js`.

### Les instruments qui ont encore eu tort

- **`lireDatePublication` n’est pas dans les `NOMS` d’`atelier.js`** : mes six
  « ERREUR » venaient de là, pas du pipeline. Chargée comme le fait
  `test-fiche-date.js`, elle répondait très bien.
- **Mon garde de préfixe était plus grossier que la vraie fonction.** Il
  criait sur « Amazonas Conseil » avec un `startsWith` nu ; `resolveStructure`
  exige une limite de mot depuis ce matin et rend `null`. Interroger la
  fonction qui décide, pas une imitation.
- **`fetchAmazon` et la facette** : sans le contrôle « le paramètre
  change-t-il le résultat ? », le connecteur aurait filtré sur une facette
  inerte et ramené 216 offres de logistique.

## La file ouverte au 8 septembre au soir — chantiers de mécanique, en attente

Victor a arrêté les chantiers de mécanique le 08/09 : **ils ne rapportent
plus d’offres.** La priorité redevient brancher des maisons. Ce qui suit est
gardé pour ne pas être remesuré.

### 1. Les trois mots prouvés — le contre-test est FAIT, la pose ne l’est pas

Contre-test refait le 08/09 sur les quatre populations de la récolte : big4
(1 167 intitulés), conseil (257), entreprise (417), industriel (248).
« Entrent » = matchent le motif ET n’avaient **aucun** marqueur existant.

| motif | big4 | conseil | entreprise | industriel | entrent |
|---|---:|---:|---:|---:|---:|
| `restructuring` / `turnaround` | 4 | 1 | 0 | 0 | **5** |
| `special situations` | 2 | 0 | 0 | 0 | **2** |
| `bic bnc` | 1 | 0 | 0 | 0 | **1** |

**Zéro chez les industriels pour les trois** — c’est ce que le contre-test
devait vérifier, et il le vérifie.

**Ce que le contre-test d’hier ne disait pas, et qui change la valeur :**
sur les cinq de `restructuring`, **deux sont des avocats** — « Avocat junior
en droit des affaires : Restructuring » et « Stage en droit des affaires :
Restructuring » (Deloitte). Ils seraient rattrapés par
`METIER_HORS_PERIMETRE_RE`, mais ils montrent que le mot voyage avec le
droit. Et les deux de `special situations` comme celui de `bic bnc` sont
titrés **Senior** ou **Manager** : ils mourraient à `SENIOR_RE`.

Le gain réel est donc **au plus deux offres** — « Restructuring - Analyste »
(Eight Advisory) et « Stagiaire - Restructuring - janvier 2027 » (Grant
Thornton) — et non six. Les mots restent bons ; c’est leur rendement qui est
plus faible qu’annoncé.

Où poser : `FINANCE_MARKERS` dans `ingestion/classifier.js` (ligne 212). Ils
sont **déjà** dans les familles (lignes 268, 283, 528) — c’est bien le filtre
d’entrée qui leur manque. Écrire `bic bnc`, jamais `BIC/BNC` : après
`normalize()`, la barre oblique est un espace.

### 2. `fx` — MESURÉ, ET LA MESURE DIT NON

Le contre-test explicite du vocabulaire voisin :

```
ENTRE   « FX Trader »        ENTRE   « Artiste FX »
ENTRE   « Analyste FX »      ENTRE   « FX Artist »
ENTRE   « FX Sales »         ENTRE   « Technicien effets speciaux FX »
ENTRE   « Superviseur FX / VFX »   ENTRE   « Motion Design & FX »
```

**Les effets spéciaux entrent en bloc.** Aucun n’est dans la récolte
aujourd’hui — mais c’est exactement le mécanisme de « stress test », qui
avait fait entrer des ingénieurs de Safran, Airbus et Valeo.

En face, le gain est **une** offre : « Cash & FX Manager F/M » (Nestlé) — et
elle est titrée *Manager*, donc écartée par `SENIOR_RE` de toute façon.

**Verdict : ne pas poser `fx`.** Un mot qui ouvre un métier entier pour zéro
offre nette n’est pas un arbitrage difficile. À rouvrir seulement si une
source de marché arrive, et alors sous une forme bornée (`fx trader`,
`fx sales`, `analyste fx`), jamais `fx` seul.

### 3. `cash manager` — la paire adjacente est PROPRE, le gain est d’une offre

Les trois adjacents que Victor voulait au contre-test, même à zéro :

```
refuse  « Cash & Carry Manager »          refuse  « Chef de secteur Cash & Carry »
refuse  « Responsable Cash & Carry »      refuse  « Cash Management Officer »
ENTRE   « Cash Manager »                  ENTRE   « Store Cash Manager »
                                          ENTRE   « Caisse Cash Manager »
```

Le `&` survit à `normalize()`, si bien que « cash & carry manager » ne
contient pas « cash manager » : la grande distribution ne passe pas. **Zéro
« cash & carry » dans la récolte** aujourd’hui, ce qui ne prouve rien mais ne
contredit rien.

Ce qui passe en revanche : « Store Cash Manager » et « Caisse Cash Manager »,
des postes de caisse. Gain : **une** offre, « CASH MANAGER (F/H/X) » chez
Céline — un vrai poste de trésorerie.

**À trancher par Victor** : une offre gagnée contre un vocabulaire de caisse
ouvert. Moins net que `fx`, moins rentable que les trois mots.

### 4. Le compteur d’escalade — `DECISIONS.md` §39, décidé et non posé

**Le compteur n’incrémente que lorsque la SOURCE ne répond pas.** Quand elle
répond et que nos filtres écartent tout, le passage crie fort et n’escalade
jamais. La règle est écrite depuis le 07/09 au soir ; le code ne l’applique
pas.

À reprendre avec l’effet de bord découvert le 08/09 : **`--forcer` réarme le
compteur**, parce que le garde-fou compare une source à ce qu’elle rendait au
passage PRÉCÉDENT. Publier en forçant acte la baisse, et le lendemain la
source ne « passe » plus de dix à zéro — elle reste à zéro, ce qui n’est plus
une chute. Une source réellement morte deviendrait invisible. Les deux
touchent le même code.

### 5. `corpus-etiquetage.md` — 518 lignes jamais relues

Écrit le 07/09, jamais rouvert. Il mérite une séance à lui seul. À regarder
en premier : il est peut-être plus avancé qu’on ne le croit.

### Ce qui a été mesuré et refusé aujourd’hui, pour ne pas y revenir

- **Renault** — 201 offres au connecteur, 7 au catalogue, 2 ou 3 vraies, et
  `locationsText` absent chez ce tenant : elles sortiraient sans ville.
  Refusé au rendement.
- **`METIER_HORS_PERIMETRE_RE` et le mot « communication »** — 158 offres
  brutes nomment un métier de finance et sont bloquées par ce motif, mais la
  ventilation montre des refus **justes** : Avocat 25, Chef de projet 11,
  droit 9, SAP 8, Juriste 6, Achats 4, paie 3. Restent « Fiscalité » et
  « Tax » (~34), qui sont la question déjà en file, et un cas isolé chez
  Bouygues Telecom. **Chantier non ouvert.**

## Le 10 septembre — la mesure de référence du brassage

### Le chiffre, à garder comme point de comparaison

Le passage du 10/09 affichait **79 arrivées et 70 départs** là où celui du
09/09 en montrait 15 et 13 — cinq fois plus en un jour. L’explication
spontanée était « c’est la rentrée ». Elle était plausible, et à moitié
fausse.

Rapproché sur un triplet **employeur + intitulé + ville** (jamais sur
`canonicalKey`, qui était le suspect) :

| | | |
|---|---:|---:|
| catalogue | **1 047** offres | |
| arrivées réelles | **67** | 6,4 % |
| départs réels | **58** | 5,5 % |
| republications d’employeur | **12** | 1,1 % |

**C’est le premier point de comparaison dont on dispose.** Sans lui, le
prochain « 7 % » sera de nouveau jugé à l’intuition. Un brassage se compare
désormais à 6,4 %, et un écart franc se mesure avant de s’expliquer.

Les douze republications sont tranchées et closes : `DECISIONS.md` §41. Ni
`emp`, ni `loc`, ni `title`, ni `source` ne bougent — notre clé est stable,
c’est l’identifiant de l’employeur qui change.

### Un instrument de plus

**`ingestion/rotation-reelle.js`** — répond à « ce brassage est-il réel ? ».
Il sépare les vraies arrivées des offres revenues sous une autre adresse, et
nomme le champ qui a bougé : si `emp` ou `loc` en font partie, c’est NOTRE
clé ; si seule `url` bouge, c’est l’employeur qui a réémis.

```bash
node ingestion/rotation-reelle.js                  # les deux derniers passages
node ingestion/rotation-reelle.js <avant> <apres>  # deux commits précis
node ingestion/rotation-reelle.js --urls           # + comment chaque URL a changé
```

Ce n’est **pas un contrôle** : il ne bloque rien et ne tourne pas à 6h30. On
l’ouvre quand un brassage surprend. Sans argument, il prend de lui-même les
deux derniers passages automatiques.

### Le compteur mobile disait « 1k »

`chiffreCompact` abrégeait dès **mille**. Avec 1 047 offres,
`Math.round(1047 / 100) / 10` vaut **1** : le visiteur lisait « 1k offres »,
pas même « 1,0k ».

Débordement de la barre d’onglets, mesuré sur le site en ligne (≤ 0 = tient) :

| largeur | `1k offres` | `1 047 offres` | `1 047` |
|---:|---:|---:|---:|
| 375 | 0 | **0** | 0 |
| 360 | 0 | 14 | **0** |
| 344 | 0 | 30 | **0** |
| 320 | 36 | 54 | **17** |

Deux choses que la mesure a dites : le seuil devait être **dix mille** et non
mille — à 375 px quatre chiffres tiennent exactement —, et **c’est le mot
« offres » qui coûte la place, pas les chiffres**. Le nombre complet SANS le
mot est moins encombrant que l’abréviation AVEC : 17 px de débordement contre
36 à 320 px.

Corrigé : le nombre exact toujours, le mot se retire sous 375 px. Mieux
qu’avant à **toutes** les largeurs. À cinq chiffres il faudra refaire la
mesure — « 10 047 offres » débordait déjà de 7 px à 375 px.