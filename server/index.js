// server/index.js — Standalone paged-editor server
//
// Usage:
//   WORKSPACE=/path/to/folder node index.js
//   WORKSPACE=/path/to/file.md  node index.js
//
// For embedding in an existing Express app, use the router directly:
//
//   import { createEditorRouter } from "@paged-editor/server/router.js";
//   app.use("/editor", createEditorRouter({ workspace: "/path/to/folder" }));

import express from "express";
import cors from "cors";
import { resolve } from "node:path";
import { createEditorRouter } from "./router.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const WORKSPACE = resolve(process.env.WORKSPACE || process.cwd());

const app = express();
app.use(cors());
app.use(createEditorRouter({ workspace: WORKSPACE }));

app.listen(PORT, () => {
  console.log(`Paged Editor server running at http://localhost:${PORT}`);
  console.log(`Workspace: ${WORKSPACE}`);
});
