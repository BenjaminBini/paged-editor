---
type: memoire-section
title: "Mémoire technique — TMA Liferay CNC (Marché n°2026028)"
ao_ref: "2026028"
acheteur: "Centre National du Cinéma et de l'Image Animée (CNC)"
section_id: ch4_securite
status: draft
max_pages: 4
---

# 4. Sécurité informatique

## 4.1. Démarche

### Approche DevSecOps

BEORN intègre la sécurité à chaque étape du cycle de développement, selon une approche DevSecOps : la sécurité n'est pas un contrôle final mais une dimension présente dès la conception et vérifiée en continu.

**En phase de développement :**

- **Revues de code sécurisées** : chaque merge request GitLab fait l'objet d'une revue par un pair, avec attention portée aux vulnérabilités OWASP Top 10 (injection, XSS, CSRF, exposition de données sensibles, mauvaise configuration de sécurité)
- **Analyse statique de code** : SonarQube intégré à la pipeline CI/CD GitLab — aucune livraison avec une vulnérabilité de sévérité critique ou bloquante
- **Gestion des dépendances** : audit régulier des bibliothèques tierces (npm audit, OWASP Dependency-Check) pour détecter les CVE connues dans les dépendances du projet
- **Secrets management** : interdiction de committer des secrets dans GitLab (clés API, mots de passe, certificats) — détection automatisée via GitLab Secret Detection

**En phase de déploiement :**

- **Hardening des instances Liferay** : configuration systématique des headers HTTP de sécurité (HSTS, CSP, X-Frame-Options, X-Content-Type-Options), politique CORS restrictive, désactivation des endpoints non utilisés
- **TLS obligatoire** : toutes les communications client/serveur chiffrées en TLS 1.2 minimum (1.3 recommandé)
- **Cookies sécurisés** : attributs Secure, HttpOnly et SameSite appliqués sur tous les cookies de session Liferay
- **Procédure de livraison sécurisée** : déploiement via pipeline automatisée GitLab CI/CD — pas de déploiement manuel en production

**En phase de maintenance :**

- **Veille CVE active** : Olivier Bonnet-Torrès assure une veille hebdomadaire sur les bases CVE (NVD, CERT-FR) pour les technologies du périmètre CNC (Liferay, PostgreSQL, Elasticsearch, Docker, dépendances Java/JS)
- **Suivi des bulletins de sécurité Liferay** : traitement dans les délais définis au §1.5 (patch critique ≤ 5 jours ouvrés)
- **Journalisation** : activation et supervision des logs d'accès et d'erreur Liferay ; remontée d'alertes sur les patterns suspects (tentatives d'authentification échouées, accès à des URLs sensibles)

### Formation et sensibilisation à la sécurité

L'ensemble des intervenants BEORN affectés au marché CNC reçoit une sensibilisation annuelle aux enjeux de sécurité informatique, couvrant :

- Les bonnes pratiques de développement sécurisé (OWASP Top 10, injection SQL, XSS)
- La gestion des accès et des secrets (politique de mots de passe, authentification multi-facteurs)
- La procédure de signalement d'incident de sécurité
- Les exigences spécifiques du clausier de cybersécurité CNC

Le référent sécurité du marché est **Olivier Bonnet-Torrès**, point de contact unique pour toute question ou incident de sécurité sur le périmètre CNC.

### Agréments, labels et certifications

À COMPLÉTER — certifications sécurité de l'entreprise (ISO 27001, qualification ANSSI, etc.) et certifications individuelles (CISSP, CEH, etc.) si applicables.

En l'état, BEORN s'appuie sur les bonnes pratiques de l'ANSSI (guides de sécurité pour les développeurs web, recommandations TLS, guide d'hygiène informatique) et les référentiels OWASP comme socle de sa démarche sécurité.

## 4.2. Formalisation

### Sommaire du Plan d'Assurance Sécurité (PAS)

Le PAS sera rédigé et remis au CNC dans les 30 jours suivant la notification du marché, conformément au CCAP. Son sommaire est le suivant :

**Partie 1 — Cadre et périmètre**
1.1. Objet et domaine d'application du PAS
1.2. Documents de référence (CCTP §3.12, clausier de cybersécurité CNC, CCAP §10.2)
1.3. Périmètre applicatif couvert (Intranet, cnc.fr V2, Garance)
1.4. Intervenants sécurité (référent BEORN, correspondant CNC)

