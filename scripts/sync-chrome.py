#!/usr/bin/env python3
"""Rewrite the shared header, footer and script tags in every HTML page.

The site is static (no templating), so the header/footer live here and are
stamped into each page. Run from the repo root after editing them:

    python3 scripts/sync-chrome.py
"""
import glob, re, os

TOOLS = [
    ("values-sort", "Values Card Sort"), ("avoidance-calculator", "Avoidance Cost Calculator"),
    ("suds-tracker", "Exposure & SUDS Tracker"), ("wheel-of-life", "Wheel of Life"),
    ("decision-matrix", "Weigh Your Options"), ("genogram", "Genogram Builder"),
    ("step-builder", "Step Builder"), ("week-builder", "Week Builder"),
]
TOOL_FILES = {t for t, _ in TOOLS}

def esc(s): return s.replace("&", "&amp;")

tool_links = "\n".join('          <a href="%s.html">%s</a>' % (t, esc(n)) for t, n in TOOLS)
footer_tool_links = "\n".join('        <a href="%s.html">%s</a>' % (t, esc(n)) for t, n in TOOLS)

HEADER = '''<header class="site-header">
  <div class="container">
    <a href="index.html" class="brand" aria-label="UnderstandMe home">
      <svg class="um-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#1A525A"/><path d="M11 29c0-10 6-16 18-17 0 11-6 17-16 17z" fill="#EAF1E6"/><path d="M12 28c4-6 8-10 13-13" fill="none" stroke="#1A525A" stroke-width="1.8" stroke-linecap="round"/><circle cx="29" cy="11.5" r="3" fill="#8FB59A"/></svg>
      <span class="um-wordmark">Understand<em>Me</em></span>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="Main">
      <div class="nav-dropdown">
        <button type="button" class="nav-dropdown-trigger" aria-expanded="false" aria-haspopup="true">Tools
          <svg class="nav-dropdown-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="nav-dropdown-panel">
          <a href="index.html#tools">All tools</a>
%s
        </div>
      </div>
      <a href="providers.html">For Providers</a>
      <a href="pricing.html">Pricing</a>
      <a href="about.html">About</a>
      <div class="nav-actions">
        <a class="btn btn-outline btn-sm" href="login.html">Log in</a>
        <a class="btn btn-primary btn-sm" href="index.html#tools">Try a tool</a>
      </div>
    </nav>
    <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>
<div class="nav-scrim"></div>
<p class="um-provider-banner" id="um-provider-banner" hidden></p>
<div class="um-flow" id="um-flow" hidden></div>''' % tool_links

FOOTER = '''<footer class="site-footer">
  <div class="container">
    <div class="footer-grid um-footer-grid">
      <div>
        <div class="footer-brand"><span class="um-wordmark um-wordmark-light">Understand<em>Me</em></span></div>
        <p>A toolkit for providers and their patients. Calm, private, and ready to take with you.</p>
      </div>
      <div>
        <h4>Toolkit</h4>
%s
      </div>
      <div>
        <h4>Providers</h4>
        <a href="providers.html">Dashboard &amp; packets</a>
        <a href="pricing.html">Pricing</a>
        <a href="login.html">Log in</a>
      </div>
      <div>
        <h4>Company</h4>
        <a href="about.html">About</a>
        <a href="privacy.html">Privacy</a>
      </div>
      <div>
        <h4>In Crisis?</h4>
        <p>If you are in immediate danger, call <strong>911</strong>.<br>For 24/7 crisis support, call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline).</p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span id="year"></span> UnderstandMe. All rights reserved.</span>
      <span>For education and self-reflection. Not a substitute for professional care.</span>
    </div>
  </div>
</footer>''' % footer_tool_links

def ensure_scripts(s, name):
    wanted = ["js/provider.js", "js/tools.js"]
    if name in TOOL_FILES:
        wanted += ["js/flow.js", "js/export.js"]
    anchor = '<script src="js/main.js"></script>'
    for w in wanted:
        tag = '<script src="%s"></script>' % w
        if tag in s:
            continue
        if w == "js/provider.js":
            s = s.replace(anchor, anchor + "\n" + tag, 1)
        else:
            s = s.replace('<script src="js/provider.js"></script>', '<script src="js/provider.js"></script>\n' + tag, 1) if w == "js/tools.js" else s.replace('<script src="js/tools.js"></script>', '<script src="js/tools.js"></script>\n' + tag, 1)
    # keep tools.js / flow.js / export.js ordered after provider.js
    return s

FONT_LINK = '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&display=swap" rel="stylesheet">'

def ensure_fonts(s):
    return re.sub(r'<link href="https://fonts\.googleapis\.com/css2[^>]*>', FONT_LINK, s, count=1)

def ensure_css(s, name):
    if "css/um.css" not in s:
        s = s.replace('<link rel="stylesheet" href="css/styles.css">', '<link rel="stylesheet" href="css/styles.css">\n<link rel="stylesheet" href="css/um.css">', 1)
    if name in TOOL_FILES and "css/um-tools.css" not in s:
        s = s.replace("</head>", '<link rel="stylesheet" href="css/um-tools.css">\n</head>', 1)
    return s

for path in sorted(glob.glob("*.html")):
    name = os.path.splitext(path)[0]
    s = open(path).read()
    s, n1 = re.subn(r'<header class="site-header">.*?<div class="nav-scrim"></div>(?:\n<p class="um-provider-banner"[^\n]*</p>)?(?:\n<div class="um-flow"[^\n]*</div>)?', lambda m: HEADER, s, count=1, flags=re.S)
    s, n2 = re.subn(r'<footer class="site-footer">.*?</footer>', lambda m: FOOTER, s, count=1, flags=re.S)
    s = ensure_fonts(ensure_css(ensure_scripts(s, name), name))
    open(path, "w").write(s)
    print("%-28s header=%d footer=%d" % (path, n1, n2))
