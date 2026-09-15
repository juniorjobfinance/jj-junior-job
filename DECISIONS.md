# Décisions structurantes de JJ

`PROJET.md` dit ce qu'on veut construire. Ce fichier-ci dit **ce qu'on a tranché
en chemin, et pourquoi** — pour que les arbitrages survivent aux conversations
où ils ont été pris.

Une règle : on n'inscrit ici que ce qui ne se déduit pas du code. Le « comment »
est dans les commentaires du pipeline, le « pourquoi » de chaque correction est
dans son message de commit. Ce fichier ne garde que les choix de fond, ceux
qu'on risquerait de défaire par ignorance.

---

## 1. Moins d'offres, mais toutes justes

**Décidé le 01/09/2026.** Le catalogue est passé de 1 159 à 759 offres en une
journée, volontairement.

> « Je veux vraiment un site très propre quitte à avoir moins d'offres, c'est là
> la grosse plus-value. »

Ce qui a été retiré : les postes de plus de trois ans d'expérience, les métiers
hors finance, les annonces périmées, les liens qui ne mènent pas à l'annonce.

**Conséquence à connaître :** tout durcissement fait chuter le catalogue et
déclenche le garde-fou de publication (seuil 15 %). C'est normal. On publie
alors avec `--forcer`, jamais pour masquer une panne.

---

## 2. Le lien mène toujours à l'employeur

C'est le *moat* du site, énoncé au §2 du brief, et il commande plusieurs
décisions qui paraîtraient arbitraires sans lui.

**France Travail et La Bonne Alternance sont débranchés** (01/09/2026). Leurs
annonces renvoient vers un portail public, pas vers l'entreprise : sur 192
offres France Travail, 21 seulement portaient un lien direct.

**Mesure refaite le 02/09/2026**, à la demande de Victor, avant d'envisager de
les rebrancher pour gonfler l'alternance. Sur les huit plus gros bassins
d'emploi : 26 offres finance, dont une seule maison de finance (Natixis, déjà
branchée en direct). Le reste : mairies, commerces, associations. Et les « liens
directs » passent en réalité par des redirecteurs (`aplitrak.com`,
`mytalentplug.com`). **Conclusion : ne pas rebrancher.** Le levier pour
l'alternance est de brancher plus de maisons, pas d'ouvrir les vannes.

**Jamais de lien LinkedIn, Welcome to the Jungle, Indeed ou JobTeaser**, même
pour une offre repérée là-bas. On y repère, puis on suit « postuler sur le site
de l'entreprise », et c'est cette URL qu'on garde.

---

## 3. On ne contourne aucun pare-feu

Trois maisons sont hors d'atteinte et le resteront : **Bpifrance** (CloudFront
403 jusque sur son robots.txt), **Morgan Stanley** (tal.net), **Alvarez &
Marsal** (Cloudflare). Un robots.txt qui interdit, un WAF qui bloque : on
s'arrête.

À l'inverse, **KPMG interdit sa page de recherche mais publie son sitemap** :
on lit ce qu'ils offrent, on laisse ce qu'ils ferment. C'est la bonne lecture
d'un robots.txt, et elle a rapporté 18 offres.

---

## 4. Deux axes de classement, figés

**Décidé le 01/09/2026 :** « J'aime bien les familles de métiers et les familles
des entreprises, on reste sur ça, maintenant il n'y aura plus de changements. »

**12 familles métier** (+ un résidu tenu sous 5 %, aujourd'hui à 3 %) et
**11 types de structure**. Deux principes les gouvernent :

- une famille nomme un **métier**, un type de structure nomme un **employeur** ;
- **aucun libellé n'est partagé entre les deux axes**. Le métier s'appelle
  « Gestion d'actifs », l'employeur « Société de gestion ». Sans quoi on ne sait
  plus lequel des deux filtres on manipule.

Trois séparations sont volontaires et ne doivent pas être refondues :
capital-investissement ≠ gestion d'actifs, banque privée ≠ gestion d'actifs,
opérations ≠ data.

---

## 5. Le filtre 0-3 ans lit des durées, pas des mots

**Refondu le 01/09/2026.** L'ancienne logique était une liste noire : on
écartait « senior », « 5 ans d'expérience », « 3 à 5 ans ». Toute formulation
non prévue passait — « entre 3 **et** 5 ans » chez Sia Partners, « minimum 6 -
10 ans » chez Indosuez.

La logique est désormais inversée : on extrait **tous les nombres suivis d'ans /
années / years**, on vérifie qu'on parle bien d'expérience professionnelle, et
on écarte au-delà de trois ans. Une annonce peut écrire son exigence de mille
façons, elle finit toujours par un nombre.

Trois garde-fous, chacun payé par un faux positif observé :
au-delà de vingt ans c'est l'âge de la maison (« 145 ans d'expérience ») ; les
années d'études ne sont pas des années de poste (« Bac+5, 5 années d'études ») ;
le mot « expérience » doit être proche, sinon « 3 000 consultants depuis 48
bureaux » ferait sortir un stage.

**Le grade vaut la durée** (02/09/2026). Les banques d'affaires anglo-saxonnes
ne comptent pas en années, elles nomment un rang : Analyst → Associate → Vice
President → Director. **Analyst est junior, Associate ne l'est pas** (trois à
six ans, souvent post-MBA). Exception protégée : en conseil en stratégie,
« Junior / Summer / Graduate Associate » est un poste d'entrée.

---

## 6. Une date, ou une phrase honnête

Toute offre porte sa date de publication, ou dit franchement qu'on ne la connaît
pas — « toujours en ligne chez l'employeur, date de publication inconnue » — et
passe alors **en fin de liste**, jamais en première page.

Deux seuils d'âge, parce qu'ils ne recouvrent pas la même réalité :
**60 jours pour un CDI ou un CDD** (un poste à pourvoir est presque toujours
pris au bout de deux mois), **120 jours pour un stage, une alternance ou un
VIE** (les campagnes s'ouvrent des mois à l'avance — un « Summer Analyst 2027 »
se candidate dès l'automne 2026).

Le critère d'âge et le critère d'affichage sont **le même** : si la page montre
une date, le seuil doit pouvoir la juger. Les avoir laissés diverger avait
publié un stage Bank of America de huit mois et un poste Thales de 1 092 jours.

---

## 7. Chaque carte dit CDI ou CDD

L'onglet garde son nom « CDI · CDD », mais aucune carte n'affiche l'étiquette
double : on ne postule pas de la même façon à un CDD de six mois et à un CDI.

Ce qui reste sans mention est **réputé CDI**. Ce n'est pas un pari : la durée et
le motif d'un CDD sont obligatoires et toujours annoncés, parce que ce sont les
premières choses qu'un candidat regarde. Une offre à pourvoir qui ne dit rien de
son terme n'en a pas.

---

## 8. Le catalogue est automatique, les ajouts manuels sont l'exception

Les maisons branchées se mettent à jour seules : une offre publiée apparaît au
passage du lendemain, une offre retirée sort après **trois jours d'absence**
(la marge évite qu'une panne d'un matin vide le catalogue).

`manuel.js` ne sert qu'aux maisons dont le portail est fermé. **Deux règles :**
l'URL pointe vers le site de l'employeur, et l'offre a été vérifiée avant d'être
commitée.

Une offre saisie à la main ne meurt pas toute seule — elle est réinjectée depuis
le fichier à chaque passage. Son lien est donc **vérifié à chaque passage**,
sans attendre `--check-links`, et le pipeline signale celles qui sont mortes.

---

## 9. Quatre protections contre la panne silencieuse

Le 1er septembre 2026, cinq connecteurs ont renvoyé zéro depuis le runner
GitHub alors qu'ils répondaient normalement ailleurs. Un catalogue amputé de
28 % a été publié sans que rien ne l'annonce. D'où :

1. **reprise réseau** — trois tentatives avec délai croissant ;
2. **magasin de récoltes** — une source muette est resservie depuis sa dernière
   collecte, jusqu'à quatre jours ;
3. **rapport des sources muettes** — affiché à chaque passage ;
4. **garde-fou de publication** — refus d'écrire si le catalogue chute de plus
   de 15 %, ou si un connecteur qui servait dix offres ou plus tombe à zéro.

Et la correction de fond : une offre est retirée après **trois jours d'absence
réelle**, non après N passages ratés.

---

## 10. Un connecteur par plateforme, jamais par entreprise

Principe fondateur (§7.1 du brief) : on ne code pas un scraper par maison, on
code un connecteur par ATS. Une maison de plus est **une ligne de
configuration**.

Ce qui coûte n'est donc pas le code mais l'**identifiant** de la maison sur sa
plateforme — le « tenant » — souvent impossible à deviner : Deloitte est
`fina`, Michelin est `michelinhr`, la Banque de France est
`recrutement-banque-de-France`. Trois outils y répondent, du plus général au
plus fiable :

- `detect-ats.js` devine un identifiant public (Greenhouse, Lever, Ashby…) ;
- `detect-portails.js` teste SuccessFactors, TalentSoft et Phenom ;
- `sonder-carrieres.js` part du site carrières et lit la signature de la
  plateforme, en suivant au besoin le lien « Carrières » de la page d'accueil ;
- `valider-maisons.js` **vérifie avant de brancher** : il appelle le vrai
  connecteur et compte ce qui sort, lieux compris.

Cette dernière étape n'est pas optionnelle. Un sondeur se trompe de trois façons
observées : il suit un lien vers le **portefeuille** du fonds et non le fonds
(Alven renvoyait vers Concord, Sagard vers Portage) ; il prend un segment
d'URL pour un identifiant (« fr-FR » lu comme le site Workday de la Banque de
France, qui répond 404) ; il capte le domaine de la plateforme au lieu du client
(« www » et « app » lus comme des slugs Teamtailor). Une configuration fausse ne
casse rien : elle rend zéro offre **en silence**, et la maison paraît branchée.

Enfin, certaines API mentent par omission : **le portail Oracle de BPCE ignore
le paramètre `site`** — `CX_1`, `CX` ou un nom inventé renvoient le même
catalogue. Ajouter des entrées « pour voir » fait tourner le connecteur pour
rien.

---

## 11. Le meilleur canal de sourcing est humain

Le sondage automatique fonctionne sur les groupes internationaux (Workday,
Oracle) et rend peu sur les maisons françaises de taille moyenne, qui ont des
sites carrières maison sans API.

**Ce qui marche** : Victor repère une offre sur LinkedIn, ouvre le lien vers le
site de l'employeur, et l'envoie. L'URL contient le tenant. Sept maisons ont été
branchées ainsi le 02/09/2026 — Deloitte, Banque de France, KPMG, le portail
Lateral de Rothschild, Edmond de Rothschild, Scor, Ipsen — là où le sondage
aveugle en avait trouvé deux en une heure.

---

## 12. Demander ce qu'on veut, plutôt que tout puis trier

Trois maisons publiaient bien plus que ce qu'on en montrait, et chaque fois pour
la même raison : on lisait leur catalogue **entier** et on triait ensuite, alors
que leur moteur savait filtrer.

| Maison | Avant | Après |
|---|---|---|
| Crédit Agricole | 37 pages, tous métiers | 22 pages, 11 rubriques finance |
| BNP Paribas | 400 pages, monde entier | 45 pages, `country=7` |

Le coût n'est pas seulement en requêtes. Lire le monde entier sur 400 pages ne
garantit pas d'atteindre les 355 offres françaises : elles peuvent se trouver
au-delà. **Le filtre du site est donc une garantie d'exhaustivité, pas une
optimisation.**

Corollaire : leur taxonomie doit être RELEVÉE, jamais devinée. Chez le Crédit
Agricole, la rubrique la plus utile pour JJ s'appelle « Gestion des opérations »
— 93 offres de back et middle-office titres. Aucun nom de rubrique ne dit
« finance », et une liste inventée l'aurait manquée. Les identifiants se lisent
dans le balisage de leurs propres cartes (`data-gtm-jobCategory`).

---

## 13. Une exclusion se relit toujours dans une maison de finance

Le filtre écarte des métiers hors sujet par mot-clé. Quatre de ces mots ont été
mesurés faux le 02/09/2026, chacun coûtant des offres de premier plan :

- **`\bcap\b`** visait le diplôme CAP. Il écartait « Stage M&A **Large Cap** »
  chez BNP Paribas — et avec lui tout le M&A Large/Mid/Small Cap, c'est-à-dire
  le cœur de ce que le site existe pour montrer.
- **`quality analyst`** visait un ingénieur qualité industriel. Il écartait
  « Data Quality Analyst » chez Crédit Agricole CIB, métier junior courant de
  gouvernance de la donnée.
- **`data scien`** rangeait tout data scientist hors finance. Dans une banque
  de financement, il travaille sur les modèles de risque.
- **`^portzamparc`** visait les postes informatiques de la maison de bourse de
  BNP. Il emportait ses alternances d'assistant gérant et d'analyste.

La règle qui en sort : **avant d'ajouter un mot à une exclusion, se demander ce
qu'il veut dire chez un dépositaire, un courtier et une banque de financement.**
Si la réponse diffère, l'exclusion doit être qualifiée par son contexte, pas
posée seule.

Même logique pour le classement : « chargé d'affaires », « clientèle » et
« service clients » désignent le guichet chez LCL et le métier titres chez
CACEIS. Une règle de sauvetage, placée avant celles de l'assurance et du réseau,
reconnaît le vocabulaire de gros — transaction management, trade finance, OST,
investor services, clients institutionnels — que le guichet n'emploie jamais.

---

## 14. La porte d’entrée ne doit pas connaître moins de mots que le classement

Chez une maison de finance, une offre n’est collectée que si son intitulé porte
un mot de métier reconnu (`GENERIC_FINANCE_ROLE_RE`, dans `sources.js`). Cette
liste ignorait des mots que les règles de familles, dans `pipeline.js`, savent
pourtant ranger :

| Intitulé | Le classement le range | Le connecteur le jetait |
|---|---|---|
| Originateur Small Cap | Marchés financiers | oui |
| Chargé d’Opérations Émetteurs — OST | Opérations & Middle-office | oui |
| Equity Quant | Data & Quant | oui |

Mesuré le 02/09/2026 sur les rubriques finance du Crédit Agricole : 93 offres
écartées faute de vocabulaire, dont quinze de vrais métiers de marché. Les 78
autres — Directeur d’Agence, Négociateur Immobilier, Office Manager, Expert
Santé Publique — étaient bien écartées.

**Règle** : tout mot ajouté aux règles de familles doit exister aussi dans le
vocabulaire de collecte. Sans quoi le pipeline sait classer une offre qu’il ne
verra jamais. Le garde-fou reste entier : ce second régime ne s’applique qu’aux
maisons de finance, un « Originateur » chez un industriel reste dehors.

---

## 15. Le fourre-tout n’est pas une famille, c’est une porte

« Autres métiers de la finance » recevait toute offre qu’aucune règle de
famille ne savait ranger — et la PUBLIAIT. Rien ne vérifiait qu’elle parlait
de finance. Tant qu’on ne lisait que la catégorie finance des ATS, le défaut
restait invisible ; dès qu’on a pris toute la France chez Airbus, Thales et
Safran, il a débordé : le résidu est passé de 3 % à 26,7 % du catalogue, et
publiait des ajusteurs composite, des chaudronniers aéronautiques et des
ergothérapeutes.

**Règle** : une offre qu’aucune règle ne sait ranger n’entre que si elle passe
`isFinanceOfferFor` — c’est-à-dire si son intitulé parle finance de lui-même,
OU si l’employeur est une maison de finance et l’intitulé nomme un métier
plausible chez elle. Chez un dépositaire, « Business Coordinateur » est un
poste ; chez un avionneur, « Ajusteur Composite » n’en est pas un.

Le test reçoit aussi l’intitulé BRUT, car le nettoyage retire « Stage » et
« Stagiaire » — souvent le seul mot qui situe le poste.

