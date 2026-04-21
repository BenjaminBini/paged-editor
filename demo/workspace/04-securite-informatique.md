# Sécurité

## 1. Préambule et cadre de référence

Beorn Technologies place la sécurité des systèmes d'information au cœur de l'ensemble de ses prestations. Nous considérons que la sécurité n'est pas un effort ponctuel mais un processus continu, structuré et mesurable, intégré à toutes les phases du cycle de vie de la prestation.

Notre démarche SSI s'articule autour d'une gouvernance claire, d'une protection technique multi-couches, d'une capacité de détection et de réponse à incident formalisée, et d'un plan d'amélioration continue alimenté par des audits réguliers.

### Cadre réglementaire et normatif

Notre démarche s'inscrit dans les référentiels suivants :

- **Référentiel Général de Sécurité (RGS v2.0)** : ANSSI
- **ISO/IEC 27001:2022** : principes appliqués dans l'organisation (démarche de certification engagée, cf. §2)
- **OWASP Top 10** : référentiel de sécurité applicative appliqué à tous les développements
- **RGPD (Règlement UE 2016/679)** : conformité aux obligations de sous-traitant (article 28)
- **Guide des bonnes pratiques ANSSI** : informatique, nomadisme, développement sécurisé
- **PSSI du pouvoir adjudicateur** : les exigences de sécurité spécifiques au marché, telles que transmises, sont intégrées au Plan d'Assurance Sécurité (PAS) décrit au §5

---

## 2. Agréments, labels et certifications détenus

### Certifications actives et vérifiables

| Domaine                                                                            | Statut                     | Justificatif                                     |
| ---------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| Enregistrement CNIL (sous-traitant art. 28 RGPD)                                   | ✅ Actif                    | Numéro de déclaration disponible sur demande     |
| DPA (Data Processing Agreement)                                                    | ✅ Systématiquement proposé | Modèle disponible en annexe                      |
| Formation SSI certifiante (100 % des intervenants)                                 | ✅ Actif                    | Attestations SecNumAcadémie remises au démarrage |
| Certifications AWS du cloud provider (ISO 27001, ISO 27017, ISO 27018, SOC 2, HDS) | ✅ Héritées                 | Disponibles sur aws.amazon.com/compliance        |

### Démarche de certification en cours

Beorn Technologies a engagé une démarche de mise en conformité **ISO 27001:2022**. L'audit de certification est planifié au premier semestre 2027. Le plan de mise en conformité et le statut d'avancement sont disponibles sur demande du pouvoir adjudicateur et présentés en comité de sécurité.

---

## 3. Mesures, outils et démarche de sécurisation

### 3.1 Gouvernance et organisation SSI

#### Rôles et responsabilités

| Rôle                               | Intervenant           | Périmètre                                                                             |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| **RSSI / Responsable SSI marché**  | Olivier Bonnet-Torrès | Pilotage PAS, gestion de crise, reporting, comités sécurité                           |
| **Correspondant sécurité**         | Olivier Bonnet-Torrès | Point de contact avec le pouvoir adjudicateur, alertes incidents, suivi des exigences |
| **DPO**                            | À désigner            | Conformité RGPD, gestion des violations de données, registre des traitements          |
| **Direction**                      | Boubker Tagnaouti     | Décision stratégique, arbitrages, communication externe en cas de crise P1            |
| **Équipe sécurité opérationnelle** | Équipe Beorn          | Contrôles techniques, collecte de preuves, monitoring quotidien                       |

Un **RACI détaillé** est inclus dans le PAS remis en début de marché, conformément aux exigences du socle SSI.

#### Comitologie

| Instance                    | Fréquence   | Participants                                      | Livrables                                           |
| --------------------------- | ----------- | ------------------------------------------------- | --------------------------------------------------- |
| Comité sécurité interne     | Mensuel     | RSSI, équipe sécurité                             | Tableau de bord SSI, incidents, actions correctives |
| Comité sécurité prestation  | Trimestriel | RSSI, correspondant sécurité pouvoir adjudicateur | Rapport SSI, revue des indicateurs, PAS mis à jour  |
| Revue de direction sécurité | Annuel      | Direction, RSSI                                   | Bilan annuel, plan d'amélioration, arbitrages       |

