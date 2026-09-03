# Où en est JJ

**Dernière mise à jour : 3 septembre 2026, au soir.**

Ce fichier dit l'état du projet à date. Il est réécrit à la fin de chaque
séance de travail — c'est la première chose à lire pour reprendre, et la
dernière à écrire avant de s'arrêter.

---

## Le catalogue en ligne

**998 offres** · **104 maisons** servies sur **206** référencées.

> Les 103 maisons qui ne servent rien **ne sont pas 103 pannes**. Une maison
> sans poste junior ouvert en ce moment est dans son état normal, et c'est le
> cas de la plupart : vérifié le 03/09 sur Air Liquide (4 offres finance en
> France, pas une de plus à prendre) et sur Santander (portail vide). Le
> sous-ensemble réellement actionnable est bien plus étroit — les maisons dont
> le site AFFICHE des offres et dont on collecte zéro. Un seul cas prouvé à ce
> jour : Capgemini.

| Onglet | Offres |
|---|---|
| Stage | 500 |
| CDI · CDD | 305 |
| Alternance | 102 |
| VIE | 91 |

Les deux séances des 2 et 3 septembre ont fait passer le catalogue de **798 à
1006 offres**, et l'alternance de **60 à 116** — elle était le point faible
depuis le début.

**Qualité mesurée le 03/09/2026 :**

- 900/1006 datées (89 %) ; les autres affichent « toujours en ligne chez
  l'employeur, date inconnue » et passent en fin de liste ;
- plus ancienne offre datée : 120 jours, pour un seuil à 120 ;
- résidu « Autres métiers de la finance » : 5,9 % ;
- les 13 familles métier tiennent entre 3,9 % et 15,8 % ;
- les 11 types de structure entre 3,5 % et 20,6 % ;
- 0 poste senior sur les 311 offres de l'onglet CDI · CDD ;
- 2 offres sur 1006 mal rangées d'onglet (`audit-catalogue.js`).

**Douze premières maisons** : PME et start-ups (72, uniquement du VIE),
BPCE 68, Deloitte 67, Banque de France 41, LVMH 39, Société Générale 36,
Natixis 34, Crédit Agricole CIB 32, Oddo BHF 32, Lazard 31, Eurazeo 30,
BNP Paribas 30.

Le matin même, ce classement était dominé par Airbus (97), Air Liquide (71) et
Thales (69) — le fourre-tout « Autres métiers de la finance » avait enflé à
26,7 % du catalogue et publiait des ajusteurs composite. Voir `DECISIONS.md`
§15.

---

## Où chercher du volume — mesuré le 03/09/2026 au soir

Passage complet de `ingestion/rendement.js` (147 sources, un quart d'heure) :

> **6 840 offres collectées · 3 363 « publiables » · 998 publiées.**

**Attention au mot « publiable ».** Dans cet outil il signifie seulement
« passe `normalize()` et le filtre des grandes villes ». Il **n'inclut pas** le
contrôle de séniorité sur la description, le seuil des 120 jours, ni la
déduplication. L'écart de 2 365 n'est donc PAS un stock d'offres récupérables :
une part inconnue est légitime. **Mesurer la composition de cet écart est en
soi le prochain chantier** — sans elle, on optimiserait à l'aveugle.

### Ce qui est établi, en revanche

**Treize sources collectent et ne publient rien** (~106 offres). Les deux
premières ont été vérifiées à la main le soir même :

- `workday:santander` — 79 dans le rapport, mais **0 en direct** : le chiffre
  venait du magasin de récoltes (repli à 4 jours). **Ce n'est PAS une panne** :
  Victor a vérifié leur portail, il n'y a effectivement pas d'offre. Le
  connecteur qui rend zéro a raison. Le premier diagnostic écrit ici — « pointe
  dans le vide » — était faux, et sa correction tient en une leçon : un zéro
  n'accuse pas le connecteur tant qu'on n'a pas regardé le site.
- `phenom:careers.capgemini.com` — collecte **zéro**, si silencieusement qu'il
  n'apparaît même pas dans la liste des muettes. La seule offre Capgemini
  publiée vient du flux VIE. Leur vraie liste est sur `www.capgemini.com`,
  **rendue côté serveur** : un connecteur `liste` la lirait, comme pour Crédit
  Agricole ou BNP.

**Air Liquide n'est pas un gisement**, contrairement à ce que son absence
laissait croire. Le connecteur marche ; c'est la maison qui ne recrute presque
pas en finance en France. Mesuré sur leur API Workday : 1 125 offres dans le
monde, 292 en France, mais **4** en « Finance & Controlling » France et **1** en
« Group Control & Compliance ». Les deux familles que le connecteur ne voit pas
rapporteraient UNE offre.

> Piège à ne pas répéter : leur troisième famille, « HSE / Risk Mgt / Quality /
> Security » (11 en France), n'est PAS du risque financier — c'est la sécurité
> industrielle. L'ajouter parce qu'elle contient « Risk » rouvrirait exactement
> le fourre-tout du 2 septembre (`DECISIONS.md` §15).
>
> Anomalie restée ouverte : l'entonnoir retient les 4 offres Air Liquide, mais
> aucune n'est dans `offres.js`. À élucider — c'est un étage postérieur à
> `normalize()` qui les mange.

### Ordre de travail proposé

1. **Réparer les connecteurs muets** — Capgemini, Santander, puis les onze
   autres. Borné, vérifiable, et sans toucher à un seul filtre.
2. **Mesurer la composition de l'écart 3 363 → 998** (séniorité sur
   description, 120 jours, doublons). C'est la mesure qui manque.
