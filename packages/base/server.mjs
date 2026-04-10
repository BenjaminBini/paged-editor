/**
 * Node.js server helper for @benjaminbini/paged-editor.
 *
 * Exposes the absolute path to the bundled static editor assets so web
 * servers can serve them without path-hacking into node_modules.
 *
 * @example
 * ```js
 * import { editorRoot } from "@benjaminbini/paged-editor/server";
 * // Hono
 * app.use("/editor/*", serveStatic({ root: editorRoot, ... }));
 * // Express
 * app.use("/editor", express.static(editorRoot));
 * ```
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to the package root — contains index.html, js/**, css/**, assets/.
 */
export const editorRoot = dirname(fileURLToPath(import.meta.url));
