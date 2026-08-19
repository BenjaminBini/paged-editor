# Vendored browser libraries

The editor page loads these two files from `assets/`, so a deployment without
egress to a public CDN still opens a document.

| File | Package | Version |
| --- | --- | --- |
| `marked.umd.js` | `marked` | 18.0.10 |
| `purify.min.js` | `dompurify` | 3.4.13 |

To update one file, copy the build from the package of that version, and record
the new version here. `marked` ships the browser build at `lib/marked.umd.js`.
`dompurify` ships it at `dist/purify.min.js`.
