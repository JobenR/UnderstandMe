(function () {
  "use strict";

  if (typeof WB_COPY === "undefined") return;

  /* ---------------------------------------------------------------------
   * STATE
   * ------------------------------------------------------------------- */

  var WB_STORAGE_KEY = "wb_plan_v1";
  var WB_DECLINED_KEY = "wb_declined_once";

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultState() {
    return {
      noticingEntries: [],
      menu: [],
      entries: [],
      createdAt: null,
      updatedAt: null
    };
  }

  var state = defaultState();
  var storageConsent = false;
  var mode = "build"; // "build" | "ongoing"
  var buildScreen = "noticing-intro";
  var ongoingScreen = "current-week";
  var openingShowsDeclinedNote = false;
  var storageOfferShown = false;
  var storageChoice = null;

  // Transient, never persisted
  var planningWeekStart = null;
  var selectedMenuItemForPlacement = null;
  var softCapShown = false;
  var specificityNoticeFor = null;
  var activeLogEntryId = null;
  var activeLogUnplanned = false;
  var logDidIt = null;
  var logBarrier = null;
  var logReturnAfterSmaller = null; // menu item id to pre-select on return
  var pendingUnplannedText = "";

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function mondayOf(d) {
    var date = new Date(d);
    var day = date.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  function isoDate(d) {
    var date = new Date(d);
    var y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), day = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function currentWeekMonday() { return isoDate(mondayOf(new Date())); }
  function addDays(isoStr, n) {
    var d = new Date(isoStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return isoDate(d);
  }
  function dayOffset(dayId) { return WB_DAYS.map(function (d) { return d.id; }).indexOf(dayId); }
  function dateForDay(weekStart, dayId) { return addDays(weekStart, dayOffset(dayId)); }
  function todayDayId() {
    var idx = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun
    return WB_DAYS[idx].id;
  }

  function formatDateRelative(iso) {
    if (!iso) return "";
    var then = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
    var now = new Date();
    var days = Math.floor((startOfDay(now) - startOfDay(then)) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days > 1 && days < 7) return days + " days ago";
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: then.getFullYear() === now.getFullYear() ? undefined : "numeric" });
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  function round1(n) { return Math.round(n * 10) / 10; }

  function menuItemById(id) { return state.menu.filter(function (m) { return m.id === id; })[0] || null; }
  function entryById(id) { return state.entries.filter(function (e) { return e.id === id; })[0] || null; }

  function announce(text) {
    var live = $("wb-live-region");
    if (live) live.textContent = text;
  }

  /* ---------------------------------------------------------------------
   * STORAGE -- opt-in, device-only. No notifications/reminders of any
   * kind are ever scheduled by this tool.
   * ------------------------------------------------------------------- */

  function saveState() {
    if (!storageConsent) return;
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(WB_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(WB_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function deleteEverything() {
    try { localStorage.removeItem(WB_STORAGE_KEY); } catch (e) {}
    storageConsent = false;
    state = defaultState();
    mode = "build";
    buildScreen = "noticing-intro";
    openingShowsDeclinedNote = false;
    storageOfferShown = false;
    renderAll();
  }
  $("wb-delete-btn").addEventListener("click", function () {
    if (window.confirm(WB_COPY.deleteControl.confirmTemplate)) deleteEverything();
  });

  /* ---------------------------------------------------------------------
   * TOP-LEVEL RENDER DISPATCH
   * ------------------------------------------------------------------- */

  var BUILD_SCREEN_IDS = {
    "noticing-intro": "wb-screen-noticing-intro", "noticing-log": "wb-screen-noticing-log",
    "menu-intro": "wb-screen-menu-intro", "menu-generate": "wb-screen-menu-generate",
    "menu-rate": "wb-screen-menu-rate", "week": "wb-screen-week", "storage": "wb-screen-storage"
  };
  var ONGOING_SCREEN_IDS = {
    "current-week": "wb-screen-current-week", "log": "wb-screen-log", "review": "wb-screen-review"
  };

  function renderAll() {
    $("wb-crisis-line").textContent = WB_CRISIS_LINE;
    $("wb-delete-btn").hidden = !storageConsent;
    $("wb-delete-btn").textContent = WB_COPY.deleteControl.label;

    $("wb-view-build").hidden = mode !== "build";
    $("wb-view-ongoing").hidden = mode !== "ongoing";
    if (mode === "build") renderBuildScreen(); else renderOngoingScreen();
    saveState();
  }

  function renderBuildScreen() {
    Object.keys(BUILD_SCREEN_IDS).forEach(function (k) { $(BUILD_SCREEN_IDS[k]).hidden = (k !== buildScreen); });
    if (buildScreen === "noticing-intro") renderNoticingIntro();
    else if (buildScreen === "noticing-log") renderNoticingLog();
    else if (buildScreen === "menu-intro") renderMenuIntro();
    else if (buildScreen === "menu-generate") renderMenuGenerate();
    else if (buildScreen === "menu-rate") renderMenuRate();
    else if (buildScreen === "week") renderWeekScreen();
    else if (buildScreen === "storage") renderStorage();
    announce(buildScreen + " screen");
  }

  function renderOngoingScreen() {
    Object.keys(ONGOING_SCREEN_IDS).forEach(function (k) { $(ONGOING_SCREEN_IDS[k]).hidden = (k !== ongoingScreen); });
    if (ongoingScreen === "current-week") renderCurrentWeek();
    else if (ongoingScreen === "log") renderLog();
    else if (ongoingScreen === "review") renderReview();
    announce(ongoingScreen + " screen");
  }

  /* ---------------------------------------------------------------------
   * PHASE 1a -- NOTICING INTRO
   * ------------------------------------------------------------------- */

  function renderNoticingIntro() {
    $("wb-noticing-intro-heading").textContent = WB_COPY.noticingIntro.heading;
    var body = $("wb-noticing-intro-body");
    body.innerHTML = "";
    WB_COPY.noticingIntro.body.forEach(function (p) {
      var el = document.createElement("p");
      el.textContent = p;
      body.appendChild(el);
    });
    $("wb-noticing-declined-note").hidden = !openingShowsDeclinedNote;
    $("wb-noticing-declined-note").textContent = WB_COPY.noticingIntro.declinedNote;
    $("wb-noticing-intro-disclaimer").textContent = WB_STANDING_DISCLAIMER;
    $("wb-noticing-start-btn").textContent = WB_COPY.noticingIntro.noticeAction;
    $("wb-noticing-skip-btn").textContent = WB_COPY.noticingIntro.skipAction;
  }
  $("wb-noticing-start-btn").addEventListener("click", function () { buildScreen = "noticing-log"; renderAll(); });
  $("wb-noticing-skip-btn").addEventListener("click", function () { buildScreen = "menu-intro"; renderAll(); });

  /* ---------------------------------------------------------------------
   * PHASE 1b -- NOTICING LOG
   * ------------------------------------------------------------------- */

  function renderNoticingLog() {
    $("wb-noticing-log-heading").textContent = WB_COPY.noticingLog.heading;
    $("wb-noticing-what-label").textContent = WB_COPY.noticingLog.whatLabel;
    $("wb-noticing-what").setAttribute("placeholder", WB_COPY.noticingLog.whatPlaceholder);
    $("wb-noticing-mood-label").textContent = WB_COPY.noticingLog.moodLabel;
    $("wb-noticing-enjoy-toggle").textContent = WB_COPY.noticingLog.enjoymentToggle;
    $("wb-noticing-accomplish-toggle").textContent = WB_COPY.noticingLog.accomplishmentToggle;
    $("wb-noticing-add-btn").textContent = WB_COPY.noticingLog.addEntry;
    $("wb-noticing-continue-btn").textContent = "Continue to planning";

    var scale = $("wb-noticing-mood-scale");
    scale.innerHTML = "";
    WB_MOOD_ANCHORS_NOTICING.forEach(function (a) {
      var span = document.createElement("span");
      span.textContent = a.value + " " + a.label;
      scale.appendChild(span);
    });
    $("wb-noticing-mood-readout").textContent = $("wb-noticing-mood").value;
    $("wb-noticing-enjoy-readout").textContent = $("wb-noticing-enjoy").value;
    $("wb-noticing-accomplish-readout").textContent = $("wb-noticing-accomplish").value;

    var n = state.noticingEntries.length;
    $("wb-noticing-count").textContent = WB_COPY.noticingLog.entriesLogged.replace("{n}", n);

    var list = $("wb-noticing-list");
    list.innerHTML = "";
    state.noticingEntries.slice().reverse().forEach(function (e) {
      var li = document.createElement("li");
      var text = document.createElement("span");
      text.textContent = formatDateRelative(e.date) + " — " + e.what;
      var mood = document.createElement("span");
      mood.className = "wb-noticing-mood";
      mood.textContent = e.mood + "/10";
      li.appendChild(text);
      li.appendChild(mood);
      list.appendChild(li);
    });

    var distinctDays = {};
    state.noticingEntries.forEach(function (e) { distinctDays[e.date.slice(0, 10)] = true; });
    var readyToPlan = Object.keys(distinctDays).length >= 2;
    $("wb-noticing-ready-wrap").hidden = !readyToPlan;
    $("wb-noticing-ready-text").textContent = WB_COPY.noticingLog.readyPrompt;
    $("wb-noticing-ready-btn").textContent = WB_COPY.noticingLog.readyAction;
  }

  $("wb-noticing-enjoy-toggle").addEventListener("click", function () { $("wb-noticing-enjoy-wrap").hidden = !$("wb-noticing-enjoy-wrap").hidden; });
  $("wb-noticing-accomplish-toggle").addEventListener("click", function () { $("wb-noticing-accomplish-wrap").hidden = !$("wb-noticing-accomplish-wrap").hidden; });
  ["wb-noticing-mood", "wb-noticing-enjoy", "wb-noticing-accomplish"].forEach(function (id) {
    $(id).addEventListener("input", function () { $(id + "-readout").textContent = this.value; });
  });
  $("wb-noticing-add-btn").addEventListener("click", function () {
    var what = $("wb-noticing-what").value.trim();
    if (!what) { $("wb-noticing-what").focus(); return; }
    state.noticingEntries.push({
      id: uid("n"),
      date: new Date().toISOString(),
      what: what,
      mood: parseInt($("wb-noticing-mood").value, 10),
      enjoyment: $("wb-noticing-enjoy-wrap").hidden ? null : parseInt($("wb-noticing-enjoy").value, 10),
      accomplishment: $("wb-noticing-accomplish-wrap").hidden ? null : parseInt($("wb-noticing-accomplish").value, 10)
    });
    $("wb-noticing-what").value = "";
    $("wb-noticing-mood").value = 5;
    $("wb-noticing-enjoy").value = 5;
    $("wb-noticing-accomplish").value = 5;
    $("wb-noticing-enjoy-wrap").hidden = true;
    $("wb-noticing-accomplish-wrap").hidden = true;
    renderAll();
  });
  $("wb-noticing-ready-btn").addEventListener("click", function () { buildScreen = "menu-intro"; renderAll(); });
  $("wb-noticing-continue-btn").addEventListener("click", function () { buildScreen = "menu-intro"; renderAll(); });

  /* ---------------------------------------------------------------------
   * PHASE 2a -- MENU INTRO
   * ------------------------------------------------------------------- */

  function renderMenuIntro() {
    $("wb-menu-intro-heading").textContent = WB_COPY.menuIntro.heading;
    var body = $("wb-menu-intro-body");
    body.innerHTML = "";
    WB_COPY.menuIntro.body.forEach(function (p) {
      var el = document.createElement("p");
      el.textContent = p;
      body.appendChild(el);
    });
    $("wb-menu-intro-disclaimer").textContent = WB_STANDING_DISCLAIMER;
    $("wb-menu-intro-continue-btn").textContent = WB_COPY.menuGenerate.continue;
  }
  $("wb-menu-intro-continue-btn").addEventListener("click", function () { buildScreen = "menu-generate"; renderAll(); });

  /* ---------------------------------------------------------------------
   * PHASE 2b -- MENU GENERATE
   * ------------------------------------------------------------------- */

  function addMenuItem(category, text) {
    text = text.trim();
    if (!text) return;
    state.menu.push({ id: uid("m"), category: category, text: text, expectedEnjoy: 5, expectedHard: 5 });
    renderMenuGenerate();
  }

  function renderMenuGenerate() {
    $("wb-menu-generate-heading").textContent = WB_COPY.menuGenerate.heading;
    $("wb-menu-generate-continue-btn").textContent = WB_COPY.menuGenerate.continue;

    var n = state.menu.length;
    $("wb-menu-generate-count").textContent = n === 1 ? WB_COPY.menuGenerate.countTemplateOne : WB_COPY.menuGenerate.countTemplate.replace("{n}", n);
    $("wb-menu-generate-encourage").hidden = !(n >= WB_MENU_ENCOURAGE_AT && n < WB_MENU_ENCOURAGE_AT + 4);
    $("wb-menu-generate-encourage").textContent = WB_COPY.menuGenerate.encourage;
    $("wb-menu-generate-min-notice").hidden = n >= 1;
    $("wb-menu-generate-min-notice").textContent = WB_COPY.menuGenerate.minNotice;
    $("wb-menu-generate-continue-btn").disabled = n < 1;

    var wrap = $("wb-menu-categories");
    wrap.innerHTML = "";
    WB_MENU_CATEGORIES.forEach(function (cat) {
      var section = document.createElement("div");
      section.className = "wb-menu-category";

      var label = document.createElement("p");
      label.className = "wb-menu-category-label";
      label.textContent = cat.label;
      section.appendChild(label);

      var prompt = document.createElement("p");
      prompt.className = "wb-menu-category-prompt";
      prompt.textContent = cat.prompt;
      section.appendChild(prompt);

      var chipRow = document.createElement("div");
      chipRow.className = "wb-chip-row";
      cat.examples.forEach(function (ex) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "wb-chip";
        chip.textContent = ex;
        chip.addEventListener("click", function () { addMenuItem(cat.id, ex); });
        chipRow.appendChild(chip);
      });
      section.appendChild(chipRow);

      var entryRow = document.createElement("div");
      entryRow.className = "wb-entry-row";
      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = 140;
      input.setAttribute("placeholder", WB_COPY.menuGenerate.entryPlaceholder);
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-outline btn-sm";
      addBtn.textContent = WB_COPY.menuGenerate.addLabel;
      addBtn.addEventListener("click", function () { addMenuItem(cat.id, input.value); input.value = ""; input.focus(); });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addBtn.click(); } });
      entryRow.appendChild(input);
      entryRow.appendChild(addBtn);
      section.appendChild(entryRow);

      var items = state.menu.filter(function (m) { return m.category === cat.id; });
      if (items.length) {
        var ul = document.createElement("ul");
        ul.className = "wb-menu-items";
        items.forEach(function (m) {
          var li = document.createElement("li");
          var text = document.createElement("span");
          text.textContent = m.text;
          var remove = document.createElement("button");
          remove.type = "button";
          remove.className = "wb-menu-item-remove";
          remove.innerHTML = "&times;";
          remove.setAttribute("aria-label", "Remove " + m.text);
          remove.addEventListener("click", function () {
            state.menu = state.menu.filter(function (x) { return x.id !== m.id; });
            renderMenuGenerate();
          });
          li.appendChild(text);
          li.appendChild(remove);
          ul.appendChild(li);
        });
        section.appendChild(ul);
      }

      wrap.appendChild(section);
    });
  }
  $("wb-menu-generate-continue-btn").addEventListener("click", function () {
    if (state.menu.length < 1) return;
    buildScreen = "menu-rate";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * PHASE 2c -- MENU RATE
   * ------------------------------------------------------------------- */

  function renderMenuRate() {
    $("wb-menu-rate-heading").textContent = WB_COPY.menuRate.heading;
    $("wb-menu-rate-note").textContent = WB_COPY.menuRate.note;
    $("wb-menu-rate-continue-btn").textContent = WB_COPY.menuRate.continue;

    var list = $("wb-menu-rate-list");
    list.innerHTML = "";
    state.menu.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "wb-rate-row";
      var text = document.createElement("p");
      text.className = "wb-rate-row-text";
      text.textContent = m.text;
      row.appendChild(text);

      var sliders = document.createElement("div");
      sliders.className = "wb-rate-row-sliders";
      sliders.appendChild(buildCompactSlider(WB_COPY.menuRate.enjoyLabel, m.expectedEnjoy, function (v) { m.expectedEnjoy = v; }));
      sliders.appendChild(buildCompactSlider(WB_COPY.menuRate.hardLabel, m.expectedHard, function (v) { m.expectedHard = v; }));
      row.appendChild(sliders);
      list.appendChild(row);
    });
  }

  function buildCompactSlider(labelText, value, onInput) {
    var wrap = document.createElement("div");
    var label = document.createElement("div");
    label.className = "wb-rate-row-slider-label";
    label.textContent = labelText;
    var slider = document.createElement("input");
    slider.type = "range"; slider.className = "wb-slider";
    slider.min = 0; slider.max = 10; slider.step = 1; slider.value = value;
    var readout = document.createElement("div");
    readout.className = "wb-slider-readout";
    readout.textContent = String(value);
    slider.addEventListener("input", function () { readout.textContent = this.value; onInput(parseInt(this.value, 10)); });
    wrap.appendChild(label);
    wrap.appendChild(slider);
    wrap.appendChild(readout);
    return wrap;
  }

  $("wb-menu-rate-continue-btn").addEventListener("click", function () {
    planningWeekStart = currentWeekMonday();
    softCapShown = false;
    specificityNoticeFor = null;
    selectedMenuItemForPlacement = null;
    buildScreen = "week";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * PHASE 3 -- THE WEEK
   * ------------------------------------------------------------------- */

  function placementsForWeek(weekStart) {
    return state.entries.filter(function (e) { return e.kind === "planned" && e.weekStart === weekStart; });
  }

  function isGenericText(text) {
    return text.trim().split(/\s+/).filter(Boolean).length <= 2;
  }

  function renderWeekScreen() {
    $("wb-week-heading").textContent = WB_COPY.week.heading;
    $("wb-week-default-guidance").textContent = WB_COPY.week.defaultGuidance;
    $("wb-week-continue-btn").textContent = WB_COPY.week.continue;
    $("wb-week-menu-heading").textContent = WB_COPY.week.menuHeading;

    var thisWeekPlacements = placementsForWeek(planningWeekStart);
    $("wb-week-softcap-notice").hidden = !(thisWeekPlacements.length >= WB_WEEK_SOFT_CAP);
    $("wb-week-softcap-notice").textContent = WB_COPY.week.softCapNotice;
    $("wb-week-specificity-notice").hidden = !specificityNoticeFor;
    $("wb-week-specificity-notice").textContent = WB_COPY.week.specificityNotice;

    if (selectedMenuItemForPlacement) {
      var item = menuItemById(selectedMenuItemForPlacement);
      $("wb-week-select-hint").textContent = item ? WB_COPY.week.selectedLabel.replace("{text}", item.text) + " — " + WB_COPY.week.cancelSelect : WB_COPY.week.selectHint;
    } else {
      $("wb-week-select-hint").textContent = WB_COPY.week.selectHint;
    }

    renderWeekGrid($("wb-week-grid"), planningWeekStart, true);

    var menuList = $("wb-week-menu-list");
    menuList.innerHTML = "";
    state.menu.forEach(function (m) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "wb-chip" + (selectedMenuItemForPlacement === m.id ? " wb-chip-selected" : "");
      chip.textContent = m.text;
      if (menuItemWentBetterThanExpected(m)) {
        var mark = document.createElement("div");
        mark.style.fontWeight = "400";
        mark.style.fontSize = "0.78rem";
        mark.style.marginTop = "2px";
        mark.textContent = WB_COPY.week.wentBetterThanExpected;
        chip.appendChild(mark);
      }
      chip.addEventListener("click", function () {
        selectedMenuItemForPlacement = selectedMenuItemForPlacement === m.id ? null : m.id;
        renderWeekScreen();
      });
      menuList.appendChild(chip);
    });
  }

  function menuItemWentBetterThanExpected(m) {
    var past = state.entries.filter(function (e) {
      return e.menuItemId === m.id && e.log && typeof e.log.enjoyment === "number" && (e.log.completion === "yes" || e.log.completion === "partly");
    });
    if (!past.length) return false;
    var avgActual = past.reduce(function (s, e) { return s + e.log.enjoyment; }, 0) / past.length;
    return avgActual > m.expectedEnjoy + 1;
  }

  function renderWeekGrid(gridEl, weekStart, editable) {
    gridEl.innerHTML = "";
    var corner = document.createElement("div");
    corner.className = "wb-week-grid-corner";
    gridEl.appendChild(corner);
    WB_DAYS.forEach(function (d) {
      var label = document.createElement("div");
      label.className = "wb-week-day-label" + (editable === "current" && d.id === todayDayId() ? " wb-today" : "");
      label.textContent = d.label.slice(0, 3);
      gridEl.appendChild(label);
    });
    WB_BLOCKS.forEach(function (block) {
      var blockLabel = document.createElement("div");
      blockLabel.className = "wb-week-block-label";
      blockLabel.textContent = block.label;
      gridEl.appendChild(blockLabel);
      WB_DAYS.forEach(function (d) {
        var cell = document.createElement("div");
        cell.className = "wb-week-cell";
        var placed = state.entries.filter(function (e) {
          return e.kind === "planned" && e.weekStart === weekStart && e.day === d.id && e.block === block.id;
        });
        if (placed.length) {
          placed.forEach(function (entry) {
            var pill = document.createElement("div");
            pill.className = "wb-week-cell-item" + (entry.log ? " wb-week-cell-logged" : "");
            pill.textContent = entry.text;
            if (editable === true) {
              pill.title = "Remove";
              pill.addEventListener("click", function (ev) {
                ev.stopPropagation();
                state.entries = state.entries.filter(function (x) { return x.id !== entry.id; });
                renderWeekScreen();
              });
            } else if (editable === "current") {
              pill.addEventListener("click", function (ev) {
                ev.stopPropagation();
                if (entry.log) return;
                activeLogEntryId = entry.id;
                activeLogUnplanned = false;
                logDidIt = null; logBarrier = null;
                mode = "ongoing"; ongoingScreen = "log";
                renderAll();
              });
            }
            cell.appendChild(pill);
          });
        } else {
          var empty = document.createElement("div");
          empty.className = "wb-week-cell-empty";
          empty.textContent = WB_COPY.week.emptySlot;
          cell.appendChild(empty);
        }
        if (editable === true) {
          cell.classList.toggle("wb-week-cell-selectable", !!selectedMenuItemForPlacement);
          cell.addEventListener("click", function () {
            if (!selectedMenuItemForPlacement) return;
            var item = menuItemById(selectedMenuItemForPlacement);
            if (!item) return;
            state.entries.push({
              id: uid("e"), kind: "planned", weekStart: weekStart, day: d.id, block: block.id,
              date: dateForDay(weekStart, d.id), menuItemId: item.id, text: item.text, note: "", log: null
            });
            specificityNoticeFor = isGenericText(item.text) ? item.id : null;
            selectedMenuItemForPlacement = null;
            renderWeekScreen();
          });
        } else if (editable === "current") {
          cell.addEventListener("click", function () {
            // Mid-week additions reuse the week-planning screen, per spec's
            // "you can always add more mid-week."
            planningWeekStart = weekStart;
            softCapShown = false;
            specificityNoticeFor = null;
            selectedMenuItemForPlacement = null;
            mode = "build"; buildScreen = "week";
            renderAll();
          });
        }
        gridEl.appendChild(cell);
      });
    });
  }

  $("wb-week-continue-btn").addEventListener("click", function () {
    if (storageOfferShown) {
      mode = "ongoing"; ongoingScreen = "current-week";
      renderAll();
    } else {
      buildScreen = "storage";
      renderAll();
    }
  });

  /* ---------------------------------------------------------------------
   * STORAGE OFFER
   * ------------------------------------------------------------------- */

  function renderStorage() {
    $("wb-storage-heading").textContent = WB_COPY.storage.heading;
    $("wb-storage-offer-text").textContent = WB_STORAGE_OFFER_TEXT;
    $("wb-storage-keep-btn").textContent = WB_COPY.storage.keepLabel;
    $("wb-storage-decline-btn").textContent = WB_COPY.storage.declineLabel;
    $("wb-storage-keep-btn").className = "wb-chip" + (storageChoice === "keep" ? " wb-chip-selected" : "");
    $("wb-storage-decline-btn").className = "wb-chip" + (storageChoice === "decline" ? " wb-chip-selected" : "");
    $("wb-storage-decline-note").hidden = storageChoice !== "decline";
    $("wb-storage-decline-note").textContent = WB_COPY.storage.declineNote;
    $("wb-storage-whats-kept-toggle").textContent = WB_COPY.storage.whatsKeptToggle;
    $("wb-storage-whats-kept-text").textContent = WB_STORAGE_WHAT_IS_KEPT;
    $("wb-storage-continue-btn").textContent = WB_COPY.storage.continue;
    $("wb-storage-continue-btn").disabled = !storageChoice;
    $("wb-storage-print-btn").textContent = WB_COPY.storage.printWeek;
  }
  $("wb-storage-print-btn").addEventListener("click", function () { printVariant("week"); });
  $("wb-storage-keep-btn").addEventListener("click", function () { storageChoice = "keep"; renderStorage(); });
  $("wb-storage-decline-btn").addEventListener("click", function () { storageChoice = "decline"; renderStorage(); });
  $("wb-storage-whats-kept-toggle").addEventListener("click", function () { $("wb-storage-whats-kept-text").hidden = !$("wb-storage-whats-kept-text").hidden; });
  $("wb-storage-continue-btn").addEventListener("click", function () {
    if (!storageChoice) return;
    if (storageChoice === "keep") {
      storageConsent = true;
      state.createdAt = new Date().toISOString();
      try { localStorage.removeItem(WB_DECLINED_KEY); } catch (e) {}
    } else {
      storageConsent = false;
      try { localStorage.setItem(WB_DECLINED_KEY, "1"); } catch (e) {}
    }
    storageOfferShown = true;
    mode = "ongoing"; ongoingScreen = "current-week";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * PHASE 4 -- CURRENT WEEK
   * ------------------------------------------------------------------- */

  function renderCurrentWeek() {
    $("wb-current-week-heading").textContent = WB_COPY.currentWeek.heading;
    $("wb-current-week-log-unplanned-btn").textContent = WB_COPY.currentWeek.logUnplanned;
    $("wb-current-week-review-btn").textContent = WB_COPY.currentWeek.reviewLink;
    $("wb-current-week-print-btn").textContent = WB_COPY.currentWeek.printWeek;

    var weekStart = currentWeekMonday();
    renderWeekGrid($("wb-current-week-grid"), weekStart, "current");
  }

  $("wb-current-week-log-unplanned-btn").addEventListener("click", function () {
    activeLogEntryId = null;
    activeLogUnplanned = true;
    logDidIt = null; logBarrier = null;
    pendingUnplannedText = "";
    ongoingScreen = "log";
    renderAll();
  });
  $("wb-current-week-review-btn").addEventListener("click", function () { ongoingScreen = "review"; renderAll(); });
  $("wb-current-week-print-btn").addEventListener("click", function () { printVariant("week"); });

  /* ---------------------------------------------------------------------
   * LOGGING -- the thirty-second path. Required: the outcome chip and a
   * default-filled mood slider. Everything else is optional and never
   * nudged.
   * ------------------------------------------------------------------- */

  function renderLog() {
    var entry = activeLogEntryId ? entryById(activeLogEntryId) : null;

    $("wb-log-heading").textContent = WB_COPY.log.heading;
    $("wb-log-item-text").hidden = activeLogUnplanned;
    if (entry) $("wb-log-item-text").textContent = entry.text;

    $("wb-log-unplanned-field").hidden = !activeLogUnplanned;
    $("wb-log-unplanned-what-label").textContent = WB_COPY.log.unplannedWhatLabel;
    $("wb-log-unplanned-what").setAttribute("placeholder", WB_COPY.log.unplannedWhatPlaceholder);
    if (activeLogUnplanned) $("wb-log-unplanned-what").value = pendingUnplannedText;

    // Logging something unplanned is inherently "it happened" -- asking
    // whether it happened would be nonsensical, so that question only
    // appears for a planned item.
    $("wb-log-didit-label").hidden = activeLogUnplanned;
    $("wb-log-didit-label").textContent = WB_COPY.log.heading;
    var diditRow = $("wb-log-didit-options");
    diditRow.innerHTML = "";
    if (!activeLogUnplanned) {
      WB_COMPLETION_OPTIONS.forEach(function (o) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "wb-chip" + (logDidIt === o.id ? " wb-chip-selected" : "");
        chip.textContent = o.label;
        chip.setAttribute("aria-pressed", logDidIt === o.id ? "true" : "false");
        chip.addEventListener("click", function () { logDidIt = o.id; renderLog(); });
        diditRow.appendChild(chip);
      });
    }

    var effectiveDidIt = activeLogUnplanned ? "yes" : logDidIt;
    var went = effectiveDidIt === "yes" || effectiveDidIt === "partly";
    var didntGo = effectiveDidIt === "no";
    $("wb-log-yes-branch").hidden = !went;
    $("wb-log-no-branch").hidden = !didntGo;
    $("wb-log-submit-btn").hidden = !effectiveDidIt;
    $("wb-log-submit-btn").textContent = WB_COPY.log.submit;
    $("wb-log-cancel-btn").textContent = "Cancel";

    if (went) {
      $("wb-log-mood-after-label").textContent = WB_COPY.log.moodAfterLabel;
      $("wb-log-mood-after-readout").textContent = $("wb-log-mood-after").value;
      $("wb-log-enjoy-toggle").textContent = WB_COPY.log.enjoymentToggle;
      $("wb-log-enjoy-readout").textContent = $("wb-log-enjoy").value;
      $("wb-log-accomplish-toggle").textContent = WB_COPY.log.accomplishmentToggle;
      $("wb-log-accomplish-readout").textContent = $("wb-log-accomplish").value;
      $("wb-log-mood-before-toggle").textContent = WB_COPY.log.moodBeforeToggle;
      $("wb-log-mood-before-readout").textContent = $("wb-log-mood-before").value;
      $("wb-log-notes-toggle").textContent = WB_COPY.log.notesToggle;
      $("wb-log-notes").setAttribute("placeholder", WB_COPY.log.notesPlaceholder);
    }

    if (didntGo) {
      $("wb-log-barrier-label").textContent = WB_COPY.log.barrierLabel;
      var barrierRow = $("wb-log-barrier-options");
      barrierRow.innerHTML = "";
      WB_BARRIER_OPTIONS.forEach(function (o) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "wb-chip" + (logBarrier === o.id ? " wb-chip-selected" : "");
        chip.textContent = o.label;
        chip.setAttribute("aria-pressed", logBarrier === o.id ? "true" : "false");
        chip.addEventListener("click", function () { logBarrier = o.id; renderLog(); });
        barrierRow.appendChild(chip);
      });

      var barrierChosen = !!logBarrier;
      $("wb-log-barrier-ack").hidden = !barrierChosen;
      $("wb-log-barrier-ack").textContent = WB_COPY.log.barrierAck;
      $("wb-log-barrier-notes-wrap").hidden = !barrierChosen;
      $("wb-log-barrier-notes").setAttribute("placeholder", WB_COPY.log.barrierNotesPlaceholder);

      var couldntFace = logBarrier === "couldnt_face";
      var timeRelated = logBarrier === "no_time" || logBarrier === "forgot";
      $("wb-log-followup-text").hidden = !(couldntFace || timeRelated);
      $("wb-log-followup-text").textContent = couldntFace ? WB_COPY.log.couldntFaceFollowup : (timeRelated ? WB_COPY.log.noTimeFollowup : "");
      $("wb-log-followup-action-wrap").hidden = !(couldntFace || timeRelated);
      $("wb-log-followup-btn").textContent = couldntFace ? WB_COPY.log.couldntFaceAction : WB_COPY.log.noTimeAction;
    }
  }

  ["wb-log-mood-after", "wb-log-enjoy", "wb-log-accomplish", "wb-log-mood-before"].forEach(function (id) {
    $(id).addEventListener("input", function () { $(id + "-readout").textContent = this.value; });
  });
  $("wb-log-enjoy-toggle").addEventListener("click", function () { $("wb-log-enjoy-wrap").hidden = !$("wb-log-enjoy-wrap").hidden; });
  $("wb-log-accomplish-toggle").addEventListener("click", function () { $("wb-log-accomplish-wrap").hidden = !$("wb-log-accomplish-wrap").hidden; });
  $("wb-log-mood-before-toggle").addEventListener("click", function () { $("wb-log-mood-before-wrap").hidden = !$("wb-log-mood-before-wrap").hidden; });
  $("wb-log-notes-toggle").addEventListener("click", function () { $("wb-log-notes-wrap").hidden = !$("wb-log-notes-wrap").hidden; });

  function resetLogFormFields() {
    $("wb-log-mood-after").value = 5; $("wb-log-mood-after-readout").textContent = "5";
    $("wb-log-enjoy").value = 5; $("wb-log-accomplish").value = 5; $("wb-log-mood-before").value = 5;
    $("wb-log-enjoy-wrap").hidden = true; $("wb-log-accomplish-wrap").hidden = true;
    $("wb-log-mood-before-wrap").hidden = true; $("wb-log-notes-wrap").hidden = true;
    $("wb-log-notes").value = ""; $("wb-log-barrier-notes").value = "";
    $("wb-log-unplanned-what").value = "";
  }

  function buildLogObject() {
    var effectiveDidIt = activeLogUnplanned ? "yes" : logDidIt;
    var log = { completion: effectiveDidIt, loggedAt: new Date().toISOString() };
    if (effectiveDidIt === "yes" || effectiveDidIt === "partly") {
      log.moodAfter = parseInt($("wb-log-mood-after").value, 10);
      log.enjoyment = $("wb-log-enjoy-wrap").hidden ? null : parseInt($("wb-log-enjoy").value, 10);
      log.accomplishment = $("wb-log-accomplish-wrap").hidden ? null : parseInt($("wb-log-accomplish").value, 10);
      log.moodBefore = $("wb-log-mood-before-wrap").hidden ? null : parseInt($("wb-log-mood-before").value, 10);
      log.notes = $("wb-log-notes-wrap").hidden ? "" : $("wb-log-notes").value;
    } else {
      log.barrier = logBarrier;
      log.barrierNotes = $("wb-log-barrier-notes").value;
    }
    return log;
  }

  function submitLog() {
    var effectiveDidIt = activeLogUnplanned ? "yes" : logDidIt;
    if (!effectiveDidIt) return false;
    var log = buildLogObject();
    if (activeLogUnplanned) {
      var text = $("wb-log-unplanned-what").value.trim();
      if (!text) { $("wb-log-unplanned-what").focus(); return false; }
      var today = new Date();
      state.entries.push({
        id: uid("e"), kind: "unplanned", weekStart: currentWeekMonday(), day: null, block: null,
        date: isoDate(today), menuItemId: null, text: text, note: "", log: log
      });
    } else {
      var entry = entryById(activeLogEntryId);
      if (!entry) return false;
      entry.log = log;
    }
    resetLogFormFields();
    return true;
  }

  $("wb-log-submit-btn").addEventListener("click", function () {
    if (submitLog()) { ongoingScreen = "current-week"; renderAll(); }
  });
  $("wb-log-cancel-btn").addEventListener("click", function () {
    resetLogFormFields();
    ongoingScreen = "current-week";
    renderAll();
  });
  $("wb-log-followup-btn").addEventListener("click", function () {
    var entry = entryById(activeLogEntryId);
    var couldntFace = logBarrier === "couldnt_face";
    submitLog();
    if (couldntFace && entry) {
      var smaller = window.prompt("A smaller version of \"" + entry.text + "\":", "");
      if (smaller && smaller.trim()) {
        var newItem = { id: uid("m"), category: "progress", text: smaller.trim(), expectedEnjoy: 5, expectedHard: 5 };
        state.menu.push(newItem);
        selectedMenuItemForPlacement = newItem.id;
      } else {
        selectedMenuItemForPlacement = null;
      }
    } else if (entry) {
      selectedMenuItemForPlacement = entry.menuItemId;
    }
    planningWeekStart = currentWeekMonday();
    softCapShown = false; specificityNoticeFor = null;
    mode = "build"; buildScreen = "week";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * REVIEW
   * ------------------------------------------------------------------- */

  function loggedEntriesWithOutcome() {
    return state.entries.filter(function (e) { return e.log && (e.log.completion === "yes" || e.log.completion === "partly"); });
  }

  function renderReview() {
    $("wb-review-heading").textContent = WB_COPY.review.heading;
    $("wb-review-save-copy-btn").textContent = WB_COPY.review.saveCopy;
    $("wb-review-back-btn").textContent = WB_COPY.review.back;
    $("wb-review-plan-next-btn").textContent = WB_COPY.review.planNextWeek;

    // 1. Expected vs actual
    $("wb-review-expected-actual-heading").textContent = WB_COPY.review.expectedActualHeading;
    var withExpected = loggedEntriesWithOutcome().filter(function (e) {
      return e.menuItemId && typeof e.log.enjoyment === "number";
    });
    var eaList = $("wb-review-expected-actual-list");
    eaList.innerHTML = "";
    withExpected.forEach(function (e) {
      var m = menuItemById(e.menuItemId);
      if (!m) return;
      var row = document.createElement("div");
      row.className = "wb-expected-actual-row";
      var label = document.createElement("span");
      label.textContent = formatDateRelative(e.date) + " — " + e.text;
      var predicted = document.createElement("span");
      predicted.className = "wb-expected-actual-value";
      predicted.textContent = "expected " + m.expectedEnjoy + "/10";
      var actual = document.createElement("span");
      actual.className = "wb-expected-actual-value";
      actual.textContent = "actual " + e.log.enjoyment + "/10";
      row.appendChild(label); row.appendChild(predicted); row.appendChild(actual);
      eaList.appendChild(row);
    });
    if (withExpected.length >= 3) {
      var avgPredicted = withExpected.reduce(function (s, e) { return s + menuItemById(e.menuItemId).expectedEnjoy; }, 0) / withExpected.length;
      var avgActual = withExpected.reduce(function (s, e) { return s + e.log.enjoyment; }, 0) / withExpected.length;
      $("wb-review-expected-actual-summary").hidden = false;
      $("wb-review-expected-actual-summary").textContent = WB_COPY.review.expectedActualSummaryTemplate
        .replace("{n}", withExpected.length).replace("{x}", round1(avgPredicted)).replace("{y}", round1(avgActual));
      var diff = avgActual - avgPredicted;
      $("wb-review-expected-actual-note").hidden = Math.abs(diff) < 0.75;
      $("wb-review-expected-actual-note").textContent = diff >= 0.75 ? WB_COPY.review.betterThanExpectedNote : (diff <= -0.75 ? WB_COPY.review.worseThanExpectedNote : "");
    } else {
      $("wb-review-expected-actual-summary").hidden = true;
      $("wb-review-expected-actual-note").hidden = true;
    }

    // 2. What helps
    $("wb-review-what-helps-heading").textContent = WB_COPY.review.whatHelpsHeading;
    $("wb-review-what-helps-note").textContent = WB_COPY.review.whatHelpsNote;
    var byItem = {};
    loggedEntriesWithOutcome().filter(function (e) { return e.menuItemId && typeof e.log.moodAfter === "number"; }).forEach(function (e) {
      (byItem[e.menuItemId] = byItem[e.menuItemId] || []).push(e.log.moodAfter);
    });
    var ranked = Object.keys(byItem).filter(function (id) { return byItem[id].length >= 2; }).map(function (id) {
      var moods = byItem[id];
      return { item: menuItemById(id), avg: moods.reduce(function (s, v) { return s + v; }, 0) / moods.length };
    }).filter(function (x) { return x.item; }).sort(function (a, b) { return b.avg - a.avg; });
    var helpsList = $("wb-review-what-helps-list");
    helpsList.innerHTML = "";
    if (!ranked.length) {
      var empty = document.createElement("p");
      empty.className = "wb-helper-outro";
      empty.textContent = WB_COPY.review.whatHelpsEmpty;
      helpsList.appendChild(empty);
    } else {
      ranked.forEach(function (r) {
        var row = document.createElement("div");
        row.className = "wb-helps-row";
        var label = document.createElement("span");
        label.textContent = r.item.text;
        var val = document.createElement("span");
        val.className = "wb-helps-row-value";
        val.textContent = round1(r.avg) + "/10 avg mood";
        row.appendChild(label); row.appendChild(val);
        helpsList.appendChild(row);
      });
    }

    // 3. Mood over time
    $("wb-review-mood-time-heading").textContent = WB_COPY.review.moodOverTimeHeading;
    var moodWrap = $("wb-review-mood-time");
    moodWrap.innerHTML = "";
    var moodEntries = loggedEntriesWithOutcome().filter(function (e) { return typeof e.log.moodAfter === "number"; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    if (!moodEntries.length) {
      var moodEmpty = document.createElement("p");
      moodEmpty.className = "wb-helper-outro";
      moodEmpty.textContent = WB_COPY.review.plansEmpty;
      moodWrap.appendChild(moodEmpty);
    } else {
      var moodList = document.createElement("div");
      moodList.className = "wb-mood-time-list";
      moodEntries.forEach(function (e) {
        var line = document.createElement("div");
        line.textContent = formatDateRelative(e.date) + " — " + e.text + " — mood " + e.log.moodAfter + "/10";
        moodList.appendChild(line);
      });
      moodWrap.appendChild(moodList);
    }

    // 4. What happened to the plans
    $("wb-review-plans-heading").textContent = WB_COPY.review.plansHeading;
    var plansWrap = $("wb-review-plans-list");
    plansWrap.innerHTML = "";
    var planned = state.entries.filter(function (e) { return e.kind === "planned"; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (!planned.length) {
      var plansEmpty = document.createElement("p");
      plansEmpty.className = "wb-helper-outro";
      plansEmpty.textContent = WB_COPY.review.plansEmpty;
      plansWrap.appendChild(plansEmpty);
    } else {
      planned.forEach(function (e) {
        var row = document.createElement("div");
        row.className = "wb-plan-row";
        var label = document.createElement("span");
        label.textContent = formatDateRelative(e.date) + " — " + e.text;
        var status = document.createElement("span");
        status.className = "wb-expected-actual-value";
        if (!e.log) status.textContent = "not logged yet";
        else {
          var compLabel = (WB_COMPLETION_OPTIONS.filter(function (o) { return o.id === e.log.completion; })[0] || {}).label || e.log.completion;
          status.textContent = "logged: " + compLabel;
        }
        row.appendChild(label); row.appendChild(status);
        plansWrap.appendChild(row);
      });
    }

    $("wb-review-footer-note").textContent = WB_COPY.review.footerNote;
  }

  $("wb-review-back-btn").addEventListener("click", function () { ongoingScreen = "current-week"; renderAll(); });
  $("wb-review-save-copy-btn").addEventListener("click", function () { printVariant("record"); });
  $("wb-review-plan-next-btn").addEventListener("click", function () {
    var latestWeek = state.entries.filter(function (e) { return e.kind === "planned"; })
      .reduce(function (max, e) { return e.weekStart > max ? e.weekStart : max; }, currentWeekMonday());
    planningWeekStart = addDays(latestWeek, 7);
    softCapShown = false; specificityNoticeFor = null; selectedMenuItemForPlacement = null;
    mode = "build"; buildScreen = "week";
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * PRINT SHEETS -- two variants, toggled by adding .wb-print-active to
   * whichever one should show for this print, per spec.
   * ------------------------------------------------------------------- */

  function printVariant(variant) {
    $("wb-print-week-sheet").classList.toggle("wb-print-active", variant === "week");
    $("wb-print-record-sheet").classList.toggle("wb-print-active", variant === "record");
    updatePrintSheets();
    window.print();
  }

  function updatePrintSheets() {
    $("wb-print-week-title").textContent = WB_COPY.print.weekTitle;
    $("wb-print-week-disclaimer").textContent = WB_STANDING_DISCLAIMER;
    $("wb-print-week-crisis").textContent = WB_CRISIS_LINE;
    var weekGridWrap = $("wb-print-week-grid");
    weekGridWrap.innerHTML = "";
    var table = document.createElement("table");
    table.className = "wb-print-week-grid-table";
    var thead = document.createElement("tr");
    var corner = document.createElement("th");
    thead.appendChild(corner);
    WB_DAYS.forEach(function (d) { var th = document.createElement("th"); th.textContent = d.label; thead.appendChild(th); });
    table.appendChild(thead);
    var weekStart = currentWeekMonday();
    WB_BLOCKS.forEach(function (block) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.textContent = block.label;
      tr.appendChild(th);
      WB_DAYS.forEach(function (d) {
        var td = document.createElement("td");
        var placed = state.entries.filter(function (e) { return e.kind === "planned" && e.weekStart === weekStart && e.day === d.id && e.block === block.id; });
        td.textContent = placed.map(function (e) { return e.text; }).join("; ");
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    weekGridWrap.appendChild(table);

    $("wb-print-record-title").textContent = WB_COPY.print.recordTitle;
    $("wb-print-record-menu-heading").textContent = WB_COPY.print.menuHeading;
    $("wb-print-record-log-heading").textContent = WB_COPY.print.logHeading;
    $("wb-print-record-expected-actual-heading").textContent = WB_COPY.print.expectedActualHeading;
    $("wb-print-record-what-helps-heading").textContent = WB_COPY.print.whatHelpsHeading;
    $("wb-print-record-questions-heading").textContent = WB_COPY.print.questionsHeading;
    $("wb-print-record-disclaimer").textContent = WB_STANDING_DISCLAIMER;
    $("wb-print-record-crisis").textContent = WB_CRISIS_LINE;

    var menuWrap = $("wb-print-record-menu");
    menuWrap.innerHTML = "";
    WB_MENU_CATEGORIES.forEach(function (cat) {
      var items = state.menu.filter(function (m) { return m.category === cat.id; });
      if (!items.length) return;
      var p = document.createElement("p");
      var strong = document.createElement("strong");
      strong.textContent = cat.label + ": ";
      p.appendChild(strong);
      p.appendChild(document.createTextNode(items.map(function (m) { return m.text + " (expected " + m.expectedEnjoy + "/10)"; }).join(", ")));
      menuWrap.appendChild(p);
    });

    var logWrap = $("wb-print-record-log");
    logWrap.innerHTML = "";
    var allLogged = state.entries.filter(function (e) { return e.log; }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    if (!allLogged.length) {
      var p0 = document.createElement("p");
      p0.textContent = "Nothing logged yet.";
      logWrap.appendChild(p0);
    } else {
      allLogged.forEach(function (e) {
        var p = document.createElement("p");
        var compLabel = (WB_COMPLETION_OPTIONS.filter(function (o) { return o.id === e.log.completion; })[0] || {}).label || e.log.completion;
        var bits = [formatDateRelative(e.date), e.text, compLabel];
        if (typeof e.log.moodAfter === "number") bits.push("mood " + e.log.moodAfter + "/10");
        p.textContent = bits.join(" — ");
        logWrap.appendChild(p);
      });
    }

    var eaWrap = $("wb-print-record-expected-actual");
    eaWrap.innerHTML = "";
    var withExpected = loggedEntriesWithOutcome().filter(function (e) { return e.menuItemId && typeof e.log.enjoyment === "number"; });
    if (!withExpected.length) {
      var p1 = document.createElement("p"); p1.textContent = "Not enough logged yet.";
      eaWrap.appendChild(p1);
    } else {
      withExpected.forEach(function (e) {
        var m = menuItemById(e.menuItemId);
        if (!m) return;
        var p = document.createElement("p");
        p.textContent = e.text + " — expected " + m.expectedEnjoy + "/10, actual " + e.log.enjoyment + "/10";
        eaWrap.appendChild(p);
      });
    }

    var helpsWrap = $("wb-print-record-what-helps");
    helpsWrap.innerHTML = "";
    var byItem2 = {};
    loggedEntriesWithOutcome().filter(function (e) { return e.menuItemId && typeof e.log.moodAfter === "number"; }).forEach(function (e) {
      (byItem2[e.menuItemId] = byItem2[e.menuItemId] || []).push(e.log.moodAfter);
    });
    var ranked2 = Object.keys(byItem2).filter(function (id) { return byItem2[id].length >= 2; }).map(function (id) {
      var moods = byItem2[id];
      return { item: menuItemById(id), avg: moods.reduce(function (s, v) { return s + v; }, 0) / moods.length };
    }).filter(function (x) { return x.item; }).sort(function (a, b) { return b.avg - a.avg; });
    if (!ranked2.length) {
      var p2 = document.createElement("p"); p2.textContent = "Not enough logged yet.";
      helpsWrap.appendChild(p2);
    } else {
      ranked2.forEach(function (r) {
        var p = document.createElement("p");
        p.textContent = r.item.text + " — " + round1(r.avg) + "/10 average mood";
        helpsWrap.appendChild(p);
      });
    }

    var qList = $("wb-print-record-questions");
    qList.innerHTML = "";
    WB_COPY.print.questions.forEach(function (q) {
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
    storageConsent = true;
    storageOfferShown = true;
    mode = "ongoing";
    ongoingScreen = "current-week";
  } else {
    state = defaultState();
    storageConsent = false;
    mode = "build";
    buildScreen = "noticing-intro";
    try { openingShowsDeclinedNote = localStorage.getItem(WB_DECLINED_KEY) === "1"; } catch (e) { openingShowsDeclinedNote = false; }
  }

  renderAll();
})();
