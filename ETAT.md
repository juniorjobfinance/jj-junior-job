# Où en est JJ

**Dernière mise à jour : 2 septembre 2026, au soir.**

Ce fichier dit l'état du projet à date. Il est réécrit à la fin de chaque
séance de travail — c'est la première chose à lire pour reprendre, et la
dernière à écrire avant de s'arrêter.

---

## Le catalogue en ligne

**996 offres** · **200 employeurs** · **99 maisons** servies sur 202 référencées.

| Onglet | Offres | Le matin même |
|---|---|---|
| Stage | 483 | 389 |
| CDI · CDD | 313 | 266 |
| Alternance | **110** | 60 |
| VIE | 90 | 83 |

La séance du 2 septembre a fait passer le catalogue de **798 à 996 offres**, et
l'alternance de **60 à 110** — elle était le point faible depuis le début.

**Qualité mesurée le 02/09/2026 :**

- 886/996 datées (89 %) ; les autres affichent « toujours en ligne chez
  l'employeur, date inconnue » et passent en fin de liste ;
- plus ancienne offre datée : 119 jours, pour un seuil à 120 ;
- résidu « Autres métiers de la finance » : 6,2 % ;
- les 13 familles métier tiennent entre 3,7 % et 15,8 % ;
- les 11 types de structure entre 3,4 % et 19,7 %.

**Douze premières maisons** : PME et start-ups (74, uniquement du VIE),
Deloitte 67, BPCE 64, Banque de France 42, LVMH 39, Société Générale 36,
Natixis 34, Oddo BHF 32, Lazard 31, Crédit Agricole CIB 31, Eurazeo 30,
BNP Paribas 30.

Le matin même, ce classement était dominé par Airbus (97), Air Liquide (71) et
Thales (69) — le fourre-tout « Autres métiers de la finance » avait enflé à
26,7 % du catalogue et publiait des ajusteurs composite. Voir `DECISIONS.md`
§15.

---

## Les neuf pannes silencieuses corrigées le 2 septembre

Toutes rendaient zéro sans le moindre message. Le détail est dans les messages
de commit du jour ; voici de quoi les reconnaître si elles reviennent.

1. **Le lieu coupé au premier tiret.** « Saint-Quentin-en-Yvelines - France »
   devenait « Saint », donc petite commune, donc écarté. Toutes les communes à
   nom composé, sur toutes les listes HTML.
2. **La limite de mot du diplôme CAP prise au pied de la lettre.** Elle
   écartait « M&A Large Cap » — le cœur du sujet.
3. **La pagination Workday arrêtée à la vingtième offre.** Leur API ne renvoie
   le total que sur la première page ; le lire comme « zéro » arrêtait la
   lecture. Trente-cinq maisons concernées.
4. **La même faute dans six autres connecteurs** : SmartRecruiters,
   SuccessFactors, Oracle Cloud, OpenDataSoft, TalentView, AXA France.
5. **Le contrat Workday deviné au lieu d'être lu.** Les alternances de la
   Banque de France étaient publiées en CDI, puis tuées par le filtre 0-3 ans.
6. **« il y a 30 jours » lu « aujourd'hui »** : la fonction ne connaissait que
   l'anglais, et datait du jour tout ce qu'elle ne comprenait pas.
7. **BPCE jugé comme un agrégateur**, donc à 30 jours au lieu de 120.
8. **La Banque Postale lue quarante fois sur la même page** : leur pagination
   est dans le nom du fichier (« .p-2.html »).
9. **Soixante-cinq maisons branchées absentes de `maisons.txt`** : leur
   connecteur tournait chaque matin, et le pipeline jetait tout.

La neuvième est désormais impossible à commettre en silence :
`controle-avant-passage.js` compare les maisons branchées à la liste de
référence et nomme les orphelines.

---

## Trois outils nés de cette séance

- **`ingestion/atelier.js`** charge le vrai pipeline sans le lancer et rend ses
  fonctions internes. En ligne de commande, il dit quelle porte bloque une
  offre donnée. À employer SYSTÉMATIQUEMENT plutôt que de recopier une fonction
  du pipeline pour la tester : cette recopie a donné trois diagnostics faux
  dans la même séance.
- **`ingestion/entonnoir.js`** rejoue une source et compte les sorties par
  motif. C'est lui qui a montré les 93 offres manquées du Crédit Agricole et
  les 266 conseillers d'agence de Société Générale.
