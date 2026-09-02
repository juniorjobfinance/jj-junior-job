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
un mot de métier reconnu (, dans ). Cette
liste ignorait des mots que les règles de familles, dans , savent
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
