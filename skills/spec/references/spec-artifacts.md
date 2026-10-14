# Spec artifacts — how every spec file becomes a page

The markdown in `.hyperui/spec/` is the source of truth; the artifact is how the user reads it.
Template: `spec-page-template.html` (same folder). Fill every `{{placeholder}}`; change nothing else.

## Running the converter
```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/spec-page.py" <spec.md> <same name>.html \
  --lang <es|en|…> --root <project root> --status <draft|in review|approved> --approvals "PRD ✓ · Requirements — · …"
```
Standard library only (needs `python3`, nothing else). Suffix (`PRD`, `Requirements`, `Design`, `Tasks`, `Bug analysis`,
else `Spec`) and track (`full · <suffix>` | `SDD-lite`) come from the file name; override with `--suffix` (`none` keeps the
title as written) and `--track`; `--description` replaces the first paragraph. Default output is a **fragment** (title, meta
description, style, body content) — the Artifact tool wraps it in the document skeleton — written next to the markdown
(`00-prd.html`), a generated file never edited by hand; `--full` writes the whole document for the fallback below. Publish
the output path. Hand-convert with the rules below **only if `python3` is missing**.

## Markdown → HTML conversion (what the script does; by hand only without `python3`)
- `#` title → `{{title}}` (not repeated in the body). Each `##` → `<section id="<slug>"><h2>…</h2>…</section>`;
  `###`/`####` → `<h3>`/`<h4>`. Slug = lowercase, hyphens, no accents (`2-requirements`, `glossary`).
- `{{toc}}` = one `<li><a href="#<slug>">Heading</a></li>` per `##`, in order.
- Paragraphs → `<p>`; `**bold**` → `<strong>`; `` `code` `` → `<code>`; links → `<a href>` (never invent a URL).
- Lists → `<ul>`/`<ol>`; `- [ ]` / `- [x]` → `<li><input type="checkbox" disabled [checked]> …</li>`.
- Tables → `<div class="table-wrap"><table><thead>…<tbody>…</table></div>` (the wrap gives phones a horizontal scroll).
- Fenced code → `<pre><code class="language-<lang>">` with `<`, `>`, `&` escaped.
- ```` ```mermaid ```` → `<pre class="mermaid">` with the raw diagram text, un-escaped except `<`/`>`/`&`;
  its 1–2 sentence caption goes right after as `<p class="caption">`.
- `> quote` → `<blockquote>`; `---` → `<hr>`.
- `N/A — reason` → `<p class="na">N/A — reason</p>`. The `**Date:** · **Track:** · **Design:**` header line feeds the
  header card (`{{date}}`, `{{track}}`) and is dropped from the body. `## Revisions` stays last.
- `{{lang}}` = the language the spec is written in; `{{description}}` = the PRD problem or the ONE job, one sentence.

## Title, icon, url reuse
- Full track: `<Topic> — PRD` · `<Topic> — Requirements` · `<Topic> — Design` · `<Topic> — Tasks`
  (bug variant: `<Topic> — Bug analysis`). SDD-lite: `<Topic> — Spec`. Consolidated: `Spec: <Topic>`.
  `<Topic>` is the product/change name as written in the spec's `#` title, not the slug.
- Icon `document` on every first publish; omitted on republish.
- One artifact per file. A revision republishes to the **same url** (`url` parameter) — never a second
  artifact for the same file. The url lives in `state.md` (below) and in the spec file's frontmatter:
  ```yaml
  ---
  artifact_url: https://claude.ai/artifact/…      # or the fallback .html path
  ---
  ```
  (add this block at the top of the spec file; the templates have none).
- `{{status}}`: `draft` until the gate question is answered, `in review` while feedback is being applied,
  `approved` after explicit approval. `{{approvals}}`: `PRD ✓ · Requirements ✓ · Design — · Tasks —`
  (SDD-lite: `Spec ✓` or `Spec —`).

## `state.md` `artifacts:` block
```
artifacts:
  spec/<topic>/00-prd.md: https://claude.ai/artifact/…
  spec/<topic>/01-requirements.md: https://claude.ai/artifact/…
  spec/<topic>/consolidated: https://claude.ai/artifact/…     # full track, after the tasks gate
  spec/<topic>.md: .hyperui/spec/<topic>.html                  # SDD-lite, fallback path
```
Keys are paths relative to `.hyperui/`; values are the url or, in fallback, the html path. Update the
line in place on republish; never duplicate a key.

## Fallback — no Artifact tool in the session (headless `-p`, evals, CI)
Write the filled template to `.hyperui/spec/<topic>/index.html` (full track: rebuilt after every phase
with the files written so far, so at the end it IS the consolidated page) or `.hyperui/spec/<topic>.html`
(SDD-lite). Record that path where the url would go and say it in the reply. Never skip the page.

## Consolidated `Spec: <Topic>` checklist (full track, published at the tasks gate; republished on any change)
- [ ] Header card: status, date, track, repo root, approvals per phase
- [ ] TOC lists the four phases (and the bug analysis when present) in order, then Traceability
- [ ] Sections in order: PRD · Requirements · Design · Tasks, each file's `##` headings kept as `###`
- [ ] Traceability table merged: UC → REQ → design decision → TASK, one row per REQ
- [ ] Every Mermaid diagram renders and keeps its caption; every link opens
- [ ] `state.md` `artifacts:` has `spec/<topic>/consolidated: <url>`