Mesure : 349 offres au fourre-tout → 41, soit 26,7 % → 4,1 %.

---

## 16. Une maison branchée doit être inscrite, sinon elle ne publie rien

Une offre dont l’employeur n’est pas reconnu par `maisons.txt` est écartée par
`normalize` avant même d’être classée. Le connecteur tourne donc chaque matin,
et rien ne sort. Aucun message.

Le 2 septembre, soixante-cinq maisons étaient dans ce cas — Euronext y perdait
ses 24 offres parisiennes, dont un stage M&A. Le même soir, EDF a été branché
et l’erreur immédiatement répétée : 1 620 offres lues, aucune publiable.

`controle-avant-passage.js` compare désormais les maisons configurées à la
liste de référence et nomme les orphelines. **Brancher un connecteur et
inscrire la maison sont un seul geste, pas deux.**

---

## 17. Mesurer le rendement avant de garder une source

Seize start-ups technologiques étaient branchées de longue date. Avant de les
inscrire, on a mesuré : 34 offres collectées, 9 franchissant les filtres de
titre, et ces neuf étant « Head of International Accounting », « Chief
Operations Officer », « Senior Payment Operation Analyst », « Confirmed
Product Analyst » — du senior ou du non-finance, que le filtre 0-3 ans écarte
ensuite. Seize requêtes chaque matin pour zéro ou une offre publiable.

Débranchées. `ingestion/rendement.js` existe pour poser cette question à
toutes les sources en une collecte : combien elle collecte, combien elle
publie, et lesquelles ne publient rien.

**Le critère n’est pas « est-ce une belle maison ? » mais « qu’est-ce qu’elle
rend ? »** — mesuré, pas supposé. EDF est resté malgré un rendement faible
(16 offres pour 162 pages) parce que le passage tourne la nuit, où le temps
n’est pas rare ; les seize start-ups sont parties parce qu’elles ne rendaient
rien du tout.

---

## 18. La règle des 120 jours ne se desserre pas, même pour une belle offre

**Le 3 septembre 2026.** Victor a envoyé une offre précise — « Internship |
Risk Analyst », GIE AXA, Paris, RISK MANAGEMENT, req 19942 — en demandant si le
site l'avait. Il ne l'avait pas, pour deux raisons distinctes.

La première était une panne, corrigée : la pagination Phenom tournait à vide et
AXA ne servait que 100 de ses 560 offres.

La seconde n'en est pas une. Cette offre a été publiée le **23 avril 2026**,
soit **132 jours** avant, et `MAX_AGE_JOURS_ATS_DIRECT` coupe à 120 jours même
chez l'employeur. Elle est donc collectée, puis écartée.

La tentation était de desserrer le seuil pour les stages, puisque l'annonce est
toujours en ligne chez AXA. On ne l'a pas fait. Une annonce de quatre mois et
demi est presque toujours pourvue ou abandonnée — le recruteur ne l'a
simplement pas dépubliée. Publier ces annonces-là, c'est exactement le défaut
qui rend les grands agrégateurs inutilisables, et c'est ce que la règle
« moins d'offres, mais toutes justes » interdit.

Réponse de Victor, qui tranche : « parfait les filtres marchent bien. je nai
pas check la date ».

**Le seuil reste à 120 jours (60 pour les CDI/CDD).** Une offre absente parce
qu'elle est vieille n'est pas un défaut du site, c'est son intérêt.

---

## 19. La sécurité informatique n'est pas la sécurité financière

**Le 3 septembre 2026.** En rendant visible tout le catalogue d'AXA, quatre
postes de cybersécurité sont remontés : « Red Team Analyst », « Security
Assurance Officer », « Backup Engineer Analyst », « Security Risk Assessment
Analyst ». Le dernier se rangeait dans **Risques & Conformité** — la famille du
risque financier — où un candidat ne peut pas voir qu'il s'agit d'informatique.

Ils passaient parce que `NON_FINANCE_RE` connaissait « cyber » et « sécurité
informatique », mais aucun intitulé anglais.

Le piège, en écrivant ces exclusions : **« sécurité financière » est un vrai
métier de la finance** — LCB-FT, KYC, lutte anti-blanchiment. Un motif large
sur « sécurité » aurait emporté tout un pan du catalogue conformité. Les termes
ajoutés nomment donc toujours la sécurité INFORMATIQUE (« security analyst »,
« security assurance », « red team », « pentest »), jamais la sécurité seule.

Éprouvé avant d'être écrit, sur les 1006 offres publiées : **zéro écartée à
tort**, et « Chargé de Sécurité Financière », « Analyste Sécurité Financière
KYC » et « Securities Services » restent tous retenus. C'est l'application
directe de la §13 — une exclusion se relit toujours dans une maison de finance.

---

## 20. Une pépite, ce sont trois conditions obligatoires, pas un score

**Décidé le 03/09/2026.** Le bandeau « Pépites JJ » sélectionnait jusqu'à huit
offres par onglet (32 au total), sur un score cumulatif où dépasser un seuil de
4 points suffisait — un poste rare (M&A, PE, trading…) chez une maison
inconnue, ou un poste banal chez une maison prestigieuse, franchissait le
seuil sans être une vraie pépite.

> « les pepites j en mettrais que 5 a chaques fois sur vraiment ce que s arrache
> les plus gros etudiant » — puis, en précisant : « des trucs recents, enorme
> maison » et « egalement enorme poste que les gens s arrachent ».

Trois critères sont devenus **obligatoires** dans `choisirPepites()`
(`ingestion/pipeline.js`), plus aucun n'est un simple bonus de score :

1. **Une énorme maison** — dans `MAISONS_PRESTIGE`, ou (pour le VIE
   spécifiquement) un grand groupe reconnaissable via `GRANDE_STRUCTURE_RE`.
2. **Un poste que tout le monde se dispute** — le titre doit matcher
   `POSTE_RARE_RE` (M&A, private equity, trading, capital markets…).
3. **Une offre récente** — publiée il y a 21 jours maximum
   (`PEPITE_FRAICHEUR_JOURS`), sur `_postedAt` ou, à défaut, `_firstSeenAt`.

Cinq pépites au total, **tous onglets confondus** — pas une vitrine équilibrée
par onglet comme avant. Une seule par maison. Le score ne sert plus qu'à
classer les candidats qui remplissent déjà les trois conditions.

**Conséquence à connaître :** un jour sans offre récente chez une maison de
prestige sur un poste rare, le bandeau peut afficher moins de 5 pépites, voire
se masquer. C'est voulu — la règle §1 (moins d'offres, mais toutes justes)
s'applique aussi ici : mieux vaut 2 vraies trouvailles que 8 remplissages.

---

## 21. Le classement se fait au score de spécificité, plus au premier motif

**Décidé le 03/09/2026**, refonte menée avec Claude chat, branchée sur la
branche `refonte-classification`. Quatre défauts de l'ancien `FAMILLE_RULES`
l'ont motivée, tous mesurés sur les 998 offres publiées :

1. « La première règle qui matche gagne » créait des vols d'ordre : Marchés
   volait le middle/back office, Trésorerie volait le risque de crédit.
2. L'exclusion de la banque de détail était la DERNIÈRE règle, donc presque
   jamais appliquée.
3. Aucune règle n'exigeait un contexte finance : `business analyst`, `pmo`,
   `audit`, `data scientist` matchaient seuls, faisant entrer Dior
   Merchandising, Veolia PANGEO, SNCF Data Analyst — environ 14 % du catalogue.
4. « Autres » servait de repli silencieux.

Ce qui remplace, dans cet ordre strict : **pré-filtre** (retail, support, hors
domaine) → **porte finance** (pour les employeurs non financiers, l'intitulé
doit porter un marqueur) → **famille au score de spécificité** (`risque de
crédit` à 9 bat `crédit` à 2) → **résidu audité**, qui sort en `unclassified`
et va dans un fichier, jamais dans « Autres ».

**Trois choix de fond à ne pas défaire :**

- **L'ESG est un tag, pas une famille.** Les offres durables sont dans l'asset
  management, le DCM, l'audit et le private equity ; en faire une famille
  viderait les autres. Deux autres tags cumulables : `real-assets`,
  `international`.
- **Deux familles ajoutées** — « Actuariat & Assurance technique » et
  « Financements & Coverage ». Vingt offres d'actuariat étaient dispersées
  entre quatre familles ; une trentaine d'offres de coverage et de financements
  structurés étaient éclatées entre Marchés, M&A et Contrôle de gestion.
- **La structure vient de l'EMPLOYEUR seul**, jamais de l'intitulé.
  `structures.js` fait autorité ; l'ancien `inferSector` déduisait des deux et
  rangeait des offres BNP en « Banque de détail » alors qu'elles sont en BFI.

**Les libellés affichés n'ont pas changé.** Six des onze libellés de structure
étaient reformulés par la refonte ; ils ont été ramenés à l'identique de ce que
le site affiche déjà. Un visiteur n'a aucune raison de voir ses repères bouger
pour une réécriture interne.

Mesure : **998 → 847 offres**, dont 151 écartées à raison. Le garde-fou des
15 % se déclenche : c'est attendu, on force à la main.

---

## 22. Un contrôle qui échoue à tort est pire qu'un contrôle absent

**Le 03/09/2026.** `controle-avant-passage.js` extrayait le script de la page
avec un motif exigeant `<script>\n`. Sur une copie de travail Windows, où les
fichiers sont en CRLF, le motif ne correspond plus : le contrôle échouait sur
une page parfaitement saine, à chaque passage.

Un contrôle qui crie au loup sur une machine entière est un contrôle qu'on
apprend à ignorer — et le jour où il a raison, personne ne l'écoute.

C'est exactement le mécanisme qui a laissé passer la deuxième violation de
§16 : la maison branchée mais non inscrite était signalée en **alerte**, pas en
échec. Une alerte se lit et s'oublie. Les deux contrôles de maisons sont donc
passés en ÉCHEC, et le motif du script tolère désormais `\r?\n`.

**Corollaire, appris le même soir :** un contrôle doit porter sur ce qui S'EST
PASSÉ, pas seulement sur ce qu'on croit avoir configuré. Le contrôle des
maisons orphelines était statique — il comparait les `emp` déclarés dans
`sources.js` à `maisons.txt` — et il affichait « les 162 maisons branchées sont
toutes inscrites », ce qui était vrai. Il ne pouvait pas voir la récidive,
parce qu'un connecteur sert souvent des employeurs sous un autre nom que le
sien : `opendatasoft:bpce` rend « BPCE Vie » et « BPCE IG », jamais « Groupe
BPCE ». Un second contrôle, **observé**, lit désormais le relevé de la dernière
collecte.

### Un contrôle ne se vérifie qu'en le faisant échouer

**Le 03/09/2026**, en éprouvant le contrôle des deux tables (§24). Premier
essai : retirer Mutuelle Saint-Christophe et Bank of America de
`structures.js` pour voir le contrôle rougir. **Il est resté vert** — et il
avait raison : ces deux employeurs ne sont pas dans `maisons.txt`, donc la
condition « accepté par l'une, absent de l'autre » ne se déclenchait pas. Le
test passait pour la mauvaise raison, et ne prouvait rien.

Il a fallu chercher un sujet remplissant les trois conditions à la fois —
présent dans `maisons.txt`, présent dans `structures.js`, et servant des
offres — pour que l'échec soit réel. Deloitte et Eurazeo ont fait l'affaire.

**Choisir le sujet d'un test fait partie du test.** Un garde-fou qu'on n'a
jamais vu échouer n'est pas un garde-fou vérifié : c'est du code qu'on espère
juste. Lire le code ne suffit pas, il faut provoquer la panne, lire le
message, puis restaurer et vérifier le retour au vert.

Corollaire pratique, appliqué le même soir : **le message d'échec doit nommer
la correction**, pas constater l'écart. « 2 employeurs absents de
`structures.js` » oblige à ouvrir le fichier, comprendre le format de la clé et
deviner l'identifiant. La ligne prête à coller, avec le nombre d'offres en jeu
et la liste des valeurs admises, se répare en trente secondes. Un contrôle qui
constate se contourne ; un contrôle qui prescrit se répare.

---

## 23. La séniorité se lit aussi sur les stages, avec une liste étroite

**Le 03/09/2026**, découvert en dépouillant l'échantillon des 880 offres sans
famille. `passesJuniorFilter` sortait à sa deuxième ligne pour les stages, les
alternances et les VIE :

```js
if (volet !== 'cdi-cdd') return true; // stage/alternance = junior par nature
```

C'est vrai en droit, mais **ça suppose que le type de contrat a été lu**. Il est
*deviné* dans sept familles de connecteurs. Un « Comptable Général Senior »
deviné en VIE passait donc sans que son intitulé soit jamais regardé — et il
l'était : 14 offres publiées portaient un marqueur de séniorité, **toutes dans
ces trois onglets, zéro en CDI·CDD**, où le filtre s'applique et fonctionne.

**La liste appliquée à ces trois onglets est ÉTROITE, et c'est mesuré.** Sur les
847 offres de la collecte de contrôle :

| Liste | Écartées | Dont à tort |
|---|---|---|
| Large (15 mots, dont manager / responsable / expert / lead) | 14 | **11** |
| Étroite (grades seuls) | 3 | **0** |

La raison est linguistique : en finance française, **« manager », « responsable »,
« expert » et « lead » nomment une ÉQUIPE ou un OUTIL** dans un intitulé junior,
pas un grade. « Data Manager Reporting » est un stage chez Rothschild, « Expert
en Finance Durable » un stage chez Natixis, « Portfolio Manager » un VIE chez
ENGIE. Ne restent donc que les mots qui ne peuvent nommer qu'un grade : senior,
sénior, VP, vice president, director, directeur, head of, confirmé, expérimenté,
partner, principal.

Neutralisateurs : `summer`, `graduate`, `junior`, `apprenti`, `alternant`, et
`assistant` — « Assistant Responsable Comptable » est bien un assistant.

**Une exception a été proposée puis écartée** : « senior analyst reste junior en
banque d'affaires ». En France c'est plus souvent un profil expérimenté qu'un
grade d'entrée, et l'enjeu total étant de trois offres, l'exception ajoutait du
risque pour rien.

**Conséquence à connaître :** le VIE est l'onglet le moins protégé du site — il
échappe aussi à la règle `maisonRef` (§16), et 15 % de ses offres portaient un
marqueur de séniorité contre 2 % pour les stages. Un durcissement le touche donc
plus fort que les autres, et c'est normal.

---

## 24. Deux tables, deux portes : inscrire dans l'une ne sert à rien sans l'autre

**Découvert le 03/09/2026** en ajoutant les alias de filiales.

`maisons.txt` et `structures.js` ne font pas le même travail, et la nuance a
coûté une correction incomplète :

- **`maisons.txt` décide si l'offre ENTRE au catalogue.** Un employeur qu'il ne
  reconnaît pas est écarté par `normalize` (§16).
- **`structures.js` décide de quelle STRUCTURE elle relève.** Un employeur
  absent de cette table renvoie `null`, ce qui déclenche la **porte finance**
  du classifieur — et l'offre est rejetée en
  `gate:employeur-absent-de-structures`.

**Conséquence :** une filiale inscrite dans le seul `maisons.txt` franchit la
première porte pour tomber sur la seconde. Les huit premières filiales ajoutées
ce soir — les quatre LVMH, Direct Assurance, GIE AXA, Socfim, ONEY — étaient
dans ce cas. **Ajouter un employeur, c'est l'ajouter aux DEUX.**

### Le contrôle est étroit, et c'est délibéré

`controle-avant-passage.js` échoue désormais si un employeur **vu à la
collecte** est accepté par `maisons.txt` sans avoir de structure.