**Partie 2 — Organisation de la sécurité**
2.1. Rôles et responsabilités en matière de sécurité
2.2. Gestion des accès et des habilitations (principe du moindre privilège)
2.3. Gestion des environnements (séparation dev / recette / production)
2.4. Politique de gestion des secrets et des certificats
2.5. Exigences applicables aux sous-traitants (sans objet — aucune sous-traitance)

**Partie 3 — Sécurité du développement**
3.1. Cycle de développement sécurisé (DevSecOps)
3.2. Revues de code et contrôles automatisés (SonarQube, Dependency-Check)
3.3. Tests de sécurité (OWASP Top 10, tests de régression sécurité)
3.4. Procédure de livraison sécurisée

**Partie 4 — Sécurité de l'infrastructure**
4.1. Hardening des instances Liferay
4.2. Configuration TLS et headers HTTP
4.3. Journalisation et supervision
4.4. Gestion des patches et mises à jour de sécurité

**Partie 5 — Continuité et incidents**
5.1. Procédure de signalement d'un incident de sécurité
5.2. Plan de gestion de crise (cf. section suivante)
5.3. Plan de continuité d'activité en cas d'incident majeur

**Partie 6 — Conformité et audit**
6.1. Respect du clausier de cybersécurité CNC
6.2. Coopération aux audits CNC (préavis 10 jours conformément au CCAP)
6.3. Revue annuelle du PAS

---

### Plan de gestion des risques sécurité

Les risques sécurité sont identifiés, évalués et traités selon une grille Probabilité × Impact. Les principaux risques identifiés sur le périmètre CNC sont :

| Risque | Probabilité | Impact | Mesure de traitement |
|---|---|---|---|
| Exploitation d'une CVE Liferay en production | Faible | Critique | Veille CVE hebdomadaire, patch ≤ 5j (critique) |
| Compromission d'un compte développeur | Faible | Élevé | MFA obligatoire, politique de rotation des secrets |
| Injection SQL / XSS sur évolution livrée | Faible | Élevé | Revue de code OWASP, SonarQube en CI/CD |
| Accès non autorisé à un environnement de production | Très faible | Critique | Gestion stricte des habilitations, MFA, audit des accès |
| Fuite de données (données CNC dans l'environnement dev) | Faible | Élevé | Anonymisation des dumps de base, cloisonnement des environnements |
| Intranet Liferay 6.2 — vulnérabilité sans patch officiel | Moyenne | Élevé | Hardening compensatoire, consolidation multisite planifiée |

Ce registre des risques est maintenu à jour dans Confluence et présenté au CNC lors de chaque COPIL trimestriel.

---

### Plan de gestion de crise sécurité

En cas d'incident de sécurité avéré ou suspecté sur le périmètre CNC, BEORN applique la procédure suivante :

**Détection et qualification (H+0 à H+2)**
- Détection via supervision des logs, signalement utilisateur ou alerte CVE
- Qualification de l'incident par le référent sécurité BEORN (OBT) : nature, périmètre, gravité
- Notification immédiate au CNC (responsable SOSI + RSSI CNC) — dans les **2 heures** suivant la détection, quelle que soit l'heure

**Confinement (H+2 à H+8)**
- Isolation du composant compromis si possible (désactivation d'un service, blocage d'un compte, coupure d'un accès)
- Préservation des logs et des preuves (pas de suppression ni écrasement)
- Activation de la cellule de crise BEORN (OBT + Bini) + CNC

**Analyse et remédiation (H+8 à H+72)**
- Analyse forensique légère : vecteur d'attaque, périmètre des données exposées, chronologie
- Développement et déploiement du correctif en urgence
- Tests de non-régression accélérés avant remise en production

**Clôture et retour d'expérience**
- Rapport d'incident complet transmis au CNC sous 5 jours ouvrés : chronologie, cause racine, mesures correctives et préventives
- Mise à jour du PAS et du registre des risques
- Si applicable : notification à la CNIL (violation de données personnelles)

BEORN s'engage à **notifier le CNC dans les 2 heures** suivant la détection de tout incident de sécurité, conformément aux exigences du clausier de cybersécurité.
