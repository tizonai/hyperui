#!/usr/bin/env python3
"""hyperui spec page: markdown in .hyperui/spec/ (or a critique report) -> the HTML page the user reads.

Standard library only. Template: skills/spec/references/spec-page-template.html (same plugin tree);
the conversion rules are the ones in skills/spec/references/spec-artifacts.md.

  python3 spec-page.py <spec.md> <out.html> [--suffix PRD] [--status draft] [--track "full · PRD"]
                       [--approvals "PRD ✓ · …"] [--description "…"] [--lang en] [--root <path>] [--full]
  python3 spec-page.py --self-test

Default output is a FRAGMENT (<title>, <meta description>, <style>, the body content): the Artifact
tool wraps it in the document skeleton. --full writes the whole document, for the no-Artifact
fallback file (.hyperui/spec/<topic>/index.html). Nothing in the template changes but the
{{placeholders}}; a leftover placeholder is an error.
"""
import argparse
import html
import os
import pathlib
import re
import sys
import unicodedata

HERE = pathlib.Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "skills" / "spec" / "references" / "spec-page-template.html"
SUFFIX_BY_FILE = {
    "00-prd": "PRD", "01-requirements": "Requirements", "01-bug-analysis": "Bug analysis",
    "02-design": "Design", "03-tasks": "Tasks",
}


def slug(h):
    h = unicodedata.normalize("NFKD", h).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", h.lower()).strip("-")


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+|#[^)\s]+)\)", r'<a href="\2">\1</a>', s)
    return s