- **`ingestion/rendement.js`** pose la même question à toutes les sources en
  une seule collecte, et nomme celles qui ne publient rien. Quinze minutes.

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
et le garde-fou refuse de publier si le catalogue s'effondre malgré tout. Il a
joué deux fois le 2 septembre, en voyant le catalogue chuter de 26 % — la
baisse était voulue, et il a fallu `--forcer` pour publier.

**Conséquence à connaître** : le garde-fou se compare au fichier EN LIGNE. Avec
996 offres comme référence, un passage qui en rendrait moins de 847 serait
bloqué et garderait le catalogue de la veille.

Domaines : `juniorjobfinance.com` sert le site ; `www.` et
`juniorjobfinance.vercel.app` redirigent en 308 ; `http://` bascule en `https`.

---

## Ce qui reste à faire

**1. L'alternance, toujours.** 110 offres, contre 60 le matin. Le gisement
suivant est chez les très gros employeurs, et il est bloqué par une seule
chose : leur type de contrat n'est pas lu. Sept familles de connecteurs le
devinent encore sur l'intitulé — Greenhouse, Oracle Cloud, Teamtailor,
SuccessFactors, Phenom, Cornerstone, Radancy — et rangent donc en CDI toute
alternance dont le titre ne dit pas « alternance ». C'est exactement le défaut
corrigé chez Workday, qui a rendu 24 offres à la seule Banque de France.

**2. Quatre gros groupes identifiés, pas encore branchés.** Leur plateforme est
connue, il manque leur identifiant, qui se lit dans l'adresse d'une offre :
Engie (SuccessFactors), Orange (Phenom), Schneider Electric (TalentSoft ou
Phenom). EDF est branché depuis ce soir mais rend peu — leurs juniors sont
techniciens de maintenance et nucléaire.

**3. Deux sources collectent beaucoup et ne publient rien** : `workday:morningstar`
(220 offres) et `workday:santander` (76). À passer à l'entonnoir.

**4. Deux maisons dont la liste est en JavaScript** : Société Générale (leur
sitemap ne porte que 346 offres France sur 1 094) et La Banque Postale (69
offres rendues côté serveur). Il faudrait la requête que leur page appelle —
Victor peut la capturer dans l'onglet Réseau du navigateur.

**5. Une offre morte dans `manuel.js`.** Le passage la signale à chaque fois ;
sa ligne est à retirer du fichier.

**6. Visibilité — reporté à la demande de Victor.** Google Search Console,
vérification que le pare-feu Vercel ne bloque pas Googlebot, données
structurées JobPosting, analytics, poids de `offres.js`.

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

**Seize start-ups technologiques débranchées le 02/09** — Doctolib, Deezer,
BlaBlaCar, Dataiku, Algolia, Mirakl, Contentsquare, Believe, Brevo,
Dailymotion, Pigment, Papernest, Kili, Sellsy, Modjo, Qare. Mesure avant de
trancher : 34 offres collectées, 9 franchissant les filtres de titre, et ces
neuf étant « Head of International Accounting », « Chief Operations Officer »,
« Senior Payment Operation Analyst »… du senior ou du non-finance. Rebrancher
tient en une ligne si l'une d'elles se met à recruter des juniors en finance.

## Hors d'atteinte, et pourquoi

**Pare-feu** — Bpifrance (répond 403 à tout robot, jusqu'à son propre
`robots.txt`), Morgan Stanley (tal.net), Alvarez & Marsal (Cloudflare). On ne
contourne pas.

**Saint-Gobain** — leur vrai site, joinus.saint-gobain.com, répond 403 à
tout robot. Leur tenant SmartRecruiters, lui, existe mais ne porte que 18
offres. Hors d atteinte.

**Plateformes sans API lisible** — UBS (Taleo), Stifel (50skills), Alstom,
Atos, Exiom, Capza (Taleez : application JavaScript, API sous clé, sitemap
réduit à la page d'accueil).

**McKinsey** — coupé volontairement : leur API sert des postes que leur propre
site déclare fermés.

**France Travail et La Bonne Alternance** — débranchés le 01/09, mesure refaite
le 02/09 : 26 offres finance sur les huit plus gros bassins, dont une seule
maison de finance. Voir `DECISIONS.md` §2.