3. **Le type de contrat deviné au lieu d'être lu** dans sept familles de
   connecteurs — c'est ce qui étouffe l'alternance (voir plus bas).

---

## Le 3 septembre, plus tard : interface et Pépites JJ

Un passage manuel supplémentaire (hors cron du 4 à 06h30) a été poussé le soir
même pour appliquer ces changements, ce qui explique un catalogue légèrement
différent du tableau ci-dessus au moment d'écrire ces lignes : **994 offres**
(stage 499, cdi-cdd 302, alternance 102, vie 91) — l'écart avec les chiffres du
matin est de la variation normale de sources, pas un effet des changements
décrits ici, qui ne touchent ni au filtrage ni à la classification.

**Barre d'onglets** : le total (« 994 offres au total ») est revenu SUR la
même ligne que Stage/Alternance/VIE/CDI-CDD (un essai en ligne séparée en
dessous a été rejeté — « c'est moche »). Les onglets débordaient déjà de
375 px avec leurs compteurs intégrés (« Alternance103 »), ce qui rendait la
barre défilable au toucher ; les compteurs par onglet disparaissent donc sous
900 px (pas seulement au format téléphone — le même débordement apparaît dès
qu'on repasse sous ~750 px, en fenêtre de bureau réduite ou en tablette), et le
total raccourcit à « 994 offres » sur cette largeur. Vérifié sans débordement
à 360, 375, 700 et 901 px.

**Filet orange sous l'en-tête** : il dépassait le contenu de chaque côté sur
grand écran, parce que `header.site` est en pleine largeur alors que son
contenu (`.brand`) est centré sur 1200 px. La bordure est devenue transparente
et un pseudo-élément dessine le vrai filet, centré sur les mêmes 1200 px.

**Pépites JJ, de 32 vitrines à 5 vraies trouvailles** — voir `DECISIONS.md`
§20 pour le détail des trois critères devenus obligatoires (énorme maison,
poste disputé, offre récente ≤ 21 jours). Le jour du changement : Ardian,
Natixis, Eurazeo, Lazard, Barclays, toutes publiées entre 0 et 14 jours plus
tôt.

---

## Le 3 septembre : la pagination qui tourne à vide

Trois corrections, poussées en fin de journée. Elles ne sont **pas** encore
visibles en ligne : le catalogue ci-dessus date du 2 au soir, et c'est le
passage automatique du 4 à 06h30 qui les appliquera.

1. **Phenom ignorait « offset ».** L'API de `careers.axa.com` n'accepte que
   `page` ; `offset`, `from`, `start` et `skip` sont acceptés **sans effet** et
   renvoient tous la première page. La boucle relisait donc six fois les cent
   premières offres, atteignait 600 ≥ `totalCount` (560) et se croyait au bout.
   Quatre cent soixante offres n'avaient jamais été vues. AXA passe de
   12 offres retenues, toutes en CDI, à 24 dont 6 stages et 3 alternances.

   Le garde-fou ajouté vaut pour toutes les sources à venir : **on s'arrête dès
   qu'une page n'apporte aucune offre nouvelle.** Un paramètre de pagination
   ignoré ne peut plus se déguiser en catalogue complet.

   Les deux autres branches Phenom ont été vérifiées et sont saines : Allianz
   pagine correctement par `from` (253 offres distinctes), HSBC lit ses neuf
   offres en une requête.

2. **La cybersécurité anglophone passait sous le contre-filtre.**
   `NON_FINANCE_RE` connaissait « cyber » et « sécurité informatique », mais
   pas « Red Team Analyst », « Security Assurance Officer » ni « Backup
   Engineer Analyst ». Le plus gênant : « Security Risk Assessment Analyst » se
   rangeait dans **Risques & Conformité**, où le candidat ne peut pas
   distinguer le risque informatique du risque financier.

3. **Comgest branchée** — la première des sociétés de gestion qui manquaient.
   Elle ne publie sur aucune plateforme : ses offres vivent dans un accordéon
   de son propre site, sur deux pages (stages, emplois).

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

**1. L'alternance — mais en lisant le compteur au bon moment.** 102 offres.

> **Ce n'est pas forcément un point faible : c'est la saison.** Un contrat
> d'alternance démarre en septembre, donc les annonces se publient de février à
> juillet. Mesurer le volume d'alternance EN SEPTEMBRE, c'est le relever au
> creux du cycle. Ne pas conclure à une panne, ni durcir ou assouplir quoi que
> ce soit sur cette base : la bonne mesure est le printemps.

Reste un défaut réel, lui, et indépendant de la saison : **le type de contrat
n'est pas lu** chez sept familles de connecteurs — Greenhouse, Oracle Cloud,
Teamtailor, SuccessFactors, Phenom, Cornerstone, Radancy. Elles le devinent sur
l'intitulé et rangent donc en CDI toute alternance dont le titre ne dit pas
« alternance ». C'est exactement le défaut corrigé chez Workday, qui avait
rendu 24 offres à la seule Banque de France. À corriger avant la saison
prochaine, pour qu'elle profite pleinement.

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
