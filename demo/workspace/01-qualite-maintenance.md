---
type: memoire-section
title: "Mémoire technique — TMA Liferay CNC (Marché n°2026028)"
ao_ref: "2026028"
acheteur: "Centre National du Cinéma et de l'Image Animée (CNC)"
section_id: ch1_maintenance
status: draft
max_pages: 9
---

# 1. Qualité de la maintenance

## 1.1. Organisation de la gouvernance et pilotage de la qualité

### Dispositif de gouvernance

BEORN Technologies propose un dispositif de gouvernance à trois niveaux, conçu pour assurer une transparence totale sur l'état des prestations et la réactivité attendue dans le cadre d'un accord-cadre multi-applicatif.

#### Comité de projet opérationnel (COPROJ), toutes les 2 semaines

Réunion opérationnelle bimensuelle réunissant le chef de projet BEORN et les interlocuteurs techniques CNC. Son ordre du jour type :

- Avancement des demandes en cours (tickets correctifs, demandes évolutives)
- Revue des indicateurs SLA de la période
- Présentation du plan de charge prévisionnel à 4 semaines
- Points de blocage et décisions urgentes

En phase de croisière, le COPROJ est **mutualisé pour les trois applications** du périmètre (Intranet, cnc.fr, Garance), permettant au CNC de disposer d'une vue transverse cohérente en une seule réunion. Cette organisation, issue de notre expérience directe avec le CNC, évite la fragmentation des suivis et réduit la charge de réunion pour les équipes du SOSI.

Compte-rendu transmis sous 48h ouvrées.

#### Comité de pilotage (COPIL), trimestriel

Réunion stratégique trimestrielle associant la direction BEORN, le chef de projet, et les responsables CNC (SOSI, DAM si nécessaire). Son ordre du jour :

- Bilan qualité du trimestre (indicateurs, tendances, incidents)
- Revue du Plan d'Assurance Qualité (PAQ)
- Ajustements de la convention de service si nécessaire
- Perspectives : projets agiles à venir, maintien en condition des applications
- Satisfaction client

dq
dq
sdsdqsd
sdqsd

/newpage

Compte-rendu transmis sous 5 jours ouvrés.

/newpage

#### Échanges quotidiens et hotlines

En dehors des comités formels, les échanges opérationnels s'effectuent via :

- **Jira** : outil central de suivi de toutes les demandes (tickets correctifs, évolutions, études)
- **Teams** (messagerie, visioconférence) : communication rapide avec l'équipe CNC
- **Hotline téléphonique** : disponible du lundi au vendredi, 9h00–18h00, pour les demandes bloquantes

### Indicateurs de pilotage qualité

BEORN s'engage sur les 8 indicateurs de qualité de service définis dans le CCTP, présentés dans le tableau de bord partagé avec le CNC via Jira :

| Indicateur                     | Engagement BEORN                                                             | Fréquence de mesure |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------- |
| Délai de production d'un devis | ≤ 5 jours ouvrés (évolution simple) / ≤ 10 jours ouvrés (évolution complexe) | Par demande         |
| Adéquation des compétences     | 100% des intervenants conformes au profil requis                             | Trimestriel         |
| Stabilité de l'équipe          | Délai de remplacement ≤ 15 jours ouvrés                                      | Par événement       |
| Taux de recouvrement           | Phase d'initialisation ≤ 8 semaines                                          | À la mise en TMA    |
| Maintien de la vélocité        | Vélocité maintenue à partir du 5ème sprint (calibrage sur 4 sprints)         | Par lot de sprints  |
| Respect du planning            | Jalons livrés à ±1 sprint                                                    | Par sprint          |
| Taux de régression             | 0 régression bloquante en production                                         | Par livraison       |
| Délai de MCO corrective        | Conforme aux délais CCTP par application et gravité (cf. §1.3)               | Par ticket          |

Le tableau de bord est accessible en permanence au CNC dans l'espace projet Jira dédié. Un rapport mensuel synthétique est transmis avant chaque COPROJ.

### Principes de pilotage qualité

**Transparence systématique** : tout incident, retard ou risque identifié est signalé proactivement au CNC. BEORN n'attend pas le COPROJ pour informer.

**Traçabilité complète** : chaque demande (corrective, évolutive, adaptative) fait l'objet d'un ticket Jira avec statut, priorité, responsable, délai estimé et réel. L'historique est intégralement conservé.

**Amélioration continue** : lors de chaque COPIL, BEORN présente une analyse des indicateurs en tendance (non seulement le niveau absolu) et propose des actions correctives si un indicateur se dégrade.

**Devoir de conseil** : BEORN alerte systématiquement le CNC sur les risques techniques identifiés (obsolescence, dette technique, opportunités de mutualisation), sans attendre une demande explicite.

