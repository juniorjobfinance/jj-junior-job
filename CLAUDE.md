# JJ — Junior Job Finance

Site d'offres d'emploi junior en finance : **juniorjobfinance.com**.
Stage, alternance, VIE, premier CDI/CDD (0-3 ans d'expérience), en France.

Victor Heutte en est l'auteur. On échange **en français**.

---

## Les quatre documents, et ce que chacun sait

Un seul sujet par fichier : dupliquer une information, c'est se condamner à en
maintenir deux versions et à en croire la mauvaise.

| Fichier | Répond à | Change |
|---|---|---|
| **`CLAUDE.md`** (ce fichier) | que dois-je savoir avant d'agir ? | rarement |
| **`ETAT.md`** | où en est-on aujourd'hui ? | à chaque séance |
| **`DECISIONS.md`** | pourquoi a-t-on tranché ainsi ? | à chaque arbitrage |
| **`PROJET.md`** | pourquoi ce site existe-t-il ? | jamais |

**Le code fait foi sur l'implémentation** — les listes de familles et de
structures, les seuils, les maisons branchées. Aucun document ne les recopie :
ils y renverraient une version périmée. `PROJET.md` en avait recopié, ce qui
l'a rendu faux en trois jours.

Ordre de lecture pour reprendre : **`ETAT.md`**, puis `DECISIONS.md` si l'on
veut changer une règle, puis `git log --oneline -10` et le dernier journal dans
`journaux/` pour le détail du jour.

**Beaucoup de « bonnes idées » évidentes ont déjà été écartées pour des raisons
chiffrées** — rebrancher La Bonne Alternance, assouplir le filtre d'expérience,
ajouter des portails Oracle « pour voir ». Elles sont dans `DECISIONS.md` avec
leur mesure. Les reproposer fait perdre du temps et défait du travail.

---

## À ÉCRIRE avant de s'arrêter — obligatoire

La mémoire d'une conversation fond : le contexte se compacte régulièrement et
les échanges anciens disparaissent. Ce qui n'est pas écrit dans le dépôt est
perdu. **Cette tenue à jour n'est donc pas une politesse, c'est le seul support
durable du projet.**

À la fin de chaque séance de travail, sans qu'on ait à le demander :

1. **Réécrire `ETAT.md`** — les chiffres du catalogue (les mesurer, ne pas les
   recopier), ce qui a bougé, ce qui reste. Toujours daté.
2. **Compléter `DECISIONS.md`** si un arbitrage de fond a été tranché : une
   règle, un seuil, une source qu'on renonce à brancher. Y écrire la mesure ou
   l'incident qui l'a motivé, jamais l'opinion seule.
3. **Compléter la section « Pièges » de ce fichier** si une erreur a coûté un
   passage — pour qu'elle ne soit pas refaite.
4. **Committer et pousser.** Un fichier à jour sur le disque ne protège de rien.

Les messages de commit portent le détail : ce qui était cassé, par quel
mécanisme, ce qui le corrige. Ils sont faits pour être lus dans six mois.

---

## Les trois règles qu'on ne discute pas

1. **Le lien mène toujours à l'annonce chez l'employeur.** Jamais LinkedIn,
   Indeed, Welcome to the Jungle, JobTeaser, France Travail. C'est le moat du
   site.
2. **On ne contourne aucun pare-feu ni robots.txt.** Bpifrance, Morgan Stanley
   et Alvarez & Marsal sont hors d'atteinte, et le restent.

   **Un pare-feu peut trier sur l'EN-TÊTE, et alors il est invisible.** Le
   08/09/2026, `talents.bpifrance.fr` a été mesuré « WordPress ouvert, lisible
   en fetch pur, 153 Ko, JSON-LD complet sur chaque fiche, 86 offres » — et la
   conclusion était de le brancher. Le même URL, avec l'en-tête que le dépôt
   envoie réellement (`UA_HTML`, « Mozilla/5.0 (compatible; JJ job board) »),
   rend **403 en 919 octets**. Ma sonde se présentait en Chrome.

   Les deux hôtes de Bpifrance refusent donc, mais pas de la même façon :
   `bpifrance.fr` ferme franchement, `talents.bpifrance.fr` ouvre aux
   navigateurs et ferme aux robots qui se nomment. La seule manière de le lire
   serait de **se déguiser en navigateur qu'on n'est pas** — c'est un
   contournement, pas une lecture, et la règle 2 l'interdit.

   C'est « ne jamais mesurer avec un instrument plus PUISSANT que celui qui
   travaille », d'un cran plus fin : rester en Node ne suffit pas, il faut
   aussi **le même en-tête**. Un sondage se fait avec `UA_HTML`, jamais avec
   une chaîne de navigateur — sinon on promet des gisements que le passage de
   6h30 ne trouvera pas. Vérifié le même jour sur RSM, Carmignac et Groupama :
   eux répondent à l'identique aux deux en-têtes, Bpifrance était le seul à
   trier.

3. **Moins d'offres, mais toutes justes.** 0-3 ans, datées, vérifiées. Un
   durcissement qui fait chuter le catalogue est un succès, pas un incident.

---

## Comment tourne le site

Personne n'a besoin d'être devant l'écran : GitHub Actions lance
`node ingestion/pipeline.js` chaque matin à **06h30 Paris** (cron `30 4 * * *`
UTC), commite `offres.js`, et Vercel déploie.

Le code est du **Node.js pur, zéro dépendance** — pas de `node_modules`, pas de
`package.json`. Aucune IA n'intervient dans le fonctionnement quotidien.

**Un connecteur par PLATEFORME, jamais par entreprise.** Une maison de plus est
une ligne de configuration dans `ingestion/sources.js`.

---

## Commandes utiles

**Avant de pousser une règle de classement, lancer LES DOUZE SUITES** du
contrôle 1, pas un sous-ensemble choisi. Elles sont listées dans
`.github/workflows/mise-a-jour-quotidienne.yml`, et c’est ce fichier qui fait
foi — pas la mémoire de la séance précédente. Le 14/09/2026 le cron a échoué
sur un motif validé la veille : quatre suites avaient été lancées, la CI en
lançait neuf, et le cas qui mordait vivait dans `test-echantillon.js`.

**Corollaire, du même incident : une mesure faite sur la RÉCOLTE DU JOUR ne
remplace pas les suites.** La récolte ne contient que ce qui a été publié ce
matin-là ; les suites portent des cas historiques, choisis parce qu’ils ont
déjà cassé quelque chose. Un motif validé « 0 dégât sur la récolte » n’est
pas validé.

```bash
node ingestion/pipeline.js              # passage complet (~18 min)
node ingestion/pipeline.js --forcer     # publier malgré le garde-fou (baisse voulue)
node ingestion/sonder-carrieres.js "Nom:domaine.com"   # trouver la plateforme d'une maison
node ingestion/valider-maisons.js candidats.json       # vérifier AVANT de brancher
node ingestion/atelier.js "Intitulé" "Employeur"      # pourquoi une offre passe ou non
```

---

## Règle de méthode : tout script passe par Write

**Aucun script — de modification, d'analyse, de mesure — ne s'écrit en `node -e`
ni en heredoc. On écrit un fichier avec l'outil Write, et on l'exécute.**

Ce n'est pas une précaution à peser au cas par cas : c'est le geste par défaut,
y compris pour trois lignes, y compris pour un script jetable, y compris pour
RÉPARER un script cassé.

La raison est mécanique : le shell mange les antislashs. `\b` devient un
caractère backspace, `\s` devient `s`, `\\[` devient `[`. On obtient des
expressions régulières qui ne correspondent plus à rien — **sans la moindre
erreur**. Le script s'exécute, annonce « ancre absente », et on cherche le
problème dans le fichier cible au lieu de le chercher dans sa propre commande.

Cette règle figurait déjà comme piège, en tête d'une liste de vingt. Elle a été
enfreinte **trois fois dans la même séance** du 3 septembre 2026, après avoir
été relue. Un piège se reconnaît ; un geste s'exécute. C'est pour ça qu'elle est
remontée ici, hors de la liste, et formulée à l'affirmative.

Le corollaire, moins visible et tout aussi coûteux : **une ancre se copie depuis
le fichier, jamais de mémoire.** Les apostrophes y sont tantôt droites tantôt
typographiques, les fins de ligne tantôt `\n` tantôt `\r\n`, et un fichier peut
porter `’` en toutes lettres là où on croit voir une apostrophe. Lire les
octets avant d'écrire l'ancre coûte dix secondes ; les chercher après en coûte
dix minutes.

### Un MESSAGE DE COMMIT passe par un fichier, jamais par `printf`

Même famille que ci-dessus, même remède, et c’est la **troisième** fois de la
semaine qu’un formatage de chaîne mange du contenu en silence — après
`String.replace` et les heredocs.

Le 07/09/2026, un `git commit -m "$(printf ...)"` a produit un message tronqué
à **326 caractères sur 1 900**. `printf` est mort sur le `%` de « 53 % », qui
est pour lui un caractère de format. Le commit est parti, poussé, avec un
message qui s’arrête au milieu d’une phrase — et **git n’a rien signalé**,
parce que du point de vue de git le message était simplement court.

La forme sûre, sans exception :

```bash
git commit -F chemin/vers/message.txt   # fichier écrit avec l’outil Write
```

**Et `-m` n’est pas plus sûr que `printf`.** Le 13/09/2026, un
`git commit -m "…"` a perdu quatre fragments de code du message : le shell a
pris les accents graves pour une substitution de commande et les a exécutés.
Le commit est parti, poussé, avec quatre trous là où se trouvaient les noms
de fonctions — et git n’a rien signalé, le message lui paraissant simplement
plus court. Or un message de commit de ce dépôt cite presque toujours du
code entre accents graves. **La règle n’est donc pas « éviter `printf` »,
c’est `-F` et rien d’autre.**

`%`, `\n`, `\t`, `%s` : tout caractère de format est un piège, et le message
de commit est précisément l’endroit où l’on écrit des pourcentages et des
chemins. Réécrire l’historique pour une phrase coupée ne vaut pas un
`push --force` : la seule protection est de ne pas produire le défaut.

**La règle générale que ces trois cas dessinent** : dès qu’un contenu compte,
il s’écrit dans un fichier avec Write, puis on désigne le fichier. Le shell,
`printf` et `String.replace` interprètent tous quelque chose, et aucun ne
prévient quand il l’a fait.

### Sur de la PROSE, aucune expression régulière — troisième couche

`CLAUDE.md`, `ETAT.md`, `DECISIONS.md` et toute documentation **ne se modifient
jamais par `replace` avec une expression régulière.** On édite le fichier
directement, ou on utilise :

```js
src.split(litteral).join(remplacement)
```

qui n'interprète **rien** : ni `$&`, ni `$1`, ni un accent, ni une apostrophe
typographique.

**Pourquoi cette règle existe alors que deux autres la couvraient déjà.** Le
04/09/2026, cinq scripts de modification ont échoué sur le même terrain, et
tous éditaient de la prose par expression régulière — jamais du code. Trois ont
corrompu `CLAUDE.md` lui-même, commité et poussé : la puce du piège `$&`
réduite à « - * », celle de l'instrument à « $1 », celle de l'alternance à
« $1 Le contrat démarre ».

Les deux premières couches n'ont pas suffi :

1. **une règle** — « toujours passer une fonction à `replace` » — qu'on oublie
   au moment où elle servirait ;
2. **un mécanisme** — comparer le texte avant et après, annoncer les octets —
   qui rend le raté visible *après coup*, sans l'empêcher.

La troisième couche ne demande ni mémoire ni vigilance : **elle retire le
danger.** Un `split`/`join` ne peut pas manger un groupe capturé, parce qu'il
n'y a pas de groupe.

Le code, lui, garde ses expressions régulières : il est syntaxiquement
contraint, une erreur s'y voit à l'exécution. La prose ne proteste jamais —
elle se contente d'être fausse, et d'être poussée.

*Cette règle a été écrite dans ce fichier par un `split`/`join`.*

### Toute vérification compare un APRÈS à un AVANT

**Lire l'état final seul ne prouve rien : on ne sait pas s'il était déjà là.**

Le 04/09/2026, le même défaut a pris quatre formes en une journée, et il a
fallu les quatre pour le voir comme une famille :

| ce qu'on a lu | ce qui manquait |
|---|---|
| `CLS = 0` | l'instrument n'avait jamais été vu rendre autre chose que 0 |
| `+ 0 octet` | « 3 septembre » et « 4 septembre » ont la même longueur |
| « déjà fait » | la garde matchait un mot présent AVANT le changement |
| « 117 offres » après un clic | le compteur affichait déjà 117 avant |

Les quatre lectures étaient exactes. Les quatre conclusions étaient fausses,
parce qu'aucune ne comparait.

**La forme correcte, partout :**

```js
const avant = mesurer();
agir();
const apres = mesurer();
// et c'est l'ÉCART qu'on rapporte, jamais « apres » seul
```

Cela vaut pour un fichier qu'on modifie (comparer le texte, pas seulement sa
longueur), pour un compteur qu'on lit après un clic, pour un instrument dont
on croit le zéro — **le faire dire non-zéro sur un cas connu avant de le
croire** — et pour un contrôle qu'on ajoute : on ne l'a pas vérifié tant qu'on
ne l'a pas vu échouer.

