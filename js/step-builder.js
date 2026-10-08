(function () {
  "use strict";

  if (typeof SB_COPY === "undefined") return;

  /* ---------------------------------------------------------------------
   * STATE
   * ------------------------------------------------------------------- */

  var SB_STORAGE_KEY = "sb_plan_v1";
  var SB_DECLINED_KEY = "sb_declined_once";

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function newSituation(text) {
    return {
      id: uid("s"),
      text: text || "",
      difficulty: 50,
      importance: 50,
      fearedOutcome: "",
      manualPin: false,
      attempts: []
    };
  }

  function defaultState() {
    return {
      goalText: "",
      goalWhy: "",
      situations: [],
      stackOrder: [],
      firstStepId: null,
      createdAt: null,
      updatedAt: null
    };
  }

  var state = defaultState();
  var storageConsent = false;
  var mode = "build"; // "build" | "practice"
  var buildScreen = "opening";
  var practiceScreen = "home";
  var openingShowsDeclinedNote = false;

  // Transient, never persisted
  var rateIndex = 0;
  var fearedOpenFor = {}; // situation id -> bool, feared-outcome field expanded
  var expandedStackRowId = null;
  var bridgeSourceId = null;
  var bridgeReturnTo = { mode: "build", screen: "stack" };
  var bridgePending = []; // [{localId, text, difficulty}]
  var bridgeAddedIds = [];
  var bridgeShowStillBig = false;
  var firstStepSelection = null;
  var activeStepId = null; // practice mode: which step is being practiced
  var timerRunning = false, timerSeconds = 0, timerInterval = null, pendingTimerSeconds = null;
  var afterOutcome = null, afterBarrier = null, afterComparison = null;
  var moveNote = null; // brief "moved up/down" note shown on practice home

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function situationById(id) {
    return state.situations.filter(function (s) { return s.id === id; })[0] || null;
  }

  function announce(text) {
    var live = $("sb-live-region");
    if (live) live.textContent = text;
  }

  function formatDuration(seconds) {
    seconds = Math.round(seconds);
    if (seconds < 10) return "a few seconds";
    if (seconds < 60) return seconds + " seconds";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      if (seconds < 50) return "about " + minutes + " minute" + (minutes === 1 ? "" : "s");
      return minutes + " minute" + (minutes === 1 ? "" : "s");
    }
    var hours = seconds / 3600;
    if (hours < 1.08) return "about an hour";
    return "just over " + Math.floor(hours) + " hour" + (Math.floor(hours) === 1 ? "" : "s");
  }

  function formatDateRelative(iso) {
    if (!iso) return "";
    var then = new Date(iso);
    var now = new Date();
    var days = Math.floor((startOfDay(now) - startOfDay(then)) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days > 1 && days < 7) return days + " days ago";
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: then.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  /* ---------------------------------------------------------------------
   * STORAGE -- opt-in, device-only. Nothing is written unless
   * storageConsent is explicitly true, set only by the person choosing
   * "keep it" on the storage screen.
   * ------------------------------------------------------------------- */

  function saveState() {
    if (!storageConsent) return;
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable -- fail silently, session still works */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(SB_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function deleteEverything() {
    try { localStorage.removeItem(SB_STORAGE_KEY); } catch (e) {}
    storageConsent = false;
    state = defaultState();
    mode = "build";
    buildScreen = "opening";
    openingShowsDeclinedNote = false;
    activeStepId = null;
    renderAll();
  }

  $("sb-delete-btn").addEventListener("click", function () {
    if (window.confirm(SB_COPY.deleteControl.confirmTemplate)) deleteEverything();
  });

  /* ---------------------------------------------------------------------
   * STACK ORDERING -- difficulty-sorted, hardest at the top, easiest at
   * the bottom, unless a row has been manually dragged/moved, which pins
   * it until its difficulty is rated again.
   * ------------------------------------------------------------------- */

  function recomputeStackOrder() {
    var byId = {};
    state.situations.forEach(function (s) { byId[s.id] = s; });

    state.situations.forEach(function (s) {
      if (state.stackOrder.indexOf(s.id) === -1) state.stackOrder.push(s.id);
    });
    state.stackOrder = state.stackOrder.filter(function (id) { return !!byId[id]; });

    var floatingIds = state.stackOrder.filter(function (id) { return !byId[id].manualPin; });
    floatingIds.sort(function (a, b) { return byId[b].difficulty - byId[a].difficulty; });
    var i = 0;
    state.stackOrder = state.stackOrder.map(function (id) {
      return byId[id].manualPin ? id : floatingIds[i++];
    });
  }

  function orderedSituations() {
    recomputeStackOrder();
    return state.stackOrder.map(situationById).filter(Boolean);
  }

  function unpinAndRerate(situation, newDifficulty) {
    situation.manualPin = false;
    situation.difficulty = newDifficulty;
  }

  /* ---------------------------------------------------------------------
   * TOP-LEVEL RENDER DISPATCH
   * ------------------------------------------------------------------- */

  var BUILD_SCREEN_IDS = {
    opening: "sb-screen-opening", goal: "sb-screen-goal", generate: "sb-screen-generate",
    rate: "sb-screen-rate", stack: "sb-screen-stack", bridge: "sb-screen-bridge",
    firstStep: "sb-screen-first-step", storage: "sb-screen-storage"
  };
  var PRACTICE_SCREEN_IDS = {
    home: "sb-screen-practice-home", before: "sb-screen-before",
    after: "sb-screen-after", record: "sb-screen-record"
  };

  function renderAll() {
    $("sb-crisis-line").textContent = SB_CRISIS_LINE;
    $("sb-delete-btn").hidden = !storageConsent;
    $("sb-delete-btn").textContent = SB_COPY.deleteControl.label;

    $("sb-view-build").hidden = mode !== "build";
    $("sb-view-practice").hidden = mode !== "practice";
    if (mode === "build") renderBuildScreen(); else renderPracticeScreen();
    updatePrintSheet();
    saveState();
  }

  function renderBuildScreen() {
    Object.keys(BUILD_SCREEN_IDS).forEach(function (k) { $(BUILD_SCREEN_IDS[k]).hidden = (k !== buildScreen); });
    if (buildScreen === "opening") renderOpening();
    else if (buildScreen === "goal") renderGoal();
    else if (buildScreen === "generate") renderGenerate();
    else if (buildScreen === "rate") renderRate();
    else if (buildScreen === "stack") renderStack();
    else if (buildScreen === "bridge") renderBridge();
    else if (buildScreen === "firstStep") renderFirstStep();
    else if (buildScreen === "storage") renderStorage();
    announce(buildScreen + " screen");
  }

  function renderPracticeScreen() {
    Object.keys(PRACTICE_SCREEN_IDS).forEach(function (k) { $(PRACTICE_SCREEN_IDS[k]).hidden = (k !== practiceScreen); });
    if (practiceScreen === "home") renderPracticeHome();
    else if (practiceScreen === "before") renderBefore();
    else if (practiceScreen === "after") renderAfter();
    else if (practiceScreen === "record") renderRecord();
    announce("practice " + practiceScreen + " screen");
  }

  /* ---------------------------------------------------------------------
   * SCREEN 1 -- OPENING
   * ------------------------------------------------------------------- */

  function renderOpening() {
    $("sb-opening-heading").textContent = SB_COPY.opening.heading;
    var body = $("sb-opening-body");
    body.innerHTML = "";
    SB_COPY.opening.body.forEach(function (p) {
      var el = document.createElement("p");
      el.textContent = p;
      body.appendChild(el);
    });
    $("sb-opening-declined-note").hidden = !openingShowsDeclinedNote;
    $("sb-opening-declined-note").textContent = SB_COPY.opening.declinedNote;
    $("sb-opening-disclaimer").textContent = SB_STANDING_DISCLAIMER;
    $("sb-opening-start-btn").textContent = SB_COPY.opening.start;
  }

  $("sb-opening-start-btn").addEventListener("click", function () {
    buildScreen = "goal";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCREEN 2 -- THE GOAL
   * ------------------------------------------------------------------- */

  function renderGoal() {
    $("sb-goal-heading").textContent = SB_COPY.goal.heading;
    $("sb-goal-helper").textContent = SB_COPY.goal.helper;
    $("sb-goal-text").value = state.goalText;
    $("sb-goal-text").setAttribute("placeholder", SB_COPY.goal.placeholder);
    $("sb-goal-examples-toggle").textContent = SB_COPY.goal.examplesToggle;
    $("sb-goal-why-label").textContent = SB_COPY.goal.whyLabel;
    $("sb-goal-why-helper").textContent = SB_COPY.goal.whyHelper;
    $("sb-goal-why").value = state.goalWhy;
    $("sb-goal-continue-btn").textContent = SB_COPY.goal.continue;

    var chips = $("sb-goal-examples");
    chips.innerHTML = "";
    SB_GOAL_EXAMPLES.forEach(function (ex) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sb-chip";
      chip.textContent = ex;
      chip.addEventListener("click", function () {
        state.goalText = ex;
        $("sb-goal-text").value = ex;
      });
      chips.appendChild(chip);
    });
  }

  $("sb-goal-text").addEventListener("input", function () { state.goalText = this.value; });
  $("sb-goal-why").addEventListener("input", function () { state.goalWhy = this.value; });
  $("sb-goal-examples-toggle").addEventListener("click", function () {
    var chips = $("sb-goal-examples");
    chips.hidden = !chips.hidden;
  });
  $("sb-goal-continue-btn").addEventListener("click", function () {
    if (!state.goalText.trim()) { $("sb-goal-text").focus(); return; }
    buildScreen = "generate";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCREEN 3 -- GENERATING SITUATIONS
   * ------------------------------------------------------------------- */

  var activeVariablePromptId = null;

  function addSituation(text) {
    text = text.trim();
    if (!text) return;
    state.situations.push(newSituation(text));
    renderGenerate();
  }

  function renderGenerate() {
    $("sb-generate-heading").textContent = SB_COPY.generate.heading;
    $("sb-generate-helper").textContent = SB_COPY.generate.helper;
    $("sb-generate-input").setAttribute("placeholder", SB_COPY.generate.entryPlaceholder);
    $("sb-generate-add-btn").textContent = SB_COPY.generate.addLabel;
    $("sb-generate-prompts-heading").textContent = SB_COPY.generate.promptsHeading;
    $("sb-generate-continue-btn").textContent = SB_COPY.generate.continue;

    var n = state.situations.length;
    $("sb-generate-count").textContent = n === 1 ? SB_COPY.generate.countTemplateOne : SB_COPY.generate.countTemplate.replace("{n}", n);
    $("sb-generate-encourage").hidden = !(n >= SB_SITUATIONS_ENCOURAGE_AT && n < SB_SITUATIONS_ENCOURAGE_AT + 4);
    $("sb-generate-encourage").textContent = SB_COPY.generate.encourageAtSix;
    $("sb-generate-softwarn").hidden = n <= SB_SITUATIONS_SOFT_WARN;
    $("sb-generate-softwarn").textContent = SB_COPY.generate.softWarnPastTwentyFive;
    $("sb-generate-min-notice").hidden = n >= SB_SITUATIONS_MIN;
    $("sb-generate-min-notice").textContent = SB_COPY.generate.minNotice;
    $("sb-generate-continue-btn").disabled = n < SB_SITUATIONS_MIN;

    var list = $("sb-generate-list");
    list.innerHTML = "";
    state.situations.forEach(function (s) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = s.text;
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "sb-situation-remove";
      remove.innerHTML = "&times;";
      remove.setAttribute("aria-label", "Remove " + s.text);
      remove.addEventListener("click", function () {
        state.situations = state.situations.filter(function (x) { return x.id !== s.id; });
        renderGenerate();
      });
      li.appendChild(span);
      li.appendChild(remove);
      list.appendChild(li);
    });

    var prompts = $("sb-generate-prompts");
    prompts.innerHTML = "";
    SB_VARIABLE_PROMPTS.forEach(function (p) {
      var wrap = document.createElement("div");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sb-variable-prompt-btn";
      btn.textContent = p.question;
      btn.setAttribute("aria-expanded", activeVariablePromptId === p.id ? "true" : "false");
      btn.addEventListener("click", function () {
        activeVariablePromptId = activeVariablePromptId === p.id ? null : p.id;
        renderGenerate();
      });
      wrap.appendChild(btn);
      if (activeVariablePromptId === p.id) {
        var panel = document.createElement("div");
        panel.className = "sb-variable-prompt-panel";
        var q = document.createElement("p");
        q.className = "sb-variable-prompt-question";
        q.textContent = p.question;
        panel.appendChild(q);
        var optRow = document.createElement("div");
        optRow.className = "sb-chip-row";
        p.options.forEach(function (opt) {
          var chip = document.createElement("button");
          chip.type = "button";
          chip.className = "sb-chip";
          chip.textContent = opt;
          chip.addEventListener("click", function () {
            addSituation(state.goalText ? (state.goalText + " — " + opt) : opt);
          });
          optRow.appendChild(chip);
        });
        panel.appendChild(optRow);
        wrap.appendChild(panel);
      }
      prompts.appendChild(wrap);
    });
  }

  $("sb-generate-add-btn").addEventListener("click", function () {
    addSituation($("sb-generate-input").value);
    $("sb-generate-input").value = "";
    $("sb-generate-input").focus();
  });
  $("sb-generate-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("sb-generate-add-btn").click(); }
  });
  $("sb-generate-continue-btn").addEventListener("click", function () {
    if (state.situations.length < SB_SITUATIONS_MIN) return;
    rateIndex = 0;
    buildScreen = "rate";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCREEN 4 -- RATING
   * ------------------------------------------------------------------- */

  function renderRate() {
    if (rateIndex >= state.situations.length) rateIndex = state.situations.length - 1;
    if (rateIndex < 0) rateIndex = 0;
    var s = state.situations[rateIndex];
    if (!s) return;

    $("sb-rate-situation-text").textContent = s.text;
    $("sb-rate-difficulty-label").textContent = SB_COPY.rate.heading;
    $("sb-rate-importance-label").textContent = SB_COPY.rate.importanceHeading;
    $("sb-rate-importance-helper").textContent = SB_COPY.rate.importanceHelper;
    $("sb-rate-feared-toggle").textContent = SB_COPY.rate.fearedToggle;
    $("sb-rate-feared-helper").textContent = SB_COPY.rate.fearedHelper;
    $("sb-rate-feared").setAttribute("placeholder", SB_COPY.rate.fearedPlaceholder);

    $("sb-rate-difficulty").value = s.difficulty;
    $("sb-rate-difficulty-readout").textContent = s.difficulty + " — " + sbNearestAnchorLabel(s.difficulty, SB_DIFFICULTY_ANCHORS);
    var scale = $("sb-rate-difficulty-scale");
    scale.innerHTML = "";
    [SB_DIFFICULTY_ANCHORS[0], SB_DIFFICULTY_ANCHORS[2], SB_DIFFICULTY_ANCHORS[4]].forEach(function (a) {
      var span = document.createElement("span");
      span.textContent = a.value + " " + a.label;
      scale.appendChild(span);
    });

    $("sb-rate-importance").value = s.importance;
    $("sb-rate-importance-readout").textContent = String(s.importance);

    var fearedOpen = !!fearedOpenFor[s.id];
    $("sb-rate-feared-wrap").hidden = !fearedOpen;
    $("sb-rate-feared").value = s.fearedOutcome;

    $("sb-rate-back-btn").textContent = SB_COPY.rate.back;
    $("sb-rate-back-btn").hidden = rateIndex === 0;
    $("sb-rate-next-btn").textContent = rateIndex === state.situations.length - 1 ? SB_COPY.rate.continue : SB_COPY.rate.next;

    var sidebar = $("sb-rate-sidebar-list");
    sidebar.innerHTML = "";
    state.situations.forEach(function (sit, idx) {
      var li = document.createElement("li");
      li.textContent = sit.text;
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      if (idx === rateIndex) li.className = "sb-current";
      else if (idx < rateIndex) li.className = "sb-rated";
      li.addEventListener("click", function () { rateIndex = idx; renderRate(); });
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rateIndex = idx; renderRate(); } });
      sidebar.appendChild(li);
    });
  }

  $("sb-rate-difficulty").addEventListener("input", function () {
    var s = state.situations[rateIndex];
    if (s) { s.difficulty = parseInt(this.value, 10); s.manualPin = false; }
    $("sb-rate-difficulty-readout").textContent = this.value + " — " + sbNearestAnchorLabel(parseInt(this.value, 10), SB_DIFFICULTY_ANCHORS);
  });
  $("sb-rate-importance").addEventListener("input", function () {
    var s = state.situations[rateIndex];
    if (s) s.importance = parseInt(this.value, 10);
    $("sb-rate-importance-readout").textContent = this.value;
  });
  $("sb-rate-feared-toggle").addEventListener("click", function () {
    var s = state.situations[rateIndex];
    if (!s) return;
    fearedOpenFor[s.id] = !fearedOpenFor[s.id];
    renderRate();
  });
  $("sb-rate-feared").addEventListener("input", function () {
    var s = state.situations[rateIndex];
    if (s) s.fearedOutcome = this.value;
  });
  $("sb-rate-back-btn").addEventListener("click", function () { rateIndex--; renderAll(); });
  $("sb-rate-next-btn").addEventListener("click", function () {
    if (rateIndex < state.situations.length - 1) { rateIndex++; renderAll(); }
    else { buildScreen = "stack"; renderAll(); }
  });

  /* ---------------------------------------------------------------------
   * STACK ROW BUILDER -- shared across the stack screen, the first-step
   * screen, and the practice-home stack list.
   * ------------------------------------------------------------------- */

  function buildStackRowEl(s, opts) {
    opts = opts || {};
    var row = document.createElement("div");
    row.className = "sb-stack-row";
    if (opts.selected) row.classList.add("sb-stack-row-selected");
    if (s.manualPin) row.classList.add("sb-stack-row-pinned");

    if (opts.moveHandlers) {
      var moveWrap = document.createElement("div");
      moveWrap.style.display = "flex";
      moveWrap.style.flexDirection = "column";
      var up = document.createElement("button");
      up.type = "button"; up.className = "sb-stack-icon-btn"; up.innerHTML = "&uarr;";
      up.setAttribute("aria-label", SB_COPY.stack.moveUpLabel + ": " + s.text);
      up.addEventListener("click", function (e) { e.stopPropagation(); opts.moveHandlers.up(s); });
      var down = document.createElement("button");
      down.type = "button"; down.className = "sb-stack-icon-btn"; down.innerHTML = "&darr;";
      down.setAttribute("aria-label", SB_COPY.stack.moveDownLabel + ": " + s.text);
      down.addEventListener("click", function (e) { e.stopPropagation(); opts.moveHandlers.down(s); });
      moveWrap.appendChild(up); moveWrap.appendChild(down);
      row.appendChild(moveWrap);
    }

    var rating = document.createElement("div");
    rating.className = "sb-stack-rating";
    rating.textContent = s.difficulty;
    row.appendChild(rating);

    var main = document.createElement("div");
    main.className = "sb-stack-main";
    var text = document.createElement("div");
    text.className = "sb-stack-text";
    text.textContent = s.text;
    main.appendChild(text);
    var meta = document.createElement("div");
    meta.className = "sb-stack-meta";
    var metaBits = ["matters " + s.importance + "/100"];
    if (s.attempts.length) metaBits.push(s.attempts.length + (s.attempts.length === 1 ? " attempt" : " attempts"));
    meta.textContent = metaBits.join(" · ");
    main.appendChild(meta);
    row.appendChild(main);

    if (opts.onRowClick) {
      row.style.cursor = "pointer";
      row.addEventListener("click", function () { opts.onRowClick(s); });
    }

    if (opts.controls) {
      var controls = document.createElement("div");
      controls.className = "sb-stack-controls";
      opts.controls(s, controls);
      row.appendChild(controls);
    }

    return row;
  }

  function buildStackDetailEl(s, onChange) {
    var wrap = document.createElement("div");
    wrap.className = "sb-stack-detail";

    var textField = document.createElement("div");
    textField.className = "sb-field";
    var textInput = document.createElement("textarea");
    textInput.className = "sb-textarea";
    textInput.rows = 2;
    textInput.value = s.text;
    textInput.setAttribute("aria-label", "Situation text");
    textInput.addEventListener("input", function () { s.text = this.value; onChange(); });
    textField.appendChild(textInput);
    wrap.appendChild(textField);

    wrap.appendChild(buildInlineSlider(SB_COPY.rate.heading, s.difficulty, function (v) { unpinAndRerate(s, v); onChange(); }));
    wrap.appendChild(buildInlineSlider(SB_COPY.rate.importanceHeading, s.importance, function (v) { s.importance = v; onChange(); }));

    var fearedField = document.createElement("div");
    fearedField.className = "sb-field";
    var fearedLabel = document.createElement("label");
    fearedLabel.className = "sb-field-label";
    fearedLabel.textContent = SB_COPY.rate.fearedToggle;
    var fearedInput = document.createElement("textarea");
    fearedInput.className = "sb-textarea";
    fearedInput.rows = 2;
    fearedInput.value = s.fearedOutcome;
    fearedInput.placeholder = SB_COPY.rate.fearedPlaceholder;
    fearedInput.addEventListener("input", function () { s.fearedOutcome = this.value; });
    fearedField.appendChild(fearedLabel);
    fearedField.appendChild(fearedInput);
    wrap.appendChild(fearedField);

    var actions = document.createElement("div");
    actions.className = "sb-actions";
    var tooBig = document.createElement("button");
    tooBig.type = "button"; tooBig.className = "btn btn-outline btn-sm";
    tooBig.textContent = SB_COPY.stack.tooBigLabel;
    tooBig.addEventListener("click", function () {
      bridgeSourceId = s.id;
      bridgeReturnTo = { mode: "build", screen: "stack" };
      bridgePending = []; bridgeShowStillBig = false; bridgeAddedIds = [];
      buildScreen = "bridge";
      renderAll();
    });
    var del = document.createElement("button");
    del.type = "button"; del.className = "btn btn-ghost btn-sm";
    del.textContent = SB_COPY.stack.deleteLabel;
    del.addEventListener("click", function () {
      var attemptsNote = s.attempts.length ? SB_COPY.stack.deleteConfirmAttemptsNote.replace("{n}", s.attempts.length) : "";
      var msg = SB_COPY.stack.deleteConfirmTemplate.replace("{text}", s.text).replace("{attemptsNote}", attemptsNote);
      if (!window.confirm(msg)) return;
      state.situations = state.situations.filter(function (x) { return x.id !== s.id; });
      state.stackOrder = state.stackOrder.filter(function (id) { return id !== s.id; });
      if (state.firstStepId === s.id) state.firstStepId = null;
      if (activeStepId === s.id) activeStepId = null;
      expandedStackRowId = null;
      onChange();
    });
    actions.appendChild(tooBig);
    actions.appendChild(del);
    wrap.appendChild(actions);

    return wrap;
  }

  function buildInlineSlider(labelText, value, onInput) {
    var field = document.createElement("div");
    field.className = "sb-field";
    var label = document.createElement("label");
    label.className = "sb-field-label";
    label.textContent = labelText;
    var slider = document.createElement("input");
    slider.type = "range"; slider.className = "sb-slider";
    slider.min = 0; slider.max = 100; slider.step = 5; slider.value = value;
    var readout = document.createElement("div");
    readout.className = "sb-slider-readout";
    readout.textContent = String(value);
    slider.addEventListener("input", function () {
      readout.textContent = this.value;
      onInput(parseInt(this.value, 10));
    });
    field.appendChild(label);
    field.appendChild(slider);
    field.appendChild(readout);
    return field;
  }

  /* ---------------------------------------------------------------------
   * SCREEN 5 -- THE STACK
   * ------------------------------------------------------------------- */

  function renderStack() {
    $("sb-stack-heading").textContent = SB_COPY.stack.heading;
    $("sb-stack-add-btn").textContent = SB_COPY.stack.addLabel;
    $("sb-stack-continue-btn").textContent = SB_COPY.stack.continue;

    var list = $("sb-stack-list");
    list.innerHTML = "";

    var allHigh = state.situations.length > 0 && state.situations.every(function (s) { return s.difficulty >= 100; });
    if (allHigh) {
      var notice = document.createElement("p");
      notice.className = "sb-inline-notice";
      notice.textContent = SB_COPY.stack.allHighPrompt;
      list.appendChild(notice);
    }

    var order = orderedSituations();
    order.forEach(function (s, idx) {
      var row = buildStackRowEl(s, {
        selected: expandedStackRowId === s.id,
        moveHandlers: {
          up: function (sit) { moveInStack(sit, -1); },
          down: function (sit) { moveInStack(sit, 1); }
        },
        onRowClick: function (sit) {
          expandedStackRowId = expandedStackRowId === sit.id ? null : sit.id;
          renderStack();
        },
        controls: function (sit, el) {
          var icon = document.createElement("span");
          icon.textContent = expandedStackRowId === sit.id ? "▲" : "▼";
          icon.className = "sb-stack-icon-btn";
          el.appendChild(icon);
        }
      });
      list.appendChild(row);

      if (expandedStackRowId === s.id) {
        list.appendChild(buildStackDetailEl(s, function () { renderStack(); }));
      }

      var next = order[idx + 1];
      if (next && Math.abs(s.difficulty - next.difficulty) > SB_GAP_THRESHOLD) {
        var gapDiv = document.createElement("div");
        gapDiv.className = "sb-stack-gap";
        var line1 = document.createElement("div");
        line1.className = "sb-stack-gap-line";
        var label = document.createElement("span");
        label.textContent = SB_COPY.stack.gapTemplate.replace("{n}", Math.abs(s.difficulty - next.difficulty));
        var action = document.createElement("button");
        action.type = "button";
        action.className = "sb-stack-gap-action";
        action.textContent = SB_COPY.stack.gapAction;
        action.addEventListener("click", function () {
          bridgeSourceId = (s.difficulty >= next.difficulty ? s : next).id;
          bridgeReturnTo = { mode: "build", screen: "stack" };
          bridgePending = []; bridgeShowStillBig = false; bridgeAddedIds = [];
          buildScreen = "bridge";
          renderAll();
        });
        var line2 = document.createElement("div");
        line2.className = "sb-stack-gap-line";
        gapDiv.appendChild(line1);
        gapDiv.appendChild(label);
        gapDiv.appendChild(action);
        gapDiv.appendChild(line2);
        list.appendChild(gapDiv);
      }
    });
  }

  function moveInStack(situation, direction) {
    var order = state.stackOrder.slice();
    var idx = order.indexOf(situation.id);
    var swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= order.length) return;
    order[idx] = order[swapWith];
    order[swapWith] = situation.id;
    state.stackOrder = order;
    situation.manualPin = true;
    renderStack();
  }

  $("sb-stack-add-btn").addEventListener("click", function () {
    var text = window.prompt(SB_COPY.generate.entryPlaceholder);
    if (!text || !text.trim()) return;
    var s = newSituation(text.trim());
    state.situations.push(s);
    expandedStackRowId = s.id;
    renderStack();
  });
  $("sb-stack-continue-btn").addEventListener("click", function () {
    firstStepSelection = null;
    buildScreen = "firstStep";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCREEN 6 -- BUILD A BRIDGE STEP
   * ------------------------------------------------------------------- */

  function templateForMethod(method, sourceText, option) {
    if (method === "shorten") return sourceText + ", for just " + option;
    if (method === "leave") return sourceText + ", " + option;
    if (method === "who") return option === "alone" ? sourceText + ", alone" : sourceText + ", with " + option;
    return option;
  }

  function addBridgePending(text) {
    bridgePending.push({ localId: uid("bp"), text: text, difficulty: 50 });
    renderBridge();
  }

  function renderBridge() {
    var source = situationById(bridgeSourceId);
    if (!source) { buildScreen = bridgeReturnTo.screen; renderAll(); return; }

    $("sb-bridge-heading").textContent = SB_COPY.bridge.heading;
    $("sb-bridge-intro").textContent = SB_COPY.bridge.intro;
    $("sb-bridge-situation-text").textContent = source.text;

    $("sb-bridge-shorten-label").textContent = SB_COPY.bridge.shortenLabel;
    $("sb-bridge-shorten-prompt").textContent = SB_COPY.bridge.shortenPrompt;
    $("sb-bridge-leave-label").textContent = SB_COPY.bridge.leaveLabel;
    $("sb-bridge-leave-prompt").textContent = SB_COPY.bridge.leavePrompt;
    $("sb-bridge-who-label").textContent = SB_COPY.bridge.whoLabel;
    $("sb-bridge-who-prompt").textContent = SB_COPY.bridge.whoPrompt;
    $("sb-bridge-part-label").textContent = SB_COPY.bridge.partLabel;
    $("sb-bridge-part-prompt").textContent = SB_COPY.bridge.partPrompt;
    $("sb-bridge-part-helper").textContent = SB_COPY.bridge.partHelper;
    $("sb-bridge-part-input").setAttribute("placeholder", SB_COPY.bridge.partPlaceholder);
    $("sb-bridge-part-add-btn").textContent = SB_COPY.generate.addLabel;
    $("sb-bridge-done-btn").textContent = SB_COPY.bridge.done;

    function fillOptions(containerId, options, method) {
      var el = $(containerId);
      el.innerHTML = "";
      options.forEach(function (opt) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sb-chip";
        chip.textContent = opt;
        chip.addEventListener("click", function () { addBridgePending(templateForMethod(method, source.text, opt)); });
        el.appendChild(chip);
      });
    }
    fillOptions("sb-bridge-shorten-options", SB_BRIDGE_DURATIONS, "shorten");
    fillOptions("sb-bridge-leave-options", SB_BRIDGE_LEAVE_OPTIONS, "leave");
    fillOptions("sb-bridge-who-options", SB_BRIDGE_WHO_OPTIONS, "who");

    var newSteps = $("sb-bridge-new-steps");
    newSteps.innerHTML = "";
    bridgePending.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "sb-bridge-new-step";
      var text = document.createElement("p");
      text.className = "sb-bridge-new-step-text";
      text.textContent = p.text;
      card.appendChild(text);
      card.appendChild(buildInlineSlider(SB_COPY.bridge.rateNewStep, p.difficulty, function (v) { p.difficulty = v; }));
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary btn-sm";
      addBtn.textContent = SB_COPY.bridge.addToStack;
      addBtn.addEventListener("click", function () {
        var newS = newSituation(p.text);
        newS.difficulty = p.difficulty;
        state.situations.push(newS);
        bridgeAddedIds.push(newS.id);
        bridgePending = bridgePending.filter(function (x) { return x.localId !== p.localId; });
        bridgeShowStillBig = true;
        renderBridge();
      });
      card.appendChild(addBtn);
      newSteps.appendChild(card);
    });

    var stillBig = $("sb-bridge-still-big");
    stillBig.hidden = !bridgeShowStillBig;
    stillBig.innerHTML = "";
    if (bridgeShowStillBig) {
      var p1 = document.createElement("span");
      p1.textContent = SB_COPY.bridge.stillBig + " ";
      var again = document.createElement("button");
      again.type = "button";
      again.className = "sb-link-btn";
      again.textContent = SB_COPY.bridge.makeSmallerAgain;
      again.addEventListener("click", function () {
        var lastId = bridgeAddedIds[bridgeAddedIds.length - 1];
        bridgeSourceId = lastId;
        bridgePending = [];
        bridgeShowStillBig = false;
        renderBridge();
      });
      stillBig.appendChild(p1);
      stillBig.appendChild(again);
    }
  }

  $("sb-bridge-part-add-btn").addEventListener("click", function () {
    var v = $("sb-bridge-part-input").value;
    if (!v.trim()) return;
    addBridgePending(v.trim());
    $("sb-bridge-part-input").value = "";
  });
  $("sb-bridge-part-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("sb-bridge-part-add-btn").click(); }
  });
  $("sb-bridge-done-btn").addEventListener("click", function () {
    mode = bridgeReturnTo.mode;
    if (mode === "build") buildScreen = bridgeReturnTo.screen;
    else practiceScreen = bridgeReturnTo.screen;
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCREEN 7 -- FIRST STEP
   * ------------------------------------------------------------------- */

  function renderFirstStep() {
    $("sb-first-step-heading").textContent = SB_COPY.firstStep.heading;
    $("sb-first-step-continue-btn").textContent = SB_COPY.firstStep.continue;

    var order = orderedSituations();
    var above20 = order.filter(function (s) { return s.difficulty > 20; });
    var pool = above20.length ? above20 : order;
    var suggestion = pool.reduce(function (min, s) { return (min === null || s.difficulty < min.difficulty) ? s : min; }, null);

    var suggestionEl = $("sb-first-step-suggestion");
    if (above20.length) {
      suggestionEl.textContent = SB_COPY.firstStep.suggestionTemplate.replace("{rating}", suggestion ? suggestion.difficulty : "");
    } else {
      suggestionEl.textContent = SB_COPY.firstStep.allManageable;
    }

    var topStep = order[0];
    $("sb-first-step-top-warning").textContent = SB_COPY.firstStep.topStepWarning;
    $("sb-first-step-top-warning").hidden = !(firstStepSelection && topStep && firstStepSelection === topStep.id && order.length > 1);

    var list = $("sb-first-step-list");
    list.innerHTML = "";
    order.forEach(function (s) {
      var row = buildStackRowEl(s, {
        selected: firstStepSelection === s.id,
        onRowClick: function (sit) {
          firstStepSelection = sit.id;
          renderFirstStep();
        }
      });
      if (suggestion && s.id === suggestion.id) {
        var badge = document.createElement("span");
        badge.className = "sb-chip sb-chip-selected";
        badge.style.marginLeft = "8px";
        badge.textContent = "suggested";
        row.querySelector(".sb-stack-main").appendChild(badge);
      }
      list.appendChild(row);
    });

    $("sb-first-step-continue-btn").disabled = !firstStepSelection;
  }

  $("sb-first-step-continue-btn").addEventListener("click", function () {
    if (!firstStepSelection) return;
    state.firstStepId = firstStepSelection;
    buildScreen = "storage";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * SCREEN 8 -- STORAGE OFFER
   * ------------------------------------------------------------------- */

  var storageChoice = null; // "keep" | "decline"

  function renderStorage() {
    $("sb-storage-heading").textContent = SB_COPY.storage.heading;
    $("sb-storage-offer-text").textContent = SB_STORAGE_OFFER_TEXT;
    $("sb-storage-keep-btn").textContent = SB_COPY.storage.keepLabel;
    $("sb-storage-decline-btn").textContent = SB_COPY.storage.declineLabel;
    $("sb-storage-keep-btn").className = "sb-chip" + (storageChoice === "keep" ? " sb-chip-selected" : "");
    $("sb-storage-decline-btn").className = "sb-chip" + (storageChoice === "decline" ? " sb-chip-selected" : "");
    $("sb-storage-keep-btn").setAttribute("aria-pressed", storageChoice === "keep" ? "true" : "false");
    $("sb-storage-decline-btn").setAttribute("aria-pressed", storageChoice === "decline" ? "true" : "false");
    $("sb-storage-decline-note").hidden = storageChoice !== "decline";
    $("sb-storage-decline-note").textContent = SB_COPY.storage.declineNote;
    $("sb-storage-whats-kept-toggle").textContent = SB_COPY.storage.whatsKeptToggle;
    $("sb-storage-whats-kept-text").textContent = SB_STORAGE_WHAT_IS_KEPT;
    $("sb-storage-continue-btn").textContent = SB_COPY.storage.continue;
    $("sb-storage-continue-btn").disabled = !storageChoice;
  }

  $("sb-storage-keep-btn").addEventListener("click", function () { storageChoice = "keep"; renderStorage(); });
  $("sb-storage-decline-btn").addEventListener("click", function () { storageChoice = "decline"; renderStorage(); });
  $("sb-storage-whats-kept-toggle").addEventListener("click", function () {
    var el = $("sb-storage-whats-kept-text");
    el.hidden = !el.hidden;
  });
  $("sb-storage-continue-btn").addEventListener("click", function () {
    if (!storageChoice) return;
    if (storageChoice === "keep") {
      storageConsent = true;
      state.createdAt = new Date().toISOString();
      try { localStorage.removeItem(SB_DECLINED_KEY); } catch (e) {}
    } else {
      storageConsent = false;
      try { localStorage.setItem(SB_DECLINED_KEY, "1"); } catch (e) {}
    }
    mode = "practice";
    practiceScreen = "home";
    activeStepId = state.firstStepId;
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * PRACTICE MODE -- HOME
   * ------------------------------------------------------------------- */

  function renderPracticeHome() {
    $("sb-practice-home-heading").textContent = SB_COPY.practiceHome.heading;
    $("sb-practice-going-btn").textContent = SB_COPY.practiceHome.goingToTry;
    $("sb-practice-did-btn").textContent = SB_COPY.practiceHome.alreadyDid;
    $("sb-practice-stack-heading").textContent = SB_COPY.practiceHome.stackHeading;
    $("sb-practice-record-link").textContent = SB_COPY.practiceHome.recordLink;

    if (!activeStepId || !situationById(activeStepId)) {
      var order = orderedSituations();
      activeStepId = state.firstStepId && situationById(state.firstStepId) ? state.firstStepId : (order[order.length - 1] ? order[order.length - 1].id : null);
    }
    var current = situationById(activeStepId);
    var card = $("sb-practice-current-step");
    card.innerHTML = "";
    if (current) {
      var text = document.createElement("p");
      text.className = "sb-current-step-text";
      text.textContent = current.text;
      var meta = document.createElement("p");
      meta.className = "sb-current-step-meta";
      meta.textContent = "Rated " + current.difficulty + "/100" + (current.attempts.length ? " · " + current.attempts.length + (current.attempts.length === 1 ? " attempt" : " attempts") : "");
      card.appendChild(text);
      card.appendChild(meta);
      if (moveNote) {
        var note = document.createElement("p");
        note.className = "sb-helper-outro";
        note.textContent = moveNote;
        card.appendChild(note);
        moveNote = null;
      }
    }
    $("sb-practice-going-btn").hidden = !current;
    $("sb-practice-did-btn").hidden = !current;

    var list = $("sb-practice-stack-list");
    list.innerHTML = "";
    orderedSituations().forEach(function (s) {
      var row = buildStackRowEl(s, {
        selected: s.id === activeStepId,
        onRowClick: function (sit) { activeStepId = sit.id; renderPracticeHome(); }
      });
      list.appendChild(row);
    });
  }

  $("sb-practice-going-btn").addEventListener("click", function () {
    practiceScreen = "before";
    renderAll();
  });
  $("sb-practice-did-btn").addEventListener("click", function () {
    afterOutcome = null; afterBarrier = null; afterComparison = null;
    pendingTimerSeconds = null;
    practiceScreen = "after";
    renderAll();
  });
  $("sb-practice-record-link").addEventListener("click", function () {
    practiceScreen = "record";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * BEFORE A PRACTICE ATTEMPT
   * ------------------------------------------------------------------- */

  function renderBefore() {
    var s = situationById(activeStepId);
    if (!s) { practiceScreen = "home"; renderAll(); return; }

    $("sb-before-heading").textContent = SB_COPY.before.heading;
    $("sb-before-situation-text").textContent = s.text;
    $("sb-before-expect-label").textContent = SB_COPY.before.expectLabel;
    $("sb-before-expect-helper").textContent = SB_COPY.before.expectHelper;
    $("sb-before-expect").setAttribute("placeholder", SB_COPY.before.expectPlaceholder);
    $("sb-before-sure-label").textContent = SB_COPY.before.sureLabel;
    $("sb-before-difficulty-label").textContent = SB_COPY.before.difficultyLabel;
    $("sb-before-reminder1").textContent = SB_COPY.before.reminder1;
    $("sb-before-reminder2").textContent = SB_COPY.before.reminder2;
    $("sb-before-go-btn").textContent = SB_COPY.before.goAction;

    if (!$("sb-before-expect").value) $("sb-before-expect").value = "";
    var sure = $("sb-before-sure");
    sure.value = sure.dataset.touched ? sure.value : 50;
    $("sb-before-sure-readout").textContent = SB_COPY.before.sureTemplate.replace("{n}", sure.value);
    var diff = $("sb-before-difficulty");
    if (!diff.dataset.touched) diff.value = s.difficulty;
    $("sb-before-difficulty-readout").textContent = diff.value + " — " + sbNearestAnchorLabel(parseInt(diff.value, 10), SB_DIFFICULTY_ANCHORS);

    $("sb-before-timer-btn").textContent = timerRunning ? SB_COPY.before.timerStop : SB_COPY.before.timerStart;
    $("sb-before-timer-readout").hidden = !timerRunning && !timerSeconds;
    $("sb-before-timer-readout").textContent = formatDuration(timerSeconds);
  }

  $("sb-before-sure").addEventListener("input", function () {
    this.dataset.touched = "1";
    $("sb-before-sure-readout").textContent = SB_COPY.before.sureTemplate.replace("{n}", this.value);
  });
  $("sb-before-difficulty").addEventListener("input", function () {
    this.dataset.touched = "1";
    $("sb-before-difficulty-readout").textContent = this.value + " — " + sbNearestAnchorLabel(parseInt(this.value, 10), SB_DIFFICULTY_ANCHORS);
  });
  $("sb-before-timer-btn").addEventListener("click", function () {
    if (timerRunning) {
      clearInterval(timerInterval);
      timerRunning = false;
      pendingTimerSeconds = timerSeconds;
    } else {
      timerSeconds = 0;
      timerRunning = true;
      var start = Date.now();
      timerInterval = setInterval(function () {
        timerSeconds = Math.floor((Date.now() - start) / 1000);
        $("sb-before-timer-readout").hidden = false;
        $("sb-before-timer-readout").textContent = formatDuration(timerSeconds);
      }, 1000);
    }
    renderBefore();
  });
  $("sb-before-go-btn").addEventListener("click", function () {
    var s = situationById(activeStepId);
    if (!s) return;
    pendingBefore = {
      expected: $("sb-before-expect").value,
      sureness: parseInt($("sb-before-sure").value, 10),
      difficultyBefore: parseInt($("sb-before-difficulty").value, 10)
    };
    $("sb-before-sure").dataset.touched = "";
    $("sb-before-difficulty").dataset.touched = "";
    afterOutcome = null; afterBarrier = null; afterComparison = null;
    practiceScreen = "after";
    renderAll();
  });

  var pendingBefore = null;

  /* ---------------------------------------------------------------------
   * AFTER A PRACTICE ATTEMPT
   * ------------------------------------------------------------------- */

  function renderAfter() {
    var s = situationById(activeStepId);
    if (!s) { practiceScreen = "home"; renderAll(); return; }

    $("sb-after-heading").textContent = SB_COPY.after.heading;
    $("sb-after-situation-text").textContent = s.text;
    $("sb-after-didit-label").textContent = SB_COPY.after.didItLabel;

    var diditRow = $("sb-after-didit-options");
    diditRow.innerHTML = "";
    SB_OUTCOME_OPTIONS.forEach(function (o) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sb-chip" + (afterOutcome === o.id ? " sb-chip-selected" : "");
      chip.textContent = o.label;
      chip.setAttribute("aria-pressed", afterOutcome === o.id ? "true" : "false");
      chip.addEventListener("click", function () { afterOutcome = o.id; renderAfter(); });
      diditRow.appendChild(chip);
    });

    var went = afterOutcome === "yes" || afterOutcome === "partly" || afterOutcome === "left";
    var didntGo = afterOutcome === "no";
    $("sb-after-yes-branch").hidden = !went;
    $("sb-after-no-branch").hidden = !didntGo;
    $("sb-after-submit-btn").hidden = !afterOutcome;
    $("sb-after-submit-btn").textContent = SB_COPY.after.submit;

    if (went) {
      $("sb-after-duration-label").textContent = SB_COPY.after.durationLabel;
      if (pendingTimerSeconds !== null && !$("sb-after-duration").dataset.touched) {
        $("sb-after-duration").value = formatDuration(pendingTimerSeconds);
      }
      $("sb-after-duration").setAttribute("placeholder", SB_COPY.after.durationPlaceholder);
      $("sb-after-what-label").textContent = SB_COPY.after.whatHappenedLabel;
      $("sb-after-what").setAttribute("placeholder", SB_COPY.after.whatHappenedPlaceholder);
      $("sb-after-comparison-label").textContent = SB_COPY.after.comparisonLabel;

      var compRow = $("sb-after-comparison-options");
      compRow.innerHTML = "";
      SB_COMPARISON_OPTIONS.forEach(function (o) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sb-chip" + (afterComparison === o.id ? " sb-chip-selected" : "");
        chip.textContent = o.label;
        chip.setAttribute("aria-pressed", afterComparison === o.id ? "true" : "false");
        chip.addEventListener("click", function () { afterComparison = o.id; renderAfter(); });
        compRow.appendChild(chip);
      });

      $("sb-after-surprise-label").textContent = SB_COPY.after.surpriseLabel;
      $("sb-after-during-label").textContent = SB_COPY.after.difficultyDuringLabel;
      $("sb-after-now-label").textContent = SB_COPY.after.difficultyNowLabel;
      if (!$("sb-after-now").dataset.touched) $("sb-after-now").value = s.difficulty;
      $("sb-after-now-readout").textContent = $("sb-after-now").value;
      $("sb-after-surprise-readout").textContent = $("sb-after-surprise").value;
      $("sb-after-during-readout").textContent = $("sb-after-during").value;

      $("sb-after-easier-toggle").textContent = SB_COPY.after.easierToggle;
      $("sb-after-easier-helper").textContent = SB_COPY.after.easierHelper;
      $("sb-after-easier").setAttribute("placeholder", SB_COPY.after.easierPlaceholder);
    }

    if (didntGo) {
      $("sb-after-barrier-label").textContent = SB_COPY.after.barrierLabel;
      var barrierRow = $("sb-after-barrier-options");
      barrierRow.innerHTML = "";
      SB_BARRIER_OPTIONS.forEach(function (o) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sb-chip" + (afterBarrier === o.id ? " sb-chip-selected" : "");
        chip.textContent = o.label;
        chip.setAttribute("aria-pressed", afterBarrier === o.id ? "true" : "false");
        chip.addEventListener("click", function () { afterBarrier = o.id; renderAfter(); });
        barrierRow.appendChild(chip);
      });

      var tooHard = afterBarrier === "too_hard";
      var timeRelated = afterBarrier === "ran_out_of_time" || afterBarrier === "didnt_come_up";
      var other = afterBarrier === "changed_mind" || afterBarrier === "something_else";

      $("sb-after-followup-text").hidden = !(tooHard || timeRelated);
      $("sb-after-followup-text").textContent = tooHard ? SB_COPY.after.tooHardFollowup : (timeRelated ? SB_COPY.after.timePlanFollowup : "");
      $("sb-after-followup-action-wrap").hidden = !tooHard;
      $("sb-after-followup-btn").textContent = SB_COPY.after.tooHardAction;
      $("sb-after-plan-wrap").hidden = !timeRelated;
      $("sb-after-plan").setAttribute("placeholder", SB_COPY.after.planPlaceholder);
      $("sb-after-no-notes-wrap").hidden = !other;
      $("sb-after-no-notes").setAttribute("placeholder", SB_COPY.after.noNotesPlaceholder);
    }
  }

  ["sb-after-surprise", "sb-after-during", "sb-after-now", "sb-after-duration"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      this.dataset.touched = "1";
      var readout = $(id + "-readout");
      if (readout) readout.textContent = this.value;
    });
  });

  $("sb-after-easier-toggle").addEventListener("click", function () {
    $("sb-after-easier-wrap").hidden = !$("sb-after-easier-wrap").hidden;
  });

  $("sb-after-followup-btn").addEventListener("click", function () {
    submitAfterLog();
    bridgeSourceId = activeStepId;
    bridgeReturnTo = { mode: "practice", screen: "home" };
    bridgePending = []; bridgeShowStillBig = false; bridgeAddedIds = [];
    mode = "build";
    buildScreen = "bridge";
    renderAll();
  });

  function buildAttemptFromForm() {
    var s = situationById(activeStepId);
    if (!s || !afterOutcome) return null;
    var attempt = {
      id: uid("a"),
      date: new Date().toISOString(),
      before: pendingBefore || null,
      outcome: afterOutcome
    };
    if (afterOutcome === "yes" || afterOutcome === "partly" || afterOutcome === "left") {
      attempt.duration = $("sb-after-duration").value || null;
      attempt.whatHappened = $("sb-after-what").value;
      attempt.comparison = afterComparison;
      attempt.surprise = parseInt($("sb-after-surprise").value, 10);
      attempt.difficultyDuring = parseInt($("sb-after-during").value, 10);
      attempt.difficultyAfter = parseInt($("sb-after-now").value, 10);
      attempt.easierTricks = $("sb-after-easier").value;
    } else {
      attempt.barrier = afterBarrier;
      if (afterBarrier === "ran_out_of_time" || afterBarrier === "didnt_come_up") attempt.plan = $("sb-after-plan").value;
      if (afterBarrier === "changed_mind" || afterBarrier === "something_else") attempt.notes = $("sb-after-no-notes").value;
    }
    return attempt;
  }

  function submitAfterLog() {
    var s = situationById(activeStepId);
    var attempt = buildAttemptFromForm();
    if (!s || !attempt) return;
    s.attempts.push(attempt);
    if (typeof attempt.difficultyAfter === "number") {
      var oldOrder = orderedSituations().map(function (x) { return x.id; });
      var oldIdx = oldOrder.indexOf(s.id);
      unpinAndRerate(s, attempt.difficultyAfter);
      var newOrder = orderedSituations().map(function (x) { return x.id; });
      var newIdx = newOrder.indexOf(s.id);
      if (newIdx < oldIdx) moveNote = "This moved up your plan — rated harder now than it was.";
      else if (newIdx > oldIdx) moveNote = "This moved down your plan — rated easier now than it was.";
      else moveNote = null;
    }
    pendingBefore = null;
    timerSeconds = 0; pendingTimerSeconds = null;
    ["sb-after-duration", "sb-after-surprise", "sb-after-during", "sb-after-now"].forEach(function (id) {
      $(id).dataset.touched = "";
    });
    $("sb-after-what").value = "";
    $("sb-after-easier").value = "";
    $("sb-after-plan").value = "";
    $("sb-after-no-notes").value = "";
    $("sb-before-expect").value = "";
  }

  $("sb-after-submit-btn").addEventListener("click", function () {
    if (!afterOutcome) return;
    submitAfterLog();
    practiceScreen = "home";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * THE RECORD
   * ------------------------------------------------------------------- */

  function allAttempts() {
    var out = [];
    state.situations.forEach(function (s) {
      s.attempts.forEach(function (a) { out.push({ situation: s, attempt: a }); });
    });
    out.sort(function (a, b) { return new Date(a.attempt.date) - new Date(b.attempt.date); });
    return out;
  }

  function renderRecord() {
    $("sb-record-heading").textContent = SB_COPY.record.heading;
    $("sb-record-save-copy-btn").textContent = SB_COPY.record.saveCopy;
    $("sb-record-back-btn").textContent = SB_COPY.record.backToPractice;

    var attempts = allAttempts();
    $("sb-record-empty").hidden = attempts.length > 0;
    $("sb-record-empty").textContent = SB_COPY.record.emptyMessage;
    $("sb-record-body").hidden = attempts.length === 0;

    if (!attempts.length) { $("sb-record-attempts-count").textContent = ""; return; }

    var stepsWithAttempts = state.situations.filter(function (s) { return s.attempts.length > 0; }).length;
    $("sb-record-attempts-count").textContent = attempts.length === 1
      ? SB_COPY.record.attemptsCountTemplateOne
      : SB_COPY.record.attemptsCountTemplate.replace("{n}", attempts.length).replace("{steps}", stepsWithAttempts);

    $("sb-record-expected-heading").textContent = SB_COPY.record.expectedVsActualHeading;
    $("sb-record-expected-note").textContent = SB_COPY.record.expectedVsActualNote;
    var eaWrap = $("sb-record-expected-actual");
    eaWrap.innerHTML = "";
    attempts.filter(function (x) { return typeof x.attempt.surprise === "number"; }).forEach(function (x) {
      var row = document.createElement("div");
      row.className = "sb-expected-actual-row";
      var label = document.createElement("span");
      label.className = "sb-expected-actual-label";
      label.textContent = formatDateRelative(x.attempt.date) + " — " + x.situation.text;
      var comparison = document.createElement("span");
      comparison.className = "sb-expected-actual-value";
      var compLabel = (SB_COMPARISON_OPTIONS.filter(function (c) { return c.id === x.attempt.comparison; })[0] || {}).label || "";
      comparison.textContent = compLabel;
      var surprise = document.createElement("span");
      surprise.className = "sb-expected-actual-value";
      surprise.textContent = "surprise " + x.attempt.surprise + "/100";
      row.appendChild(label);
      row.appendChild(comparison);
      row.appendChild(surprise);
      eaWrap.appendChild(row);
    });

    $("sb-record-perstep-heading").textContent = SB_COPY.record.perStepHeading;
    $("sb-record-reorder-note").textContent = SB_COPY.record.reorderNote;
    var perStep = $("sb-record-per-step");
    perStep.innerHTML = "";
    orderedSituations().forEach(function (s) {
      var card = document.createElement("div");
      card.className = "sb-step-history";
      var head = document.createElement("div");
      head.className = "sb-step-history-head";
      var title = document.createElement("span");
      title.className = "sb-step-history-title";
      title.textContent = s.text;
      var rating = document.createElement("span");
      rating.className = "sb-step-history-rating";
      rating.textContent = "now rated " + s.difficulty + "/100";
      head.appendChild(title);
      head.appendChild(rating);
      card.appendChild(head);

      var list = document.createElement("ul");
      list.className = "sb-step-history-list";
      if (!s.attempts.length) {
        var li = document.createElement("li");
        li.textContent = SB_COPY.record.stepHistoryEmpty;
        list.appendChild(li);
      } else {
        s.attempts.forEach(function (a) {
          var item = document.createElement("li");
          var bits = [formatDateRelative(a.date)];
          var outcomeLabel = (SB_OUTCOME_OPTIONS.filter(function (o) { return o.id === a.outcome; })[0] || {}).label || a.outcome;
          bits.push(outcomeLabel);
          if (a.duration) bits.push(a.duration);
          if (typeof a.difficultyAfter === "number") bits.push("felt " + a.difficultyAfter + "/100");
          item.textContent = bits.join(" — ");
          list.appendChild(item);
        });
      }
      card.appendChild(list);
      perStep.appendChild(card);
    });
  }

  $("sb-record-back-btn").addEventListener("click", function () { practiceScreen = "home"; renderAll(); });
  $("sb-record-save-copy-btn").addEventListener("click", function () { window.print(); });

  /* ---------------------------------------------------------------------
   * PRINT SHEET
   * ------------------------------------------------------------------- */

  function updatePrintSheet() {
    $("sb-print-title").textContent = SB_COPY.print.title;
    $("sb-print-goal-heading").textContent = SB_COPY.print.goalHeading;
    $("sb-print-goal").textContent = state.goalText + (state.goalWhy ? " — " + state.goalWhy : "");
    $("sb-print-stack-heading").textContent = SB_COPY.print.stackHeading;
    $("sb-print-record-heading").textContent = SB_COPY.print.recordHeading;
    $("sb-print-questions-heading").textContent = SB_COPY.print.questionsHeading;
    $("sb-print-disclaimer").textContent = SB_STANDING_DISCLAIMER;
    $("sb-print-crisis").textContent = SB_CRISIS_LINE;

    var stackWrap = $("sb-print-stack");
    stackWrap.innerHTML = "";
    var ol = document.createElement("ol");
    orderedSituations().forEach(function (s) {
      var li = document.createElement("li");
      var line = s.text + " — difficulty " + s.difficulty + "/100, matters " + s.importance + "/100" + (s.id === state.firstStepId ? " (first step)" : "");
      li.textContent = line;
      if (s.fearedOutcome) {
        var fear = document.createElement("div");
        fear.textContent = "Afraid that: " + s.fearedOutcome;
        fear.style.fontStyle = "italic";
        li.appendChild(fear);
      }
      ol.appendChild(li);
    });
    stackWrap.appendChild(ol);

    var recordWrap = $("sb-print-record");
    recordWrap.innerHTML = "";
    var attempts = allAttempts();
    if (!attempts.length) {
      var empty = document.createElement("p");
      empty.textContent = SB_COPY.record.emptyMessage;
      recordWrap.appendChild(empty);
    } else {
      attempts.forEach(function (x) {
        var p = document.createElement("p");
        var bits = [formatDateRelative(x.attempt.date), x.situation.text];
        var outcomeLabel = (SB_OUTCOME_OPTIONS.filter(function (o) { return o.id === x.attempt.outcome; })[0] || {}).label || x.attempt.outcome;
        bits.push(outcomeLabel);
        if (x.attempt.before && x.attempt.before.expected) bits.push("expected: " + x.attempt.before.expected);
        if (x.attempt.whatHappened) bits.push("happened: " + x.attempt.whatHappened);
        if (typeof x.attempt.difficultyAfter === "number") bits.push("felt " + x.attempt.difficultyAfter + "/100 after");
        p.textContent = bits.join(" — ");
        recordWrap.appendChild(p);
      });
    }

    var qList = $("sb-print-questions");
    qList.innerHTML = "";
    SB_COPY.print.questions.forEach(function (q) {
      var li = document.createElement("li");
      li.textContent = q;
      qList.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  var saved = loadState();
  if (saved) {
    state = saved;
    if (!state.stackOrder) state.stackOrder = state.situations.map(function (s) { return s.id; });
    storageConsent = true;
    mode = "practice";
    practiceScreen = "home";
    activeStepId = state.firstStepId;
  } else {
    state = defaultState();
    storageConsent = false;
    mode = "build";
    buildScreen = "opening";
    try { openingShowsDeclinedNote = localStorage.getItem(SB_DECLINED_KEY) === "1"; } catch (e) { openingShowsDeclinedNote = false; }
  }

  renderAll();
})();
