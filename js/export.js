/* "Save & share" tray on every tool page.
 *
 * Reads the tool's print-ready summary (the same sheet the print button
 * uses) and offers it as a PDF (via the browser's print dialog), plain
 * text to copy or download, or an email draft to the provider. Everything
 * happens in the browser; nothing is uploaded.
 */
(function () {
  "use strict";

  var sheets = document.querySelectorAll('[class*="-print-only"]');
  if (!sheets.length) return;

  var EMAIL_BODY_MAX = 1500;
  var BLOCK = /^(P|DIV|H[1-6]|LI|UL|OL|TR|TABLE|SECTION|HEADER|FOOTER|FIGCAPTION|BLOCKQUOTE)$/;

  function walk(node, out) {
    if (node.nodeType === 3) { out.push(node.nodeValue.replace(/\s+/g, " ")); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "SVG" || tag === "svg") return;
    if (tag === "BR") { out.push("\n"); return; }
    var block = BLOCK.test(tag);
    if (tag === "LI") out.push("\n• ");
    else if (block) out.push("\n");
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c, out);
    if (tag === "TD" || tag === "TH") out.push(" | ");
    else if (!block) out.push(" ");
    if (block && tag !== "LI") out.push("\n");
  }

  function sheetText(sheet) {
    var out = [];
    walk(sheet, out);
    return out.join("")
      .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
      .replace(/ \| \n/g, "\n").replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function allText() {
    var parts = [];
    for (var i = 0; i < sheets.length; i++) {
      var t = sheetText(sheets[i]);
      if (t) parts.push(t);
    }
    return parts.join("\n\n———\n\n");
  }

  /* Text present before the person has done anything (titles, letterhead,
     disclaimers). Export is only "ready" once the sheet has grown past it. */
  var baseline = null;
  setTimeout(function () { baseline = allText().length; }, 800);
  function ready() { return baseline !== null && allText().length > baseline + 40; }

  function toolName() {
    var h = document.querySelector(".page-hero .eyebrow");
    return (h && h.textContent.trim()) || document.title.split("|")[0].trim();
  }

  function composed() {
    return allText() + "\n\n" + "Created with UnderstandMe (understandme) — educational tool, not a clinical assessment.";
  }

  var canPrint = !document.querySelector(".wb-print-only");

  /* ---- UI ---- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var tray = el("div", "um-tray");
  var toggle = el("button", "um-tray-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "um-tray-panel");
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 21h14"/></svg><span>Save &amp; share</span>';

  var panel = el("div", "um-tray-panel");
  panel.id = "um-tray-panel";
  panel.hidden = true;
  panel.appendChild(el("p", "um-tray-title", "Take your results with you"));
  var note = el("p", "um-tray-note", "");
  note.setAttribute("role", "status");
  var list = el("div", "um-tray-actions");

  function action(label, hint, fn) {
    var b = el("button", "um-tray-action");
    b.type = "button";
    b.appendChild(el("strong", "", label));
    b.appendChild(el("span", "", hint));
    b.addEventListener("click", function () {
      if (!ready()) { note.textContent = "Finish the exercise first, then your results can be saved or shared."; return; }
      note.textContent = "";
      fn();
    });
    list.appendChild(b);
  }

  function copyText(t, msg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      note.textContent = ok ? msg : "Copy failed. Use Download instead.";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { note.textContent = msg; }, fallback);
    } else fallback();
  }

  if (canPrint) action("Print or save as PDF", "Opens your browser’s print dialog", function () { window.print(); });
  action("Copy as text", "Paste into a note or message", function () { copyText(composed(), "Copied to your clipboard."); });
  action("Download as text file", "Saves a .txt to this device", function () {
    var blob = new Blob([composed()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "understandme-" + (window.location.pathname.match(/([^\/]+)\.html$/) || [0, "results"])[1] + ".txt";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    note.textContent = "Downloaded.";
  });

  var mail = el("button", "um-tray-action");
  mail.type = "button";
  mail.appendChild(el("strong", "", "Email to my provider"));
  mail.appendChild(el("span", "", "Opens a draft you review before sending"));
  mail.addEventListener("click", function () {
    if (!ready()) { note.textContent = "Finish the exercise first, then your results can be saved or shared."; return; }
    var to = UM.profile.email;
    var body = composed();
    var truncated = body.length > EMAIL_BODY_MAX;
    if (truncated) body = body.slice(0, EMAIL_BODY_MAX) + "\n\n[Shortened. Use Copy as text or the PDF for the full results.]";
    window.location.href = "mailto:" + encodeURIComponent(to).replace(/%40/g, "@") +
      "?subject=" + encodeURIComponent(toolName() + " results") + "&body=" + encodeURIComponent(body);
    note.textContent = truncated ? "Draft opened with a shortened copy. Attach the PDF or paste the full text." : "Draft opened. Review it before sending.";
  });
  if (UM.profile.email) list.appendChild(mail);

  panel.appendChild(list);
  panel.appendChild(note);
  panel.appendChild(el("p", "um-tray-fine", "Everything stays in your browser. Nothing is uploaded."));
  tray.appendChild(panel);
  tray.appendChild(toggle);

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) note.textContent = "";
  }
  toggle.addEventListener("click", function () { setOpen(panel.hidden); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { setOpen(false); toggle.focus(); } });
  document.addEventListener("click", function (e) { if (!panel.hidden && !tray.contains(e.target)) setOpen(false); });

  document.body.appendChild(tray);
})();