C'est la même exigence que « un contrôle qu'on n'a jamais vu échouer n'est pas
vérifié », généralisée : **un instrument, une garde, un compteur et un contrôle
sont la même chose — quelque chose qui prétend savoir. Aucun ne se croit sur
parole.**

**Et la cinquième forme, qui a suivi le jour même : comparer un après à un
avant ne suffit pas, il faut les comparer DANS LA MÊME UNITÉ.** Une mesure de
déplacement du classifieur rendait « 912 déplacements sur 912 » : elle
comparait le LIBELLÉ stocké dans `offres.js` (« Gestion d'actifs ») au CODE
rendu par `classify()` (« gestion-actifs »). Les deux valeurs étaient justes,
la comparaison était vide de sens. Avant de conclure d'un écart, vérifier que
les deux membres se mesurent avec la même règle — même champ, même unité, même
échelle.

**Sixième forme, et la plus silencieuse : l’unité peut être fausse sans que
rien ne soit invalide.** Le 06/09/2026, le passage a refusé de publier parce
que le connecteur Bank of America était tombé de dix offres à zéro. Ni le
réseau ni l’employeur : leur API date en **MM/JJ/AAAA**, le pipeline lit en
**JJ/MM/AAAA**. Une offre publiée le 1ᵉʳ septembre — `09/01/2026` — devenait le
9 janvier, vieille de 240 jours au lieu de 5. Les dix ont franchi le seuil
d’âge le même matin, et le garde-fou a mordu.

Ce qui distingue ce cas des cinq autres : **les deux lectures étaient valides.**
Le champ existait, la fonction rendait une date, aucune erreur n’a été levée.
Une seule des quatorze dates était auto-révélatrice — `07/29/2026`, où le 29 ne
peut pas être un mois. Sans ce 29, la source aurait menti indéfiniment.

**Une unité ambiguë se déclare, elle ne se devine pas.** `07/03/2026` est
valide en JJ/MM comme en MM/JJ ; aucune inspection de la valeur ne tranchera
jamais. Le format se décide donc par SOURCE, une fois pour toutes, au même
endroit que son URL — jamais offre par offre, et jamais par un cas particulier
greffé sur la fonction de lecture.

Et le corollaire de méthode, pour l’auditer : **la preuve d’un format est un
nombre qui dépasse 12.** Second nombre > 12 : américain. Premier nombre > 12 :
européen. Aucun des deux : indécidable — et c’est là que le silence commence.

**LA PREUVE PAR CONCORDANCE, quand aucun nombre ne dépasse 12.** Le
corollaire ci-dessus est muet sur « 09/01/2026 » : ni 09 ni 01 ne tranchent,
et c’est précisément le cas de Bank of America. Il existe pourtant une preuve,
et elle est plus forte que l’inspection d’une valeur :

> **Quand deux champs décrivent la MÊME offre et qu’un seul est ambigu, le
> non-ambigu prouve l’autre.** La liste de BofA dit `2026-09-01` en ISO, sa
> fiche dit `09/01/2026` : la fiche est donc en MM/JJ/AAAA. Dix offres sur dix
> l’ont confirmé le 08/09/2026.

Les paires utilisables sont partout dans le pipeline : **la liste et la fiche**
(le cas de BofA), un champ ISO et un champ à barres dans le même objet JSON,
ou la même offre servie par deux connecteurs. La condition est unique : les
deux champs doivent porter sur la **même annonce**, pas sur deux annonces du
même employeur.

Ce qu’elle ne fait pas : elle ne tranche pas quand le jour ÉGALE le mois
(« 07/07 »), ni quand aucun des deux champs n’est non ambigu. Appliquée le
08/09 à Marsh McLennan, HSBC et BCG — trois sources laissées sans déclaration
« faute de preuve » —, elle a montré qu’il n’y avait **rien à prouver** :
leurs dates sont en ISO des deux côtés. Une source sans date ambiguë n’a pas
besoin de déclaration, et le noter ferme le sujet au lieu de le laisser
ouvert.


---

### UN CONTRÔLE QUI COMPARE UN RENDU neutralise d’abord ce qui varie

Le 08/09/2026, le contrôle du catalogue HTML — **bloquant** — a rendu un
faux échec, et l’alerte est remontée jusqu’à « le site sert le catalogue
d’hier, 72 offres sont invisibles pour Google ». Il n’en était rien.

Il comparait, au caractère près, le bloc de cartes présent dans `index.html`
à celui que le gabarit régénère. Les 924 caractères d’écart se
décomposaient ainsi :

| ce qui différait | caractères | est-ce du contenu ? |
|---|---:|---|
| `\r\n` contre `\n` (checkout Windows, `core.autocrlf=true`) | 916 | **non** |
| « Publiée il y a **5** jours » contre « **4** jours » | 8 | **non** |
| le catalogue lui-même | **0** | — |

**Aucun des deux n’est du contenu.** Les fins de ligne viennent du système
de fichiers ; la date relative et sa classe (`recente` / `moyenne` /
`ancienne`) se calculent par rapport à MAINTENANT — le rendu était donc
vrai à l’instant de sa génération et dérivait avec l’horloge.

Conséquence : **le contrôle échouait depuis toute machine Windows, et
quelques heures après le passage.** Il passait à 6h30 sur Linux, à
l’instant même de la génération, et nulle part ailleurs.

> **Un contrôle bloquant qui ment est pire qu’un contrôle absent : on
> apprend à l’ignorer.** On passe des jours à faire qu’aucun rejet ne soit
> muet et qu’aucune alerte ne soit décorative ; une alerte qui crie à tort
> défait tout ce travail, parce qu’elle enseigne que les alertes se
> contournent.

**La règle :** avant de comparer deux rendus, neutraliser des DEUX CÔTÉS ce
qui varie sans que le contenu change — les fins de ligne, l’horodatage,
tout libellé relatif au moment présent. Ce qui reste comparé est le
contenu, et lui seul.

```js
const neutraliser = (t) => String(t)
  .replace(/\r\n/g, '\n')
  .replace(/<div class="carte-date [a-z-]*">[\s\S]*?<\/div>/g, '§DATE§');
```

**Et la contre-épreuve, sinon on remplace un contrôle bruyant par un
contrôle sourd.** Sept défauts provoqués, quatre de contenu (carte retirée,
intitulé tronqué, employeur changé, URL changée) et trois de bruit (libellé
de date, classe de date, fins de ligne). Les sept doivent se comporter comme
prévu — 7/7 le 08/09. Faire taire un contrôle sans vérifier qu’il entend
encore, c’est le supprimer en croyant le réparer.

C’est le pendant de « un contrôle qu’on n’a jamais vu échouer n’est pas
vérifié » : **un contrôle qu’on n’a jamais vu se taire à tort ne l’est pas
non plus.**

---

### Ne jamais mesurer avec un instrument plus PUISSANT que celui qui travaille

Le 07/09/2026, une page carrières a été lue **au navigateur** et déclarée
riche de « 24 offres, dont 14 à Paris ». Le même jour, `ETAT.md` disait à sa
ligne 326 que cette plateforme était **sans API lisible**. C’est la ligne 326
qui avait raison.

Un `fetch` Node pur — ce que le pipeline fait à 6h30 — rend **2 422 octets de
coquille**, deux `<script type="module">`, aucune charge JSON, zéro offre. La
page d’une annonce précise rend le même document que la liste. L’API répond
`401`. Le navigateur voyait des offres parce qu’il **exécutait le JavaScript
qui appelle l’API authentifiée**.

**La règle :**

> Un portail se juge avec l’outil qui le lira en production, jamais avec un
> outil plus capable. Un navigateur exécute le JavaScript, suit les
> redirections, porte des cookies et une session — le pipeline ne fait rien de
> tout cela. **Un portail lu au navigateur n’est pas un portail lu.**

C’est « ne jamais recopier une fonction du pipeline pour la tester »,
généralisé de la fonction à l’OUTIL. Et le symptôme est le même dans les deux
cas : une mesure qui promet un gisement que le passage du matin ne trouvera
jamais.

Corollaire pratique : le sondage d’un site carrières se termine **toujours**
par un `fetch` Node sur la page de liste ET sur une annonce. Si les deux
rendent le même document, c’est une application JavaScript : hors d’atteinte,
et cela se note avant d’aller plus loin.

### LE RÉSEAU FAIT PARTIE DE L’INSTRUMENT

Le 08/09/2026, un connecteur a été chronométré à **47 minutes** un coup et
**10,7** le suivant, pour la même charge. J’en ai tiré « la source est lente
et sa latence varie d’un facteur quatre », posé un budget de temps, et
presque refusé de la brancher.

Les deux mesures avaient été prises **à travers un partage de connexion
4G**. Le passage réel tourne sur GitHub Actions, dans un centre de données.
Aucun des deux chiffres ne dit quoi que ce soit du coût réel.

C’est « ne jamais mesurer avec un instrument plus PUISSANT que celui qui
travaille » d’un cran plus loin. On avait déjà étendu la règle du MOTEUR
(navigateur contre `fetch` Node, le cas Stifel) à l’EN-TÊTE (`UA_HTML`
contre une chaîne de navigateur, le cas Bpifrance). Elle va plus loin
encore :

> **Une DURÉE ne se mesure que sur le réseau qui la subira.** Le moteur et
> l’en-tête décident de ce qu’on OBTIENT ; le réseau décide de ce que ça
> COÛTE. Les deux se vérifient séparément, et une mesure de temps prise
> ailleurs que là où le travail tournera n’est pas une mesure — c’est une
> anecdote.

Le remède n’est pas de mieux chronométrer depuis ici : c’est **de faire
écrire le chiffre par le passage lui-même**. Un connecteur qui annonce au
journal ce qu’il a visité et le temps qu’il y a mis rend la question
inutile — le vrai chiffre arrive tout seul le lendemain matin.

Corollaire pour les budgets : tant qu’on n’a pas le chiffre du passage, un
budget se règle **large**. Un budget serré sur une mesure fausse coupe une
source saine.

---

### SUR QUELLE POPULATION ? — la première question de tout contrôle

**Un contrôle qui inspecte la SORTIE ne peut jamais détecter ce que
l’ENTRÉE a perdu.** Il cherche ses défauts parmi les survivants, et le
défaut qu’il cherche est précisément ce qui n’a pas survécu.

Ce n’est pas une anecdote : c’est le même défaut **trois fois**, sur trois
sujets sans rapport.

| le contrôle | population lue | ce qu’il ne pouvait pas voir |
|---|---|---|
| les deux tables | catalogue publié | un employeur dont *toutes* les offres meurent à la porte — les 28 de RSM |
| le compte « 3 offres perdues » | catalogue publié | les offres perdues, par définition absentes du catalogue |
| les maisons muettes | catalogue publié | la différence entre « ne publie rien » et « pas branchée » — Chanel y a dormi |

À chaque fois la mesure était **juste** et la conclusion **fausse**, parce
que la population ne contenait pas le sujet.

> **La règle :** avant d’écrire un contrôle, demander *sur quelle
> population travaille-t-il, et cette population contient-elle le défaut
> qu’il cherche ?* La réponse est presque toujours « celle d’AVANT le
> filtre, pas celle d’après » — la récolte, pas le catalogue.

**L’exception, et elle est nette :** un contrôle dont le SUJET EST
l’artefact produit lit légitimement la sortie. Vérifier qu’`index.html`
est syntaxiquement valide, que les dates publiées sont en ISO, ou que le
texte des annonces ne fuite pas — ce sont des propriétés du fichier, pas
des offres qu’il aurait perdues. Relecture des dix-sept sections de
`controle-avant-passage.js` le 08/09/2026 : six ne lisent que la sortie,
**cinq à juste titre**, et la sixième — « une URL, un employeur » — voyait
le mal sans voir la cause. Elle lit désormais les deux : le catalogue en
échec (un doublon publié arrête la publication), la récolte en alerte (un
désaccord de nom, avant qu’il nuise).

**Le corollaire opératoire :** un contrôle branché sur la bonne population
change de chiffre, pas seulement de portée. Les deux tables passaient de
**zéro** signalement à **six** le jour où on leur a donné la récolte.

---

### UN CHAMP ABÎMÉ EST UN SYMPTÔME, pas un défaut d’affichage

Le 13/09/2026, sept intitulés Citi et six Rothschild étaient publiés en
bouillie — « Banking financing equity capital markets placement analyst
paris », « Compliancerisk officer mwd schwerpunkt risk management ». Ces
quatre connecteurs lisent leur liste en mode `depuisLien` : le titre n’est
pas lu, il est **reconstruit depuis le slug de l’adresse**.

Le réflexe était d’embellir la reconstruction. Deux mesures l’ont démenti.

**Le vrai titre était déjà là.** Le découpage prend tout ce qui va de
`<a href="…">` à `</a>` : le texte du lien est dans le bloc, et personne ne
le lisait. Chez Citi il porte l’intitulé complet, virgules et capitales
comprises. La correction ne coûtait aucune requête.

**Et surtout, l’adresse servait AUSSI de preuve de nationalité.** Le filtre
pays s’écrivait `… : cfg.depuisLien || /france/i.test(o.lieu)` : lire sa
liste par les liens valait laissez-passer. Mesuré le même jour :
**25 des 49 cartes Rothschild sont en France**, et quatre des six offres
publiées étaient à Luxembourg, Francfort, Londres et Dubaï. La règle 1 du
site, enfreinte en silence depuis que ce connecteur existe.

> **La règle :** quand une valeur arrive abîmée, ne pas demander « comment
> l’embellir » mais **« par quelle porte est-elle entrée, et qu’est-ce que
> cette porte ne vérifie pas ? »**. Un champ dégradé signale une lecture
> approximative, et une lecture approximative ne s’arrête jamais à un seul
> champ.

C’est la sœur de « un champ lu doit être un champ demandé ». Celle-là dit
qu’un champ peut RÉPONDRE AUTRE CHOSE ; celle-ci dit qu’un champ visiblement
faux en accuse d’autres qu’on ne regarde pas, parce qu’eux ne se voient pas.
Le titre criait ; le pays se taisait.

**Le corollaire, qui aurait suffi à l’éviter :** un mode de LECTURE ne dit
rien du CONTENU. Qu’on lise une liste par ses liens, par ses attributs ou par
ses motifs ne prouve ni la nationalité, ni la date, ni la séniorité. Toute
condition de la forme « si on lit comme ça, alors c’est bon » est un
laissez-passer déguisé. Ce qui est vrai se déclare — `paysImplicite` — et se
déclare **par source**, comme le format de date et le nom de champ.

---

## Pièges vérifiés plusieurs fois

- **`String.replace` réinterprète `$&` et `$'`** dans le texte inséré. Un `$'` a
  déjà dupliqué tout un fichier. Toujours passer une fonction :
  `s.replace(a, () => b)`.
  **Et ses deux faces cachées, qui ont corrompu CE fichier trois fois le
  04/09/2026, commitées et poussées.** Passer une fonction empêche bien `$&`
  et `$'` d'être réinterprétés, mais :
  1. dans une fonction, **`$1` n'est pas interprété non plus** — il reste
     littéral et le groupe capturé est perdu ;
  2. le premier argument de la fonction est la **chaîne matchée, pas un
     tableau** : `m[1]` y rend le deuxième CARACTÈRE.
  Les deux erreurs ont remplacé des lignes entières par « $1 », puis par un
  tiret, puis par une astérisque. La forme sûre est de capturer d'abord et de
  n'utiliser la fonction que pour insérer :
  `const m = src.match(re); src.replace(re, () => texte + m[1])`. Plus sûre
  encore quand elle suffit : `src.split(litteral).join(remplacement)`, qui
  n'interprète rien du tout.
- **`\b` est ASCII** : il voit une limite entre le « h » de « March » et le « é »
  de « Marchés ». Utiliser `(?![A-Za-zÀ-ÿ])`.
- **Les apostrophes des annonces sont typographiques (`’`)**, pas `'`.
- **UNE LIMITE DE MOT APRÈS UN RADICAL empêche le radical de matcher le mot
  complet.** `\bfinanc\b` ne matche jamais « finance » ; `\bcommodit\b` ne
  matche jamais « commodities ». Le `\b` exige une frontière juste après le
  radical, et il n’y en a pas au milieu d’un mot.

  Deux fois en trois jours, les 11 et 13/09/2026, et la seconde dans une
  liste d’exemption : « Digital Trader Commodities » chez JPMorgan sortait du
  périmètre alors que l’exemption était écrite pour le garder. **Le motif ne
  se plaint pas** — il est simplement inerte, et on croit avoir couvert un
  vocabulaire qu’on n’a pas couvert.

  La forme juste est `commodit\w*`, ou l’énumération explicite
  (`commodity|commodities`). Et la règle qui les couvre toutes : **un radical
  se termine par `\w*`, jamais par `\b`.** Le `\b` ne se pose qu’après un mot
  entier.

  C’est la sœur de « `\b` est ASCII » ci-dessus : l’un se trompe sur les
  lettres accentuées, l’autre sur les mots tronqués. Les deux rendent un
  motif silencieusement faux.

  **Ce qui l’a attrapé les deux fois : le contre-test, pas la relecture.**
  Un motif inerte est invisible à l’œil et évident dès qu’on lui soumet le
  mot complet. C’est précisément à ça que sert un cas attendu « garde » à
  côté des cas attendus « écarte ».
- **UN GARDE-FOU TROP CHER POUR ÊTRE ALLUMÉ EST UN GARDE-FOU ABSENT — et le
  prix n'est pas toujours celui qu'on croit.** `linkStatus` valait « unknown »
  sur les 1 052 offres du catalogue, cinq jours durant, parce que la
  vérification vivait derrière `--check-links` que personne ne passait jamais.
  La raison invoquée était le coût : mille cinquante-deux requêtes à dix
  secondes de délai maximum.

  Le coût réel, mesuré : **1 minute 07**, un hôte à la fois et douze hôtes en
  parallèle. Le prix ne tenait pas au nombre de requêtes mais à la FORME de la
  boucle, qui était séquentielle. Le premier balayage a trouvé **onze liens
  morts**.

  **Avant de renoncer à un contrôle pour son coût, mesurer le coût** — et le
  mesurer sur la forme qu'on lui donnerait, pas sur celle qu'il a. Le
  corollaire : tout contrôle branché dans le passage porte un BUDGET de temps,
  au-delà duquel il s'arrête en laissant la valeur qui ne retire rien. Sans
  budget, un seul hôte devenu muet suffit à faire tomber le passage entier.
- **UN CONTRÔLE DOIT DÉCLARER CE QU'IL NE COUVRE PAS.** `test-limites-mot.js`
  ferme la classe « `\b` contre une lettre accentuée » — quatre occurrences en
  cinq jours, cinq défauts vivants trouvés le jour de son écriture, dont deux
  écrits le matin même. Mais `\bfinanc\b` et `\bcommodit\b` sont tout aussi
  inertes et **entièrement ASCII** : les détecter demanderait un lexique
  français.

  Deux épreuves de l'instrument l'établissent **en ne signalant rien** sur ces
  deux motifs, et la portée est écrite en tête du fichier. Sinon on croit le
  contrôle plus large qu'il n'est, et l'on cesse de chercher ailleurs.

  C'est le pendant de « un contrôle qu'on n'a jamais vu échouer n'est pas
  vérifié » : celui-là porte sur ce qu'il ATTRAPE, celui-ci sur ce qu'il
  LAISSE.
- **UNE CORRECTION SE MESURE SUR LA POPULATION, JAMAIS SUR LES CAS QUI L'ONT
  MOTIVÉE.** Le 15/09/2026, quatre offres seniors signalées à l'écran ont été
  corrigées, vérifiées une par une, et déclarées réparées. Victor a alors
  vérifié les siennes : **deux parties, sept encore là**, par quatre
  mécanismes de plus.

  Les quatre cas passaient. Le défaut, lui, ne passait pas — il vivait chez
  des offres qu'on ne savait pas fautives, et qu'on n'avait donc pas
  regardées. C'est « SUR QUELLE POPULATION ? » retourné contre le correctif :
  on avait mesuré la SORTIE de la correction (mes cas sont-ils réparés ?) au
  lieu de son EFFET (que devient le catalogue ?).

  **La forme juste, et elle tient en deux nombres** : rejouer le catalogue
  entier avec l'ancien code et avec le nouveau, puis rapporter *combien
  d'offres changent de verdict* et *combien changent dans le MAUVAIS sens*.
  C'est le second qui autorise à publier — 139 et **0** le 15/09. Un
  correctif dont on ne connaît que le premier chiffre n'est pas mesuré.

  Le mécanisme, pour n'avoir à s'en souvenir de rien : `atelier.js` accepte
  désormais qu'un rouage manque à une version du pipeline (il rend `undefined`
  au lieu de lever), ce qui permet de charger HEAD et le travail côte à côte.
  Sans cela, la comparaison était impossible — et c'est ce qui l'avait
  empêchée.