Il aurait été tentant de contrôler toutes les maisons de référence. Mesuré :
**93 des 206 (45 %) n'ont pas de structure.** Un échec là-dessus rendrait le
contrôle rouge dès le premier jour, et on apprendrait à l'ignorer — exactement
le mécanisme du §22. Or ces 93 sont pour l'essentiel des maisons qui ne servent
rien : Morgan Stanley derrière son pare-feu, UBS sur Taleo, Bain en JavaScript.
Le piège ne mord que sur une maison qui publie vraiment.

Le contrôle vaut donc zéro aujourd'hui, et rougira le jour où quelqu'un ajoutera
une maison sans sa structure. Les 93 dormantes sont affichées en information,
comme liste de travail.

### Une fausse bonne idée, essayée et annulée

Faire retirer « groupe », « la », « le » en tête par `normalizeEmployer`, comme
le fait déjà `maisons.js`. Essayé : **« Groupe BPCE », « La Banque Postale » et
« Groupe Crédit Coopératif » sont tombés à `null` d'un coup**, parce que leurs
CLÉS portent elles-mêmes le préfixe et que la résolution se fait par préfixe le
plus long. Les filiales s'inscrivent donc une par une, avec leur préfixe s'il y
en a un. Plus verbeux, plus sûr.

**Corollaire vérifié le même soir :** la résolution par préfixe le plus long
crée aussi des collisions silencieuses. « Natixis Investment Managers » tombait
sur `natixis` et devenait BFI au lieu de société de gestion ; « Crédit Agricole
Assurances » tombait sur `credit agricole` et devenait banque de détail.
`verif-structures.js` couvre ces cas — 28/28.

---

## 25. Le filtre juge sur le texte entier, et on le vérifie

**Le 03/09/2026.** Trois défauts de la même famille sont apparus en une soirée,
tous invisibles :

1. La description était **tronquée à 3 000 caractères** avant analyse. Or
   l'exigence d'expérience vit dans le « profil recherché », donc à la fin :
   les mentions relevées tombaient aux positions 3437, 3509, 4495 et 6217.
   Aucune visible avant la coupe — zéro sur quatre.
2. La coupe corrigée, une **nouvelle limite à 4 000** reproduisait le défaut un
   cran plus loin : « Superviseur Contrôle Financier » porte son exigence à
   4302.
3. Le verdict était calculé dans `normalize()`, donc **avant le rattrapage des
   fiches**. Pour 673 offres enrichies, il portait sur le texte du connecteur —
   souvent vide.

**À chaque fois, le filtre a jugé sur une entrée incomplète sans se plaindre.**

### Ce qui remplace

`verdictSenioriteDescr` lit le texte **entier** et rend `_expMax`,
`_formuleSeniorite`, `_vetoJunior`. Il est recalculé **partout où la
description change** — à la normalisation, après le rattrapage des fiches, et
restauré tel quel depuis le cache. **La troncature ne sert qu'au stockage de
`_descr`, jamais à l'analyse.**

Mesure avant bascule, sur 305 CDI·CDD : **7 offres écartées en plus, 0 dans
l'autre sens**, toutes avec une description de plus de 4 000 caractères — dont
le « Banquier Conseil Real Estate Advisory » à « 6 - 10 ans » que les
commentaires du code citaient déjà comme resté en ligne.

L'ancien chemin — `dureesExperienceCitees`, `DESCR_SENIOR_RE`,
`DESCR_JUNIOR_RE` et leurs auxiliaires — a été supprimé **dans le même
commit**. Deux chemins qui coexistent, personne ne sait lequel décide, et on se
croit protégé par une mesure inerte.

### Le contrôle porte sur l'invariant, pas sur les trois causes

Contrôler les trois causes une par une garantit seulement qu'on attrapera la
quatrième après coup. Le point commun est ailleurs : **le verdict a-t-il été
rendu sur la description finale ?**

Chaque verdict porte donc `_verdictSur`, la longueur du texte analysé. Avant
publication, toute offre CDI·CDD dont `_verdictSur` est inférieur à la longueur
de `_descr` **annule la publication**, avec le compte et un exemple.

Éprouvé le soir même : sur un cache antérieur à ces champs, le contrôle a
bloqué 368 offres dont le verdict portait sur 0 caractère pour une description
de 8 630. C'est précisément le cas qu'on ne voyait pas.

### Ce que cet invariant ne peut PAS voir

Il compare la longueur ANALYSÉE à la longueur STOCKÉE. Il attrape donc toute
amputation survenue **entre les deux** — une troncature avant analyse, une
fiche arrivée après le verdict, un recalcul rendu trop tôt.

**Il est aveugle à une amputation survenue AVANT les deux.** Quand un
connecteur coupe la description à 3 000 caractères, le verdict et la
description finale font tous deux 3 000 : aucun écart, donc rien à signaler.
C'est exactement le cas trouvé le 04/09/2026 dans `sitemapld` et
`smartrecruiters` — 87 offres, découvertes en lisant une annonce à la main,
pas par un contrôle.

La parade n'est pas un invariant de plus, c'est la règle du §26 : aucun
connecteur ne borne ce qu'il envoie à l'analyse ; seul le stockage est borné.

---

## 26. Ne jamais stocker une valeur dérivée quand on peut stocker son entrée

**Tranché le 04/09/2026, après sept occurrences du même défaut en une nuit.**

Une valeur dérivée figée ne suit ni les corrections du code, ni les
changements de sa source. Elle continue d'affirmer ce qui était vrai au moment
où on l'a écrite, sans que rien ne le signale — c'est ce qui la rend si
coûteuse : elle n'échoue jamais, elle se trompe.

**Le cache garde le TEXTE ; le verdict se recalcule.**

Les sept occurrences sont la même erreur sous sept déguisements :

1. la description tronquée à 3 000 caractères avant analyse ;
2. la même à 4 000, une fois la première corrigée ;
3. le verdict calculé dans `normalize()`, donc avant le rattrapage des fiches ;
4. le cache rangeant l'extrait borné au lieu du texte entier — 72 rejets de
   séniorité au rejeu contre 181 en direct ;
5. le recalcul post-rattrapage repartant de l'extrait, donc capable
   d'*affaiblir* un verdict déjà rendu ;
6. le cache rangeant le VERDICT à côté du texte : après correction du garde-fou
   du diplôme, le rejeu rendait encore les `null` de la veille — cache
   `expMax=null`, recalcul `expMax=10`, sur le même texte de 6 213 caractères.
   Un rejeu sert à éprouver le code d'aujourd'hui ; celui-là certifiait la
   version de la veille ;
7. mes propres scripts de mesure, qui recopiaient un seuil (120 au lieu de 60)
   ou bridaient l'entrée de l'ancien code à 4 000 caractères.

**Trois conséquences pratiques, toutes appliquées :**

- Le cache de collecte ne stocke plus que le texte. Le verdict de séniorité est
  recalculé au rejeu, ce qui n'était pas possible tant que le cache ne gardait
  qu'un extrait : c'est la correction 4 qui a rendu la 6 possible.
- Quand une dérivée doit malgré tout voyager avec l'offre, elle se **fusionne**
  au lieu d'être remplacée : `fusionnerVerdictSeniorite` prend la plus forte
  exigence, jamais la dernière calculée. Un texte supplémentaire ne peut
  qu'ajouter des indices.
- **Aucun script d'analyse ne contient de limite chiffrée en dur.** Il importe
  la constante du pipeline — l'atelier les expose — ou il n'en met aucune. Un
  nombre recopié ne suit jamais le pipeline : `controle-avant-passage.js`
  portait `? 60 : 120` et aurait certifié « aucune offre périmée » en mesurant
  un seuil abandonné. Un garde-fou qui se trompe est pire que pas de garde-fou.

**Le corollaire de nommage** (même date) : `_descr` contenait un extrait
tronqué et son nom laissait croire qu'il contenait la description. Chaque fois
que quelqu'un l'a pris pour source d'une analyse, le défaut est réapparu. Il
s'appelle désormais `_descrExtrait`, et le texte entier `descrComplet`. Un
nom juste rend l'erreur impossible à commettre là où un commentaire ou un
contrôle ne fait que la rattraper après coup — même leçon que la règle
« tout script passe par Write ».

---

## 27. On bloque quand publier serait mentir, on signale quand ce serait incomplet

**Tranché le 04/09/2026, au premier passage réel des garde-fous.**

Les contrôles avaient tous été mis au même rang : un rouge, et rien n'est
publié. Le premier passage sur GitHub a échoué au bout de onze minutes — non
parce que le catalogue était faux, mais parce que **18 employeurs nouveaux
avaient servi 29 offres sans figurer dans `maisons.txt`**. Le catalogue
produit était juste ; il lui manquait 29 offres sur 950.

Bloquer ne récupère pas ce qui manque. Ça retire seulement ce qui est juste.

Et comme des noms d'employeurs nouveaux apparaissent presque chaque jour, ce
garde-fou aurait arrêté la publication presque chaque matin. On n'aurait pas
gagné un catalogue plus sûr : on aurait fabriqué une alerte quotidienne qu'on
apprend à ignorer — le défaut du §26 déplacé d'un cran, de la donnée vers
l'attention.

**BLOQUENT** — publier serait mentir :
cohérence des deux axes (le filtre du site ne retrouverait aucune offre),
fuite d'un champ interne dans le catalogue servi, offre au-delà de son seuil
d'âge, date non ISO, invariant de séniorité, garde-fou de collecte incomplète,
et toute erreur de syntaxe.

**SIGNALENT** — publier serait incomplet, jamais faux :
maisons vues et non inscrites, employeurs sans structure, maisons de référence
qui ne servent rien.

Ce qui signale ne doit pas pour autant s'évaporer : une issue distincte,
« Maisons à inscrire », est tenue à jour **même sur un passage vert** —
commentée quand la liste change, refermée quand elle est vide. Un signal sans
destinataire est un signal perdu, et c'est ce qui avait justifié de tout
bloquer.

---

## 28. Un correctif se mesure sur ce qu'il change, pas sur ce qu'on en attendait

**Écrit le 04/09/2026, après une prévision fausse.**

Le résidu sans famille contenait des intitulés mutilés par le nettoyage :
« Stage 4 à 6 mois - Assistant exploitation bancaire » devenait
« 4 à - Assistant exploitation bancaire ». Une règle retire le mot de contrat,
une autre une partie de la durée, et le reste demeure.

L'attente était explicite : réparer le nettoyeur devait **récupérer des
offres**, puisqu'aucun motif ne peut reconnaître un métier derrière « 4 à - ».

**Mesuré à entrée identique, il n'en récupère aucune.** 959 → 958 offres,
résidu sans famille 446 dans les deux cas. La raison tient en une phrase : ces
intitulés étaient **déjà classés malgré la mutilation**, parce que
« (1 an) - Fiscaliste Junior » contient encore le mot « Fiscaliste ». Le
préfixe parasite gênait la lecture, pas la reconnaissance.

Ce que le correctif répare est donc autre chose, et vaut d'être gardé pour
cette raison-là : **ce que le candidat lit sur la carte**. Neuf titres au
catalogue, dont sept Natixis en « 2 ans - X ». Plus une fusion juste — deux
annonces du même poste devenues identiques une fois nettoyées.

Le travail de taxonomie, lui, a été fait par le classifieur : combler le trou
ESG et ajouter les motifs de relation client institutionnelle a fait passer le
résidu de 457 à 446, le stage de 57 à 48 et l'alternance de 40 à 38. C'est là
qu'était le gisement, pas dans le nettoyage.

**La règle :** on garde un correctif pour l'effet qu'il a, pas pour celui qu'on
lui prêtait — et on le dit quand les deux diffèrent. Annoncer le gain espéré
comme s'il était mesuré, c'est fabriquer un chiffre qui servira de base à la
décision suivante.

### Le corollaire : un seuil de test est un plafond, et il se rabaisse

`test-fourre-tout.js` échoue si le résidu dépasse **8**, son niveau connu du
04/09/2026. Ce n'est pas une égalité mais un plafond : si le résidu remonte,
c'est qu'une règle a été perdue ou affaiblie, et le passage bloque.

S'il descend, il faut **baisser le seuil dans la foulée**. Un plafond qu'on ne
rabaisse pas cesse de mordre en silence : à 8 pour un résidu réel de 3, il
laisse passer un retour à 8 sans rien dire. C'est le défaut du §27 sous une
autre forme — un garde-fou qui ne garde plus rien, et dont on croit être
protégé.

---

## 29. Un champ absent ne rend pas une erreur, il rend zéro — et zéro se lit comme un résultat

**Écrit le 04/09/2026, après trois occurrences dans la même nuit.**

Quand une sonde lit un champ qui n'existe pas, rien ne proteste. `undefined`
devient `null`, une liste vide devient `0`, une recherche sans résultat rend
« aucun ». La sonde répond, et sa réponse a l'apparence d'une mesure.

C'est ce qui la rend pire qu'un plantage : **un plantage se voit, un zéro se
cite.**

Les trois de la nuit :

1. **Le registre des écartées enregistrait `raw.url || null`.** Le connecteur
   Business France ne fournit aucune url — il la construit depuis `id`. Les 51
   rejets VIE sur 54 partaient donc avec `url: null`, et devenaient
   introuvables. Le registre ne signalait rien : il contenait bien 54 lignes.

2. **Ma sonde cherchait les VIE perdus dans la collecte** en lisant `url`,
   `absolute_url`, `hostedUrl`. Aucune de ces clés n'existe chez ce
   connecteur. La sonde a trouvé zéro correspondance et j'ai conclu « la source
   ne les sert plus ». **C'était l'inverse exact de la vérité** : 42 des 43
   étaient dans la collecte, écartées par nos portes.

3. **`gh issue list --jq '.[0].number'` sur une liste vide imprime « null »**,
   pas rien. Le test `[ -n "$N" ]` qui suivait était donc vrai quand aucune
   issue n'existait, et l'étape aurait lancé `gh issue close null` — c'est-à-
   dire échoué le premier matin où tout va bien.

C'est la même famille que la description tronquée et que le verdict mis en
cache (§26) : **une décision rendue sur une entrée incomplète, sans que rien ne
le signale.** Ici l'entrée n'est pas amputée, elle est absente — et l'absence
se présente comme une valeur.

**La règle : une sonde doit prouver qu'elle a lu quelque chose avant qu'on lise
sa réponse.** En pratique, trois gestes :

- **Compter ce qu'on a trouvé, pas seulement ce qu'on cherche.** Ma sonde
  extrayait 5 999 urls pour 6 830 offres brutes. L'écart de 831 était affiché
  et je ne l'ai pas lu — il disait à lui seul qu'un connecteur entier
  manquait.
- **Lire la valeur normalisée, pas la source brute**, quand le pipeline en
  produit une. `url` était dans la portée vingt lignes plus haut, utilisée par
  `estExclue(url, emp)`. Le registre lisait `raw.url` alors qu'il avait la
  bonne valeur sous la main.
- **Un zéro inattendu se vérifie avant d'être publié.** « Zéro VIE dans la
  collecte » aurait dû me faire ouvrir la photo, pas rédiger une conclusion.

Corollaire de nommage, déjà appliqué au §26 : une garde d'idempotence doit
porter sur un marqueur **propre au bloc qu'elle protège**. Celle qui cherchait
« sans structure » a trouvé cette tournure dans un autre message du même
fichier, et a sauté l'écriture en silence.

---

## 30. Ce qui entre au catalogue : produire ou analyser de l'information financière

**Tranché le 04/09/2026, après un audit des 956 offres publiées.**

Trois arbitrages ont été rendus le même soir — sinistres dehors, souscription
dedans, audits de systèmes dehors — et les trois auraient été re-tranchés dans
trois semaines, probablement dans l'autre sens, si l'on n'avait gardé que la
liste des cas. La règle qui les relie :

**Un métier entre au catalogue s'il PRODUIT ou ANALYSE de l'information
financière. Il n'y entre pas s'il traite des dossiers, s'il vend un produit,
ou s'il porte sur un système d'information.**

