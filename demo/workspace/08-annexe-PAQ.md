# Modèle Plan d'Assurance Qualité (PAQ)

**Marché n° 2026028 — TMA des applications web Liferay du CNC**
**Titulaire** : BEORN Technologies
**Version** : 1.0
**Date** : À remettre dans les 30 jours suivant la notification du marché

---

## Annexe - Modèle PAQ

### Table des matières

- [Partie 1 — Cadre et organisation](#partie-1--cadre-et-organisation)
  - [1.1. Objet et domaine d'application du PAQ](#11-objet-et-domaine-dapplication-du-paq)
  - [1.2. Documents de référence](#12-documents-de-référence)
  - [1.3. Organisation du marché](#13-organisation-du-marché)
  - [1.4. Interfaces et modalités de communication](#14-interfaces-et-modalités-de-communication)
- [Partie 2 — Processus qualité](#partie-2--processus-qualité)
  - [2.1. Gestion des demandes (cycle de vie d'un ticket)](#21-gestion-des-demandes)
  - [2.2. Gestion des configurations et des livraisons](#22-gestion-des-configurations-et-des-livraisons)
  - [2.3. Processus de recette et de validation](#23-processus-de-recette-et-de-validation)
  - [2.4. Gestion des non-conformités et des actions correctives](#24-gestion-des-non-conformités-et-des-actions-correctives)
- [Partie 3 — Indicateurs et pilotage](#partie-3--indicateurs-et-pilotage)
  - [3.1. Tableau de bord qualité et indicateurs SLA](#31-tableau-de-bord-qualité-et-indicateurs-sla)
  - [3.2. Revues qualité (COPROJ, COPIL)](#32-revues-qualité-coproj-copil)
  - [3.3. Traitement des alertes et escalades](#33-traitement-des-alertes-et-escalades)
- [Partie 4 — Amélioration continue](#partie-4--amélioration-continue)
  - [4.1. Retours d'expérience (REX) post-incident](#41-retours-dexpérience-rex-post-incident)
  - [4.2. Plan d'amélioration annuel](#42-plan-damélioration-annuel)
  - [4.3. Gestion des risques projet](#43-gestion-des-risques-projet)

---

## Partie 1 — Cadre et organisation

### 1.1. Objet et domaine d'application du PAQ

#### Objet

Ce Plan d'Assurance Qualité formalise les dispositions mises en œuvre par BEORN Technologies pour garantir la qualité des prestations de TMA des applications web Liferay du CNC (marché n° 2026028).

Il constitue le document de référence pour le pilotage qualité du marché et engage BEORN sur les moyens, les processus et les indicateurs décrits ci-après.

#### Périmètre d'application

Le PAQ couvre les trois applications du périmètre :

| Application      | Technologie              | Nature                                                     |
| ---------------- | ------------------------ | ---------------------------------------------------------- |
| **Intranet CNC** | Liferay EE 6.2           | Portail interne (~500 utilisateurs)                        |
| **cnc.fr V2**    | Liferay 7.4 / PostgreSQL | Site institutionnel public (~1,5M visites/an)              |
| **Garance**      | Liferay 7.4 / Docker     | Portail public spécialisé (intégration Axiell Collections) |

Et l'ensemble des types de prestations :

- **Maintenance corrective** (MCO) — traitement des anomalies, rétablissement du service
- **Maintenance évolutive** — développements fonctionnels, adaptations aux besoins métiers
- **Maintenance adaptative** — veille technologique, patches Liferay, mises à jour
- **Projets de développement agile** — nouvelles applications, évolutions structurantes
- **Support fonctionnel et technique** (hotline)

#### Principes directeurs

Quatre principes guident notre approche qualité sur ce marché :

- **Transparence** — tout incident, retard ou risque est signalé au CNC dès identification, sans attendre le prochain comité de projet.
- **Traçabilité** — chaque demande fait l'objet d'un ticket Jira avec statut, priorité, responsable, délai estimé et réel. L'historique complet est conservé.
- **Amélioration continue** — les indicateurs sont analysés en tendance à chaque COPIL ; des actions correctives sont proposées dès qu'un indicateur se dégrade.
- **Devoir de conseil** — BEORN alerte le CNC sur les risques techniques identifiés (obsolescence, dette technique, opportunités de mutualisation), sans attendre de sollicitation.

#### Cycle de vie du PAQ

Ce document est remis dans les 30 jours suivant la notification du marché. Il est ensuite :

- Révisé à chaque COPIL trimestriel si des ajustements sont nécessaires
- Mis à jour formellement au minimum une fois par an lors de la revue annuelle
- Soumis au CNC pour validation avant toute modification substantielle

---

### 1.2. Documents de référence

#### Documents contractuels

| Référence         | Intitulé                                                        |
| ----------------- | --------------------------------------------------------------- |
| CCTP              | Cahier des Clauses Techniques Particulières — Marché n° 2026028 |
| CCAP              | Cahier des Clauses Administratives Particulières                |
| BPU               | Bordereau des Prix Unitaires                                    |
| Mémoire technique | Offre technique BEORN Technologies                              |

#### Documents produits par BEORN dans le cadre du marché

| Document                   | Objet                              | Échéance                            |
| -------------------------- | ---------------------------------- | ----------------------------------- |
| PAQ (présent document)     | Organisation qualité               | J+30 après notification             |
| PAS                        | Plan d'Assurance Sécurité          | J+30 après notification             |
| Convention de service      | Niveaux de service par application | Fin de phase d'initialisation (S8)  |
| Rapports d'audit technique | État technique des 3 applications  | Phase 4 de l'initialisation (S5-S7) |

#### Référentiels applicables

- RGAA 4.1 — Référentiel Général d'Amélioration de l'Accessibilité
- RGS v2.0 — Référentiel Général de Sécurité (ANSSI)
- RGPD (Règlement UE 2016/679) — obligations de sous-traitant (article 28)
- OWASP Top 10 — sécurité applicative
- ISO/IEC 27001:2022 — principes appliqués (démarche de certification engagée)

---

### 1.3. Organisation du marché

#### Organigramme

```
                    ┌───────────────────────┐
                    │   Benjamin Bini       │
                    │  Responsable de       │
                    │  marché / Scrum Master│
                    │  (30%)                │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
  ┌─────────┴─────────┐ ┌──────┴──────┐ ┌─────────┴─────────┐
  │  Thomas Tsé        │ │ Architecte  │ │  Développeur(s)   │
  │  Dev Liferay senior│ │ Liferay     │ │  Liferay          │
  │  (100%)            │ │ (variable)  │ │  + Frontend        │
  └────────────────────┘ └─────────────┘ └───────────────────┘
```

#### Rôles et responsabilités

| Rôle                                     | Responsable           | Missions                                                                                                |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| **Responsable de marché / Scrum Master** | Benjamin Bini         | Pilotage global, interface CNC, animation des comités, suivi qualité, facilitation agile                |
| **Développeur Liferay senior**           | Thomas Tsé            | Développement correctif et évolutif sur cnc.fr V2 et Garance, transfert de connaissances, revue de code |
| **Architecte Liferay**                   | Profil senior BEORN   | Architecture technique, audit, supervision MCO Intranet 6.2, veille Liferay                             |
| **Développeur(s) Liferay**               | Profil(s) BEORN       | Développement, tests unitaires, documentation technique                                                 |
| **Développeur frontend**                 | Profil BEORN          | Intégration, composants React, accessibilité RGAA                                                       |
| **Référent sécurité**                    | Olivier Bonnet-Torrès | Pilotage PAS, gestion de crise, comités sécurité                                                        |

#### Matrice RACI — Activités qualité

| Activité                   | Resp. marché | Équipe dev | CNC (SOSI) |
| -------------------------- | ------------ | ---------- | ---------- |
| Qualification des demandes | **R**        | C          | I          |
| Priorisation du backlog    | C            | I          | **R**      |
| Développement et tests     | I            | **R**      | I          |
| Recette fonctionnelle      | I            | C          | **R**      |
| Déploiement en production  | **R**        | A          | A          |
| Reporting qualité          | **R**        | C          | I          |
| Validation des livrables   | C            | I          | **R**      |
| Revue PAQ                  | **R**        | I          | A          |

_R = Responsable, A = Approbateur, C = Consulté, I = Informé_

---

### 1.4. Interfaces et modalités de communication

#### Outils

| Outil          | Usage                                                                                    | Accès                                  |
| -------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| **Jira**       | Suivi de toutes les demandes (correctif, évolutif, études). Outil central de traçabilité | CNC + BEORN                            |
| **Confluence** | Base de connaissances, documentation technique, comptes-rendus                           | CNC + BEORN                            |
| **GitLab**     | Dépôts de code source, merge requests, CI/CD                                             | BEORN (accès CNC en lecture)           |
| **Teams**      | Communication rapide, visioconférence                                                    | CNC + BEORN                            |
| **Téléphone**  | Hotline pour les demandes bloquantes (9h–18h)                                            | Ligne directe du responsable de marché |
| **Email**      | Communication formelle, transmission des livrables                                       | CNC + BEORN                            |

#### Plages horaires

| Canal                   | Disponibilité                                                     |
| ----------------------- | ----------------------------------------------------------------- |
| Hotline téléphonique    | Lundi au vendredi, 9h00–13h00 / 14h00–18h00 (hors jours fériés)   |
| Jira                    | 24/7 (signalement asynchrone)                                     |
| Teams                   | Jours ouvrés, 9h00–18h00                                          |
| Astreinte (optionnelle) | Sur demande du CNC pour les anomalies bloquantes cnc.fr / Garance |

#### Délais de réponse hotline

| Catégorie               | Délai de réponse |
| ----------------------- | ---------------- |
| **Bloquante / urgente** | ≤ 0,5 jour ouvré |
| **Majeure**             | ≤ 1 jour ouvré   |
| **Mineure**             | ≤ 2 jours ouvrés |

#### Livrables de reporting

| Livrable                          | Fréquence                      | Délai de remise              |
| --------------------------------- | ------------------------------ | ---------------------------- |
| Compte-rendu COPROJ               | Bimensuel                      | 48h ouvrées après réunion    |
| Compte-rendu COPIL                | Trimestriel                    | 5 jours ouvrés après réunion |
| Rapport correctif mensuel         | Mensuel                        | Avant chaque COPROJ          |
| Rapport d'activité détaillé (RAD) | Par évolution livrée           | 48h ouvrées après clôture    |
| Compte-rendu Sprint Review        | Fin de sprint (projets agiles) | 48h ouvrées                  |

---

## Partie 2 — Processus qualité

### 2.1. Gestion des demandes

#### Cycle de vie d'un ticket — Maintenance corrective

Le traitement d'une anomalie suit six étapes, intégralement tracées dans Jira :

```
Signalement → Qualification → Diagnostic → Correction → Recette → Clôture
```

**1. Signalement** — Le CNC ouvre un ticket Jira (ou signale par téléphone/email ; dans ce cas BEORN crée le ticket immédiatement). Le ticket comprend : description de l'anomalie, environnement concerné, captures d'écran si possible, criticité proposée.

**2. Accusé de réception et qualification** — BEORN confirme la réception, valide ou ajuste la criticité, et communique le délai d'intervention prévisionnel conformément aux SLA ci-dessous.

**3. Diagnostic** — Analyse technique : identification de la cause racine, du périmètre impacté et de la complexité de correction.

**4. Correction** — Développement du correctif sur une branche Git dédiée. Tests unitaires. Revue de code par un pair via merge request GitLab.

**5. Recette** — Déploiement en environnement de recette. Transmission de la procédure d'installation. Tests de validation par le CNC. Si non-conformité constatée, retour en phase de correction.

**6. Clôture** — Déploiement en production après validation du CNC. Clôture du ticket Jira avec rapport de résolution. Mise à jour de la documentation si nécessaire.

#### Classification des anomalies

| Niveau       | Définition                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Bloquant** | Arrêt complet de l'application ou d'une fonctionnalité, sans solution de contournement, ou perte de données |
| **Majeur**   | Fonctionnement partiel, contournement possible mais performances dégradées ou données erronées              |
| **Mineur**   | Anomalie n'affectant pas significativement le fonctionnement ; impact ergonomique ou cosmétique             |

#### Délais de rétablissement (SLA MCO)

Ces délais couvrent l'intégralité du cycle : prise en compte, diagnostic, correction et livraison en recette. Ils sont déclenchés à l'envoi du signalement par le CNC.

**Intranet (Liferay 6.2) :**

| Niveau   | Délai             |
| -------- | ----------------- |
| Bloquant | ≤ 2 jours ouvrés  |
| Majeur   | ≤ 5 jours ouvrés  |
| Mineur   | ≤ 10 jours ouvrés |

**cnc.fr V2 et Garance (Liferay 7.4) :**

| Niveau   | Délai             |
| -------- | ----------------- |
| Bloquant | ≤ 1 jour ouvré    |
| Majeur   | ≤ 2 jours ouvrés  |
| Mineur   | ≤ 10 jours ouvrés |

Les délais plus courts pour cnc.fr et Garance reflètent l'exposition publique de ces applications.

Pour les anomalies bloquantes, l'intervention est immédiate, sans devis préalable. Un rapport de clôture détaillé est transmis sous 48h ouvrées.

#### Cycle de vie d'un ticket — Maintenance évolutive

```
Demande CNC → Analyse → Devis → Validation BC → Réalisation agile → Livraison → Clôture
```

**1. Réception et analyse** — La demande est réceptionnée via Jira et qualifiée par le chef de projet : périmètre fonctionnel, complexité, dépendances, impact éventuel sur les autres applications.

**2. Production du devis** — Délais conformes aux engagements SLA :

| Type d'évolution                     | Délai du devis    |
| ------------------------------------ | ----------------- |
| Simple (≤ 3 jours de charge)         | ≤ 5 jours ouvrés  |
| Complexe (atelier de cadrage requis) | ≤ 10 jours ouvrés |

Le devis précise : solution retenue, charge estimée par profil, planning prévisionnel, livrables attendus, hypothèses.

**3. Validation** — Le CNC émet un bon de commande. Aucune réalisation ne démarre sans BC signé.

**4. Réalisation** — Mini-cycle agile : spécification, développement, tests unitaires et d'intégration, livraison en recette.

**5. Livraison et clôture** — Déploiement en recette, validation CNC, déploiement en production. Clôture du ticket Jira avec RAD transmis sous 48h.

#### Priorisation des demandes

En cas de concurrence entre plusieurs demandes, la priorisation est la suivante (co-validée avec le CNC en COPROJ) :

| Priorité | Type de demande                                             | Traitement                          |
| -------- | ----------------------------------------------------------- | ----------------------------------- |
| **1**    | Anomalies bloquantes et majeures                            | Priorité absolue sur les évolutions |
| **2**    | Évolutions liées aux jalons contractuels                    | Planifiées en priorité              |
| **3**    | Évolutions à fort impact métier (demandées par les CP SOSI) | Sprint suivant                      |
| **4**    | Évolutions standard                                         | Backlog                             |

---

### 2.2. Gestion des configurations et des livraisons

#### Gestion du code source

| Élément               | Outil / Méthode                                                                  |
| --------------------- | -------------------------------------------------------------------------------- |
| Dépôt                 | GitLab — un dépôt par application                                                |
| Stratégie de branches | Git Flow : `main` (production), `develop` (intégration), `feature/*`, `hotfix/*` |
| Revue de code         | Merge request obligatoire, approbation par un pair minimum                       |
| Qualité de code       | SonarQube — aucune violation critique ou bloquante tolérée                       |

#### Nomenclature des branches

```
feature/JIRA-XXX-description-courte   (évolutions)
hotfix/JIRA-XXX-description-courte    (correctifs urgents)
release/vX.Y.Z                        (préparation de livraison)
```

#### Gestion des versions

Chaque livraison en production est associée à un tag Git et à une note de version comprenant :

- Liste des tickets résolus (avec liens Jira)
- Procédure d'installation documentée et testée
- Points de vigilance et impacts identifiés
- Documentation mise à jour (DAT/DEX le cas échéant)
- Procédure de rollback

#### Environnements

| Environnement      | Usage                                   | Responsable déploiement               |
| ------------------ | --------------------------------------- | ------------------------------------- |
| **Développement**  | Développement et tests unitaires        | BEORN                                 |
| **Recette**        | Tests d'intégration, validation CNC     | BEORN (déploiement), CNC (validation) |
| **Pré-production** | Tests de performance, validation finale | BEORN                                 |
| **Production**     | Service en ligne                        | BEORN (après validation CNC)          |

#### Processus de livraison

1. Développement terminé et merge request approuvée
2. Déploiement en environnement de recette
3. Transmission de la procédure d'installation au CNC
4. Tests de non-régression par BEORN
5. Validation fonctionnelle par le CNC
6. Déploiement en production (après accord formel du CNC)
7. Vérification post-déploiement (smoke tests)
8. Clôture du ticket et remise de la note de version

---

### 2.3. Processus de recette et de validation

#### Recette technique BEORN (avant livraison au CNC)

Avant toute livraison en recette, BEORN effectue les vérifications suivantes :

- **Tests unitaires** — couverture minimale de 50 % (conformément au CCTP)
- **Tests d'intégration** — vérification des interactions entre composants
- **Tests de non-régression** — sur les fonctionnalités adjacentes au périmètre modifié
- **Vérification RGAA** — pour les composants exposés au public (cnc.fr, Garance)
- **Tests cross-navigateurs** — Chrome, Firefox, Safari, Edge (dernières versions)
- **Tests responsive** — desktop, tablette, mobile
- **Analyse SonarQube** — aucune violation critique ou bloquante

#### Recette fonctionnelle CNC

- Mise à disposition en environnement de recette avec procédure d'installation
- Support BEORN pendant la validation (réponse aux questions dans la journée)
- Durée de recette conforme aux délais définis dans la convention de service
- En cas de non-conformité : retour en correction, tracé dans Jira

#### Critères d'acceptation — Definition of Done (DoD)

Pour les projets agiles, la DoD est co-construite avec le CNC en début de projet et versionnée dans Confluence. Elle constitue le critère d'acceptation de chaque User Story. La DoD type pour ce marché :

**Développement :**

- Code revu par un pair (merge request GitLab approuvée)
- Aucune violation SonarQube critique ou bloquante
- Documentation technique mise à jour (DAT/DEX le cas échéant)

**Tests :**

- Tests d'intégration passants en environnement de recette
- Non-régression vérifiée sur les fonctionnalités adjacentes
- Vérification RGAA des composants exposés au public
- Rendu vérifié sur navigateurs et résolutions variés

**Livraison :**

- Procédure d'installation documentée et testée
- Déploiement validé en recette par le CNC
- Ticket Jira mis à jour avec RAD

La DoD peut évoluer en cours de marché, sur proposition de BEORN ou du CNC, après validation en rétrospective.

---

### 2.4. Gestion des non-conformités et des actions correctives

#### Définition

Une non-conformité est tout écart entre le résultat attendu et le résultat constaté :

- Anomalie détectée en recette CNC (régression, comportement non conforme aux spécifications)
- Dépassement de SLA
- Défaut de livrable (documentation manquante, procédure absente)
- Indicateur qualité en dessous du seuil engagé

#### Processus de traitement

1. **Détection et enregistrement** — La non-conformité est enregistrée dans Jira (catégorie « Non-conformité ») avec description, impact et gravité.

2. **Analyse des causes** — BEORN conduit une analyse des causes racines (méthode des 5 pourquoi, ou diagramme d'Ishikawa pour les cas complexes). L'analyse est documentée dans le ticket.

3. **Correction immédiate** — Le défaut constaté est corrigé dans les meilleurs délais, selon les SLA applicables.

4. **Action corrective de fond** — Si la non-conformité révèle un défaut de processus, une action structurelle est définie : modification de procédure, ajout de contrôle, formation de l'équipe.

5. **Vérification** — L'efficacité de l'action corrective est vérifiée au COPROJ suivant. Si le problème persiste, l'action est renforcée.

6. **Capitalisation** — La non-conformité et sa résolution sont intégrées au REX et au plan d'amélioration annuel.

#### Suivi

Un registre des non-conformités est maintenu dans Jira (filtre dédié) et présenté à chaque COPIL :

- Non-conformités ouvertes / résolues / en cours
- Délai moyen de résolution
- Tendances (récurrence, catégories les plus fréquentes)
- Actions correctives en cours et évaluation de leur efficacité

---

## Partie 3 — Indicateurs et pilotage

### 3.1. Tableau de bord qualité et indicateurs SLA

#### Les 8 indicateurs du marché

BEORN s'engage sur les indicateurs définis dans le CCTP :

| ##  | Indicateur                     | Engagement                                 | Mesure             |
| --- | ------------------------------ | ------------------------------------------ | ------------------ |
| 1   | Délai de production d'un devis | ≤ 5j ouvrés (simple) / ≤ 10j (complexe)    | Par demande        |
| 2   | Adéquation des compétences     | 100 % des intervenants conformes au profil | Trimestriel        |
| 3   | Stabilité de l'équipe          | Remplacement ≤ 15 jours ouvrés             | Par événement      |
| 4   | Taux de recouvrement           | Initialisation ≤ 8 semaines                | À la mise en TMA   |
| 5   | Maintien de la vélocité        | Vélocité maintenue à partir du 5e sprint   | Par lot de sprints |
| 6   | Respect du planning            | Jalons livrés à ±1 sprint                  | Par sprint         |
| 7   | Taux de régression             | 0 régression bloquante en production       | Par livraison      |
| 8   | Délai de MCO corrective        | Conforme aux SLA par application/gravité   | Par ticket         |

#### Tableau de bord Jira

Le tableau de bord est accessible en permanence au CNC dans l'espace projet Jira dédié :

- **Vue temps réel** — état de chaque ticket, délais, responsable, historique
- **Vue mensuelle** — tickets ouverts / résolus / en cours, délais réels vs. engagés
- **Vue tendance** — évolution des indicateurs sur les 6 derniers mois

Un rapport synthétique mensuel est transmis avant chaque COPROJ.

---

### 3.2. Revues qualité (COPROJ, COPIL)

#### Comité de projet opérationnel (COPROJ) — Bimensuel

**Participants** : Chef de projet BEORN + interlocuteurs techniques CNC
**Format** : Visioconférence (Teams) ou présentiel — 1h
**Périmètre** : Mutualisé pour les 3 applications (Intranet, cnc.fr, Garance)

**Ordre du jour type :**

1. Revue des actions du COPROJ précédent
2. Avancement des demandes en cours (correctifs, évolutions)
3. Indicateurs SLA de la période
4. Plan de charge prévisionnel à 4 semaines
5. Points de blocage, décisions urgentes
6. Priorisation du backlog d'évolutions
7. Actions à mener

**Compte-rendu** transmis sous 48h ouvrées : participants, décisions, actions avec responsable et échéance, points en suspens.

#### Comité de pilotage (COPIL) — Trimestriel

**Participants** : Direction BEORN + Chef de projet + Responsables CNC (SOSI, DAM si nécessaire)
**Format** : Présentiel ou visioconférence — 2h

**Ordre du jour type :**

1. Bilan qualité du trimestre
   - Indicateurs SLA : niveau atteint, tendances, écarts
   - Registre des non-conformités
   - Retour qualitatif du CNC
2. Revue du PAQ
   - Ajustements proposés
   - Évolution de la convention de service
3. Maintenance adaptative
   - Patches appliqués, versions mises à jour
   - Veille technologique : alertes et recommandations
4. Perspectives
   - Projets agiles à venir
   - Plan de charge du trimestre suivant
   - Recommandations (dette technique, optimisations)
5. Suivi du plan d'amélioration

**Compte-rendu** transmis sous 5 jours ouvrés.

#### Structure type d'un compte-rendu

```
COMPTE-RENDU [COPROJ/COPIL] — [Date]
Marché n° 2026028 — TMA Liferay CNC

Participants : [Liste]

1. SUIVI DES ACTIONS PRÉCÉDENTES
   [Action] — [Responsable] — [Statut]

2. POINTS ABORDÉS
   [Résumé des discussions et décisions]

3. INDICATEURS QUALITÉ
   [Tableau synthétique des SLA]

4. DÉCISIONS PRISES
   [Décision] — [Responsable] — [Échéance]

5. ACTIONS À MENER
   [Action] — [Responsable] — [Échéance]

6. PROCHAINE RÉUNION
   [Date et lieu]
```

---

### 3.3. Traitement des alertes et escalades

#### Niveaux d'escalade

| Niveau | Déclencheur                                                               | Interlocuteur BEORN      | Interlocuteur CNC   | Délai        |
| ------ | ------------------------------------------------------------------------- | ------------------------ | ------------------- | ------------ |
| **1**  | Anomalie bloquante, question technique urgente                            | Benjamin Bini (CP)       | Chef de projet SOSI | Immédiat     |
| **2**  | SLA non respecté, blocage > 48h, désaccord sur la priorisation            | CP + Architecte          | Responsable SOSI    | J+2          |
| **3**  | Incident grave répétitif, non-conformité majeure, insatisfaction exprimée | Direction (B. Tagnaouti) | Direction CNC (DAM) | J+5 après N2 |

#### Processus

1. **Détection** — L'alerte est identifiée par BEORN ou signalée par le CNC.
2. **Qualification** — Le chef de projet évalue la gravité et détermine le niveau d'escalade.
3. **Notification** — Les interlocuteurs concernés sont informés (téléphone + email de confirmation).
4. **Plan d'action** — Proposition d'un plan de résolution dans les 24h.
5. **Suivi** — Points quotidiens jusqu'à résolution.
6. **Clôture** — Bilan présenté au COPROJ suivant, intégration au registre des non-conformités.

#### Alertes proactives

BEORN s'engage à alerter le CNC sans attendre de sollicitation dans les situations suivantes :

- Risque de dépassement d'un SLA identifié en cours de traitement
- Vulnérabilité de sécurité affectant une application du périmètre
- Dysfonctionnement détecté en production avant signalement du CNC
- Obsolescence technologique (fin de support, CVE critique)
- Indisponibilité prévisible d'un membre clé de l'équipe

---

## Partie 4 — Amélioration continue

### 4.1. Retours d'expérience (REX) post-incident

#### Déclenchement

Un REX est conduit systématiquement dans les cas suivants :

- Anomalie bloquante en production
- Dépassement significatif d'un SLA (> 50 % du délai engagé)
- Régression en production introduite par une livraison BEORN
- Incident de sécurité
- Tout événement jugé pertinent par le CNC ou BEORN

#### Méthodologie

Le REX est conduit dans les 5 jours ouvrés suivant la résolution :

1. **Chronologie** — Reconstitution factuelle des événements
2. **Causes racines** — Analyse (méthode des 5 pourquoi)
3. **Impact** — Utilisateurs affectés, durée, données concernées
4. **Actions correctives** — Mesures immédiates prises
5. **Actions préventives** — Mesures pour éviter la récurrence
6. **Suivi** — Responsable et échéance pour chaque action

Le REX est formalisé et transmis au CNC. Il est présenté au COPROJ suivant et intégré au bilan trimestriel.

---

### 4.2. Plan d'amélioration annuel

Le plan d'amélioration est élaboré par BEORN et présenté au CNC lors du COPIL de fin d'année. Il comprend :

**1. Bilan de l'année écoulée**

- Synthèse des indicateurs SLA (atteints, non atteints, tendances)
- Analyse des non-conformités et de leur résolution
- Synthèse des REX conduits
- Retour qualitatif du CNC

**2. Actions d'amélioration**

| Domaine       | Exemples                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| Processus     | Optimisation du cycle de qualification, évolution de la DoD               |
| Technique     | Réduction de la dette technique, couverture de tests                      |
| Outillage     | Enrichissement du tableau de bord, automatisation des déploiements        |
| Formation     | Montée en compétence sur des sujets identifiés (accessibilité, sécurité…) |
| Documentation | Mise à jour des DAT/DEX, enrichissement de la base Confluence             |

**3. Objectifs de l'année suivante**

- Objectifs mesurables, alignés avec les priorités du CNC
- Planning prévisionnel
- Responsables et échéances

Les actions sont suivies à chaque COPIL trimestriel.

---

### 4.3. Gestion des risques projet

#### Registre des risques

BEORN maintient un registre des risques, initialisé pendant la phase d'initialisation et mis à jour en continu :

| Champ       | Description                   |
| ----------- | ----------------------------- |
| Identifiant | Numéro unique (R-XXX)         |
| Description | Nature du risque              |
| Probabilité | Faible / Moyenne / Élevée     |
| Impact      | Faible / Moyen / Élevé        |
| Criticité   | Probabilité × Impact          |
| Mitigation  | Actions de réduction          |
| Responsable | Propriétaire du risque        |
| Statut      | Ouvert / En mitigation / Clos |

#### Risques identifiés au démarrage

| ##    | Risque                                                                           | Prob.   | Impact | Mitigation                                            |
| ----- | -------------------------------------------------------------------------------- | ------- | ------ | ----------------------------------------------------- |
| R-001 | Obsolescence Liferay 6.2 (Intranet) — vulnérabilités non corrigées par l'éditeur | Élevée  | Élevé  | Veille CVE, durcissement, plan de migration multisite |
| R-002 | Complexité de reprise des composants cnc.fr V2 — dette technique héritée         | Moyenne | Moyen  | Audit technique en phase 4, plan de résorption        |
| R-003 | Indisponibilité d'un membre clé                                                  | Faible  | Moyen  | Documentation, polyvalence, remplacement ≤ 15j        |
| R-004 | Volume d'anomalies V2 supérieur aux estimations (rodage post-lancement)          | Moyenne | Moyen  | Charge renforcée en année 1, dégressivité prévue      |
| R-005 | Évolution du périmètre non anticipée                                             | Faible  | Moyen  | Souplesse de l'accord-cadre, adaptabilité de l'équipe |

#### Revue des risques

Le registre est revu à chaque COPIL trimestriel :

- Mise à jour des probabilités et impacts
- Ajout de nouveaux risques
- Clôture des risques résolus
- Évaluation des mesures de mitigation

---

### Annexes

#### Annexe A — Glossaire

| Sigle  | Signification                                                 |
| ------ | ------------------------------------------------------------- |
| CCTP   | Cahier des Clauses Techniques Particulières                   |
| CCAP   | Cahier des Clauses Administratives Particulières              |
| COPROJ | Comité de projet opérationnel                                 |
| COPIL  | Comité de pilotage                                            |
| DAT    | Document d'Architecture Technique                             |
| DEX    | Dossier d'Exploitation                                        |
| DoD    | Definition of Done                                            |
| MCO    | Maintien en Conditions Opérationnelles                        |
| MOM    | Mise en Ordre de Marche                                       |
| PAQ    | Plan d'Assurance Qualité                                      |
| PAS    | Plan d'Assurance Sécurité                                     |
| RAD    | Rapport d'Activité Détaillé                                   |
| REX    | Retour d'Expérience                                           |
| SLA    | Service Level Agreement                                       |
| SOSI   | Service de l'Organisation et des Systèmes d'Information (CNC) |
| TMA    | Tierce Maintenance Applicative                                |

#### Annexe B — Historique des révisions

| Version | Date          | Auteur        | Modifications    |
| ------- | ------------- | ------------- | ---------------- |
| 1.0     | [À compléter] | Benjamin Bini | Version initiale |

---

_Document confidentiel — BEORN Technologies / CNC_
_Ce PAQ est soumis à validation du CNC et sera actualisé conformément au cycle de révision défini en section 1.1._