- **UN CHAMP COURT EST PLUS DANGEREUX QU'UN CHAMP ABSENT.** Le connecteur
  LVMH lisait `requiredExperience` — « Minimum 3 ans », **treize
  caractères** — comme description, alors que `profile` en fait 1 250 et
  porte les exigences. Les 73 offres LVMH arrivaient avec moins de 60
  caractères de texte.

  L'effet est double, et les deux fois silencieux : le juge de séniorité ne
  lisait que ces treize caractères, ET une description *présente* vaut
  « annonce lue » partout — pour `passesJuniorFilter`, qui accepte alors, et
  pour `aCompleter`, qui ne va chercher la fiche d'un CDI que sous 1 500
  caractères.

  **L'absence déclenche un rattrapage ; la brièveté le désarme.** Vérifier
  qu'un champ existe ne suffit donc pas : mesurer la distribution des
  LONGUEURS par source, et regarder les deux extrémités. 92 descriptions
  faisaient moins de 60 caractères, 407 faisaient exactement 4 000 — les unes
  trop courtes pour dire quoi que ce soit, les autres coupées.
- **CE QU'ON REMPLACE PAR UNE ESPACE, ON LE DÉTRUIT.** Trois endroits de
  `pipeline.js` blanchissaient les entités HTML — `.replace(/&#x?[0-9a-f]+;|&\w+;/gi, ' ')`
  — au lieu de les décoder. Sur le moteur e-i.com du Crédit Mutuel, qui
  encode tous ses accents en `&#233;`, le juge de séniorité lisait
  « Exp rience professionnelle ant rieure de 3   5 ans » là où la page dit
  « Expérience professionnelle antérieure de 3 à 5 ans ».

  Son ancre est `/exp[ée]rien/i`. Le mot n'existait plus, la phrase entière
  était sautée, et l'offre est parue malgré ses 3 à 5 ans exigés.

  **Ce qui rend ce défaut invisible : le texte abîmé ne s'affiche jamais.**
  « UN CHAMP ABÎMÉ EST UN SYMPTÔME » suppose qu'on VOIE le champ abîmé — un
  intitulé en bouillie crie. Un texte lu pour être jugé, et jeté ensuite, ne
  crie pas : il rend seulement un verdict trop indulgent. Tout texte destiné
  à être LU par une règle se vérifie donc sur un échantillon imprimé, jamais
  sur son seul verdict.

  Et la règle générale : **avant de remplacer quelque chose par une espace,
  demander si ce quelque chose portait du sens.** Une balise, non. Une
  entité, oui — c'est une lettre.
