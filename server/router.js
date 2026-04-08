// server/router.js — Mountable Express router for paged-editor file API
//
// Usage as middleware in an existing Express app:
//
//   import express from "express";
//   import { createEditorRouter } from "@paged-editor/server/router.js";
//
//   const app = express();
//   app.use("/editor", createEditorRouter({ workspace: "/path/to/folder" }));
//   app.listen(3000);
//
// The router provides:
//   - Static file serving of the editor frontend
//   - REST API for file CRUD under /api/*
//   - Root route serving index.html

import { Router } from "express";
import express from "express";
import { readdir, readFile, writeFile, stat, unlink } from "node:fs/promises";
import { join, resolve, basename } from "node:path";

/**
 * @typedef {Object} EditorRouterOptions
 * @property {string} workspace - Absolute path to a folder or a single .md file
 * @property {string} [editorRoot] - Path to the editor static files (defaults to project root)
 */

/**
 * Creates an Express router that serves the paged-editor frontend and file API.
 *
 * @param {EditorRouterOptions} options
 * @returns {Router}
 */
export function createEditorRouter(options) {
  const { workspace } = options;
  if (!workspace) throw new Error("workspace option is required");

  const workspacePath = resolve(workspace);
  const editorRoot = options.editorRoot
    ? resolve(options.editorRoot)
    : resolve(import.meta.dirname, "..");

  const router = Router();

  // ── State (resolved lazily on first request) ─────────────────────────────

  let _resolved = false;
  let mode = "folder";
  let workDir = workspacePath;
  let singleFileName = null;

  async function ensureResolved() {
    if (_resolved) return;
    try {
      const s = await stat(workspacePath);
      if (s.isFile()) {
        mode = "file";
        workDir = resolve(workspacePath, "..");
        singleFileName = basename(workspacePath);
      }
    } catch (e) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`);
    }
    _resolved = true;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function sanitizeName(name) {
    const clean = basename(name);
    if (!clean || clean.startsWith(".") || clean !== name) return null;
    return clean;
  }

  async function listMarkdownFiles() {
    const entries = await readdir(workDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => ({ name: e.name, path: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── Middleware ────────────────────────────────────────────────────────────

  router.use(express.json({ limit: "10mb" }));

  // Serve editor static files
  router.use(express.static(editorRoot, { index: false }));

  // ── API routes ───────────────────────────────────────────────────────────

  router.get("/api/config", async (_req, res) => {
    try {
      await ensureResolved();
      res.json({
        mode,
        folderPath: "workspace",
        folderName: basename(workDir),
        singleFile: singleFileName,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/files", async (_req, res) => {
    try {
      await ensureResolved();
      if (mode === "file") {
        res.json([{ name: singleFileName, path: singleFileName }]);
      } else {
        res.json(await listMarkdownFiles());
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/files/:name/meta", async (req, res) => {
    await ensureResolved();
    const name = sanitizeName(req.params.name);
    if (!name) return res.status(400).json({ error: "Invalid filename" });

    try {
      const s = await stat(join(workDir, name));
      res.json({ modifiedAt: s.mtimeMs });
    } catch (e) {
      if (e.code === "ENOENT") return res.status(404).json({ error: "File not found" });
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/files/:name", async (req, res) => {
    await ensureResolved();
    const name = sanitizeName(req.params.name);
    if (!name) return res.status(400).json({ error: "Invalid filename" });

    try {
      const filePath = join(workDir, name);
      const [content, s] = await Promise.all([readFile(filePath, "utf-8"), stat(filePath)]);
      res.json({ content, modifiedAt: s.mtimeMs });
    } catch (e) {
      if (e.code === "ENOENT") return res.status(404).json({ error: "File not found" });
      res.status(500).json({ error: e.message });
    }
  });

  router.put("/api/files/:name", async (req, res) => {
    await ensureResolved();
    const name = sanitizeName(req.params.name);
    if (!name) return res.status(400).json({ error: "Invalid filename" });
    if (!name.endsWith(".md")) return res.status(400).json({ error: "Only .md files allowed" });

    const { content } = req.body;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Missing content field" });
    }

    try {
      const filePath = join(workDir, name);
      await writeFile(filePath, content, "utf-8");
      const s = await stat(filePath);
      res.json({ ok: true, modifiedAt: s.mtimeMs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/files", async (req, res) => {
    await ensureResolved();
    if (mode === "file") {
      return res.status(403).json({ error: "Cannot create files in single-file mode" });
    }

    const { name, content } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Missing name field" });
    }

    const clean = sanitizeName(name.endsWith(".md") ? name : name + ".md");
    if (!clean) return res.status(400).json({ error: "Invalid filename" });

    try {
      const filePath = join(workDir, clean);
      try {
        await stat(filePath);
        return res.status(409).json({ error: "File already exists" });
      } catch {
        // Expected — file doesn't exist
      }

      await writeFile(filePath, content || "", "utf-8");
      const s = await stat(filePath);
      res.status(201).json({ name: clean, path: clean, modifiedAt: s.mtimeMs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/files/:name", async (req, res) => {
    await ensureResolved();
    if (mode === "file") {
      return res.status(403).json({ error: "Cannot delete in single-file mode" });
    }

    const name = sanitizeName(req.params.name);
    if (!name) return res.status(400).json({ error: "Invalid filename" });

    try {
      await unlink(join(workDir, name));
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ENOENT") return res.status(404).json({ error: "File not found" });
      res.status(500).json({ error: e.message });
    }
  });

  // Serve index.html at the mount root
  router.get("/", (_req, res) => {
    res.sendFile(join(editorRoot, "index.html"));
  });

  return router;
}
