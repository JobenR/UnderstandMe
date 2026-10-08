(function () {
  "use strict";

  if (typeof DM_COPY === "undefined") return;

  /* ---------------------------------------------------------------------
   * STATE -- in-memory only. Nothing here is ever written to localStorage,
   * sessionStorage, a cookie, or sent anywhere. A reload starts over.
   * ------------------------------------------------------------------- */

  var optionCounter = 0;
  var criterionCounter = 0;

  function newOption(name) {
    optionCounter++;
    return { id: "opt" + optionCounter, name: name || ("Option " + String.fromCharCode(64 + optionCounter)), notPossible: false };
  }
  function newCriterion(name, importance) {
    criterionCounter++;
    return {
      id: "crit" + criterionCounter,
      name: name || "",
      importance: typeof importance === "number" ? importance : DM_DEFAULT_IMPORTANCE,
      lowerIsBetter: false,
      scores: {} // option id -> 1..5 or undefined/null (blank)
    };
  }

  var state = { decision: "", options: [], criteria: [] };

  function defaultState() {
    optionCounter = 0;
    criterionCounter = 0;
    var options = [newOption(""), newOption("")];
    var criteria = [newCriterion("", DM_DEFAULT_IMPORTANCE), newCriterion("", DM_DEFAULT_IMPORTANCE), newCriterion("", DM_DEFAULT_IMPORTANCE)];
    return { decision: "", options: options, criteria: criteria };
  }

  /* ---------------------------------------------------------------------
   * CALCULATION -- pure functions over `state`, no DOM here.
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function importanceSum(criteria) {
    return criteria.reduce(function (sum, c) { return sum + (c.importance || 0); }, 0);
  }

  function weightPct(criterion, sum) {
    return sum > 0 ? (criterion.importance / sum) * 100 : 0;
  }

  function scoreableOptions() {
    return state.options.filter(function (o) { return !o.notPossible; });
  }

  function adjustedScore(criterion, rawScore) {
    if (typeof rawScore !== "number") return null;
    return criterion.lowerIsBetter ? (6 - rawScore) : rawScore;
  }

  // Computes an option's match % against a given criteria list (so the
  // sensitivity check can pass in a modified copy without touching state).
  // Returns null if any score is still blank -- the caller decides what
  // that means.
  function matchPercent(option, criteria) {
    var sum = importanceSum(criteria);
    if (sum <= 0) return null;
    var weightedSum = 0;
    for (var i = 0; i < criteria.length; i++) {
      var c = criteria[i];
      var adj = adjustedScore(c, c.scores[option.id]);
      if (adj === null) return null;
      weightedSum += c.importance * adj;
    }
    return (weightedSum / sum / DM_SCORE_MAX) * 100;
  }

  function progress() {
    var options = scoreableOptions();
    var total = options.length * state.criteria.length;
    var done = 0;
    options.forEach(function (o) {
      state.criteria.forEach(function (c) {
        if (typeof c.scores[o.id] === "number") done++;
      });
    });
    return { done: done, total: total, complete: total > 0 && done === total };
  }

  // Ranks every scoreable option against a given criteria list (defaults
  // to live state). Used both for the real results and, with one
  // criterion's importance nudged, for the sensitivity check.
  function rank(criteria) {
    criteria = criteria || state.criteria;
    return scoreableOptions().map(function (option) {
      return { option: option, pct: matchPercent(option, criteria) };
    }).sort(function (a, b) { return b.pct - a.pct; });
  }

  function cloneCriteriaWithImportance(criterionId, newImportance) {
    return state.criteria.map(function (c) {
      if (c.id !== criterionId) return c;
      var clone = {}; for (var k in c) clone[k] = c[k];
      clone.importance = newImportance;
      return clone;
    });
  }

  // Tests a +/-1 importance nudge on every criterion in turn; returns the
  // first one that changes who's in first place, or null if the ranking
  // is stable under every single-factor nudge.
  function findSensitivityFlip(currentWinnerId) {
    for (var i = 0; i < state.criteria.length; i++) {
      var c = state.criteria[i];
      var deltas = [-1, 1];
      for (var d = 0; d < deltas.length; d++) {
        var nudged = Math.max(DM_IMPORTANCE_MIN, Math.min(DM_IMPORTANCE_MAX, c.importance + deltas[d]));
        if (nudged === c.importance) continue;
        var testCriteria = cloneCriteriaWithImportance(c.id, nudged);
        var testRank = rank(testCriteria);
        if (testRank.length && testRank[0].option.id !== currentWinnerId) {
          return { criterion: c, direction: deltas[d] > 0 ? "higher" : "lower", newWinner: testRank[0].option };
        }
      }
    }
    return null;
  }

  // Finds the factors driving the gap between the winner and the
  // runner-up, for the auto-generated "why" sentence.
  function compareFactors(winner, runnerUp) {
    var contributions = state.criteria.map(function (c) {
      var wScore = adjustedScore(c, c.scores[winner.id]);
      var rScore = adjustedScore(c, c.scores[runnerUp.id]);
      return { criterion: c, contribution: c.importance * ((wScore || 0) - (rScore || 0)) };
    });
    var favoringWinner = contributions.filter(function (x) { return x.contribution > 0; })
      .sort(function (a, b) { return b.contribution - a.contribution; });
    var favoringRunnerUp = contributions.slice().sort(function (a, b) { return a.contribution - b.contribution; })[0];
    return {
      topForWinner: favoringWinner.map(function (x) { return x.criterion; }),
      topForRunnerUp: favoringRunnerUp && favoringRunnerUp.contribution < 0 ? favoringRunnerUp.criterion : null
    };
  }

  /* ---------------------------------------------------------------------
   * INTRO + STATIC COPY
   * ------------------------------------------------------------------- */

  function renderStaticCopy() {
    $("dm-opening-heading").textContent = DM_COPY.opening.heading;
    $("dm-opening-tagline").textContent = DM_COPY.opening.tagline;
    var body = $("dm-opening-body");
    body.innerHTML = "";
    DM_COPY.opening.body.forEach(function (p) {
      var el = document.createElement("p");
      el.textContent = p;
      body.appendChild(el);
    });
    $("dm-good-for").textContent = DM_COPY.opening.goodFor;
    $("dm-not-needed-if").textContent = DM_COPY.opening.notNeededIf;
    $("dm-how-it-works-heading").textContent = DM_COPY.opening.howItWorksHeading;
    var howItWorks = $("dm-how-it-works-list");
    howItWorks.innerHTML = "";
    DM_COPY.opening.howItWorks.forEach(function (step) {
      var li = document.createElement("li");
      li.textContent = step;
      howItWorks.appendChild(li);
    });
    $("dm-crisis-line-top").textContent = DM_CRISIS_LINE;
    $("dm-fine-print-bottom").textContent = DM_STANDING_DISCLAIMER;

    $("dm-setup-step").textContent = DM_COPY.setup.stepLabel;
    $("dm-setup-heading").textContent = DM_COPY.setup.heading;
    $("dm-decision-label").textContent = DM_COPY.setup.decisionLabel;
    $("dm-decision-input").placeholder = DM_COPY.setup.decisionPlaceholder;
    $("dm-options-label").textContent = DM_COPY.setup.optionsLabel;
    $("dm-options-instruction").textContent = DM_COPY.setup.optionsInstruction;
    $("dm-add-option-btn").textContent = DM_COPY.setup.addOptionLabel;
    $("dm-dealbreaker-helper").textContent = DM_COPY.setup.dealbreakerHelper;
    $("dm-criteria-label").textContent = DM_COPY.setup.criteriaLabel;
    $("dm-criteria-instruction").textContent = DM_COPY.setup.criteriaInstruction;
    $("dm-criteria-tip").textContent = DM_COPY.setup.criteriaTip;
    $("dm-importance-heading").textContent = DM_COPY.setup.importanceHeading;
    $("dm-importance-instruction").textContent = DM_COPY.setup.importanceInstruction;
    $("dm-add-criterion-btn").textContent = DM_COPY.setup.addCriterionLabel;
    $("dm-load-example-btn").textContent = DM_COPY.setup.loadExampleLabel;
    $("dm-reset-btn").textContent = DM_COPY.setup.resetLabel;

    $("dm-scoring-step").textContent = DM_COPY.scoring.stepLabel;
    $("dm-scoring-heading").textContent = DM_COPY.scoring.heading;
    $("dm-scoring-helper").textContent = DM_COPY.scoring.helper;

    $("dm-results-step").textContent = DM_COPY.results.stepLabel;
    $("dm-results-heading").textContent = DM_COPY.results.heading;
    $("dm-why-heading").textContent = DM_COPY.results.whyHeading;
    $("dm-solidity-heading").textContent = DM_COPY.results.solidityHeading;
    $("dm-save-copy-btn").textContent = DM_COPY.actions.saveCopy;
    $("dm-start-new-btn").textContent = DM_COPY.actions.startNewDecision;

    $("dm-before-heading").textContent = DM_COPY.beforeYouDecide.heading;
    $("dm-feeling-heading").textContent = DM_COPY.beforeYouDecide.feelingHeading;
    $("dm-feeling-intro").textContent = DM_COPY.beforeYouDecide.feelingIntro;
    $("dm-feeling-good").textContent = DM_COPY.beforeYouDecide.feelingGood;
    $("dm-feeling-bad").textContent = DM_COPY.beforeYouDecide.feelingBad;
    $("dm-try-heading").textContent = DM_COPY.beforeYouDecide.tryHeading;
    $("dm-try-body").textContent = DM_COPY.beforeYouDecide.tryBody;
    $("dm-values-heading").textContent = DM_COPY.beforeYouDecide.valuesHeading;
    $("dm-values-body").textContent = DM_COPY.beforeYouDecide.valuesBody;
    $("dm-values-link").textContent = DM_COPY.beforeYouDecide.valuesLinkText;

    $("dm-pitfalls-heading").textContent = DM_COPY.reference.pitfallsHeading;
    var pitfallsBody = $("dm-pitfalls-body");
    pitfallsBody.innerHTML = "";
    DM_PITFALLS.forEach(function (p) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td");
      td1.textContent = p.pitfall;
      var td2 = document.createElement("td");
      td2.textContent = p.fix;
      tr.appendChild(td1);
      tr.appendChild(td2);
      pitfallsBody.appendChild(tr);
    });

    var legend = $("dm-scale-legend");
    legend.innerHTML = "";
    DM_SCALE_ANCHORS.forEach(function (a) {
      var span = document.createElement("span");
      var strong = document.createElement("strong");
      strong.textContent = String(a.value) + " = ";
      span.appendChild(strong);
      span.appendChild(document.createTextNode(a.label));
      legend.appendChild(span);
    });

    $("dm-decision-input").addEventListener("input", function () {
      state.decision = this.value;
      updatePrintSheet();
    });
  }

  /* ---------------------------------------------------------------------
   * OPTIONS
   * ------------------------------------------------------------------- */

  function renderOptions() {
    var list = $("dm-options-list");
    list.innerHTML = "";

    state.options.forEach(function (option, idx) {
      var row = document.createElement("div");
      row.className = "dm-option-row";

      var input = document.createElement("input");
      input.type = "text";
      input.value = option.name;
      input.maxLength = 40;
      input.placeholder = DM_COPY.setup.optionNamePlaceholders[idx] || ("Option " + (idx + 1));
      input.setAttribute("aria-label", "Option name");
      input.addEventListener("input", function () {
        option.name = input.value;
        renderScoringTable();
        renderResults();
        updatePrintSheet();
      });
      row.appendChild(input);

      var dealbreakerLabel = document.createElement("label");
      dealbreakerLabel.className = "dm-dealbreaker-label";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = option.notPossible;
      checkbox.addEventListener("change", function () {
        option.notPossible = checkbox.checked;
        renderScoringTable();
        renderResults();
        updatePrintSheet();
      });
      dealbreakerLabel.appendChild(checkbox);
      dealbreakerLabel.appendChild(document.createTextNode(DM_COPY.setup.dealbreakerLabel));
      row.appendChild(dealbreakerLabel);

      if (state.options.length > DM_MIN_OPTIONS) {
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "dm-row-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.setAttribute("aria-label", "Remove " + (option.name || "option"));
        removeBtn.addEventListener("click", function () {
          state.options = state.options.filter(function (o) { return o.id !== option.id; });
          state.criteria.forEach(function (c) { delete c.scores[option.id]; });
          renderAll();
        });
        row.appendChild(removeBtn);
      }

      list.appendChild(row);
    });

    var atMax = state.options.length >= DM_MAX_OPTIONS;
    $("dm-add-option-btn").disabled = atMax;
    $("dm-options-notice").hidden = !atMax;
    if (atMax) $("dm-options-notice").textContent = DM_COPY.setup.optionsMaxNotice;
  }

  $("dm-add-option-btn").addEventListener("click", function () {
    if (state.options.length >= DM_MAX_OPTIONS) return;
    var option = newOption();
    state.options.push(option);
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * CRITERIA + IMPORTANCE
   * ------------------------------------------------------------------- */

  function renderCriteria() {
    var list = $("dm-criteria-list");
    list.innerHTML = "";
    var sum = importanceSum(state.criteria);

    state.criteria.forEach(function (criterion, idx) {
      var row = document.createElement("div");
      row.className = "dm-criterion-row";

      var topLine = document.createElement("div");
      topLine.className = "dm-criterion-top-line";

      var input = document.createElement("input");
      input.type = "text";
      input.value = criterion.name;
      input.maxLength = 50;
      input.placeholder = DM_COPY.setup.criterionNamePlaceholders[idx] || ("Factor " + (idx + 1));
      input.setAttribute("aria-label", "Factor name");
      input.addEventListener("input", function () {
        criterion.name = input.value;
        renderScoringTable();
        updatePrintSheet();
      });
      topLine.appendChild(input);

      var lowerLabel = document.createElement("label");
      lowerLabel.className = "dm-lower-better-label";
      var lowerCheckbox = document.createElement("input");
      lowerCheckbox.type = "checkbox";
      lowerCheckbox.checked = criterion.lowerIsBetter;
      lowerCheckbox.addEventListener("change", function () {
        criterion.lowerIsBetter = lowerCheckbox.checked;
        renderResults();
        updatePrintSheet();
      });
      lowerLabel.appendChild(lowerCheckbox);
      lowerLabel.appendChild(document.createTextNode(DM_COPY.setup.lowerIsBetterLabel));
      topLine.appendChild(lowerLabel);

      if (state.criteria.length > DM_MIN_CRITERIA) {
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "dm-row-remove";
        removeBtn.innerHTML = "&times;";
        removeBtn.setAttribute("aria-label", "Remove factor " + (idx + 1));
        removeBtn.addEventListener("click", function () {
          state.criteria = state.criteria.filter(function (c) { return c.id !== criterion.id; });
          renderAll();
        });
        topLine.appendChild(removeBtn);
      }
      row.appendChild(topLine);

      var ratingRow = document.createElement("div");
      ratingRow.className = "dm-importance-rating";
      DM_IMPORTANCE_ANCHORS.slice().reverse().forEach(function (anchor) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dm-rating-btn" + (criterion.importance === anchor.value ? " dm-rating-selected" : "");
        btn.textContent = String(anchor.value);
        btn.title = anchor.label;
        btn.setAttribute("aria-label", anchor.value + " — " + anchor.label);
        btn.setAttribute("aria-pressed", criterion.importance === anchor.value ? "true" : "false");
        btn.addEventListener("click", function () {
          criterion.importance = anchor.value;
          renderCriteria();
          renderScoringTable();
          renderResults();
          updatePrintSheet();
        });
        ratingRow.appendChild(btn);
      });
      var pctBadge = document.createElement("span");
      pctBadge.className = "dm-importance-pct";
      pctBadge.textContent = Math.round(weightPct(criterion, sum)) + "%";
      ratingRow.appendChild(pctBadge);
      row.appendChild(ratingRow);

      list.appendChild(row);
    });

    var atMax = state.criteria.length >= DM_MAX_CRITERIA;
    $("dm-add-criterion-btn").disabled = atMax;
    $("dm-criteria-notice").hidden = !atMax;
    if (atMax) $("dm-criteria-notice").textContent = DM_COPY.setup.criteriaMaxNotice;

    renderWeightSummary(sum);
  }

  function renderWeightSummary(sum) {
    var el = $("dm-weight-summary");
    var ranked = state.criteria
      .filter(function (c) { return c.name.trim(); })
      .map(function (c) { return { label: c.name, pct: Math.round(weightPct(c, sum)) }; })
      .sort(function (a, b) { return b.pct - a.pct; })
      .slice(0, 2);
    if (ranked.length === 0) { el.textContent = ""; return; }
    var items = ranked.map(function (r) {
      return DM_COPY.setup.weightSummaryItemTemplate.replace("{label}", r.label).replace("{pct}", r.pct);
    }).join(DM_COPY.setup.weightSummaryJoiner);
    el.textContent = DM_COPY.setup.weightSummaryTemplate.replace("{items}", items);
  }

  $("dm-add-criterion-btn").addEventListener("click", function () {
    if (state.criteria.length >= DM_MAX_CRITERIA) return;
    var criterion = newCriterion();
    state.criteria.push(criterion);
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCORING TABLE -- cells start blank; a factor at a time across every
   * option, per the instructions above the table.
   * ------------------------------------------------------------------- */

  function renderScoringTable() {
    var headRow = $("dm-scoring-head-row");
    headRow.innerHTML = "";
    var th0 = document.createElement("th");
    th0.textContent = "Factor";
    headRow.appendChild(th0);
    state.options.forEach(function (option, idx) {
      var th = document.createElement("th");
      th.textContent = (option.name || ("Option " + (idx + 1))) + (option.notPossible ? " (not scored)" : "");
      headRow.appendChild(th);
    });

    var body = $("dm-scoring-body");
    body.innerHTML = "";
    state.criteria.forEach(function (criterion, idx) {
      var tr = document.createElement("tr");
      var tdName = document.createElement("td");
      tdName.className = "dm-criterion-cell";
      tdName.textContent = criterion.name || ("Factor " + (idx + 1));
      tr.appendChild(tdName);

      state.options.forEach(function (option, optIdx) {
        var td = document.createElement("td");
        if (option.notPossible) {
          td.className = "dm-option-excluded";
          td.textContent = "—";
        } else {
          var input = document.createElement("input");
          input.type = "number";
          input.min = String(DM_SCORE_MIN);
          input.max = String(DM_SCORE_MAX);
          var current = criterion.scores[option.id];
          input.value = typeof current === "number" ? String(current) : "";
          input.placeholder = "–";
          input.setAttribute("aria-label", (criterion.name || "Factor " + (idx + 1)) + " score for " + (option.name || "Option " + (optIdx + 1)));
          input.addEventListener("input", function () {
            var raw = input.value.trim();
            if (raw === "") {
              delete criterion.scores[option.id];
            } else {
              var v = parseInt(raw, 10);
              if (!isNaN(v)) {
                v = Math.max(DM_SCORE_MIN, Math.min(DM_SCORE_MAX, v));
                criterion.scores[option.id] = v;
                if (String(v) !== raw) input.value = String(v);
              }
            }
            renderProgress();
            renderResults();
            updatePrintSheet();
          });
          td.appendChild(input);
        }
        tr.appendChild(td);
      });

      body.appendChild(tr);
    });

    renderProgress();
  }

  function renderProgress() {
    var p = progress();
    var el = $("dm-scoring-progress");
    el.textContent = DM_COPY.scoring.progressTemplate
      .replace("{done}", p.done)
      .replace("{total}", p.total) +
      (p.complete ? DM_COPY.scoring.progressComplete : DM_COPY.scoring.progressRemaining);
    el.classList.toggle("dm-progress-complete", p.complete);
  }

  /* ---------------------------------------------------------------------
   * RESULTS -- hidden entirely until every cell is filled.
   * ------------------------------------------------------------------- */

  function renderResults() {
    var p = progress();
    var section = $("dm-results-section");
    section.hidden = !p.complete;
    if (!p.complete) { updatePrintSheet(); return; }

    var results = rank();
    var grid = $("dm-results-grid");
    grid.innerHTML = "";

    if (results.length === 0) {
      grid.textContent = "";
    } else {
      var best = results[0];
      var bestCard = document.createElement("div");
      bestCard.className = "dm-result-card dm-result-winner";
      var bestName = document.createElement("div");
      bestName.className = "dm-result-option-name";
      bestName.textContent = best.option.name || "Your top option";
      var bestPct = document.createElement("div");
      bestPct.className = "dm-result-score";
      bestPct.textContent = Math.round(best.pct) + "%";
      bestCard.appendChild(bestName);
      bestCard.appendChild(bestPct);
      var bestLabel = document.createElement("div");
      bestLabel.className = "dm-result-score-of5";
      bestLabel.textContent = "match";
      bestCard.appendChild(bestLabel);
      grid.appendChild(bestCard);

      results.slice(1).forEach(function (r) {
        var card = document.createElement("div");
        card.className = "dm-result-card";
        var name = document.createElement("div");
        name.className = "dm-result-option-name";
        name.textContent = r.option.name || "Option";
        var pct = document.createElement("div");
        pct.className = "dm-result-score";
        pct.textContent = Math.round(r.pct) + "%";
        card.appendChild(name);
        card.appendChild(pct);
        grid.appendChild(card);
      });
    }

    state.options.filter(function (o) { return o.notPossible; }).forEach(function (o) {
      var card = document.createElement("div");
      card.className = "dm-result-card dm-result-excluded";
      var name = document.createElement("div");
      name.className = "dm-result-option-name";
      name.textContent = o.name || "Option";
      var note = document.createElement("div");
      note.className = "dm-result-score-of5";
      note.textContent = "Not possible";
      card.appendChild(name);
      card.appendChild(note);
      grid.appendChild(card);
    });

    renderWhyAndSolidity(results);
    updatePrintSheet();
  }

  function renderWhyAndSolidity(results) {
    var whyBlock = $("dm-why-block");
    var whyText = $("dm-why-text");
    var solidityBlock = $("dm-solidity-block");
    var solidityIcon = $("dm-solidity-icon");
    var solidityText = $("dm-solidity-text");

    if (results.length < 2) {
      whyBlock.hidden = true;
      solidityBlock.hidden = results.length !== 1;
      if (results.length === 1) {
        solidityIcon.textContent = "";
        solidityText.textContent = DM_COPY.results.singleOptionMessage;
      }
      return;
    }

    var winner = results[0], runnerUp = results[1];
    var isTie = (winner.pct - runnerUp.pct) < DM_TIE_MARGIN_PCT;

    var factors = compareFactors(winner.option, runnerUp.option);
    whyBlock.hidden = false;
    if (factors.topForRunnerUp && factors.topForWinner.length) {
      var top = factors.topForWinner.slice(0, 2);
      var names = top.map(function (c) { return c.name || "an unnamed factor"; }).join(" and ");
      var label = top.length > 1 ? DM_COPY.results.whyTwoFactorLabel : DM_COPY.results.whySingleFactorLabel;
      whyText.textContent = DM_COPY.results.whyTemplate
        .replace("{winner}", winner.option.name || "Your top option")
        .replace("{factors}", names)
        .replace("{factorsLabel}", label)
        .replace("{runnerUp}", runnerUp.option.name || "The runner-up")
        .replace("{runnerUpFactor}", (factors.topForRunnerUp.name || "another factor").toLowerCase());
    } else {
      whyText.textContent = DM_COPY.results.whyNoContrastTemplate
        .replace("{winner}", winner.option.name || "Your top option")
        .replace("{runnerUp}", runnerUp.option.name || "the runner-up");
    }

    solidityBlock.hidden = false;
    if (isTie) {
      solidityIcon.textContent = "⚖️";
      solidityText.textContent = DM_COPY.results.tieMessage;
      return;
    }

    var flip = findSensitivityFlip(winner.option.id);
    if (flip) {
      solidityIcon.textContent = "⚠️";
      var anchorFactor = factors.topForWinner[0];
      solidityText.textContent = DM_COPY.results.cautionTemplate
        .replace("{factor}", flip.criterion.name || "a factor")
        .replace("{direction}", flip.direction)
        .replace("{newWinner}", flip.newWinner.name || "the other option")
        .replace("{factorLower}", (flip.criterion.name || "that factor").toLowerCase())
        .replace("{anchorFactorLower}", anchorFactor ? (anchorFactor.name || "your other priorities").toLowerCase() : "your other priorities");
    } else {
      solidityIcon.textContent = "✅";
      solidityText.textContent = DM_COPY.results.solidMessage;
    }
  }

  /* ---------------------------------------------------------------------
   * EXAMPLE + RESET
   * ------------------------------------------------------------------- */

  $("dm-load-example-btn").addEventListener("click", function () {
    optionCounter = 0;
    criterionCounter = 0;
    var options = DM_EXAMPLE.options.map(function (name) { return newOption(name); });
    var criteria = DM_EXAMPLE.criteria.map(function (c) {
      var criterion = newCriterion(c.label, c.importance);
      options.forEach(function (option, i) { criterion.scores[option.id] = c.scores[i]; });
      return criterion;
    });
    state = { decision: DM_EXAMPLE.decision, options: options, criteria: criteria };
    $("dm-decision-input").value = state.decision;
    renderAll();
  });

  function startOver() {
    state = defaultState();
    $("dm-decision-input").value = "";
    renderAll();
    var heading = $("dm-setup-heading");
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: false }); }
  }

  $("dm-reset-btn").addEventListener("click", startOver);
  $("dm-start-new-btn").addEventListener("click", startOver);

  /* ---------------------------------------------------------------------
   * PRINT SHEET
   * ------------------------------------------------------------------- */

  function updatePrintSheet() {
    $("dm-print-decision").textContent = state.decision
      ? "Decision: " + state.decision
      : "";

    var criteriaList = $("dm-print-criteria");
    criteriaList.innerHTML = "";
    var sum = importanceSum(state.criteria);
    state.criteria.forEach(function (c, idx) {
      var li = document.createElement("li");
      var label = c.name || ("Factor " + (idx + 1));
      var scores = state.options.map(function (o) {
        return (o.name || "Option") + (o.notPossible ? " (not possible)" : ": " + (typeof c.scores[o.id] === "number" ? c.scores[o.id] : "—"));
      }).join(", ");
      li.textContent = label + " (importance " + c.importance + "/5, " + Math.round(weightPct(c, sum)) + "%)" +
        (c.lowerIsBetter ? " [lower is better]" : "") + " — " + scores;
      criteriaList.appendChild(li);
    });

    var p = progress();
    var resultsList = $("dm-print-results");
    resultsList.innerHTML = "";
    if (p.complete) {
      rank().forEach(function (r) {
        var li = document.createElement("li");
        li.textContent = (r.option.name || "Option") + ": " + Math.round(r.pct) + "% match";
        resultsList.appendChild(li);
      });
    } else {
      var li = document.createElement("li");
      li.textContent = "Rating not yet complete (" + p.done + " of " + p.total + ").";
      resultsList.appendChild(li);
    }

    $("dm-print-message").textContent = p.complete ? $("dm-why-text").textContent : "";
    $("dm-print-disclaimer").textContent = DM_STANDING_DISCLAIMER;
    $("dm-print-crisis").textContent = DM_CRISIS_LINE;
  }

  $("dm-save-copy-btn").addEventListener("click", function () {
    window.print();
  });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  function renderAll() {
    renderOptions();
    renderCriteria();
    renderScoringTable();
    renderResults();
    updatePrintSheet();
  }

  renderStaticCopy();
  state = defaultState();
  renderAll();
})();