- **Un contrôle qui vérifie ce qui est PASSÉ ne peut pas voir ce qui NE
  PASSE PAS** — voir la règle « SUR QUELLE POPULATION ? » ci-dessus. Le
  contrôle des deux tables lisait le catalogue publié : RSM y a perdu
  vingt-huit offres, contrôle au vert.
- **Un champ lu doit être un champ demandé** : le pipeline lisait
  `raw.description` d'une API qui ne l'envoyait pas.
  **Et sa version multi-plateformes, qui coûte plus cher : LE MÊME NOM DE
  CHAMP dit deux choses selon la plateforme.** Le 08/09/2026, un compte des
  entités bâti sur le nom `tags3` a rendu **« 04/09/2026 », « 07/09/2026 »
  et trente-sept autres dates comme des employeurs** — « 51 entités
  divergentes, 41 à inscrire ». Chez AXA-Phenom `tags3` porte l’entité qui
  recrute ; chez Talentsoft il porte la date de publication. Après filtre :
  onze, pas cinquante et une.

  Le champ n’était pas absent, il n’était pas vide, il n’a levé aucune
  erreur — il **répondait autre chose**. Un nom de champ n’est donc pas un
  contrat : il se déclare **par SOURCE**, exactement comme le format de
  date, et jamais par plateforme. Mesuré le même jour : sur les cinq
  tenants Phenom de la récolte, seul AXA remplit `tags3` — une règle
  « chez Phenom, `tags3` porte l’entité » aurait donc été fausse dès le
  premier tenant qui le remplit autrement.
