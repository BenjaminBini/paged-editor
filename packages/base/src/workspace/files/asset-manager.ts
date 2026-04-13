// workspace-assets.js — Helpers for pasted image assets and preview base URLs.

import * as platform from "../../infrastructure/platform-adapter.js";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

function getPathSeparator(filePath = ""): string {
  return filePath.includes("\\") ? "\\" : "/";
}

function dirname(filePath = ""): string {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
}

function joinPath(base: string, ...segments: string[]): string {
  const sep = getPathSeparator(base || "");
  const clean = [];

  if (base) clean.push(String(base).replace(/[\\/]+$/g, ""));
  for (const segment of segments) {
    if (!segment) continue;
    clean.push(String(segment).replace(/^[\\/]+|[\\/]+$/g, ""));
  }

  return clean.filter(Boolean).join(sep || "/");
}

function inferExtension(file: { type?: string; name?: string } | null | undefined): string {
  const fromMime = MIME_EXTENSIONS[(file?.type || "") as keyof typeof MIME_EXTENSIONS];
  if (fromMime) return fromMime;

  const nameMatch = String(file?.name || "").match(/\.([a-z0-9]+)$/i);
  if (nameMatch) return nameMatch[1].toLowerCase();

  return "png";
}

function stripExtension(name = ""): string {
  return String(name).replace(/\.[^.]+$/, "");
}

function sanitizeStem(value: string = ""): string {
  const clean = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "pasted-image";
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number, length: number = 2) => String(value).padStart(length, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    "-",
    pad(now.getMilliseconds(), 3),
  ].join("");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function getAssetBaseHref(filePath: string): Promise<string> {
  if (!filePath) return "";
  return (await platform.getWorkspaceAssetBaseHref(filePath)) || "";
}

export async function saveImageAsset(markdownFilePath: string, file: File): Promise<{ altText: string; filePath: string; markdownPath: string }> {
  if (!markdownFilePath) {
    throw new Error("Save the Markdown file before pasting images.");
  }

  const ext = inferExtension(file);
  const rawStem = sanitizeStem(stripExtension(file?.name || ""));
  const stem = rawStem === "image" ? "pasted-image" : rawStem;
  const fileName = `${stem}-${timestamp()}.${ext}`;
  const assetFilePath = joinPath(dirname(markdownFilePath), "assets", fileName);
  const bytes = await file.arrayBuffer();

  await platform.writeBinaryFile(assetFilePath, arrayBufferToBase64(bytes) as unknown as ArrayBuffer);

  return {
    altText: "Pasted image",
    filePath: assetFilePath,
    markdownPath: `assets/${fileName}`,
  };
}