Les trois cas, relus à cette aune :

- **La souscription reste.** Un souscripteur junior tarife et analyse un
  risque : il produit de l'information financière. C'est le poste voisin de
  l'actuaire.
- **Les sinistres sortent** (17 offres), et **la gestion de contrats aussi**
  (9). Régler un sinistre, c'est appliquer un barème à un dossier. Rien n'est
  produit ni analysé.
- **Les audits de systèmes sortent** (8). Un candidat qui clique sur « Audit &
  Contrôle interne » cherche de l'audit financier ; lui servir de l'audit de SI
  lui fait perdre son temps au clic et à l'entretien. Exception nommée :
  « transformation SI/Finance » porte sur la fonction finance elle-même.
- **La distribution d'assurance sort** (11). « AXA Prévoyance & Patrimoine »
  est le nom d'un réseau d'agences, pas d'un métier — le mot « patrimoine »
  n'exempte plus que lorsqu'il nomme le métier.

### Qui est le sujet, qui est le décor

« Un métier n'entre pas s'il porte sur un système d'information » ne tranche
pas les cas limites, et la première relecture le montre. Le test n'est pas
« y a-t-il de l'informatique dans ce titre » — il y en a dans les deux
colonnes. Le test est **qui est le sujet** :

| le système est le sujet, la finance est le décor | la finance est le sujet, le système est l'outil |
|---|---|
| « Business Analyst » | « Consultant Fonctionnel ERP Oracle / **Finance** » |
| « Assistant PMO » | « Consultant en transformation **SI/Finance** » |
| « Agile Business Analyst » | « PMO **monnaie numérique de banque centrale** » |
| « Business analyst MOA et testing » | « **Post trade** Business Analyst » |
| « audit des systèmes d'information » | « Business Analyst **Lutte Anti Blanchiment** » |

En pratique : un intitulé générique de projet ou de système sort, **sauf s'il
nomme la finance** — et « nommer la finance » se juge avec `hasFinanceMarker`,
la définition que la porte finance emploie déjà, jamais avec une liste écrite à
côté. Une liste faite à la main pour l'occasion a rejeté **159 offres au lieu
de 7** le 04/09/2026, dont une vingtaine de Business Analysts de marché chez
Talan : elle ignorait « capital market », « front office », « post trade » et
« asset management ».

### Le test d'un motif : nommera-t-il encore un métier dans six mois ?

La règle qu'on s'était donnée — « pas de motif pour une offre unique » —
compte le mauvais objet. Elle aurait interdit `fiscal`, qui nomme une
discipline et ne portait que deux offres ce jour-là, et autorisé n'importe
quelle chaîne fréquente sans signification, du type « Junior AI Adoption ».

**Le bon test ne dépend pas du volume du jour : un motif se juge sur ce qu'il
NOMME.** Nomme-t-il un métier, une discipline, un instrument — quelque chose
qui existera encore quand l'annonce d'aujourd'hui aura disparu ? Ou n'est-il
qu'une chaîne de caractères qui se trouve, ce matin, dans deux titres ?

Trois applications du même jour :

- **`fiscal` : écrit**, malgré deux offres. Fiscaliste, tax, fiscalité sont
  un métier permanent, et le catalogue en portait déjà deux occurrences sous
  d'autres formes — « Comptabilité Fiscale », « réglementations fiscales ».
- **`chargé d'études financières` : écrit**, et ajouté à `ANALYSTE_GENERIQUE`
  plutôt qu'à une famille. C'est un intitulé standard du secteur, mais il ne
  désigne pas le même métier partout : chez un assureur c'est du contrôle de
  gestion, chez un gérant de l'analyse de marché, chez un régulateur de
  l'analyse prudentielle. Le mécanisme qui route selon la structure fait le
  travail en une ligne, là où trois familles en dur auraient figé un choix.
- **`ingénieur financier` : PAS écrit**, bien que le terme soit standard. Il
  désigne deux métiers opposés — structuration de marché en BFI, montage de
  prêts à la Caisse des Dépôts. **Un motif qui ne sait pas lequel des deux il
  nomme ne vaut rien**, et l'employeur ne peut pas trancher ici puisque les
  deux emplois existent des deux côtés.

Le corollaire : quand un terme standard est ambigu et que la structure ne le
désambiguïse pas, on le laisse au résidu. Le résidu est compté au journal et
il se relit ; un motif faux, lui, se propage en silence.

### Quand le titre ne suffit pas, c'est l'employeur qui tranche

Trois fois dans la même nuit, un intitulé identique a dû recevoir deux verdicts
opposés selon la maison. Ce n'est pas une exception à répéter au cas par cas,
c'est **le rôle du second axe** : les structures ne servent pas qu'à filtrer
l'affichage, elles désambiguïsent le métier.

**« Recouvrement »** — chez une structure `entreprise`, c'est du *credit
management* : relancer les clients, piloter le DSO, un vrai poste junior de
direction financière. Il se range en Contrôle de gestion & Trésorerie. Partout
ailleurs c'est du recouvrement de créances, donc du traitement de dossier.

> Rexel « Gestionnaire de Recouvrement » → **Contrôle de gestion**
> Société Générale « Chargé de Recouvrement » → **rejeté**
> Le titre est le même. L'employeur tranche.

**« Sales »** — chez un gérant d'actifs, une banque ou un dépositaire, un poste
de vente porte sur des produits financiers ; chez un industriel, il porte sur
des produits tout court.

**« Analyste financier »** — en entreprise c'est du contrôle de gestion, en
banque ou en gestion c'est de l'analyse de marché, chez un régulateur c'est de
la cotation prudentielle.

**Le principe : n'écrire une exception de titre que lorsque l'employeur ne peut
pas trancher.** Une exception bricolée sur l'intitulé se répète et se contredit ;
une règle adossée à la structure se lit et se vérifie. C'est aussi pour cela
qu'un coup de pouce de structure ne doit jamais servir de FILET par défaut
(§21) : il désambiguïse ce que le titre nomme mal, il n'invente pas ce que le
titre ne dit pas.

### Le résidu est le vrai indicateur, pas « Autres »

Le fourre-tout visible tenait à 14 offres, soit 1,5 %, et ce chiffre passait
pour une mesure de qualité du classement. **Il n'en est pas une** : « Autres
métiers de la finance » est une famille qui contient des économistes, pas un
bac de récupération. Les offres que le classifieur ne sait pas ranger sortent
du site — **474 ce jour-là** — sans figurer dans aucun compteur.

Une mesure qui a l'air de dire quelque chose et qui parle d'autre chose : le
défaut du §26 et du §29, déplacé dans les indicateurs.

Le nombre d'offres SANS FAMILLE est donc désormais **une ligne du journal, à
côté du total**. Si le classement se dégrade un jour, c'est là que ça se verra
en premier.

### Un métier se nomme, il ne se devine pas d'après l'employeur

Quatre métiers ont été récupérés du résidu par un MOTIF qui les nomme —
« structured product » vers les marchés, « reporting réglementaire » vers les
risques, « chargé d'affaires internationales » vers les financements,
« responsable bilan » vers l'assurance technique — et non par un coup de pouce
de structure. La différence est celle du §21 : un coup de pouce d'employeur
fait rentrer avec le bon tout ce qui traîne. C'est exactement ce qui avait fait
de « Fusions & Acquisitions » un second fourre-tout, douze offres sur 78 sans
le moindre vocabulaire de deal.

### Le dépôt est la seule source

Les fichiers de la refonte ont vécu dans `Downloads/jj-refonte/`, un sas utile
tant que le travail n'était pas fusionné. **Il n'a plus de raison d'être, et
maintenir deux copies du même fichier a coûté trois corrections perdues dans la
même nuit** : les codes de sortie des suites de tests, remis à chaque recopie
et effacés à la suivante, plus le renommage de `gate:employeur-absent-de-
structures`.

À faire une fois, dans cet ordre :

1. vérifier que le dépôt contient bien la dernière version de chaque fichier
   (`git diff` doit être vide après une recopie ; s'il ne l'est pas, c'est le
   dépôt qui a raison, il porte les correctifs) ;
2. **renommer le dossier** en `jj-refonte-ARCHIVE-nepasrecopier` plutôt que le
   supprimer — l'historique du sas peut servir, mais son nom doit interdire le
   réflexe ;
3. ne plus jamais recopier depuis lui.

**Un fichier qui existe à deux endroits n'a pas deux versions : il en a une
juste et une qui attend de la remplacer.**


---

## 31. Un relevé écrasé chaque matin est une photo, pas une mémoire

**Tranché le 04/09/2026.**

`data/employeurs-inconnus.json` était réécrit à chaque passage. Il portait le
relevé du matin, et le relevé du matin effaçait celui de la veille.

**La mesure qui a tranché** : trois relevés successifs comptaient **26, puis
18, puis 17** employeurs. Un employeur qui disparaît entre deux relevés n’est
pas réglé pour autant — ses offres ont simplement expiré, et la maison
reviendra publier. La photo du jour sous-déclarait donc **d’au moins un**
**tiers**, et reconstituer l’union demandait de relire trois commentaires
d’issue à la main.

**La règle** : ce qui alimente une décision humaine récurrente se tient dans
un registre **fusionné et versionné**, jamais dans un instantané. Un
instantané ne se nettoie pas, il se remplace.

`data/employeurs-vus.json` est commité par le passage quotidien. La fenêtre
est de **30 jours** : au seuil du pipeline une annonce CDI vit 60 jours, donc
trente jours attrapent toute maison ayant publié au moins une fois dans le
mois. Sept jours rateraient les maisons à rotation lente ; quatre-vingt-dix
feraient enfler la liste de maisons qui ne publient plus. Oubli à 180 jours.

**La propriété qui rend le mécanisme sain, et qu’aucune liste manuelle**
**n’aurait** : il se nettoie tout seul. Un employeur inscrit dans
`structures.js` cesse d’apparaître dès le lendemain, puisque
`resolveStructure` lui répond. Aucune liste de « déjà traités » à tenir — la
seule chose qui sort un nom de la liste, c’est de régler le problème.

---

## 32. Le texte explicatif se consulte, il ne se traverse pas

**Tranché le 04/09/2026, après trois mesures.**

Les quinze pages de famille existent pour un texte : celui qui explique un
métier à quelqu’un qui ne le connaît pas. La question était où le mettre.

**Premier essai — le texte visible sous le h1.** Mesuré sur un téléphone de
375 × 812 : l’intro occupait de 38 % à **58 %** de l’écran selon la famille,
et sur la plus longue la première offre tombait à y = 834, soit **hors de
l’écran**. Une page d’offres où l’on ne voit aucune offre.

**Deuxième essai — un panneau modal.** Il assombrissait tout l’écran pour
une définition de trois lignes. Un panneau se subit ; une définition se
consulte.

**Retenu — une bulle au clic, ancrée au « ? ».** Elle est petite (300 px,
corps 0,71 rem), elle flotte par-dessus, et elle se referme de trois façons :
nouveau clic sur le « ? », clic à côté, Échap.

**Le chiffre qui tranche** : sur les quinze pages, la première carte est
désormais visible sans défiler sur 375 × 812 — le pire cas est à y = 613 sur
812, contre 834 avant.

**Les deux propriétés qui ne se négocient pas :**

1. **Le texte reste dans le HTML servi, bulle fermée.** C’est la raison
   d’être de ces pages : Google doit le lire. `hidden` l’y laisse ;
   l’injecter par JavaScript l’en aurait sorti.
2. **`position: fixed` dans les deux états.** La bulle est hors flux qu’elle
   soit ouverte ou fermée, donc l’ouvrir ne peut pas décaler la page.
   Vérifié : la première carte reste à y = 219 sur ordinateur et y = 369 sur
   téléphone, avant comme après ouverture.

---

## 33. Un seul composant, deux emplacements

**Tranché le 04/09/2026.**

Le même « ? » sert à côté du h1 d’une page de famille et à côté de chaque
famille dans la colonne de l’accueil. **Une seule implémentation** :
`.jj-aide` + `.jj-bulle`, et une fonction `brancherAide()` qui délègue
depuis le document.

La délégation n’est pas un détail de style : les quinze boutons de la
colonne sont **réécrits à chaque rendu**. Un écouteur posé sur chaque bouton
disparaîtrait au premier filtre appliqué ; un écouteur posé sur le document
survit à tout.

**Pourquoi pas une infobulle au survol**, qui était l’idée de départ :

1. **Le survol n’existe pas sur téléphone.** C’est la moitié des visites
   d’un site d’offres.
2. **Le survol n’existe pas au clavier.** Une bulle qui ne s’ouvre qu’à la
   souris est invisible pour qui n’en utilise pas.

Le bouton est un vrai `<button>` — donc atteignable en tabulation — et porte
`aria-expanded` et `aria-controls`. Échap referme et **rend le focus au
bouton**, sans quoi la tabulation repartirait du début du document.

**Le piège rencontré en chemin** : le « ? » vit à côté du `<label>`, jamais
dedans — imbriqué, un clic dessus cocherait la case. Mais du coup, le
masquage des familles sans offre, qui portait sur `.famille-option`,
laissait quatorze points d’interrogation orphelins flotter dans la colonne
d’une page de famille. **Envelopper des éléments déplace le niveau auquel
les règles s’appliquent, et chaque règle posée sur l’ancien niveau doit
suivre** — le trait de séparation des lignes est tombé dans le même piège la
même heure.

---

## 34. Une date fabriquée passe pour fiable — constat du 06/09/2026, non corrigé

**Relevé, pas tranché. À décider.**

Quatorze branches de `normalize()` datent une offre au JOUR DE LA COLLECTE
quand leur source ne donne rien : `postedAt = new Date().toISOString()`. Ce
n’est pas un format inconnu, c’est une **absence de date déguisée en date
d’aujourd’hui**.

Les branches concernées : `vie`, `labonnealternance`, `recruitee:`,
`oraclecloud:`, `teamtailor:`, `ashby:`, `adzuna`, `servicepublic`,
`eicards:`, `sitemapld:`, `successfactors:`, `talentsoft:`, `manuel`.

**Les chiffres, mesurés sur le catalogue en ligne du 05/09 (943 offres) :**

| | |
|---|---:|
| offres issues de ces branches | **234** (25 %) |
| dont portant la date du jour de collecte | **2** |
| dont marquées « date fiable » | **233 / 234** |

**Ce qui est rassurant** : la plupart de ces 234 offres ont fini par recevoir
une vraie date, de leur source ou de la lecture de leur fiche. Le repli ne
sert que rarement.

**Ce qui ne l’est pas, et qui est le vrai sujet** : quand il sert, la date
fabriquée est marquée FIABLE. `_dateDeLaSource` vaut `Boolean(dateIso(postedAt))`,
et `new Date().toISOString()` est une date parfaitement valide — le pipeline ne
peut donc pas distinguer « la source a dit aujourd’hui » de « nous avons écrit
aujourd’hui faute de mieux ».

**La conséquence, si le repli s’applique deux matins de suite** : l’offre est
ré-estampillée du jour à chaque passage. Son âge vaut zéro en permanence, le
filtre d’âge ne peut jamais l’expirer, et une annonce ouverte depuis dix-huit
mois paraît publiée ce matin. C’est le contraire de la troisième règle du
projet — *datées, vérifiées*.

**Pourquoi ce n’est pas corrigé le soir même** : la correction est simple à
décrire — une date fabriquée doit être NULLE, pas d’aujourd’hui, et l’offre
passe alors en fin de liste avec la mention « toujours en ligne, date
inconnue » qui existe déjà. Mais elle touche quatorze branches et un quart du
catalogue, et le site sort de deux matins sans publication. On mesure d’abord
ce que devient le catalogue quand ces 234 offres perdent leur date, on décide
ensuite.

**Comment c’est apparu** : en cherchant le format de date de Talentsoft. Le
connecteur n’en a pas — il n’a pas de date du tout. La question « quel format
? » a donc trouvé, à la place, une réponse plus lourde : « aucune ».

