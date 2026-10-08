/* Provider dashboard. No patient data exists here: this page builds a
   provider profile and shareable links, nothing else. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var form = $("pv-form");

  /* Packets are for patients; the SUDS tracker is clinician-led, in session. */
  var PACKET_TOOLS = UM_TOOLS.filter(function (t) { return t.who !== "Clinician-led"; });
  var DEFAULT_PACKET = ["wheel-of-life", "values-sort", "step-builder"];
  var order = DEFAULT_PACKET.concat(PACKET_TOOLS.map(function (t) { return t.id; }).filter(function (id) { return DEFAULT_PACKET.indexOf(id) === -1; }));
  var selected = {};
  order.forEach(function (id) { selected[id] = DEFAULT_PACKET.indexOf(id) !== -1; });

  function readForm() {
    var out = {};
    UM.FIELDS.forEach(function (f) { out[f] = form.elements[f].value; });
    return UM.clean(out);
  }
  function writeForm(p) { UM.FIELDS.forEach(function (f) { form.elements[f].value = p[f] || ""; }); }
  function status(msg) { $("pv-status").textContent = msg; }
  function base() { return window.location.href.replace(/[?#].*$/, "").replace(/[^\/]*$/, ""); }

  function chosen() { return order.filter(function (id) { return selected[id]; }); }

  function profileQuery(p) { return (p.name || p.practice) ? "p=" + UM.encode(p) : ""; }

  function toolLink(id) {
    var q = profileQuery(readForm());
    return base() + id + ".html" + (q ? "?" + q : "");
  }

  function packetLink() {
    var ids = chosen();
    if (!ids.length) return "";
    var parts = [];
    var q = profileQuery(readForm());
    if (q) parts.push(q);
    parts.push("flow=" + ids.join(","));
    return base() + "packet.html?" + parts.join("&");
  }

  function copy(text, okMsg) {
    function done() { status(okMsg); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, okMsg); });
    } else fallbackCopy(text, okMsg);
  }
  function fallbackCopy(text, okMsg) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    status(ok ? okMsg : "Copy failed. Select the text and copy it manually.");
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
    var ids = chosen();
    if (!ids.length) return "";
    var lines = ["Hi,", ""];
    lines.push(p.note || "Here " + (ids.length === 1 ? "is an exercise" : "are some exercises") + " to try before our next session.");
    lines.push("");
    ids.forEach(function (id, i) { lines.push((i + 1) + ". " + umToolById(id).name); });
    lines.push("");
    lines.push("Start here: " + packetLink());
    lines.push("");
    lines.push("Nothing you enter is sent to me or stored online. When you finish each one, print or save the results and bring them to our session.");
    var sig = [p.name ? p.name + (p.credentials ? ", " + p.credentials : "") : "", p.practice].filter(Boolean).join("\n");
    if (sig) { lines.push(""); lines.push(sig); }
    return lines.join("\n");
  }

  function move(id, delta) {
    var i = order.indexOf(id), j = i + delta;
    if (j < 0 || j >= order.length) return;
    order.splice(i, 1); order.splice(j, 0, id);
    renderAssign(); renderOutputs();
  }

  function renderAssign() {
    var list = $("pv-assign-list");
    list.textContent = "";
    order.forEach(function (id, i) {
      var t = umToolById(id);
      var li = document.createElement("li");
      li.className = "um-assign-item" + (selected[id] ? "" : " is-off");

      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!selected[id];
      cb.setAttribute("aria-label", "Include " + t.name);
      cb.addEventListener("change", function () { selected[id] = cb.checked; renderAssign(); renderOutputs(); });

      var ord = document.createElement("div");
      ord.className = "um-order";
      var up = document.createElement("button");
      up.type = "button"; up.textContent = "▲"; up.setAttribute("aria-label", "Move " + t.name + " up"); up.disabled = i === 0;
      up.addEventListener("click", function () { move(id, -1); });
      var down = document.createElement("button");
      down.type = "button"; down.textContent = "▼"; down.setAttribute("aria-label", "Move " + t.name + " down"); down.disabled = i === order.length - 1;
      down.addEventListener("click", function () { move(id, 1); });
      ord.appendChild(up); ord.appendChild(down);

      var body = document.createElement("div");
      var h = document.createElement("h3"); h.textContent = t.name;
      var d = document.createElement("p");
      var pos = chosen().indexOf(id);
      d.textContent = (pos >= 0 ? "Step " + (pos + 1) + " · " : "") + t.who + " · " + t.time;
      body.appendChild(h); body.appendChild(d);

      var actions = document.createElement("div");
      actions.className = "um-assign-actions";
      var copyBtn = document.createElement("button");
      copyBtn.type = "button"; copyBtn.className = "btn btn-ghost btn-sm"; copyBtn.textContent = "Copy link";
      copyBtn.addEventListener("click", function () { copy(toolLink(id), "Link to " + t.name + " copied."); });
      actions.appendChild(copyBtn);

      li.appendChild(cb); li.appendChild(ord); li.appendChild(body); li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function renderOutputs() {
    var n = chosen().length;
    $("pv-count").textContent = n + (n === 1 ? " exercise" : " exercises") + " in your packet";
    var link = packetLink();
    $("pv-packet-link").value = link || "Choose at least one exercise";
    var prev = $("pv-preview-packet");
    if (link) prev.setAttribute("href", link); else prev.removeAttribute("href");
    $("pv-message").value = buildMessage();
  }

  function refresh() { renderPreview(); renderAssign(); renderOutputs(); }

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
  $("pv-copy-packet").addEventListener("click", function () { var l = packetLink(); if (l) copy(l, "Packet link copied."); });
  $("pv-copy-message").addEventListener("click", function () { var m = $("pv-message").value; if (m) copy(m, "Message copied."); });
  $("pv-select-all").addEventListener("click", function () { order.forEach(function (id) { selected[id] = true; }); refresh(); });
  $("pv-select-none").addEventListener("click", function () { order.forEach(function (id) { selected[id] = false; }); refresh(); });

  writeForm(UM.profile);
  refresh();
})();
