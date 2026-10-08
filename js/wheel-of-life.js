(function () {
  "use strict";

  if (typeof WOL_DOMAINS === "undefined") return;

  /* ---------------------------------------------------------------------
   * STATE -- in-memory only. Nothing here is ever written to localStorage,
   * sessionStorage, a cookie, or sent anywhere. A reload starts over.
   * ------------------------------------------------------------------- */

  // Two-tone palette built from the site's own brand hues (teal, terracotta)
  // instead of a fixed 6-color cycle that started repeating past 6 domains.
  // Alternates hue by index and steps the lightness up every other domain,
  // so any count from 6 to 10 gets a full set of distinct, on-brand shades.
  var WHEEL_HUES = [198, 28];
  function lightnessForIndex(i) {
    var variant = Math.floor(i / 2);
    return Math.min(42 + variant * 8, 74);
  }
  function colorForIndex(i) {
    var hue = WHEEL_HUES[i % 2];
    return "hsl(" + hue + ", 38%, " + lightnessForIndex(i) + "%)";
  }
  // The in-wedge score number sits on top of colorForIndex's fill, which
  // ranges from a fairly dark teal/terracotta up to a pale tint -- white
  // text reads fine on the dark end but disappears on the light end, so
  // the number's color switches once the wedge gets light enough.
  function wedgeTextColorForIndex(i) {
    return lightnessForIndex(i) >= 60 ? "#2C3E44" : "#FFFFFF";
  }

  var domains = WOL_DOMAINS.map(function (d) {
    return { id: d.id, label: d.label, prompt: d.prompt, score: 5, importance: 5 };
  });
  var importanceEnabled = false;
  var debriefAnswers = {}; // question text -> typed note, survives rebuilding the list

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  // Shows one .wol-view, hides the rest, announces the change to screen
  // readers via the live region, and moves focus to the new view's heading.
  function showView(id) {
    var views = document.querySelectorAll(".wol-view");
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].id !== id;
    }
    var target = $(id);
    var heading = target ? target.querySelector("h1") : null;
    if (heading) {
      $("wol-live-region").textContent = heading.textContent;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function availableOptionalDomains() {
    var used = {};
    domains.forEach(function (d) { used[d.id] = true; });
    return WOL_OPTIONAL_DOMAINS.filter(function (d) { return !used[d.id]; });
  }

  function largestGapDomain() {
    var best = null;
    domains.forEach(function (d) {
      var gap = d.importance - d.score;
      if (best === null || gap > best.gap) best = { domain: d, gap: gap };
    });
    return best && best.gap > 0 ? best.domain : null;
  }

  /* ---------------------------------------------------------------------
   * INTRO
   * ------------------------------------------------------------------- */

  function renderIntro() {
    $("wol-opening-heading").textContent = WOL_COPY.opening.heading;
    $("wol-opening-attribution").textContent = WOL_COPY.opening.attribution;
    var body = $("wol-opening-body");
    body.innerHTML = "";
    WOL_COPY.opening.body.forEach(function (p) {
      var el = document.createElement("p");
      el.textContent = p;
      body.appendChild(el);
    });
    $("wol-meta-best-for").textContent = WOL_COPY.opening.meta.bestFor;
    $("wol-meta-time").textContent = WOL_COPY.opening.meta.time;
    $("wol-fine-print-top").textContent = WOL_STANDING_DISCLAIMER;
    $("wol-fine-print-bottom").textContent = WOL_STANDING_DISCLAIMER;
    $("wol-crisis-line-top").textContent = WOL_CRISIS_LINE;

    $("wol-scale-heading").textContent = WOL_COPY.scale.heading;
    $("wol-scale-helper").textContent = WOL_COPY.scale.helper;
    $("wol-importance-toggle-label").textContent = WOL_COPY.scale.importanceToggleLabel;
    $("wol-importance-helper").textContent = WOL_COPY.scale.importanceHelper;
    $("wol-see-wheel-btn").textContent = WOL_COPY.actions.seeWheel;
    $("wol-add-domain-label").textContent = WOL_COPY.scale.addDomainLabel;
    $("wol-results-heading").textContent = WOL_COPY.chart.heading;
    $("wol-edit-answers-btn").textContent = WOL_COPY.actions.editAnswers;
    $("wol-debrief-heading").textContent = WOL_COPY.debrief.heading;
    $("wol-debrief-helper").textContent = WOL_COPY.debrief.helper;
    $("wol-save-copy-btn").textContent = WOL_COPY.actions.saveCopy;
    $("wol-crisis-line-bottom").textContent = WOL_CRISIS_LINE;
  }

  /* ---------------------------------------------------------------------
   * DOMAIN LIST + SLIDERS
   * ------------------------------------------------------------------- */

  function renderDomainList() {
    var list = $("wol-domain-list");
    list.innerHTML = "";

    domains.forEach(function (domain, idx) {
      var row = document.createElement("div");
      row.className = "wol-domain-row";

      var head = document.createElement("div");
      head.className = "wol-domain-head";

      var swatch = document.createElement("span");
      swatch.className = "wol-domain-swatch";
      swatch.style.background = colorForIndex(idx);
      head.appendChild(swatch);

      var labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "wol-domain-label-input";
      labelInput.value = domain.label;
      labelInput.maxLength = 40;
      labelInput.setAttribute("aria-label", "Domain name");
      labelInput.addEventListener("input", function () {
        domain.label = labelInput.value;
      });
      head.appendChild(labelInput);

      if (domains.length > WOL_MIN_DOMAINS) {
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "wol-domain-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.setAttribute("aria-label", "Remove " + domain.label);
        removeBtn.addEventListener("click", function () {
          domains = domains.filter(function (d) { return d.id !== domain.id; });
          renderAll();
        });
        head.appendChild(removeBtn);
      }
      row.appendChild(head);

      var prompt = document.createElement("p");
      prompt.className = "wol-domain-prompt";
      prompt.textContent = domain.prompt || "";
      row.appendChild(prompt);

      row.appendChild(buildSliderRow(domain, "score", "Satisfaction", false));
      if (importanceEnabled) {
        row.appendChild(buildSliderRow(domain, "importance", WOL_COPY.scale.importanceSliderLabel, true));
      }

      list.appendChild(row);
    });

    renderAddDomainChips();
  }

  function buildSliderRow(domain, field, labelText, isImportance) {
    var row = document.createElement("div");
    row.className = "wol-slider-row";

    var label = document.createElement("span");
    label.className = "wol-slider-row-label";
    label.textContent = labelText;
    row.appendChild(label);

    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "10";
    slider.step = "1";
    slider.value = String(domain[field]);
    slider.className = "wol-slider" + (isImportance ? " wol-slider-importance" : "");
    slider.setAttribute("aria-label", labelText + " for " + domain.label);
    row.appendChild(slider);

    var value = document.createElement("span");
    value.className = "wol-slider-value";
    value.textContent = String(domain[field]);
    row.appendChild(value);

    slider.addEventListener("input", function () {
      domain[field] = parseInt(slider.value, 10);
      value.textContent = slider.value;
    });

    return row;
  }

  function renderAddDomainChips() {
    var wrap = $("wol-add-domain-chips");
    wrap.innerHTML = "";
    var atMax = domains.length >= WOL_MAX_DOMAINS;
    $("wol-domain-count-notice").hidden = !atMax;
    if (atMax) $("wol-domain-count-notice").textContent = WOL_COPY.scale.maxNotice;

    availableOptionalDomains().forEach(function (optional) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "wol-add-domain-chip";
      chip.textContent = "+ " + optional.label;
      chip.disabled = atMax;
      chip.addEventListener("click", function () {
        if (domains.length >= WOL_MAX_DOMAINS) return;
        domains.push({ id: optional.id, label: optional.label, prompt: optional.prompt, score: 5, importance: 5 });
        renderAll();
      });
      wrap.appendChild(chip);
    });
  }

  $("wol-importance-toggle").addEventListener("change", function () {
    importanceEnabled = this.checked;
    $("wol-importance-helper").hidden = !importanceEnabled;
    renderDomainList();
  });

  /* ---------------------------------------------------------------------
   * CHART -- an SVG "pizza slice" wheel: equal-angle wedges, one per
   * domain, filled from center out to a radius proportional to its score.
   * Concentric rings at 2/4/6/8/10 provide the scale. When importance
   * rating is on, a dashed arc per wedge overlays the importance score
   * without obscuring the satisfaction fill underneath it.
   * ------------------------------------------------------------------- */

  var NS = "http://www.w3.org/2000/svg";
  // The viewBox is much larger than the wedge circle itself (CHART_MAX_RADIUS)
  // so long domain labels sitting just outside the outer ring -- anchored
  // left or right of their point, not centered -- have room to render
  // without being clipped by the SVG's own edge.
  var CHART_SIZE = 640;
  var CHART_CENTER = CHART_SIZE / 2;
  var CHART_MAX_RADIUS = 150;

  function polarPoint(radius, angleDeg) {
    var rad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: CHART_CENTER + radius * Math.cos(rad),
      y: CHART_CENTER + radius * Math.sin(rad)
    };
  }

  function wedgePath(radius, angle0, angle1) {
    if (radius < 1) radius = 0.01;
    var p0 = polarPoint(radius, angle0);
    var p1 = polarPoint(radius, angle1);
    return "M " + CHART_CENTER + "," + CHART_CENTER +
      " L " + p0.x + "," + p0.y +
      " A " + radius + "," + radius + " 0 0 1 " + p1.x + "," + p1.y + " Z";
  }

  function arcPath(radius, angle0, angle1) {
    var p0 = polarPoint(radius, angle0);
    var p1 = polarPoint(radius, angle1);
    return "M " + p0.x + "," + p0.y + " A " + radius + "," + radius + " 0 0 1 " + p1.x + "," + p1.y;
  }

  function buildChart(svgEl) {
    svgEl.innerHTML = "";
    svgEl.setAttribute("viewBox", "0 0 " + CHART_SIZE + " " + CHART_SIZE);

    var n = domains.length;
    var step = 360 / n;

    // A soft drop shadow under the wedges lifts them off the page instead
    // of sitting flat against the grid -- defined once per chart and
    // applied to the group all wedges render into.
    var defs = document.createElementNS(NS, "defs");
    var filterId = "wol-wedge-shadow-" + Math.random().toString(36).slice(2, 8);
    var filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-20%");
    filter.setAttribute("y", "-20%");
    filter.setAttribute("width", "140%");
    filter.setAttribute("height", "140%");
    var shadow = document.createElementNS(NS, "feDropShadow");
    shadow.setAttribute("dx", "0");
    shadow.setAttribute("dy", "3");
    shadow.setAttribute("stdDeviation", "5");
    shadow.setAttribute("flood-color", "#2C3E44");
    shadow.setAttribute("flood-opacity", "0.22");
    filter.appendChild(shadow);
    defs.appendChild(filter);
    svgEl.appendChild(defs);

    // Concentric grid rings + the one on-axis scale label per ring.
    [2, 4, 6, 8, 10].forEach(function (v) {
      var r = (v / 10) * CHART_MAX_RADIUS;
      var circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", CHART_CENTER);
      circle.setAttribute("cy", CHART_CENTER);
      circle.setAttribute("r", r);
      circle.setAttribute("class", "wol-chart-grid");
      svgEl.appendChild(circle);

      var label = document.createElementNS(NS, "text");
      label.setAttribute("x", CHART_CENTER + 4);
      label.setAttribute("y", CHART_CENTER - r + 3);
      label.setAttribute("class", "wol-chart-ring-label");
      label.textContent = String(v);
      svgEl.appendChild(label);
    });

    // Spokes, one per wedge boundary.
    for (var s = 0; s < n; s++) {
      var spokePoint = polarPoint(CHART_MAX_RADIUS, s * step);
      var spoke = document.createElementNS(NS, "line");
      spoke.setAttribute("x1", CHART_CENTER);
      spoke.setAttribute("y1", CHART_CENTER);
      spoke.setAttribute("x2", spokePoint.x);
      spoke.setAttribute("y2", spokePoint.y);
      spoke.setAttribute("class", "wol-chart-spoke");
      svgEl.appendChild(spoke);
    }

    var wedgeGroup = document.createElementNS(NS, "g");
    wedgeGroup.setAttribute("filter", "url(#" + filterId + ")");
    svgEl.appendChild(wedgeGroup);

    domains.forEach(function (domain, i) {
      var angle0 = i * step;
      var angle1 = (i + 1) * step;
      var radius = (domain.score / 10) * CHART_MAX_RADIUS;
      var wedge = document.createElementNS(NS, "path");
      wedge.setAttribute("d", wedgePath(radius, angle0, angle1));
      wedge.setAttribute("class", "wol-chart-wedge");
      wedge.setAttribute("fill", colorForIndex(i));
      wedge.setAttribute("fill-opacity", "0.88");
      wedgeGroup.appendChild(wedge);

      if (importanceEnabled) {
        var impRadius = (domain.importance / 10) * CHART_MAX_RADIUS;
        var impArc = document.createElementNS(NS, "path");
        impArc.setAttribute("d", arcPath(Math.max(impRadius, 1), angle0, angle1));
        impArc.setAttribute("class", "wol-chart-wedge-importance");
        impArc.setAttribute("stroke", colorForIndex(i));
        svgEl.appendChild(impArc);
      }

      // Domain label just outside the outer ring, anchored toward whichever
      // side of the circle its wedge midpoint falls on so text doesn't run
      // off the chart or overlap the ring.
      var mid = angle0 + step / 2;
      var labelPoint = polarPoint(CHART_MAX_RADIUS + 14, mid);
      var normalized = ((mid % 360) + 360) % 360;
      var anchor = "middle";
      if (normalized > 10 && normalized < 170) anchor = "start";
      else if (normalized > 190 && normalized < 350) anchor = "end";
      var label = document.createElementNS(NS, "text");
      label.setAttribute("x", labelPoint.x);
      label.setAttribute("y", labelPoint.y);
      label.setAttribute("text-anchor", anchor);
      label.setAttribute("class", "wol-chart-domain-label");
      label.textContent = domain.label;
      svgEl.appendChild(label);

      // The score itself, inside the wedge. Placed at a fraction of the
      // wedge's own radius rather than a fixed distance, so it stays
      // inside the filled area at any score -- with a floor so a 0 or 1
      // score (a sliver, or nothing at all) still gets a legible number
      // instead of one buried at the very center. The floor needs to be
      // large enough that several adjacent low scores don't crowd their
      // numbers into each other right next to the hub -- the circumference
      // at a given radius is what actually separates neighboring wedges.
      var numberRadius = Math.min(Math.max(radius * 0.62, 40), CHART_MAX_RADIUS - 10);
      var numberPoint = polarPoint(numberRadius, mid);
      var number = document.createElementNS(NS, "text");
      number.setAttribute("x", numberPoint.x);
      number.setAttribute("y", numberPoint.y);
      number.setAttribute("text-anchor", "middle");
      number.setAttribute("dominant-baseline", "central");
      number.setAttribute("class", "wol-chart-wedge-number");
      // For a low score, the floor above pushes the number out past the
      // wedge's own (tiny or nonexistent) colored fill, onto the plain
      // page background -- using the fill-contrast color there is how a
      // "0" ends up white-on-white. Only trust that contrast calculation
      // when the number is actually sitting on the wedge's own color.
      number.setAttribute("fill", numberRadius <= radius ? wedgeTextColorForIndex(i) : "#2C3E44");
      number.textContent = String(domain.score);
      svgEl.appendChild(number);
    });

    // A small white hub over the point where every wedge meets -- without
    // it, a few low scores next to a few high ones leaves a visually messy
    // cluster of sharp corners right at the center.
    var hub = document.createElementNS(NS, "circle");
    hub.setAttribute("cx", CHART_CENTER);
    hub.setAttribute("cy", CHART_CENTER);
    hub.setAttribute("r", 7);
    hub.setAttribute("class", "wol-chart-hub");
    svgEl.appendChild(hub);
  }

  function renderChart() {
    buildChart($("wol-chart"));
  }

  /* ---------------------------------------------------------------------
   * RESULTS LEGEND -- concrete numbers to go with the big picture, since
   * the chart alone doesn't carry exact scores at a glance.
   * ------------------------------------------------------------------- */

  function renderResultsLegend() {
    var list = $("wol-results-legend");
    list.innerHTML = "";
    domains.forEach(function (domain, idx) {
      var li = document.createElement("li");

      var swatch = document.createElement("span");
      swatch.className = "wol-domain-swatch";
      swatch.style.background = colorForIndex(idx);
      li.appendChild(swatch);

      var label = document.createElement("span");
      label.className = "wol-legend-label";
      label.textContent = domain.label;
      li.appendChild(label);

      var track = document.createElement("span");
      track.className = "wol-legend-bar-track";
      var fill = document.createElement("span");
      fill.className = "wol-legend-bar-fill";
      fill.style.width = (domain.score * 10) + "%";
      fill.style.background = colorForIndex(idx);
      track.appendChild(fill);
      if (importanceEnabled) {
        var marker = document.createElement("span");
        marker.className = "wol-legend-importance-marker";
        marker.style.left = (domain.importance * 10) + "%";
        track.appendChild(marker);
      }
      li.appendChild(track);

      var strong = document.createElement("strong");
      strong.textContent = domain.score + "/10";
      li.appendChild(strong);

      list.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------------
   * DEBRIEF -- each question gets its own optional answer textarea, so the
   * on-screen version and the printed worksheet carry the same notes.
   * Answers are keyed by question text (not index) so they survive the
   * list being rebuilt on every "See my wheel" click.
   * ------------------------------------------------------------------- */

  function allDebriefQuestions() {
    return WOL_DEBRIEF_QUESTIONS.concat(importanceEnabled ? [WOL_COPY.debrief.importanceAddOn] : []);
  }

  function renderDebrief() {
    var list = $("wol-debrief-list");
    list.innerHTML = "";
    allDebriefQuestions().forEach(function (q, idx) {
      var item = document.createElement("div");
      item.className = "wol-debrief-item";
      var label = document.createElement("label");
      var textareaId = "wol-debrief-answer-" + idx;
      label.setAttribute("for", textareaId);
      label.textContent = q;
      var textarea = document.createElement("textarea");
      textarea.id = textareaId;
      textarea.rows = 2;
      textarea.placeholder = "Notes (optional)";
      textarea.value = debriefAnswers[q] || "";
      textarea.addEventListener("input", function () {
        debriefAnswers[q] = textarea.value;
        updatePrintSheet();
      });
      item.appendChild(label);
      item.appendChild(textarea);
      list.appendChild(item);
    });
    renderGapInsight();
  }

  function renderGapInsight() {
    var el = $("wol-gap-insight");
    if (!importanceEnabled) { el.hidden = true; return; }
    var top = largestGapDomain();
    if (!top) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = WOL_COPY.debrief.gapInsightTemplate.replace("{domain}", top.label);
  }

  /* ---------------------------------------------------------------------
   * RESULTS VIEW -- built fresh each time "See my wheel" is pressed, so it
   * always reflects the latest sliders.
   * ------------------------------------------------------------------- */

  function renderResults() {
    renderChart();
    renderResultsLegend();
    renderDebrief();
    updatePrintSheet();
  }

  $("wol-see-wheel-btn").addEventListener("click", function () {
    renderResults();
    showView("wol-view-results");
  });

  $("wol-edit-answers-btn").addEventListener("click", function () {
    showView("wol-view-rate");
  });

  /* ---------------------------------------------------------------------
   * PRINT SHEET -- a typed textarea value doesn't reliably print in every
   * browser, so each answer is read out into plain markup here rather
   * than relying on the on-screen textarea to print itself. No answer
   * typed means a blank ruled line is left for a pen instead.
   * ------------------------------------------------------------------- */

  function updatePrintSheet() {
    var chartHolder = $("wol-print-chart");
    chartHolder.innerHTML = "";
    var printSvg = document.createElementNS(NS, "svg");
    buildChart(printSvg);
    chartHolder.appendChild(printSvg);

    var scores = $("wol-print-scores");
    scores.innerHTML = "";
    domains.forEach(function (d) {
      var row = document.createElement("div");
      row.className = "wol-print-score-row";
      var label = document.createElement("span");
      label.textContent = d.label;
      var value = document.createElement("span");
      value.textContent = d.score + "/10" + (importanceEnabled ? " (importance " + d.importance + ")" : "");
      row.appendChild(label);
      row.appendChild(value);
      scores.appendChild(row);
    });

    var questions = $("wol-print-questions");
    questions.innerHTML = "";
    allDebriefQuestions().forEach(function (q) {
      var block = document.createElement("div");
      block.className = "wol-print-question";
      var p = document.createElement("p");
      p.className = "wol-print-question-text";
      p.textContent = q;
      block.appendChild(p);
      var answer = debriefAnswers[q];
      if (answer) {
        var answerP = document.createElement("p");
        answerP.textContent = answer;
        block.appendChild(answerP);
      } else {
        var blank = document.createElement("span");
        blank.className = "wol-print-answer-blank";
        block.appendChild(blank);
      }
      questions.appendChild(block);
    });

    $("wol-print-disclaimer").textContent = WOL_STANDING_DISCLAIMER;
    $("wol-print-crisis").textContent = WOL_CRISIS_LINE;
  }

  $("wol-save-copy-btn").addEventListener("click", function () {
    window.print();
  });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  function renderAll() {
    renderDomainList();
  }

  renderIntro();
  renderAll();
  showView("wol-view-rate");
})();
