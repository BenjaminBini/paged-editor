---
type: memoire-section
title: "Mémoire technique — TMA Liferay CNC (Marché n°2026028)"
ao_ref: "2026028"
acheteur: "Centre National du Cinéma et de l'Image Animée (CNC)"
section_id: ch5_environnement
status: final
max_pages: 3
---

# 5. Qualité environnementale

## 5.1. Préambule et positionnement

BEORN Technologies intègre la qualité environnementale comme un levier opérationnel de performance, au même titre que la qualité logicielle ou la maîtrise des délais. Cette approche n’est pas déclarative. Elle est mise en œuvre dans nos pratiques quotidiennes, mesurée et pilotée dans la durée.

Sur les quatre dernières années, BEORN a réduit son empreinte carbone de 76 %. Cette trajectoire repose sur des actions concrètes et continues, appliquées à l’ensemble de nos activités, dont les prestations de TMA.

Dans le cadre du marché CNC, cette démarche se traduit par des engagements directement activables dès le démarrage. Ils couvrent l’ensemble du cycle de vie de la prestation, depuis les environnements techniques jusqu’aux pratiques de développement.

Notre approche repose sur six axes opérationnels :

- gestion des équipements en fin de vie
- maîtrise des consommations énergétiques
- durabilité des actifs matériels et logiciels
- mobilité et pratiques internes
- formation des équipes
- écoconception des services numériques

Cette démarche s’inscrit dans le cadre de la loi relative à la réduction de l’empreinte environnementale du numérique et dans l’application du référentiel RGESN.

---

## 5.2. Gestion des déchets d'équipements électriques et électroniques (DEEE)

### Contexte et enjeux

Les équipements numériques représentent une part significative des impacts environnementaux d’une activité de services. L’enjeu principal consiste à allonger leur durée d’usage et à garantir une fin de vie tracée.

### Parc matériel dédié à la TMA

Le parc BEORN est composé à 95 % de matériel reconditionné. Sur le périmètre CNC, cet engagement est porté à 100 %.

Les postes utilisés sont principalement des MacBook Pro, sélectionnés pour leur durabilité, leur réparabilité et leur compatibilité avec les cycles longs d’exploitation.

Les engagements appliqués au marché sont les suivants :

- durée de détention cible de 5 ans pour chaque équipement
- aucun remplacement anticipé hors défaillance constatée
- orientation systématique vers des filières de reprise constructeur ou éco-organismes agréés
- traçabilité complète du cycle de vie via un registre de parc transmis annuellement
- recours prioritaire à des équipements reconditionnés certifiés en cas de renfort

Les équipements sortis du périmètre de production sont réaffectés, revendus ou confiés à des partenaires spécialisés. Aucun matériel n’est éliminé sans traçabilité.

---

## 5.3. Maîtrise de la consommation électrique

### Infrastructures cloud (AWS)

Les environnements Liferay sont hébergés sur AWS, ce qui permet d’agir directement sur les consommations.

Les mesures mises en œuvre sont les suivantes :

Les environnements hors production sont arrêtés automatiquement en dehors des plages d’utilisation. Cette règle est appliquée dès la mise en service des environnements. Elle permet une réduction de consommation estimée entre 60 et 70 %.

Les environnements non critiques sont positionnés dans des régions AWS présentant un mix énergétique plus favorable lorsque cela est compatible avec les contraintes du projet.

Un suivi trimestriel de l’empreinte carbone est produit à partir des données AWS et partagé au CNC avec analyse des écarts et des leviers d’amélioration.

### Postes de travail

Les postes de travail sont configurés pour limiter les consommations inutiles :

- mise en veille automatique rapide
- suppression des processus graphiques non utiles
- optimisation des cycles de build
- limitation des exécutions CI/CD aux cas nécessaires

Ces règles sont appliquées de manière systématique sur les environnements BEORN.

---

## 5.4. Durabilité et recyclabilité

### Durabilité logicielle

La durabilité logicielle est traitée comme un sujet structurant dès le démarrage du marché.