---

### 3.2 Contrôle des accès et gestion des identités

#### Principe du moindre privilège

L'ensemble des accès aux ressources du marché (dépôts de code, environnements AWS, outils Atlassian, espaces de collaboration) est régi par le principe du **besoin de connaître et besoin d'utiliser** : chaque intervenant dispose uniquement des droits strictement nécessaires à sa mission, pour la seule durée de celle-ci.

#### Authentification forte (MFA)

L'authentification multifacteur est **obligatoire sans exception** sur l'ensemble des accès aux systèmes du marché :

- **Cloudflare Zero Trust (ZTNA)** : tous les accès aux environnements de développement, de recette et aux outils projet sont conditionnés à une vérification d'identité forte avec évaluation de la posture de sécurité du terminal (chiffrement actif, version OS à jour, EDR présent). Aucun accès VPN traditionnel n'est toléré.
- **Google Workspace SSO** : fédération d'identité OAuth2/SAML pour tous les outils compatibles. MFA obligatoire sur tous les comptes. Clé de sécurité physique recommandée pour les comptes à privilèges élevés.
- **Atlassian (Jira, Bitbucket)** : SSO Google enforced, MFA obligatoire, séparation des comptes administrateurs et utilisateurs.
- **AWS IAM** : comptes nominatifs, principe du moindre privilège, MFA obligatoire sur les comptes à privilèges, aucune utilisation du compte root.

#### Gestion du cycle de vie des comptes

- **Liste des intervenants** tenue à jour avec : nom, type d'accès, date d'entrée, date de sortie, date de demande de suppression, date de validation de suppression, présentée en comité de sécurité.
- **Revue des habilitations** : comptes à privilèges → mensuelle ; comptes utilisateurs → trimestrielle.
- **Offboarding sécurisé sous 24 heures** : révocation de tous les accès, suppression des clés SSH et tokens API, archivage des activités, formatage bas niveau de la zone de stockage des données du pouvoir adjudicateur avant réaffectation du poste.

---

### 3.3 Sécurité des postes de travail

Les postes de travail des intervenants (MacBook Pro) constituent le premier vecteur d'attaque. Notre politique endpoints repose sur quatre piliers opérationnels :

| Mesure                             | Outil         | Couverture    | Vérification                                                               |
| ---------------------------------- | ------------- | ------------- | -------------------------------------------------------------------------- |
| **Chiffrement intégral du disque** | FileVault 2   | 100 % du parc | Dashboard Jamf Pro, rapport mensuel                                        |
| **Protection endpoint / EDR**      | Jamf Protect  | 100 % du parc | Dashboard Jamf Protect, alertes temps réel                                 |
| **Gestion MDM et mises à jour**    | Jamf Protect  | 100 % du parc | Correctifs critiques déployés ≤ 72h après publication CERT-FR              |
| **Verrouillage automatique**       | Politique MDM | 100 % du parc | Verrouillage de session à 5 min d'inactivité, mot de passe ≥ 14 caractères |

Mesures complémentaires :

- Blocage des supports amovibles via politique Jamf (aucun support amovible utilisé sur la prestation)
- Pas de droits d'administrateur local pour les utilisateurs standards
- Politique de bureau propre et d'écran verrouillé formalisée et affichée

---

### 3.4 Sécurité de l'infrastructure cloud (AWS)

| Service                       | Rôle                                                                 | Périmètre                                                |
| ----------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| **AWS GuardDuty**             | Détection des menaces (analyse CloudTrail, VPC Flow Logs, DNS)       | Tous les comptes et régions du marché                    |
| **AWS Security Hub**          | Agrégation des findings (GuardDuty, Inspector, Macie, CIS Benchmark) | Alerte immédiate sur tout finding HIGH/CRITICAL          |
| **AWS CloudTrail**            | Journalisation exhaustive des actions d'administration               | Rétention 12 mois, S3 chiffré, MFA Delete activé         |
| **AWS WAF + Shield Standard** | Protection applicative (OWASP Top 10) et anti-DDoS                   | Environnements Liferay exposés                           |
| **AWS Secrets Manager**       | Gestion des secrets avec rotation automatique                        | Aucun secret en clair dans le code ou les configurations |
| **AWS Backup**                | Sauvegardes chiffrées AES-256                                        | Recette : rétention 30 j / Production : rétention 90 j   |
| **AWS Inspector**             | Scan de vulnérabilités sur les instances EC2 et images de conteneurs | Rapport mensuel, suivi en comité sécurité                |

