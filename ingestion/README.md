# Ingestion JJ

Pipeline de sourcing des offres, tourne 1x/jour (cron / GitHub Action). Voir
`PROJET.md` §7-8 pour le contexte complet.

## Fichiers

- `sources.js` — connecteurs par source (France Travail, La Bonne Alternance,
  ATS Greenhouse/Lever/SmartRecruiters). Retombe sur des données d'exemple tant
  que les identifiants / entreprises cibles ne sont pas configurés, pour un test
  entièrement hors-ligne.
- `pipeline.js` — orchestre les étapes ci-dessous et écrit `../offres.js`.
- `state.json` — généré à l'exécution, mémorise pour chaque offre canonique sa
  première/dernière apparition et son nombre de passages manqués consécutifs
  (sert au retrait des offres mortes). Ne pas éditer à la main.

## Étapes du pipeline

1. **Récupération** — appelle tous les connecteurs de `sources.js` en parallèle.
2. **Normalisation** — vers le schéma unifié :
   `{ emp, title, sector, famille, volet, loc, place, sal?, dl?, url, source, alsoOn? }`.
3. **Classement dans l'onglet** (`volet`) — déterministe : la source tranche si
   univoque (La Bonne Alternance → alternance), sinon le type de contrat, sinon
   un fallback par mots-clés de l'intitulé.
4. **Inférence** de la famille métier (les 9 familles) et du type de structure,
   par mots-clés / libellé ROME et par nom d'employeur.
5. **Filtre junior 0-3 ans** — stage/alternance/VIE sont juniors par nature ;
   pour CDI/CDD, on écarte les intitulés portant un signal senior/confirmé/≥4 ans.
6. **Déduplication** — clé canonique `entreprise + intitulé nettoyé + lieu`,
   avec normalisation des variantes de titre (H/F, CDI, etc.). En cas de
   doublon, on garde la source de vérité (ATS direct de l'entreprise en
   priorité) et on note les autres sources dans `alsoOn`.
7. **Fraîcheur & retrait des offres mortes** — chaque offre reçoit `verifiedAt`
   (dernier passage où elle a été vue). Une offre absente pendant 3 passages
   consécutifs est retirée. Avec le flag `--check-links`, un lien qui répond
   404/410 est retiré immédiatement ; une erreur réseau transitoire ne retire
   rien (marge anti-faux-positif).
8. **Écriture** de `../offres.js` (`window.__OFFRES__ = [...]`), lu directement
   par `index.html`.

## Lancer le pipeline

```bash
node ingestion/pipeline.js
node ingestion/pipeline.js --check-links   # vérifie aussi les liens en HTTP HEAD
```

## Câblage des sources réelles (v1)

- **France Travail** : créer une application sur francetravail.io, renseigner
  `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` en variables
  d'environnement.
- **La Bonne Alternance** : API publique, aucune clé requise.
- **ATS direct** : ajouter le token/tenant de chaque entreprise dans
  `TARGET_COMPANIES` (`sources.js`), par type d'ATS (un connecteur sert toutes
  les entreprises de ce type).