---

## 35. Un contrôle bloque quand publier serait FAUX, il crie quand ce serait INCOMPLET

**Tranché le 07/09/2026, après trois matins sans publication.**

Le garde-fou « un connecteur passant de ≥ 10 offres à zéro » a gelé le site
**trois matins de suite** pour **dix offres sur 928**. Publier sans elles
donnait un catalogue incomplet de 1 % ; ne pas publier en donnait un vieux de
trois jours, pendant que les offres nouvelles des 137 autres connecteurs
restaient dehors. Le remède coûtait cent fois le mal.

**La règle, désormais explicite :**

> Un contrôle **bloque** quand publier rendrait le catalogue **FAUX**.
> Il se contente de **crier** quand publier le rendrait seulement **INCOMPLET**.

**Restent bloquants** — publier produirait un catalogue faux : la chute de
15 %, le contrôle du catalogue dans le HTML, l’invariant de séniorité.

**Devient un signalement** : un connecteur qui tombe à zéro. Le catalogue
part, l’issue s’ouvre, et sa première ligne tranche — *CATALOGUE PUBLIÉ —
N offres en ligne, connecteur X muet*.

**Ce qu’il ne faut pas perdre en route.** Le garde-fou existait pour une
bonne raison : une panne partielle silencieuse, c’est ainsi qu’un catalogue
pourrit sans qu’on le voie. Si l’on ne fait plus que crier et que personne
n’agit, la pourriture avance quand même — c’est le défaut de l’alerte des
maisons non inscrites.

**L’escalade se fait donc dans le TEMPS, pas dans la sévérité immédiate.** Au
premier passage, le connecteur muet publie et crie. **Au troisième passage**
**consécutif à zéro, il bloque** : à ce stade ce n’est plus un incident,
c’est un connecteur mort qu’on n’a pas réparé.

**Les deux propriétés du compteur, sans lesquelles il nuit** (éprouvées dans
`ingestion/test-connecteur-muet.js`) :

1. **Il ne démarre que sur une chute depuis ≥ 10 offres.** Un connecteur mort
   depuis trois mois est à zéro tous les matins ; s’il incrémentait, il
   bloquerait la publication au nom d’une source dont plus personne n’attend
   rien.
2. **Il se remet à zéro dès que le connecteur rend une offre.** Pas au bout
   d’un moment, pas au passage vert : dès la première offre.

Et une troisième, moins évidente : **le compteur survit à une publication**
**faite sans lui.** Le lendemain, le connecteur n’est plus dans le catalogue
de la veille — sans cette persistance, l’escalade ne se déclencherait jamais.

---

## 36. Le courtage élargit un libellé, il ne crée pas une douzième structure

*Tranché le 07/09/2026.*

Marsh France attendait un type de structure, et les onze n'en avaient pas
pour un courtier. Deux réponses se présentaient : ouvrir une douzième valeur
— « Courtage & conseil en risques » — ou forcer le courtage dans
« Compagnie d'assurance & mutuelle », qui ne le nommait pas.

**La mesure a tranché.** Les courtiers du marché français — Marsh, Aon,
Diot-Siaci, Verlingue, Gras Savoye, WTW, Filhet-Allard, Henner, Satec —
rendent **88 offres dans la récolte** et **4 au catalogue** : trois chez
Marsh McLennan, une chez Verlingue. Une douzième structure coûte quinze pages
de famille, une ligne de filtre dans la colonne, un libellé à écrire et une
taxonomie à rouvrir — figée le 01/09. Pour quatre offres, c'est hors de
proportion.

**La décision : le libellé s'élargit.** « Compagnie d'assurance & mutuelle »
devient **« Assurance, mutuelle & courtage »**. Marsh France reste en
`assurance`, et le libellé dit désormais la vérité sur ce qu'il contient.

**La règle générale.** Un axe de taxonomie gagne une VALEUR quand la
population nouvelle justifie sa propre page ; il élargit un LIBELLÉ quand
cette population est petite et adjacente. Le libellé est un mot, la valeur
est une page — ils ne se paient pas au même prix.

**Ce qui a rendu le renommage sûr, et qu'il fallait vérifier avant :**

1. **Le libellé se décide en un seul endroit.** `structures.js` porte la
   table vivante ; `pipeline.js` en garde 22 occurrences qui sont du CODE
   MORT — `inferSector` n'y est appelée nulle part hors d'un commentaire, et
   les 920 offres publiées portent toutes, sans exception, le libellé que
   rend `structures.js`. Interrogée directement, la table de `pipeline.js`
   répond « Entreprise (direction financière) » pour AXA, BNP Paribas et
   Ardian : si elle décidait, le catalogue le montrerait. Il ne le montre pas.
2. **Aucune mesure d'audience ne porte la structure.** Les cartes émettent
   1 877 `data-umami-event-famille` et 1 877 `data-umami-event-volet`, et
   rien d'autre. Renommer un libellé de structure ne casse donc aucun
   historique.

**Avec, dans le même lot : CDC Habitat passe d'`institution` à `entreprise`.**
Le précédent est net dans la table : la Caisse des Dépôts est une
`institution`, EDF est une `entreprise`. CDC Habitat est un bailleur social,
pas un régulateur — sa direction financière recrute comme celle d'une
entreprise.

---

## 37. Un tag transversal doit dire ce que les axes ne disent pas — « international » ne le faisait pas

*Tranché le 07/09/2026, tag supprimé.*

Les tags transversaux existent pour nommer ce qui traverse les familles : une
offre ESG peut être en gestion d'actifs, en DCM, en audit ou en
capital-investissement (paragraphe des TAGS dans `classifier.js`). « ESG » et
« Immobilier & infrastructure » tiennent cette promesse. « International »
ne la tenait pas.

**La mesure.** 12 offres sur 920 le portaient. **Dix étaient en France** —
Paris, Montrouge, La Défense, Strasbourg, Reims. L'une d'elles s'appelle
« International Corporate Banking Graduate Programme **Paris** ». Les deux
seules réellement à l'étranger — Selangor et Dublin, chez Caceis — sont des
**VIE**, donc déjà rassemblées par l'onglet VIE, qui les dit mieux et sans
se tromper.

**Le mécanisme du défaut.** Le tag était marqué sur l'INTITULÉ, jamais sur le
lieu, et son premier motif était `/\bvie\b/` : il attrapait un TYPE DE
CONTRAT en croyant attraper un PAYS. Sur les douze, sept venaient du mot
« international » dans le titre, deux d'« EMEA », trois de « VIE ». Aucun
n'a jamais regardé où était le poste.

**La règle.** Un tag transversal ne se garde que s'il dit quelque chose
qu'aucun axe existant ne dit. Celui-ci doublait l'onglet VIE pour les vrais
cas, et mentait pour les autres. Supprimé de `classifier.js` et d'`index.html`
— les douze offres gardent leur famille, il n'y a rien à redistribuer.

**Et le corollaire, pour le jour où l'on voudra vraiment un axe géographique :**
il se lira sur le LIEU, jamais sur l'intitulé. Le lieu est un champ ; le titre
est une phrase écrite par un employeur.

---

## 38. Une liste blanche de villes n'admet pas une commune, elle admet un MOT

*Tranché le 07/09/2026.*

339 offres mouraient sur le lieu. En les regardant une à une, ce n'était pas
un filtre trop dur : c'étaient **trois défauts distincts**, dont deux qui
n'avaient rien à voir avec la politique de couverture.

### Défaut 1 — le raccourci d'adresse mangeait les noms composés

`nettoyerLieu` gardait le **dernier mot** de tout libellé écrit en capitales.
La règle avait été écrite pour une adresse postale — « 21 AVENUE DU BEL AIR
PARIS » doit rendre « Paris ». Mais elle mordait sur n'importe quel libellé en
capitales, et les portails en envoient beaucoup :

| ce que la source envoie | ce que le pipeline en faisait |
|---|---|
| `SAINT LÔ` | « Lô » |
| `LA ROCHE SUR YON` | « Yon » |
| `SAINT FLOUR` | « Flour » |
| `FONTENAY SOUS BOIS` | « Bois » |
| `NEUILLY SUR SEINE` | « Seine » |
| `LEVALLOIS PERRET` (AG2R) | « Perret-France » |

Les trois dernières sont des communes du Grand Paris **déjà inscrites** : le
filtre les aurait acceptées telles quelles. Elles étaient jetées par une
troncature, pas par une décision.

La liste `PARIS|LYON|MARSEILLE|LILLE|LA DÉFENSE` qui vivait dans cette
fonction était un rattrapage ville par ville du même défaut — la preuve que
quelqu'un l'avait déjà rencontré sans le nommer.

**Le correctif ne regarde plus la casse, il regarde le contenu :** une adresse
porte un marqueur de voie (AVENUE, RUE, ZAC, BÂTIMENT…), un nom de commune
n'en porte jamais. La mise en forme des capitales, elle, s'applique dans les
deux cas — « SAINT LÔ » s'affiche « Saint Lô » et ne crie plus.

### Défaut 2 — le retrait du suffixe « France » mangeait « Ile de France »

`estGrandeVille` retire « France » en fin de libellé, pour que « Ile-de-France
- France » reste lisible. Sur « **Ile de France** », écrit avec des espaces,
il ne restait que « Ile de » — et le libellé était rejeté alors que
`ile de france` figure noir sur blanc dans `REGIONS_ET_INCONNU`.

C'est le piège déjà documenté dans `CLAUDE.md` (« le retrait du suffixe
France coupait ile-de-france en ile »), **refermé sur la forme à tirets
seulement.** Le libellé d'origine est maintenant conservé et jugé lui aussi.

### Défaut 3 — les banlieues de métropoles déjà couvertes

Là seulement il s'agissait d'une vraie décision. 87 offres se trouvaient dans
la banlieue immédiate d'une métropole au catalogue depuis le premier jour :
Saint-Grégoire pour Rennes (19), Orvault, Saint-Herblain et Vertou pour Nantes
(25), Balma pour Toulouse (10), cinq communes pour Bordeaux (9), Bezannes pour
Reims (6), Écouflant pour Angers (4).

**Chaque commune inscrite est justifiée par un nombre d'offres mesuré**, jamais
par la géographie seule. Une commune sans offre n'entre pas : la liste se paie
en surface d'attaque.

### Et la règle que tout cela a fait apparaître

**Une entrée de liste blanche n'admet pas une commune : elle admet un MOT.**
`contientVille` compare des mots — c'est ce qui empêche « Lillebonne » de
passer pour Lille. Mais c'est aussi ce qui fait que `croix`, inscrite pour la
banlieue lilloise (3 offres), laissait entrer **« La Croix St Ouen »**, dans
l'Oise, à 80 km. « Croix » est un mot fréquent de la toponymie française :
Sainte-Croix, La Croix-Valmer, Croix-de-Vie.

