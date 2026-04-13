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

Cette coexistence est naturelle dans un contexte TMA : une équipe peut simultanément piloter un sprint de développement sur la refonte V2 et traiter un ticket correctif bloquant sur l'intranet, sans que l'un perturbe l'autre.

---

### Profils et rôles

| Rôle                                     | Responsable                | Lien avec les profils BPU                                      |
| ---------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| **Responsable de marché / Scrum Master** | Benjamin Bini              | Chef de projet senior                                          |
| **Product Owner**                        | Chefs de projet CNC (SOSI) | Côté client — connaissent le métier et arbitrent les priorités |
| **Architecte Liferay**                   | Profil senior BEORN        | Architecte technique / Lead développeur                        |
| **Développeur Liferay**                  | Profil(s) BEORN            | Développeur Liferay (portlets, templates, fragments)           |
| **Développeur frontend**                 | Profil BEORN               | Intégrateur / développeur React                                |
| **Référent sécurité**                    | Profil BEORN               | Correspondant sécurité informatique                            |

Le responsable de marché BEORN assure le rôle de Scrum Master : il facilite les cérémonies, lève les blocages, protège l'équipe des sollicitations externes non priorisées, et assure la transparence des indicateurs auprès du CNC.

Le Product Owner est porté par les chefs de projet du SOSI CNC, conformément à l'organisation déjà en place lors de la TMA précédente. Ils définissent les priorités du backlog, valident les User Stories et prononcent l'acceptation des sprints. BEORN accompagne les PO dans la formalisation des User Stories et l'estimation des charges quand nécessaire.

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
- Couverture de tests unitaires ≥ 50% sur les nouveaux composants
- Aucune violation SonarQube de sévérité critique ou bloquante
- Documentation technique mise à jour (DAT/DEX si applicable)

**Tests :**
- Tests d'intégration passants en environnement de recette
- Tests de non-régression sur les fonctionnalités adjacentes
- Vérification RGAA des composants exposés au public (cnc.fr, Garance)

