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
