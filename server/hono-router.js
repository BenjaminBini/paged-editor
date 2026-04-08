// server/hono-router.js — Mountable Hono router for paged-editor file API
//
// Usage in an existing Hono app:
//
//   import { Hono } from "hono";
//   import { createEditorRoutes } from "@paged-editor/server/hono-router.js";
//
//   const app = new Hono();
//   app.route("/editor", createEditorRoutes({ workspace: "/path/to/folder" }));
//
// The workspace path supports Hono route param placeholders:
//
//   app.route("/projects/:id/memoire", createEditorRoutes({
//     workspace: "./projects/:id/memoire",
//   }));
//
// The router provides REST API routes for file CRUD under /files/*.
// Static file serving of the editor frontend is NOT included — mount it
// separately with serveStatic if needed.

import { Hono } from "hono";
import { readdir, readFile, writeFile, stat, unlink, mkdir } from "node:fs/promises";
import { join, resolve, basename, relative, isAbsolute } from "node:path";

/**
 * @typedef {Object} EditorRouteOptions
 * @property {string} workspace - Path to a folder (may contain :param placeholders)
 * @property {boolean} [autoCreate=true] - Create the workspace directory if it doesn't exist
 */

/**
 * Resolve :param placeholders in the workspace path from Hono route params.
 * @param {string} template
 * @param {import("hono").Context} c
 * @returns {string}
 */
function resolveWorkspace(template, c) {
  return resolve(template.replace(/:(\w+)/g, (_, name) => c.req.param(name) ?? name));
}

function sanitizeName(name) {
  const clean = basename(name);
  if (!clean || clean.startsWith(".") || clean !== name) return null;
  return clean;
}

function isWithinDir(parentDir, childPath) {
  const rel = relative(parentDir, childPath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Creates a Hono app that serves the paged-editor file API.
 *
 * @param {EditorRouteOptions} options
 * @returns {Hono}
 */
export function createEditorRoutes(options) {
  const { workspace, autoCreate = true } = options;
  if (!workspace) throw new Error("workspace option is required");

  const app = new Hono();

  /** Resolve and optionally create the workspace dir for a request. */
  async function getWorkDir(c) {
    const dir = resolveWorkspace(workspace, c);
    if (!isWithinDir(resolve("."), dir) && !isAbsolute(workspace)) return null;
    if (autoCreate) await mkdir(dir, { recursive: true });
    return dir;
  }

  // GET /config
  app.get("/config", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    return c.json({
      mode: "folder",
      folderPath: "workspace",
      folderName: basename(dir),
      singleFile: null,
    });
  });

  // GET /files
  app.get("/files", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => ({ name: e.name, path: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return c.json(files);
    } catch {
      return c.json([]);
    }
  });

  // GET /files/:name/meta — must be before /files/:name
  app.get("/files/:name/meta", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    const name = sanitizeName(c.req.param("name"));
    if (!name) return c.json({ error: "Invalid filename" }, 400);

    const filePath = join(dir, name);
    if (!isWithinDir(dir, filePath)) return c.json({ error: "Invalid path" }, 400);

    try {
      const s = await stat(filePath);
      return c.json({ modifiedAt: s.mtimeMs });
    } catch (e) {
      if (e.code === "ENOENT") return c.json({ error: "File not found" }, 404);
      return c.json({ error: "Server error" }, 500);
    }
  });

  // GET /files/:name
  app.get("/files/:name", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    const name = sanitizeName(c.req.param("name"));
    if (!name) return c.json({ error: "Invalid filename" }, 400);

    const filePath = join(dir, name);
    if (!isWithinDir(dir, filePath)) return c.json({ error: "Invalid path" }, 400);

    try {
      const content = await readFile(filePath, "utf-8");
      const s = await stat(filePath);
      return c.json({ content, modifiedAt: s.mtimeMs });
    } catch (e) {
      if (e.code === "ENOENT") return c.json({ error: "File not found" }, 404);
      return c.json({ error: "Server error" }, 500);
    }
  });

  // PUT /files/:name
  app.put("/files/:name", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    const name = sanitizeName(c.req.param("name"));
    if (!name) return c.json({ error: "Invalid filename" }, 400);

    const filePath = join(dir, name);
    if (!isWithinDir(dir, filePath)) return c.json({ error: "Invalid path" }, 400);

    const body = await c.req.json();
    if (typeof body.content !== "string") {
      return c.json({ error: "Missing content field" }, 400);
    }

    try {
      await writeFile(filePath, body.content, "utf-8");
      const s = await stat(filePath);
      return c.json({ ok: true, modifiedAt: s.mtimeMs });
    } catch {
      return c.json({ error: "Write failed" }, 500);
    }
  });

  // POST /files
  app.post("/files", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    const body = await c.req.json();
    if (!body.name || typeof body.name !== "string") {
      return c.json({ error: "Missing name field" }, 400);
    }

    const clean = sanitizeName(body.name.endsWith(".md") ? body.name : body.name + ".md");
    if (!clean) return c.json({ error: "Invalid filename" }, 400);

    const filePath = join(dir, clean);
    if (!isWithinDir(dir, filePath)) return c.json({ error: "Invalid path" }, 400);

    try {
      try {
        await stat(filePath);
        return c.json({ error: "File already exists" }, 409);
      } catch {
        // expected — file doesn't exist
      }

      await writeFile(filePath, body.content ?? "", "utf-8");
      const s = await stat(filePath);
      return c.json({ name: clean, path: clean, modifiedAt: s.mtimeMs }, 201);
    } catch {
      return c.json({ error: "Create failed" }, 500);
    }
  });

  // DELETE /files/:name
  app.delete("/files/:name", async (c) => {
    const dir = await getWorkDir(c);
    if (!dir) return c.json({ error: "Invalid workspace" }, 400);

    const name = sanitizeName(c.req.param("name"));
    if (!name) return c.json({ error: "Invalid filename" }, 400);

    const filePath = join(dir, name);
    if (!isWithinDir(dir, filePath)) return c.json({ error: "Invalid path" }, 400);

    try {
      await unlink(filePath);
      return c.json({ ok: true });
    } catch (e) {
      if (e.code === "ENOENT") return c.json({ error: "File not found" }, 404);
      return c.json({ error: "Delete failed" }, 500);
    }
  });

  return app;
}