Politique de sauvegarde :

- Sauvegardes déportées dans une région AWS différente de la région de production
- Journaux de sauvegarde analysés par les administrateurs après chaque exécution
- **Test de restauration semestriel**, PV de test remis au pouvoir adjudicateur
- Sauvegardes auditables par le pouvoir adjudicateur sur demande

---

### 3.5 Sécurité réseau et des accès distants

- **Cloudflare Zero Trust Gateway** : filtrage DNS et web, protection contre les menaces réseau, logs centralisés (rétention 12 mois sur plan payant). Aucun accès direct au réseau du pouvoir adjudicateur : tout accès passe par le bastion défini contractuellement.
- **Cloisonnement des environnements** : développement, recette et production sont strictement séparés. Les données de la prestation sont cloisonnées des autres clients sur les infrastructures mutualisées.
- **Interdiction des protocoles obsolètes** : TLS < 1.2, SSH v1, FTP et tout protocole non chiffré sont bloqués.
- **Durcissement des configurations** : tout équipement déployé fait l'objet d'un hardening initial (changement des mots de passe par défaut, désactivation des services inutilisés, principe de moindre fonctionnalité).
- **Protection anti-spam et messagerie** : Google Workspace avec filtrage anti-phishing avancé, analyse des pièces jointes, chiffrement des échanges sensibles.

---

### 3.6 Sécurité du développement (approche DevSecOps)

La sécurité est intégrée dans toutes les phases du cycle de développement (Security by Design).

#### Intégration dans le pipeline CI/CD

```
Commit → Scan secrets (git-secrets) → SAST (SonarQube) → Build
→ Scan dépendances (Dependabot / SBOM) → Tests → Déploiement
```

Détail des contrôles :