- **BRANCHER UNE FILIALE PEUT CRÉER DES DOUBLONS, parce que `canonicalKey`
  commence par le nom de l’employeur.** `canonicalKey` vaut
  `slugEmp(emp)|slugTitleFuzzy(title)|lieu` : le nom fait partie de la clé,
  donc **deux offres identiques publiées sous deux noms ne peuvent jamais se
  dédupliquer**. Si le parent publie déjà l’annonce sous le nom du groupe et
  qu’on branche la filiale, elle paraît deux fois.

  Avant de brancher une maison, donc : **le parent publie-t-il déjà ses
  offres, et si oui, les deux noms se normalisent-ils vers la MÊME chaîne ?**
  C’est ce que fait `normalize()` pour Amundi sous la liste du Crédit
  Agricole — et c’est pourquoi il n’y a aucun doublon aujourd’hui. C’était un
  heureux hasard tant que ce n’était pas une règle.

  Le contrôle « une URL, un employeur » de `controle-avant-passage.js` fait
  échouer le passage sur ce cas. Il ne demande à personne de s’en souvenir —
  et il ne crie pas sur une URL répétée sous le MÊME employeur, qui est le
  cas légitime d’une annonce ouverte sur deux sites (BPCE, quatre cas).
- **Vérifier avant de brancher.** Une configuration fausse ne casse rien : elle
  rend zéro offre en silence, et la maison paraît branchée.
