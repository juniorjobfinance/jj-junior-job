# Où en est JJ

**Dernière mise à jour : 2 septembre 2026.**

Ce fichier dit l'état du projet à date. Il est réécrit à la fin de chaque
séance de travail — c'est la première chose à lire pour reprendre, et la
dernière à écrire avant de s'arrêter.

---

## Le catalogue en ligne

**759 offres** · **173 employeurs** · **78 maisons** servies sur 153 référencées.

| Onglet | Offres |
|---|---|
| Stage | 370 |
| CDI · CDD | 251 |
| VIE | 82 |
| Alternance | **56** ← le point faible |

**Qualité mesurée le 02/09/2026 :**
- 251/251 offres CDI-CDD portent leur contrat (CDI ou CDD, jamais les deux)
- 663/759 datées (87 %) ; les autres affichent « toujours en ligne chez
  l'employeur, date inconnue » et passent en fin de liste
- plus ancienne offre datée : 118 jours (un stage, seuil à 120)
- aucun poste au-dessus de 3 ans, aucun grade « Associate » de banque d'affaires

**Familles métier** — les 12 tiennent entre 3,6 % et 14,2 %, résidu « Autres »
à 3 %. **Types de structure** — les 11 sont peuplés, de 2,4 % à 19,6 %.

---

## Ce qui tourne tout seul

Passage quotidien à **06h30 Paris** (GitHub Actions → `pipeline.js` → commit →
Vercel). Une offre publiée par une maison branchée apparaît le lendemain ; une
offre retirée sort après trois jours d'absence.

Domaines : `juniorjobfinance.com` sert le site ; `www.` et
`juniorjobfinance.vercel.app` redirigent en 308 ; `http://` bascule en `https`.

---

## Ce qui reste à faire

**1. L'alternance (priorité).** 56 offres chez 28 employeurs seulement, alors
que les grandes banques françaises recrutent des centaines d'alternants. Un
compteur « Avant filtrage » a été posé dans le pipeline : sa sortie, dans le
journal du prochain passage, dira si on **perd** des alternances de maisons déjà
branchées ou s'il n'y en a réellement pas. C'est la première chose à regarder.

**2. Brancher des maisons.** 76 maisons de référence sur 153 ne servent rien.
À une dizaine d'offres par maison, en débloquer 30 à 40 mènerait le catalogue à
1 100-1 200 sans toucher à un seul filtre. Le canal qui marche : Victor repère
une offre sur LinkedIn, ouvre le lien vers le site de l'employeur, et l'envoie —
l'URL contient l'identifiant de la plateforme.

**3. Une offre morte dans `manuel.js`.** Le passage la signale à chaque fois ;
sa ligne est à retirer du fichier.

**4. Visibilité — reporté à la demande de Victor** (il est en phase de
conception). Aucun de ces chantiers n'est lancé : Google Search Console,
vérification que le pare-feu Vercel ne bloque pas Googlebot, données structurées
JobPosting, analytics, poids de `offres.js` (474 Ko).

---

## Hors d'atteinte, et pourquoi

**Pare-feu** — Bpifrance (CloudFront), Morgan Stanley (tal.net), Alvarez &
Marsal (Cloudflare). On ne contourne pas.

**Plateformes sans API lisible** — UBS (Taleo), Stifel (50skills), Alstom, Atos,
Exiom. Il faudrait écrire un connecteur pour chacune.

**McKinsey** — coupé volontairement : leur API sert des postes que leur propre
site déclare fermés.

**France Travail et La Bonne Alternance** — débranchés le 01/09, mesure refaite
le 02/09 : 26 offres finance sur les huit plus gros bassins, dont une seule
maison de finance. Voir `DECISIONS.md` §2.