`croix` a donc été **retirée** — trois offres ne valent pas cette porte
(règle 3 : moins d'offres, mais toutes justes). Et un audit accompagne
désormais toute inscription : **on demande à chaque entrée de montrer, sur des
libellés réels, tout ce qu'elle fait entrer.** Sur les 23 communes du lot, une
seule débordait — mais il fallait la mesure pour le savoir, pas l'intuition.

*Note de méthode : le premier audit a répondu « une entrée déborde encore »
APRÈS le retrait de `croix`. Il testait ma liste écrite en dur, pas le
fichier. C'est « la fonction interrogée doit être la fonction qui décide »,
appliqué à l'instrument lui-même.*

### La mesure

Sur la récolte du 07/09, à l'étage du lieu et à cet étage seul :

| | offres perdues sur le lieu | libellés distincts |
|---|---|---|
| avant | 339 | 173 |
| après | 215 | 136 |

**124 offres franchissent désormais l'étage du lieu.** Ce n'est pas 124 offres
de plus au catalogue : les étages suivants — âge, séniorité, déduplication —
en écartent une partie. Le chiffre du catalogue se lit sur `offres.js`, après
un passage complet, jamais sur cette mesure intermédiaire.

## 39. Un défaut de NOTRE côté ne se répare pas en s’empêchant de publier

**Constat du 07/09/2026 au soir. POSÉ le 08/09/2026, avec sa contre-épreuve.**

Le garde-fou des connecteurs muets compte « trois passages consécutifs à
zéro » et bloque au troisième. Il ne distingue pas les deux pannes que **son
propre message distingue depuis le matin même** :

- **« LA SOURCE N’A RIEN RENVOYÉ »** — le portail est tombé, l’API a fermé,
  le connecteur pointe dans le vide. On ne peut rien y faire depuis ici.
- **« LA SOURCE A RÉPONDU, ce sont nos filtres qui les ont écartées »** — le
  portail va bien, et le défaut est chez nous.

**Le compteur ignore la distinction que l’alerte fait.**

### Ce que ça a coûté

Le 07/09 à 21h13, `bofa` a bloqué la publication du catalogue entier au
troisième passage. Or `bofa` n’est pas mort : **il répond quatorze offres en
deux secondes.** Ses dix offres mouraient sur `age:apres-datation`, à cause
d’une conversion de date européenne codée en dur dans notre lecteur de fiches
(ligne 3899) — la jumelle des deux retirées de `normalize()` le matin même.

Le catalogue de 990 offres auquel il manquait ces dix-là était **incomplet de
1 %, avec une cause identifiée à la ligne près**. Ce n’est pas un catalogue
faux. Le paragraphe 35 tranche : on bloque quand publier serait FAUX, on crie
quand ce serait INCOMPLET. L’escalade a appliqué la mauvaise moitié.

### Pourquoi l’escalade existait, et pourquoi elle ne vaut pas ici

Elle a été conçue pour un connecteur **MORT** : une source qu’on ne répare
pas, qu’il faut cesser d’attendre, et dont l’absence prolongée finit
effectivement par rendre le catalogue faux. Trois passages à zéro sont alors
le bon signal.

Appliquée à une source qui répond, elle produit exactement la disproportion
qu’on avait retirée le matin du 07/09 : **un site entier qui ne publie pas à
cause d’un défaut interne**, alors que le défaut, lui, ne se répare pas en
s’empêchant de publier. Bloquer n’a pas rapproché d’une correction : cela a
seulement privé les visiteurs de 990 offres pour en protéger dix.

### La règle

**Le compteur d’escalade n’incrémente que lorsque la SOURCE ne répond pas.**

Quand la source répond et que nos filtres écartent tout, le passage **crie
fort — et n’escalade jamais**. Le message porte déjà la ventilation par étage
(`10 age:apres-datation, 3 seniorite:premier-passage, 1 normalize`) : il dit
où regarder, ce qui est le seul service utile dans ce cas.

C’est le paragraphe 35 appliqué à l’escalade elle-même, et le corollaire du
principe déjà écrit pour le passage obligé des dates : **il refuse l’offre,
jamais le passage.**

### Ce que la pose a demandé — 08/09/2026

`laSourceARepondu(nom, brutes)` est **extrait de `diagnosticConnecteur`**, qui
faisait déjà ce test pour rédiger son message. Le compteur lit désormais
exactement la même chose que le message : deux tests séparés pour la même
question divergent tôt ou tard, et alors le message dit « la source a
répondu » pendant que le compteur escalade comme si elle était morte.

Trois points où la garde s’applique :

1. **le compteur n’incrémente pas** quand la source répond ;
2. **le blocage ne se déclenche pas** même à trois passages, quand la source
   répond ;
3. **le message dit pourquoi** — « la source RÉPOND : le compteur n’escalade
   pas (§39) » — sinon on cherche pendant vingt minutes pourquoi le
   troisième passage n’a pas bloqué.

**`brutes` absent = on répond NON.** Ne pas savoir ce que la source a rendu ne
doit pas désarmer un garde-fou : le comportement reste alors celui d’avant.
C’est ce qui a permis aux sept assertions existantes de continuer à passer
sans être réécrites.

### La contre-épreuve, et ce qu’elle a révélé

Deux défauts provoqués, `pipeline.js` restauré à l’identique :

| défaut provoqué | échecs |
|---|---:|
| la garde du compteur retirée | **2** |
| le blocage qui ignore le prédicat | **3** |

**Le second n’était pas couvert au premier jet**, et c’est le plus important :
la garde du compteur suffit au cas simple — la source répond, le compteur
reste à zéro, rien ne bloque —, mais il existe une séquence réelle où le
compteur est **déjà à trois** :

```
jours 1-3   la source est vraiment muette        -> le compteur monte à 3
jour 4      la source répond, nos filtres écartent tout
```

Au jour 4, sans le second garde-fou, le catalogue entier ne partirait pas pour
un défaut de notre côté — exactement l’incident du 07/09 à 21h13. C’est **la**
propriété qui protège le site, et elle demande le chemin d’intégration :
`anomaliesDePublication` lit le catalogue de la veille sur le disque. Le test
le fait, et si `offres.js` manque ou porte moins de cinquante offres, il le
**dit** au lieu de croire au succès.

`ingestion/test-connecteur-muet.js` : 21 assertions, câblé au Contrôle 1.

### Ce qui reste ouvert sur le même code

**`--forcer` réarme le compteur.** Le garde-fou compare une source à ce
qu’elle rendait au passage PRÉCÉDENT ; publier en forçant acte la baisse, et
le lendemain la source ne « passe » plus de dix à zéro — elle reste à zéro, ce
qui n’est plus une chute. Une source réellement morte pourrait devenir
invisible. Non corrigé : les deux touchent le même code, et celui-ci était le
seul à pouvoir coûter le site entier.

### Ce que l’incident a prouvé au passage

Le garde-fou a mordu **au bon moment et avec le bon message**. C’est la
première fois de la semaine qu’une alerte a nommé sa cause du premier coup :
sans la ventilation par étage ajoutée le matin même, le réflexe aurait été
d’accuser le connecteur — et de « réparer » ce qui marche, ce que ce document
documente déjà comme une erreur payée deux fois (Air Liquide, Santander).

Le défaut est donc dans la RÉACTION, pas dans la DÉTECTION. La détection est
à garder telle quelle.



## 40. Un sondage se fait avec l’en-tête du dépôt — tranché le 08/09/2026

**Décidé.** Toute sonde de portail envoie `UA_HTML`, la chaîne que le
pipeline envoie en production : « Mozilla/5.0 (compatible; JJ job board) ».
Jamais une chaîne de navigateur.

**La mesure qui l’a imposé.** `talents.bpifrance.fr` a été jugé « WordPress
ouvert, 153 Ko, JSON-LD sur chaque fiche, 86 offres, `robots.txt`
autorisant `/opportunites/` », et la décision de le brancher était prise.
Le même URL, avec `UA_HTML`, rend **403 en 919 octets** — liste et fiche.
Ma sonde se présentait en Chrome ; le gisement n’existait que pour elle.

Sur les cinq autres portails du jour — RSM, Carmignac, Groupama, et les
deux fiches associées — les deux en-têtes rendent **exactement la même
chose**. Bpifrance était le seul à trier. C’est ce qui rend le piège
coûteux : il ne se manifeste presque jamais, donc rien n’entretient la
vigilance.

**Et le corollaire, qui est une question de règle et non de technique.** Un
site qui répond 200 à un navigateur et 403 à un robot qui se nomme exprime
un refus. Le lire supposerait d’envoyer une chaîne de navigateur qu’on
n’est pas : c’est un **contournement**, pas une lecture, et la règle 2 de
`CLAUDE.md` l’interdit. La question ne se rouvre pas au motif que « ça
marcherait » — précisément, ça marcherait.

Le dépôt est cohérent sur ce point : `UA_HTML` vaut
« Mozilla/5.0 (compatible; JJ job board) » partout, aucun connecteur ne se
déguise. Cette décision ne corrige donc pas le code, elle protège une
propriété qu’il a déjà.

**Ce que ça généralise.** « Ne jamais mesurer avec un instrument plus
PUISSANT que celui qui travaille » (07/09, le cas Stifel) visait le moteur
— navigateur contre `fetch` Node. Le 08/09 montre que rester en Node ne
suffit pas : **l’en-tête fait partie de l’instrument.** Deux outils qui
exécutent le même code peuvent obtenir deux réponses différentes du même
serveur, et la seule mesure qui vaut est celle qui se présente comme le
passage de 6h30 se présentera.

## 41. Une offre REPUBLIÉE est conservée avec sa nouvelle date — tranché le 10/09/2026

**Décidé. Ne pas rouvrir.**

Quand un employeur retire une annonce et la republie sous un nouvel
identifiant, l’offre ressort du catalogue puis y rentre — et sa `postedAt`
saute à la date de republication. Une annonce ouverte depuis juin peut ainsi
se réafficher « publiée avant-hier ».

**Ce n’est pas un contournement du filtre d’âge, c’est le meilleur signal
que ce filtre puisse recevoir.** Le seuil d’âge existe pour écarter ce qui
est *probablement pourvu* ; une republication démontre l’inverse — le poste
est **encore ouvert**, et l’employeur vient de le dire lui-même. Aucune autre
information dont nous disposons n’est aussi fraîche.

### La mesure qui l’a tranché

Passage du 10/09/2026, rapproché sur un triplet **employeur + intitulé +
ville** — jamais sur `canonicalKey`, qui était le suspect :

| | |
|---|---:|
| catalogue | 1 047 offres |
| arrivées brutes | 79 |
| départs bruts | 70 |
| **republications** | **12** |
| arrivées réelles | 67 |
| départs réels | 58 |

**Douze cas sur 1 047 offres**, tous des republications d’ATS :

- **Guerlain**, cinq d’un coup — même préfixe `jobId`, suffixe de `10865xx`
  à `10935xx`, `postedAt` du 27/07 au 08/09 : une campagne réémise en lot ;
- **BPCE** — `…-controle-comptable` devient `…-controle-comptable-2`, un
  doublon chez l’employeur ;
- **CMA CGM** — `Marseille-Internship-Assistant-Chartering-Controller`
  devient `Marseille-Stage-…`, le mot traduit dans le slug et
  l’identifiant qui suit.

### Ce que la mesure innocente, et c’est le point

`emp`, `loc`, `title` et `source` sont **stables sur 12/12**. Seules `url`
(12/12) et `postedAt` (10/12) bougent. **Notre clé n’est donc pas en cause :**
c’est l’identifiant que l’employeur donne à son annonce qui change.

Et ce n’est pas un battement quotidien : **10 des 12** portaient encore la
même URL le 08/09. L’adresse a tenu deux jours puis a changé — un événement
chez l’employeur, pas une instabilité qui se répéterait chaque matin.

`firstSeenAt` ne bouge pas (il reste au 02/09 pour Guerlain) : l’offre ne se
présente donc pas comme neuve au visiteur. Ce comportement est le bon, et il
tient parce que `firstSeenAt` est mémorisé ailleurs que sur l’URL.

### L’instrument

`ingestion/rotation-reelle.js` refait cette mesure sur deux passages
quelconques. Il existe parce qu’un brassage qui surprend appelle une
explication, et qu’une explication n’est pas une mesure — « c’est la
rentrée » était plausible et à moitié faux.

---

## 42. La structure n'est pas le métier — « Coordinateur Relation Client » chez un courtier

**Tranché le 13/09/2026 par Victor.**

« Coordinateur Relation Client - Courtage en assurance grands risques »
(Marsh McLennan) était rangée en **Actuariat & Assurance technique**. Elle y
entrait par le DÉCOR : « assurance » et « risques » sont dans l'intitulé, le
courtage est dans nos structures depuis le §36.

Le métier nommé, lui, est la relation client — du service et du commercial.
Ça ne produit ni n'analyse d'information financière : **hors périmètre au sens
du §30**, comme le chargé de clientèle en agence qu'on écarte déjà.

> **La structure ne dit rien du métier.** Qu'un employeur soit courtier,
> banque ou fonds décide de ce qu'on ACCEPTE d'y trouver, jamais de ce qu'un
> intitulé donné y désigne. C'est le test du §30 sous un autre angle : qui est
> le sujet, qui est le décor.

### L'exemption est dans le motif, et la mesure a dit pourquoi

Un motif nu sur « relation client » attrape **« Investor Relations Client
Administration »** et **« Investor Relations Client Solution »** chez Ardian —
les deux offres rangées en middle-office et en gestion d'actifs trois jours
plus tôt — ainsi que « Chargé de relations clients - Middle Office » à la
Caisse d'Épargne. Le garde-fou « le motif *retail* cède à partir de 9 » ne les
sauve pas : elles plafonnent à 8.

Le motif épargne donc tout intitulé qui nomme un ancrage financier —
*investor*, *investisseur*, *middle office*, *back office*, *fund*, *fonds*,
*banque privée*, *private bank*, *wealth*, *patrimoine*.

**Mesuré avant de poser** : contre-test 16/16 sur `classify()`, et sur la
récolte entière **3 391 → 3 390 offres retenues**. La seule offre perdue est
celle que Victor avait nommée.

---

## 43. Un titre reconstruit depuis l'adresse cache autre chose qu'un défaut d'affichage

**Tranché le 13/09/2026, sur une mesure qui cherchait autre chose.**

Quatre maisons lisent leur liste en mode `depuisLien` : l'intitulé n'est pas
lu, il est **reconstruit depuis le slug de l'URL**. D'où « Banking financing
equity capital markets placement analyst paris » chez Citi et
« Compliancerisk officer mwd schwerpunkt risk management » chez Rothschild.

Le défaut paraissait cosmétique. Deux choses l'ont démenti.

### 1. Le vrai intitulé était déjà dans le bloc découpé

Le découpage prend tout ce qui va de `<a href="…">` à `</a>` : **le texte du
lien y est déjà**, personne ne le lisait. Chez Citi il porte l'intitulé complet
avec ses virgules et ses capitales, chez Covéa aussi. La correction ne coûte
aucune requête supplémentaire.

Chez KPMG, non : son ancre colle les facettes à l'intitulé (« … F/H Audit Audit
financier et extra-financier Lyon »), et son slug est plus propre. **On ne lui
pose pas `titreDuLien`** — une correction qui améliore trois maisons sur quatre
s'arrête à la quatrième, elle ne s'y impose pas.

### 2. Le filtre pays était INERTE, et c'est ça le vrai sujet

```js
const enFrance = cfg.lieuLibre ? … : o.pays ? … : cfg.depuisLien || /france/…
```

`cfg.depuisLien` valait **laissez-passer**. Lire sa liste par les liens
n'apprend pourtant rien sur la géographie : la condition était vraie sans
condition, pour les quatre maisons.

Résultat mesuré : **25 des 49 cartes Rothschild sont en France**, et **quatre
des six offres Rothschild publiées** étaient à Luxembourg, Francfort, Londres
et Dubaï. La règle 1 du site, enfreinte en silence depuis que ce connecteur
existe.

Rothschild lit désormais **la carte, pas l'adresse** : un `<h3>` exact, le pays
en premier détail, la ville en second (48 cartes sur 49 ont cette forme).
Épreuve sur le connecteur réel : **30 → 16 offres, dont ZÉRO française parmi
les quinze écartées.** Les trois autres maisons déclarent `paysImplicite`,
qui est ce qu'elles sont vraiment — des portails français.

> **La leçon, qui dépasse le cas :** un champ dégradé est un symptôme, pas un
> défaut. Quand une valeur arrive abîmée, la question n'est pas « comment
> l'embellir » mais **« par quelle porte est-elle entrée, et qu'est-ce que
> cette porte ne vérifie pas ? »**. Ici l'adresse servait de titre ET de
> preuve de nationalité ; elle ne pouvait être ni l'un ni l'autre.

---

## 44. Le référencement : ce qui manquait, et ce qu'on ne fera pas

**Tranché le 13/09/2026 par Victor, après mesure.**

L'impression de départ — « ces cartes ne permettent aucun référencement » —
était fausse sur le diagnostic et juste sur le symptôme. Les cartes SONT dans
le HTML servi : 982 sur l'accueil, 169 023 caractères de texte visible,
`robots.txt` ouvert, sitemap, flux RSS.

**Trois manques réels, mesurés :**

### 1. Les quinze pages de famille étaient ORPHELINES

```
liens vers /familles/ depuis l'accueil   : 0
liens entre pages de famille             : 0
```

Elles n'existaient que dans le sitemap. Un site dont la page d'accueil ne
pointe pas vers ses pages de contenu n'a, de fait, pas de pages de contenu.
Corrigé : un pied de page nomme les quinze familles, chaque page de famille
porte les quatorze autres, et les familles citées dans « à ne pas confondre
avec… » sont devenues des liens — **dix ancres, déjà écrites, auxquelles il ne
manquait que le lien**.

Le liage se fait **par égalité de chaîne sur le libellé exact**, jamais par
ressemblance : « Contrôle » désigne deux familles, « finance » une troisième.

### 2. Le seul contenu original du site était caché

13 077 caractères d'explication écrits à la main, derrière `hidden` sur toutes
les pages — **y compris les quinze dont ils sont la raison d'être**. Un
visiteur arrivant de Google sur « stage M&A » voyait une liste d'intitulés et
repartait. Voir le §32bis ci-dessous, qui dit ce que ça a coûté.

### 3. Aucune donnée structurée — et pas de JobPosting

Zéro JSON-LD sur seize pages. Posé : `WebSite` sur l'accueil,
`BreadcrumbList` sur les quinze pages de famille.

**`JobPosting` est écarté, et ce n'est pas un oubli.** Google exige que la page
qui le porte affiche la **description complète du poste**. On n'en a pas, par
construction : le lien mène chez l'employeur (règle 1). Baliser des cartes sans
description est précisément ce qui vaut une action manuelle aux agrégateurs.
**On n'y touche pas**, quelle que soit la tentation du carrousel « Google for
Jobs ».

### Ce qu'on NE fait PAS maintenant : les pages famille × volet

Le catalogue pourrait porter ~120 pages avec au moins cinq offres chacune
(36 croisements famille × volet, 21 zones, 11 structures, 55 employeurs).
**Refusé le 13/09.** Cent vingt pages au même gabarit, avec une liste filtrée
et aucun texte propre, sont exactement ce que Google a appris à déclasser. Les
pages employeur et zone sont les pires du lot.

Ce qu'on fera, plus tard et autrement : **les dix plus gros croisements
famille × volet, chacun avec son paragraphe écrit à la main par Victor.** Pas
généré, pas reformulé depuis la page de famille. Dix pages, pas cent vingt.

### UNE PAGE NAÎT LIÉE, elle ne naît pas seulement DÉCLARÉE

Le diagnostic ci-dessus était une déduction tirée du code. Victor l’a vérifié
dans la Search Console le 13/09, et Google le confirme en toutes lettres. Sur
`/familles/comptabilite-et-consolidation.html` :

> « Cette URL n’a pas été indexée par Google », et **« Afficher la page
> explorée » est GRISÉ**.

Grisé signifie qu’il n’existe **aucune version explorée** : Google n’est
jamais venu chercher cette page. Pas une fois en neuf jours, alors qu’elle
était au sitemap depuis le 04/09. Le site comptait **six clics organiques**
sur toute sa vie — seule la page d’accueil était connue.

> **Un sitemap ne fait pas explorer une page.** Il déclare qu’elle existe ;
> il ne donne à Google aucune raison d’y aller. Sans lien entrant, une page
> déclarée reste une page jamais visitée. **Une page se crée LIÉE — depuis
> l’accueil et depuis ses sœurs — le jour où on la crée, pas le jour où on
> s’aperçoit qu’elle ne reçoit rien.**