- Le `Promise.all` de `fetchAllSources` est **destructuré** : ajouter un appel
  sans sa variable décale toute la liste et fait disparaître une source.
- **Ne jamais recopier une fonction du pipeline pour la tester.** Extraire
  `SENIOR_RE` ou `estGrandeVille` de son texte à coups d'expressions
  régulières a donné trois diagnostics faux dans la même séance : la copie
  accusait un filtre que le vrai pipeline laissait passer. Charger le vrai
  fichier avec `ingestion/atelier.js`.
- **Un tiret n'est pas un séparateur.** Le lieu était découpé sur le premier
  tiret rencontré : « Saint-Quentin-en-Yvelines - France » devenait « Saint »,
  et toutes les communes à nom composé disparaissaient — dont le second site
  de Crédit Agricole CIB. Ne couper que sur une virgule ou un tiret ENTOURÉ
  d'espaces. Même piège dans le retrait du suffixe « France », qui coupait
  « ile-de-france » en « ile ».
- **Une exclusion écrite pour une maison en pénalise une autre.** « quality
  analyst » avait été posé contre un ingénieur qualité industriel : il a
  écarté un « Data Quality Analyst » de banque. Toute exclusion se relit avec
  la question « et chez un dépositaire, ce mot veut dire quoi ? ».
- **Un paramètre de pagination peut être accepté sans effet.** `offset`, `from`,
  `start` et `skip` renvoyaient tous la PREMIÈRE page chez Phenom, sans la
  moindre erreur ; la boucle atteignait `totalCount` en relisant six fois les
  mêmes cent offres, et AXA ne servait que 100 de ses 560 offres. Toute boucle
  de pagination doit **s'arrêter quand une page n'apporte aucune offre
  nouvelle** : c'est le seul garde-fou qui démasque le cas.
- **`sources.js` a des fins de ligne mixtes.** Une ancre cherchée par égalité de
  chaîne (`src.includes(...)`) échoue sur les lignes en `\r\n`, et le script de
  modification s'arrête sur « pas dans l'état attendu » alors que le texte est
  bien là. Construire l'ancre en expression régulière, chaque saut de ligne
  écrit `\r?\n`.
- **Ne pas juger un doublon sur une clé tronquée.** Un contrôle bâti sur
  `JSON.stringify(raw).slice(0, 180)` a fait conclure à tort qu'Allianz
  paginait mal, et failli faire « corriger » un connecteur sain. Comparer sur
  un identifiant : `req_id`, `jobSeqNo`.
