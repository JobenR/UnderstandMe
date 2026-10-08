/* Provider dashboard. No patient data exists here: this page builds a
   provider profile and shareable links, nothing else. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var form = $("pv-form");
  var selected = {};
  UM_TOOLS.forEach(function (t) { selected[t.file] = true; });

  function readForm() {
    var out = {};
    UM.FIELDS.forEach(function (f) { out[f] = form.elements[f].value; });
    return UM.clean(out);
  }

  function writeForm(p) {
    UM.FIELDS.forEach(function (f) { form.elements[f].value = p[f] || ""; });
  }

  function status(msg) { $("pv-status").textContent = msg; }

  function linkFor(file) {
    var p = readForm();
    var base = window.location.href.replace(/[?#].*$/, "").replace(/[^\/]*$/, "");
    var has = p.name || p.practice;
    return base + file + (has ? "?p=" + UM.encode(p) : "");
  }

  function copy(text, okMsg) {
    function done() { status(okMsg); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, okMsg); });
    } else {
      fallbackCopy(text, okMsg);
    }
  }
  function fallbackCopy(text, okMsg) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    status(ok ? okMsg : "Copy failed — select the text and copy it manually.");
  }

  function renderPreview() {
    var p = readForm();
    var el = $("pv-preview-body");
    el.textContent = "";
    var name = [p.practice, (p.name + (p.credentials ? ", " + p.credentials : "")).trim()].filter(Boolean).join(" — ") || "UnderstandMe";
    var strong = document.createElement("strong");
    strong.textContent = name;
    el.appendChild(strong);
    var contact = [p.email, p.phone].filter(Boolean).join(" · ");
    if (contact) { el.appendChild(document.createElement("br")); el.appendChild(document.createTextNode(contact)); }
  }

  function buildMessage() {
    var p = readForm();
    var lines = [];
    var chosen = UM_TOOLS.filter(function (t) { return selected[t.file]; });
    if (!chosen.length) return "";
    lines.push("Hi,");
    lines.push("");
    lines.push(p.note || "Here " + (chosen.length === 1 ? "is an exercise" : "are some exercises") + " to try before our next session.");
    lines.push("");
    chosen.forEach(function (t) { lines.push(t.name + ": " + linkFor(t.file)); });
    lines.push("");
    lines.push("Nothing you enter is sent to me or stored online. When you finish, print or save the results page and bring it to our session.");
    var sig = [p.name ? p.name + (p.credentials ? ", " + p.credentials : "") : "", p.practice].filter(Boolean).join("\n");
    if (sig) { lines.push(""); lines.push(sig); }
    return lines.join("\n");
  }

  function renderAssign() {
    var list = $("pv-assign-list");
    list.textContent = "";
    UM_TOOLS.forEach(function (t) {
      var li = document.createElement("li");
      li.className = "um-assign-item";

      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.id = "pv-cb-" + t.file; cb.checked = !!selected[t.file];
      cb.setAttribute("aria-label", "Include " + t.name);
      cb.addEventListener("change", function () { selected[t.file] = cb.checked; renderMessage(); });

      var body = document.createElement("div");
      var h = document.createElement("h3"); h.textContent = t.name;
      var d = document.createElement("p"); d.textContent = t.who + " · " + t.time;
      body.appendChild(h); body.appendChild(d);

      var actions = document.createElement("div");
      actions.className = "um-assign-actions";
      var copyBtn = document.createElement("button");
      copyBtn.type = "button"; copyBtn.className = "btn btn-outline btn-sm"; copyBtn.textContent = "Copy link";
      copyBtn.addEventListener("click", function () { copy(linkFor(t.file), "Link to " + t.name + " copied."); });
      var open = document.createElement("a");
      open.className = "btn btn-ghost btn-sm"; open.textContent = "Preview";
      open.href = linkFor(t.file); open.target = "_blank"; open.rel = "noopener";
      open.addEventListener("click", function () { open.href = linkFor(t.file); });
      actions.appendChild(copyBtn); actions.appendChild(open);

      li.appendChild(cb); li.appendChild(body); li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function renderMessage() { $("pv-message").value = buildMessage(); }

  function refresh() { renderPreview(); renderMessage(); }

  form.addEventListener("input", refresh);
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  $("pv-save").addEventListener("click", function () {
    status(UM.save(readForm()) ? "Saved on this device only. Nothing was uploaded." : "This browser blocked local storage, so nothing was saved. Use Export instead.");
  });
  $("pv-forget").addEventListener("click", function () {
    UM.forget(); writeForm(UM.clean({})); refresh();
    status("Profile removed from this device.");
  });
  $("pv-export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(readForm(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "understandme-provider-profile.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    status("Profile file downloaded. Import it on any other device.");
  });
  $("pv-import").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try { writeForm(UM.clean(JSON.parse(r.result))); refresh(); status("Profile imported. Save it on this device if you want to keep it."); }
      catch (err) { status("That file isn't a valid profile."); }
    };
    r.readAsText(file);
    e.target.value = "";
  });
  $("pv-copy-message").addEventListener("click", function () {
    var m = $("pv-message").value;
    if (m) copy(m, "Message copied.");
  });
  $("pv-select-all").addEventListener("click", function () {
    UM_TOOLS.forEach(function (t) { selected[t.file] = true; }); renderAssign(); renderMessage();
  });
  $("pv-select-none").addEventListener("click", function () {
    UM_TOOLS.forEach(function (t) { selected[t.file] = false; }); renderAssign(); renderMessage();
  });

  writeForm(UM.profile);
  renderAssign();
  refresh();
})();