C’est neuf jours perdus sur quinze pages, pour un bloc de liens qui tient en
quinze lignes. La prochaine fois qu’on créera des pages — les dix croisements
famille × volet, si la mesure du 4 octobre les justifie — elles naîtront
liées, et le contrôle de maillage posé le 13/09 le vérifiera tout seul.

---

### LA MESURE QUI DÉCIDERA — notée le 13/09/2026

Trois semaines après ce passage, soit **autour du 4 octobre 2026**, regarder
dans la Search Console si les impressions des quinze pages de famille ont
bougé.

- **Elles montent** → on écrit les dix croisements.
- **Elles ne bougent pas** → le problème est ailleurs, et on aura économisé dix
  pages écrites pour rien.

---

## 32bis. Le texte visible coûte ce que le §32 avait mesuré — et le §32 avait raison

**Constaté le 13/09/2026, en appliquant le §44.**

Le §32 avait refusé le texte visible sous le h1 le 04/09, sur un chiffre : sur
375 × 812 la première offre tombait à **y = 834**. Remis visible comme le
demandait le §44, le même texte donne pire :

| état | première offre (375 × 812) | part de l'écran |
|---|---:|---:|
| sans aucune intro | **635** | — |
| repliée à 2 lignes | 804 | 19 % |
| **repliée à 3 lignes — retenu** | **826** | **21 %** |
| repliée à 5 lignes | 869 | 27 % |
| texte entier | **1 098** | 70 % |

**Le plancher de 635 n'est pas le texte** : c'est la structure de la page —
en-tête, onglets, bandeau des pépites, barre de filtres. Le texte entier
coûtait 463 px de plus ; replié à trois lignes, il en coûte 191.

**Retenu : le texte reste visible, replié à trois lignes, et se déplie sur
place.** Trois lignes montrent la phrase de définition, qui est ce qu'un
visiteur venu de Google a besoin de lire.

> **La polarité du repli n'est pas négociable.** La classe `replie` est posée
> PAR LE JAVASCRIPT, jamais par la feuille de style seule. Sans JavaScript, le
> texte s'affiche ENTIER — on retombe sur le défaut du §32, jamais sur un texte
> tronqué que plus rien ne peut déplier. Et dans les deux états il est dans le
> HTML servi, ce qui reste la raison d'être de ces pages.

Sur ordinateur (1280 × 800) le texte n'est pas replié : la première offre est
à y = 807, soit au pli. C'est accepté, et c'est le levier qui reste si Victor
veut la carte plus haut.

---

## 45. Relations investisseurs : le métier dépend de la maison

**Tranché le 13/09/2026 par Victor.**

> **Relations investisseurs : le métier dépend de la maison. Chez un fonds,
> c'est lever et servir des LP → gestion d'actifs. Chez une société cotée,
> c'est de la communication financière → contrôle de gestion & trésorerie.
> Un motif unique ne peut pas trancher, la structure le peut. Mesuré le
> 13/09 : 11 offres, dont 1 seule en entreprise.**

### Comment le sujet s'est ouvert

Une URL d'Havas — « Stagiaire Relations Investisseurs », Puteaux. Elle
n'entrait pas : « relations investisseurs » en **français** n'était pas un
marqueur finance, alors que l'anglais « investor relations » l'était. Motif
absent, et non motif inerte — aucune maison branchée ne l'écrivait ainsi.

Le marqueur ajouté, l'offre entrait… et ressortait classée **Gestion
d'actifs**, parce que la famille `gestion-actifs` porte déjà le motif
`[/\brelations? investisseurs?\b/, 8]` depuis longtemps. Une agence de
publicité n'a pas d'actifs sous gestion.

**Le changement de porte n'a pas créé ce défaut : il l'a rendu atteignable.**
Avant, ces offres n'entraient jamais, et le motif de famille ne pouvait pas
se tromper faute de sujet.

### Ce qui a été écarté, et pourquoi

- **Ajouter un motif de famille français** vers `gestion-actifs` : ce serait
  la faute du 10/09 — « investor relations » est un faux ami comme
  « commercial » l'était. Les onze offres anglaises se répartissent entre
  gestion d'actifs, middle-office, banque privée et capital-investissement,
  selon le reste du titre. Un motif unique ne peut pas trancher.
- **Neutraliser le motif chez `entreprise`** : l’offre serait entrée puis
  tombée au fourre-tout, qui n'est pas publié (`pipeline.js` — « le résidu ne
  retombe plus dans Autres »). Donc perdue APRÈS être entrée, le pire endroit
  pour la perdre.

### Ce qui est posé

Une **redirection par structure** — le mécanisme du coup de pouce
« recouvrement » chez un industriel, pas un motif de famille :

| structure | vers | pourquoi |
|---|---|---|
| `fonds`, `societe-gestion` | gestion d'actifs *(inchangé)* | lever des fonds et servir des LP est le métier de la maison |
| `entreprise` | contrôle de gestion & trésorerie | résultats, analystes, rapport annuel, consensus : de la communication financière, dans la direction financière |
| tout le reste | **rien n'est forcé** | une offre « Investor Relations » en BFI peut être du coverage — au titre de le dire |

**Deux lignes, et c'est assez.** Une seule offre est concernée aujourd'hui.
S'il y en a plus de cinq un jour, on remesurera — plutôt que de construire
une table extensible pour un cas.

**Sa limite, écrite pour qu'on ne la cherche pas :** un employeur **sans
structure** ne peut pas être redirigé — la table est indexée par structure et
`null` n'y figure pas. Son offre reste en Gestion d'actifs. Ce n'est pas un
défaut de la redirection, mais celui que le contrôle « deux tables » signale
déjà, et il se répare en typant la maison.

### Mesure

Contre-test **22/22** sur `classify()`. Effet global sur les 7 105 brutes :
**0 perdue, 0 déplacée** — la redirection ne bouge rien sur la récolte
actuelle, parce qu'aucune offre de relations investisseurs n'y est encore
chez une entreprise. Havas était la première, et elle n'était pas branchée.

---

## 45bis. …et le lendemain, on ne la range plus : on l’écarte

**Tranché le 14/09/2026 par Victor**, en voyant les deux offres en ligne :

> « Vire-moi ces 2 offres relations investisseurs. Ça passe que dans des
> gros groupes de PE ou très très grosses boîtes AM. »