def convert(md):
    """Markdown text -> dict(title, date, description, toc, sections). Pure; no files."""
    if md.startswith("---"):
        md = md.split("---", 2)[2].lstrip("\n")
    lines = md.splitlines()
    title = lines[0].lstrip("# ").strip() if lines else ""
    m = re.search(r"\*\*Date:\*\*\s*(\S+)", md)
    date = m.group(1) if m else ""
    sections, toc, buf = [], [], []
    st = {"cur": None, "lst": None, "tbl": None, "quote": False}
    fence = None
    description = ""

    def flush():
        if st["lst"]:
            buf.append("</%s>" % st["lst"]); st["lst"] = None
        if st["quote"]:
            buf.append("</blockquote>"); st["quote"] = False
        if st["tbl"]:
            head, rows = st["tbl"][0], st["tbl"][1:]
            buf.append('<div class="table-wrap"><table><thead><tr>' + "".join("<th>%s</th>" % inline(c) for c in head)
                       + "</tr></thead><tbody>" + "".join("<tr>" + "".join("<td>%s</td>" % inline(c) for c in r) + "</tr>" for r in rows)
                       + "</tbody></table></div>")
            st["tbl"] = None

    def close():
        flush()
        if st["cur"]:
            sections.append('<section id="%s"><h2>%s</h2>\n%s</section>' % (st["cur"][0], inline(st["cur"][1]), "\n".join(buf)))
        buf.clear()

    for ln in lines[1:]:
        if ln.startswith("```"):
            if fence is None:
                flush(); fence = (ln[3:].strip(), []); continue
            lang, body = fence
            txt = "\n".join(body)
            if lang == "mermaid":
                buf.append('<pre class="mermaid">' + txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</pre>")
            else:
                buf.append('<pre><code class="language-%s">%s</code></pre>' % (lang or "text", html.escape(txt, quote=False)))
            fence = None; continue
        if fence is not None:
            fence[1].append(ln); continue
        ln = re.sub(r"<!--.*?-->", "", ln).rstrip()
        if re.match(r"\*\*(Source|Date|Track|Design):\*\*", ln) or (ln.strip() == "" and "<!--" in ln):
            continue
        if ln.startswith("|"):
            if re.match(r"^\|?\s*:?-{2,}", ln):
                continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if st["tbl"] is None:
                flush(); st["tbl"] = [cells]
            else:
                st["tbl"].append(cells)
            continue
        elif st["tbl"] is not None:
            flush()
        m2 = re.match(r"^##\s+(.*)", ln)
        if m2 and not ln.startswith("###"):
            close(); h = m2.group(1).strip(); st["cur"] = (slug(h), h)
            toc.append('<li><a href="#%s">%s</a></li>' % (slug(h), inline(h))); continue
        m3 = re.match(r"^###\s+(.*)", ln)
        if m3:
            flush(); buf.append("<h3>%s</h3>" % inline(m3.group(1))); continue
        m4 = re.match(r"^####\s+(.*)", ln)
        if m4:
            flush(); buf.append("<h4>%s</h4>" % inline(m4.group(1))); continue
        if re.match(r"^(-{3,}|\*{3,})\s*$", ln):
            flush(); buf.append("<hr>"); continue
        mc = re.match(r"^-\s+\[( |x)\]\s+(.*)", ln)
        if mc:
            if st["lst"] != "ul":
                flush(); buf.append("<ul>"); st["lst"] = "ul"
            buf.append('<li><input type="checkbox" disabled%s> %s</li>' % (" checked" if mc.group(1) == "x" else "", inline(mc.group(2)))); continue
        mo = re.match(r"^(\d+)\.\s+(.*)", ln)
        mu = re.match(r"^[-*]\s+(.*)", ln)
        if mo:
            if st["lst"] != "ol":
                flush(); buf.append("<ol>"); st["lst"] = "ol"
            buf.append("<li>%s</li>" % inline(mo.group(2))); continue
        if mu:
            if st["lst"] != "ul":
                flush(); buf.append("<ul>"); st["lst"] = "ul"
            buf.append("<li>%s</li>" % inline(mu.group(1))); continue
        mq = re.match(r"^>\s?(.*)", ln)
        if mq:
            if st["lst"] or st["tbl"]:
                flush()
            if not st["quote"]:
                buf.append("<blockquote>"); st["quote"] = True
            buf.append("<p>%s</p>" % inline(mq.group(1))); continue
        flush()
        if ln.strip() == "":
            continue
        text = ln.strip()
        if text.startswith("N/A"):
            buf.append('<p class="na">%s</p>' % inline(text)); continue
        if not description and st["cur"] is None:
            description = re.sub(r"[*`]", "", text)
        buf.append("<p>%s</p>" % inline(text))
    close()
    return {"title": title, "date": date, "description": description, "toc": "\n".join(toc), "sections": "\n".join(sections)}


def render(tpl, fields, full=False):
    page = tpl
    for k, v in fields.items():
        page = page.replace("{{%s}}" % k, html.escape(v, quote=True) if k in ("description", "lang", "status", "root") else v)
    left = re.findall(r"\{\{[a-z_]+\}\}", page)
    if left:
        raise SystemExit("spec-page: unfilled placeholder(s): %s" % ", ".join(sorted(set(left))))
    if full:
        return page
    head_title = re.search(r"<title>.*?</title>", page, re.S).group(0)
    meta = re.search(r'<meta name="description"[^>]*>', page).group(0)
    style = re.search(r"<style>.*?</style>", page, re.S).group(0)
    body = re.search(r"<body[^>]*>(.*)</body>", page, re.S).group(1).strip()
    return head_title + "\n" + meta + "\n" + style + "\n" + body + "\n"


def build(md_text, md_name, opts, tpl):
    c = convert(md_text)
    stem = pathlib.Path(md_name).stem
    suffix = opts.suffix or SUFFIX_BY_FILE.get(stem, "Spec")
    if suffix.lower() == "none":
        suffix = ""
    track = opts.track or ("SDD-lite" if suffix == "Spec" else "full · " + suffix)
    fields = {
        "lang": opts.lang, "title": "%s — %s" % (c["title"], suffix) if suffix else c["title"],
        "description": opts.description or c["description"] or c["title"], "status": opts.status, "date": c["date"],
        "track": track, "root": opts.root, "approvals": opts.approvals, "toc": c["toc"], "sections": c["sections"],
    }
    return render(tpl, fields, full=opts.full), c["sections"].count("<section ")


SELF_TEST_MD = """---
artifact_url: https://claude.ai/artifact/x
---
# Bakery landing
<!-- write only what is needed to execute without ambiguity; mark unknowns as OPEN:; link ids, do not repeat -->

**Date:** 2026-10-14 · **Track:** SDD-lite (landing, no backend) · **Design:** `.hyperui/design.md` (Warm Crust)

A landing that gets *walk-in* orders from the neighbourhood.

## 1. PRD                      <!-- non-tech only -->
- **Problem:** nobody finds the bakery online
- **The ONE job:** call the shop

### Audience
People within 2 km, on a phone. See [the brief](https://example.com/brief) and [requirements](#2-requirements).

## 2. Requirements
| REQ | Behaviour | Acceptance |
|---|---|---|
| REQ-001 | WHEN a visitor opens the page THE SYSTEM SHALL show the hero | Given 360 px · When loads · Then CTA visible |
| REQ-002 | `a < b` escapes | **bold** cell |

> One EARS line per behaviour.

## 3. Design
```mermaid
sequenceDiagram
  Visitor->>Page: open
  Page-->>Visitor: hero & CTA <phone>
```
The visitor sees the hero first.

```bash
npm run build && npm test
```

N/A — no backend.

## 4. Tasks
1. first
2. second
- [ ] **TASK-001**: hero
- [x] **TASK-002**: footer

---

## Revisions
- none
"""


def self_test(tpl):
    class O:
        suffix = ""; status = "draft"; track = ""; approvals = "Spec —"; description = ""; lang = "es"; root = "/tmp/repo"; full = False
    checks = []
    frag, n = build(SELF_TEST_MD, "bakery-landing.md", O, tpl)
    full, _ = build(SELF_TEST_MD, "bakery-landing.md", type("F", (O,), {"full": True}), tpl)
    c = convert(SELF_TEST_MD)

    def ok(name, cond):
        checks.append((name, bool(cond)))

    ok("frontmatter stripped, title read", c["title"] == "Bakery landing")
    ok("date from the header line", c["date"] == "2026-10-14")
    ok("header line dropped from the body", "Track:</strong>" not in frag and "Warm Crust" not in frag)
    ok("description = first paragraph", c["description"].startswith("A landing that gets"))
    ok("four h2 sections + Revisions", n == 5)
    ok("section ids slugged", '<section id="1-prd">' in frag and '<section id="revisions">' in frag)
    ok("toc one entry per h2", c["toc"].count("<li>") == 5 and 'href="#2-requirements"' in c["toc"])
    ok("h3 rendered", "<h3>Audience</h3>" in frag)
    ok("bullets with bold", "<li><strong>Problem:</strong> nobody finds the bakery online</li>" in frag)
    ok("external and anchor links", '<a href="https://example.com/brief">the brief</a>' in frag and '<a href="#2-requirements">requirements</a>' in frag)
    ok("table wrapped with thead and tbody", '<div class="table-wrap"><table><thead><tr><th>REQ</th>' in frag and "<tbody><tr><td>REQ-001</td>" in frag)
    ok("table cells escape and inline", "<code>a &lt; b</code>" in frag and "<td><strong>bold</strong> cell</td>" in frag)
    ok("blockquote", "<blockquote>\n<p>One EARS line per behaviour.</p>\n</blockquote>" in frag)
    ok("mermaid block escaped, class kept", '<pre class="mermaid">sequenceDiagram' in frag and "&amp; CTA &lt;phone&gt;" in frag)
    ok("fenced code with language", '<pre><code class="language-bash">npm run build &amp;&amp; npm test</code></pre>' in frag)
    ok("N/A paragraph", '<p class="na">N/A — no backend.</p>' in frag)
    ok("ordered list", "<ol>\n<li>first</li>\n<li>second</li>\n</ol>" in frag)
    ok("checklist unchecked and checked", '<input type="checkbox" disabled> <strong>TASK-001</strong>: hero' in frag and '<input type="checkbox" disabled checked> <strong>TASK-002</strong>: footer' in frag)
    ok("hr", "<hr>" in frag)
    ok("html comments dropped (whole line and trailing)", "&lt;!--" not in frag and "<!--" not in frag.split("<style>")[0] and "<h2>1. PRD</h2>" in frag)
    ok("suffix and track defaults (lite)", "<title>Bakery landing — Spec</title>" in frag and "<dd>SDD-lite</dd>" in frag)
    ok("full-track suffix from the file name", build(SELF_TEST_MD, "00-prd.md", O, tpl)[0].count("Bakery landing — PRD") >= 2)
    ok("--suffix none keeps the title as written", "<title>Bakery landing</title>" in build(SELF_TEST_MD, "x.md", type("N", (O,), {"suffix": "none", "track": "critique"}), tpl)[0])
    ok("fragment: title, meta, style, body — no skeleton", frag.startswith("<title>") and "<style>" in frag and "<!doctype" not in frag and "<html" not in frag and '<div class="page">' in frag)
    ok("full: whole document", full.startswith("<!doctype html>") and '<html lang="es">' in full and full.rstrip().endswith("</html>"))
    ok("no placeholder left", "{{" not in frag and "{{" not in full)
    ok("root and status filled", "<code>/tmp/repo</code>" in frag and 'data-status="draft"' in frag)
    ok("mermaid pinned to an exact version on an allowed CDN", re.search(r'src="https://cdn\.jsdelivr\.net/npm/mermaid@\d+\.\d+\.\d+/dist/mermaid\.min\.js"', frag) is not None)
    ok("template: tokens on :root + guarded dark mode + body background",
       ":root {" in tpl and ':root:not([data-theme="light"])' in tpl and ':root[data-theme="dark"]' in tpl and "background: var(--bg)" in tpl)
    try:
        render(tpl, {"lang": "en"}, full=True); ok("unfilled placeholder is an error", False)
    except SystemExit:
        ok("unfilled placeholder is an error", True)
    failed = [n for n, p in checks if not p]
    for n in failed:
        print("FAIL", n)
    print("self-test: %d passed, %d failed" % (len(checks) - len(failed), len(failed)))
    return 1 if failed else 0


def main(argv):
    ap = argparse.ArgumentParser(prog="spec-page.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("md", nargs="?", help="markdown source (.hyperui/spec/… or a critique report)")
    ap.add_argument("out", nargs="?", help="HTML to write (published with the Artifact tool, or the fallback page)")
    ap.add_argument("--suffix", default="", help="title suffix: PRD | Requirements | Design | Tasks | Bug analysis | Spec | none (default: from the file name)")
    ap.add_argument("--status", default="draft", help="draft | in review | approved")
    ap.add_argument("--track", default="", help='"full · <phase>" | SDD-lite | critique (default: from the suffix)')
    ap.add_argument("--approvals", default="—", help='e.g. "PRD ✓ · Requirements ✓ · Design — · Tasks —"')
    ap.add_argument("--description", default="", help="one sentence for the artifact card (default: the first paragraph)")
    ap.add_argument("--lang", default="en", help="BCP-47 tag of the spec's language")
    ap.add_argument("--root", default=os.getcwd(), help="project root shown in the header card")
    ap.add_argument("--full", action="store_true", help="write the whole document instead of the fragment")
    ap.add_argument("--template", default=str(TEMPLATE), help=argparse.SUPPRESS)
    ap.add_argument("--self-test", action="store_true", help="run the built-in assertions and exit")
    opts = ap.parse_args(argv)
    tpl = pathlib.Path(opts.template).read_text(encoding="utf-8")
    if opts.self_test:
        return self_test(tpl)
    if not opts.md or not opts.out:
        ap.error("need <spec.md> and <out.html> (or --self-test)")
    md_path = pathlib.Path(opts.md)
    page, n = build(md_path.read_text(encoding="utf-8"), md_path.name, opts, tpl)
    out = pathlib.Path(opts.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print("%s sections %d bytes %d %s" % (out, n, len(page.encode("utf-8")), "full" if opts.full else "fragment"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
