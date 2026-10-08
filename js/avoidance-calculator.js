(function () {
  "use strict";

  if (typeof AvoidanceCalc === "undefined" || typeof AC_DOMAINS === "undefined") return;

  /* ---------------------------------------------------------------------
   * STATE -- in-memory only. Nothing here is ever written to localStorage,
   * sessionStorage, a cookie, or sent anywhere. A reload starts over; that
   * is the correct, intended consequence of storing nothing (spec section 9).
   * ------------------------------------------------------------------- */

  var selectedDomains = [];              // [{ id, label }], in selection order
  var domainAnswers = {};                // id -> { episodesPerMonth, minutesPerEpisode, dollarsPerMonth }
  var domainQuestionSteps = [];          // [{ domain, question: 'frequency'|'time'|'money' }]
  var currentDomainStepIndex = 0;
  var opportunityChecked = {};           // id -> boolean
  var yearsReported = null;
  var reviewEditMode = false;            // true while mid-sequence after jumping in from Review
  var currentTotals = null;
  var customDomainCount = 0;

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function formatNumber(n) { return Math.round(n).toLocaleString("en-US"); }

  function fillTemplate(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (_, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "";
    });
  }

  // n === 1 gets the singular form; everything else (including 0) gets the
  // plural, matching normal English usage ("0 hours", "1 hour", "2 hours").
  function pluralize(n, singular, plural) {
    return n === 1 ? singular : (plural || (singular + "s"));
  }

  function formatMinutesLabel(minutes) {
    if (minutes < 60) return minutes + " minute" + (minutes === 1 ? "" : "s");
    var hours = Math.floor(minutes / 60);
    var remainder = minutes % 60;
    var hoursText = hours + " hour" + (hours === 1 ? "" : "s");
    if (remainder === 0) return hoursText;
    return hoursText + " " + remainder + " minute" + (remainder === 1 ? "" : "s");
  }

  function bucketLabelForValue(buckets, value) {
    var match = buckets.filter(function (b) { return b.value === value; })[0];
    return match ? match.label : "";
  }

  // Shows one .ac-view, hides the rest, announces the change to screen
  // readers via the live region (reusing the step's own already-specified
  // heading text -- no new copy invented for this), moves focus to the new
  // step's heading, and scrolls it into view below the sticky header.
  function showView(id) {
    var views = document.querySelectorAll(".ac-view");
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].id !== id;
    }
    var target = $(id);
    var heading = target ? target.querySelector("h1") : null;
    if (heading) {
      $("ac-live-region").textContent = heading.textContent;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    var header = document.querySelector(".site-header");
    var headerHeight = header ? header.getBoundingClientRect().height : 0;
    var hero = document.querySelector(".ac-page-hero");
    if (hero) {
      var top = hero.getBoundingClientRect().bottom + window.scrollY - headerHeight - 10;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    }
  }

  /* ---------------------------------------------------------------------
   * STEP 1: OPENING
   * ------------------------------------------------------------------- */

  // The opening heading/body/button were previously hard-coded directly in
  // the HTML, disconnected from AC_COPY.opening -- edits to the data file
  // had no effect on the page. Rendered here instead, matching how every
  // other step's copy already works.
  function renderOpeningCopy() {
    $("ac-opening-heading").textContent = AC_COPY.opening.heading;
    var body = $("ac-opening-body");
    body.innerHTML = "";
    AC_COPY.opening.body.forEach(function (paragraph) {
      var p = document.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    });
    $("ac-start-btn").textContent = AC_COPY.opening.action;
  }
  renderOpeningCopy();

  $("ac-start-btn").addEventListener("click", function () {
    showView("ac-view-domain-select");
    renderDomainTiles();
  });

  /* ---------------------------------------------------------------------
   * STEP 2: DOMAIN SELECT
   * ------------------------------------------------------------------- */

  function isSelected(id) {
    return selectedDomains.some(function (d) { return d.id === id; });
  }

  function toggleDomain(domain, tileEl) {
    if (isSelected(domain.id)) {
      selectedDomains = selectedDomains.filter(function (d) { return d.id !== domain.id; });
      tileEl.classList.remove("ac-tile-selected");
      tileEl.setAttribute("aria-pressed", "false");
    } else {
      selectedDomains.push(domain);
      tileEl.classList.add("ac-tile-selected");
      tileEl.setAttribute("aria-pressed", "true");
    }
    $("ac-domain-select-notice").hidden = true;
  }

  function renderDomainTiles() {
    var grid = $("ac-domain-tile-grid");
    grid.innerHTML = "";
    AC_DOMAINS.forEach(function (domain) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "ac-tile" + (isSelected(domain.id) ? " ac-tile-selected" : "");
      tile.textContent = domain.label;
      tile.setAttribute("aria-pressed", isSelected(domain.id) ? "true" : "false");
      tile.addEventListener("click", function () { toggleDomain(domain, tile); });
      grid.appendChild(tile);
    });
    renderAddedList();
  }

  function renderAddedList() {
    var list = $("ac-added-list");
    list.innerHTML = "";
    selectedDomains
      .filter(function (d) { return d.isCustom; })
      .forEach(function (d) {
        var li = document.createElement("li");
        li.textContent = d.label;
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.setAttribute("aria-label", "Remove " + d.label);
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", function () {
          selectedDomains = selectedDomains.filter(function (d2) { return d2.id !== d.id; });
          renderAddedList();
        });
        li.appendChild(removeBtn);
        list.appendChild(li);
      });
  }

  $("ac-add-own-btn").addEventListener("click", function () {
    var input = $("ac-add-own-input");
    var label = input.value.trim();
    if (!label) return;
    customDomainCount++;
    var domain = { id: "custom-" + customDomainCount, label: label, isCustom: true };
    selectedDomains.push(domain);
    input.value = "";
    $("ac-domain-select-notice").hidden = true;
    renderAddedList();
    input.focus();
  });
  $("ac-add-own-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      $("ac-add-own-btn").click();
    }
  });

  $("ac-domain-back-btn").addEventListener("click", function () {
    showView("ac-view-opening");
  });

  $("ac-domain-continue-btn").addEventListener("click", function () {
    if (selectedDomains.length === 0) {
      $("ac-domain-select-notice").hidden = false;
      return;
    }
    buildDomainQuestionSteps();
    currentDomainStepIndex = 0;
    showView("ac-view-domain-question");
    renderDomainQuestionStep();
  });

  /* ---------------------------------------------------------------------
   * STEPS 3..N: DOMAIN LOOP
   * ------------------------------------------------------------------- */

  function buildDomainQuestionSteps() {
    domainQuestionSteps = [];
    selectedDomains.forEach(function (domain) {
      if (!domainAnswers[domain.id]) {
        domainAnswers[domain.id] = { episodesPerMonth: null, minutesPerEpisode: 30, dollarsPerMonth: 0 };
      }
      domainQuestionSteps.push({ domain: domain, question: "frequency" });
      domainQuestionSteps.push({ domain: domain, question: "time" });
      domainQuestionSteps.push({ domain: domain, question: "money" });
    });
  }

  function renderDomainQuestionStep() {
    var step = domainQuestionSteps[currentDomainStepIndex];
    var domain = step.domain;
    var answers = domainAnswers[domain.id];

    $("ac-domain-progress-label").textContent =
      "Step " + (currentDomainStepIndex + 1) + " of " + domainQuestionSteps.length;
    $("ac-domain-progress-fill").style.width =
      Math.round((currentDomainStepIndex / domainQuestionSteps.length) * 100) + "%";

    // Shown on all three sub-questions so the domain is never only implied --
    // headings deliberately don't grammatically embed the label (see
    // AC_COPY.domainLoop comments), so this badge is the one place it's named.
    $("ac-domain-badge").textContent = domain.label;

    $("ac-frequency-block").hidden = step.question !== "frequency";
    $("ac-time-block").hidden = step.question !== "time";
    $("ac-money-block").hidden = step.question !== "money";

    if (step.question === "frequency") {
      $("ac-domain-question-heading").textContent = AC_COPY.domainLoop.frequencyHeading;
      renderFrequencyGrid(answers.episodesPerMonth);
    } else if (step.question === "time") {
      $("ac-domain-question-heading").textContent = AC_COPY.domainLoop.timeHeading;
      var minutes = answers.minutesPerEpisode || 30;
      var slider = $("ac-time-slider");
      slider.value = String(minutes);
      updateTimeSliderLabel(minutes);
      renderTimeHelper();
    } else {
      $("ac-domain-question-heading").textContent = AC_COPY.domainLoop.moneyHeading;
      $("ac-money-input").value = String(answers.dollarsPerMonth || 0);
      renderMoneyHelper();
    }
  }

  function renderFrequencyGrid(selectedValue) {
    var grid = $("ac-frequency-grid");
    grid.innerHTML = "";
    AC_FREQUENCY_BUCKETS.forEach(function (bucket) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ac-bucket-btn" + (bucket.value === selectedValue ? " ac-bucket-selected" : "");
      btn.textContent = bucket.label;
      btn.setAttribute("aria-pressed", bucket.value === selectedValue ? "true" : "false");
      btn.addEventListener("click", function () {
        var step = domainQuestionSteps[currentDomainStepIndex];
        domainAnswers[step.domain.id].episodesPerMonth = bucket.value;
        renderFrequencyGrid(bucket.value);
      });
      grid.appendChild(btn);
    });
  }

  function updateTimeSliderLabel(minutes) {
    var label = formatMinutesLabel(minutes);
    $("ac-time-value-label").textContent = label;
    $("ac-time-slider").setAttribute("aria-valuetext", label);
  }

  function renderTimeHelper() {
    $("ac-time-helper-intro").textContent = AC_TIME_HELPER.intro;
    var list = $("ac-time-helper-list");
    list.innerHTML = "";
    AC_TIME_HELPER.items.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function renderMoneyHelper() {
    $("ac-money-helper-intro").textContent = AC_MONEY_HELPER.intro;
    var list = $("ac-money-helper-list");
    list.innerHTML = "";
    AC_MONEY_HELPER.items.forEach(function (item) {
      var li = document.createElement("li");
      var strong = document.createElement("strong");
      strong.textContent = item.label;
      li.appendChild(strong);
      li.appendChild(document.createTextNode(" — " + item.detail));
      list.appendChild(li);
    });
    $("ac-money-helper-outro").textContent = AC_MONEY_HELPER.outro;
  }

  $("ac-time-slider").addEventListener("input", function () {
    updateTimeSliderLabel(parseInt(this.value, 10));
  });

  $("ac-money-input").addEventListener("input", function () {
    var v = parseInt(this.value, 10);
    if (isNaN(v) || v < 0) this.value = "0";
    if (v > 5000) this.value = "5000";
  });

  $("ac-domain-question-back-btn").addEventListener("click", function () {
    saveCurrentDomainAnswer();
    if (currentDomainStepIndex > 0) {
      currentDomainStepIndex--;
      renderDomainQuestionStep();
    } else {
      showView("ac-view-domain-select");
      renderDomainTiles();
    }
  });

  function saveCurrentDomainAnswer() {
    var step = domainQuestionSteps[currentDomainStepIndex];
    var answers = domainAnswers[step.domain.id];
    if (step.question === "frequency") {
      // value already saved on click in renderFrequencyGrid's handler
    } else if (step.question === "time") {
      answers.minutesPerEpisode = parseInt($("ac-time-slider").value, 10);
    } else if (step.question === "money") {
      var v = parseInt($("ac-money-input").value, 10);
      answers.dollarsPerMonth = isNaN(v) ? 0 : Math.max(0, Math.min(5000, v));
    }
  }

  $("ac-domain-question-continue-btn").addEventListener("click", function () {
    var step = domainQuestionSteps[currentDomainStepIndex];
    if (step.question === "frequency" && domainAnswers[step.domain.id].episodesPerMonth === null) {
      return; // a frequency choice is required before continuing
    }
    saveCurrentDomainAnswer();

    var isLastQuestionForThisDomain = step.question === "money";
    if (isLastQuestionForThisDomain && reviewEditMode) {
      reviewEditMode = false;
      showView("ac-view-review");
      renderReview();
      return;
    }

    currentDomainStepIndex++;
    if (currentDomainStepIndex >= domainQuestionSteps.length) {
      showView("ac-view-opportunities");
      renderOpportunities();
      return;
    }
    renderDomainQuestionStep();
  });

  /* ---------------------------------------------------------------------
   * STEP N+1: OPPORTUNITY INVENTORY
   * ------------------------------------------------------------------- */

  function renderOpportunities() {
    var list = $("ac-opportunity-list");
    list.innerHTML = "";
    AC_OPPORTUNITY_ITEMS.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "ac-checkbox-row";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "ac-opp-" + item.id;
      checkbox.checked = !!opportunityChecked[item.id];
      checkbox.addEventListener("change", function () {
        opportunityChecked[item.id] = checkbox.checked;
      });
      var label = document.createElement("label");
      label.setAttribute("for", "ac-opp-" + item.id);
      label.textContent = item.label;
      li.appendChild(checkbox);
      li.appendChild(label);
      list.appendChild(li);
    });
  }

  $("ac-opportunities-back-btn").addEventListener("click", function () {
    currentDomainStepIndex = domainQuestionSteps.length - 1;
    showView("ac-view-domain-question");
    renderDomainQuestionStep();
  });

  $("ac-opportunities-continue-btn").addEventListener("click", function () {
    if (reviewEditMode) {
      reviewEditMode = false;
      showView("ac-view-review");
      renderReview();
      return;
    }
    showView("ac-view-duration");
    renderDuration();
  });

  /* ---------------------------------------------------------------------
   * STEP N+2: DURATION
   * ------------------------------------------------------------------- */

  function renderDuration() {
    var grid = $("ac-duration-grid");
    grid.innerHTML = "";
    AC_DURATION_BUCKETS.forEach(function (bucket) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ac-bucket-btn" + (bucket.value === yearsReported ? " ac-bucket-selected" : "");
      btn.textContent = bucket.label;
      btn.setAttribute("aria-pressed", bucket.value === yearsReported ? "true" : "false");
      btn.addEventListener("click", function () {
        yearsReported = bucket.value;
        renderDuration();
        $("ac-duration-continue-btn").disabled = false;
      });
      grid.appendChild(btn);
    });
    $("ac-duration-continue-btn").disabled = yearsReported === null;
  }

  $("ac-duration-back-btn").addEventListener("click", function () {
    showView("ac-view-opportunities");
    renderOpportunities();
  });

  $("ac-duration-continue-btn").addEventListener("click", function () {
    if (yearsReported === null) return;
    if (reviewEditMode) {
      reviewEditMode = false;
      showView("ac-view-review");
      renderReview();
      return;
    }
    showView("ac-view-review");
    renderReview();
  });

  /* ---------------------------------------------------------------------
   * STEP N+3: REVIEW
   * ------------------------------------------------------------------- */

  function renderReview() {
    var totalMonthlyHours = AvoidanceCalc.totalMonthlyHours(selectedDomains.map(function (d) {
      return domainAnswers[d.id];
    }));
    $("ac-review-high-total-notice").hidden = !AvoidanceCalc.isHighTotal(totalMonthlyHours);

    var table = $("ac-review-table");
    table.innerHTML = "";

    selectedDomains.forEach(function (domain, index) {
      var answers = domainAnswers[domain.id];
      var li = document.createElement("li");
      var row = document.createElement("button");
      row.type = "button";
      row.className = "ac-review-row";
      var h4 = document.createElement("h4");
      h4.textContent = domain.label;
      var p = document.createElement("p");
      var freqLabel = bucketLabelForValue(AC_FREQUENCY_BUCKETS, answers.episodesPerMonth) || "—";
      p.textContent = freqLabel + " · " + formatMinutesLabel(answers.minutesPerEpisode) +
        " · $" + answers.dollarsPerMonth + "/mo";
      row.appendChild(h4);
      row.appendChild(p);
      row.addEventListener("click", function () {
        reviewEditMode = true;
        currentDomainStepIndex = domainQuestionSteps.findIndex(function (s) {
          return s.domain.id === domain.id && s.question === "frequency";
        });
        showView("ac-view-domain-question");
        renderDomainQuestionStep();
      });
      li.appendChild(row);
      table.appendChild(li);
    });

    var durationLi = document.createElement("li");
    var durationRow = document.createElement("button");
    durationRow.type = "button";
    durationRow.className = "ac-review-row";
    var durH4 = document.createElement("h4");
    durH4.textContent = "How long this has been part of your life";
    var durP = document.createElement("p");
    durP.textContent = bucketLabelForValue(AC_DURATION_BUCKETS, yearsReported);
    durationRow.appendChild(durH4);
    durationRow.appendChild(durP);
    durationRow.addEventListener("click", function () {
      reviewEditMode = true;
      showView("ac-view-duration");
      renderDuration();
    });
    durationLi.appendChild(durationRow);
    table.appendChild(durationLi);
  }

  $("ac-review-back-btn").addEventListener("click", function () {
    showView("ac-view-duration");
    renderDuration();
  });

  $("ac-review-continue-btn").addEventListener("click", function () {
    var domainsForCalc = selectedDomains.map(function (d) {
      var a = domainAnswers[d.id];
      return {
        id: d.id,
        label: d.label,
        episodesPerMonth: a.episodesPerMonth,
        minutesPerEpisode: a.minutesPerEpisode,
        dollarsPerMonth: a.dollarsPerMonth
      };
    });
    var opportunityCount = Object.keys(opportunityChecked).filter(function (id) {
      return opportunityChecked[id];
    }).length;
    currentTotals = AvoidanceCalc.computeTotals(domainsForCalc, yearsReported, opportunityCount);
    renderTotal(currentTotals);
    showView("ac-view-total");
  });

  /* ---------------------------------------------------------------------
   * STEP N+4: THE TOTAL
   * ------------------------------------------------------------------- */

  function renderTotal(totals) {
    var roundedAnnual = AvoidanceCalc.roundHours(totals.annualHours);
    var wakingDays = Math.round(totals.wakingDaysPerYear);
    var workWeeks = Math.round(totals.workWeeksPerYear);
    var weeksOfWakingLife = Math.round(totals.weeksOfWakingLife);
    var yearsWord = AC_DURATION_WORDS[yearsReported] || String(yearsReported);
    var largestLabel = totals.largestDomain ? totals.largestDomain.label : "";
    var largestAnnual = AvoidanceCalc.roundHours(totals.largestDomainAnnualHours);

    var numberEl = $("ac-total-number");
    numberEl.textContent = formatNumber(roundedAnnual) + " hours";
    numberEl.setAttribute("aria-hidden", "true");

    $("ac-line-primary").textContent = fillTemplate(AC_COPY.total.primaryLine, {
      annualHours: formatNumber(roundedAnnual)
    });
    $("ac-line-secondary").textContent = fillTemplate(AC_COPY.total.secondaryLine, {
      wakingDays: formatNumber(wakingDays),
      wakingDaysUnit: pluralize(wakingDays, "waking day", "waking days"),
      workWeeks: formatNumber(workWeeks),
      workWeeksUnit: pluralize(workWeeks, "work week", "work weeks")
    });
    $("ac-line-retrospective").textContent = fillTemplate(AC_COPY.total.retrospectiveLine, {
      years: yearsWord,
      yearsUnit: pluralize(yearsReported, "year", "years"),
      weeksOfWakingLife: formatNumber(weeksOfWakingLife),
      weeksUnit: pluralize(weeksOfWakingLife, "week", "weeks")
    });

    var moneyEl = $("ac-line-money");
    if (totals.annualDirectCost > 0) {
      var roundedAnnualCost = AvoidanceCalc.roundDollars(totals.annualDirectCost);
      var roundedTenYearCost = AvoidanceCalc.roundDollars(totals.tenYearCost);
      moneyEl.textContent = fillTemplate(AC_COPY.total.moneyLine, {
        annualCost: formatNumber(roundedAnnualCost),
        tenYearCost: formatNumber(roundedTenYearCost)
      });
      moneyEl.hidden = false;
    } else {
      moneyEl.hidden = true;
      moneyEl.textContent = "";
    }

    $("ac-line-life-radius").textContent = fillTemplate(AC_COPY.total.lifeRadiusLine, {
      domainCount: totals.domainCount,
      areaUnit: pluralize(totals.domainCount, "area", "areas"),
      opportunityCount: totals.opportunityCount,
      thingUnit: pluralize(totals.opportunityCount, "thing", "things")
    });
    $("ac-line-largest").textContent = fillTemplate(AC_COPY.total.largestPieceLine, {
      topDomainLabel: largestLabel,
      topDomainAnnualHours: formatNumber(largestAnnual)
    });

    // Reset the optional time-valuation toggle on every fresh total.
    $("ac-value-toggle").checked = false;
    $("ac-hourly-row").hidden = true;
    $("ac-hourly-rate-helper").hidden = true;
    $("ac-time-value-line").hidden = true;
    $("ac-time-value-line").textContent = "";
    $("ac-hourly-input").value = "0";

    populatePrintSheet(totals);
  }

  $("ac-value-toggle").addEventListener("change", function () {
    var on = this.checked;
    $("ac-hourly-row").hidden = !on;
    $("ac-hourly-rate-helper").hidden = !on;
    $("ac-time-value-line").hidden = !on;
    if (on) {
      $("ac-hourly-rate-helper").textContent = AC_COPY.total.hourlyRateHelper;
      updateTimeValueLine();
    }
  });

  $("ac-hourly-input").addEventListener("input", updateTimeValueLine);

  function updateTimeValueLine() {
    if (!currentTotals || !$("ac-value-toggle").checked) return;
    var rate = parseFloat($("ac-hourly-input").value);
    if (isNaN(rate) || rate < 0) rate = 0;
    var value = AvoidanceCalc.timeValueAnnual(currentTotals.annualHours, rate);
    var rounded = AvoidanceCalc.roundDollars(value);
    $("ac-time-value-line").textContent = fillTemplate(AC_COPY.total.timeValueLine, {
      rate: formatNumber(rate),
      value: formatNumber(rounded)
    });
  }

  $("ac-total-continue-btn").addEventListener("click", function () {
    var largestLabel = currentTotals.largestDomain ? currentTotals.largestDomain.label : "";
    var largestAnnual = formatNumber(AvoidanceCalc.roundHours(currentTotals.largestDomainAnnualHours));
    $("ac-reframe-largest-line").textContent = fillTemplate(AC_COPY.reframe.body[2], {
      topDomainLabel: largestLabel,
      topDomainAnnualHours: largestAnnual
    });
    showView("ac-view-reframe");
  });

  /* ---------------------------------------------------------------------
   * STEP N+5: REFRAME
   * ------------------------------------------------------------------- */

  $("ac-reframe-continue-btn").addEventListener("click", function () {
    showView("ac-view-nextstep");
  });

  /* ---------------------------------------------------------------------
   * STEP N+6: NEXT STEP
   * ------------------------------------------------------------------- */

  function populatePrintSheet(totals) {
    var figuresEl = $("ac-print-figures");
    figuresEl.innerHTML = "";
    var lines = [
      $("ac-line-primary").textContent,
      $("ac-line-secondary").textContent,
      $("ac-line-retrospective").textContent
    ];
    if (totals.annualDirectCost > 0) lines.push($("ac-line-money").textContent);
    lines.push($("ac-line-life-radius").textContent);
    lines.forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      figuresEl.appendChild(p);
    });
    $("ac-print-largest").textContent = $("ac-line-largest").textContent;

    var qList = $("ac-print-questions");
    qList.innerHTML = "";
    AC_COPY.discussionQuestions.forEach(function (q) {
      var li = document.createElement("li");
      li.textContent = q;
      qList.appendChild(li);
    });
  }

  $("ac-save-copy-card").addEventListener("click", function () {
    window.print();
  });

  $("ac-bring-to-therapist-card").addEventListener("click", function () {
    var block = $("ac-discussion-questions");
    var list = $("ac-discussion-list");
    if (!block.hidden) { block.hidden = true; return; }
    list.innerHTML = "";
    AC_COPY.discussionQuestions.forEach(function (q) {
      var li = document.createElement("li");
      li.textContent = q;
      list.appendChild(li);
    });
    block.hidden = false;
  });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  $("ac-value-toggle-label").textContent = AC_COPY.total.valueToggleLabel;
  showView("ac-view-opening");
})();
