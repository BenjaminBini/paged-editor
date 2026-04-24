// container-registry.ts — Single source of truth for custom markdown features
// supported by the paged-editor renderer (alerts, block containers, layout
// fences, visualization fences).
//
// Consumers:
//   1. section-pipeline.ts — derives `MD_ALERT_KINDS` + `MD_KNOWN_CONTAINERS`
//      from this registry (runtime dispatch).
//   2. scripts/emit-markdown-features.mjs — serializes the registry to
//      `dist/markdown-features.json` at build time. Downstream tools (like
//      the ao-analyst plugin) consume this JSON to teach their agents which
//      directives exist without manually duplicating the list.
//
// Rendering logic stays in section-pipeline.ts. This file only describes the
// author-facing contract (name, syntax, example) — nothing runtime-critical
// beyond the name sets.
//
// When adding a new container:
//   1. Implement the renderer in section-pipeline.ts.
//   2. Add a spec entry below.
//   3. Run `npm run build` — the JSON manifest updates automatically.

export type ContainerKind =
  | "alert" // :::info, :::warning, etc. — six fixed variants
  | "block" // :::stat-tiles, :::quote, :::timeline, etc.
  | "layout-fence" // ```ao-grid …``` — code-fenced layout container
  | "visualization-fence"; // ```mermaid …```, ```echarts …```

