/* Packet flow -- walks a patient from one tool to the next.
 *
 * A packet is just an ordered list of tool ids in the URL (?flow=a,b,c).
 * Nothing about the patient is involved; the list is the provider's choice.
 * On a tool page this adds a step bar under the header and a "next" panel
 * after the exercise. With no packet it offers a few other tools to explore.
 */
var UMFlow = (function () {
  "use strict";

  var MAX = 8;

  function parse(str) {
    var seen = {}, out = [];
    (str || "").split(",").forEach(function (id) {
      id = id.trim();
      if (!seen[id] && umToolById(id) && out.length < MAX) { seen[id] = true; out.push(id); }
    });
    return out;
  }

  var ids = [];
  try { ids = parse(new URLSearchParams(window.location.search).get("flow")); } catch (e) { /* none */ }

  function currentId() {
    var m = window.location.pathname.match(/([^\/]+)\.html$/);
    return m ? m[1] : "";
  }

  function href(id) { return UM.carryHref(id + ".html"); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function renderBar(idx) {
    var bar = document.getElementById("um-flow");
    if (!bar) return;
    bar.textContent = "";
    var inner = el("div", "container um-flow-inner");
    inner.appendChild(el("span", "um-flow-label", "Your packet · Step " + (idx + 1) + " of " + ids.length));
    var list = el("ol", "um-flow-steps");
    ids.forEach(function (id, i) {
      var li = el("li", i < idx ? "is-done" : i === idx ? "is-current" : "");
      var t = umToolById(id);
      if (i === idx) {
        li.appendChild(el("span", "", t.name));
        li.setAttribute("aria-current", "step");
      } else {
        var a = el("a", "", t.name);
        a.href = href(id);
        li.appendChild(a);
      }
      list.appendChild(li);
    });
    inner.appendChild(list);
    bar.appendChild(inner);
    bar.hidden = false;
  }

  function mount(node) {
    var main = document.querySelector("main");
    if (main) main.appendChild(node);
  }

  function renderNext(idx) {
    var wrap = el("section", "um-next");
    var inner = el("div", "container");
    var card = el("div", "um-next-card");
    var nextId = ids[idx + 1];
    if (nextId) {
      var t = umToolById(nextId);
      card.appendChild(el("p", "eyebrow", "Next in your packet"));
      var h = el("h2", "", t.name);
      card.appendChild(h);
      card.appendChild(el("p", "", t.blurb));
      card.appendChild(el("p", "small", "Finished here? Save or print this one first, using the Save & share button. Then continue."));
      var a = el("a", "btn btn-primary btn-lg", "Continue to " + t.name);
      a.href = href(nextId);
      card.appendChild(a);
    } else {
      card.appendChild(el("p", "eyebrow", "Packet complete"));
      card.appendChild(el("h2", "", "That’s the last exercise."));
      card.appendChild(el("p", "", "Save or print what you completed and bring it to your provider. Nothing you entered was sent anywhere."));
      var b = el("a", "btn btn-outline btn-lg", "Back to the packet overview");
      b.href = href("packet");
      card.appendChild(b);
    }
    inner.appendChild(card);
    wrap.appendChild(inner);
    mount(wrap);
  }

  function renderMore(cur) {
    var picks = UM_NEXT[cur];
    if (!picks) return;
    var wrap = el("section", "um-more");
    var inner = el("div", "container");
    inner.appendChild(el("p", "eyebrow", "What to try next"));
    inner.appendChild(el("h2", "", "Where to go from here"));
    var list = el("div", "um-suggest");
    picks.forEach(function (p) {
      var t = umToolById(p.id);
      var a = el("a", "um-suggest-row");
      a.href = href(t.id);
      var ic = el("span", "um-icon"); ic.innerHTML = umToolIcon(t);
      a.appendChild(ic);
      var body = el("span", "um-suggest-body");
      body.appendChild(el("strong", "", t.name));
      body.appendChild(el("span", "", p.why));
      a.appendChild(body);
      a.appendChild(el("span", "um-row-time", t.time));
      a.appendChild(el("span", "um-row-arrow", "\u2192"));
      list.appendChild(a);
    });
    var all = el("a", "um-suggest-all", "Browse every exercise \u2192");
    all.href = href("index") + "#exercises";
    list.appendChild(all);
    inner.appendChild(list);
    wrap.appendChild(inner);
    mount(wrap);
  }

  /* Tool icon + one-line description in the page hero. */
  function decorateHero(tool) {
    var hero = document.querySelector(".page-hero .container");
    var eyebrow = hero && hero.querySelector(".eyebrow");
    if (!eyebrow || hero.querySelector(".um-hero-row")) return;
    var row = el("div", "um-hero-row");
    var ic = el("span", "um-icon"); ic.innerHTML = umToolIcon(tool);
    eyebrow.parentNode.insertBefore(row, eyebrow);
    row.appendChild(ic); row.appendChild(eyebrow);
    hero.appendChild(el("p", "um-hero-blurb", tool.blurb));
    var meta = el("div", "um-hero-meta");
    meta.appendChild(el("span", "um-tag" + (tool.who === "Clinician-led" ? " um-tag-clinician" : ""), tool.who));
    meta.appendChild(el("span", "um-tag", tool.time));
    hero.appendChild(meta);
  }

  function init() {
    var cur = currentId();
    if (!umToolById(cur)) return;
    decorateHero(umToolById(cur));
    var idx = ids.indexOf(cur);
    if (idx !== -1) { renderBar(idx); renderNext(idx); }
    else renderMore(cur);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { ids: ids, parse: parse, href: href };
})();