**Livraison :**
- Procédure d'installation documentée et testée
- Déploiement validé en recette par le CNC
- Ticket Jira mis à jour avec RAD (rapport d'activité détaillé)

La DoD peut évoluer en cours de marché sur proposition de BEORN ou du CNC, après validation en rétrospective.

---

### Gestion et priorisation du backlog

Le backlog est géré dans Jira (projet dédié par application si volumes importants, ou projet unique multi-application). Il est structuré en :

- **Epics** : grands domaines fonctionnels (ex. "Refonte moteur de recherche cnc.fr", "Accessibilité RGAA Garance")
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

La vélocité de référence est calibrée lors des 3 premiers sprints ("sprints de calibrage"), puis stabilisée et engagée contractuellement dans la convention de service.

/newpage

## 2.2. Cas d'école — Site institutionnel jeu vidéo CNC

### Analyse du besoin

#### Compréhension du périmètre

Le CNC souhaite réaliser un site institutionnel pour valoriser le secteur du jeu vidéo, avec les fonctionnalités suivantes : page d'accueil avec actualités mises en avant, pages de contenus structurés (rubriques/sous-rubriques), module d'actualités, agenda, moteur de recherche, formulaire de contact — le tout responsive et conforme RGAA.

Le périmètre est clair et bien délimité. Il s'agit d'un site éditorial institutionnel classique, sans authentification ni espace privé, orienté grand public et professionnels du jeu vidéo (développeurs, studios, distributeurs, acteurs institutionnels).

#### Hypothèses retenues

- Volume éditorial modeste au lancement : 20 à 50 contenus initiaux, équipe éditoriale de 2 à 3 personnes côté CNC
- Site bilingue français/anglais non requis dans le périmètre initial (mais architecture prévue pour faciliter l'extension)
- Hébergement sur l'infrastructure existante CNC (Liferay 7.4)
- Charte graphique spécifique au secteur jeu vidéo, déclinée à partir du Design System CNC commun

#### Notre approche : la mutualisation intégrale avec cnc.fr V2

L'atout majeur de ce cas d'école réside dans la stratégie de **réutilisation complète des composants développés pour la refonte cnc.fr V2**. BEORN ne conçoit pas le site jeu vidéo comme un projet isolé, mais comme la démonstration concrète d'une architecture pensée dès l'origine pour le multisite.

**Principe fondateur** : lors de la conception et du développement de cnc.fr V2, l'ensemble des composants — fragments, client extensions, structures de contenu, templates, thèmes, configurations de recherche — sont systématiquement conçus comme des **briques réutilisables et paramétrables**. Chaque développement réalisé pour cnc.fr V2 intègre nativement la capacité d'être déployé sur un autre site de l'écosystème CNC sans réécriture.

**Architecture multisite** : le site jeu vidéo est déployé comme un **nouveau site Liferay au sein de l'instance 7.4 existante**, via la fonction multisite native. Cette approche offre :

- **Réutilisation intégrale** des fragments, client extensions, structures de contenu et templates créés pour cnc.fr V2 — aucun développement en double
- **Cohérence graphique et fonctionnelle** entre les sites du CNC, garantie par un socle de composants partagé, tout en préservant une **identité visuelle différenciée** propre au secteur jeu vidéo (palette de couleurs, typographie, iconographie spécifiques)
- **Économies significatives** sur le développement initial et sur la MCO (une seule base de composants à maintenir)
- **Aucune infrastructure supplémentaire** à provisionner ni à maintenir
- **Administration centralisée** : les équipes éditoriales CNC retrouvent les mêmes interfaces et workflows de publication
- **Autonomie renforcée des équipes CNC** : les contributeurs formés sur cnc.fr V2 sont immédiatement opérationnels sur le site jeu vidéo, sans formation complémentaire. Ils peuvent créer des pages, publier des contenus et gérer l'arborescence de manière autonome, en s'appuyant sur les mêmes composants et workflows qu'ils maîtrisent déjà
- **Moins de sollicitation du prestataire** : la création de nouvelles pages, rubriques et contenus ne nécessite aucune intervention technique de BEORN — les équipes CNC composent directement leurs pages à partir du catalogue de fragments et templates partagés

**Ce que cela change concrètement pour le développement de cnc.fr V2** : chaque fragment, chaque client extension, chaque template est développé avec des paramètres de configuration (couleurs, espacements, variantes d'affichage) permettant leur réemploi sur d'autres sites sans modification de code. Cette approche modulaire ne génère pas de surcoût sur le projet V2 — il s'agit d'une bonne pratique de développement Liferay que BEORN applique systématiquement — mais elle démultiplie la valeur de chaque composant produit.

---

### Cadrage Agile Scrum

#### Équipe

| Rôle                          | Intervenant               | Taux |
| ----------------------------- | ------------------------- | ---- |
| Scrum Master / Chef de projet | Cédric PIERRON (BEORN)    | 20%  |
| Product Owner                 | Chef de projet CNC (SOSI) | 30%  |
| Développeur Liferay (lead)    | Profil senior BEORN       | 100% |
| Intégrateur frontend          | Profil BEORN              | 50%  |

Équipe volontairement resserrée pour un périmètre fonctionnel maîtrisé. Renfort possible sur le sprint 3 (accessibilité RGAA) si le volume d'audit le justifie.

#### Paramètres Scrum

- Durée des sprints : **2 semaines**
- Vélocité cible : 20 points par sprint (calibrée au Sprint 1)
- Durée totale estimée : **3 sprints** (6 semaines), hors phase de cadrage initiale (1 semaine) — la réutilisation des composants cnc.fr V2 réduit significativement la charge de développement

#### Rituels

| Cérémonie          | Durée                 | Participants                              |
| ------------------ | --------------------- | ----------------------------------------- |
| Sprint Planning    | 2h                    | Équipe BEORN + PO CNC                     |
| Daily Standup      | 15 min                | Équipe BEORN                              |
| Backlog Refinement | 1h (milieu de sprint) | Lead dev + PO CNC                         |
| Sprint Review      | 1h                    | Équipe BEORN + PO CNC + parties prenantes |
| Rétrospective      | 45 min                | Équipe BEORN                              |

#### Backlog priorisé et estimé

Les estimations en points reflètent la charge optimisée grâce à la réutilisation des composants cnc.fr V2. L'essentiel du travail porte sur la configuration, le paramétrage et la personnalisation graphique des composants existants.

/newpage


| #&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | User Story                                                                                                    | Priorité | Points | Sprint | Composant V2 réutilisé                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ | ------------------------------------- |
| US-01                                                                     | En tant qu'admin, je dispose du site jeu vidéo provisionné avec les structures de contenu V2 configurées      | Must     | 3      | 1      | Structures DDM + templates V2         |
| US-02                                                                     | En tant qu'admin, je dispose du thème CNC décliné aux couleurs du secteur jeu vidéo                           | Must     | 5      | 1      | Thème CNC V2 (surcharge CSS)          |
| US-03                                                                     | En tant que visiteur, je vois une page d'accueil avec les 3 dernières actualités mises en avant               | Must     | 2      | 1      | Fragment "Mise en avant actu" V2      |
| US-04                                                                     | En tant qu'éditeur, je peux publier une actualité avec titre, chapô, image, corps de texte, date et catégorie | Must     | 1      | 1      | Workflow éditorial V2 (configuration) |
| US-05                                                                     | En tant que visiteur, je navigue dans les rubriques et sous-rubriques du site via le menu principal           | Must     | 2      | 1      | Fragment "Navigation CNC" V2          |
| US-06                                                                     | En tant que visiteur, je consulte la liste des actualités filtrables par catégorie, avec pagination           | Must     | 2      | 1      | Fragment "Liste actualités" V2        |
| US-07                                                                     | En tant que visiteur, je consulte le détail d'une actualité avec partage réseaux sociaux                      | Should   | 1      | 1      | Fragment "Détail actualité" V2        |
| US-08                                                                     | En tant qu'éditeur, je peux créer et gérer des pages de contenu (rubrique, sous-rubrique) avec éditeur riche  | Must     | 2      | 1      | Page Templates V2                     |
| US-09                                                                     | En tant que visiteur, je consulte l'agenda des événements du secteur jeu vidéo                                | Must     | 2      | 2      | Fragment "Agenda" V2                  |
| US-10                                                                     | En tant qu'éditeur, je peux créer un événement avec titre, date, lieu, description et lien d'inscription      | Must     | 1      | 2      | Structure "Événement" V2 (config)     |
| US-11                                                                     | En tant que visiteur, je peux filtrer l'agenda par mois et par type d'événement                               | Should   | 2      | 2      | Client extension "Filtre agenda" V2   |
| US-12                                                                     | En tant que visiteur, je peux effectuer une recherche plein texte sur l'ensemble du site                      | Must     | 3      | 2      | Client extension "Recherche CNC" V2   |
| US-13                                                                     | En tant que visiteur, je peux affiner ma recherche par type de contenu (actualité, événement, page)           | Should   | 2      | 2      | Search Blueprint V2 (paramétrage)     |
| US-14                                                                     | En tant que visiteur, je peux contacter le CNC via un formulaire avec validation et CAPTCHA                   | Must     | 2      | 2      | Client extension "Formulaire CNC" V2  |
| US-15                                                                     | En tant qu'admin, les soumissions du formulaire sont reçues par email et enregistrées dans Liferay            | Must     | 1      | 2      | Configuration notification V2         |
| US-16                                                                     | Le site est conforme RGAA 4.1 à 80% minimum (audit + corrections résiduelles)                                 | Must     | 5      | 3      | Composants V2 déjà conformes RGAA     |
| US-17                                                                     | Le site est responsive sur mobile, tablette et desktop (Chrome, Firefox, Edge, Safari)                        | Must     | 2      | 3      | Responsive natif des fragments V2     |

/newpage

**Total : 38 points sur 3 sprints**, grâce à la mutualisation des composants cnc.fr V2.

#### Contenu du Sprint 1 — Socle et parcours éditorial complet

Le Sprint 1 démontre la puissance de l'approche mutualisée : en une seule itération, le site jeu vidéo dispose d'un socle fonctionnel complet grâce à la réutilisation des composants cnc.fr V2.

- **Provisioning** du nouveau site Liferay (multisite sur instance 7.4 existante) et association des structures de contenu V2
- **Déclinaison du thème CNC** : surcharge des variables CSS pour l'identité jeu vidéo (palette, typographie, visuels) — le code source du thème reste partagé
- **Déploiement des fragments V2** sur le site : navigation, mise en avant actualités, liste d'actualités, détail, pages de contenu
- **Configuration éditoriale** : catégories jeu vidéo, arborescence de navigation, workflow de publication
- **Pipeline CI/CD** : extension de la configuration GitLab existante (cnc.fr V2) au nouveau site

Livrable Sprint 1 : site déployé en recette avec page d'accueil, navigation, actualités (liste + détail), pages de contenu — l'ensemble du parcours visiteur principal est fonctionnel dès la fin du premier sprint. Dès ce stade, les équipes CNC peuvent commencer à alimenter le site en contenus de manière autonome.

---

### Approche technique Liferay — Réutilisation des composants cnc.fr V2

#### Composants réutilisés depuis cnc.fr V2

Le tableau ci-dessous illustre comment chaque besoin fonctionnel du site jeu vidéo est couvert par un composant **déjà développé et éprouvé** dans le cadre de la refonte cnc.fr V2 :

| Besoin fonctionnel          | Composant cnc.fr V2 réutilisé                                                   | Adaptation site jeu vidéo          |
| --------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| Types de contenu structurés | Structures de contenu (DDM) + Templates FreeMarker paramétrables                | Configuration des champs métier    |
| Construction des pages      | Fragments CNC mutualisés + Page Templates                                       | Variante graphique jeu vidéo       |
| Liste d'actualités          | Fragment "Liste d'actualités" + Asset Publisher configuré                       | Filtrage par catégories jeu vidéo  |
| Agenda / événements         | Fragment "Agenda" + Structure "Événement" réutilisée                            | Paramétrage des types d'événements |
| Moteur de recherche         | Client extension "Recherche CNC" + Search Blueprint                             | Périmètre de recherche restreint   |
| Formulaire de contact       | Client extension "Formulaire CNC" (validation, CAPTCHA, stockage, notification) | Destinataires spécifiques          |
| Navigation (rubriques)      | Fragment "Navigation CNC" + Site Navigation Menu                                | Arborescence propre au site        |
| Responsive / accessibilité  | Thème CNC responsive (RGAA natif) + Fragments adaptatifs                        | Déclinaison couleurs jeu vidéo     |

#### Architecture fonctionnelle — un socle, deux identités

Le site jeu vidéo est un site Liferay distinct au sein de la même instance 7.4, avec sa propre arborescence, ses propres contenus et son identité visuelle dédiée. Mais il s'appuie sur le **même catalogue de fragments, client extensions et structures de contenu** que cnc.fr V2.

La différenciation entre les deux sites s'opère à trois niveaux :
- **Visuel** : variables CSS du thème CNC surchargées pour le site jeu vidéo (palette, typographie, iconographie) — le code des composants reste identique
- **Éditorial** : contenus, arborescence et catégories propres au secteur jeu vidéo
- **Fonctionnel** : paramétrage des composants partagés (filtres, périmètres de recherche, workflows éditoriaux) adapté au contexte

Aucune portlet custom Java ni aucun développement spécifique n'est nécessaire pour ce site — la totalité des besoins est couverte par les composants déjà développés pour cnc.fr V2, ce qui **élimine la dette technique additionnelle** et garantit que toute amélioration apportée à un composant bénéficie automatiquement aux deux sites.

#### Gestion de l'administration des contenus

Les éditeurs CNC retrouvent un environnement d'administration **identique à celui de cnc.fr V2**, ce qui réduit drastiquement le besoin de formation. BEORN configure :

- Des rôles éditoriaux dédiés (Éditeur actualités jeu vidéo, Éditeur événements, Administrateur site) — calqués sur les rôles cnc.fr V2
- Le même workflow de publication (brouillon → en révision → publié) activé via Liferay Workflow
- Les mêmes vues d'administration simplifiées dans l'Asset Library

La formation est réduite à une simple session de prise en main de 1h, car les éditeurs qui connaissent cnc.fr V2 sont immédiatement opérationnels sur le site jeu vidéo.

---

### Bénéfices de la mutualisation pour le CNC

**Pour les équipes éditoriales et métier :**
- **Autonomie de contribution immédiate** : les éditeurs CNC, déjà formés sur les composants et workflows de cnc.fr V2, sont autonomes dès le Sprint 1 pour créer des pages, publier des contenus et organiser l'arborescence du site jeu vidéo — sans intervention technique
- **Création de pages en libre-service** : le catalogue de fragments et templates partagés permet aux équipes CNC de composer de nouvelles pages par glisser-déposer, sans solliciter BEORN pour chaque mise en page
- **Montée en compétence capitalisée** : tout investissement de formation réalisé sur cnc.fr V2 bénéficie directement au site jeu vidéo, et réciproquement
- **Sollicitation minimale du prestataire** : BEORN intervient uniquement pour les évolutions structurantes (nouveau type de composant, intégration technique) — la gestion courante du site est entièrement entre les mains des équipes CNC

**Pour le projet et le budget :**
- **Réalisation en 3 sprints** (6 semaines) grâce au socle de composants V2 existant
- **Aucun composant supplémentaire à développer** : le travail porte sur la configuration et la personnalisation graphique
- **Coût MCO nul** : les composants partagés sont déjà maintenus dans le cadre de la MCO cnc.fr V2 — toute correction ou amélioration profite automatiquement aux deux sites
- **Qualité garantie** : le site jeu vidéo bénéficie de composants déjà testés, validés RGAA, et éprouvés en production

**Engagement BEORN** : lors de chaque développement réalisé dans le cadre de la refonte cnc.fr V2, l'équipe BEORN conçoit systématiquement les composants (fragments, client extensions, structures, templates) comme des briques réutilisables et paramétrables. Cet engagement de mutualisation est intégré dans la Definition of Done de chaque User Story V2 et vérifié lors des revues de code.

---

### Qualité et tests

#### Stratégie de tests

| Type de test                        | Outil                                | Couverture                                          |
| ----------------------------------- | ------------------------------------ | --------------------------------------------------- |
| Tests unitaires (composants custom) | JUnit / Jest                         | ≥ 50% des classes custom                            |
| Tests d'intégration                 | Tests Liferay (Arquillian)           | Flux critiques : publication, recherche, formulaire |
| Tests de non-régression             | Cypress (E2E automatisé)             | Parcours visiteur principaux                        |
| Audit d'accessibilité RGAA          | axe-core (automatisé) + audit manuel | 100% des gabarits de page                           |
| Tests de performance                | Lighthouse CI                        | Score ≥ 80 sur toutes les pages types               |
| Tests multi-navigateurs             | BrowserStack                         | Chrome, Firefox, Edge, Safari — mobile et desktop   |

#### Méthode de validati

À chaque fin de sprint, une Sprint Review est organisée avec le PO CNC. Les User Stories sont acceptées sur la base de la DoD et des critères d'acceptation définis au Sprint Planning.

Avant mise en production (fin Sprint 3) :
- Rapport d'audit d'accessibilité RGAA fourni par un auditeur compétent
- Déclaration d'accessibilité publiée sur le site (modèle DINUM)
- Rapport Lighthouse pour les pages d'accueil, liste actualités, détail actualité, agenda et formulaire
- Procédure de déploiement en production documentée et testée sur l'environnement de pré-production CNC
