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
offre retirée **disparaît le lendemain aussi** — le pipeline ne publie que ce
qu'il vient de collecter, il ne réinjecte jamais une annonce qu'il ne voit plus.

Les trois jours de `MAX_JOURS_ABSENCE` ne retardent pas ce retrait : c'est la
durée pendant laquelle on se SOUVIENT de l'offre, pour ne pas la re-signaler
comme nouvelle si elle réapparaît après un hoquet d'API.

Ce qui protège d'une panne, ce sont les deux autres mécanismes : le magasin de
récoltes ressert la dernière collecte d'une source muette pendant quatre jours,
et le garde-fou refuse de publier si le catalogue s'effondre malgré tout.

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

**3. Radancy collecte mais rien n'est publié — mis en veille.** Le connecteur
rend six offres McDonald's, cinq Nestlé et trois Bouygues Telecom en appel
direct ; la famille est bien mise en file (« radancy 3 » dans le journal), la
page rend six mille caractères de texte, et pourtant aucune de ces offres
n'atteint le catalogue. Modjo, Rexel et Stellantis sont dans le même cas.
Diagnostic interrompu à la demande de Victor : ces maisons sont des directions
financières de groupes hors périmètre, trois à six offres chacune — le jeu n'en
vaut pas la chandelle. Le connecteur reste en place, écrit et testé.

**4. Une offre morte dans `manuel.js`.** Le passage la signale à chaque fois ;
sa ligne est à retirer du fichier.

**5. Visibilité — reporté à la demande de Victor** (il est en phase de
conception). Aucun de ces chantiers n'est lancé : Google Search Console,
vérification que le pare-feu Vercel ne bloque pas Googlebot, données structurées
JobPosting, analytics, poids de `offres.js` (474 Ko).

---

## Pistes ouvertes, à reprendre

**Bain — hors de portée, et pas seulement difficile.** Toutes les voies ont été
essayées : sitemap principal et sitemap campus (huit URL, aucune offre), pages
de liste, POST du formulaire, flux RSS et XML, recherche d'iframe ou de
domaine tiers. Leur liste n'existe qu'après exécution du JavaScript.

Et même en la trouvant, le pipeline ne pourrait pas la lire : il tourne sur
GitHub Actions en Node pur, sans navigateur. Y embarquer un navigateur headless
pour une seule maison multiplierait la durée et la fragilité de chaque passage.
Le portail est pourtant ouvert et bien balisé — c'est la seule maison rencontrée
dont l'obstacle soit architectural et non juridique.

**Euronext** — branché sur Workday (tenant hrhub), le connecteur voyait cinq
offres françaises au moment du branchement, mais rien n'est publié. À
diagnostiquer.

**Le groupe A** — trente-cinq maisons ont un connecteur qui ne rend rien. Le
diagnostic se fait sans rien demander à Victor : appeler chaque connecteur et
regarder ce qui sort. Pour beaucoup la réponse sera « elles ne publient rien de
junior en France » — c'est le cas de Deutsche Bank, deux postes parisiens.

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