### Sommaire du Plan d'Assurance Qualité (PAQ)

Le PAQ sera formalisé et remis au CNC dans les 30 jours suivant la notification du marché. Son sommaire est le suivant :

#### **Partie 1 : Cadre et organisation**

- 1.1. Objet et domaine d'application du PAQ
- 1.2. Documents de référence (CCTP, CCAP, convention de service)
- 1.3. Organisation du marché (organigramme, rôles et responsabilités)
- 1.4. Interfaces et modalités de communication

#### **Partie 2 : Processus qualité**

- 2.1. Gestion des demandes (cycle de vie d'un ticket)
- 2.2. Gestion des configurations et des livraisons
- 2.3. Processus de recette et de validation
- 2.4. Gestion des non-conformités et des actions correctives

#### **Partie 3 : Indicateurs et pilotage**

- 3.1. Tableau de bord qualité et indicateurs SLA
- 3.2. Revues qualité (COPROJ, COPIL) : ordre du jour type, CR type
- 3.3. Traitement des alertes et escalades

#### **Partie 4 : Amélioration continue**

- 4.1. Retours d'expérience (REX) post-incident
- 4.2. Plan d'amélioration annuel
- 4.3. Gestion des risques projet

/newpage

## 1.2. Modalités de mise en œuvre du service

### Un atout décisif : la connaissance directe du périmètre CNC

BEORN aborde cette phase d'initialisation dans une position singulière, grâce à deux atouts complémentaires :

**Benjamin Bini**, qui assurera la responsabilité de pilotage du marché, a géré la TMA des applications CNC pendant trois ans au sein de Sully Group. Cette expérience directe apporte :

- **Connaissance des applications** dans leur état réel : architecture, dette technique, comportements, historique des évolutions significatives
- **Connaissance de l'organisation CNC** : mode de fonctionnement du SOSI, profils des chefs de projet, processus de validation
- **Connaissance du prestataire sortant** : facilitant un recouvrement coordonné et non conflictuel

**Thomas Tsé**, développeur Liferay senior, a participé au développement de **cnc.fr V2** et du **portail Garance** au sein du prestataire sortant. Il dispose d'une connaissance directe du code, de l'architecture et des choix techniques de ces deux applications, ce qui garantit une reprise en main immédiate, sans phase d'apprentissage du patrimoine applicatif.

En conséquence, la phase d'initialisation de BEORN sera **significativement plus courte** que celle d'un prestataire découvrant le périmètre. Nous nous engageons sur une initialisation en **8 semaines**, avec une TMA pleinement opérationnelle à l'issue de cette période.

### Phase d'initialisation : 8 semaines, 5 phases

<div style="position: relative; padding-left: 28px; margin: 16px 0">
        <div style="
            position: absolute;
            left: 11px;
            top: 14px;
            bottom: 34px;
            width: 2px;
            border-radius: 2px;
            background: linear-gradient(to bottom, #3373b3, #0096ae);
          "></div>
        <div style="position: relative; padding: 8px 0 16px 16px">
          <div style="
              position: absolute;
              left: -22px;
              top: 12px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 3px solid #3373b3;
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #3373b3;
              margin-bottom: 2px;
            ">
            Phase 1 — S1 — Lancement
          </div>
          <div style="font-size: 8.5pt; color: #2d3748; line-height: 1.4">
            Kick-off, acces, outils, plan d'initialisation
          </div>
        </div>
        <div style="position: relative; padding: 8px 0 16px 16px">
          <div style="
              position: absolute;
              left: -22px;
              top: 12px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 3px solid #5a93c8;
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #5a93c8;
              margin-bottom: 2px;
            ">
            Phase 2 — S2-S3 — Ateliers et montee en competence
          </div>
          <div style="font-size: 8.5pt; color: #2d3748; line-height: 1.4">
            Ateliers de passation, transfert de connaissances, formation equipe
          </div>
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #2a9aa8;
              margin-bottom: 2px;
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #2a9aa8;
              margin-bottom: 2px;
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #2a9aa8;
              margin-bottom: 2px;
        </div>
        <div style="position: relative; padding: 8px 0 16px 16px">
          <div style="
              position: absolute;
              left: -22px;
              top: 12px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 3px solid #2a9aa8;
            ">
            Phase 3 — S3-S5 — Prise en charge progressive
          </div>
          <div style="font-size: 8.5pt; color: #2d3748; line-height: 1.4">
            Premiers tickets traites, montee en autonomie, correctif sous supervision
          </div>
        </div>
        <div style="position: relative; padding: 8px 0 16px 16px">
          <div style="
              position: absolute;
              left: -22px;
              top: 12px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 3px solid #1a8a7a;
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #1a8a7a;
              margin-bottom: 2px;
            ">
            Phase 4 — S5-S7 — Audit et transfert de responsabilite
          </div>
          <div style="font-size: 8.5pt; color: #2d3748; line-height: 1.4">
            Audit technique, convention de service, fin du recouvrement sortant
          </div>
        </div>
        <div style="position: relative; padding: 8px 0 16px 16px">
          <div style="
              position: absolute;
              left: -22px;
              top: 12px;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 3px solid #0096ae;
              background: #fff;
            "></div>
          <div style="
              font-family: &quot;Montserrat&quot;, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #0096ae;
              margin-bottom: 2px;
            ">
            Phase 5 — S8 — Conclusion et demarrage TMA
          </div>
          <div style="font-size: 8.5pt; color: #2d3748; line-height: 1.4">
            Validation MOM, remise PAQ et PAS, premier COPROJ, TMA operationnelle
          </div>
        </div>
      </div>

#### Phase 1 : Lancement (semaine 1)

- Réunion de lancement avec le SOSI et le prestataire sortant : présentation de l'équipe BEORN, périmètre, planning d'initialisation, modalités de collaboration
- Mise en place de l'environnement de travail BEORN : outils de suivi (Jira), dépôts de code (GitLab), espaces de documentation (Confluence)
- Ouverture des accès aux environnements (développement, recette, pré-production, production) pour chacune des trois applications
- Rédaction du **plan d'initialisation détaillé** : jalons par phase, responsables, critères d'achèvement, planning des ateliers de la phase 2

**Livrable** : plan d'initialisation validé par le CNC.

#### Phase 2 : Ateliers et montée en compétence (semaines 2-3)

Cette phase s'appuie sur la présence dans l'équipe BEORN de **Thomas Tsé** (développeur de cnc.fr V2 et Garance) et de **Benjamin Bini** (ex-pilote de la TMA CNC chez Sully Group), qui accélèrent le transfert de connaissances en interne.

**Ateliers de passation avec le prestataire sortant :**

| Atelier                      | Participants                          | Contenu                                                                                      |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Intranet Liferay 6.2**     | Lead dev + architecte BEORN + sortant | Architecture, modules custom, SSO CAS/AD, points de fragilité, procédures de déploiement     |
| **cnc.fr V2 Liferay 7.4**    | Équipe dev BEORN + sortant            | Architecture V2, composants développés, Search Blueprints, pipeline CI/CD, choix techniques  |
| **Garance Liferay 7.4**      | Équipe dev BEORN + sortant            | Architecture Docker, intégration Axiell Collections, spécificités post-lancement             |
| **Infrastructure et DevOps** | Architecte BEORN + sortant            | Environnements AWS, configuration réseau, procédures de déploiement, monitoring, sauvegardes |

**En parallèle :**

- Thomas Tsé conduit des sessions de transfert interne à l'équipe BEORN sur le code cnc.fr V2 et Garance (architecture, patterns, points d'attention)
- Documentation des connaissances tacites non couvertes par la documentation existante (DAT, DEX)
- Prise en main des outils de suivi existants et de l'historique des tickets

**Livrable** : comptes-rendus d'ateliers, base de connaissances initiale dans Confluence.

#### Phase 3 : Prise en charge progressive des sujets (semaines 3-5)

BEORN commence à traiter les demandes du CNC en conditions réelles, avec un filet de sécurité :

- **Prise en charge des tickets correctifs** : les premiers tickets sont traités par l'équipe BEORN, avec relecture croisée et validation par Thomas Tsé (pour V2 et Garance) et l'architecte (pour l'intranet)
- **Montée en autonomie progressive** : l'équipe passe de tickets simples (anomalies mineures, paramétrage) à des sujets plus complexes (corrections impliquant plusieurs composants, évolutions de Search Blueprints)
- **Sollicitation du sortant si nécessaire** : durant cette phase, le prestataire sortant reste disponible pour répondre aux questions ponctuelles, conformément au protocole de recouvrement
- **Constitution du plan de résorption** des anomalies résiduelles identifiées, priorisé avec le CNC

**Livrable** : premiers tickets traités et clos, plan de résorption des anomalies résiduelles.

#### Phase 4 : Audit technique et transfert de responsabilité (semaines 5-7)

Fort de la connaissance acquise en phases 2 et 3, BEORN conduit un **audit technique approfondi** de chaque application :

| Application                              | Points d'audit prioritaires                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Intranet** (Liferay EE 6.2)            | État du code, modules custom, configuration SSO CAS/AD, périmètre fonctionnel réel, plan de migration                 |
| **cnc.fr V2** (Liferay 7.4 / PostgreSQL) | État post-mise en production, anomalies résiduelles, dette technique, évaluation de la réutilisabilité des composants |
| **Garance** (Liferay 7.4 / Docker)       | Architecture Docker, intégration Axiell Collections, état post-ouverture au public                                    |

L'audit produit pour chaque application : un **rapport d'état technique**, une liste des anomalies résiduelles et leur priorisation, et une **cartographie des risques** à court terme.

**Rédaction de la convention de service** : niveaux de service par application, indicateurs, règles de calcul, procédures de signalement. Ce document est soumis au CNC pour validation avant la fin de l'initialisation.

**Fin du recouvrement** avec le prestataire sortant : BEORN prend la responsabilité opérationnelle de l'ensemble du périmètre. Le prestataire sortant n'est plus sollicité.

> L'audit permettra d'émettre des recommandations d'améliorations. Nous envisageons par exemple de proposer l'intégration de l'intranet au sein de cnc.fr V2 via la **fonction multisite native de Liferay**.
> Cette architecture offre :
>
> - Un **cloisonnement total** des données et des utilisateurs entre le site public et l'intranet (groupes et organisations distincts, droits indépendants)
> - Une **infrastructure mutualisée** : une seule instance à maintenir, une seule chaîne de mise à jour, une économie sur les licences Liferay
> - Une **résolution élégante du problème Liferay 6.2** (version hors support) sans projet de migration ad hoc
> - cnc.fr V2 étant en production au démarrage du marché, BEORN peut capitaliser sur les composants existants (fragments, structures, templates) pour accélérer cette consolidation. L'approche serait très similaire à celle présentée dans le cas d'école en partie 2, avec les adaptations nécessaires identifiées lors de l'audit initial.
> - Cette consolidation peut être planifiée comme un projet agile dans le cadre d'un marché subséquent, avec une priorité à définir avec le CNC. Elle ne constitue pas un prérequis à la prise en TMA, l'intranet en Liferay 6.2 sera maintenu en l'état le temps nécessaire.

**Livrables** : rapports d'audit technique (3 applications), convention de service, recommandations d'amélioration.

#### Phase 5 : Conclusion et démarrage TMA (semaine 8)

- Validation de la **Mise en Ordre de Marche (MOM)** avec le CNC : présentation des livrables, bilan de la phase d'initialisation, validation de la capacité opérationnelle
- Remise du **Plan d'Assurance Qualité (PAQ)** définitif et du **Plan d'Assurance Sécurité (PAS)**
- **Premier COPROJ opérationnel** : revue des premiers tickets traités, présentation du tableau de bord qualité, planning des premières évolutions
- **TMA pleinement opérationnelle** sur les trois applications, avec engagements SLA activés

---

### Phase de réversibilité

En fin de marché, BEORN s'engage sur une réversibilité complète conforme au CCTP :

> **Durée maximale** : 3 mois de transfert de compétences + 1 mois d'assistance technique

**Livrables de réversibilité :**

| Livrable                                 | Contenu                                                               |
| ---------------------------------------- | --------------------------------------------------------------------- |
| DAT, MCD, MPD                            | Mis à jour et reflétant l'état réel des applications en fin de marché |
| Spécifications générales et détaillées   | À jour, aux formats Microsoft Office modifiables                      |
| Plan de tests                            | Stratégie, plans unitaires, d'intégration et de non-régression        |
| PAQ, sources, DEX, manuel d'exploitation | Complets et opérationnels                                             |
| Dossier d'installation                   | Procédures automatisées et vérifiées                                  |

**Déroulement :**

1. Notification de fin de marché → déclenchement du plan de réversibilité
2. Sessions de passation avec le prestataire entrant (jusqu'à 3 mois)
3. Remise de l'ensemble des livrables documentaires
4. Mois d'assistance technique en parallèle du démarrage du successeur

> BEORN s'engage à une réversibilité sans rétention d'information, dans l'intérêt du CNC et conformément au principe de continuité de service.

/newpage

## 1.3. Modalités de prise en charge et de suivi des demandes de maintenance corrective

### Cycle de traitement d'une anomalie

Chaque demande de maintenance corrective suit un processus structuré, entièrement tracé dans Jira :

<div style="display:flex;align-items:center;gap:0;margin:16px 0;">
    <div style="flex:1;text-align:center;padding:12px 8px;background:rgba(51,115,179,0.06);border:1px solid #3373b3;border-radius:12px;font-size:8.5pt;font-weight:600;">
      <span style="display:block;font-family:'Montserrat',sans-serif;font-size:16pt;font-weight:800;color:#3373b3;margin-bottom:4px;">1</span>Signalement
    </div>
    <div style="flex-shrink:0;width:24px;text-align:center;color:#718096;font-size:14pt;line-height:1;">→</div>
    <div style="flex:1;text-align:center;padding:12px 8px;background:rgba(51,115,179,0.06);border:1px solid #3373b3;border-radius:12px;font-size:8.5pt;font-weight:600;">
      <span style="display:block;font-family:'Montserrat',sans-serif;font-size:16pt;font-weight:800;color:#3373b3;margin-bottom:4px;">2</span>Qualification
    </div>
    <div style="flex-shrink:0;width:24px;text-align:center;color:#718096;font-size:14pt;line-height:1;">→</div>
    <div style="flex:1;text-align:center;padding:12px 8px;background:rgba(51,115,179,0.06);border:1px solid #3373b3;border-radius:12px;font-size:8.5pt;font-weight:600;">
      <span style="display:block;font-family:'Montserrat',sans-serif;font-size:16pt;font-weight:800;color:#3373b3;margin-bottom:4px;">3</span>Diagnostic
    </div>
    <div style="flex-shrink:0;width:24px;text-align:center;color:#718096;font-size:14pt;line-height:1;">→</div>
    <div style="flex:1;text-align:center;padding:12px 8px;background:rgba(51,115,179,0.06);border:1px solid #3373b3;border-radius:12px;font-size:8.5pt;font-weight:600;">
      <span style="display:block;font-family:'Montserrat',sans-serif;font-size:16pt;font-weight:800;color:#3373b3;margin-bottom:4px;">4</span>Correction
    </div>
    <div style="flex-shrink:0;width:24px;text-align:center;color:#718096;font-size:14pt;line-height:1;">→</div>
    <div style="flex:1;text-align:center;padding:12px 8px;background:rgba(51,115,179,0.06);border:1px solid #3373b3;border-radius:12px;font-size:8.5pt;font-weight:600;">
      <span style="display:block;font-family:'Montserrat',sans-serif;font-size:16pt;font-weight:800;color:#3373b3;margin-bottom:4px;">5</span>Recette
    </div>
    <div style="flex-shrink:0;width:24px;text-align:center;color:#718096;font-size:14pt;line-height:1;">→</div>
    <div style="flex:1;text-align:center;padding:12px 8px;background:rgba(0,150,174,0.08);border:1px solid #0096ae;border-radius:12px;font-size:8.5pt;font-weight:600;">
      <span style="display:block;font-family:'Montserrat',sans-serif;font-size:16pt;font-weight:800;color:#0096ae;margin-bottom:4px;">6</span>Cloture
    </div>
  </div>

**1. Signalement** : le CNC ouvre un ticket Jira (ou par téléphone/email, immédiatement transcrit dans Jira par BEORN). Chaque ticket comprend : description, environnement, captures d'écran, criticité proposée.

**2. Accusé de réception et qualification** : BEORN confirme la réception, valide ou ajuste la criticité, et communique le délai d'intervention prévisionnel, dans les délais SLA ci-dessous.

**3. Diagnostic et correction** : prise en charge technique, correction développée sur branche Git dédiée, tests unitaires.

**4. Livraison** : déploiement en environnement de recette, procédure d'installation transmise au CNC

**5. Recette** : Tests par les équipes du CNC. En cas d'anomalie

**5. Clôture** : déploiement en production après validation CNC, clôture du ticket avec rapport de résolution, mise à jour de la documentation si nécessaire.

---

### Classification des anomalies

| Niveau       | Définition                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Bloquant** | Arrêt complet de l'application ou d'une fonctionnalité, sans solution de contournement, ou perte de données |
| **Majeur**   | Fonctionnement partiel, contournement possible mais performances dégradées, données erronées                |
| **Mineur**   | Anomalie n'affectant pas significativement le fonctionnement, impact ergonomique ou cosmétique              |

### Délais de rétablissement (SLA_MCO)

Les délais ci-dessous sont conformes aux exigences du CCTP. Ils couvrent l'intégralité du cycle : prise en compte, diagnostic, correction et livraison en recette. Ils sont déclenchés à l'envoi du signalement de l'anomalie par le CNC.

**Intranet (Liferay 6.2) :**

| Niveau       | Délai de rétablissement |
| ------------ | ----------------------- |
| **Bloquant** | ≤ **2 jours ouvrés**    |
| **Majeur**   | ≤ **5 jours ouvrés**    |
| **Mineur**   | ≤ **10 jours ouvrés**   |

**cnc.fr V2 et Garance (Liferay 7.4) :**

| Niveau       | Délai de rétablissement |
| ------------ | ----------------------- |
| **Bloquant** | ≤ **1 jour ouvré**      |
| **Majeur**   | ≤ **2 jours ouvrés**    |
| **Mineur**   | ≤ **10 jours ouvrés**   |

Les délais plus courts pour cnc.fr et Garance reflètent l'exposition publique de ces applications et la criticité associée.

### Support fonctionnel et technique (hotline)

BEORN met à disposition une assistance téléphonique et par email, disponible les jours ouvrés de 9h à 18h. Les délais de réponse sont conformes au CCTP :

| Catégorie de la demande | Délai de réponse     |
| ----------------------- | -------------------- |
| **Bloquante / urgente** | ≤ **0,5 jour ouvré** |
| **Majeure**             | ≤ **1 jour ouvré**   |
| **Mineure**             | ≤ **2 jours ouvrés** |

**Plages horaires** : lundi au vendredi, 9h00–13h00 et 14h00–18h00, hors jours fériés, conformément au CCTP.

**Pour les anomalies bloquantes** : intervention immédiate sans devis préalable. Un rapport de clôture détaillé est transmis sous 48h ouvrées.

En dehors des plages horaires, un mécanisme d'astreinte peut être activé sur demande du CNC pour les applications à fort impact public (cnc.fr, Garance).

---

### Canaux de contact

- **Téléphone dédié** : ligne directe vers le chef de projet BEORN, disponible 9h–18h (jours ouvrés)
- **Jira** : canal principal pour les anomalies de niveau majeur et mineur
- **Email** : en complément, accusé de réception automatique dans Jira

---

### Suivi et reporting

- **Tableau de bord Jira en temps réel** : état de chaque ticket, délais, responsable, historique
- **Rapport correctif mensuel** (transmis avant chaque COPROJ) : tickets ouverts, résolus, en cours, délais réels vs. engagés, analyse des anomalies récurrentes
- **Analyse des tendances** : identification des zones de fragilité applicative et recommandations proactives (refactoring, montée de version, correction de dette technique)

---

### Méthodologie de chiffrage du forfait MCO corrective

Le CCTP demande que le candidat précise sa méthodologie de chiffrage du forfait MCO pour les nouvelles applications (cnc.fr V2, Garance) dont l'historique d'anomalies n'est pas encore constitué.

**Approche BEORN :**

La méthodologie repose sur trois sources combinées :

**1. Expérience directe du périmètre CNC**
Notre responsable de marché, Benjamin Bini, a assuré la TMA des applications CNC pendant trois ans chez Sully Group. Il dispose d'une connaissance concrète du volume et de la nature des anomalies rencontrées sur l'intranet et cnc.fr : **quelques dizaines d'anomalies par an** sur l'ensemble du périmètre, principalement de niveau mineur à majeur.

**2. Ratios empiriques par type d'application Liferay**
BEORN dispose de données statistiques issues de ses contrats TMA actifs (ECHR, Delta Plus, Arkolia, APCA) permettant d'établir des ratios de charge corrective par type d'application :

| Type d'application                               | Anomalies estimées/an | Charge estimée/anomalie | Charge annuelle corrective |
| ------------------------------------------------ | --------------------- | ----------------------- | -------------------------- |
| Intranet (Liferay 6.2, ~500 utilisateurs)        | 10–15                 | 0,5–1 j                 | 5–15 j                     |
| Site internet public (Liferay 7.4, 1,5M visites) | 15–20                 | 1–2 j                   | 20–35 j                    |
| Portail spécialisé (Garance)                     | 15–20                 | 1–2 j                   | 20–35 j                    |

Ces estimations portent sur la charge de développement corrective. Le forfait annuel inclut également le pilotage (suivi des tickets, qualification, reporting), l'expertise technique (diagnostic des anomalies complexes, revues de code) et la supervision par le responsable de marché, conformément à la décomposition par profil détaillée dans le BPU.

**3. Hypothèses par application**

**Intranet** : application mature avec un périmètre fonctionnel stabilisé et un volume d'anomalies faible. La charge est estimée à environ **10 j/an** (développement + pilotage), stable sur la durée du marché.

**cnc.fr V2** : application en production récente (refonte réalisée par le prestataire sortant). La première année de TMA correspond à une **phase de rodage post-lancement** qui génère un volume d'anomalies significativement supérieur : corrections résiduelles, ajustements post-production, stabilisation des composants. BEORN prévoit une charge renforcée en Année 1, puis une réduction importante dès l'Année 2 une fois le patrimoine stabilisé, avec une dégressivité annuelle ensuite.

**Garance** : en production depuis décembre 2025, l'application aura bénéficié de plus d'un an de stabilisation au démarrage du marché. La charge est estimée à un niveau comparable à cnc.fr V2 en régime de croisière dès l'Année 1.

**Dégressivité** : conformément à la demande du CCTP, les prix MCO intègrent une dégressivité annuelle reflétant les gains de productivité liés à la montée en connaissance du patrimoine applicatif et à la résorption progressive de la dette technique.

Cette méthodologie transparente sera présentée au CNC lors de la phase d'initialisation pour validation et ajustement en fonction des premiers mois d'observation.

## 1.4. Modalités de prise en charge et de suivi des demandes de maintenance évolutive

### Processus de traitement d'une demande d'évolution

```
Demande CNC → Analyse → Devis → Validation BC → Réalisation agile → Livraison → Clôture
```

**1. Réception et analyse** : chaque demande d'évolution est réceptionnée via Jira et qualifiée par le chef de projet BEORN : périmètre fonctionnel, complexité technique, dépendances, impact sur les autres applications du périmètre.

**2. Production du devis** : BEORN s'engage à produire le devis dans les délais suivants, conformes aux engagements SLA du marché :

| Type d'évolution                               | Délai de remise du devis |
| ---------------------------------------------- | ------------------------ |
| Évolution simple (≤ 3 jours de charge)         | ≤ 5 jours ouvrés         |
| Évolution complexe (atelier de cadrage requis) | ≤ 10 jours ouvrés        |

Le devis précise : description de la solution retenue, charge estimée par profil, planning prévisionnel, livrables, et hypothèses retenues.

**3. Validation et bon de commande** : le CNC valide le devis par émission d'un bon de commande. Aucune réalisation ne démarre sans BC signé.

**4. Réalisation** : les évolutions sont développées selon un mini-cycle agile (cf. §2, Méthodologie agile) : spécification, développement, tests unitaires et d'intégration, livraison en recette.

**5. Livraison et clôture** : déploiement en recette, validation CNC, déploiement en production avec procédure d'installation. Clôture Jira avec rapport d'activité détaillé (RAD) transmis sous 48h.

---

### Priorisation des évolutions

En cas de concurrence entre plusieurs demandes, la priorisation s'établit selon la matrice suivante, co-validée avec le CNC lors du COPROJ bimensuel :

1. **Anomalies bloquantes et majeures** : priorité absolue sur les évolutions
2. **Évolutions liées aux jalons contractuels** (ex. ouverture Garance, évolutions post-production V2)
3. **Évolutions à fort impact métier** (demandées par les chefs de projet SOSI)
4. **Évolutions standard** : planifiées dans le backlog

Le backlog d'évolutions est visible en permanence dans Jira par le CNC, avec statut, priorité et planning prévisionnel.

---

### Gestion de la recette et de la qualité

Chaque évolution livrée fait l'objet d'une phase de recette structurée avant mise en production :

- **Recette technique BEORN** : tests unitaires (couverture minimale 50% conformément au CCTP), tests d'intégration, vérification de non-régression sur les fonctionnalités adjacentes
- **Recette fonctionnelle CNC** : mise à disposition en environnement de recette, support BEORN pendant la phase de validation client (réponse aux questions dans la journée)
- **Rapport de livraison** : note de version, procédure de déploiement, points de vigilance, documentation mise à jour

Pour les évolutions touchant des composants accessibles au public (cnc.fr, Garance), une vérification RGAA des composants modifiés est systématiquement incluse dans la recette BEORN.

### Procédure d'installation automatisée

Chaque livraison est accompagnée d'une **procédure d'installation automatisée** permettant un déploiement reproductible sur les différents environnements du CNC (recette, intégration, production). Les scripts d'installation sont versionnés dans GitLab, testés sur l'environnement de développement BEORN avant livraison, et documentés dans le package de livraison. La procédure affiche le numéro de version du package conformément aux exigences de traçabilité.

### Environnements de développement et d'intégration continue

BEORN met en place et maintient pour chacune des applications du marché :

- **Un environnement de développement** à l'image de l'environnement de recette du CNC, hébergé sur l'infrastructure BEORN (AWS)
- **Une plateforme d'intégration continue** avec pipeline CI/CD (GitLab CI) comprenant : compilation, analyse statique (SonarQube), tests unitaires et d'intégration, scan de sécurité des dépendances

Ces environnements sont opérationnels dès la fin de la phase d'initialisation et maintenus à jour tout au long du marché. Les licences et matériels nécessaires sont à la charge de BEORN.

---

### Suivi des évolutions en cours

Le tableau de bord Jira dédié aux évolutions expose en temps réel :

- Les demandes en attente de devis
- Les devis transmis en attente de validation CNC
- Les évolutions en cours de réalisation (avec avancement sprint)
- Les évolutions livrées en recette
- L'historique complet avec RAD associés

Ce tableau est présenté et commenté lors de chaque COPROJ bimensuel, permettant au CNC d'avoir une vision prospective sur les charges à venir et d'arbitrer les priorités si nécessaire.

---

### Abaques de chiffrage Liferay

BEORN dispose d'abaques de chiffrage issus de 18 ans d'expérience sur les projets Liferay, permettant une estimation rapide et fiable :

| Type de développement                        | Charge estimée             |
| -------------------------------------------- | -------------------------- |
| Fragment/portlet Liferay (standard)          | 1 à 3 j                    |
| Template de structure/affichage (FreeMarker) | 0,5 à 2 j                  |
| Composant React côté frontend                | 2 à 5 j                    |
| Intégration API REST entrante/sortante       | 2 à 5 j                    |
| Migration de contenu (script + validation)   | 1 à 4 j selon volume       |
| Évolution Search Blueprint (Elasticsearch)   | 1 à 3 j                    |
| Mise en accessibilité RGAA d'un composant    | 0,5 à 2 j selon complexité |

Ces abaques sont présentés au CNC lors de l'initialisation pour validation et adaptation au contexte des applications du périmètre.

## 1.5. Modalités de suivi et de mise en œuvre de la maintenance adaptative

### Veille technologique Liferay

BEORN assure une veille active et continue sur l'évolution de la plateforme Liferay, via :

- **Abonnement aux canaux officiels Liferay** : notes de version, bulletins de sécurité, roadmap produit
- **Relation partenaire Liferay** (partenariat commercial depuis 2018) : accès aux informations anticipées sur les versions à venir et aux advisory de sécurité
- **Communauté Liferay** : forums, JIRA public Liferay, conférences Liferay Symposium

Chaque bulletin de sécurité ou release Liferay est analysé dans un délai de **5 jours ouvrés** pour évaluer l'impact sur les applications du périmètre CNC. Le résultat de cette analyse est communiqué au CNC avec une recommandation d'action.

---

### Traitement des versions mineures et patches correctifs

| Type                                            | Délai d'analyse   | Délai d'application                       |
| ----------------------------------------------- | ----------------- | ----------------------------------------- |
| Patch de sécurité critique (CVE haute sévérité) | ≤ 2 jours ouvrés  | ≤ 5 jours ouvrés après validation CNC     |
| Patch correctif standard                        | ≤ 5 jours ouvrés  | Planifié au prochain COPROJ               |
| Version mineure (ex. 7.4.x → 7.4.x+1)           | ≤ 10 jours ouvrés | Sur bon de commande, planifié avec le CNC |

Chaque application de patch suit un processus systématique : environnement de développement → recette → validation CNC → production. Les procédures d'installation sont documentées et livrées avec chaque mise à jour.

---

### Versions majeures : méthodologie

La mise en œuvre d'une version majeure Liferay (ex. 7.4 → une future version) suit un projet structuré :

1. **Analyse d'impact** : audit de compatibilité des modules custom, des thèmes, des intégrations (SSO, API, Elasticsearch)
2. **Environnement de migration dédié** : fork du dépôt GitLab, environnement isolé
3. **Migration progressive** : par application, en commençant par l'intranet (périmètre utilisateurs le plus maîtrisé)
4. **Tests de non-régression complets** avant toute mise en production
5. **Formation des administrateurs CNC** si évolutions significatives de l'interface

---

### Cas particulier : Intranet en Liferay EE 6.2

L'intranet du CNC fonctionne actuellement sous Liferay EE 6.2, dont le support étendu est terminé. BEORN prend en charge ce risque avec une double approche :

**Court terme, maintien en condition de sécurité** :

- Surveillance active des vulnérabilités affectant Liferay 6.2 via les bases CVE publiques
- Application de correctifs de sécurité au niveau OS, JVM et dépendances tierces (indépendamment des patches Liferay officiels)
- Durcissement de la configuration (headers HTTP, TLS, politique CSP)

**Moyen terme, migration recommandée** :
BEORN propose au CNC de planifier la **consolidation de l'intranet sur l'instance Liferay 7.4** hébergeant cnc.fr V2 (désormais en production), via la **fonction multisite native** de Liferay. Cette architecture permet :

- Un cloisonnement total des données et utilisateurs (intranet vs. site public)
- Une infrastructure unifiée, plus simple à maintenir et à sécuriser
- L'élimination du risque Liferay 6.2 sans création d'une instance supplémentaire

Cette consolidation peut être conduite comme un projet agile dans le cadre d'un marché subséquent, sur un horizon de 6 à 12 mois après le démarrage de la TMA. Elle ne bloque pas la prise en charge corrective et évolutive de l'intranet en Liferay 6.2 dans l'intervalle.