- **Analyse statique (SAST, SonarQube)** : quality gate obligatoire : aucune merge request fusionnable si vulnérabilités BLOCKER ou CRITICAL non résolues. Rapport inclus dans la documentation de sprint.
- **Revue de code obligatoire** : tout code produit est revu par un second développeur avant intégration, avec un volet sécurité explicite (injections, gestion des erreurs, contrôle d'accès, exposition de données).
- **Interdiction des secrets dans le code** : scan pre-commit et CI/CD via git-secrets. Tout commit contenant un potentiel secret est rejeté automatiquement.
- **SBOM (Software Bill of Materials)** : maintenu et mis à jour à chaque sprint. Alertes Dependabot traitées dans les délais définis (cf. §6.2).
- **Gestion des dépendances** : toute nouvelle bibliothèque est évaluée (activité du dépôt, date du dernier release, communauté). Les dépendances abandonnées ne sont pas admises.
- **Protection des branches principales** : push direct interdit, pull request obligatoire, approbation d'au moins un reviewer, CI verte obligatoire avant merge.
- **Analyse de la dette technique sécurité initiale** : en cas de reprise de patrimoine applicatif Liferay existant, une analyse de code initiale est effectuée. Beorn s'engage à ne pas dégrader le niveau de sécurité existant et à proposer un plan de traitement des failles identifiées.
- **Conformité OWASP Top 10** : les exigences spécifiques à l'environnement Liferay/Java sont intégrées aux critères de revue de code et aux quality gates SonarQube.

---

### 3.7 Protection des données et conformité RGPD

- **Anonymisation obligatoire des données de test** : toute donnée à caractère personnel issue de la production est anonymisée ou pseudonymisée avant utilisation en développement ou recette. L'utilisation de données non anonymisées requiert une validation formelle du RSSI du pouvoir adjudicateur.
- **Minimisation des données** : aucun export de données de production vers des postes locaux sans validation préalable.
- **Chiffrement en transit** : TLS 1.2 minimum sur tous les flux (TLS 1.3 par défaut), certificats valides, HSTS activé.
- **Chiffrement au repos** : AES-256 sur S3, RDS, et tous les supports de stockage.
- **Gestion des supports amovibles** : aucun support amovible autorisé sur la prestation. Mise au rebut sécurisée avec PV fourni par une société habilitée, partagé en comité sécurité.
- **DPA signé** : accord de traitement des données conforme à l'article 28 RGPD proposé à la signature préalablement au démarrage.
- **Suppression des données en fin de prestation** : engagement de suppression sécurisée de toutes les données du pouvoir adjudicateur en fin de marché, avec PV de destruction.

---

## 4. Formation et sensibilisation à la sécurité

### 4.1 Formations obligatoires avant prise de fonction

Tout intervenant affecté au marché valide les formations suivantes **avant sa prise de fonction effective** :

| Formation                                     | Organisme     | Durée | Justificatif                                                         |
| --------------------------------------------- | ------------- | ----- | -------------------------------------------------------------------- |
| **SecNumAcadémie — niveau 2**                 | ANSSI         | ~8h   | Attestation individuelle remise au démarrage                         |
| **Fondamentaux de la cybersécurité**          | Opco Atlas    | 2h    | Attestation individuelle remise au démarrage                         |
| **Sensibilisation RGPD**                      | Interne Beorn | 2h    | Évaluation ≥ 95 % de bonnes réponses requis                          |
| **Sécurité applicative Liferay/Java (OWASP)** | Interne Beorn | 2h    | https://learn.liferay.com/w/dxp/security-and-administration/security |

Le tableau des intervenants avec les dates de réalisation des sensibilisations et les taux de réussite est présenté lors du premier comité de sécurité et mis à jour tout au long du marché.

### 4.2 Engagements individuels

- **Engagement de confidentialité** signé par chaque intervenant avant prise de fonction, couvrant les données et systèmes du pouvoir adjudicateur pour toute la durée du marché et au-delà.
- **Charte éthique** intégrée au règlement intérieur Beorn : loyauté, discrétion, impartialité, non-divulgation, signalement de contenus illicites, respect de la réglementation. Signée par tous les intervenants ; disponible sur demande du pouvoir adjudicateur.
- **Clause de notification d'incident** : tout intervenant ayant connaissance d'une anomalie ou d'un incident, même potentiel, est tenu de le signaler au RSSI dans un délai maximal d'**une heure**.
- **Livret d'accueil sécurité** remis à chaque nouvel intervenant (version initiale et évolutions partagées avec le pouvoir adjudicateur pour validation).

### 4.3 Sensibilisation continue

- **Campagne de phishing simulé** : au moins une campagne annuelle sur l'ensemble de l'équipe (outil KnowBe4 ou équivalent). Les intervenants identifiés comme vulnérables suivent un module complémentaire.
- **Bulletin de veille mensuel** : le RSSI diffuse mensuellement un bulletin synthétisant les CVE critiques relatives à l'écosystème du marché (Liferay, JVM, AWS, dépendances utilisées).
- **REX post-incident** : tout incident, même mineur, donne lieu à un retour d'expérience formalisé partagé avec l'équipe dans les 5 jours ouvrés suivant la clôture.

### 4.4 Processus disciplinaire

Tout manquement aux exigences de sécurité du pouvoir adjudicateur ou de Beorn entraîne le retrait immédiat de l'intervenant de la prestation. Le processus disciplinaire interne est décrit dans le règlement intérieur de Beorn, disponible sur demande.

---

## 5. Plan d'Assurance Sécurité (PAS) : sommaire

Le PAS est le document contractuel de référence. Il est remis au pouvoir adjudicateur dans les **10 jours ouvrés** suivant la notification du marché, pour validation avant tout démarrage des prestations. Il est révisé après tout incident significatif, lors de toute évolution majeure du périmètre, et au minimum annuellement.

Le PAS couvre les **44 points de contrôle** du socle d'exigences SSI, regroupés en **11 thèmes**. Son sommaire est le suivant :

| §   | Thème                                      | Contenu principal                                                                                                                                                                                                      |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Politique de sécurité du SI                | PSSI Beorn, cycle de révision annuel, notification des changements impactant le PAS au pouvoir adjudicateur                                                                                                            |
| 2   | Organisation de la sécurité et gouvernance | Rôles RSSI, correspondant sécurité, DPO, équipe opérationnelle — RACI — Comitologie — Relations avec les autorités (CNIL, ANSSI)                                                                                       |
| 3   | Classification et contrôle des actifs      | Inventaire des actifs (physiques, logiciels, données, services) — propriétaire de chaque actif — classification selon la politique du pouvoir adjudicateur — gestion du cycle de vie — mise au rebut sécurisée avec PV |
| 4   | Sécurité des ressources humaines           | Processus de recrutement (vérification identité, diplômes, CV) — engagements contractuels — charte éthique — livret d'accueil — plan de formation — processus disciplinaire — offboarding                              |
| 5   | Sécurité physique et environnementale      | Accès aux locaux (badge, contrôle) — sécurité physique des postes nomades — câbles antivol — politique bureau propre/écran verrouillé — hébergement AWS (certifications data center)                                   |
| 6   | Sécurité réseau et accès                   | Cloudflare Zero Trust — séparation des réseaux prestataire/client — cloisonnement des environnements — durcissement des configurations — interdiction des protocoles obsolètes                                         |
| 7   | Sécurité des systèmes et postes            | Jamf Protect (EDR) — FileVault — politique de patching (≤ 72h critique) — blocage supports amovibles — pas de droits admin local                                                                                       |
| 8   | Contrôle des accès logiques                | MFA obligatoire — moindre privilège — IAM AWS — gestion des mots de passe (coffre-fort) — revue des habilitations (mensuelle/trimestrielle) — offboarding ≤ 24h                                                        |
| 9   | Reprise et continuité d'activité (PCA/PRI) | RTO/RPO cibles — sauvegardes AWS (fréquences, rétention) — tests de restauration semestriels avec PV — exercice annuel de reprise                                                                                      |
| 10  | Conformité et audits                       | Conformité RGPD — absence de violation sur 5 ans — mécanisme d'audit externe par le pouvoir adjudicateur — délais de remédiation par criticité — suppression des données en fin de prestation                          |
| 11  | Développement applicatif                   | DevSecOps — SAST (SonarQube) — OWASP Top 10 — revue de code — SBOM — gestion des dépendances — security by design — données de test anonymisées                                                                        |

---

## 6. Plan de gestion et de suivi des risques SSI

### 6.1 Méthodologie

L'analyse des risques SSI est conduite selon une approche inspirée d'**EBIOS Risk Manager** (ANSSI, 2018), adaptée au contexte de la TMA. Elle identifie les sources de risque, les biens supports, les événements redoutés et les scénarios opérationnels, et en déduit des mesures de traitement priorisées.

Elle est mise à jour annuellement et lors de tout changement significatif du périmètre. Les résultats et le plan d'action sont présentés au pouvoir adjudicateur en comité de sécurité.

### 6.2 Matrice de risques

| Axe de risque                                  | Probabilité | Impact   | Criticité   | Mesure principale                                  |
| ---------------------------------------------- | ----------- | -------- | ----------- | -------------------------------------------------- |
| Accès non autorisé au code source              | Faible      | Élevé    | **Modérée** | Cloudflare ZTNA + MFA + contrôle d'accès Bitbucket |
| Compromission d'un poste développeur           | Modérée     | Élevé    | **Élevée**  | Jamf Protect + FileVault + MDM                     |
| Fuite de données de recette (DCP)              | Faible      | Critique | **Élevée**  | Anonymisation obligatoire des jeux de test         |
| Vulnérabilité introduite dans le code Liferay  | Modérée     | Élevé    | **Élevée**  | SAST SonarQube + revue de code + OWASP             |
| Incident infrastructure AWS (intrusion / DDoS) | Faible      | Critique | **Modérée** | AWS GuardDuty + WAF + Security Hub                 |
| Dépendance compromise (supply chain)           | Faible      | Élevé    | **Modérée** | SBOM + Dependabot + audit des dépendances          |
| Non-conformité RGPD sur les traitements        | Modérée     | Élevé    | **Élevée**  | DPA + anonymisation + minimisation des données     |
| Incident prestataire tiers / sous-traitant     | Faible      | Modérée  | **Faible**  | Clauses SSI contractuelles + audit annuel          |

### 6.3 Délais de remédiation des vulnérabilités (scoring CVSS)

| Criticité CVSS | Score     | Délai de remédiation                      |
| -------------- | --------- | ----------------------------------------- |
| Critique       | ≥ 9.0     | **≤ 48 heures** après publication CERT-FR |
| Élevée         | 7.0 – 8.9 | **≤ 10 jours ouvrés**                     |
| Modérée        | 4.0 – 6.9 | **Prochain sprint**                       |
| Faible         | < 4.0     | **Intégration dans le backlog**           |

### 6.4 Suivi opérationnel

- **Revue mensuelle des risques** présentée en comité de suivi : état du plan de traitement, nouvelles vulnérabilités, indicateurs.
- **Tableau de bord sécurité** partagé avec le pouvoir adjudicateur : couverture EDR, conformité FileVault, taux MFA, vulnérabilités ouvertes, incidents.
- **Tests d'intrusion** — un pentest applicatif (périmètre Liferay) est proposé annuellement, rapport remis au pouvoir adjudicateur. Si requis par le CCTP, un pentest contradictoire par un PASSI qualifié ANSSI peut être organisé.

---

## 7. Plan de gestion de crise en cas d'incident de sécurité

La procédure de gestion des alertes et incidents de sécurité est formalisée dans le document **PRO-SSI-001 « Procédure d'escalade — Gestion des alertes de sécurité »** (version 1.0, Mars 2026, statut : en vigueur), joint en annexe du PAS.

### 7.1 Périmètre de détection

| Périmètre                  | Outil de détection               |
| -------------------------- | -------------------------------- |
| Infrastructure cloud (AWS) | AWS GuardDuty / AWS Security Hub |
| Flux réseau postes nomades | Cloudflare Zero Trust Gateway    |
| Endpoints MacBook Pro      | Jamf Protect (EDR)               |

### 7.2 Niveaux de qualification

| Niveau | Criticité | Définition                                          | Exemples                                                                                       |
| ------ | --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **P1** | Critique  | Compromission avérée ou en cours                    | Exfiltration de données, ransomware, accès non autorisé à un compte privilégié                 |
| **P2** | Élevée    | Menace probable nécessitant investigation immédiate | Tentative de mouvement latéral, connexion depuis un pays à risque, malware détecté non propagé |
| **P3** | Modérée   | Activité suspecte à surveiller                      | Multiples échecs d'authentification, scan de ports, anomalie réseau                            |
| **P4** | Faible    | Événement informatif ou faux positif probable       | Alerte connue récurrente, non-conformité mineure de configuration                              |

### 7.3 Procédure d'escalade et délais de réponse

#### Niveau P1 — Critique (délai de réponse : < 30 minutes)

1. Détection par AWS Security Hub / Jamf Protect / Cloudflare.
2. Qualification initiale par le référent sécurité (en cas de doute, niveau supérieur par défaut).
3. **Isolation immédiate** du poste ou de la ressource concernée.
4. Notification immédiate du **RSSI (Olivier Bonnet-Torrès)** et de la **Direction (Boubker Tagnaouti)**.
5. Notification du **pouvoir adjudicateur dans un délai de 2 heures** : canal : appel téléphonique direct + email.
6. Ouverture d'un ticket d'incident critique, activation de la cellule de crise si nécessaire.
7. Préservation des preuves numériques (logs CloudTrail, snapshots, captures mémoire) avant toute action corrective.
8. Notification **CNIL dans les 72 heures** si violation de données à caractère personnel (art. 33 RGPD).
9. Notification **ANSSI** si l'entité est concernée par la directive NIS2.

#### Niveau P2 — Élevée (délai de réponse : < 2 heures)

1. Investigation approfondie par le référent sécurité.
2. Notification du RSSI.
3. Notification du **pouvoir adjudicateur dans un délai de 4 heures** : canal : email + Slack sécurité.
4. Ouverture d'un ticket d'incident.

#### Niveau P3 — Modérée (délai de réponse : < 8 heures ouvrées)

1. Analyse et surveillance renforcée.
2. Notification du référent sécurité.
3. Rapport hebdomadaire au client si l'alerte persiste, canal : ticket + email.

#### Niveau P4 — Faible (délai de réponse : < 5 jours ouvrés)

1. Enregistrement dans le registre des incidents.
2. Traitement lors de la prochaine revue sécurité.

### 7.4 Phases de la réponse à incident (P1/P2)

**Phase 1 — Détection et qualification (J0)**
Détection → qualification ≤ 30 min → ouverture ticket d'incident (accès restreint, traçabilité complète) → notification selon délais ci-dessus.

**Phase 2 — Confinement et investigation (J0–J1)**
Isolation du composant compromis → préservation des preuves → analyse forensique (vecteur d'attaque, périmètre, données potentiellement exfiltrées) → notification pouvoir adjudicateur.

**Phase 3 — Éradication et remédiation (J1–J3)**
Déploiement du correctif → revue complète des accès → vérification de l'intégrité des sauvegardes → notification CNIL/ANSSI si applicable.

**Phase 4 — Retour à la normale et clôture**
Validation du retour en production par le pouvoir adjudicateur → **rapport post-incident complet dans les 5 jours ouvrés** (chronologie, analyse des causes, mesures correctives) → REX intégré au PAS → mise à jour de la matrice de risques si nouveau vecteur identifié.

### 7.5 Conservation des logs

| Source                                    | Durée de rétention | Responsable     |
| ----------------------------------------- | ------------------ | --------------- |
| AWS GuardDuty / Security Hub / CloudTrail | 12 mois            | Équipe Cloud    |
| Cloudflare Zero Trust Gateway             | 12 mois            | Équipe Sécurité |
| Jamf Protect (EDR)                        | 12 mois            | Équipe Sécurité |

### 7.6 Contacts d'urgence

Un répertoire de contacts d'urgence SSI est communiqué au pouvoir adjudicateur au démarrage du marché. En cas d'incident P1, le RSSI et le responsable technique sont joignables **24h/24 et 7j/7** pour toute la durée de la phase de crise.

> ⚠️ **Engagement de disponibilité** : en situation de crise P1, Beorn s'engage à mobiliser son RSSI et son responsable technique en astreinte permanente jusqu'à la résolution de l'incident et la validation du retour à la normale par le pouvoir adjudicateur.

---

## 8. Indicateurs de pilotage SSI

Les indicateurs ci-dessous sont suivis et présentés en comité de sécurité.

| Indicateur                                        | Cible                     | Fréquence     |
| ------------------------------------------------- | ------------------------- | ------------- |
| Taux de couverture EDR / antimalware              | 100 % du parc             | Mensuelle     |
| Taux de conformité FileVault                      | 100 % des MacBook         | Mensuelle     |
| Taux de couverture MFA (accès systèmes du marché) | 100 % des comptes         | Trimestrielle |
| Délai moyen de patching critique                  | ≤ 72h après CERT-FR       | Mensuelle     |
| Vulnérabilités critiques non corrigées            | 0                         | Mensuelle     |
| Taux de formations cyber à jour                   | 100 % des intervenants    | Semestrielle  |
| Revue des droits d'accès effectuée                | 100 % des comptes audités | Trimestrielle |
| Score moyen SonarQube (quality gate)              | 0 BLOCKER / 0 CRITICAL    | Par sprint    |
| Incidents P1/P2 survenus                          | Tout incident déclaré     | Sur incident  |
| Délai moyen de détection (MTTD)                   | < 2 heures                | Sur incident  |
| Tests de restauration réalisés                    | ≥ 1 tous les 6 mois       | Semestrielle  |
| Exercices de reprise d'activité                   | ≥ 1 / an                  | Annuelle      |