export interface ContainerAttribute {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

export interface ContainerSpec {
  readonly name: string;
  readonly kind: ContainerKind;
  /** One-line human description, French. */
  readonly description: string;
  /** Optional per-line syntax for body lines (e.g. stat-tiles, numbered-grid). */
  readonly lineSyntax?: string;
  /** Inner directives authored inside the container (e.g. `card`, `step`, `col-N`). */
  readonly innerDirectives?: readonly string[];
  /** Attributes set on the opening line (e.g. `author="…"` on :::quote). */
  readonly attributes?: readonly ContainerAttribute[];
  /** Canonical markdown example showing the happy path. */
  readonly example: string;
}

const ALERT_VARIANTS = [
  { name: "info", description: "Encadré d'information générale." },
  { name: "warning", description: "Encadré d'avertissement (point d'attention)." },
  { name: "danger", description: "Encadré de risque / point bloquant." },
  { name: "success", description: "Encadré de succès / validation positive." },
  { name: "note", description: "Encadré de note complémentaire." },
  { name: "tip", description: "Encadré de conseil / bonne pratique." },
] as const;

const ALERT_SPECS: readonly ContainerSpec[] = ALERT_VARIANTS.map((v) => ({
  name: v.name,
  kind: "alert" as const,
  description: v.description,
  example: `:::${v.name}\nCorps de l'encadré. Markdown inline supporté. {src:CCTP p.14}\n:::`,
}));

const BLOCK_SPECS: readonly ContainerSpec[] = [
  {
    name: "stat-tiles",
    kind: "block",
    description: "Grille de tuiles de chiffres clés (valeur + libellé + note optionnelle).",
    lineSyntax: "VALEUR | LIBELLÉ [| NOTE]",
    example:
      ":::stat-tiles\n99,9 % | SLA garanti | {src:CCAP §4.2}\n12 | mois de déploiement\n**24/7** | Supervision continue\n:::",
  },
  {
    name: "numbered-grid",
    kind: "block",
    description:
      "Grille éditoriale de piliers auto-numérotés (01–07) avec titre et accroche.",
    lineSyntax: "TITRE | ACCROCHE",
    example:
      ":::numbered-grid\nSouveraineté | Hébergement français certifié HDS\nQualité | Démarche ISO 9001 en vigueur\nExpertise | 15 ans de pratique AO publics\n:::",
  },
  {
    name: "card-grid",
    kind: "block",
    description:
      "Grille de cartes auto-numérotées (titre + tag + puces). Utile pour détailler des prestations.",
    innerDirectives: ["card"],
    example:
      ":::card-grid\n:::card Cadrage | Phase 1\n- Audit de l'existant\n- Cadrage des besoins\n\n:::card Réalisation | Phase 2\n- Développement itératif\n- Recettes intermédiaires\n:::",
  },
  {
    name: "feature-grid",
    kind: "block",
    description:
      "Grille de fiches de fonctionnalités (titre + statut + niveau + description + illustration optionnelle). Chaque `:::feature` ouvre une fiche. Layout row (texte + image côte à côte, carte pleine largeur) ou col (empilé, demi-largeur). Layout row ignoré sans image.",
    innerDirectives: ["feature"],
    attributes: [
      { name: "title", required: true, description: "Titre de la fiche." },
      { name: "status", required: false, description: "Badge de couverture : conforme | parametrage | preciser." },
      { name: "level", required: false, description: "Niveau d'exigence : obligatoire | souhaitee | information." },
      { name: "image", required: false, description: "Chemin de l'illustration (relatif à assetBaseHref)." },
      { name: "caption", required: false, description: "Légende sous l'image." },
      { name: "layout", required: false, description: "row (côte-à-côte, pleine largeur) ou col (empilé, demi-largeur). Défaut col. Row ignoré sans image." },
    ],
    example:
      ':::feature-grid\n:::feature title="Brouillons d\'articles" status="conforme" level="obligatoire" image="assets/slides/slide-112.png" caption="Slide 112" layout="row"\nSave as draft natif sur tous les content types. Statut Draft explicite, visible uniquement par les éditeurs.\n\n:::feature title="Transfert en masse" status="preciser" level="obligatoire"\nActions groupées limitées à la suppression ; le bulk author change passe par API.\n:::',
  },
  {
    name: "heatmap",
    kind: "block",
    description:
      "Heat-matrix de cycle de vie contractuel avec jalons au-dessus. Bloc de config `key: value` puis `---` puis lignes de données.",
    lineSyntax:
      "columns: LABEL[:phase], …  /  milestones: LABEL@POS[:SUB], …  /  ---  /  Titre de ligne | T T T T …",
    example:
      ":::heatmap\ncolumns: M1, M2, M3, M4:expl, M5:expl, M6:fin\nmilestones: Kickoff@0, Recette@3:phase finale\n---\nAnalyse | X X . . . .\nRéalisation | . X X X . .\nRecette | . . . X X .\n:::",
  },
  {
    name: "quote",
    kind: "block",
    description: "Blockquote enrichie avec attribution (auteur + rôle).",
    attributes: [
      { name: "author", required: false, description: "Nom de l'auteur." },
      { name: "role", required: false, description: "Fonction / société de l'auteur." },
    ],
    example:
      ':::quote author="Y. Dupont" role="DSI de X"\nLa mission a été réalisée avec professionnalisme, dans les délais. {src:Référence-2024}\n:::',
  },
  {
    name: "timeline",
    kind: "block",
    description:
      "Timeline verticale. Chaque `:::step TITRE | MÉTA` ouvre une étape (fermeture automatique).",
    innerDirectives: ["step"],
    example:
      ":::timeline\n:::step Cadrage | 2 semaines\nAudit existant, validation hypothèses, plan détaillé.\n\n:::step Réalisation | 4 sprints\nDéveloppement itératif avec livraisons intermédiaires.\n:::",
  },
];

const LAYOUT_SPECS: readonly ContainerSpec[] = [
  {
    name: "ao-grid",
    kind: "layout-fence",
    description:
      "Bloc de code fencé (```ao-grid) définissant une grille 12 colonnes. Chaque `:::col-N` ouvre une colonne de N/12.",
    innerDirectives: ["col-N"],
    example:
      "```ao-grid\n:::col-8\n## Contexte métier\nParagraphe long avec citations {src:CCTP p.14 §3.2}.\n:::col-4\n![Schéma](assets/archi.png)\n```",
  },
];

const VIZ_SPECS: readonly ContainerSpec[] = [
  {
    name: "mermaid",
    kind: "visualization-fence",
    description:
      "Diagramme Mermaid 11 (flowchart, sequence, gantt, state, mindmap, timeline, quadrant, pie).",
    example:
      "```mermaid\nflowchart LR\n  A[Collecte] --> B[Analyse]\n  B --> C[Livraison]\n```",
  },
  {
    name: "echarts",
    kind: "visualization-fence",
    description:
      "Graphique ECharts 5 (bar, line, pie, radar, gauge, treemap, heatmap, sankey). Option JSON.",
    example:
      "```echarts\n{\n  \"xAxis\": {\"type\": \"category\", \"data\": [\"J1\",\"J2\",\"J3\"]},\n  \"yAxis\": {\"type\": \"value\"},\n  \"series\": [{\"type\": \"bar\", \"data\": [12, 18, 9]}]\n}\n```",
  },
];

export const CONTAINER_REGISTRY: readonly ContainerSpec[] = [
  ...ALERT_SPECS,
  ...BLOCK_SPECS,
  ...LAYOUT_SPECS,
  ...VIZ_SPECS,
];

/** Names of alert-kind containers (info, warning, danger, success, note, tip). */
export const MD_ALERT_KINDS: ReadonlySet<string> = new Set(
  CONTAINER_REGISTRY.filter((s) => s.kind === "alert").map((s) => s.name),
);

/** Names of all `:::name …:::` containers the parser dispatches (alerts + blocks). */
export const MD_KNOWN_CONTAINERS: ReadonlySet<string> = new Set(
  CONTAINER_REGISTRY.filter(
    (s) => s.kind === "alert" || s.kind === "block",
  ).map((s) => s.name),
);

/** Schema version of the emitted JSON manifest. Bump when ContainerSpec shape changes. */
export const MARKDOWN_FEATURES_SCHEMA_VERSION = 1;
