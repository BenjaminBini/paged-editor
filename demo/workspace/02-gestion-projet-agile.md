---
type: memoire-section
title: "Mémoire technique — TMA Liferay CNC (Marché n°2026028)"
ao_ref: "2026028"
acheteur: "Centre National du Cinéma et de l'Image Animée (CNC)"
section_id: ch2_gestion_projet_agile
status: draft
max_pages: 8
---

# Qualité de la gestion de projet agile

## Méthodologie et modalités des développements en mode agile

### Approche hybride : Scrum pour les projets, Kanban pour la maintenance

BEORN adopte une approche méthodologique hybride, adaptée à la double nature du marché CNC :

**Scrum** pour les projets de développement agile (nouvelles applications, évolutions structurantes, refonte de composants) : sprints cadencés de 2 semaines, cérémonies complètes, vélocité pilotée.

**Kanban** pour la maintenance corrective et les petites évolutions : flux continu, priorisation en temps réel, pas de notion de sprint (les anomalies n'attendent pas la prochaine planification). Le tableau Kanban est visible dans Jira avec les colonnes : À faire / En cours / En recette / Terminé.

Cette coexistence est naturelle dans un contexte TMA : une équipe peut simultanément piloter un sprint de développement sur une évolution structurante de cnc.fr V2 et traiter un ticket correctif bloquant sur l'intranet, sans que l'un perturbe l'autre.

---

### Profils et rôles

| Rôle                                     | Responsable                | Lien avec les profils BPU                                      |
| ---------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| **Responsable de marché / Scrum Master** | Benjamin Bini              | Chef de projet senior                                          |
| **Product Owner**                        | Chefs de projet CNC (SOSI) | Côté client, connaissent le métier et arbitrent les priorités |
| **Architecte Liferay**                   | Profil senior BEORN        | Architecte technique / Lead développeur                        |
| **Développeur Liferay**                  | Profil(s) BEORN            | Développeur Liferay (portlets, templates, fragments)           |
| **Développeur frontend**                 | Profil BEORN               | Intégrateur / développeur React                                |
| **Concepteur UX / Designer UI**          | Profil BEORN               | Conception UX et design UI                                     |
| **Référent sécurité**                    | Profil BEORN               | Correspondant sécurité informatique                            |

Le responsable de marché BEORN assure le rôle de Scrum Master : il facilite les cérémonies, lève les blocages, protège l'équipe des sollicitations externes non priorisées, et assure la transparence des indicateurs auprès du CNC.

Le Product Owner est porté par les chefs de projet du SOSI CNC, conformément à l'organisation déjà en place lors de la TMA précédente. Ils définissent les priorités du backlog, valident les User Stories et prononcent l'acceptation des sprints. BEORN accompagne les PO dans la formalisation des User Stories et l'estimation des charges quand nécessaire.

### Prestations de conception UX et design UI

BEORN est en capacité d'assurer les prestations de conception UX et de design UI dans le cadre des projets agiles. Le CNC se réserve la possibilité de confier ces prestations à un tiers.

**Conception UX** : création de personas, parcours utilisateurs, arborescence, wireframes basse fidélité, prototypes interactifs (Figma), tests utilisateurs. Livrables : personas, user journeys, wireframes, spécifications UX.

**Design UI** : charte graphique web, maquettes haute fidélité (desktop, tablette, mobile), kit UI (bibliothèque de composants réutilisables), spécifications UI pour les développeurs. Livrables : charte graphique, kit UI, maquettes haute fidélité, spécifications UI.

Ces prestations sont mobilisables via les profils BPU dédiés (UO-UX, UO-UI) et dimensionnées en phase de cadrage.

---

### Rituels agiles

| Cérémonie          | Fréquence                   | Participants                              | Durée typique       |
| ------------------ | --------------------------- | ----------------------------------------- | ------------------- |
| Sprint Planning    | Début de chaque sprint (J1) | Équipe BEORN + PO CNC                     | 2h                  |
| Daily Standup      | Quotidien                   | Équipe BEORN                              | 15 min (en interne) |
| Sprint Review      | Fin de sprint (J10)         | Équipe BEORN + PO CNC + parties prenantes | 1h                  |
| Rétrospective      | Fin de sprint               | Équipe BEORN (+ PO si souhaité)           | 45 min              |
| Backlog Refinement | Milieu de sprint (J5)       | Lead dev BEORN + PO CNC                   | 1h                  |

Les cérémonies impliquant le CNC se tiennent en visioconférence (Google Meet) ou dans les locaux du CNC pour les revues de sprint significatives. Les comptes-rendus de Sprint Review sont transmis sous 48h dans Confluence.

---

### Definition of Done (DoD)

La DoD est formalisée en début de projet, co-construite avec le CNC et versionnée dans Confluence. Elle constitue le critère d'acceptation de chaque User Story avant de la considérer "terminée". Pour ce marché, la DoD type comprend :

**Développement :**
- Code développé, revu par un pair (merge request GitLab approuvée)
- Aucune violation SonarQube de sévérité critique ou bloquante
- Documentation technique mise à jour (DAT/DEX si applicable)

**Tests :**
- Tests d'intégration passants en environnement de recette
- Tests de non-régression sur les fonctionnalités adjacentes
- Vérification RGAA des composants exposés au public (cnc.fr, Garance)
- Tests de rendu sur navigateurs et résolutions variés

**Livraison :**
- Procédure d'installation documentée et testée
- Déploiement validé en recette par le CNC
- Ticket Jira mis à jour avec RAD (rapport d'activité détaillé)

La DoD peut évoluer en cours de marché sur proposition de BEORN ou du CNC, après validation en rétrospective.

---

### Gestion et priorisation du backlog

Le backlog est géré dans Jira (projet dédié par application si volumes importants, ou projet unique multi-application). Il est structuré en :

- **Epics** : grands domaines fonctionnels (ex. "Évolution moteur de recherche cnc.fr", "Accessibilité RGAA Garance")
- **User Stories** : fonctionnalités unitaires, rédigées en format "En tant que [rôle], je veux [action] afin de [bénéfice]"
- **Tâches techniques** : découpage interne à l'équipe

**Priorisation** : les PO CNC définissent les priorités du backlog selon la valeur métier et l'urgence. BEORN contribue à l'estimation de la complexité (points de story) et alerte sur les dépendances ou risques techniques. La priorisation est revue à chaque Sprint Planning et Backlog Refinement.

**Méthode d'estimation** : Planning Poker (story points, échelle de Fibonacci), ou estimation directe en jours pour les tâches de maintenance.

---

### Pilotage de la vélocité

La vélocité (nombre de points de story réalisés par sprint) est mesurée dès le premier sprint et suivie dans Jira. BEORN s'engage sur les indicateurs SLA du marché :

- **Maintien de la vélocité** : l'écart entre la vélocité cible et la vélocité réelle ne dépasse pas 10% sur 3 sprints glissants
- **Transparence** : la vélocité réelle est communiquée au CNC à chaque Sprint Review
- **Plan de rattrapage** : en cas de dérive, BEORN propose un plan correctif (renfort d'équipe, dépriorisation de tâches, réduction du périmètre du sprint suivant) lors du COPROJ bimensuel

La vélocité de référence est calibrée lors des **4 premiers sprints** conformément au CCTP. À partir du 5ème sprint, BEORN s'engage à maintenir la vélocité validée par le CNC. En cas de vélocité jugée insuffisante par le CNC, BEORN s'engage à y remédier via un ajustement des profils et ressources mobilisés.

/newpage

## 2.2. Cas d'école : Site institutionnel jeu vidéo CNC

### Analyse du besoin

#### Compréhension du périmètre

Le CNC souhaite réaliser un site institutionnel pour valoriser le secteur du jeu vidéo, avec les fonctionnalités suivantes : page d'accueil avec actualités mises en avant, pages de contenus structurés (rubriques/sous-rubriques), module d'actualités, agenda, moteur de recherche, formulaire de contact, le tout responsive et conforme RGAA.

Le périmètre est clair et bien délimité. Il s'agit d'un site éditorial institutionnel classique, sans authentification ni espace privé, orienté grand public et professionnels du jeu vidéo (développeurs, studios, distributeurs, acteurs institutionnels).

#### Hypothèses retenues

- Volume éditorial modeste au lancement : 20 à 50 contenus initiaux, équipe éditoriale de 2 à 3 personnes côté CNC
- Site bilingue français/anglais non requis dans le périmètre initial (mais architecture prévue pour faciliter l'extension)
- Hébergement sur l'infrastructure existante CNC (Liferay 7.4)
- Charte graphique spécifique au secteur jeu vidéo, déclinée à partir du Design System CNC commun

#### Notre approche : capitaliser sur le socle cnc.fr V2

L’atout majeur de ce cas d’école réside dans la stratégie de **réutilisation maximale des composants livrés dans le cadre de la refonte cnc.fr V2**. La refonte V2, réalisée par le prestataire sortant, constitue un socle technique et fonctionnel que BEORN récupère en production au démarrage du marché. Le site jeu vidéo n’est pas conçu comme un projet isolé, mais comme la démonstration concrète de la capacité de BEORN à **capitaliser sur l’existant V2** et à exploiter l’architecture multisite de Liferay.

**Principe directeur** : dès la phase d’initialisation du marché, BEORN réalise un **audit des composants cnc.fr V2** (fragments, client extensions, structures de contenu, templates, thèmes, configurations de recherche) afin d’évaluer leur degré de réutilisabilité et de paramétrabilité. L’objectif est d’identifier les composants directement réemployables sur un autre site de l’écosystème CNC, et ceux qui nécessiteront des adaptations.

**Engagement de réutilisabilité au fil de l’eau** : lorsque des adaptations sont nécessaires pour rendre un composant V2 réutilisable (paramétrage, découplage, externalisation de configuration), BEORN les réalise progressivement, au fil des besoins identifiés, dans le cadre des évolutions du marché. Cette approche incrémentale évite un chantier de refactoring initial coûteux tout en garantissant que le patrimoine V2 devient progressivement un **socle multisite**.

**Architecture multisite** : le site jeu vidéo est déployé comme un **nouveau site Liferay au sein de l’instance 7.4 existante**, via la fonction multisite native. Cette approche offre :

- **Réutilisation des composants V2 existants** : fragments, client extensions, structures de contenu et templates issus de cnc.fr V2, avec adaptations ciblées si nécessaire (cf. Sprint 2 du cas d’école)
- **Cohérence graphique et fonctionnelle** entre les sites du CNC, garantie par un socle de composants partagé, tout en préservant une **identité visuelle différenciée** propre au secteur jeu vidéo (palette de couleurs, typographie, iconographie spécifiques)
- **Économies significatives** sur le développement initial et sur la MCO (une seule base de composants à maintenir)
- **Aucune infrastructure supplémentaire** à provisionner ni à maintenir
- **Administration centralisée** : les équipes éditoriales CNC retrouvent les mêmes interfaces et workflows de publication
- **Autonomie renforcée des équipes CNC** : les contributeurs formés sur cnc.fr V2 sont immédiatement opérationnels sur le site jeu vidéo, sans formation complémentaire. Ils peuvent créer des pages, publier des contenus et gérer l’arborescence de manière autonome, en s’appuyant sur les mêmes composants et workflows qu’ils maîtrisent déjà
- **Moins de sollicitation du prestataire** : la création de nouvelles pages, rubriques et contenus ne nécessite aucune intervention technique de BEORN. Les équipes CNC composent directement leurs pages à partir du catalogue de fragments et templates partagés

**Valorisation concrète du socle V2** : les composants cnc.fr V2 (fragments, client extensions, thème sous forme de Client Extension) disposent de paramètres de configuration permettant de décliner les affichages et de réemployer les composants sur d’autres pages ou d’autres sites. Le thème formalise un design system configurable (couleurs, espacements, typographie), permettant aux contributeurs de décliner ce design sur d’autres sites sans intervention technique. Les compositions de fragments (assemblages prédéfinis : contact, actualités, recherche…) peuvent être réutilisées en un clic sur n’importe quelle page et sur d’autres sites. Si certains composants V2 ne sont pas encore suffisamment paramétrables pour un usage multisite, le Sprint 2 du cas d’école intègre explicitement les adaptations nécessaires (cf. US-16, Ajustements des composants V2).

---

### Cadrage Agile Scrum

#### Équipe

| Rôle                          | Intervenant               | Taux |
| ----------------------------- | ------------------------- | ---- |
| Scrum Master / Chef de projet | Cédric PIERRON (BEORN)    | 20%  |
| Product Owner                 | Chef de projet CNC (SOSI) | 30%  |
| Développeur Liferay (lead)    | Profil senior BEORN       | 100% |
| Intégrateur frontend          | Profil BEORN              | 50%  |

Équipe volontairement resserrée pour un périmètre fonctionnel maîtrisé.

#### Paramètres Scrum

- Durée des sprints : **2 semaines**
- Vélocité cible : 20 points par sprint (calibrée au Sprint 1)
- Durée totale estimée : **2 sprints** (4 semaines), hors phase de cadrage initiale (1 semaine). La réutilisation des composants issus de cnc.fr V2 réduit significativement la charge de développement

#### Rituels

| Cérémonie          | Durée                 | Participants                              |
| ------------------ | --------------------- | ----------------------------------------- |
| Sprint Planning    | 2h                    | Équipe BEORN + PO CNC                     |
| Daily Standup      | 15 min                | Équipe BEORN                              |
| Backlog Refinement | 1h (milieu de sprint) | Lead dev + PO CNC                         |
| Sprint Review      | 1h                    | Équipe BEORN + PO CNC + parties prenantes |
| Rétrospective      | 45 min                | Équipe BEORN                              |

#### Backlog priorisé et estimé

Les estimations en points reflètent la charge optimisée grâce à la réutilisation des composants issus de cnc.fr V2. L'essentiel du travail porte sur la configuration, le paramétrage et la personnalisation graphique des composants existants, avec des adaptations ciblées au Sprint 2 si certains composants nécessitent des ajustements pour un usage multisite.

/newpage


| #&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | User Story                                                                                                          | Priorité | Points | Sprint | Composant V2 mobilisé                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ | ------------------------------------------------------------ |
| US-01                                                                     | En tant qu'admin, je dispose du site jeu vidéo provisionné avec les structures de contenu V2 configurées            | Must     | 5      | 1      | Structures DDM + fragments V2                                |
| US-02                                                                     | En tant qu'admin, je dispose du thème CNC décliné aux couleurs du secteur jeu vidéo                                 | Must     | 3      | 1      | Thème CNC V2 (Configuration du StyleBook)                    |
| US-03                                                                     | En tant que visiteur, je vois une page d'accueil avec les 3 dernières actualités mises en avant                     | Must     | 1      | 1      | Composition de Fragments "Mise en avant actu" V2             |
| US-04                                                                     | En tant que contributeur, je peux publier une actualité avec titre, chapô, image, corps de texte, date et catégorie | Must     | 1      | 1      | Workflow éditorial V2 (configuration)                        |
| US-05                                                                     | En tant que visiteur, je navigue dans les rubriques et sous-rubriques du site via le menu principal                 | Must     | 1      | 1      | Fragment "Navigation CNC" V2                                 |
| US-06                                                                     | En tant que visiteur, je consulte la liste des actualités filtrables par catégorie, avec pagination                 | Must     | 1      | 1      | Liste de contenus configurée + Fragment "Carte Actualité" V2 |
| US-07                                                                     | En tant que visiteur, je consulte le détail d'une actualité avec partage réseaux sociaux                            | Should   | 1      | 1      | Page d'affichage Actualité + Fragments "Détail actualité" V2 |
| US-08                                                                     | En tant que contributeur, je peux créer et gérer des pages de contenu (rubrique, sous-rubrique) avec éditeur riche  | Must     | 1      | 1      | Page Templates + Fragments V2                                |
| US-09                                                                     | En tant que visiteur, je consulte l'agenda des événements du secteur jeu vidéo                                      | Must     | 1      | 2      | Custom Element "Agenda" V2                                   |
| US-10                                                                     | En tant que contributeur, je peux créer un événement avec titre, date, lieu, description et lien d'inscription      | Must     | 1      | 2      | Structure "Événement" V2 (config)                            |
| US-11                                                                     | En tant que visiteur, je peux effectuer une recherche plein texte sur l'ensemble du site                            | Must     | 2      | 2      | Template "Recherche CNC" V2 + Search Blueprint               |

| #&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | User Story                                                                                                  | Priorité | Points | Sprint | Composant V2 mobilisé                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ | ------------------------------------------------------------------------------------------- |
| US-12                                                                     | En tant que visiteur, je peux affiner ma recherche par type de contenu (actualité, événement, page)         | Should   | 1      | 1      | Facettes de recherche / Configuration du Search Blueprint (paramétrage)                     |
| US-13                                                                     | En tant que visiteur, je peux contacter le CNC via un formulaire avec validation et CAPTCHA                 | Must     | 1      | 1      | Formulaire Liferay Object "Formulaire CNC" V2 + Configuration Liferay Template notification |
| US-14                                                                     | Création de 2 nouveaux composants pour la page d'accueil (hors V2)                                          | Must     | 3      | 2      | Nouveaux composants qui pourront être utilisés ensuite sur le portail CNC V2                |
| US-14                                                                     | Création de 2 nouveaux composants spécifique pour la mise à disposition d'un nouveau type de page (hors V2) | Must     | 3      | 2      | Nouveaux composants qui pourront être utilisés ensuite sur le portail CNC V2                |
| US-15                                                                     | Création de 3 nouveaux composants spécifique pour la mise à disposition d'un nouveau type de page (hors V2) | Must     | 5      | 2      | Nouveaux composants qui pourront être utilisés ensuite sur le portail CNC V2                |
| US-16                                                                     | Ajustements des composants V2 pour le site jeu vidéo                                                        | Must     | 5      | 2      | Ajustement de composants V2                                                                 |
| US-17                                                                     | Le site est conforme RGAA 4.1 à 80% minimum (vérifications + corrections résiduelles)                       | Must     | 2      | 2      | Audit RGAA des composants V2 + corrections résiduelles                                      |
| US-18                                                                     | Le site est performant sur mobile, tablette et desktop  (80% Lighthouse)                                    | Must     | 2      | 2      | Audit Lighthouse + optimisations si nécessaire                                              |

/newpage

**Total : 40 points sur 2 sprints**, grâce à la capitalisation sur les composants cnc.fr V2 existants.

#### Contenu du Sprint 1 : socle et parcours éditorial complet

Le Sprint 1 démontre la puissance de l'approche de capitalisation : en une seule itération, le site jeu vidéo dispose d'un socle fonctionnel complet grâce à la réutilisation des composants issus de cnc.fr V2.

- **Provisioning** du nouveau site Liferay (multisite sur instance 7.4 existante) et association des structures de contenu V2
- **Déclinaison du thème CNC** : Configuration du Style Book aux couleurs de l'identité jeu vidéo (palette, typographie, visuels), le code source du thème reste partagé
- **Déploiement des fragments V2** sur le site : navigation, mise en avant actualités, liste d'actualités, détail, pages de contenu
- **Configuration éditoriale** : catégories jeu vidéo, arborescence de navigation, workflow de publication
- **Pipeline CI/CD** : extension de la configuration GitLab existante (cnc.fr V2) au nouveau site

Livrable Sprint 1 : site déployé en recette avec page d'accueil, navigation, actualités (liste + détail), pages de contenu, recherche. L'ensemble du parcours visiteur principal est fonctionnel dès la fin du premier sprint. Dès ce stade, les équipes CNC peuvent commencer à alimenter le site en contenus de manière autonome.

Le sprint 2 se concentrera ensuite sur le développement des nouveaux composants identifiés lors de la conception, ainsi que sur quelques ajustements de composants existants pour répondre aux besoins spécifiques du site jeu vidéo.

---

### Approche technique Liferay : capitalisation sur les composants cnc.fr V2

#### Composants V2 mobilisés

Le tableau ci-dessous illustre comment chaque besoin fonctionnel du site jeu vidéo s'appuie sur un composant **livré dans le cadre de la refonte cnc.fr V2** et disponible en production. La colonne « Adaptation site jeu vidéo » précise les éventuels ajustements nécessaires pour un usage multisite :

| Besoin fonctionnel                          | Composant Liferay utilisé                                                            | Composant cnc.fr V2 mobilisé                                                             | Adaptation site jeu vidéo                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Design system / Responsive / accessibilité  | Client Extension Theme CSS + Style Book                                              | Thème CNC v2 responsive (RGAA natif) + Fragments adaptatifs                              | Déclinaison couleurs jeu vidéo (Stylebook)                                                        |
| Construction des pages                      | Master page + Composition de Fragments + Fragments + Client Extension Custom Element | Compositions / Fragments CNC v2 mutualisés                                               | Configuration jeu vidéo                                                                           |
| Types de contenu structurés                 | Structure de contenu (DDM Structure) + Fragments                                     | Structures + Fragments paramétrables CNC v2                                              | Configuration des champs métier                                                                   |
| Liste d'actualités                          | Liste de contenus (Collection) + Fragment Carte                                      | Liste de contenus configurée + Fragment "Carte Actualité"                                | Filtrage par catégories jeu vidéo                                                                 |
| Agenda / événements                         | Client Extension Custom Element                                                      | Custom Element "Agenda" + Structure "Événement" réutilisée                               | Paramétrage des types d'événements                                                                |
| Moteur de recherche                         | Recherche Natif + Search Blueprint                                                   | Template "Recherche CNC" + Search Blueprint CNC v2                                       | Nouveau Search Blueprint pour affiner le périmètre et la pertinence des résultats de la recherche |
| Formulaire de contact                       | Liferay Object + Object Form + Fragment Form                                         | Formulaire Liferay Object "Formulaire CNC" (validation, CAPTCHA, stockage, notification) | Destinataires spécifiques                                                                         |
| Notification de contact spécifique par site | Object Action + Liferay Notification Template                                        | Template de notification "Formulaire contact CNC"                                        | Création d'un notification / destinataires spécifiques                                            |
| Navigation (rubriques)                      | Site Navigation Menu + Fragment                                                      | Fragment "Navigation CNC"                                                                | Arborescence propre au site                                                                       |

#### Architecture fonctionnelle : un socle, deux identités

Le site jeu vidéo est un site Liferay distinct au sein de la même instance 7.4, avec sa propre arborescence, ses propres contenus et son identité visuelle dédiée. Mais il s'appuie sur le **même catalogue de fragments, client extensions et structures de contenu** que cnc.fr V2.

La différenciation entre les deux sites s'opère à trois niveaux :
- **Visuel** : StyleBook permettant de personnalisé le thème CNC pour le site jeu vidéo (palette, typographie, iconographie), le code des composants reste identique
- **Éditorial** : contenus, arborescence et catégories propres au secteur jeu vidéo
- **Fonctionnel** : paramétrage des composants partagés (filtres, périmètres de recherche, workflows éditoriaux) adapté au contexte

Aucune portlet custom Java n'est nécessaire pour ce site. L'essentiel des besoins est couvert par les composants livrés dans cnc.fr V2, avec des ajustements ciblés au Sprint 2 pour les composants qui nécessiteraient des adaptations pour un usage multisite (cf. US-16). Cette approche **limite la dette technique additionnelle** et garantit que toute amélioration apportée à un composant partagé bénéficie automatiquement aux deux sites.

#### Gestion de l'administration des contenus

Les contributeurs CNC retrouvent un environnement d'administration **identique à celui de cnc.fr V2**, ce qui réduit drastiquement le besoin de formation. BEORN configure :

- Réutilisation des rôles éditoriaux dédié au site (Contributeur actualités, Contributeur événements, Administrateur site). Création des rôles qui n'existait pas encore depuis cnc.fr V2
- Le même workflow de publication (brouillon → en révision → publié) activé via Liferay Workflow
- Les mêmes vues d'administration simplifiées

La formation est réduite à une simple session de prise en main de 1h, car les contributeurs qui connaissent cnc.fr V2 sont immédiatement opérationnels sur le site jeu vidéo.

Bien que les deux sites partagent un environnement d'administration identique, ils constituent des espaces de contribution distincts : chacun dispose de ses propres politiques d'accès (rôles,  permissions, équipes éditoriales), configurables indépendamment.

---

### Bénéfices de la capitalisation pour le CNC

**Pour les équipes éditoriales et métier :**
- **Autonomie de contribution immédiate** : les contributeurs CNC, déjà familiarisés avec les composants et workflows de cnc.fr V2, sont autonomes dès le Sprint 1 pour créer des pages, publier des contenus et organiser l'arborescence du site jeu vidéo, sans intervention technique
- **Création de pages en libre-service** : le catalogue de fragments et compositions partagés permet aux équipes CNC de composer de nouvelles pages par glisser-déposer, sans solliciter BEORN pour chaque mise en page
- **Montée en compétence capitalisée** : tout investissement de formation réalisé sur cnc.fr V2 bénéficie directement au site jeu vidéo, et réciproquement
- **Sollicitation minimale du prestataire** : BEORN intervient uniquement pour les évolutions structurantes (nouveau type de composant, intégration technique). La gestion courante du site est entièrement entre les mains des équipes CNC
- **Nouveaux composants réutilisable** : Les nouveaux composants développés dans le cadre du site jeu vidéo seront conçus pour être reversés et utilisable sur le site cnc.fr V2, sans impact sur les composants existants.

**Pour le projet et le budget :**
- **Réalisation en 2 sprints** (4 semaines) grâce au socle de composants V2 existant
- **Réutilisation des composants existants** : les composants V2 sont repris et adaptés si nécessaire (Sprint 2)
- **Coût MCO maîtrisé** : les composants partagés entre les deux sites sont maintenus une seule fois. Toute correction ou amélioration profite automatiquement aux deux sites
- **Qualité capitalisée** : le site jeu vidéo bénéficie de composants déjà testés et éprouvés en production sur cnc.fr V2

**Engagement BEORN** : lors de la prise en TMA de cnc.fr V2, BEORN audite systématiquement les composants existants (fragments, client extensions, structures, templates) pour évaluer leur degré de réutilisabilité. Lorsque des adaptations sont nécessaires pour rendre un composant multisite (paramétrage, découplage, externalisation de configuration), BEORN les réalise progressivement au fil des besoins, dans le cadre des évolutions du marché. Cet engagement est intégré dans la démarche qualité de chaque évolution et vérifié lors des revues de code.

---

### Qualité et tests

#### Stratégie de tests

| Type de test               | Outil                                | Couverture                                        |
| -------------------------- | ------------------------------------ | ------------------------------------------------- |
| Tests de non-régression    | Cypress (E2E automatisé)             | Parcours visiteur principaux                      |
| Audit d'accessibilité RGAA | axe-core (automatisé) + audit manuel | 100% des gabarits de page                         |
| Tests de performance       | Lighthouse CI                        | Score ≥ 80 sur toutes les pages types             |
| Tests multi-navigateurs    | BrowserStack                         | Chrome, Firefox, Edge, Safari, mobile et desktop |

#### Méthode de validation

À chaque fin de sprint, une Sprint Review est organisée avec le PO CNC. Les User Stories sont acceptées sur la base de la DoD et des critères d'acceptation définis au Sprint Planning.

Avant mise en production (fin Sprint 2) :
- Rapport Lighthouse pour les pages d'accueil, liste actualités, détail actualité, agenda et formulaire
- Procédure de déploiement en production documentée et testée sur l'environnement de pré-production CNC
