# Modèle Plan d'Assurance Sécurité (PAS)

**Marché : TMA Liferay - Lot 3 **
**Référence : BT-PAS-2026-001**
**Version : 1.0**
**Date : Avril 2026**
**Classification : CONFIDENTIEL — Diffusion restreinte au pouvoir adjudicateur**

---

## Table des matières

1. [Objet, domaine d'application et gouvernance documentaire](#1)
2. [Organisation de la sécurité et gouvernance](#2)
3. [Classification et contrôle des actifs](#3)
4. [Sécurité des ressources humaines](#4)
5. [Sécurité physique et environnementale](#5)
6. [Sécurité réseau et des accès distants](#6)
7. [Sécurité des systèmes et des postes de travail](#7)
8. [Contrôle des accès logiques](#8)
9. [Reprise et continuité des activités](#9)
10. [Conformité et audits](#10)
11. [Développement applicatif sécurisé](#11)
12. [Gestion des incidents de sécurité](#12)
13. [Annexes : RACI, registre des accès, plan de remédiation](#13)

---

<a name="1"></a>

## 1. Objet, domaine d'application et gouvernance documentaire

### 1.1 Objet

Le présent Plan d'Assurance Sécurité (PAS) formalise l'ensemble des mesures techniques, organisationnelles et humaines mises en œuvre par Beorn Technologies dans le cadre du marché de TMA Liferay. Il constitue le document contractuel de référence en matière de sécurité des systèmes d'information et remplace toute version antérieure dès sa validation par le pouvoir adjudicateur.

### 1.2 Domaine d'application

Le présent PAS s'applique à l'ensemble du périmètre de la prestation, incluant :

- Les **systèmes d'information Beorn** utilisés pour la réalisation de la prestation (postes de travail, infrastructure AWS, outils Atlassian, Google Workspace)
- Les **environnements dédiés au marché** (développement, intégration, recette, production)
- L'ensemble des **intervenants Beorn** affectés au marché (développeurs, chef de projet, responsable technique, RSSI)
- Les **éventuels sous-traitants** mobilisés avec accord préalable du pouvoir adjudicateur

### 1.3 Hiérarchie documentaire

| Document                                               | Référence             | Statut                             |
| ------------------------------------------------------ | --------------------- | ---------------------------------- |
| Plan d'Assurance Sécurité (présent document)           | BT-PAS-2026-001       | À valider                          |
| Procédure d'escalade — Gestion des alertes de sécurité | PRO-SSI-001           | En vigueur (Mars 2026)             |
| Politique de Sécurité des SI (PSSI Beorn)              | BT-PSSI-2025          | En vigueur                         |
| Plan de Continuité d'Activité (PCA)                    | BT-PCA-2025           | En vigueur                         |
| Plan de Reprise Informatique (PRI)                     | BT-PRI-2026           | En cours de finalisation (T3 2026) |
| Plan d'audit SSI                                       | BT-AUDIT-SSI-2026-001 | En vigueur                         |

### 1.4 Articulation avec la PSSI du pouvoir adjudicateur

Les exigences de sécurité spécifiques du pouvoir adjudicateur, telles que transmises dans le CCTP et ses annexes SSI, sont intégralement reprises dans le présent PAS. En cas de conflit entre une disposition interne Beorn et une exigence du pouvoir adjudicateur, l'exigence du pouvoir adjudicateur prévaut. Tout écart identifié est documenté dans le tableau de remédiation (§13.3).

### 1.5 Cycle de vie et révisions

Le PAS est un document vivant. Il est révisé :

- **Annuellement** à date anniversaire de notification du marché
- **Après tout incident de sécurité** de niveau P1 ou P2
- **Lors de toute évolution majeure** du périmètre technique ou organisationnel
- **Sur demande du pouvoir adjudicateur**

Chaque révision fait l'objet d'un numéro de version incrémental et est soumise à validation du pouvoir adjudicateur avant application.

| Version | Date       | Auteur                | Objet de la révision |
| ------- | ---------- | --------------------- | -------------------- |
| 1.0     | Avril 2026 | Olivier Bonnet-Torrès | Création initiale    |

---

<a name="2"></a>

## 2. Organisation de la sécurité et gouvernance

### 2.1 Rôles et responsabilités

#### Organigramme SSI du marché

| Rôle                                                               | Titulaire               | Missions sur le marché                                                                   |
| ------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------- |
| **RSSI / Responsable SSI marché**                                  | Olivier Bonnet-Torrès   | Pilotage du PAS, gestion de crise, reporting, animation des comités sécurité, veille CVE |
| **Correspondant sécurité** (point de contact pouvoir adjudicateur) | Olivier Bonnet-Torrès   | Alertes incidents, suivi des exigences SSI, transmission des indicateurs                 |
| **Direction**                                                      | Boubker Tagnaouti       | Décision stratégique, arbitrages, communication externe en cas de crise P1               |
| **DPO**                                                            | À désigner au démarrage | Conformité RGPD, gestion des violations de données, registre des traitements             |
| **Équipe sécurité opérationnelle**                                 | Équipe Beorn            | Contrôles techniques quotidiens, collecte de preuves, monitoring                         |
| **Chef de projet / TL**                                            | À désigner au démarrage | Relai sécurité au sein de l'équipe de développement, quality gate                        |

Le RACI complet est disponible en §13.1.

### 2.2 Séparation des tâches

Les rôles incompatibles sont identifiés et attribués à des personnes distinctes :

- Le développeur qui produit le code n'est pas le seul à le relire (revue de code obligatoire par un pair)
- L'administrateur système n'est pas le responsable des audits de conformité
- Aucune personne ne dispose à la fois des droits d'écriture en production et des droits d'audit des logs de production

### 2.3 Relations avec les autorités

En cas d'incident impliquant une enquête judiciaire ou une obligation légale de notification, Beorn s'engage à :

- Notifier la **CNIL** dans les 72 heures en cas de violation de données à caractère personnel (art. 33 RGPD)
- Notifier l'**ANSSI** si l'entité est concernée par la directive NIS2
- Collaborer avec les forces de l'ordre sur réquisition judiciaire, sans délai injustifié
- Informer le pouvoir adjudicateur de toute notification aux autorités dans un délai de **2 heures**

### 2.4 Veille sécurité et threat intelligence

Le RSSI assure une veille structurée couvrant :

- **CVE / CERT-FR** — alertes quotidiennes sur les vulnérabilités affectant l'écosystème du marché (Liferay DXP, JVM, AWS, dépendances Maven/npm)
- **Threat intelligence** — suivi des campagnes actives ciblant les applications web Java et les portails d'entreprise
- **Jurisprudence et réglementation** — veille sur l'évolution du cadre légal SSI (ANSSI, CNIL, NIS2, RGS)

Un **bulletin de veille mensuel** est diffusé à l'ensemble de l'équipe du marché et présenté en comité de sécurité.

### 2.5 Sécurité dans la gestion de projet

L'ensemble des mesures du présent PAS s'applique à tout projet ou évolution impactant le SI du pouvoir adjudicateur dans le cadre du marché. Toute User Story impliquant un accès à des données sensibles ou une modification des droits d'accès fait l'objet d'une analyse de sécurité préalable (critère d'acceptance de la définition de « done »).

### 2.6 Comitologie SSI

| Instance                      | Fréquence   | Participants                                             | Livrables                                                     |
| ----------------------------- | ----------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Comité sécurité interne Beorn | Mensuel     | RSSI, équipe sécurité                                    | Tableau de bord SSI, revue des incidents, actions correctives |
| Comité sécurité prestation    | Trimestriel | RSSI Beorn + correspondant sécurité pouvoir adjudicateur | Rapport SSI, indicateurs, revue du PAS, points partiels       |
| Revue de direction sécurité   | Annuel      | Direction Beorn + RSSI                                   | Bilan annuel, plan d'amélioration, arbitrages                 |

---

<a name="3"></a>

## 3. Classification et contrôle des actifs

### 3.1 Inventaire des actifs

Un inventaire exhaustif des actifs est maintenu et tenu à jour tout au long du marché. Il couvre :

**Actifs physiques**

| Actif                                      | Propriétaire | Version / Modèle       | Classification | Multi-clients          |
| ------------------------------------------ | ------------ | ---------------------- | -------------- | ---------------------- |
| MacBook Pro (intervenants du marché)       | Beorn        | M3 Pro / macOS Sequoia | Confidentiel   | NON — dédié prestation |
| Infrastructure AWS (environnements marché) | Beorn        | Voir DAT               | Confidentiel   | NON — compte dédié     |

**Actifs logiciels**

| Actif                            | Propriétaire         | Version                 | Classification |
| -------------------------------- | -------------------- | ----------------------- | -------------- |
| Liferay DXP                      | Pouvoir adjudicateur | À préciser au démarrage | Confidentiel   |
| Dépôts de code (Bitbucket)       | Beorn                | Cloud                   | Confidentiel   |
| Pipeline CI/CD                   | Beorn                | À préciser              | Confidentiel   |
| Outils projet (Jira, Confluence) | Beorn                | Cloud                   | Interne        |

L'inventaire est mis à jour à chaque ajout ou retrait d'actif. La fréquence de révision formelle est trimestrielle, avec présentation en comité de sécurité.

### 3.2 Propriété des actifs

Chaque actif est rattaché à un propriétaire responsable de :

- Le suivi du cycle de vie de l'actif
- Le contrôle de la conformité de son utilisation avec sa classification
- L'alerte de l'équipe sécurité en cas d'incident ou d'anomalie

La matrice de propriété est intégrée au RACI (§13.1).

### 3.3 Classification des informations

Les informations produites ou traitées dans le cadre du marché sont classifiées conformément à la politique de classification du pouvoir adjudicateur. En l'absence de politique formelle transmise, Beorn applique le schéma suivant par défaut :

| Niveau                | Définition                                | Exemples                                                                |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| **Public**            | Information diffusable sans restriction   | Documentation technique publiée                                         |
| **Interne**           | Usage interne, non divulgable à des tiers | Notes de réunion interne                                                |
| **Confidentiel**      | Accès limité aux personnes habilitées     | Code source, données de recette, configurations                         |
| **Très confidentiel** | Accès strictement nominatif               | Données à caractère personnel de production, secrets d'authentification |

Tout document produit pour le marché est classifié au moment de sa création. Le rôle Approbateur pour la classification est assuré par le chef de projet en lien avec le RSSI.

### 3.4 Gestion des supports amovibles

Aucun support amovible (USB, disque dur externe, carte SD) n'est autorisé sur le périmètre de la prestation. Cette interdiction est renforcée techniquement via la politique MDM Jamf. Tout besoin exceptionnel de transfert physique de données doit être validé par le RSSI et le pouvoir adjudicateur, et fait l'objet d'un processus sécurisé documenté.

### 3.5 Mise au rebut sécurisée des supports

La procédure de mise au rebut est la suivante :

- **Postes de travail** : effacement sécurisé de la zone de stockage des données du pouvoir adjudicateur (formatage bas niveau) avant toute réaffectation. Aucun poste n'est réaffecté sans cette étape.
- **Supports de stockage cloud** : suppression sécurisée des buckets S3 et volumes EBS dédiés au marché, avec confirmation de suppression exportée.
- **PV de destruction** : pour tout actif physique, un PV de destruction est établi par une société habilitée et transmis au pouvoir adjudicateur. La formalisation systématique de ce processus est l'objet de l'action corrective Q35 (échéance : S1 2026).
- **Documents papier** : déchiquetage obligatoire via destructeur de documents. Interdiction de mise en corbeille non sécurisée.

### 3.6 Suppression des données en fin de prestation

Beorn s'engage à fournir, dans les 30 jours suivant la fin du marché, une preuve de suppression de l'ensemble des données du pouvoir adjudicateur acquises durant la prestation. Cette preuve prend la forme d'un PV signé par le RSSI, accompagné des captures de confirmation de suppression des environnements AWS et des dépôts de code dédiés.

---

<a name="4"></a>

## 4. Sécurité des ressources humaines

### 4.1 Sélection des candidats

Beorn vérifie systématiquement, pour tout collaborateur amené à accéder aux données ou SI du pouvoir adjudicateur :

- L'identité du candidat (pièce d'identité officielle)
- Les diplômes et certifications déclarés
- L'exactitude du curriculum vitae
- Les références professionnelles pour les profils seniors

### 4.2 Engagements contractuels à l'entrée

Chaque intervenant signe, avant sa prise de fonction effective sur le marché, les documents suivants :

- **Contrat de travail** incluant : respect du secret professionnel, sécurité des actifs, clause de propriété intellectuelle, obligation de non-divulgation survivant à la fin du contrat
- **Charte informatique et éthique** : loyauté, discrétion, impartialité, non-divulgation y compris des informations anonymisées, signalement de tout contenu manifestement illicite, respect de la législation en vigueur. La charte est disponible sur demande du pouvoir adjudicateur.
- **Engagement de confidentialité spécifique au marché** couvrant les données et systèmes du pouvoir adjudicateur pour toute la durée du marché et au-delà
- **Accusé de réception du livret d'accueil sécurité** (cf. §4.4)

Pour les comptes disposant de **privilèges d'administration élevés** sur les composants de l'infrastructure du marché, le contrat de travail inclut un engagement de responsabilité renforcé avec renvoi aux clauses du code du travail sur la protection du secret des affaires et de la propriété intellectuelle.

### 4.3 Formations obligatoires avant prise de fonction

Tout intervenant doit avoir validé les formations suivantes **avant sa prise de fonction effective** :

| Formation                                                        | Organisme     | Durée | Seuil de validation       | Justificatif                                     |
| ---------------------------------------------------------------- | ------------- | ----- | ------------------------- | ------------------------------------------------ |
| SecNumAcadémie — module « L'essentiel de la sécurité numérique » | ANSSI         | ~4h   | Attestation de suivi      | Remise au démarrage du marché                    |
| Atlas Assessment (microlearning cybersécurité)                   | Beorn / Atlas | 2–3h  | ≥ 95 % de bonnes réponses | Score enregistré dans le registre des formations |
| Sensibilisation RGPD interne                                     | Beorn         | 2h    | ≥ 95 % de bonnes réponses | Score enregistré                                 |
| Sécurité applicative Liferay / Java / OWASP Top 10               | Beorn         | 2h    | ≥ 95 % de bonnes réponses | Score enregistré                                 |

Le tableau des intervenants avec les dates de réalisation et les taux de réussite est présenté lors du premier comité de sécurité et mis à jour à chaque arrivée ou renouvellement.

### 4.4 Livret d'accueil sécurité

Un livret d'accueil sécurité est remis à chaque nouvel intervenant. Il couvre :

- Les engagements et règles de sécurité applicables au marché
- La procédure de signalement d'incident (canal, délai d'1 heure)
- Les bonnes pratiques quotidiennes (bureau propre, verrouillage d'écran, mots de passe)
- Les contacts d'urgence SSI

La version initiale et les évolutions sont partagées avec le pouvoir adjudicateur pour proposition d'amélioration.

### 4.5 Sensibilisation continue

- **Campagne de phishing simulé** — au moins une campagne annuelle sur l'ensemble de l'équipe (outil KnowBe4 ou équivalent). Les intervenants identifiés comme vulnérables suivent un module complémentaire dans les 15 jours.
- **Bulletin de veille mensuel** — CVE critiques relatives à l'écosystème du marché, nouvelles techniques d'attaque, rappels de bonnes pratiques.
- **REX post-incident** — tout incident, même mineur, donne lieu à un retour d'expérience formalisé partagé avec l'équipe dans les 5 jours ouvrés suivant la clôture.

### 4.6 Processus disciplinaire

Tout manquement aux exigences de sécurité du pouvoir adjudicateur ou de Beorn entraîne le **retrait immédiat de l'intervenant de la prestation**. Le processus disciplinaire interne est décrit dans le règlement intérieur de Beorn, disponible sur demande. Les sanctions sont proportionnées à la gravité du manquement et peuvent aller jusqu'au licenciement pour faute grave.

### 4.7 Offboarding sécurisé

Tout départ d'un intervenant (fin de mission, congé, départ de l'entreprise) déclenche une procédure d'offboarding sécurisé **dans les 24 heures** :

1. Désactivation de tous les comptes (Bitbucket, Jira, AWS IAM, Google Workspace, Cloudflare)
2. Révocation des clés SSH, tokens API et certificats personnels
3. Récupération du poste de travail
4. Formatage bas niveau de la zone de stockage contenant les données du pouvoir adjudicateur
5. Notification au pouvoir adjudicateur pour révocation des accès côté SI client
6. Documentation de l'offboarding dans le registre des accès (§13.2)

En cas de départ temporaire (congé maladie, congé parental), le compte est désactivé sans être supprimé. La suppression intervient 3 mois après la désactivation si le retour n'est pas confirmé.

Un transfert de connaissances est organisé, à la charge de Beorn, vers le collaborateur entrant, afin de garantir la continuité de la prestation.

### 4.8 Unicité des compétences — gestion du risque clé

Pour les profils critiques (lead technique, administrateur système), Beorn s'engage à maintenir à tout moment un back-up identifié et formé, capable d'assurer la continuité de la prestation en cas d'absence ou de départ imprévu.

---

<a name="5"></a>

## 5. Sécurité physique et environnementale

### 5.1 Périmètre de sécurité physique

Beorn opère avec des équipes **entièrement nomades** sur MacBook Pro gérés via Jamf. L'entreprise ne dispose pas de datacenter ou de salle serveur propre : l'hébergement des environnements du marché est assuré par AWS, dont les datacenters bénéficient des certifications ISO 27001, SOC 2, et des mesures de sécurité physique décrites dans la documentation AWS disponible publiquement.

Pour les **locaux de travail** des intervenants :

- Accès aux bâtiments contrôlé (badge, digicode ou biométrie selon le site)
- Politique de bureau propre : aucun document contenant des données du pouvoir adjudicateur ne reste visible sans surveillance
- Politique d'écran verrouillé : verrouillage automatique à 5 minutes, interdiction de laisser un poste déverrouillé sans surveillance
- Interdiction de l'utilisation d'équipements photographiques, vidéos ou audio dans les zones de travail sensibles

### 5.2 Sécurité des postes nomades hors des locaux

- Tout accès aux systèmes du marché depuis l'extérieur passe obligatoirement par **Cloudflare Zero Trust** (ZTNA), qui vérifie la posture de sécurité du terminal avant d'accorder l'accès
- L'accès depuis un pays étranger est soumis à autorisation préalable du RSSI et, le cas échéant, du pouvoir adjudicateur
- Les postes utilisés hors des locaux bénéficient des mêmes protections que les postes en bureau : FileVault actif, Jamf Protect en veille, MDM connecté
- Câble antivol recommandé pour les interventions dans des espaces publics (coffee shops, coworking, etc.)

### 5.3 Hébergement des infrastructures du marché (AWS)

Les environnements AWS dédiés au marché bénéficient de la sécurité physique des datacenters AWS :

- Accès physique strictement contrôlé, surveillance 24h/24 7j/7
- Systèmes anti-intrusion, vidéosurveillance, zones cloisonnées
- Alimentation électrique redondante, climatisation redondante, protection incendie
- Certifications ISO 27001, SOC 1/2/3, CSA STAR
- Documentation de conformité disponible sur [aws.amazon.com/compliance](https://aws.amazon.com/compliance)

### 5.4 Matériel utilisateur sans surveillance

- Verrouillage automatique de session imposé par MDM (5 minutes d'inactivité)
- Politique de mise sous clé du matériel sensible lors des déplacements
- Signalement obligatoire au RSSI en cas de perte ou vol dans un délai de **30 minutes**
- En cas de perte ou vol : révocation immédiate des certificats, désactivation du compte, effacement à distance via Jamf Remote Lock/Erase

---

<a name="6"></a>

## 6. Sécurité réseau et des accès distants

### 6.1 Architecture de sécurité réseau

L'architecture de sécurité réseau s'articule autour de trois couches complémentaires :

```
[Intervenant nomade]
        │
        ▼
[Cloudflare Zero Trust ZTNA]
  - Vérification identité (MFA)
  - Évaluation posture terminal
  - Filtrage DNS et web
  - Logs centralisés 12 mois
        │
        ▼
[Environnement AWS (compte dédié marché)]
  - AWS WAF (protection applicative OWASP)
  - AWS Shield Standard (anti-DDoS)
  - AWS GuardDuty (détection des menaces)
  - AWS Security Hub (agrégation findings)
  - VPC avec segmentation (dev / recette / prod)
  - Security Groups restrictifs (deny all par défaut)
        │
        ▼
[Application Liferay DXP]
  - TLS 1.3 / HTTPS obligatoire
  - Authentification applicative
```

### 6.2 Cloisonnement des réseaux et des environnements

Les environnements de **développement, d'intégration, de recette et de production** sont strictement séparés, dans des VPC distincts, sans possibilité de communication directe non contrôlée entre eux. Les flux inter-environnements sont :

- Soumis à des Security Groups explicitement configurés (principe deny-all)
- Journalisés dans VPC Flow Logs (analysés par GuardDuty)
- Revus trimestriellement par le RSSI

Le réseau du pouvoir adjudicateur est systématiquement cloisonné de celui de Beorn et de ses autres clients. Les données de la prestation sont isolées des données des autres clients sur l'ensemble de l'infrastructure mutualisée.

### 6.3 Durcissement des configurations réseau

Tout équipement ou service déployé dans le cadre du marché est soumis à un hardening initial :

- Changement systématique des configurations par défaut (mots de passe, ports, services)
- Désactivation de tous les services et interfaces non nécessaires à la prestation
- Protocoles obsolètes interdits : TLS < 1.2, SSH v1, FTP, Telnet, HTTP non chiffré
- Synchronisation NTP sur une source de référence unique pour tous les serveurs

### 6.4 Sécurité des services réseau (firewalling, proxy)

- **AWS WAF** configuré avec les règles managées AWS (OWASP Top 10) sur les environnements exposés
- **Security Groups AWS** en mode deny-all par défaut, ouvertures explicites et documentées uniquement
- **Cloudflare Zero Trust Gateway** agissant comme proxy sécurisé pour tous les flux sortants des postes des intervenants
- Convention de service réseau avec le pouvoir adjudicateur à définir conjointement (SLA, modalités d'intervention)

### 6.5 Sécurité des appareils mobiles

- Aucun accès aux données du marché depuis un équipement non géré par Jamf
- Les équipements du pouvoir adjudicateur éventuellement mis à disposition font l'objet d'un enrôlement dans un profil MDM dédié, après accord du RSSI du pouvoir adjudicateur

### 6.6 Protection de la messagerie

- Google Workspace avec filtrage anti-phishing avancé, analyse des pièces jointes, DMARC/DKIM/SPF activés
- Chiffrement des pièces jointes contenant des données sensibles ; transmission du mot de passe par canal séparé (SMS)
- Solution anti-spam active, mise à jour automatiquement

---

<a name="7"></a>

## 7. Sécurité des systèmes et des postes de travail

### 7.1 Protection anti-malware et EDR

| Outil                             | Périmètre                    | Fonctions                                                                                                  | Mise à jour                        |
| --------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Jamf Protect** (EDR)            | 100 % du parc MacBook Pro    | Détection comportementale, monitoring des processus, escalade de privilèges, remontée d'alertes temps réel | Automatique (signatures et moteur) |
| **Cloudflare Zero Trust Gateway** | Flux réseau tous postes      | Anti-malware réseau, filtrage DNS malveillant, détection de C2                                             | Continue (cloud)                   |
| **AWS GuardDuty**                 | Infrastructure AWS du marché | Détection d'intrusion, activité anormale, compromission d'instances                                        | Continue (ML AWS)                  |

Un **tableau de bord de suivi de la sécurité des postes** (couverture EDR, conformité FileVault, version OS) est tenu à jour par le RSSI et présenté à chaque comité de sécurité.

### 7.2 Chiffrement des postes de travail

- **FileVault 2** activé sur 100 % des MacBook Pro du parc affectés au marché
- Gestion centralisée via Jamf Pro : clé de récupération séquestrée dans la console MDM, non accessible à l'utilisateur
- Vérification de conformité automatisée via Jamf : tout poste non chiffré est signalé en alerte immédiate
- Rapport de conformité FileVault mensuel disponible sur demande

### 7.3 Politique de gestion des mises à jour (patching)

| Criticité    | Score CVSS | Délai de déploiement                       |
| ------------ | ---------- | ------------------------------------------ |
| **Critique** | ≥ 9.0      | ≤ 72 heures après publication CERT-FR      |
| **Élevée**   | 7.0 – 8.9  | ≤ 10 jours ouvrés                          |
| **Modérée**  | 4.0 – 6.9  | Prochaine campagne mensuelle               |
| **Faible**   | < 4.0      | Intégration dans le backlog de maintenance |

Les mises à jour **macOS** sont déployées de manière centralisée via Jamf Pro. Les mises à jour des **services AWS** (AMI, RDS, Lambda) sont gérées via les processus natifs AWS avec versionning et rollback prévu. Tout patch est d'abord testé sur un environnement de recette avant déploiement en production.

L'état des systèmes (versions logicielles, firmware, middleware, librairies, dates de fin de support) est présenté à chaque comité de sécurité, avec les plans de migration pour les composants en fin de vie ou dont l'obsolescence est proche.

### 7.4 Maîtrise des logiciels en exploitation

- Les utilisateurs **n'ont pas les droits d'administrateur local** sur leurs postes
- Toute installation de logiciel requiert validation du RSSI
- Les logiciels autorisés sont déployés via Jamf Self Service (catalogue approuvé)
- Politique de restriction des applications : seuls les logiciels nécessaires à la prestation sont installés

### 7.5 Journalisation et surveillance

| Source de logs                   | Outil de centralisation     | Rétention | Analyse                               |
| -------------------------------- | --------------------------- | --------- | ------------------------------------- |
| Actions AWS (API calls, console) | AWS CloudTrail → S3 chiffré | 12 mois   | GuardDuty + Security Hub (temps réel) |
| Flux réseau VPC                  | VPC Flow Logs               | 12 mois   | GuardDuty (temps réel)                |
| Findings sécurité                | AWS Security Hub            | 12 mois   | Dashboard RSSI                        |
| Événements postes (EDR)          | Jamf Protect                | 12 mois   | Console Jamf (temps réel)             |
| Flux réseau postes               | Cloudflare ZT Gateway       | 12 mois   | Dashboard Cloudflare                  |

Les journaux sont **protégés contre la falsification** : bucket S3 en lecture seule pour les logs CloudTrail, MFA Delete activé, versioning actif. Toute tentative de suppression des logs génère une alerte immédiate dans Security Hub.

La synchronisation NTP est configurée sur l'ensemble des serveurs pour garantir la cohérence des horodatages lors des investigations.

### 7.6 DLP (prévention des fuites de données)

- **Cloudflare Zero Trust Gateway** — inspection du trafic sortant, blocage des transferts vers des destinations non autorisées, alertes sur comportements anormaux
- **Google Workspace DLP** — règles de prévention des fuites dans Gmail et Drive (détection de données sensibles, blocage du partage externe non autorisé)
- **Politique Jamf** — blocage des supports amovibles, restriction des applications de partage de fichiers non autorisées

---

<a name="8"></a>

## 8. Contrôle des accès logiques

### 8.1 Politique de contrôle des accès

L'accès aux ressources du marché repose sur les principes du **besoin de connaître** (need to know) et du **besoin d'utiliser** (need to use). Chaque intervenant dispose uniquement des droits strictement nécessaires à l'exercice de sa mission, pour la seule durée de celle-ci.

#### Types d'accès définis pour le marché

| Profil         | Systèmes accessibles                                                              | Niveau de droits                                                   |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Développeur    | Bitbucket (branches de développement), Jira, environnements dev/recette           | Lecture/écriture sur branches feature, lecture seule en recette    |
| Lead technique | Tout ce qui précède + droits de merge sur branches principales, accès AWS recette | Lecture/écriture avec validation                                   |
| Chef de projet | Jira (tous projets), Confluence, lecture seule sur Bitbucket                      | Gestion projet, pas d'accès aux systèmes de production             |
| RSSI           | Tous les environnements (audit)                                                   | Lecture seule + droits d'audit                                     |
| Administrateur | AWS (production), pipelines CI/CD                                                 | Droits d'administration, compte dédié séparé du compte utilisateur |

### 8.2 Authentification forte (MFA)

**Sur les systèmes Beorn (intégralement sous contrôle Beorn) : MFA obligatoire sans exception**

- **Cloudflare Zero Trust** — MFA enforced à chaque accès, évaluation de la posture du terminal (certificat MDM valide, FileVault actif, Jamf Protect actif, version OS à jour)
- **Google Workspace** — MFA obligatoire sur tous les comptes. Clé de sécurité physique (YubiKey) recommandée pour les comptes à privilèges élevés
- **AWS IAM** — MFA obligatoire sur le compte root (clé physique) et tous les comptes à privilèges. Aucune utilisation du compte root en opérations courantes
- **Atlassian (Jira, Bitbucket)** — SSO Google enforced, MFA hérité de Google Workspace

**Sur les systèmes du pouvoir adjudicateur** : Beorn s'engage à appliquer le MFA dès que l'infrastructure cliente le permet, et à formaliser une recommandation technique MFA dans les 15 premiers jours du marché si l'infrastructure ne le supporte pas nativement.

### 8.3 Politique des mots de passe

| Paramètre                                      | Utilisateurs standards                                   | Comptes administrateurs            |
| ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| Longueur minimale                              | 12 caractères                                            | 15 caractères                      |
| Complexité                                     | Majuscules + minuscules + chiffres + caractères spéciaux | Idem                               |
| Renouvellement                                 | Tous les 90 jours                                        | Tous les 90 jours                  |
| Essais infructueux avant verrouillage          | 3                                                        | 3                                  |
| Changement obligatoire à la première connexion | OUI                                                      | OUI                                |
| Inactivité avant révocation automatique        | 100 jours                                                | 100 jours                          |
| Hachage                                        | SHA256 minimum (BCrypt recommandé)                       | SHA256 minimum (BCrypt recommandé) |

Les mots de passe sont stockés dans un **coffre-fort sécurisé** (Bitwarden Enterprise ou équivalent approuvé par le RSSI). Aucun mot de passe n'est stocké en clair dans un fichier, un email ou un outil de collaboration. En cas de réversibilité du marché, l'ensemble des mots de passe liés aux systèmes du pouvoir adjudicateur est transmis de manière sécurisée au pouvoir adjudicateur ou à son prestataire entrant.

### 8.4 Gestion du cycle de vie des comptes

**Enregistrement** : tout nouveau compte est créé sur demande formelle du chef de projet, validée par le RSSI, avec définition du profil de droits et de la date d'expiration.

**Registre des accès** : tenu à jour en continu, il liste pour chaque compte :

- Nom de l'intervenant
- Type d'accès / profil
- Date d'entrée sur la prestation
- Date de sortie (prévue et effective)
- Date de demande de désactivation
- Date de validation de la désactivation

Le registre est présenté à chaque comité de sécurité. Modèle disponible en §13.2.

**Révision des habilitations** :

- Comptes à privilèges : revue **mensuelle**
- Comptes utilisateurs : revue **trimestrielle**
- Accès physiques (si applicables) : revue **trimestrielle**

**Offboarding** : cf. §4.7 — désactivation dans les 24 heures, suppression après 3 mois de désactivation.

### 8.5 Gestion des accès distants (prise de contrôle à distance)

La prise de contrôle à distance d'un poste ne peut s'effectuer que :

- En cas de gestion d'incident ou de maintenance à distance explicitement demandée
- Après acquittement explicite de l'utilisateur sur son poste
- Via un outil approuvé par le RSSI (Apple Remote Desktop ou solution d'entreprise — aucun accès via TeamViewer ou outils non contrôlés)

### 8.6 Accès au code source

L'accès au code source est traité comme un accès à une information de niveau **Confidentiel**. La liste des personnes autorisées à accéder au code source, avec leurs droits associés, est établie conjointement avec le pouvoir adjudicateur et maintenue dans le registre des accès. Les branches principales (main/master) sont protégées : aucun push direct, pull request obligatoire avec review approuvée, CI verte obligatoire.

---

<a name="9"></a>

## 9. Reprise et continuité des activités

### 9.1 Plan de Continuité d'Activité (PCA)

Le PCA Beorn couvre les scénarios de perturbation majeure suivants :

| Scénario                             | Mesure de continuité                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| Indisponibilité d'un intervenant clé | Back-up formé identifié pour chaque profil critique (cf. §4.8)    |
| Incident AWS région primaire         | Déploiement possible sur région secondaire (procédure documentée) |
| Compromission d'un poste de travail  | Effacement distant via Jamf, remplacement sur stock de spare      |
| Attaque DDoS sur les environnements  | AWS Shield + WAF, basculement CDN Cloudflare                      |
| Perte d'accès à Google Workspace     | Procédures dégradées documentées, contacts d'urgence hors-bande   |

### 9.2 Plan de Reprise Informatique (PRI)

Les éléments suivants sont déjà formalisés :

| Élément                        | Valeur cible                                     | Statut                             |
| ------------------------------ | ------------------------------------------------ | ---------------------------------- |
| RTO (Recovery Time Objective)  | ≤ 4 heures pour les environnements de production | Défini                             |
| RPO (Recovery Point Objective) | ≤ 24 heures (sauvegardes quotidiennes)           | Défini                             |
| Priorité de reprise            | Production > Recette > Développement             | Défini                             |
| Procédures de restauration AWS | Documentées par environnement                    | En cours de finalisation (T3 2026) |

### 9.3 Politique de sauvegarde

| Élément sauvegardé                  | Fréquence                | Rétention | Localisation             |
| ----------------------------------- | ------------------------ | --------- | ------------------------ |
| Bases de données RDS (recette)      | Quotidienne              | 30 jours  | Région AWS secondaire    |
| Bases de données RDS (production)   | Quotidienne              | 90 jours  | Région AWS secondaire    |
| Buckets S3 applicatifs              | Réplication cross-region | Continue  | Région AWS secondaire    |
| Dépôts de code Bitbucket            | Réplication Atlassian    | Continue  | Infrastructure Atlassian |
| Configurations infrastructure (IaC) | À chaque commit          | Bitbucket | Versionné                |

Les sauvegardes sont chiffrées (AES-256) et stockées dans une région AWS différente de la région de production. Chaque exécution produit un journal analysé par les administrateurs pour confirmer le bon déroulement. Les sauvegardes sont **auditables par le pouvoir adjudicateur** sur demande.

Les données des postes de travail locaux ne sont pas sauvegardées localement : les collaborateurs travaillent sur des dépôts versionnés (Bitbucket) et des espaces cloud (Google Drive) couverts par les sauvegardes cloud natives.

### 9.4 Tests de restauration

Engagement ferme : à compter de la date de démarrage du marché, des tests de restauration semestriels sont planifiés et réalisés sur les environnements du marché. Un **PV de test** est établi après chaque exercice et transmis au pouvoir adjudicateur.

Le premier test de restauration est planifié dans les 3 mois suivant la mise en production.

### 9.5 Exercice de reprise d'activité

Un exercice de reprise d'activité complet est planifié au **T4 2026**. Le rapport d'exercice sera transmis au pouvoir adjudicateur.

---

<a name="10"></a>

## 10. Conformité et audits

### 10.1 Conformité légale et réglementaire

Beorn est en conformité avec l'ensemble des obligations légales et réglementaires applicables :

- RGPD (Règlement UE 2016/679) — enregistrement CNIL, DPA disponible
- Loi Informatique et Libertés (version consolidée)
- Loi n° 2023-703 relative à la programmation militaire (dispositions NIS2 applicables)
- Code du travail (clauses de confidentialité et protection du secret des affaires)

### 10.2 Mécanisme d'audit externe par le pouvoir adjudicateur

Beorn s'engage à faciliter et à ne pas entraver tout audit de sécurité commandité par le pouvoir adjudicateur sur le périmètre de la prestation. Les modalités sont les suivantes :

- Notification préalable de **10 jours ouvrés** pour un audit planifié
- Accès aux environnements de test et de recette pendant les heures ouvrées, sans impact sur la production
- Mise à disposition de toute documentation demandée dans un délai de **5 jours ouvrés**
- **Délais de remédiation** selon les constats d'audit :

| Criticité du constat | Délai de remédiation | À la charge de              |
| -------------------- | -------------------- | --------------------------- |
| Critique             | ≤ 72 heures          | Beorn, à ses frais          |
| Élevée               | ≤ 10 jours ouvrés    | Beorn, à ses frais          |
| Modérée              | ≤ 1 mois             | Beorn, à ses frais          |
| Faible               | ≤ 3 mois             | À définir contractuellement |

Les constats sont partagés et les plans d'action font l'objet d'un suivi en comité de sécurité.

### 10.3 Vérification de la conformité technique

Des revues de conformité technique sont réalisées sur les périmètres suivants :

- **Architecture technique** de la solution Liferay (DAT/HLD) — revue à chaque évolution majeure
- **Configuration des environnements AWS** — audit des Security Groups, IAM policies, règles WAF — trimestriel
- **Analyse des vulnérabilités du code** — SAST SonarQube à chaque sprint + scan complet semestriel
- **Scan de vulnérabilités des serveurs** — AWS Inspector — mensuel

### 10.4 Transfert des données et fournisseurs de services cloud

L'analyse des conditions de sécurité des services externalisés (AWS, Google, Atlassian) est maintenue à jour. Les certifications des prestataires cloud sont vérifiées annuellement. Tout changement de fournisseur cloud ou d'outil impactant la sécurité est soumis à validation préalable du pouvoir adjudicateur.

---

<a name="11"></a>

## 11. Développement applicatif sécurisé

### 11.1 Principes généraux (Security by Design)

Beorn applique le principe du **Security by Design** à l'ensemble des développements réalisés dans le cadre du marché. La sécurité est intégrée dès la phase de spécification, et non ajoutée a posteriori.

Tout développement ou évolution impliquant :

- Un accès à des données sensibles ou à caractère personnel
- Une modification des mécanismes d'authentification ou d'autorisation
- L'ajout d'une nouvelle intégration avec un système tiers
- Une exposition d'une nouvelle API publique

... fait l'objet d'une **analyse de sécurité préalable** par le lead technique et le RSSI, avant que la User Story soit acceptée en sprint.

### 11.2 Pipeline de sécurité DevSecOps

```
[Développeur]
  └─ pre-commit hook : scan secrets (git-secrets)
  └─ push vers branche feature (protégée contre push direct main)

[Pull Request]
  └─ Revue de code obligatoire (1 reviewer minimum, volet sécurité explicite)
  └─ Approbation lead technique requise

[Pipeline CI/CD]
  ├─ SAST : SonarQube
  │    └─ Quality gate : 0 BLOCKER, 0 CRITICAL → bloque le merge si KO
  ├─ Scan de dépendances : Dependabot / OWASP Dependency-Check
  │    └─ SBOM mis à jour et archivé
  ├─ Tests automatisés (unitaires, intégration)
  └─ AWS Inspector (scan images si conteneurs)

[Déploiement recette]
  └─ Validation fonctionnelle + sécurité par le lead technique

[Déploiement production]
  └─ Validation formelle du pouvoir adjudicateur requise
  └─ Pas de déploiement production sans CR signé
```

### 11.3 Analyse statique du code (SAST)

Outil : **SonarQube** (version Cloud ou On-Premise selon l'architecture du marché)

- Analyse déclenchée automatiquement à chaque pull request
- **Quality gate bloquante** : aucune merge request ne peut être fusionnée si des vulnérabilités de criticité BLOCKER ou CRITICAL sont présentes et non résolues
- Rapport SonarQube inclus dans la documentation de sprint et présenté en COPIL mensuel
- Règles de sécurité Java / Liferay activées et maintenues à jour

### 11.4 Revue de code sécurité

Tout code produit dans le cadre du marché fait l'objet d'une **revue par un pair** avant intégration. La revue inclut explicitement un volet sécurité couvrant :

- Injections (SQL, JNDI, OGNL, OS command)
- Gestion des erreurs et des exceptions (pas d'exposition de traces de pile en production)
- Contrôle d'accès et autorisations Liferay (vérification des permissions portlet)
- Exposition de données sensibles (pas de données personnelles dans les logs)
- Utilisation correcte des API cryptographiques

### 11.5 Gestion des dépendances et supply chain

- **SBOM (Software Bill of Materials)** maintenu et mis à jour à chaque sprint
- **Alertes Dependabot** (ou OWASP Dependency-Check) sur les dépendances vulnérables, traitées dans les délais définis au §7.3
- Toute nouvelle dépendance fait l'objet d'une évaluation : activité du dépôt, date du dernier release, historique des CVE, licence compatible
- Les dépendances abandonnées ou non maintenues (dernier commit > 24 mois sans justification) ne sont pas admises
- L'état des dépendances et leur niveau de vulnérabilité sont présentés en comité de sécurité

### 11.6 Secrets dans le code

- **Git-secrets** activé en pre-commit hook et dans la CI/CD : tout commit contenant un potentiel secret (clé API, mot de passe, token, chaîne de connexion) est **rejeté automatiquement**
- Aucun secret en clair dans le code, les fichiers de configuration, les variables d'environnement non chiffrées
- Tous les secrets sont gérés via **AWS Secrets Manager** avec rotation automatique
- Les fichiers `.env` et les configurations sensibles sont exclus du versioning (`.gitignore` maintenu)

### 11.7 Protection des données de test

- Toute donnée à caractère personnel issue de la production est **anonymisée ou pseudonymisée** avant utilisation en développement ou recette
- L'utilisation de données non anonymisées requiert une **validation formelle du RSSI du pouvoir adjudicateur**
- Les données anonymisées sont supprimées dès qu'elles ne sont plus nécessaires
- Les jeux de données de test sont sauvegardés conformément au plan de sauvegarde sécurisé
- Les outils d'anonymisation utilisés et les méthodes appliquées sont documentés dans le DAT

### 11.8 Analyse de la dette technique sécurité initiale

En cas de reprise d'un patrimoine applicatif Liferay existant, une **analyse de code sécurité initiale** est réalisée dans les 4 premières semaines du marché. Elle identifie :

- Les vulnérabilités présentes dans le code existant (SAST SonarQube)
- Les dépendances obsolètes ou vulnérables (SBOM)
- Les modules OSGi Liferay dépréciés
- Les patterns de développement non conformes aux bonnes pratiques de sécurité Liferay

Les résultats sont présentés au pouvoir adjudicateur. Beorn s'engage à :

- **Ne pas dégrader** le niveau de sécurité existant
- Proposer un **plan de traitement priorisé** des failles identifiées, intégré dans la roadmap de maintenance

### 11.9 Chiffrement et sécurité des flux applicatifs

- **En transit** : TLS 1.3 par défaut sur tous les flux (TLS 1.2 minimum), certificats valides, HSTS activé sur les applications exposées
- **Au repos** : AES-256 sur AWS (S3, RDS, EBS), chiffrement natif Google Workspace, FileVault sur les postes
- **Atlassian** : validation du niveau de chiffrement au repos en cours avec l'éditeur (échéance S1 2026)
- Chaque moyen cryptographique utilisé dans le cadre de la prestation est listé dans le DAT

---

<a name="12"></a>

## 12. Gestion des incidents de sécurité

_Cette section synthétise les éléments détaillés dans la procédure PRO-SSI-001 (v1.0, Mars 2026), jointe en annexe du présent PAS._

### 12.1 Responsabilités et procédures

Tout incident donne lieu à la création d'une **fiche d'incident sécurité** incluant : horodatage, nature de l'incident, systèmes impactés, données potentiellement compromises, actions prises, statut. L'ensemble des fiches est revue lors des comités de sécurité (nouvelles depuis le dernier comité et celles fermées).

### 12.2 Niveaux de criticité

| Niveau | Criticité | Définition                                          | Exemples                                                                  |
| ------ | --------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| **P1** | Critique  | Compromission avérée ou en cours                    | Exfiltration de données, ransomware, accès non autorisé compte privilégié |
| **P2** | Élevée    | Menace probable nécessitant investigation immédiate | Mouvement latéral, connexion pays à risque, malware non propagé           |
| **P3** | Modérée   | Activité suspecte à surveiller                      | Multiples échecs d'authentification, scan de ports, anomalie réseau       |
| **P4** | Faible    | Événement informatif ou faux positif probable       | Alerte connue récurrente, non-conformité mineure                          |

### 12.3 Délais de réponse et escalade

| Niveau | Délai de réponse   | Délai de notification pouvoir adjudicateur | Canal                      |
| ------ | ------------------ | ------------------------------------------ | -------------------------- |
| P1     | < 30 minutes       | < 2 heures                                 | Appel téléphonique + email |
| P2     | < 2 heures         | < 4 heures                                 | Email + Slack sécurité     |
| P3     | < 8 heures ouvrées | Rapport hebdomadaire si persistance        | Ticket + email             |
| P4     | < 5 jours ouvrés   | Rapport mensuel consolidé                  | Ticket                     |

En cas de doute sur le niveau, l'incident est qualifié au **niveau supérieur par défaut**.

### 12.4 Procédure de réponse P1/P2

**Phase 1 — Détection et qualification (J0)**

1. Détection par AWS Security Hub, Jamf Protect ou Cloudflare (ou signalement humain)
2. Notification RSSI dans l'heure
3. Qualification ≤ 30 min → ouverture ticket d'incident (accès restreint, traçabilité complète)

**Phase 2 — Confinement et investigation (J0–J1)**

1. Isolation du composant compromis (révocation d'accès, coupure instance AWS si nécessaire)
2. **Préservation des preuves** avant toute action corrective (logs CloudTrail, snapshots EBS, captures mémoire)
3. Analyse forensique : vecteur d'attaque, périmètre de compromission, données potentiellement exfiltrées
4. Notification pouvoir adjudicateur selon délais ci-dessus

**Phase 3 — Éradication et remédiation (J1–J3)**

1. Déploiement du correctif ou mesure compensatoire
2. Revue complète des accès sur le périmètre impacté
3. Vérification de l'intégrité des sauvegardes avant toute restauration
4. **Notification CNIL** dans les 72 heures si DCP compromises (art. 33 RGPD)
5. **Notification ANSSI** si applicable (NIS2)

**Phase 4 — Retour à la normale et clôture**

1. Validation du retour en production par le pouvoir adjudicateur
2. **Rapport post-incident complet dans les 5 jours ouvrés** : chronologie, cause racine, mesures correctives
3. REX partagé avec l'équipe, intégré au PAS
4. Mise à jour de la matrice de risques si nouveau vecteur identifié

### 12.5 Conservation des logs et preuves

| Source                                    | Durée de rétention | Responsable     |
| ----------------------------------------- | ------------------ | --------------- |
| AWS CloudTrail / GuardDuty / Security Hub | 12 mois            | Équipe Cloud    |
| Cloudflare Zero Trust Gateway             | 12 mois            | Équipe Sécurité |
| Jamf Protect (EDR)                        | 12 mois            | Équipe Sécurité |

Les logs sont protégés contre la falsification (S3 versioning + MFA Delete + Object Lock).

---

<a name="13"></a>

## 13. Annexes

### 13.1 RACI SSI

| Activité                          | RSSI    | Direction | Chef de projet | Lead technique | Équipe dev | Pouvoir adjudicateur |
| --------------------------------- | ------- | --------- | -------------- | -------------- | ---------- | -------------------- |
| Pilotage du PAS                   | **R/A** | C         | I              | I              | I          | C                    |
| Revue des habilitations           | **R/A** | I         | C              | C              | I          | I                    |
| Gestion de crise P1               | **R**   | **A**     | C              | C              | I          | **I**                |
| Notification pouvoir adjudicateur | **R/A** | C         | I              | I              | I          | —                    |
| Quality gate sécurité (CI/CD)     | C       | —         | I              | **R/A**        | C          | —                    |
| Revue de code sécurité            | C       | —         | I              | **R/A**        | **R**      | —                    |
| Comité de sécurité prestation     | **R/A** | I         | C              | C              | —          | **C**                |
| Formation des intervenants        | **R/A** | I         | C              | C              | I          | I                    |
| Tests de restauration             | **R**   | I         | I              | **A**          | C          | **I**                |
| Notification CNIL/ANSSI           | **R/A** | **C**     | I              | I              | I          | **I**                |

_R = Responsable, A = Approbateur, C = Consulté, I = Informé_

---

### 13.2 Registre des accès (modèle)

| Nom                 | Profil      | Systèmes accessibles     | Date d'entrée | Date de sortie prévue | Date de sortie effective | Date désactivation demandée | Date désactivation validée | Commentaire |
| ------------------- | ----------- | ------------------------ | ------------- | --------------------- | ------------------------ | --------------------------- | -------------------------- | ----------- |
| Exemple Intervenant | Développeur | Bitbucket, Jira, AWS dev | JJ/MM/AAAA    | JJ/MM/AAAA            | —                        | —                           | —                          | —           |

_Ce registre est mis à jour en continu par le RSSI et présenté à chaque comité de sécurité._

---

### 13.3 Plan de remédiation des points partiels

Les points suivants ont été identifiés comme **Partiels** dans le socle d'exigences SSI. Un plan d'action est défini pour chacun.

| #       | Point partiel                                                          | Situation actuelle                                                                                                         | Action corrective                                                                                                                                                                                | Échéance                        | Responsable           |
| ------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------- |
| **Q11** | MFA sur SI client dépendant de l'infrastructure cliente                | MFA 100 % sur SI Beorn. MFA sur SI client conditionné aux capacités techniques de l'infrastructure                         | Établir une recommandation technique MFA formelle pour le pouvoir adjudicateur dans les 15 premiers jours du marché. Proposer un accompagnement à la mise en œuvre si l'infrastructure le permet | Avant démarrage des prestations | RSSI                  |
| **Q21** | Chiffrement au repos Atlassian (Jira/Bitbucket) en cours de validation | AWS et Google Workspace : chiffrement AES-256 confirmé. Atlassian Cloud : attestation éditeur en attente                   | Obtenir l'attestation officielle de chiffrement Atlassian Cloud (disponible sur trust.atlassian.com). Si insuffisante, migrer les données sensibles vers AWS S3 chiffré                          | S1 2026                         | RSSI                  |
| **Q29** | Tests d'intrusion à la demande client                                  | Scans de vulnérabilités automatisés en CI/CD et AWS Inspector actifs. Pentest applicatif non réalisé de façon systématique | Formaliser un processus de pentest applicatif avant toute mise en production majeure. Premier pentest Liferay dans les 3 mois suivant la mise en production                                      | Démarrage prestation            | RSSI + Lead technique |
| **Q31** | PRI en cours de finalisation                                           | PCA en vigueur. RTO/RPO définis. Scénarios de reprise en cours de rédaction                                                | Finaliser le PRI avec scénarios de reprise détaillés, procédures step-by-step, et validation des RTO/RPO par un test réel                                                                        | T3 2026                         | RSSI + Équipe Cloud   |
| **Q32** | Exercice de reprise d'activité à formaliser                            | Tests partiels réalisés sans procès-verbal formalisé                                                                       | Planifier et exécuter un exercice de reprise complet. Produire un rapport d'exercice transmis au pouvoir adjudicateur                                                                            | T3 2026                         | RSSI                  |
| **Q34** | Tests de restauration < 6 mois à systématiser                          | Tests de restauration effectués mais non systématisés à fréquence semestrielle                                             | Instaurer un calendrier semestriel de tests de restauration avec PV. Premier test dans les 3 mois suivant la mise en production du marché                                                        | T2 2026                         | RSSI + Équipe Cloud   |
| **Q35** | PV de destruction des données à systématiser                           | Processus de destruction sécurisée existant mais PV non systématiquement produits                                          | Créer un modèle de PV de destruction. Appliquer le processus à chaque mise au rebut. Tenir un registre des destructions                                                                          | S1 2026                         | RSSI                  |
| **Q38** | Absence d'audit externe formel                                         | Pas de certification ISO 27001 ni d'audit externe réalisé à ce jour. Audits internes RSSI réguliers                        | Démarche ISO 27001 engagée. Audit de certification planifié au S2 2026. Partager le plan de mise en conformité avec le pouvoir adjudicateur sur demande                                          | S2 2026                         | RSSI + Direction      |

---

### 13.4 Contacts d'urgence SSI

_Ce tableau est complété avec les informations nominatives lors de la remise du PAS définitif au démarrage du marché._

| Rôle                                        | Nom                   | Téléphone (heures ouvrées) | Téléphone (astreinte P1) | Email                 |
| ------------------------------------------- | --------------------- | -------------------------- | ------------------------ | --------------------- |
| RSSI / Référent sécurité marché             | Olivier Bonnet-Torrès | À compléter                | À compléter              | À compléter           |
| Direction                                   | Boubker Tagnaouti     | À compléter                | À compléter              | À compléter           |
| DPO                                         | À désigner            | À compléter                | —                        | À compléter           |
| Correspondant sécurité pouvoir adjudicateur | À définir             | À compléter                | À compléter              | À compléter           |
| AWS Support (plan Business)                 | —                     | +1-800-xxx-xxxx            | Idem                     | Via console AWS       |
| CNIL (signalement violation DCP)            | —                     | 01 53 73 22 22             | —                        | notifications@cnil.fr |
| ANSSI (signalement incident)                | —                     | —                          | —                        | cert-fr.anssi.gouv.fr |

---

_Document confidentiel — Beorn Technologies SARL — Diffusion restreinte au pouvoir adjudicateur_
_Référence : BT-PAS-2026-001 — Version 1.0 — Avril 2026_
_Prochaine révision : Avril 2027 ou après incident P1/P2_
