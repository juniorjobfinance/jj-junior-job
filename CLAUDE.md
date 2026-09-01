# JJ — Junior Job Finance

Site d'offres d'emploi junior en finance : **juniorjobfinance.com**.
Stage, alternance, VIE, premier CDI/CDD (0-3 ans d'expérience), en France.

Victor Heutte en est l'auteur. On échange **en français**.

---

## À lire avant de proposer quoi que ce soit

**`ETAT.md`** — où en est le projet : chiffres du catalogue, ce qui tourne, ce
qui reste à faire. C'est le point de départ de toute reprise.

**`DECISIONS.md`** — les onze arbitrages de fond, avec la mesure ou l'incident
qui a motivé chacun. Beaucoup de « bonnes idées » évidentes y ont déjà été
écartées pour des raisons chiffrées : les reproposer fait perdre du temps et
défait du travail.

`PROJET.md` — le brief fondateur (positionnement, périmètre, architecture).

Puis, pour le détail du jour : `git log --oneline -10` et le dernier journal
dans `journaux/`.

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
```

---

## Pièges vérifiés plusieurs fois

- **Écrire les scripts de modification avec l'outil Write, jamais en heredoc ni
  `node -e`.** Le shell y transforme `\b` en caractère backspace et produit des
  expressions régulières qui ne correspondent plus à rien, sans erreur.
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

---

## Ce qui reste à faire

Voir `DECISIONS.md` et les fiches mémoire. En résumé au 02/09/2026 :
l'alternance est le point faible (56 offres sur 759), 76 maisons de référence
sur 153 ne servent encore rien, et les chantiers de visibilité (Search Console,
données structurées, analytics) sont volontairement reportés.