Un audit initial permet d’identifier les composants obsolètes, les dépendances non maintenues et les zones de dette technique. Un plan de traitement est ensuite intégré dans la trajectoire de maintenance.

Chaque évolution respecte des règles simples :

- aucune dépendance non maintenue n’est introduite
- les composants sont sélectionnés sur des critères d’activité réelle
- chaque développement est documenté pour garantir sa reprise

Cette approche permet de limiter la dérive technique et d’éviter l’accumulation de complexité.

### Durabilité matérielle

Les équipements utilisés sur le marché respectent les principes suivants :

- recours exclusif au reconditionné sur le périmètre CNC
- maintien en exploitation sur une durée longue
- limitation stricte des renouvellements

---

## 5.5. Mobilité durable et réduction des déchets

### Mobilité

BEORN applique une politique de mobilité structurée :

- prise en charge intégrale des transports en commun
- incitation au covoiturage et aux mobilités douces
- mise en place du forfait mobilités durables
- limitation des déplacements longue distance lorsque des alternatives existent

Les déplacements sur site sont regroupés afin de limiter leur fréquence.

### Déchets du quotidien

Les pratiques internes sont alignées avec une logique de réduction :

- suppression des consommables à usage unique
- limitation des impressions
- tri systématique des déchets
- recours à des fournitures responsables

Ces actions sont suivies dans le cadre du pilotage interne.

---

## 5.6. Formation et sensibilisation au numérique responsable

### Formation des intervenants

Tous les intervenants affectés au marché suivent une formation au numérique responsable avant leur intervention.

Cette formation couvre les impacts environnementaux du numérique et les bonnes pratiques applicables en projet.

Les attestations sont disponibles dès le démarrage.

### Référent dédié

Un référent numérique responsable est identifié dans l’équipe projet.

Il assure le suivi des engagements, prépare les points de suivi et propose les ajustements nécessaires en cours de marché.

Un point dédié est intégré dans les comités de suivi.

---

## 5.7. Écoconception des services numériques

### Référentiel appliqué

Les développements s’appuient sur le référentiel RGESN.

Ce cadre permet d’intégrer l’écoconception dans les pratiques courantes sans complexifier les processus.

### Mise en œuvre concrète

Les principes appliqués sont les suivants :

Les performances des interfaces sont mesurées à chaque livraison. Un niveau minimum est exigé pour valider une mise en production.

Les composants inutiles sont supprimés afin de limiter la charge serveur.

Les contenus sont optimisés avant intégration.

Les fonctionnalités sont développées uniquement lorsqu’elles sont nécessaires. Cette discipline permet de limiter le volume de code et les impacts associés.

Les mécanismes techniques sont choisis pour éviter les traitements inutiles côté serveur.

Les environnements d’intégration continue sont optimisés pour limiter les traitements redondants.

---

## 5.8. Bilan carbone et trajectoire

BEORN suit son empreinte carbone dans le temps.

Sur quatre ans, la réduction constatée est de 76 %.

Cette évolution résulte d’actions cumulées sur les infrastructures, les équipements, les pratiques internes et les modes de travail.

Un suivi annuel est maintenu et partagé dans le cadre du marché.

---

## 5.9. Synthèse des engagements

| Axe           | Engagement                                   | Indicateur                 |
| ------------- | -------------------------------------------- | -------------------------- |
| DEEE          | Filières agréées et traçabilité complète     | Registre annuel            |
| Énergie       | Extinction des environnements non productifs | Reporting trimestriel      |
| Logiciel      | Réduction de la dette technique              | Suivi des composants       |
| Formation     | Sensibilisation des équipes                  | Attestations               |
| Écoconception | Application du RGESN                         | Indicateurs de performance |
| Mobilité      | Réduction des déplacements                   | Suivi interne              |

---

## Conclusion

L’approche environnementale de BEORN repose sur des actions concrètes, activables immédiatement et suivies dans le temps.

Elle contribue directement à la performance globale du projet en limitant les consommations, en réduisant la complexité technique et en améliorant la maintenabilité.

Un système plus sobre est plus simple à exploiter, plus stable et plus durable. C’est dans cette logique que s’inscrit notre proposition pour le CNC.
