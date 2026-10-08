(function () {
  "use strict";

  if (typeof SudsCalc === "undefined") return;

  var INTERVAL_PRESETS = [30, 60, 90, 120, 300];

  // Chart series colors, brand-only, cycled per exposure in the order run.
  var CHART_COLORS = ["#1A525A", "#6F8236", "#2F7F86", "#B5653D", "#7FB0AC", "#C3CE8A"];

  /* ---------------------------------------------------------------------
   * STATE — in-memory only. A client's ratings are never written to
   * localStorage, sessionStorage, a cookie, or sent anywhere; nothing is
   * stored. A
   * reload starts over; that is the correct, intended consequence of
   * storing nothing about a session.
   * ------------------------------------------------------------------- */

  var session = null;              // { clientInitials, measureLabel, exposures: [] }
  var currentExposure = null;      // the exposure currently being set up or run
  var exposureCounter = 0;         // for default "Exposure N" labels
  var preSudsValue = null;         // selection in progress on the exposure-setup scale
  var exposureSetupReturnView = "st-view-session-setup";

  var timerIntervalId = null;
  var lastCheckinElapsed = 0;
  var ratingDue = false;
  var muted = false;
  var audioCtx = null;

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }


  function exposureColor(idx) { return CHART_COLORS[idx % CHART_COLORS.length]; }

  // Interpolates between --color-primary (1) and --color-accent (10) so
  // the SUDS scale reads calm-to-distressed using only brand colors.
  var SUDS_LOW = { r: 0x71, g: 0x9C, b: 0xA8 };
  var SUDS_HIGH = { r: 0xC9, g: 0x8A, b: 0x5E };
  function sudsColorForValue(value) {
    var t = (value - 1) / 9;
    var r = Math.round(SUDS_LOW.r + (SUDS_HIGH.r - SUDS_LOW.r) * t);
    var g = Math.round(SUDS_LOW.g + (SUDS_HIGH.g - SUDS_LOW.g) * t);
    var b = Math.round(SUDS_LOW.b + (SUDS_HIGH.b - SUDS_LOW.b) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function formatIntervalPresetLabel(sec) {
    if (sec < 60) return sec + "s";
    var mins = sec / 60;
    return (mins % 1 === 0 ? mins : mins.toFixed(1)) + " min";
  }

  // Shows one .st-view, hides the rest, announces the change to screen
  // reader users via the live region, moves focus to the new step's
  // heading (visible or screen-reader-only), and scrolls it into view
  // below the sticky header -- mirrors showView() in
  // js/avoidance-calculator.js.
  function showView(id) {
    var views = document.querySelectorAll(".st-view");
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].id !== id;
    }
    var target = $(id);
    var heading = target ? target.querySelector("h1") : null;
    if (heading) {
      $("st-live-region").textContent = heading.textContent;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    var header = document.querySelector(".site-header");
    var headerHeight = header ? header.getBoundingClientRect().height : 0;
    var hero = document.querySelector(".st-page-hero");
    if (hero) {
      var top = hero.getBoundingClientRect().bottom + window.scrollY - headerHeight - 10;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }
  }

  /* ---------------------------------------------------------------------
   * AUDIO CHIME — a short sine-wave beep via Web Audio API, no external
   * asset. The AudioContext is created lazily on the "Start Exposure"
   * click (a real user gesture), so later beeps fired from setInterval
   * during the exposure are already inside an unlocked audio context.
   * ------------------------------------------------------------------- */

  function ensureAudioContext() {
    if (audioCtx) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } catch (e) { audioCtx = null; }
  }

  function playChime() {
    if (muted || !audioCtx) return;
    try {
      var t0 = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    } catch (e) { /* a missed chime should never block the session */ }
  }

  /* ---------------------------------------------------------------------
   * SUDS SCALE — shared 1-10 button row, used for the pre-exposure rating
   * and every in-session rating (interval, manual, final).
   * ------------------------------------------------------------------- */

  // Rebuilds the button row, replacing (not just restyling) every button --
  // which destroys whichever one was just clicked. If that button held
  // focus, the browser drops focus to <body> by default, and on this
  // page's layout that has been observed to trigger an unwanted
  // horizontal auto-scroll (the off-canvas mobile nav sits to the right
  // of the viewport). Re-focusing the new selected button, in the same
  // synchronous click handler, keeps focus somewhere real instead.
  function renderSudsScale(container, selectedValue, onPick) {
    container.innerHTML = "";
    var selectedBtn = null;
    for (var n = 1; n <= 10; n++) {
      (function (v) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "st-suds-btn" + (v === selectedValue ? " st-suds-selected" : "");
        btn.textContent = String(v);
        btn.setAttribute("aria-pressed", v === selectedValue ? "true" : "false");
        if (v === selectedValue) {
          btn.style.background = sudsColorForValue(v);
          selectedBtn = btn;
        }
        btn.addEventListener("click", function () { onPick(v); });
        container.appendChild(btn);
      })(n);
    }
    if (selectedBtn) selectedBtn.focus({ preventScroll: true });
  }

  function onPickPreSuds(v) {
    preSudsValue = v;
    renderSudsScale($("st-presuds-scale"), v, onPickPreSuds);
    $("st-exposure-start-btn").disabled = false;
  }

  /* ---------------------------------------------------------------------
   * OPENING / SESSION SETUP
   * ------------------------------------------------------------------- */

  function resetSession() {
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
    session = null;
    currentExposure = null;
    exposureCounter = 0;
    preSudsValue = null;
    ratingDue = false;
  }

  function attemptStart() {
    resetSession();
    $("st-client-initials").value = "";
    $("st-measure-label").value = "Distress";
    showView("st-view-session-setup");
  }

  $("st-start-btn").addEventListener("click", attemptStart);

  $("st-session-back-btn").addEventListener("click", function () {
    showView("st-view-opening");
  });

  $("st-session-continue-btn").addEventListener("click", function () {
    var measureLabel = $("st-measure-label").value.trim() || "Distress";
    session = {
      clientInitials: $("st-client-initials").value.trim(),
      measureLabel: measureLabel,
      exposures: []
    };
    exposureSetupReturnView = "st-view-session-setup";
    initExposureSetup();
  });

  /* ---------------------------------------------------------------------
   * EXPOSURE SETUP (repeats for exposure 2, 3, ...)
   * ------------------------------------------------------------------- */

  function renderIntervalPresets(selectedSeconds) {
    var container = $("st-interval-presets");
    container.innerHTML = "";
    INTERVAL_PRESETS.forEach(function (sec) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "st-interval-preset-btn" + (sec === selectedSeconds ? " st-interval-selected" : "");
      btn.textContent = formatIntervalPresetLabel(sec);
      btn.addEventListener("click", function () {
        $("st-interval-input").value = String(sec);
        renderIntervalPresets(sec);
      });
      container.appendChild(btn);
    });
  }

  $("st-interval-input").addEventListener("input", function () {
    var v = parseInt(this.value, 10);
    renderIntervalPresets(isNaN(v) ? null : v);
  });

  function initExposureSetup() {
    $("st-exposure-setup-heading").textContent = "Set up Exposure " + (session.exposures.length + 1);
    $("st-exposure-label").value = "";
    var lastInterval = session.exposures.length
      ? session.exposures[session.exposures.length - 1].intervalSeconds
      : 60;
    $("st-interval-input").value = String(lastInterval);
    renderIntervalPresets(lastInterval);
    preSudsValue = null;
    var lowerLabel = session.measureLabel.toLowerCase();
    $("st-presuds-heading").textContent =
      "Rate " + lowerLabel + " right now, before starting: 1 (lowest) to 10 (highest)";
    renderSudsScale($("st-presuds-scale"), null, onPickPreSuds);
    $("st-exposure-start-btn").disabled = true;
    showView("st-view-exposure-setup");
  }

  $("st-exposure-setup-back-btn").addEventListener("click", function () {
    showView(exposureSetupReturnView);
  });

  $("st-exposure-start-btn").addEventListener("click", function () {
    if (preSudsValue === null) return;
    var intervalSeconds = parseInt($("st-interval-input").value, 10);
    if (isNaN(intervalSeconds) || intervalSeconds < 5) intervalSeconds = 60;
    var labelInput = $("st-exposure-label").value.trim();
    exposureCounter++;
    var label = labelInput || ("Exposure " + exposureCounter);
    var now = Date.now();
    currentExposure = {
      id: exposureCounter,
      label: label,
      intervalSeconds: intervalSeconds,
      startedAt: now,
      endedAt: null,
      ratings: [{ elapsedSeconds: 0, suds: preSudsValue, timestamp: new Date(now).toISOString(), isPre: true, isFinal: false }]
    };
    session.exposures.push(currentExposure);
    ensureAudioContext();
    startLiveExposure();
  });

  /* ---------------------------------------------------------------------
   * LIVE EXPOSURE — the stopwatch, interval prompts, and manual logging
   * ------------------------------------------------------------------- */

  function startLiveExposure() {
    lastCheckinElapsed = 0;
    ratingDue = false;
    $("st-live-exposure-badge").textContent = currentExposure.label;
    $("st-stopwatch-card").classList.remove("st-pulse");
    $("st-rating-panel").hidden = true;
    $("st-timer-display").textContent = "00:00";
    renderLiveLog();
    updateCheckinUI(0);
    showView("st-view-exposure-live");
    timerIntervalId = setInterval(tickTimer, 1000);
  }

  function tickTimer() {
    var elapsed = Math.floor((Date.now() - currentExposure.startedAt) / 1000);
    $("st-timer-display").textContent = SudsCalc.formatElapsed(elapsed);
    updateCheckinUI(elapsed);
    if (!ratingDue && (elapsed - lastCheckinElapsed) >= currentExposure.intervalSeconds) {
      triggerRatingDue();
    }
  }

  function updateCheckinUI(elapsed) {
    var sinceLast = elapsed - lastCheckinElapsed;
    var remaining = Math.max(0, currentExposure.intervalSeconds - sinceLast);
    var pct = Math.min(100, (sinceLast / currentExposure.intervalSeconds) * 100);
    $("st-checkin-fill").style.width = pct + "%";
    $("st-next-checkin-label").textContent = ratingDue
      ? "Check-in due"
      : "Next check-in in " + SudsCalc.formatElapsed(remaining);
  }

  function triggerRatingDue() {
    ratingDue = true;
    $("st-stopwatch-card").classList.add("st-pulse");
    playChime();
    var lowerLabel = session.measureLabel.toLowerCase();
    $("st-rating-heading").textContent = "Rate " + lowerLabel + " right now: 1 (lowest) to 10 (highest)";
    renderSudsScale($("st-rating-scale"), null, function (v) { handleRatingPick(v, { isFinal: false }); });
    $("st-rating-panel").hidden = false;
    $("st-live-region").textContent = "Time for a " + lowerLabel + " check-in.";
  }

  function handleRatingPick(value, opts) {
    var elapsed = Math.floor((Date.now() - currentExposure.startedAt) / 1000);
    currentExposure.ratings.push({
      elapsedSeconds: elapsed,
      suds: value,
      timestamp: new Date().toISOString(),
      isPre: false,
      isFinal: !!(opts && opts.isFinal)
    });
    lastCheckinElapsed = elapsed;
    ratingDue = false;
    $("st-stopwatch-card").classList.remove("st-pulse");
    $("st-rating-panel").hidden = true;
    // Hiding the panel drops focus from whichever scale button was just
    // clicked; without somewhere else to land, the browser reverts focus
    // to <body>, which has been observed to trigger an unwanted
    // horizontal auto-scroll on this layout (see renderSudsScale's own
    // comment for the same issue). Redirect it to the card itself when
    // staying on this view; a final rating moves to a new view next,
    // and showView() there takes care of focus on its own heading.
    if (!(opts && opts.isFinal)) {
      $("st-stopwatch-card").focus({ preventScroll: true });
    }
    renderLiveLog();
    $("st-live-region").textContent = "Logged " + value + ".";
    if (opts && opts.isFinal) finalizeExposure();
  }

  $("st-manual-log-btn").addEventListener("click", function () {
    if (!currentExposure || currentExposure.endedAt) return;
    $("st-rating-heading").textContent = "Log a rating now: 1 (lowest) to 10 (highest)";
    renderSudsScale($("st-rating-scale"), null, function (v) { handleRatingPick(v, { isFinal: false }); });
    $("st-rating-panel").hidden = false;
    ratingDue = true; // suppresses the automatic prompt while this is open; reset on pick
  });

  $("st-mute-toggle").addEventListener("change", function () {
    muted = this.checked;
  });

  $("st-end-exposure-btn").addEventListener("click", function () {
    if (!currentExposure || currentExposure.endedAt) return;
    if (timerIntervalId) { clearInterval(timerIntervalId); timerIntervalId = null; }
    $("st-stopwatch-card").classList.remove("st-pulse");
    $("st-rating-heading").textContent = "One last rating before closing this out: 1 (lowest) to 10 (highest)";
    renderSudsScale($("st-rating-scale"), null, function (v) { handleRatingPick(v, { isFinal: true }); });
    $("st-rating-panel").hidden = false;
    ratingDue = true;
  });

  function renderLiveLog() {
    var list = $("st-live-log");
    list.innerHTML = "";
    currentExposure.ratings.forEach(function (r) {
      var li = document.createElement("li");
      var timeSpan = document.createElement("span");
      timeSpan.className = "st-log-time";
      timeSpan.textContent = SudsCalc.formatElapsed(r.elapsedSeconds);
      var sudsSpan = document.createElement("span");
      sudsSpan.className = "st-log-suds";
      sudsSpan.textContent = session.measureLabel + ": " + r.suds;
      if (r.isPre || r.isFinal) {
        var tag = document.createElement("span");
        tag.className = "st-log-tag";
        tag.textContent = r.isPre ? "Pre" : "Final";
        sudsSpan.appendChild(tag);
      }
      li.appendChild(timeSpan);
      li.appendChild(sudsSpan);
      list.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------------
   * CHART — shared by the single-exposure "complete" view and the
   * multi-exposure "summary" view; both just pass a different-length array.
   * ------------------------------------------------------------------- */

  function renderChart(svgEl, exposures) {
    var width = 560, height = 260;
    var padding = { top: 20, right: 20, bottom: 34, left: 34 };
    var scale = SudsCalc.buildChartScale(exposures, width, height, padding);
    var ns = "http://www.w3.org/2000/svg";
    svgEl.innerHTML = "";

    [2, 4, 6, 8, 10].forEach(function (v) {
      var y = scale.yForSuds(v);
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", padding.left);
      line.setAttribute("x2", width - padding.right);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("class", "st-chart-grid");
      svgEl.appendChild(line);

      var label = document.createElementNS(ns, "text");
      label.setAttribute("x", padding.left - 8);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("class", "st-chart-axis-label");
      label.textContent = String(v);
      svgEl.appendChild(label);
    });

    var maxE = scale.maxElapsedSeconds;
    [0, maxE / 2, maxE].forEach(function (sec, i) {
      var x = scale.xForSeconds(sec);
      var label = document.createElementNS(ns, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", height - padding.bottom + 18);
      label.setAttribute("text-anchor", i === 0 ? "start" : (i === 2 ? "end" : "middle"));
      label.setAttribute("class", "st-chart-axis-label");
      label.textContent = SudsCalc.formatElapsed(sec);
      svgEl.appendChild(label);
    });

    exposures.forEach(function (exp, idx) {
      var points = SudsCalc.ratingsToPoints(exp.ratings || [], scale);
      if (!points.length) return;
      var color = exposureColor(idx);

      var poly = document.createElementNS(ns, "polyline");
      poly.setAttribute("points", points.map(function (p) { return p.x + "," + p.y; }).join(" "));
      poly.setAttribute("class", "st-chart-line");
      poly.setAttribute("stroke", color);
      svgEl.appendChild(poly);

      points.forEach(function (p) {
        var dot = document.createElementNS(ns, "circle");
        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
        dot.setAttribute("r", 4.5);
        dot.setAttribute("class", "st-chart-dot");
        dot.setAttribute("fill", color);
        svgEl.appendChild(dot);
      });
    });
  }

  /* ---------------------------------------------------------------------
   * EXPOSURE COMPLETE
   * ------------------------------------------------------------------- */

  function formatSignedChange(change) {
    if (change > 0) return "+" + change;
    if (change < 0) return "−" + Math.abs(change);
    return "±0";
  }

  function renderExposureStats(container, exposure) {
    var s = SudsCalc.exposureSummary(exposure);
    var change = s.endSuds - s.preSuds;
    container.innerHTML = "";
    [
      { label: "Pre-exposure", value: s.preSuds },
      { label: "Peak (" + SudsCalc.formatElapsed(s.peakElapsedSeconds) + ")", value: s.peakSuds },
      { label: "End", value: s.endSuds },
      { label: "Net change", value: formatSignedChange(change) }
    ].forEach(function (it) {
      var div = document.createElement("div");
      div.className = "st-stat";
      var val = document.createElement("div");
      val.className = "st-stat-value";
      val.textContent = String(it.value);
      var lab = document.createElement("div");
      lab.className = "st-stat-label";
      lab.textContent = it.label;
      div.appendChild(val);
      div.appendChild(lab);
      container.appendChild(div);
    });
  }

  function finalizeExposure() {
    currentExposure.endedAt = Date.now();
    $("st-complete-exposure-label").textContent = currentExposure.label;
    renderChart($("st-complete-chart"), [currentExposure]);
    renderExposureStats($("st-complete-stats"), currentExposure);
    showView("st-view-exposure-complete");
  }

  $("st-run-another-btn").addEventListener("click", function () {
    exposureSetupReturnView = "st-view-exposure-complete";
    initExposureSetup();
  });

  $("st-finish-session-btn").addEventListener("click", function () {
    renderSummary();
    showView("st-view-summary");
  });

  /* ---------------------------------------------------------------------
   * SESSION SUMMARY / COMPARE
   * ------------------------------------------------------------------- */

  function renderLegend(container, exposures) {
    container.innerHTML = "";
    exposures.forEach(function (exp, idx) {
      var item = document.createElement("div");
      item.className = "st-legend-item";
      var swatch = document.createElement("span");
      swatch.className = "st-legend-swatch";
      swatch.style.background = exposureColor(idx);
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(exp.label));
      container.appendChild(item);
    });
  }

  function renderSummaryTable(exposures) {
    var body = $("st-summary-table-body");
    body.innerHTML = "";
    exposures.forEach(function (exp) {
      var s = SudsCalc.exposureSummary(exp);
      var change = s.endSuds - s.preSuds;
      var tr = document.createElement("tr");
      [exp.label, SudsCalc.formatElapsed(s.durationSeconds), s.preSuds, s.peakSuds, s.endSuds, formatSignedChange(change)]
        .forEach(function (text) {
          var td = document.createElement("td");
          td.textContent = String(text);
          tr.appendChild(td);
        });
      body.appendChild(tr);
    });
  }

  function renderTrendNote(exposures) {
    var el = $("st-trend-note");
    if (exposures.length < 2) { el.hidden = true; return; }
    var summaries = exposures.map(SudsCalc.exposureSummary);
    var peaks = summaries.map(function (s) { return s.peakSuds; });
    var trend = SudsCalc.crossExposureTrend(exposures);
    var label = session.measureLabel.toLowerCase();
    var sentence;
    if (trend.peakTrend === "decreasing" && trend.peakDeltaFirstToLast > 0) {
      sentence = "Peak " + label + " decreased across exposures, from " + peaks[0] + " to " + peaks[peaks.length - 1] + ".";
    } else if (trend.peakTrend === "increasing") {
      sentence = "Peak " + label + " increased across exposures, from " + peaks[0] + " to " + peaks[peaks.length - 1] + ".";
    } else if (trend.peakTrend === "flat") {
      sentence = "Peak " + label + " stayed about the same across exposures.";
    } else {
      sentence = "Peak " + label + " didn't move in one consistent direction across these exposures.";
    }
    el.textContent = sentence + " Numbers as entered — not a clinical interpretation.";
    el.hidden = false;
  }

  function renderSummary() {
    var exposures = session.exposures;
    $("st-summary-intro").textContent = exposures.length > 1
      ? "Comparing " + exposures.length + " exposures from this session, all on the same " + session.measureLabel.toLowerCase() + " scale."
      : "One exposure completed this session.";
    renderChart($("st-summary-chart"), exposures);
    renderLegend($("st-summary-legend"), exposures);
    renderSummaryTable(exposures);
    renderTrendNote(exposures);
    populatePrintSheet();
  }

  $("st-add-exposure-btn").addEventListener("click", function () {
    exposureSetupReturnView = "st-view-summary";
    initExposureSetup();
  });

  $("st-new-session-btn").addEventListener("click", function () {
    resetSession();
    showView("st-view-opening");
  });

  /* ---------------------------------------------------------------------
   * PRINT SHEET
   * ------------------------------------------------------------------- */

  function populatePrintSheet() {
    var dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    var metaParts = ["Session date: " + dateStr];
    if (session.clientInitials) metaParts.push("Client: " + session.clientInitials);
    metaParts.push("Rating: " + session.measureLabel + " (1 lowest – 10 highest)");
    $("st-print-meta").textContent = metaParts.join("  ·  ");

    var container = $("st-print-exposures");
    container.innerHTML = "";
    session.exposures.forEach(function (exp, idx) {
      var s = SudsCalc.exposureSummary(exp);
      var wrap = document.createElement("div");
      wrap.className = "st-print-exposure";

      var h3 = document.createElement("h3");
      h3.textContent = (idx + 1) + ". " + exp.label;
      wrap.appendChild(h3);

      var summaryP = document.createElement("p");
      summaryP.textContent = "Duration " + SudsCalc.formatElapsed(s.durationSeconds) +
        "  ·  Pre " + s.preSuds +
        "  ·  Peak " + s.peakSuds + " (" + SudsCalc.formatElapsed(s.peakElapsedSeconds) + ")" +
        "  ·  End " + s.endSuds;
      wrap.appendChild(summaryP);

      var table = document.createElement("table");
      table.className = "st-print-rating-table";
      var thead = document.createElement("thead");
      var headRow = document.createElement("tr");
      ["Time", "Elapsed", session.measureLabel].forEach(function (text) {
        var th = document.createElement("th");
        th.textContent = text;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement("tbody");
      exp.ratings.forEach(function (r) {
        var tr = document.createElement("tr");
        var timeTd = document.createElement("td");
        timeTd.textContent = new Date(r.timestamp).toLocaleTimeString();
        var elapsedTd = document.createElement("td");
        elapsedTd.textContent = SudsCalc.formatElapsed(r.elapsedSeconds);
        var sudsTd = document.createElement("td");
        sudsTd.textContent = r.suds + (r.isPre ? " (pre)" : r.isFinal ? " (final)" : "");
        tr.appendChild(timeTd);
        tr.appendChild(elapsedTd);
        tr.appendChild(sudsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      container.appendChild(wrap);
    });

    var trendEl = $("st-print-trend");
    if (session.exposures.length > 1) {
      trendEl.textContent = $("st-trend-note").textContent;
      trendEl.hidden = false;
    } else {
      trendEl.textContent = "";
      trendEl.hidden = true;
    }
  }

  $("st-print-btn").addEventListener("click", function () { window.print(); });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  showView("st-view-opening");
})();
