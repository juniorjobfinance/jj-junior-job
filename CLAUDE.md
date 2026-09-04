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

---

## Pièges vérifiés plusieurs fois

- **`String.replace` réinterprète `$&` et `$'`** dans le texte inséré. Un `$'` a
  déjà dupliqué tout un fichier. Toujours passer une fonction :
  `s.replace(a, () => b)`.
- **`\b` est ASCII** : il voit une limite entre le « h » de « March » et le « é »
  de « Marchés ». Utiliser `(?![A-Za-zÀ-ÿ])`.
- **Les apostrophes des annonces sont typographiques (`’`)**, pas `'`.
- **Un champ lu doit être un champ demandé** : le pipeline lisait
  `raw.description` d'une API qui ne l'envoyait pas.
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
  se lit sans s'arrêter. Quand un piège se répète malgré sa fiche, chercher le
  mécanisme, pas la formulation plus insistante.
$1
  Le panneau de navigation renvoyait `CLS = 0` sur toutes les pages, y
  compris celle que Lighthouse notait à 0,317. Il a fallu **provoquer un
  décalage évident** — insérer un bloc de 400 px en tête de page — pour
  découvrir que l'observateur ne voyait rien du tout : ni entrée de peinture,
  ni décalage, sur aucune origine. Sans ce test, une demi-séance de mesures
  fausses concluait « ce n'est pas la police » alors qu'elle ne démontrait
  rien, et le diagnostic était écrit dans `ETAT.md` comme une piste établie.
  C'est le pendant exact de « un contrôle qu'on n'a jamais vu échouer n'est
  pas vérifié » : avant de croire un zéro, faire dire non-zéro à l'appareil.
$1 Le contrat démarre en septembre, donc les
  annonces se publient de février à juillet. Un catalogue d'alternance maigre
  relevé en septembre ou en octobre ne prouve rien — c'est le creux du cycle.
  Ne jamais durcir, assouplir ni « réparer » quoi que ce soit sur la foi d'un
  compteur d'alternance lu à l'automne : la mesure qui compte est celle du
  printemps.

---

## Ce qui reste à faire

Voir `DECISIONS.md` et les fiches mémoire. En résumé au 02/09/2026 :
l'alternance est le point faible (56 offres sur 759), 76 maisons de référence
sur 153 ne servent encore rien, et les chantiers de visibilité (Search Console,
données structurées, analytics) sont volontairement reportés.
