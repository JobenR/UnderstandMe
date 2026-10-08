/* Small interface touches shared by every page: reading progress, and
   warming up the next page so cross-page transitions feel instant. */
(function () {
  "use strict";

  var bar = document.getElementById("um-progress");
  if (bar) {
    var ticking = false;
    var update = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ")";
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  var warmed = {};
  function warm(a) {
    var href = a.getAttribute("href") || "";
    if (!/^[a-z0-9-]+\.html/i.test(href)) return;
    var file = href.split(/[?#]/)[0];
    if (warmed[file]) return;
    warmed[file] = true;
    var l = document.createElement("link");
    l.rel = "prefetch"; l.href = file;
    document.head.appendChild(l);
  }
  document.addEventListener("pointerover", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (a) warm(a);
  }, { passive: true });
})();
