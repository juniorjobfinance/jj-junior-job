// Les textes des quinze pages par famille.
//
// CE FICHIER EST ÉCRIT À LA MAIN, PAR VICTOR. C'est le seul du dépôt dont le
// contenu ne vient ni d'une collecte ni d'un calcul : il vient de quelqu'un qui
// a fait ces métiers. Un étudiant ne sait pas ce que fait un chargé d'affaires
// coverage ni en quoi ça diffère du M&A, et personne ne le lui explique —
// c'est ce que ces pages apportent. Le référencement n'en est que la
// conséquence, pas la raison.
//
// TANT QU'UNE FAMILLE N'EST PAS REMPLIE, SA PAGE N'EST PAS PUBLIÉE.
// ingestion/pages-familles.js saute toute famille dont l'intro est vide, et le
// rapport le dit — plutôt que de mettre en ligne quinze variantes de la même
// page, ce que Google traite en contenu dupliqué et ce qu'un visiteur traite
// en perte de temps.
//
// Les clés doivent correspondre EXACTEMENT aux libellés du catalogue. Une
// faute de frappe ici ne produit pas une page vide : elle produit une famille
// sans page, en silence. Le générateur signale les clés orphelines.

module.exports = {
  'Fusions & Acquisitions': {
    titre: "Fusions & Acquisitions : stages, alternances et premiers postes",
    description: "Toutes les offres juniors en M&A en France : banques d'affaires, BFI, Big Four, fonds et directions du développement. Mises à jour chaque matin.",
    h1: "Fusions & Acquisitions",
    intro: "Le M&A, c'est conseiller une entreprise qui en achète une autre, qui se vend, ou qui fusionne. Concrètement, un analyste junior construit des modèles financiers, valorise l'entreprise cible par plusieurs méthodes, rédige les documents de présentation envoyés aux acheteurs potentiels, et coordonne les audits d'acquisition. C'est le métier le plus demandé par les étudiants en finance et le plus sélectif : on y entre presque exclusivement par un stage long, souvent après un premier stage ailleurs. Les horaires sont réputés lourds et ils le sont. En échange, on apprend à lire une entreprise plus vite que dans n'importe quel autre poste junior.",
    distinction: "À ne pas confondre avec Financements & Coverage : le M&A conseille sur l'opération, le financement l'accompagne en prêtant l'argent. Ni avec le Transaction Services des Big Four, qui audite les comptes d'une cible pendant que le M&A exécute la transaction.",
  },

  'Marchés financiers': {
    titre: "Marchés financiers : stages, alternances et premiers postes",
    description: "Sales, trading, structuration et recherche : les offres juniors en salle de marché et en analyse financière, en BFI, courtage et société de gestion.",
    h1: "Marchés financiers",
    intro: "Sous ce nom se cachent quatre métiers différents. Le sales parle aux clients institutionnels et leur propose des produits ; le trader tient le risque de la banque et cote des prix ; le structureur conçoit les produits sur mesure ; l'analyste recherche publie des avis sur des sociétés ou des émetteurs. Un junior arrive presque toujours par un stage en assistanat de l'un de ces quatre, sur une classe d'actifs précise — actions, taux, crédit, change, matières premières. Le rythme est celui du marché : tôt le matin, intense quand ça bouge, et l'apprentissage est très rapide parce que les décisions se prennent en direct.",
    distinction: "À ne pas confondre avec Opérations & Middle-office, qui traite les opérations une fois qu'elles sont conclues. Le front office prend le risque, le middle et le back le sécurisent.",
  },

  'Capital-investissement': {
    titre: "Capital-investissement : stages, alternances et premiers postes",
    description: "Private equity, venture, infrastructure, dette privée et immobilier : les offres juniors dans les fonds d'investissement français et internationaux.",
    h1: "Capital-investissement",
    intro: "Un fonds de capital-investissement achète des parts d'entreprises non cotées, les accompagne pendant quelques années, puis les revend. L'analyste junior étudie les dossiers qui arrivent, construit le modèle d'acquisition, coordonne les audits, et suit ensuite les sociétés déjà en portefeuille. La différence avec le conseil est fondamentale : ici on engage l'argent du fonds, donc on assume la décision et on vit avec pendant cinq ans. Les stages sont rares et très recherchés, souvent après un premier passage en M&A ou en Transaction Services, mais certaines maisons recrutent directement en sortie d'école.",
    distinction: "À ne pas confondre avec les Fusions & Acquisitions : le M&A conseille et est payé à l'opération, le capital-investissement investit et est payé à la performance. Beaucoup de juniors font le premier pour rejoindre le second.",
  },

  "Gestion d'actifs": {
    titre: "Gestion d'actifs : stages, alternances et premiers postes",
    description: "Gérants, analystes buy-side, ISR et relation clients : les offres juniors en société de gestion, en assurance et en banque.",
    h1: "Gestion d'actifs",
    intro: "Gérer de l'actif, c'est investir l'argent d'autres personnes — fonds de pension, assureurs, particuliers — selon un mandat précis. Autour du gérant gravitent l'analyste financier qui étudie les sociétés en portefeuille, l'analyste ISR qui évalue leurs pratiques environnementales et sociales, le spécialiste produit qui explique la stratégie aux clients, et l'équipe qui répond aux appels d'offres. C'est un secteur où l'analyse compte plus que la vitesse : on cherche à avoir raison sur trois ans, pas sur trois minutes. Beaucoup de postes juniors passent par l'assistanat de gestion ou l'analyse sectorielle.",
    distinction: "À ne pas confondre avec la Banque privée & Patrimoine : la gestion d'actifs gère des fonds, la banque privée gère la fortune de personnes. Ni avec les Marchés financiers, qui vendent et cotent là où la gestion achète et détient.",
  },

  'Banque privée & Patrimoine': {
    titre: "Banque privée & Patrimoine : stages, alternances et premiers postes",
    description: "Banquiers privés, ingénierie patrimoniale et family office : les offres juniors en banque privée, banque d'affaires et gestion de fortune.",
    h1: "Banque privée & Patrimoine",
    intro: "La banque privée accompagne des particuliers fortunés, souvent des chefs d'entreprise, sur l'ensemble de leur patrimoine : placements, transmission, fiscalité, structuration juridique. Le banquier privé tient la relation ; derrière lui, l'ingénieur patrimonial construit les montages, et le family office coordonne l'ensemble des actifs d'une même famille. Un junior commence en assistanat de banquier privé ou en ingénierie patrimoniale, et le métier demande autant de droit et de fiscalité que de finance. C'est aussi l'un des rares métiers de la finance où la relation humaine compte autant que la technique.",
    distinction: "À ne pas confondre avec le conseil bancaire en agence, qui s'adresse au grand public et ne figure pas sur ce site. La banque privée commence là où le patrimoine devient assez complexe pour exiger une ingénierie.",
  },

  'Comptabilité & Consolidation': {
    titre: "Comptabilité & Consolidation : stages, alternances et premiers postes",
    description: "Comptables, consolideurs et expertise comptable : les offres juniors en entreprise, en banque, en assurance et en cabinet.",
    h1: "Comptabilité & Consolidation",
    intro: "La comptabilité produit les chiffres sur lesquels tout le reste s'appuie. Le comptable enregistre et justifie les opérations, prépare les arrêtés trimestriels et annuels ; le consolideur additionne les comptes de toutes les filiales d'un groupe pour en faire un seul état, en réglant les écarts de normes et de devises. En cabinet, l'expertise comptable fait le même travail pour plusieurs clients à la fois, ce qui est une excellente école pour voir beaucoup d'entreprises en peu de temps. C'est l'une des deux familles les plus fournies de ce site, et l'une des seules où l'alternance mène très souvent à l'embauche.",
    distinction: "À ne pas confondre avec le Contrôle de gestion : la comptabilité rend compte de ce qui s'est passé, avec des règles strictes et un lecteur extérieur. Le contrôle de gestion explique et prévoit, pour un lecteur interne.",
  },

  'Contrôle de gestion & Trésorerie': {
    titre: "Contrôle de gestion & Trésorerie : stages, alternances et premiers postes",
    description: "Contrôleurs de gestion, FP&A et trésoriers : les offres juniors en direction financière d'entreprise, en banque et en assurance.",
    h1: "Contrôle de gestion & Trésorerie",
    intro: "Le contrôleur de gestion est celui qui explique pourquoi les chiffres sont ce qu'ils sont, et ce qu'ils seront. Il construit le budget, suit les écarts entre le prévu et le réalisé, et sert d'interlocuteur financier aux équipes opérationnelles — d'où le terme de business partner. Le trésorier, lui, s'occupe de l'argent disponible : anticiper les besoins, placer les excédents, se couvrir contre le change et les taux. En banque, ce métier prend le nom d'ALM et gère l'équilibre entre les ressources et les emplois du bilan. C'est la porte d'entrée la plus large vers une direction financière.",
    distinction: "À ne pas confondre avec la Comptabilité : la comptabilité produit le chiffre, le contrôle de gestion l'interprète et le projette. Les deux travaillent sur les mêmes données et ne répondent pas aux mêmes questions.",
  },

  'Audit & Contrôle interne': {
    titre: "Audit & Contrôle interne : stages, alternances et premiers postes",
    description: "Audit financier en cabinet, inspection générale et contrôle interne : les offres juniors en Big Four, en banque, en assurance et en entreprise.",
    h1: "Audit & Contrôle interne",
    intro: "L'auditeur externe vérifie que les comptes d'une entreprise reflètent sa situation réelle : il teste, il recoupe, il demande des justificatifs, et il signe. C'est le métier des Big Four et des cabinets d'audit, et il reste la formation la plus complète pour apprendre à lire des états financiers. À l'intérieur des entreprises et des banques, le contrôle interne et l'inspection générale font un travail voisin sur les processus plutôt que sur les comptes : ils vérifient que les procédures existent, qu'elles sont suivies, et qu'elles protègent vraiment. En banque française, ce métier porte souvent le titre d'inspecteur, et il mène loin.",
    distinction: "À ne pas confondre avec Risques & Conformité : l'audit vérifie après coup que les contrôles fonctionnent ; les risques mesurent l'exposition au jour le jour et la conformité applique la règle en continu.",
  },

  'Risques & Conformité': {
    titre: "Risques & Conformité : stages, alternances et premiers postes",
    description: "Analyse crédit, risques de marché, conformité, KYC et reporting réglementaire : les offres juniors en banque, assurance, fonds et régulateur.",
    h1: "Risques & Conformité",
    intro: "Deux métiers voisins sous un même toit. Le côté risques mesure ce que la banque peut perdre : l'analyste crédit étudie la solidité des entreprises financées, l'analyste risques de marché surveille les positions et les limites, le risque opérationnel s'occupe des défaillances internes. Le côté conformité fait respecter les règles : connaissance des clients, lutte contre le blanchiment, sanctions internationales, protection des investisseurs. C'est l'une des familles les plus fournies de ce site, parce que la réglementation ne cesse de croître — et c'est un excellent premier poste pour comprendre comment une banque fonctionne vraiment de l'intérieur.",
    distinction: "À ne pas confondre avec Audit & Contrôle interne, qui contrôle périodiquement que le dispositif tient. Les risques et la conformité font partie du dispositif ; l'audit le vérifie.",
  },

  'Conseil & Transformation': {
    titre: "Conseil & Transformation : stages, alternances et premiers postes",
    description: "Conseil en transformation de la fonction finance et projets réglementaires : les offres juniors en cabinet, en Big Four et en banque.",
    h1: "Conseil & Transformation",
    intro: "Ces postes consistent à améliorer la façon dont une banque, un assureur ou une direction financière travaille : raccourcir les délais de clôture, mettre en œuvre une nouvelle réglementation, refondre un processus de reporting. On y est consultant, en cabinet ou à l'intérieur d'une maison, et on passe d'un sujet à l'autre au rythme des missions. C'est un bon poste pour ceux qui aiment comprendre les organisations autant que les chiffres, et il ouvre ensuite sur presque tous les autres métiers de cette liste parce qu'on les aura tous croisés.",
    distinction: "Ce site ne retient que le conseil qui porte sur la finance elle-même. Le conseil en systèmes d'information, en stratégie générale ou en organisation n'y figure pas, même chez les mêmes employeurs.",
  },

  'Opérations & Middle-office': {
    titre: "Opérations & Middle-office : stages, alternances et premiers postes",
    description: "Middle et back-office, règlement-livraison, conservation et administration de fonds : les offres juniors en banque, asset servicing et société de gestion.",
    h1: "Opérations & Middle-office",
    intro: "Une opération de marché ne s'arrête pas quand elle est conclue : il faut la confirmer, la comptabiliser, l'appeler en garantie, la régler et la livrer. C'est le travail du middle et du back-office, et il porte sur des volumes considérables avec une exigence d'exactitude totale — une erreur ici se voit tout de suite et coûte cher. Les conservateurs et administrateurs de fonds en ont fait leur métier principal. C'est une entrée souvent sous-estimée par les étudiants, alors qu'elle donne une compréhension des produits que le front office n'a pas toujours, et qu'elle mène vers le contrôle des risques ou la structuration.",
    distinction: "À ne pas confondre avec les Marchés financiers : le front office décide et prend le risque, les opérations sécurisent et exécutent. Ce sont deux métiers différents, pas deux niveaux du même.",
  },

  'Data & Quant': {
    titre: "Data & Quant : stages, alternances et premiers postes",
    description: "Analystes quantitatifs, modélisation et data science appliquée à la finance : les offres juniors en banque, assurance, fonds et institution.",
    h1: "Data & Quant",
    intro: "Ici on écrit les modèles plutôt qu'on ne les utilise. L'analyste quantitatif construit et valide les modèles de risque de crédit, de marché ou de provisionnement ; le data scientist exploite des volumes de données que personne ne lit à la main. Ces postes demandent un vrai bagage en statistiques et en programmation, et ils se trouvent aussi bien en salle de marché qu'à la direction des risques ou chez le régulateur. C'est la famille où le diplôme technique compte le plus, et l'une des rares où un profil d'ingénieur entre en finance sans détour.",
    distinction: "À ne pas confondre avec les métiers informatiques d'une banque, qui construisent les systèmes. Ici le sujet est le modèle financier ; l'outil informatique n'est qu'un moyen.",
  },

  'Actuariat & Assurance technique': {
    titre: "Actuariat & Assurance technique : stages, alternances et premiers postes",
    description: "Actuaires, tarification, provisionnement et réassurance : les offres juniors en compagnie d'assurance, mutuelle, cabinet et banque-assurance.",
    h1: "Actuariat & Assurance technique",
    intro: "L'actuaire met un prix sur l'incertitude. Il calcule combien doit coûter un contrat d'assurance pour couvrir un risque, et combien la compagnie doit mettre de côté pour tenir ses engagements dans dix ou trente ans. Autour de lui, la souscription décide quels risques accepter, la réassurance transfère une partie du portefeuille à un tiers, et le cadre Solvabilité II impose de tout démontrer par des modèles. C'est un métier peu connu des étudiants en finance générale, alors qu'il recrute beaucoup, paie bien et se trouve rarement en concurrence avec cent candidats par poste.",
    distinction: "À ne pas confondre avec Risques & Conformité : l'actuaire modélise le risque assuré, celui qu'on accepte volontairement contre une prime. Le risk manager mesure le risque financier qu'on subit.",
  },

  'Financements & Coverage': {
    titre: "Financements & Coverage : stages, alternances et premiers postes",
    description: "Financements structurés, financement de projet, trade finance et coverage : les offres juniors en banque de financement et d'investissement.",
    h1: "Financements & Coverage",
    intro: "C'est le métier qui prête de l'argent aux entreprises, et il est bien plus varié que ce nom laisse croire. Le financement de projet monte le prêt d'une centrale solaire ou d'une autoroute, remboursé par ce que l'ouvrage rapportera. Le financement d'acquisition finance les rachats d'entreprises. Le trade finance sécurise le commerce international, le financement d'actifs porte sur des avions ou des navires. Le coverage, lui, tient la relation avec l'entreprise cliente et lui apporte l'ensemble des produits de la banque. C'est probablement la famille la plus sous-demandée au regard de ce qu'elle offre : mêmes employeurs que le M&A, horaires plus vivables, et une compréhension du crédit qui sert partout ensuite.",
    distinction: "À ne pas confondre avec les Fusions & Acquisitions : le M&A conseille sur l'achat d'une entreprise, le financement fournit l'argent qui permet de l'acheter. Deux équipes voisines dans la même banque, deux métiers distincts.",
  },

  'Autres métiers de la finance': {
    titre: "Autres métiers de la finance : stages, alternances et premiers postes",
    description: "Économistes, recherche, actifs numériques et postes transverses : les offres juniors en finance qui n'entrent dans aucune des quatorze familles.",
    h1: "Autres métiers de la finance",
    intro: "Toutes les offres de ce site ne rentrent pas dans une case, et nous préférons le dire plutôt que de les forcer. On trouve ici des postes d'économiste et d'études économiques — la Banque de France en publie régulièrement —, des sujets d'actifs numériques, et des fonctions transverses qui touchent à plusieurs métiers à la fois. Cette page est volontairement petite : si elle grossit, c'est que la classification a un manque, et c'est nous que ça regarde, pas vous.",
    distinction: "",
  },
};
