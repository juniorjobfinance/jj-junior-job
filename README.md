# JJ Finance

Le vivier junior finance français : stages, alternances et CDI/CDD **0-3 ans d'expérience**
dans les métiers de la finance, en France.

**En ligne :** https://juniorjobfinance.vercel.app

## La règle du jeu

Un candidat qui clique sur une offre doit atterrir **sur l'annonce de l'entreprise**, pas
sur un job board intermédiaire qui lui redemandera de créer un compte. C'est la contrainte
qui décide de tout le reste : les sources retenues, les liens rejetés, et le badge
« via France Travail / Adzuna / Service Public » affiché quand ce lien direct n'existe pas.

Aujourd'hui : **75 % des offres pointent directement chez l'employeur.**

## Ce que le site fait

- **Périmètre** — une liste de référence de grandes maisons ([`ingestion/maisons.txt`](ingestion/maisons.txt)),
  celles que visent réellement les étudiants en finance. Une offre chez un employeur absent
  de cette liste n'entre pas.
- **Filtre junior** — les intitulés senior, confirmé, manager, « 5 ans d'expérience » sont
  écartés.
- **Fraîcheur** — 30 jours sur les agrégateurs, qui gardent des copies d'annonces déjà
  retirées ; 120 jours en lecture directe chez l'employeur, où la présence de l'annonce
  prouve qu'elle est encore ouverte. Une offre absente de trois passages consécutifs sort du
  site.
- **Aucun compte, aucun cookie, aucune publicité, aucune ressource externe.** La page ne
  fait qu'une requête, vers `offres.js`.

## Fonctionnement

```
ingestion/pipeline.js  →  normalise, classe, filtre, déduplique  →  offres.js
                                                                    offres.xml (flux RSS)
                                                                    sitemap.xml
index.html  →  lit offres.js  →  affiche
```

Aucune dépendance : Node natif, `fetch`, `fs`. Pas de `npm install`.

### Lancer en local

```bash
node ingestion/pipeline.js   # collecte et régénère offres.js
node dev-server.js           # http://localhost:5500
```

### Ajouter une entreprise

Le principe est **un connecteur par plateforme de recrutement**, pas un par entreprise.
Ajouter une maison, c'est donc ajouter une ligne de configuration :

```bash
node ingestion/detect-ats.js "Nom Entreprise"          # ATS à identifiant devinable
node ingestion/sonde-grandes-maisons.js --file liste.txt # Workday, TalentSoft, SuccessFactors…
node ingestion/verifier-ats.js greenhouse monslug       # garde-fou anti-faux-positif
```

Le détecteur produit beaucoup de faux positifs sur les identifiants courts — `air` renvoie
une société italienne, `bcg` un cabinet américain sans rapport. **Ne jamais coller une ligne
sans l'avoir passée au vérificateur.**

La ligne obtenue va dans `TARGET_COMPANIES` ([`ingestion/sources.js`](ingestion/sources.js)),
et la maison dans [`ingestion/maisons.txt`](ingestion/maisons.txt).

### Sources

France Travail · Adzuna · La Bonne Alternance · Choisir le service public · et les ATS
directs des entreprises : Workday, Greenhouse, Lever, SmartRecruiters, Recruitee,
Teamtailor, Ashby, Oracle Cloud, SAP SuccessFactors, TalentSoft, Phenom, Avature,
OpenDataSoft, sitemap + JSON-LD.

Le `robots.txt` de chaque site est vérifié avant toute lecture HTML. Les sites qui
l'interdisent ne sont pas lus, même quand un point d'accès existe.

## Mise à jour quotidienne

Une GitHub Action ([`.github/workflows/mise-a-jour-quotidienne.yml`](.github/workflows/mise-a-jour-quotidienne.yml))
lance le pipeline **deux fois par jour, à minuit et à midi** (heure de Paris), commite
`offres.js` et redéclenche
le déploiement Vercel. Les identifiants sont des secrets de dépôt — voir
[`.env.example`](.env.example) pour la liste.

Une variante locale existe pour Windows dans [`automatisation/`](automatisation/), utile
uniquement si l'Action n'est pas branchée.

## Choix de configuration

**`cleanUrls` est laissé à `false`** dans `vercel.json`. L'activer ferait servir
`/mentions-legales` sans extension, alors que le serveur de développement local sert les
fichiers par leur nom exact. Local et production divergeraient — et c'est exactement là que
se cachent les liens cassés qu'on ne découvre qu'après la mise en ligne.

JSON n'accepte pas de commentaires, et Vercel refuse tout champ hors de son schéma : la
raison d'un réglage se note ici, jamais dans `vercel.json`.

**Aucun `Cache-Control` n'est imposé sur `offres.js` et `offres.xml`.** Un
`s-maxage` sur ces deux fichiers les fige au bord du réseau *par-dessus les
déploiements* : le site a servi les offres de la veille pendant une heure après une mise à
jour. Le cache par défaut de Vercel, lui, est purgé à chaque déploiement — c'est
exactement ce qu'il faut pour des fichiers régénérés deux fois par jour.

## Phase 2

Le site est aujourd'hui restreint aux grandes maisons. Pour l'ouvrir aux PME et ETI :
passer `PHASE_GRANDES_MAISONS` à `false` dans [`ingestion/pipeline.js`](ingestion/pipeline.js).
Rien d'autre à changer.
