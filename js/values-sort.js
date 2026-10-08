(function () {
  "use strict";

  var TOP_N = 10;

  /* ---------------------------------------------------------------------
   * STATE
   * ------------------------------------------------------------------- */

  var deck = [];
  var currentIndex = 0;
  var sortResults = {}; // name -> 'most' | 'important' | 'not'
  var history = [];
  var parePool = [];
  var selectedNames = {};
  var top10Pool = [];
  var remainingRankPool = [];
  var rankedList = [];
  var userName = "";
  var alignmentScores = {}; // name -> 1-10, how consistently it's currently lived
  var alignmentIndex = 0;
  var reflections = {}; // name -> { toward, away }

  var PROGRESS_KEY = "vs_progress";
  var HISTORY_KEY = "vs_sort_history";
  var REFLECTIONS_KEY = "vs_reflections";

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function showView(id) {
    var views = document.querySelectorAll(".vs-view");
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].id !== id;
    }
    // Collapse the "What It Is" explainer once the sort is underway so the
    // exercise itself sits right below the header; it reappears if the
    // person returns to the intro screen (e.g. after clicking "Start a New Sort").
    var explainer = $("vs-explainer-section");
    if (explainer) explainer.hidden = id !== "view-intro";
    window.scrollTo({ top: document.querySelector(".page-hero").getBoundingClientRect().bottom + window.scrollY - 20, behavior: "smooth" });
  }

  /* ---------------------------------------------------------------------
   * INTRO / GATING
   * ------------------------------------------------------------------- */

  function initIntroCopy() {
    var intro = $("view-intro");
    if (intro && typeof VALUES_DATA !== "undefined") {
      intro.innerHTML = intro.innerHTML.replace("{{TOTAL}}", VALUES_DATA.length);
    }
  }

  function attemptStart() {
    userName = ($("vs-name") && $("vs-name").value.trim()) || "";
    deck = shuffle(typeof VALUES_DATA !== "undefined" ? VALUES_DATA : []);
    currentIndex = 0;
    sortResults = {};
    history = [];
    alignmentScores = {};
    reflections = {};
    safeRemove(REFLECTIONS_KEY);
    saveProgress();
    showView("view-sorting");
    renderCurrentCard();
  }

  /* ---------------------------------------------------------------------
   * SORTING (one card at a time)
   * ------------------------------------------------------------------- */

  function saveProgress() {
    safeSet(PROGRESS_KEY, JSON.stringify({
      names: deck.map(function (v) { return v.name; }),
      currentIndex: currentIndex,
      sortResults: sortResults,
      userName: userName
    }));
  }

  function clearProgress() {
    safeRemove(PROGRESS_KEY);
  }

  function tryResumeProgress() {
    var raw = safeGet(PROGRESS_KEY);
    if (!raw || typeof VALUES_DATA === "undefined") return false;
    try {
      var saved = JSON.parse(raw);
      if (!saved.names || !saved.names.length) return false;
      var byName = {};
      VALUES_DATA.forEach(function (v) { byName[v.name] = v; });
      var restoredDeck = saved.names.map(function (n) { return byName[n]; }).filter(Boolean);
      if (restoredDeck.length !== saved.names.length) return false;
      if (saved.currentIndex >= restoredDeck.length) return false;
      deck = restoredDeck;
      currentIndex = saved.currentIndex || 0;
      sortResults = saved.sortResults || {};
      userName = saved.userName || "";
      history = [];
      showView("view-sorting");
      renderCurrentCard();
      return true;
    } catch (e) {
      return false;
    }
  }

  function renderCurrentCard() {
    if (currentIndex >= deck.length) {
      finishSorting();
      return;
    }
    var v = deck[currentIndex];
    $("vs-card-name").textContent = v.name;
    $("vs-card-def").textContent = v.definition;
    $("vs-progress-label").textContent = "Card " + (currentIndex + 1) + " of " + deck.length;
    $("vs-progress-fill").style.width = Math.round((currentIndex / deck.length) * 100) + "%";
    $("vs-undo-btn").style.visibility = history.length ? "visible" : "hidden";
  }

  function initSortButtons() {
    var buttons = document.querySelectorAll(".vs-sort-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var choice = btn.getAttribute("data-choice");
        var v = deck[currentIndex];
        if (!v) return;
        sortResults[v.name] = choice;
        history.push(currentIndex);
        currentIndex++;
        saveProgress();
        var card = $("vs-sort-card");
        card.classList.add("vs-card-exit");
        setTimeout(function () {
          renderCurrentCard();
          card.classList.remove("vs-card-exit");
        }, 180);
      });
    });

    var undoBtn = $("vs-undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", function () {
        if (!history.length) return;
        currentIndex = history.pop();
        var v = deck[currentIndex];
        if (v) delete sortResults[v.name];
        saveProgress();
        renderCurrentCard();
      });
    }
  }

  /* ---------------------------------------------------------------------
   * FINISH SORTING -> BUILD POOL -> PARE OR SKIP TO RANKING
   * ------------------------------------------------------------------- */

  function finishSorting() {
    clearProgress();
    var mostArr = deck.filter(function (v) { return sortResults[v.name] === "most"; });
    var importantArr = deck.filter(function (v) { return sortResults[v.name] === "important"; });

    if (mostArr.length >= TOP_N) {
      parePool = mostArr;
    } else {
      parePool = mostArr.concat(importantArr);
    }

    if (parePool.length <= TOP_N) {
      top10Pool = parePool;
      initRanking();
    } else {
      initParing();
    }
  }

  /* ---------------------------------------------------------------------
   * PARING (select exactly TOP_N)
   * ------------------------------------------------------------------- */

  function initParing() {
    selectedNames = {};
    var grid = $("vs-paring-grid");
    grid.innerHTML = "";
    parePool.forEach(function (v) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "vs-tile";
      tile.textContent = v.name;
      tile.setAttribute("data-name", v.name);
      tile.addEventListener("click", function () { toggleParingTile(tile, v.name); });
      grid.appendChild(tile);
    });
    updateParingCount();
    showView("view-paring");
  }

  function toggleParingTile(tile, name) {
    var selectedCount = Object.keys(selectedNames).length;
    if (selectedNames[name]) {
      delete selectedNames[name];
      tile.classList.remove("vs-tile-selected");
    } else {
      if (selectedCount >= TOP_N) return;
      selectedNames[name] = true;
      tile.classList.add("vs-tile-selected");
    }
    updateParingCount();
  }

  function updateParingCount() {
    var count = Object.keys(selectedNames).length;
    $("vs-paring-count").textContent = "Selected: " + count + " of " + TOP_N;
    $("vs-paring-continue").disabled = count !== TOP_N;
  }

  function initParingContinue() {
    var btn = $("vs-paring-continue");
    if (!btn) return;
    btn.addEventListener("click", function () {
      top10Pool = parePool.filter(function (v) { return selectedNames[v.name]; });
      initRanking();
    });
  }

  /* ---------------------------------------------------------------------
   * RANKING (tap in order)
   * ------------------------------------------------------------------- */

  var rankDrag = null;

  function initRanking() {
    rankedList = [];
    remainingRankPool = shuffle(top10Pool);
    rankDrag = null;
    var submitBtn = $("vs-rank-submit");
    if (submitBtn) submitBtn.hidden = true;
    renderRankingTiles();
    renderRankedList();
    showView("view-ranking");
  }

  function renderRankingTiles() {
    var grid = $("vs-ranking-grid");
    grid.innerHTML = "";
    remainingRankPool.forEach(function (v) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "vs-tile";
      tile.textContent = v.name;
      tile.addEventListener("click", function () { pickRank(v); });
      grid.appendChild(tile);
    });
  }

  function renderRankedList() {
    var list = $("vs-ranked-list");
    list.innerHTML = "";
    rankedList.forEach(function (v, i) {
      var li = document.createElement("li");
      li.dataset.name = v.name;
      if (i === 0) li.classList.add("vs-ranked-first");

      var num = document.createElement("span");
      num.className = "vs-rank-num" + (i === 0 ? " vs-rank-num-top" : "");
      num.textContent = i + 1;
      li.appendChild(num);
      li.appendChild(document.createTextNode(v.name));

      var grip = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      grip.setAttribute("class", "vs-rank-grip");
      grip.setAttribute("viewBox", "0 0 24 24");
      grip.setAttribute("fill", "currentColor");
      grip.innerHTML = '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>';
      li.appendChild(grip);

      li.addEventListener("pointerdown", function (e) { startRankDrag(e, li); });
      li.addEventListener("pointermove", onRankDragMove);
      li.addEventListener("pointerup", endRankDrag);
      li.addEventListener("pointercancel", endRankDrag);

      list.appendChild(li);
    });
  }

  function startRankDrag(e, li) {
    if (rankDrag) return;
    var fromIndex = rankedList.findIndex(function (v) { return v.name === li.dataset.name; });
    if (fromIndex === -1) return;
    var rect = li.getBoundingClientRect();
    var style = window.getComputedStyle(li);
    var itemHeight = rect.height + parseFloat(style.marginBottom || 0);
    rankDrag = {
      li: li,
      pointerId: e.pointerId,
      fromIndex: fromIndex,
      currentIndex: fromIndex,
      startY: e.clientY,
      itemHeight: itemHeight,
      originalOrder: rankedList.slice()
    };
    li.setPointerCapture(e.pointerId);
    li.classList.add("vs-rank-dragging");
  }

  function onRankDragMove(e) {
    if (!rankDrag || rankDrag.li !== e.currentTarget || e.pointerId !== rankDrag.pointerId) return;
    e.preventDefault();
    var deltaY = e.clientY - rankDrag.startY;
    rankDrag.li.style.transform = "translateY(" + deltaY + "px)";

    var rawTarget = rankDrag.fromIndex + Math.round(deltaY / rankDrag.itemHeight);
    var targetIndex = Math.max(0, Math.min(rankedList.length - 1, rawTarget));
    if (targetIndex === rankDrag.currentIndex) return;

    var draggedValue = rankDrag.originalOrder[rankDrag.fromIndex];
    var curPos = rankedList.findIndex(function (v) { return v.name === draggedValue.name; });
    rankedList.splice(curPos, 1);
    rankedList.splice(targetIndex, 0, draggedValue);
    rankDrag.currentIndex = targetIndex;

    var list = $("vs-ranked-list");
    Array.prototype.forEach.call(list.children, function (siblingLi) {
      if (siblingLi === rankDrag.li) return;
      var name = siblingLi.dataset.name;
      var originalIdx = rankDrag.originalOrder.findIndex(function (v) { return v.name === name; });
      var newIdx = rankedList.findIndex(function (v) { return v.name === name; });
      var delta = (newIdx - originalIdx) * rankDrag.itemHeight;
      siblingLi.style.transition = "transform 150ms ease";
      siblingLi.style.transform = delta ? "translateY(" + delta + "px)" : "";
      var num = siblingLi.querySelector(".vs-rank-num");
      if (num) num.textContent = newIdx + 1;
    });
  }

  function endRankDrag(e) {
    if (!rankDrag || rankDrag.li !== e.currentTarget || e.pointerId !== rankDrag.pointerId) return;
    try { rankDrag.li.releasePointerCapture(rankDrag.pointerId); } catch (err) { /* ignore */ }
    rankDrag.li.classList.remove("vs-rank-dragging");
    rankDrag = null;
    renderRankedList();
  }

  function pickRank(v) {
    rankedList.push(v);
    remainingRankPool = remainingRankPool.filter(function (item) { return item.name !== v.name; });
    renderRankingTiles();
    renderRankedList();
    if (remainingRankPool.length === 0) {
      var submitBtn = $("vs-rank-submit");
      if (submitBtn) submitBtn.hidden = false;
    }
  }

  /* ---------------------------------------------------------------------
   * ALIGNMENT CHECK — for each of the final top 10, in rank order, rate
   * 1-10 how consistently that value is actually being lived right now.
   * Feeds the "priority gap" flag shown on the results page.
   * ------------------------------------------------------------------- */

  function initAlignment() {
    alignmentScores = {};
    alignmentIndex = 0;
    showView("view-alignment");
    renderAlignmentCard();
  }

  function renderAlignmentCard() {
    if (alignmentIndex >= rankedList.length) {
      finishRanking();
      return;
    }
    var v = rankedList[alignmentIndex];
    $("vs-align-name").textContent = v.name;
    $("vs-align-def").textContent = v.definition;
    $("vs-align-progress-label").textContent = "Value " + (alignmentIndex + 1) + " of " + rankedList.length;
    $("vs-align-progress-fill").style.width = Math.round((alignmentIndex / rankedList.length) * 100) + "%";

    var scale = $("vs-align-scale");
    scale.innerHTML = "";
    for (var n = 1; n <= 10; n++) {
      (function (score) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vs-align-num";
        btn.textContent = score;
        btn.addEventListener("click", function () { pickAlignment(v.name, score); });
        scale.appendChild(btn);
      })(n);
    }
  }

  function pickAlignment(name, score) {
    alignmentScores[name] = score;
    var card = $("vs-align-card");
    card.classList.add("vs-card-exit");
    setTimeout(function () {
      alignmentIndex++;
      renderAlignmentCard();
      card.classList.remove("vs-card-exit");
    }, 180);
  }

  /* ---------------------------------------------------------------------
   * SORT HISTORY — a running record of past sorts (names + dates only),
   * so a returning visitor's results page can show what changed since
   * their last sort.
   * ------------------------------------------------------------------- */

  function getSortHistory() {
    try { return JSON.parse(safeGet(HISTORY_KEY)) || []; } catch (e) { return []; }
  }

  function saveSortHistoryEntry(entry) {
    var hist = getSortHistory();
    hist.push(entry);
    if (hist.length > 20) hist = hist.slice(hist.length - 20);
    safeSet(HISTORY_KEY, JSON.stringify(hist));
  }

  function computeComparison(currentNames) {
    var hist = getSortHistory();
    if (!hist.length) return null;
    var prev = hist[hist.length - 1];
    var prevNames = prev.results || [];
    var newIn = currentNames.filter(function (n) { return prevNames.indexOf(n) === -1; });
    var droppedOut = prevNames.filter(function (n) { return currentNames.indexOf(n) === -1; });
    var moved = [];
    currentNames.forEach(function (n, newIdx) {
      var oldIdx = prevNames.indexOf(n);
      if (oldIdx !== -1 && oldIdx !== newIdx) {
        moved.push({ name: n, from: oldIdx + 1, to: newIdx + 1 });
      }
    });
    return { date: prev.date, newIn: newIn, droppedOut: droppedOut, moved: moved };
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  /* ---------------------------------------------------------------------
   * RESULTS
   * ------------------------------------------------------------------- */

  function finishRanking() {
    var currentNames = rankedList.map(function (v) { return v.name; });
    var comparison = computeComparison(currentNames);
    saveSortHistoryEntry({ date: new Date().toISOString(), userName: userName, results: currentNames });
    renderResults(userName, rankedList, comparison);
    showView("view-results");
  }

  function renderComparison(comparison) {
    var panel = $("vs-compare-panel");
    var body = $("vs-compare-body");
    if (!comparison) { panel.hidden = true; return; }
    panel.hidden = false;
    $("vs-compare-date").textContent = "Compared to your sort on " + formatDate(comparison.date);
    body.innerHTML = "";

    function addLine(label, names) {
      if (!names.length) return;
      var p = document.createElement("p");
      p.className = "small";
      var strong = document.createElement("strong");
      strong.textContent = label + ": ";
      p.appendChild(strong);
      p.appendChild(document.createTextNode(names.join(", ")));
      body.appendChild(p);
    }

    addLine("New to your top 10", comparison.newIn);
    addLine("No longer in your top 10", comparison.droppedOut);
    if (comparison.moved.length) {
      var p = document.createElement("p");
      p.className = "small";
      var strong = document.createElement("strong");
      strong.textContent = "Shifted rank: ";
      p.appendChild(strong);
      p.appendChild(document.createTextNode(comparison.moved.map(function (m) {
        return m.name + " (#" + m.from + " → #" + m.to + ")";
      }).join(", ")));
      body.appendChild(p);
    }
    if (!comparison.newIn.length && !comparison.droppedOut.length && !comparison.moved.length) {
      var p = document.createElement("p");
      p.className = "small";
      p.textContent = "Your top 10 and their order are unchanged since last time.";
      body.appendChild(p);
    }
  }

  function renderDomainBars(results) {
    var container = $("vs-domain-bars");
    container.innerHTML = "";
    var counts = {};
    results.forEach(function (v) {
      var d = v.domain || "Other";
      counts[d] = (counts[d] || 0) + 1;
    });
    var domains = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var max = results.length;
    domains.forEach(function (d) {
      var row = document.createElement("div");
      row.className = "vs-domain-row";

      var label = document.createElement("div");
      label.className = "vs-domain-label";
      label.textContent = d;

      var track = document.createElement("div");
      track.className = "vs-domain-track";
      var fill = document.createElement("div");
      fill.className = "vs-domain-fill";
      fill.style.width = Math.round((counts[d] / max) * 100) + "%";
      track.appendChild(fill);

      var count = document.createElement("div");
      count.className = "vs-domain-count";
      count.textContent = counts[d];

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(count);
      container.appendChild(row);
    });
  }

  function makeReflectField(name, key, label, placeholder) {
    var wrap = document.createElement("div");
    wrap.className = "vs-reflect-field";
    var lbl = document.createElement("label");
    lbl.textContent = label;
    var ta = document.createElement("textarea");
    ta.placeholder = placeholder;
    ta.rows = 2;
    ta.value = (reflections[name] && reflections[name][key]) || "";
    ta.addEventListener("input", function () {
      if (!reflections[name]) reflections[name] = {};
      reflections[name][key] = ta.value;
      safeSet(REFLECTIONS_KEY, JSON.stringify(reflections));
    });
    wrap.appendChild(lbl);
    wrap.appendChild(ta);
    return wrap;
  }

  function renderGapExplainer(results) {
    var hasGap = results.slice(0, 3).some(function (v) {
      var s = alignmentScores[v.name];
      return typeof s === "number" && s <= 5;
    });
    $("vs-gap-explainer").hidden = !hasGap;
  }

  function renderNotImportant() {
    var panel = $("vs-notimportant-panel");
    var container = $("vs-notimportant-tags");
    var defEl = $("vs-notimportant-def");
    var notImportant = deck.filter(function (v) { return sortResults[v.name] === "not"; });
    defEl.hidden = true;
    defEl.textContent = "";
    if (!notImportant.length) { panel.hidden = true; return; }
    panel.hidden = false;
    container.innerHTML = "";
    notImportant.forEach(function (v) {
      var tag = document.createElement("button");
      tag.type = "button";
      tag.className = "tag";
      tag.textContent = v.name;
      tag.title = v.definition;
      tag.addEventListener("click", function () {
        defEl.hidden = false;
        defEl.innerHTML = "";
        var strong = document.createElement("strong");
        strong.textContent = v.name + ": ";
        defEl.appendChild(strong);
        defEl.appendChild(document.createTextNode(v.definition));
      });
      container.appendChild(tag);
    });
  }

  function renderResults(name, results, comparison) {
    var title = $("vs-results-title");
    title.textContent = name ? name + "’s Top " + results.length + " Values" : "Your Top " + results.length + " Values";

    renderComparison(comparison);
    renderDomainBars(results);
    renderGapExplainer(results);
    renderNotImportant();

    var list = $("vs-results-list");
    list.innerHTML = "";
    results.forEach(function (v, i) {
      var li = document.createElement("li");
      li.className = "vs-result-item" + (i === 0 ? " vs-result-item-top" : "");

      var rank = document.createElement("div");
      rank.className = "vs-result-rank" + (i === 0 ? " vs-result-rank-top" : "");
      rank.textContent = i + 1;

      var body = document.createElement("div");
      var h3 = document.createElement("h3");
      h3.textContent = v.name;
      var def = document.createElement("p");
      def.className = "vs-result-def";
      def.textContent = v.definition;
      var ex = document.createElement("p");
      ex.className = "vs-result-exercise";
      var strong = document.createElement("strong");
      strong.textContent = "Try this: ";
      ex.appendChild(strong);
      ex.appendChild(document.createTextNode(v.exercise));

      body.appendChild(h3);
      body.appendChild(def);

      var score = alignmentScores[v.name];
      if (typeof score === "number") {
        var isGap = i < 3 && score <= 5;
        var alignWrap = document.createElement("div");
        alignWrap.className = "vs-result-align";
        var alignLabelRow = document.createElement("div");
        alignLabelRow.className = "vs-result-align-label";
        var alignSpan = document.createElement("span");
        alignSpan.textContent = "Living this now: " + score + "/10";
        alignLabelRow.appendChild(alignSpan);
        if (isGap) {
          var badge = document.createElement("span");
          badge.className = "vs-gap-badge";
          badge.textContent = "Priority Gap";
          alignLabelRow.appendChild(badge);
        }
        var track = document.createElement("div");
        track.className = "vs-result-align-track";
        var fill = document.createElement("div");
        fill.className = "vs-result-align-fill" + (isGap ? " vs-result-align-fill-gap" : "");
        fill.style.width = (score * 10) + "%";
        track.appendChild(fill);
        alignWrap.appendChild(alignLabelRow);
        alignWrap.appendChild(track);
        body.appendChild(alignWrap);
      }

      body.appendChild(ex);

      var reflectGrid = document.createElement("div");
      reflectGrid.className = "vs-reflect-grid";
      reflectGrid.appendChild(makeReflectField(v.name, "toward", "Toward", "A recent choice that moved you toward this value"));
      reflectGrid.appendChild(makeReflectField(v.name, "away", "Away", "A recent choice that moved you away from it"));
      body.appendChild(reflectGrid);

      li.appendChild(rank);
      li.appendChild(body);
      list.appendChild(li);
    });
  }

  function initResultsButtons() {
    var printBtn = $("vs-print-btn");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

    var restartBtn = $("vs-restart-btn");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        showView("view-intro");
      });
    }
  }

  function initRankSubmit() {
    var submitBtn = $("vs-rank-submit");
    if (submitBtn) submitBtn.addEventListener("click", initAlignment);
  }

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof VALUES_DATA === "undefined") return;

    initIntroCopy();
    initSortButtons();
    initParingContinue();
    initResultsButtons();
    initRankSubmit();

    var startBtn = $("vs-start-btn");
    if (startBtn) startBtn.addEventListener("click", attemptStart);

    if (!tryResumeProgress()) {
      showView("view-intro");
    }
  });
})();
