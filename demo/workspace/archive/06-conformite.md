# Partie 6 ● Conformité et engagements contractuels

## Protection des données personnelles (RGPD)

### Cadre contractuel

Conformément aux exigences du CSC, le traitement des données personnelles dans le cadre de l'intranet Magellan est encadré par un Accord sur le Traitement des Données (DPA) entre Bruxelles Formation (responsable de traitement) et LumApps (sous-traitant).

BEORN Technologies, en tant que revendeur (Client indirect au sens du contrat LumApps), agit dans le cadre de ce DPA et s'engage à respecter l'ensemble des obligations qui en découlent.

### Traitements identifiés par le CSC

Le CSC identifie cinq traitements de données personnelles (T1 à T5) dans le cadre de l'intranet. Les catégories de données traitées par LumApps incluent : nom, adresse, titre, numéro de téléphone, adresse email, adresse IP, noms d'utilisateur, avatar, ainsi que toute donnée téléchargée volontairement par les utilisateurs dans l'application.


### Mesures de sécurité

LumApps met en œuvre les mesures techniques et organisationnelles suivantes pour la protection des données :

| Domaine           | Mesures                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gouvernance**   | Système de Management de la Sécurité de l'Information (SMSI), processus de gestion des risques formalisé, évaluation des risques liés aux tiers |
| **Chiffrement**   | AES-256 pour les données au repos, HTTPS TLS v1.2 minimum pour les données en transit, VPN pour l'accès à distance                              |
| **Accès**         | Authentification unique aux bases de données de production (clés SSH uniques), gestion centralisée des identités                                |
| **Continuité**    | Plans de continuité d'activité et de reprise après sinistre, stratégie PRA intégrée et testée régulièrement                                     |
| **Développement** | Cycle de développement logiciel sécurisé (SDLC) formalisé, programme de bug bounty, tests de sécurité réguliers                                 |

/newpage

### Certifications

LumApps dispose des certifications et conformités suivantes :

- **ISO/IEC 27001:2022** — certificat n° 011426-04, délivré par BARR Certifications LLC, valide jusqu'au 30 octobre 2028
- **SOC 2 Type 2** — conformité attestée
- **RGPD** — conformité complète avec le Règlement Général sur la Protection des Données (UE) 2016/679
- **EU-US Data Privacy Framework** — adhésion certifiée

### Localisation des données et transferts

L'infrastructure LumApps est hébergée sur Google Cloud Platform, avec des clusters par région géographique. Pour les clients de la région EMEA, les données sont hébergées en Europe.


Le CSC exige l'absence de transfert de données personnelles en dehors de l'Union européenne. LumApps dispose de sous-traitants ultérieurs dont certains sont localisés dans l'UE et d'autres aux États-Unis. En cas de transfert vers les États-Unis, les Clauses Contractuelles Types (CCT) de la Commission européenne (décision d'exécution 2021/914) s'appliquent, ainsi que le EU-US Data Privacy Framework.


## Propriété intellectuelle

Le CSC prévoit une cession complète des droits de propriété intellectuelle sur les éléments développés dans le cadre du marché.

Il convient de distinguer :

- **La plateforme LumApps** : propriété de l'éditeur LumApps, mise à disposition sous licence SaaS. Aucune cession de PI n'intervient sur le code source de la plateforme.
- **Les développements spécifiques** réalisés par BEORN dans le cadre de l'accompagnement (configurations personnalisées, micro-apps, widgets, connecteurs sur mesure) : les droits de propriété intellectuelle sont cédés à Bruxelles Formation conformément.

## Confidentialité

BEORN Technologies et l'ensemble de ses collaborateurs intervenant sur le marché s'engagent au respect de l'obligation de confidentialité prévue par le CSC, y compris au-delà de la fin du marché.
