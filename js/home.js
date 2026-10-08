/* Home page: "What's on your mind?" guide and the exercise index. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* ---------- Guide ---------- */
  var options = $("fd-options");
  var result = $("fd-result");

  function swap(node) {
    result.textContent = "";
    node.classList.add("um-swap");
    result.appendChild(node);
  }

  function idle() {
    var box = el("div", "um-result um-result-idle");
    var art = el("span", "um-icon");
    art.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-9 5-14 15-15 0 10-5 15-14 15"/><path d="M5 19c3-5 6-8 11-11"/></svg>';
    box.appendChild(art);
    box.appendChild(el("h3", "", "Your starting point will appear here."));
    box.appendChild(el("p", "", "There are no wrong answers. Pick the one that feels closest right now."));
    swap(box);
  }

  function show(i) {
    var f = UM_FINDER[i];
    var t = umToolById(f.tool);
    var next = umToolById(f.then);
    var box = el("div", "um-result");
    box.appendChild(el("p", "eyebrow", "A good place to begin"));
    var head = el("div", "um-result-head");
    var ic = el("span", "um-icon"); ic.innerHTML = umToolIcon(t);
    head.appendChild(ic);
    head.appendChild(el("h3", "", t.name));
    box.appendChild(head);
    box.appendChild(el("p", "um-result-why", f.why));
    var meta = el("div", "um-hero-meta");
    meta.appendChild(el("span", "um-tag" + (t.who === "Clinician-led" ? " um-tag-clinician" : ""), t.who));
    meta.appendChild(el("span", "um-tag", t.time));
    box.appendChild(meta);
    var go = el("a", "btn btn-primary btn-lg", "Start " + t.name);
    go.href = UM.carryHref(t.file);
    box.appendChild(go);
    var then = el("p", "um-result-then");
    then.appendChild(document.createTextNode("Afterwards, you might try "));
    var a = el("a", "", next.name);
    a.href = UM.carryHref(next.file);
    then.appendChild(a);
    then.appendChild(document.createTextNode("."));
    box.appendChild(then);
    swap(box);
  }

  UM_FINDER.forEach(function (f, i) {
    var label = el("label", "um-opt");
    var input = document.createElement("input");
    input.type = "radio"; input.name = "fd"; input.value = String(i);
    input.addEventListener("change", function () { show(i); });
    label.appendChild(input);
    label.appendChild(el("span", "", f.label));
    options.appendChild(label);
  });
  idle();

  /* ---------- Index ---------- */
  var index = $("um-index");
  var n = 0;
  UM_GROUPS.forEach(function (g) {
    var group = el("div", "um-index-group reveal");
    group.appendChild(el("h3", "um-index-title", g.title));
    g.tools.forEach(function (id) {
      var t = umToolById(id);
      n += 1;
      var row = el("a", "um-row");
      row.href = UM.carryHref(t.file);
      row.appendChild(el("span", "um-row-num", (n < 10 ? "0" : "") + n));
      var main = el("span", "um-row-main");
      main.appendChild(el("strong", "", t.name));
      main.appendChild(el("span", "um-row-blurb", t.blurb));
      row.appendChild(main);
      row.appendChild(el("span", "um-row-time", t.time));
      row.appendChild(el("span", "um-row-arrow", "→"));
      group.appendChild(row);
    });
    index.appendChild(group);
  });

  /* Reveal the rows we just added (main.js ran before they existed). */
  var rows = index.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    rows.forEach(function (r) { io.observe(r); });
  } else {
    rows.forEach(function (r) { r.classList.add("is-visible"); });
  }
})();