Le §45 répondait à **où la ranger**. La vraie question était **faut-il la
publier**. Chez une société cotée ou un assureur, les relations
investisseurs sont de la communication financière — publier les résultats,
tenir le consensus, recevoir les analystes. Le §30 les laisserait passer
(ça produit de l'information financière), mais ce n'est pas ce que le site
vise : la finance junior de marché, de deal et de gestion.

### La mesure a donné sa FORME à la règle

L'écriture naturelle — ne garder que `fonds` et `societe-gestion` —
emporterait **cinq intitulés au lieu de deux**, dont exactement ceux que la
raison de Victor veut garder :

| intitulé | structure | ce que c’est vraiment |
|---|---|---|
| « Investor Relations Intern - **Five Arrows** » (Rothschild & Co) | `banque-affaires` | Five Arrows EST le bras de private equity |
| « Stage Investor Relations » (Oddo BHF) | `bfi` | Oddo BHF AM est une des grosses maisons de gestion françaises |

**Une structure de maison mère ne dit pas le métier de sa filiale.** D'où la
règle écrite à l’endroit : on nomme les deux structures **qu’on écarte**,
`entreprise` et `assurance`, où le doute n’existe pas. Partout ailleurs le
titre décide, comme au §45.

```js
const IR_HORS_PERIMETRE = new Set(['entreprise', 'assurance']);
```

### Mesure

Contre-test **18/18**. Sur la récolte du 14/09 (7 244 brutes) : **2**
intitulés écartés — Coface et Havas, les deux nommés — et **14 gardés**,
dont Five Arrows et Oddo BHF. Rien d’autre ne bouge chez Coface (18 gardées
sur 22) ni chez Havas (15 sur 112).

> **Ce que ce §45bis apprend, et qui dépasse le cas :** une règle de
> périmètre s’écrit en nommant ce qu’on ÉCARTE quand les exceptions sont
> nombreuses et mal typées, et ce qu’on GARDE quand elles sont rares et
> nettes. Ici la liste des maisons légitimes est longue et leur structure
> ment (une banque d’affaires qui héberge un fonds) ; la liste des maisons
> illégitimes est courte et leur structure dit vrai.

---

## 46. Quatre offres seniors en vitrine, quatre défauts sans rapport

**Ouvert le 15/09/2026 par Victor**, capture d'écran à l'appui : « c'est
5 ans d'xp là comment t'as pu laisser passer ça » (Thales), « c'est la même
offre et encore 3-5 ans d'expérience » (CIC), « ya encore une offre à la
banque de France à 10 ans d'expériences ».

Le réflexe était d'accuser le juge de séniorité. Il n'y était pour rien :
`dureeExperienceMax` et `passesJuniorFilter` lisaient correctement tout ce
qu'on leur donnait. **Le défaut était en amont, dans ce qu'on leur donnait**
— et il s'est révélé être quatre défauts distincts, qui n'ont en commun que
leur symptôme.

### 46.1 — La fiche était coupée à 4 000 caractères

`ficheJsonLd` tronquait la description avant de la rendre.

```
description réelle de Thales      6 289 caractères
ce que le juge en voyait          4 000
« au moins 5 ans d'expérience »   vers 4 700
_expMax obtenu                    null
```

Thales et la Banque de France ouvrent leur annonce par une longue
présentation du groupe : le profil recherché — la seule partie qui dit le
niveau — tombait après la coupe.

Le dépôt portait **déjà cette leçon**, appliquée au cache de fiches : « un
rejeu ne voyait alors que 4 000 caractères là où une vraie collecte en lit
14 000 — 72 rejets de séniorité au rejeu contre 181 ». Elle n'avait jamais
été appliquée au chemin de collecte. `LIMITE_DESCR_FICHE = 14000` aligne les
deux.

### 46.2 — « Une dizaine d'années » n'était pas un nombre

L'offre Banque de France « Analyste dossiers d'agréments » n'était pas
concernée par la coupe : sa fiche fait **2 853 caractères**. Son texte dit
« vous disposez d'une dizaine d'années d'expérience », et `_expMax` rendait
`null`. Deux trous, un seul symptôme : « dizaine » manquait à
`NOMBRES_ECRITS`, et le motif exigeait le nombre **collé** à son unité alors
qu'en français la quantité approximative s'y relie par une apostrophe.

Mesure sur les 644 fiches du 14/09 — la population juste, ce sont les textes
que le second passage a réellement lus : **une seule** mention de quantité
approximative, et c'est celle-là. Après correction, 270 → 271 fiches datées
d'un chiffre, le seau « 10 ans » passe de 47 à 48, rien d'autre ne bouge.

### 46.3 — Une entité HTML était BLANCHIE, pas décodée

Le plus grave des quatre, et le seul qui ne se voyait nulle part.

`texteDeLaPage` remplaçait toute entité par une **espace**. Le moteur e-i.com
du Crédit Mutuel encode tous ses accents en `&#233;` :

```
la page dit   « Expérience professionnelle antérieure de 3 à 5 ans »
le juge lit   « Exp rience professionnelle ant rieure de 3   5 ans »
```

Or l'ancre du juge est `/exp[ée]rien/i`. Le mot n'existait plus, la phrase
entière était sautée, et le « 3 à 5 ans » n'était jamais compté.

**Ce n'était pas un défaut d'affichage, c'était un défaut de lecture** :
chaque ancre de ce mécanisme est un mot français accentué — « expérience »,
« années ». Toute page à entités numériques lui était donc muette. C'est la
règle « UN CHAMP ABÎMÉ EST UN SYMPTÔME » retournée : ici rien n'était abîmé
à l'écran, parce que le texte abîmé ne s'affiche jamais.

`decodeEntities` existait depuis toujours dans le même fichier, dix-huit
cents lignes plus haut. Il n'avait simplement jamais été appelé aux trois
endroits qui lisent une page.

### 46.4 — « Team Leader » n'était pas un marqueur

On n'encadre pas une équipe à zéro an. Mesure sur les 3 417 intitulés
normalisés du 14/09 : **8 touchés, dont 5 déjà pris** par « manager » ou
« responsable ». Le motif en ajoute 3 — HSBC et Deloitte. Il vit dans
`SENIOR_RE` **seule**, qui ne se consulte que pour les CDI/CDD : un stage
d'assistant reste un stage.

### Ce que l'ensemble a coûté, et rapporté

Audit complet sur les 374 offres CDI/CDD publiées, le chemin refait sur
chacune, **avant et après, avec le même instrument** :

| | avant | après |
|---|---:|---:|
| jugées junior | 263 | 256 |
| **écartées** | **2** | **9** |

### Ce que cet épisode apprend

> **Un symptôme unique n'annonce pas une cause unique.** Quatre offres
> seniors en vitrine, quatre mécanismes sans rapport : une troncature, une
> table de nombres, un décodage de texte, un marqueur d'intitulé. S'arrêter
> à la première trouvée — la troncature, la plus spectaculaire — aurait
> laissé les trois autres en place, et elles couvraient **sept** des neuf
> offres.

Et le corollaire de méthode, payé trois fois dans la séance : **l'instrument
se fait dire non-zéro sur un cas connu AVANT de servir.** Le premier audit a
rendu « 0 offre senior » avec 370 erreurs d'analyse avalées ; le second a
rendu « 0 touché sur 7 244 » en lisant un champ qui n'existe pas dans la
récolte brute. Les deux chiffres étaient lisibles, présentables, et faux. Le
troisième audit commence par Thales et refuse de tourner si Thales passe.

---

## 47. Le doublon de marque : une offre est son NUMÉRO, pas son domaine

**Ouvert le 15/09/2026 par Victor** : « c'est la même offre ».

`canonicalKey` vaut `slugEmp|slugTitre|lieu`. Le nom de l'employeur fait
partie de la clé, donc **deux offres identiques publiées sous deux noms ne
peuvent jamais se dédupliquer.** `CLAUDE.md` le portait comme piège depuis
des semaines. Le moteur e-i.com du Crédit Mutuel Alliance Fédérale l'a
réalisé : il sert la même annonce depuis trois domaines.

Au catalogue du 15/09 : 13 offres eicards publiées, **quatre numéros
d'annonce parus deux fois** — sous CIC et sous Crédit Mutuel. Le contrôle
« une URL, un employeur » ne voyait rien : les adresses diffèrent par leur
hôte.

### Pourquoi on ne débranche pas un domaine

Mesure directe sur les trois listes :

| | offres | en propre |
|---|---:|---:|
| CIC | 15 | 4 |
| Crédit Mutuel | 15 | 4 |
| Banque Transatlantique | 8 | 7 |

CIC × Crédit Mutuel : **11 numéros en commun**. Débrancher le CIC coûterait
les 4 annonces qu'il est seul à servir. Ce n'est pas un hôte de trop, c'est
une **identité mal choisie**.

### Ce qui est posé

Sur ce moteur, une offre est son numéro d'annonce. `canonicalKey` le rend
tel quel, et `dedupe` fait le reste — il fond l'offre, note l'autre domaine
dans `alsoOn`, et inscrit le rejet au registre avec son motif.

La liste des hôtes est **close**, et volontairement : le chemin
`/fr/offre.html?annonce=N` suffirait à reconnaître le moteur, mais un autre
client d'e-i.com aurait sa propre numérotation.

> **Une clé trop large ne se paie pas d'un doublon, elle se paie d'une offre
> PERDUE** — deux annonces sans rapport fondues l'une dans l'autre, et
> aucune trace. C'est l'asymétrie qui commande : un doublon se voit à
> l'écran, une fusion à tort ne se voit nulle part.


---

## 48. Sept infractions de plus : ce qu'on trouve quand on cesse de mesurer sur ses propres cas

**Ouvert le 15/09/2026 par Victor**, après le §46 : *« J'ai vérifié mes 9
infractions contre le catalogue republié : 2 parties, 7 encore là. Tes 4
corrections étaient bonnes, mais elles portaient sur les 4 cas repérés à
l'œil. Voici l'autre population. »*

C'est le reproche le plus juste qu'on puisse faire à une correction, et il
vise exactement la règle que ce dépôt écrit depuis des semaines — **« sur
quelle population ? »**. Le §46 avait mesuré l'effet de ses quatre correctifs
sur les offres qu'il savait fautives, et jamais sur celles qu'il ne savait pas
fautives. La mesure était juste ; la conclusion — « c'est réparé » — ne l'était
pas.

### Ce que les sept ont révélé : quatre mécanismes de plus

Le détail phrase par phrase est en **partie II de `corpus-etiquetage.md`**,
qui est désormais le registre des tournures. Ici, les arbitrages.

#### 48.1 — L'ancre n'est pas un mot, c'est une adresse au candidat

Deux annonces n'écrivent jamais « expérience ». Caisse d'Épargne Bourgogne
Franche Comté : « le/la candidat(e) retenu(e) **devra disposer** d'une
expertise technique … d'une durée d'au moins 5 ans ». Forvis Mazars : « **vous
justifiez** d'au moins 5 à 7 ans en Cabinet d'Expertise-Comptable ».

Victor proposait d'élargir l'ancre à `expérience | expertise | pratique |
ancienneté`. **Mesuré sur la récolte du 15/09, ce lexique ne tient pas** :

| mot | phrases nouvelles | ce qu'elles disent |
|---|---:|---|
| `expertise` | 396 | presque toutes le CABINET — « notre expertise couvrant… 3 000 consultants, 48 bureaux » |
| `pratique` | 67 | « mettre en pratique », « bonnes pratiques » |
| `ancienneté` | **0** | motif inerte |
| `séniorité` | **0** | motif inerte |

Deux motifs inertes de plus auraient donné l'illusion d'une couverture — le
défaut déjà nommé pour `\bfinanc\b` et `\bcommodit\b`, transposé au
vocabulaire.

> **Ce qui distingue une exigence d'un boniment n'est pas son vocabulaire,
> c'est qu'elle s'adresse au candidat.** L'ancre retenue est donc
> grammaticale : « vous justifiez / disposez / êtes », « le candidat devra »,
> « exigé », « au moins », « minimum », « à partir de », le symbole `>` collé
> à un nombre, le grade « confirmé ».

Coût mesuré : 404 phrases nouvelles, dont la quasi-totalité **ne portent aucun
nombre**. L'ancre ouvre la porte ; le compteur, lui, ne trouve rien.

#### 48.2 — Le contexte négatif se juge sur le VOISINAGE, jamais sur la phrase

Première version : une phrase contenant « avantages », « mutuelle » ou « nos
3 000 collaborateurs » était sautée en entier. Elle a fait **repasser 18
offres correctement écartées**, dont un actuaire AG2R dont l'annonce enchaîne
sans le moindre point :

> « Vous êtes de formation BAC +5 en actuariat et avez **au minimum 5 ans
> d'expérience**, Vos avantages Une politique de rémunération… »

Les annonces n'ont pas de points. L'exigence et les avantages tiennent dans la
même « phrase », et jeter la phrase jetait l'exigence.

> **La règle :** un contexte disqualifiant porte sur le VOISINAGE du nombre —
> soixante caractères avant, trente après — exactement comme `FAUX_AMIS`. Ce
> qu'on disqualifie est un nombre dans son contexte, jamais un paragraphe.

C'est la sœur de « un contrôle qui compare un rendu neutralise d'abord ce qui
varie » : la bonne granularité est celle de l'objet jugé.

#### 48.3 — La borne basse ouverte

« 3 ans ou plus » rendait 3, qui n'est pas supérieur à trois : publié. Mais
« trois ans **ou plus** » ne demande pas trois ans, il en demande au moins
trois.

Le verdict porte désormais `_expOuverte`, et la décision rejette à
**l'égalité** avec le plafond quand la borne est ouverte. Sous le plafond, une
borne ouverte ne dit rien de gênant : « minimum 2 ans » reste junior.

Formes couvertes : `X ans ou plus`, `X ans minimum`, `minimum X ans`, `au
moins X ans`, `à partir de X ans`, `>Xans`, `X+ ans`, `dès X ans`, `at least X
years`.

**Deux de ces formes étaient inertes pour la raison déjà fichée** : `\b` est
ASCII, donc `\bà partir de` ne trouve aucune frontière devant le « à », et
`exigé\b` aucune après le « é ». Troisième et quatrième occurrence du même
piège en cinq jours.

#### 48.4 — Le grade que l'intitulé de liste a perdu

RSM publie « Consultant Expertise Conseil » et écrit dans le corps : « Votre
rôle : **Consultant Comptable Senior H/F** ». Entre le titre de liste et celui
que l'annonce se donne, c'est l'annonce qui engage l'employeur.

Mesuré **avant** de poser la règle, comme Victor l'a demandé : 13 offres
touchées sur 3 407, dont **2 seulement** passaient le filtre — les deux RSM
signalées. Aucun autre effet.

Ce qu'on ne cherche pas : le mot « senior » quelque part, qui figure dans
presque toutes les annonces de cabinet. On cherche un **titre de poste** :
grade + mention de genre, ou introduit par « votre rôle : », « le poste : »,
« en tant que ».

#### 48.5 — Le champ le plus court n'est pas la description

Make Up For Ever arrivait avec **13 caractères** de description : le
connecteur LVMH lisait `requiredExperience` (« Minimum 3 ans ») et ignorait
`profile` (1 250 caractères), qui dit « au moins 5 ans d'expérience en
comptabilité ».

Les 73 offres LVMH étaient dans ce cas. Et l'effet est double, les deux fois
silencieux :

- le juge de séniorité ne lisait que treize caractères ;
- une description **présente**, si courte soit-elle, vaut « annonce lue » — pour
  `passesJuniorFilter` comme pour `aCompleter`, qui ne va chercher la fiche
  d'un CDI que sous 1 500 caractères. Elle éteignait le doute au lieu de
  l'éveiller.

> **Un champ court est plus dangereux qu'un champ absent.** L'absence déclenche
> un rattrapage ; la brièveté le désarme.

### La mesure d'ensemble

Sur les 3 232 offres de la récolte du 15/09 portant une adresse, avant contre
après, avec le même instrument :

| | avant | après |
|---|---:|---:|
| passent le filtre junior | 1 573 | **1 434** |
| **écartées en plus** | — | **139** |
| repêchées à tort | — | **0** |

Dont 113 sur la seule borne ouverte à trois ans, vérifiées sur pièce.

### Ce qui reste hors de portée, et il faut le dire

**Banque Populaire du Sud n'est pas réparable par la lecture.** Sa phrase
« confirmé (>3ans) » n'est ni dans l'API OpenDataSoft — dont le champ
`description` fait 3 859 caractères et ne la contient pas — ni dans la page,
`recrutement.bpce.fr` rendant **3 077 octets de coquille JavaScript**. Le motif
la reconnaîtra le jour où le texte sera atteignable ; aujourd'hui il ne l'est
pas. C'est la même famille que les 105 fiches muettes d'`ETAT.md`.

### Ce que cet épisode apprend

> **Une correction se mesure sur la population, jamais sur les cas qui l'ont
> motivée.** Le §46 avait vérifié ses quatre offres et conclu que le défaut
> était réparé. Les quatre l'étaient ; le défaut ne l'était pas. La bonne
> vérification n'est pas « mes cas passent-ils ? » mais « que devient le
> catalogue entier ? » — et elle se lit en deux nombres : combien d'offres
> changent de verdict, et combien changent dans le MAUVAIS sens. C'est ce
> second nombre, resté à zéro, qui autorise à publier.


---

## 49. Fermer une classe de défauts au lieu de la réparer

**Ouvert le 15/09/2026 par Victor**, après le §48 : *« Le `\b` contre les
accents — mets-le sous contrôle, ne le répare plus. C'est la 3e et la 4e
occurrence en cinq jours. La classe se ferme une fois, pas à chaque
découverte. »*

C'est la même exigence que celle déjà écrite dans `CLAUDE.md` — « quand une
règle a été enfreinte quatre fois, ce n'est plus une règle qu'il faut, c'est
un mécanisme » — appliquée cette fois à un piège de code et non à un geste de
méthode.

### 49.1 — Le contrôle des limites de mot

`ingestion/test-limites-mot.js` relit les motifs de `pipeline.js`,
`classifier.js` et `sources.js` — **3 187 limites de mot** — et échoue si l'une
d'elles peut toucher une lettre accentuée.

**Au premier passage il en a trouvé cinq, toutes vivantes :**

| le motif | ce qu'il ne matchait pas |
|---|---|
| `d[ée]riv[ée]s?\b` | « produit dérivé » au singulier |
| `\bconfirm[ée]e?s?\b` | « confirmé » |
| `\bexp[ée]riment[ée]e?s?\b` | « expérimenté » |
| `\b[ée]coles?\b` | « École » (pipeline) |
| `\b[ée]cole\b` | « École » (sources) |

Les deux du milieu avaient été écrites **le jour même**, dans le §48. Le piège
se reforme à la vitesse où l'on écrit.

**La difficulté qui rendait le contrôle non trivial** : le caractère qui
précède un `\b` peut être OPTIONNEL. Dans `exig[ée]e?s?\b`, le dernier
caractère ÉCRIT est `?` ; le dernier caractère POSSIBLE est le `é` de la
classe. Un contrôle qui ne regarderait que le voisin immédiat ne verrait rien
— et c'est exactement ce qui avait laissé passer ce cas. Le contrôle remonte
donc les quantificateurs jusqu'au premier atome non optionnel, des deux côtés.

**Sa portée est bornée, et c'est écrit dedans.** `\bfinanc\b` et
`\bcommodit\b` sont tout aussi inertes, mais **entièrement ASCII** : ce qui
cloche n'est pas un accent, c'est qu'un radical réclame une frontière au
milieu d'un mot. Les détecter demanderait un lexique français, que ce dépôt
n'a pas et ne veut pas. Deux épreuves de l'instrument l'établissent **en ne
signalant rien** sur ces deux motifs.

> **Un contrôle doit déclarer ce qu'il ne couvre pas, sinon on le croit plus
> large qu'il n'est et l'on cesse de chercher ailleurs.** C'est le pendant de
> « un contrôle qu'on n'a jamais vu échouer n'est pas vérifié » : celui-là
> porte sur ce qu'il attrape, celui-ci sur ce qu'il laisse.

### 49.2 — Le champ étroit : LVMH avait un jumeau

Victor : *« Mesure la longueur MÉDIANE de description par connecteur. Tout
connecteur à médiane très basse est un LVMH qui s'ignore. »*

**La première mesure répondait à la mauvaise question** — elle donnait la
longueur de la description de LISTE, alors que le juge voit la liste PLUS la
fiche quand elle a été lue. Corrigée, elle donne :

| médiane | offres | champ lu | connecteur |
|---:|---:|---|---|
| **14** | 23 | `experience` | **avature** |
| 450 | 3 | `description` | smartrecruiters:revaia |
| 868 | 149 | `description` | smartrecruiters:mazars |
| 1 490 | 37 | `externalDescription` | cornerstone:eurazeo |

**Avature est le jumeau exact de LVMH** : il lit `experience` — « Minimum
3 ans », quatorze caractères — et c'est toute sa description. Sa source n'a
aucun autre champ de texte, mais **sa page rend 7 316 caractères** : le texte
existe, on n'allait pas le chercher.

Les SmartRecruiters, eux, sont **sous le seuil de 1 500** et déclenchent donc
déjà le rattrapage de fiche. Une médiane basse n'est pas un défaut en soi —
c'est la médiane basse QUI DÉSARME LE RATTRAPAGE qui en est un. Les médianes
à zéro (les Workday) sont saines pour la même raison.

**La correction est générale et non propre à Avature** : une description de
**moins de 300 caractères compte comme absente**, pour tous les onglets. Trois
cents caractères ne portent pas un profil, ils portent une étiquette. Coût
mesuré : 30 fiches de plus à visiter, devant 633 déjà lues.

### 49.3 — Les liens morts : le coût n'était pas le sujet

`linkStatus` valait « unknown » sur la totalité du catalogue depuis cinq
jours. La cause n'était pas le coût, c'était la FORME de la boucle :
séquentielle, 1 052 offres à dix secondes de délai maximum, soit près de trois
heures dans le pire cas. Personne n'a donc jamais passé `--check-links`, et le
garde-fou est resté décoratif.

**Mesuré : 1 052 liens en 1 minute 07**, un hôte à la fois et douze hôtes en
parallèle. Et **onze liens morts**, tous en 404 — dix La Banque Postale, dont
le schéma d'adresse a changé, et un Butagaz.

> **Un garde-fou trop cher pour être allumé est un garde-fou absent.** Et le
> prix n'est pas toujours celui qu'on croit : ici il tenait entièrement à une
> boucle séquentielle, pas au nombre de requêtes. Avant de renoncer à un
> contrôle pour son coût, mesurer le coût.

La vérification est désormais l'ordinaire du passage, **sous un budget de six
minutes** : au-delà on s'arrête, et ce qui reste garde « unknown » — la seule
valeur qui ne retire rien. Le budget n'est pas décoratif : le chiffre d'une
minute a été pris sur une machine de bureau, et « une durée ne se mesure que
sur le réseau qui la subira ». Un hôte portant 138 offres qui cesserait de
répondre coûterait vingt-trois minutes à lui seul.

### 49.4 — Deux points de périmètre

**« Entrepreneur AXA »** — huit offres publiées. `INDEPENDANT_RE` portait
`\bentrepreneur\s+en\b`, qui attrapait « Entrepreneur EN Gestion de
Patrimoine » et laissait passer « Entrepreneur AXA spécialisé en… ». Le motif
devient `\bentrepreneurs?\b` : **46 intitulés touchés sur 3 407, tous chez
AXA**, tous des mandats de franchise. « Entrepreneurship Programme » n'est pas
touché — la limite de mot tombe après « entrepreneur », et « ship » la lui
refuse.

**« Conseiller Clientèle Patrimonial » (Caisse d'Épargne CEPAC)** — la cause
n'était pas une règle manquante mais une EXEMPTION trop large.
`PREFILTER_EXCEPTIONS` porte `\bpatrimonial(e)?\b` pour protéger la banque
privée du préfiltre retail ; elle protégeait donc aussi le conseiller
d'agence.

|  | avant | après |
|---|---:|---:|
| « conseiller de clientèle patrimoniale » | 3 | **0** |
| « conseiller en gestion de patrimoine » | 91 | **91** |
| « conseiller patrimonial » tout court | 6 | **6** |

> **La banque privée ne parle jamais de sa « clientèle patrimoniale ».** Elle
> dit gestion de patrimoine, ingénierie patrimoniale, banquier privé. C'est le
> mot « clientèle » qui trahit le réseau — et c'est lui, et lui seul, que
> l'exemption refuse désormais.

C'est le piège « une exclusion écrite pour une maison en pénalise une autre »
pris par l'autre bout : **une EXEMPTION écrite pour un métier en protège un
autre**, et elle se relit avec la même question — « dans un réseau d'agences,
ce mot veut dire quoi ? ».

### 49.5 — Pennylane : la mesure dit qu'il n'y a rien à faire

Victor signalait « 26 lignes pour 2 postes sur 26 villes, à regrouper à
l'affichage ». Le regroupement existe et fonctionne : `index.html` porte
**deux cartes `card-groupe`**, l'une à 14 pastilles de ville, l'autre à 12, et
le regroupement par annonce fond **964 cartes en 41 groupes**.

Rien n'a donc été changé, et c'est la bonne réponse. **Corriger ce qui marche
coûte deux fois** : le travail, et la confiance qu'on met ensuite dans les
mesures.