- **`sed` mange les antislashs comme le heredoc.** Corriger un script de
  modification avec `sed -i` a transformé `\\[` en `[` et produit un fichier
  illisible. C'est le même mécanisme que la règle de méthode ci-dessus, et
  elle couvre aussi ce cas : `sed -i` est un script en ligne comme un autre.
- **Une maison absente n'est pas forcément mal branchée.** Air Liquide ne
  servait rien : le réflexe était d'accuser le connecteur. Son API disait
  1 125 offres dans le monde et 292 en France — mais **4** en « Finance &
  Controlling » France. Le connecteur marchait ; la maison ne recrute pas en
  finance junior. Mesurer l'intersection métier × pays SUR L'API avant de
  toucher à la configuration.
- **Un nom de facette n'est pas un domaine.** Chez un industriel, la famille
  « HSE / Risk Mgt / Quality / Security » contient « Risk » sans avoir le
  moindre rapport avec le risque financier. L'ajouter parce qu'elle matche
  `/risk/i` rouvrirait le fourre-tout. C'est le piège des exclusions retourné :
  « chez un industriel, ce mot veut dire quoi ? »
- **`rendement.js` dit « publiable » pour `normalize()` + grandes villes**,
  pas pour le catalogue final : ni séniorité lue sur la description, ni seuil
  des 120 jours, ni déduplication. L'écart entre son total et `offres.js`
  n'est donc pas un stock récupérable tant qu'on ne l'a pas décomposé.
- **Une source « muette » peut mentir sur son volume.** Le rapport créditait
  `workday:santander` de 79 offres ; en direct elle en rend zéro. Les 79
  venaient du magasin de récoltes, qui ressert la dernière collecte pendant
  quatre jours. Toujours confirmer une source suspecte à l'entonnoir, en
  direct, avant de conclure.
- **Un zéro n'accuse pas le connecteur.** Deux fois dans la même heure le
  réflexe a été faux : Air Liquide ne servait rien parce qu'elle n'a que
  4 offres finance en France, et Santander parce qu'elle n'en publie
  simplement aucune — Victor l'a vu sur leur portail. Le seul diagnostic qui
  vaut est celui qui a REGARDÉ le site ou l'API de la maison ; écrire « le
  connecteur pointe dans le vide » sans l'avoir fait, c'est se condamner à
  réparer ce qui marche. Corollaire : **une maison sans poste ouvert est dans
  son état normal**, pas en panne. Le compte des « maisons muettes » n'est pas
  un compte de défauts.
- **Un mot ajouté au FILTRE D'ENTRÉE et un mot ajouté aux FAMILLES n'ont pas
  le même pouvoir de nuire.** « Stress test » manquait aux deux. Mis dans le
  filtre d'entrée, il a aussitôt fait passer « Ingénieur essais et stress test
  matériaux » (Safran), « Stress test engineer – structures » (Airbus) et
  « Stress Test Engineer mécanique » (Valeo) — le mécanisme exact qui avait
  gonflé le fourre-tout à 26,7 % le 2 septembre. Mis dans les FAMILLES seules,
  il est sans danger : il ne fait entrer personne, il range mieux ceux qui
  entrent déjà par une autre porte. **Enrichir les familles est peu risqué ;
  enrichir le filtre d'entrée demande de mesurer chez un industriel.**
- **`atelier.js` ne teste pas le filtre finance.** Ses portes (métier hors
  périmètre, niveau, famille, maison, séniorité) peuvent toutes dire « ok »
  sur une offre que `isFinanceOfferFor` écarte ensuite. Pour juger de
  l'entrée, appeler `isFinanceOfferFor(emp, titre)` directement.
- **Tout motif se teste contre le texte APRÈS normalisation, jamais contre le
  titre tel qu'il s'affiche.** `normalize()` met en minuscules, retire les
  accents, et remplace apostrophes et barres obliques par des espaces :
  « RFP Specialist » y devient « rfp specialist », « Alternant DCG / DSCG » y
  devient « alternant dcg dscg », « appels d'offres » y devient
  « appels d offres ». Le 04/09/2026, quatre motifs proposés sur dix-sept
  étaient donc **inertes** — `\bRFP\b`, `\bD[CS]CG\b`, `\bCFO advisory\b`,
  `\bBIC ?/ ?BNC\b` — parce que leur casse avait été recopiée depuis les
  titres affichés. **Un motif qui ne peut jamais matcher est pire qu'un motif
  faux : il ne se plaint jamais**, il n'attrape rien, et on croit avoir couvert
  un vocabulaire qu'on n'a pas couvert. Passer chaque motif par
  `normalize()` avant de le poser, sur un titre réel.
- **Une garde d'idempotence cherche la marque de l'état APRÈS changement,
  jamais un mot présent dans les deux états.** Une garde posée sur `'tags',`
  pour protéger un bloc qui contenait déjà `'familleId', 'structureId',
  'tags',` a annoncé « déjà fait » sur un fichier intact, et le contrôle est
  resté non modifié. **Trois fois dans la même séance** du 4 septembre 2026.
  Le seul moyen de s'en apercevoir est de **vérifier que le fichier a
  changé**, pas que la commande a réussi : comparer la longueur avant et
  après, et le dire quand elle est identique. Un script de modification qui ne
  sait pas dire s'il a modifié quelque chose ne vaut pas mieux qu'un contrôle
  qu'on n'a jamais vu échouer.

  **Et la leçon qui dépasse ce piège : quand une règle a été enfreinte quatre
  fois, ce n'est plus une règle qu'il faut, c'est un mécanisme.** Celle-ci a
  été violée une quatrième fois **une heure après avoir été écrite ici** — une
  garde cherchant « depuis un serveur tiers » a matché ce texte ailleurs dans
  la même page et laissé la ligne visée intacte. Une règle demande de s'en
  souvenir au bon moment ; c'est précisément ce qui manque au bon moment. La
  vraie réponse est le mécanisme qui ne demande à personne de se souvenir de
  rien : **tout script de modification compare la longueur du fichier avant et
  après, et l'annonce.** Un « + 0 octet » saute aux yeux là où un « déjà fait »
  se lit sans s'arrêter. Le compteur est la partie VISIBLE du mécanisme ; la partie FIABLE est la
  comparaison du texte avant et après, car deux versions de même longueur
  — « 3 septembre » et « 4 septembre » — rendent « + 0 octet » sans que rien
  soit anormal. Faire les deux : comparer pour décider, compter pour montrer. Quand un piège se répète malgré sa fiche, chercher le
  mécanisme, pas la formulation plus insistante.
- **Ne jamais canaliser dans `head` un script qui restaure quelque chose.**
  `head` ferme le tuyau après ses N lignes et tue le script par SIGPIPE :
  **il ne meurt pas proprement, il meurt au milieu**, et le `finally` qui
  devait remettre le fichier en état ne s'exécute jamais. Un script qui
  sauvegardait `index.html`, le tronquait pour éprouver un contrôle puis le
  restaurait a laissé le fichier à **425 cartes sur 832** — valide, affichable,
  et faux. Seul le contrôle du catalogue l'a vu, et c'était la première fois
  qu'un de ces contrôles mordait sur du réel et non sur une panne provoquée.
  Laisser ces scripts écrire toute leur sortie, et filtrer après coup.
