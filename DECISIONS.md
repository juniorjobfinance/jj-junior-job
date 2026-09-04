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