- **Un instrument qu'on n'a pas éprouvé sur un cas connu ne mesure rien.**
  Le panneau de navigation renvoyait `CLS = 0` sur toutes les pages, y
  compris celle que Lighthouse notait à 0,317. Il a fallu **provoquer un
  décalage évident** — insérer un bloc de 400 px en tête de page — pour
  découvrir que l'observateur ne voyait rien du tout : ni entrée de peinture,
  ni décalage, sur aucune origine. Sans ce test, une demi-séance de mesures
  fausses concluait « ce n'est pas la police » alors qu'elle ne démontrait
  rien, et le diagnostic était écrit dans `ETAT.md` comme une piste établie.
  C'est le pendant exact de « un contrôle qu'on n'a jamais vu échouer n'est
  pas vérifié » : avant de croire un zéro, faire dire non-zéro à l'appareil.

  **Et le 15/09/2026, le même défaut a pris DEUX formes de plus dans la même
  heure, toutes deux rendant un zéro présentable.** Un audit de séniorité sur
  374 offres a rendu « 0 offre senior » avec **370 erreurs d'analyse
  avalées** — un `catch` englobait le réseau ET l'analyse, et la fonction
  appelée n'était pas exposée par `atelier.js`. Une mesure de motif a rendu
  « 0 touché sur 7 244 » en lisant `o.title` dans la récolte BRUTE, qui ne
  garde que `{ __src, emp, raw }` — le titre n'existe qu'après `normalize()`.

  Les deux chiffres étaient lisibles, plausibles, et faux. **Un zéro est le
  résultat le plus facile à produire par accident** : une erreur avalée, un
  champ absent, un motif inerte le rendent tous. La forme sûre est d'ouvrir
  la mesure par un TÉMOIN — un cas dont on sait la réponse — et de refuser
  de tourner s'il ne mord pas. Le troisième audit commençait par Thales et
  s'arrêtait si Thales passait ; c'est celui-là qui a rendu le bon chiffre.
- **L'alternance est SAISONNIÈRE.** Le contrat démarre en septembre, donc les
  annonces se publient de février à juillet. Un catalogue d'alternance maigre
  relevé en septembre ou en octobre ne prouve rien — c'est le creux du cycle.
  Ne jamais durcir, assouplir ni « réparer » quoi que ce soit sur la foi d'un
  compteur d'alternance lu à l'automne : la mesure qui compte est celle du
  printemps.
- **`<!--` est un commentaire JavaScript.** Borner une charge utile dans un
  `<script>` avec les marqueurs HTML habituels — `<!--JJ:X:DEBUT-->` — commente
  la ligne entière : c'est un vestige de 1996, quand on cachait les scripts aux
  navigateurs qui ne les comprenaient pas. Aucune erreur, aucun avertissement,
  la variable reste simplement `undefined`. Les bornes d'un bloc de JavaScript
  s'écrivent `/*JJ:X:DEBUT*/`. Corollaire : un contrôle qui se contente de lire
  la charge entre les bornes ne voit rien — il faut l'EXÉCUTER, comme le
  navigateur le fera.
- **Rien ne doit toucher au DOM au chargement d'`index.html`.**
  `ecrire-catalogue-html.js` évalue ce script avec un faux DOM pour en extraire
  le gabarit des cartes. Une IIFE qui appelle `querySelector` fait planter le
  pipeline avant qu'il écrive une seule carte. Tout branchement va dans
  `demarrer()`.
- **La fonction interrogée doit être la fonction qui décide.** Pour vérifier si
  cinq maisons avaient une structure, la mesure a appelé `inferSector` — qui
  rend un libellé PAR DÉFAUT — au lieu de `resolveStructure`, qui est la porte
  réelle. Les cinq paraissaient couvertes ; l'une ne l'était pas, et une autre
  l'était de travers. C'est « un champ lu doit être un champ demandé »,
  appliqué aux fonctions : avant de conclure, vérifier que la fonction
  interrogée est bien celle dont le pipeline lit le verdict.

- **`resolveStructure` resout par PREFIXE, sans limite de mot.** Egalite
  stricte d'abord, puis le préfixe le plus long — ce qui couvre bien
  « Caisse d'Épargne Hauts de France » sous `caisse d epargne`, et avale
  aussi ce qu'on n'avait pas prévu : la clef `alan` (Alan, la mutuelle
  santé) capturait **Alantra**, boutique M&A, et la rendait « fintech ».
  Aucune erreur, aucun signal : une maison publiée sous un type faux. Toute
  clef courte — `alan`, `axa`, `bpi`, `cnp` — est un préfixe pour des noms
  qu'on ne connaît pas encore. **Avant d'inscrire une maison, demander son
  type à `resolveStructure` : si elle répond déjà quelque chose alors
  qu'elle n'est pas dans la table, c'est un préfixe qui parle à sa place.**

- **Une clef d’employeur se vérifie contre le nom sous lequel l’employeur
  PUBLIE, jamais contre celui qu’on lui donne dans une conversation.** Le
  07/09/2026, trente-cinq clefs ont été écrites depuis une liste de noms
  courts. Trois étaient **inertes** : « sycomore am », « swiss life am
  france » et « marsh france ». Les employeurs publient sous « Sycomore Asset
  Management », « Swiss Life France » et « Marsh McLennan » — trois noms qui
  figuraient **déjà** dans la table. Les clefs écrites étaient des doublons
  sous des noms que personne n’écrit, et la vérification les avait déclarées
  « à ajouter » parce qu’elle interrogeait `resolveStructure` avec MA liste,
  pas avec la récolte.

  C’est exactement le défaut déjà nommé pour les motifs — « un motif qui ne
  peut jamais matcher est pire qu’un motif faux : il ne se plaint jamais » —
  et il donne ici la même illusion de couverture. **Le seul test valable est
  de chercher la clef dans la récolte réelle** : si aucun employeur collecté
  ne commence par elle, elle ne sert à rien, quel que soit le sérieux du nom.

  Et le corollaire qui ferme la boucle avec la découverte du même jour :
  **inscrire une maison dans `maisons.txt` et `structures.js` ne la BRANCHE
  pas.** Ces deux tables la CLASSENT si un connecteur la ramène, rien de plus.
  Sur les trente-cinq du lot, vingt-six n’apparaissaient nulle part dans la
  récolte : elles ne pouvaient rien rapporter, et ne le pouvaient pas avant
  qu’on les inscrive non plus. Le levier est dans `sources.js`, jamais dans
  les tables de classement.

---

## Ce qui reste à faire

**`ETAT.md`**, et lui seul. Ce paragraphe portait autrefois des chiffres —
nombre d’offres, maisons muettes, alternance — recopiés d’une séance de
septembre 2026. Trois jours plus tard ils étaient faux, et ils envoyaient
réparer ce qui marchait.

C’est la règle du haut de ce fichier, appliquée à lui-même : **un document
qui recopie un chiffre en maintient une version périmée.** Les chantiers
ouverts sont dans `ETAT.md`, les arbitrages dans `DECISIONS.md`.