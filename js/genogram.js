(function () {
  "use strict";

  if (typeof GB_COPY === "undefined") return;

  /* ---------------------------------------------------------------------
   * STATE -- in-memory only. Nothing here is ever written to localStorage,
   * sessionStorage, a cookie, or sent anywhere. A reload starts over.
   * ------------------------------------------------------------------- */

  var personCounter = 0;
  function newPerson(name, gender, generation) {
    personCounter++;
    return {
      id: "p" + personCounter,
      name: name || "",
      relationship: "",
      gender: gender || "female",
      generation: typeof generation === "number" ? generation : 0,
      lifeStatus: "living",
      // offset: a manual {dx,dy} nudge the user dragged this node to, on
      // top of the auto-computed layout position -- null until dragged.
      current: { closeness: 3, influence: 3, quality: "neutral", notes: "", offset: null },
      ideal: { closeness: 3, influence: 3, quality: "neutral", notes: "", offset: null }
    };
  }

  function blankReflections() { return GB_REFLECTION_QUESTIONS.map(function () { return ""; }); }

  var state = { client: { name: "You", gender: "female" }, people: [], reflections: blankReflections() };
  var mode = "current"; // drives the Step 3 single-map view only
  var sideBySide = false;
  var selectedPersonId = null;

  function defaultState() {
    personCounter = 0;
    return { client: { name: "You", gender: "female" }, people: [newPerson("", "female", -1)], reflections: blankReflections() };
  }

  /* ---------------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }
  function ratingsFor(person, m) { return person[m]; }

  function generationLabel(value) {
    var g = GB_GENERATIONS.filter(function (x) { return x.value === value; })[0];
    return g ? g.label : ("Generation " + (value > 0 ? "+" + value : value));
  }

  /* ---------------------------------------------------------------------
   * STATIC COPY
   * ------------------------------------------------------------------- */

  function renderStaticCopy() {
    $("gb-opening-heading").textContent = GB_COPY.opening.heading;
    $("gb-opening-tagline").textContent = GB_COPY.opening.tagline;
    var body = $("gb-opening-body");
    body.innerHTML = "";
    GB_COPY.opening.body.forEach(function (p) {
      var el = document.createElement("p");
      el.textContent = p;
      body.appendChild(el);
    });
    $("gb-how-it-works-heading").textContent = GB_COPY.opening.howItWorksHeading;
    var how = $("gb-how-it-works-list");
    how.innerHTML = "";
    GB_COPY.opening.howItWorks.forEach(function (step) {
      var li = document.createElement("li");
      li.textContent = step;
      how.appendChild(li);
    });
    $("gb-crisis-line-top").textContent = GB_CRISIS_LINE;
    $("gb-fine-print-bottom").textContent = GB_STANDING_DISCLAIMER;

    $("gb-people-step").textContent = GB_COPY.people.stepLabel;
    $("gb-people-heading").textContent = GB_COPY.people.heading;
    $("gb-client-label").textContent = GB_COPY.people.clientLabel;
    $("gb-client-instruction").textContent = GB_COPY.people.clientInstruction;
    $("gb-client-name-label").textContent = GB_COPY.people.nameLabel;
    $("gb-client-gender-label").textContent = GB_COPY.people.genderLabel;
    $("gb-add-person-btn").textContent = GB_COPY.people.addPersonLabel;
    $("gb-load-example-btn").textContent = GB_COPY.people.loadExampleLabel;
    $("gb-reset-btn").textContent = GB_COPY.people.resetLabel;

    $("gb-ratings-step").textContent = GB_COPY.ratings.stepLabel;
    $("gb-ratings-heading").textContent = GB_COPY.ratings.heading;
    $("gb-ratings-helper").textContent = GB_COPY.ratings.helper;

    $("gb-map-step").textContent = GB_COPY.map.stepLabel;
    $("gb-map-heading").textContent = GB_COPY.map.heading;
    $("gb-side-by-side-label-text").textContent = GB_COPY.map.sideBySideLabel;
    $("gb-reset-positions-btn").textContent = GB_COPY.map.resetPositionsLabel;
    $("gb-drag-hint").textContent = GB_COPY.map.dragHint;
    $("gb-empty-message").textContent = GB_COPY.map.emptyMessage;
    $("gb-legend-heading").textContent = GB_COPY.map.legendHeading;

    $("gb-reflect-step").textContent = GB_COPY.reflect.stepLabel;
    $("gb-reflect-heading").textContent = GB_COPY.reflect.heading;
    $("gb-reflect-helper").textContent = GB_COPY.reflect.helper;

    $("gb-save-copy-btn").textContent = GB_COPY.actions.saveCopy;
    $("gb-start-new-btn").textContent = GB_COPY.actions.startNew;

    var genderSelect = $("gb-client-gender");
    genderSelect.innerHTML = "";
    GB_GENDERS.forEach(function (g) {
      var opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.label;
      genderSelect.appendChild(opt);
    });

    var relationshipList = $("gb-relationship-suggestions");
    relationshipList.innerHTML = "";
    GB_RELATIONSHIP_SUGGESTIONS.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = r;
      relationshipList.appendChild(opt);
    });

    renderModeToggle($("gb-map-mode-toggle"));
    renderLegend();
    renderReflectionList();

    $("gb-client-name").addEventListener("input", function () {
      state.client.name = this.value;
      renderAll();
    });
    genderSelect.addEventListener("change", function () {
      state.client.gender = this.value;
      renderAll();
    });
  }

  function renderModeToggle(container) {
    container.innerHTML = "";
    GB_MODES.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gb-mode-btn" + (mode === m.id ? " gb-mode-active" : "");
      btn.textContent = m.label;
      btn.setAttribute("data-mode", m.id);
      btn.setAttribute("aria-pressed", mode === m.id ? "true" : "false");
      btn.addEventListener("click", function () {
        mode = m.id;
        renderAll();
      });
      container.appendChild(btn);
    });
  }

  function renderReflectionList() {
    var list = $("gb-reflection-list");
    list.innerHTML = "";
    GB_REFLECTION_QUESTIONS.forEach(function (q, i) {
      var item = document.createElement("div");
      item.className = "gb-reflection-item";
      var question = document.createElement("p");
      question.className = "gb-reflection-question";
      question.textContent = q;
      item.appendChild(question);
      var textarea = document.createElement("textarea");
      textarea.className = "gb-reflection-response";
      textarea.value = state.reflections[i] || "";
      textarea.placeholder = GB_COPY.reflect.responsePlaceholder;
      textarea.addEventListener("input", function () {
        state.reflections[i] = textarea.value;
        updatePrintSheet();
      });
      item.appendChild(textarea);
      list.appendChild(item);
    });
  }

  function renderLegend() {
    var list = $("gb-legend-list");
    list.innerHTML = "";
    [
      GB_COPY.map.legendShape, GB_COPY.map.legendSize, GB_COPY.map.legendBorder,
      GB_COPY.map.legendColor, GB_COPY.map.legendProximity,
      GB_COPY.map.legendLineStyle, GB_COPY.map.legendLineWeight
    ].forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });

    var qualities = $("gb-legend-qualities");
    qualities.innerHTML = "";
    GB_QUALITIES.forEach(function (q) {
      var item = document.createElement("div");
      item.className = "gb-legend-quality-item";
      item.appendChild(buildLineSample(q));
      item.appendChild(document.createTextNode(q.label));
      qualities.appendChild(item);
    });
  }

  // A tiny inline SVG showing the actual rendered line style for a
  // quality, rather than a flat color bar -- so the legend shows what the
  // dashed/wavy/jagged/broken/slashed lines on the map really look like.
  function buildLineSample(quality) {
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 60 20");
    svg.setAttribute("class", "gb-legend-line-sample");
    svg.setAttribute("aria-hidden", "true");
    var p0 = { x: 4, y: 10 }, p1 = { x: 56, y: 10 };
    connectorPaths(p0, p1, quality.lineStyle).forEach(function (seg) {
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", seg.d);
      path.setAttribute("stroke", quality.color);
      path.setAttribute("stroke-width", seg.isCrossMark ? 2 : 2.5);
      path.setAttribute("fill", "none");
      if (seg.dash) path.setAttribute("stroke-dasharray", seg.dash);
      svg.appendChild(path);
    });
    return svg;
  }

  /* ---------------------------------------------------------------------
   * STEP 1: PEOPLE
   * ------------------------------------------------------------------- */

  function renderClientFields() {
    $("gb-client-name").value = state.client.name;
    $("gb-client-gender").value = state.client.gender;
  }

  function renderPeopleList() {
    var list = $("gb-people-list");
    list.innerHTML = "";

    state.people.forEach(function (person) {
      var row = document.createElement("div");
      row.className = "gb-person-row";

      var nameField = document.createElement("div");
      nameField.className = "gb-field-inline gb-field-name";
      var nameLabel = document.createElement("label");
      nameLabel.textContent = GB_COPY.people.nameLabel;
      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = person.name;
      nameInput.maxLength = 30;
      nameInput.placeholder = GB_COPY.people.personNamePlaceholder;
      nameInput.addEventListener("input", function () {
        person.name = nameInput.value;
        renderRatingsList();
        renderMap();
        updatePrintSheet();
      });
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);
      row.appendChild(nameField);

      var relationshipField = document.createElement("div");
      relationshipField.className = "gb-field-inline";
      var relationshipLabel = document.createElement("label");
      relationshipLabel.textContent = GB_COPY.people.relationshipLabel;
      var relationshipInput = document.createElement("input");
      relationshipInput.type = "text";
      relationshipInput.value = person.relationship;
      relationshipInput.maxLength = 30;
      relationshipInput.placeholder = GB_COPY.people.relationshipPlaceholder;
      relationshipInput.setAttribute("list", "gb-relationship-suggestions");
      relationshipInput.addEventListener("input", function () {
        person.relationship = relationshipInput.value;
        renderRatingsList();
        renderMap();
        updatePrintSheet();
      });
      relationshipField.appendChild(relationshipLabel);
      relationshipField.appendChild(relationshipInput);
      row.appendChild(relationshipField);

      var genderField = document.createElement("div");
      genderField.className = "gb-field-inline";
      var genderLabel = document.createElement("label");
      genderLabel.textContent = GB_COPY.people.genderLabel;
      var genderSelect = document.createElement("select");
      GB_GENDERS.forEach(function (g) {
        var opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.label;
        if (g.id === person.gender) opt.selected = true;
        genderSelect.appendChild(opt);
      });
      genderSelect.addEventListener("change", function () {
        person.gender = genderSelect.value;
        renderMap();
        updatePrintSheet();
      });
      genderField.appendChild(genderLabel);
      genderField.appendChild(genderSelect);
      row.appendChild(genderField);

      var genField = document.createElement("div");
      genField.className = "gb-field-inline";
      var genLabel = document.createElement("label");
      genLabel.textContent = GB_COPY.people.generationLabel;
      var genSelect = document.createElement("select");
      GB_GENERATIONS.forEach(function (g) {
        var opt = document.createElement("option");
        opt.value = String(g.value);
        opt.textContent = g.label;
        if (g.value === person.generation) opt.selected = true;
        genSelect.appendChild(opt);
      });
      genSelect.addEventListener("change", function () {
        person.generation = parseInt(genSelect.value, 10);
        renderMap();
        updatePrintSheet();
      });
      genField.appendChild(genLabel);
      genField.appendChild(genSelect);
      row.appendChild(genField);

      var statusField = document.createElement("div");
      statusField.className = "gb-field-inline";
      var statusLabel = document.createElement("label");
      statusLabel.textContent = GB_COPY.people.lifeStatusLabel;
      var statusSelect = document.createElement("select");
      GB_LIFE_STATUSES.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label;
        if (s.id === person.lifeStatus) opt.selected = true;
        statusSelect.appendChild(opt);
      });
      statusSelect.addEventListener("change", function () {
        person.lifeStatus = statusSelect.value;
        renderMap();
        updatePrintSheet();
      });
      statusField.appendChild(statusLabel);
      statusField.appendChild(statusSelect);
      row.appendChild(statusField);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "gb-row-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.setAttribute("aria-label", "Remove " + (person.name || "this person"));
      removeBtn.addEventListener("click", function () {
        state.people = state.people.filter(function (p) { return p.id !== person.id; });
        if (selectedPersonId === person.id) selectedPersonId = null;
        renderAll();
      });
      row.appendChild(removeBtn);

      list.appendChild(row);
    });

    var atMax = state.people.length >= GB_MAX_PEOPLE;
    $("gb-add-person-btn").disabled = atMax;
    $("gb-people-notice").hidden = !atMax;
    if (atMax) $("gb-people-notice").textContent = GB_COPY.people.maxNotice;
  }

  $("gb-add-person-btn").addEventListener("click", function () {
    if (state.people.length >= GB_MAX_PEOPLE) return;
    state.people.push(newPerson());
    renderAll();
  });

  /* ---------------------------------------------------------------------
   * STEP 2: RATINGS
   * ------------------------------------------------------------------- */

  function renderRatingsList() {
    var list = $("gb-ratings-list");
    list.innerHTML = "";

    state.people.forEach(function (person) {
      var row = document.createElement("div");
      row.className = "gb-rating-row";

      var head = document.createElement("div");
      head.className = "gb-rating-row-head";
      var name = document.createElement("span");
      name.className = "gb-rating-row-name";
      name.textContent = person.name || "Unnamed person";
      var meta = document.createElement("span");
      meta.className = "gb-rating-row-meta";
      meta.textContent = person.relationship ? (person.relationship + " · " + generationLabel(person.generation)) : generationLabel(person.generation);
      head.appendChild(name);
      head.appendChild(meta);
      row.appendChild(head);

      var columns = document.createElement("div");
      columns.className = "gb-rating-columns";
      columns.appendChild(buildRatingColumn(person, "current", GB_COPY.ratings.currentColumnLabel));
      columns.appendChild(buildRatingColumn(person, "ideal", GB_COPY.ratings.idealColumnLabel));
      row.appendChild(columns);

      list.appendChild(row);
    });
  }

  // One Current or Ideal column within a person's rating row -- the two
  // columns are rendered side by side so both ratings are visible and
  // editable at once, instead of behind a toggle.
  function buildRatingColumn(person, modeId, columnLabel) {
    var ratings = ratingsFor(person, modeId);
    var column = document.createElement("div");
    column.className = "gb-rating-column gb-rating-column-" + modeId;

    var columnHead = document.createElement("p");
    columnHead.className = "gb-rating-column-head";
    columnHead.textContent = columnLabel;
    column.appendChild(columnHead);

    column.appendChild(buildRatingButtons(GB_COPY.ratings.closenessLabel, GB_CLOSENESS_ANCHORS, ratings.closeness, function (v) {
      ratings.closeness = v;
      renderRatingsList();
      renderMap();
      updatePrintSheet();
    }));
    column.appendChild(buildRatingButtons(GB_COPY.ratings.influenceLabel, GB_INFLUENCE_ANCHORS, ratings.influence, function (v) {
      ratings.influence = v;
      renderRatingsList();
      renderMap();
      updatePrintSheet();
    }));

    var qualityField = document.createElement("div");
    qualityField.className = "gb-rating-field";
    var qualityLabel = document.createElement("span");
    qualityLabel.className = "gb-rating-field-label";
    qualityLabel.textContent = GB_COPY.ratings.qualityLabel;
    qualityField.appendChild(qualityLabel);
    var pills = document.createElement("div");
    pills.className = "gb-quality-pills";
    GB_QUALITIES.forEach(function (q) {
      var pill = document.createElement("button");
      pill.type = "button";
      pill.className = "gb-quality-pill" + (ratings.quality === q.id ? " gb-quality-selected" : "");
      pill.textContent = q.label;
      if (ratings.quality === q.id) { pill.style.background = q.color; pill.style.borderColor = q.color; }
      pill.setAttribute("aria-pressed", ratings.quality === q.id ? "true" : "false");
      pill.addEventListener("click", function () {
        ratings.quality = q.id;
        renderRatingsList();
        renderMap();
        updatePrintSheet();
      });
      pills.appendChild(pill);
    });
    qualityField.appendChild(pills);
    column.appendChild(qualityField);

    var notesField = document.createElement("div");
    notesField.className = "gb-rating-field";
    var notesLabel = document.createElement("span");
    notesLabel.className = "gb-rating-field-label";
    notesLabel.textContent = GB_COPY.ratings.notesLabel;
    notesField.appendChild(notesLabel);
    var notes = document.createElement("textarea");
    notes.value = ratings.notes;
    notes.placeholder = GB_COPY.ratings.notesPlaceholder;
    notes.addEventListener("input", function () {
      ratings.notes = notes.value;
      if (selectedPersonId === person.id) renderSelectedPanel();
      updatePrintSheet();
    });
    notesField.appendChild(notes);
    column.appendChild(notesField);

    return column;
  }

  function buildRatingButtons(labelText, anchors, selectedValue, onSelect) {
    var field = document.createElement("div");
    field.className = "gb-rating-field";
    var label = document.createElement("span");
    label.className = "gb-rating-field-label";
    label.textContent = labelText;
    field.appendChild(label);

    var wrap = document.createElement("div");
    wrap.className = "gb-rating-buttons";
    anchors.forEach(function (a) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gb-rating-btn" + (selectedValue === a.value ? " gb-rating-selected" : "");
      btn.textContent = String(a.value);
      btn.title = a.label;
      btn.setAttribute("aria-label", a.value + " — " + a.label);
      btn.addEventListener("click", function () { onSelect(a.value); });
      wrap.appendChild(btn);
    });
    field.appendChild(wrap);

    var anchorText = document.createElement("span");
    anchorText.className = "gb-rating-anchor";
    var current = anchors.filter(function (a) { return a.value === selectedValue; })[0];
    anchorText.textContent = current ? current.label : "";
    wrap.appendChild(anchorText);

    return field;
  }

  /* ---------------------------------------------------------------------
   * LAYOUT -- positions every person by generation (vertical) and
   * closeness-to-client (horizontal distance), for a given mode.
   * ------------------------------------------------------------------- */

  var CHART_W = 900, CHART_H = 700, CENTER_X = 450;
  var DIST_UNIT = 55, DIST_BASE = 55, NODE_PADDING = 16;
  var CLEARANCE_BUFFER = 10, MAX_ROW_NUDGE = 170;

  function distanceForCloseness(closeness) {
    return DIST_BASE + (6 - closeness) * DIST_UNIT;
  }

  // Every person in the same generation sits at the same row y -- and
  // since the client is also AT that row y when generation is 0 (the
  // client's own generation), two same-side people there are perfectly
  // collinear with the client: the connector to the farther one runs
  // straight through the nearer one's node. A fixed nudge isn't enough to
  // fix this in general -- a node twice as far out needs roughly twice the
  // vertical clearance to miss a nearer node of a given size, so this
  // solves directly for the smallest vertical nudge (up or down) that
  // clears every nearer same-side node already placed in this row, rather
  // than guessing a constant and hoping it's enough.
  function clearanceNudge(x, baseY, placed) {
    if (!placed.length) return 0;
    var best = null;
    [1, -1].forEach(function (sign) {
      var y = baseY;
      placed.forEach(function (p) {
        var k = (p.radius + CLEARANCE_BUFFER) * x;
        // Solving p.x*y - p.y*x = sign*k for y (the boundary past which
        // this node's line clears p's circle), then keeping whichever
        // boundary is farthest from baseY in this sign's direction.
        var boundary = (sign * k + p.y * x) / p.x;
        if (sign > 0 ? boundary > y : boundary < y) y = boundary;
      });
      var nudge = y - baseY;
      if (best === null || Math.abs(nudge) < Math.abs(best)) best = nudge;
    });
    if (Math.abs(best) > MAX_ROW_NUDGE) best = (best > 0 ? 1 : -1) * MAX_ROW_NUDGE;
    return best;
  }

  function computeLayout(m) {
    var generations = [0];
    state.people.forEach(function (p) { if (generations.indexOf(p.generation) === -1) generations.push(p.generation); });
    var minGen = Math.min.apply(null, generations);
    var maxGen = Math.max.apply(null, generations);
    var span = maxGen - minGen;
    var rowHeight = span > 0 ? Math.min(120, (CHART_H - 140) / span) : 0;
    var centerY = CHART_H / 2 - ((minGen + maxGen) / 2) * rowHeight;

    var positions = {};
    positions[GB_CLIENT_ID] = { x: CENTER_X, y: centerY, generation: 0 };

    var rows = {};
    state.people.forEach(function (p) {
      (rows[p.generation] = rows[p.generation] || []).push(p);
    });

    Object.keys(rows).forEach(function (genKey) {
      var gen = parseInt(genKey, 10);
      var list = rows[gen].slice().sort(function (a, b) {
        return ratingsFor(b, m).closeness - ratingsFor(a, m).closeness;
      });
      var baseYrel = gen * rowHeight;
      var leftPlaced = [], rightPlaced = [];
      list.forEach(function (person, idx) {
        var ratings = ratingsFor(person, m);
        var dist = distanceForCloseness(ratings.closeness);
        var radius = nodeRadius(ratings.influence);
        var side = idx % 2 === 0 ? 1 : -1;
        var placed = side === 1 ? rightPlaced : leftPlaced;
        var x = dist;
        // Gap needed between two node centers is the sum of their radii
        // plus padding, not a flat constant -- a node's radius varies
        // 21-41px with its influence rating, so a fixed gap that's safe
        // for two small nodes will let two large ones overlap.
        placed.forEach(function (prev) {
          var needed = radius + prev.radius + NODE_PADDING;
          if (Math.abs(x - prev.dist) < needed) x = prev.dist + needed;
        });
        var yRel = baseYrel + clearanceNudge(x, baseYrel, placed);
        placed.push({ dist: x, radius: radius, x: x, y: yRel });
        var offset = ratings.offset;
        positions[person.id] = {
          x: CENTER_X + side * x + (offset ? offset.dx : 0),
          y: centerY + yRel + (offset ? offset.dy : 0),
          generation: gen
        };
      });
    });

    return { positions: positions, rowHeight: rowHeight, centerY: centerY, minGen: minGen, maxGen: maxGen };
  }

  /* ---------------------------------------------------------------------
   * MAP RENDERING -- node shapes, connector line styles, generation
   * gridlines, all built as plain SVG via createElementNS.
   * ------------------------------------------------------------------- */

  var NS = "http://www.w3.org/2000/svg";

  function nodeRadius(influence) { return 16 + influence * 5; }

  function dist(p0, p1) { return Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2)); }

  function straightPath(p0, p1) {
    return "M " + p0.x + "," + p0.y + " L " + p1.x + "," + p1.y;
  }

  function wavyPath(p0, p1, amp, period) {
    var len = dist(p0, p1);
    var ux = (p1.x - p0.x) / len, uy = (p1.y - p0.y) / len;
    var px = -uy, py = ux;
    var steps = Math.max(2, Math.round(len / period));
    var d = "M " + p0.x + "," + p0.y + " ";
    for (var i = 0; i < steps; i++) {
      var t0 = i / steps, t1 = (i + 1) / steps, midT = (t0 + t1) / 2;
      var sign = i % 2 === 0 ? 1 : -1;
      var ctrlX = p0.x + ux * len * midT + px * amp * sign;
      var ctrlY = p0.y + uy * len * midT + py * amp * sign;
      var endX = p0.x + ux * len * t1, endY = p0.y + uy * len * t1;
      d += "Q " + ctrlX + "," + ctrlY + " " + endX + "," + endY + " ";
    }
    return d;
  }

  function zigzagPath(p0, p1, amp, period) {
    var len = dist(p0, p1);
    var ux = (p1.x - p0.x) / len, uy = (p1.y - p0.y) / len;
    var px = -uy, py = ux;
    var steps = Math.max(2, Math.round(len / period));
    var d = "M " + p0.x + "," + p0.y + " ";
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var sign = i % 2 === 0 ? 1 : -1;
      var x = p0.x + ux * len * t + px * amp * sign;
      var y = p0.y + uy * len * t + py * amp * sign;
      d += "L " + x + "," + y + " ";
    }
    d += "L " + p1.x + "," + p1.y;
    return d;
  }

  // Returns [{d, extraClass}] -- most styles are one path, "jagged"
  // (conflictual) is two parallel zigzags per the spec's "jagged double"
  // line, and "slashed" (cutoff) is the base line plus two short cross
  // marks, the classic genogram cutoff symbol.
  function connectorPaths(p0, p1, lineStyle) {
    switch (lineStyle) {
      case "solid":
        return [{ d: straightPath(p0, p1) }];
      case "dashed":
        return [{ d: straightPath(p0, p1), dash: "9 7" }];
      case "broken":
        // Irregular, ragged dash pattern -- visually distinct from the
        // even "dashed" (neutral) rhythm, reading as a frayed rather than
        // simply paused connection.
        return [{ d: straightPath(p0, p1), dash: "3 5 12 4 2 6" }];
      case "wavy":
        return [{ d: wavyPath(p0, p1, 7, 20) }];
      case "jagged": {
        var len = dist(p0, p1);
        var ux = (p1.x - p0.x) / len, uy = (p1.y - p0.y) / len;
        var px = -uy, py = ux;
        var offset = 3;
        var a0 = { x: p0.x + px * offset, y: p0.y + py * offset };
        var a1 = { x: p1.x + px * offset, y: p1.y + py * offset };
        var b0 = { x: p0.x - px * offset, y: p0.y - py * offset };
        var b1 = { x: p1.x - px * offset, y: p1.y - py * offset };
        return [{ d: zigzagPath(a0, a1, 5, 13) }, { d: zigzagPath(b0, b1, 5, 13) }];
      }
      case "slashed": {
        var paths = [{ d: straightPath(p0, p1), dash: "7 6" }];
        var length = dist(p0, p1);
        var dux = (p1.x - p0.x) / length, duy = (p1.y - p0.y) / length;
        var dpx = -duy, dpy = dux;
        [0.4, 0.6].forEach(function (t) {
          var cx = p0.x + dux * length * t, cy = p0.y + duy * length * t;
          var m0 = { x: cx - dux * 5 - dpx * 9, y: cy - duy * 5 - dpy * 9 };
          var m1 = { x: cx + dux * 5 + dpx * 9, y: cy + duy * 5 + dpy * 9 };
          paths.push({ d: straightPath(m0, m1), isCrossMark: true });
        });
        return paths;
      }
      default:
        return [{ d: straightPath(p0, p1) }];
    }
  }

  function lineWeightForCloseness(closeness) {
    // Both extremes (very close / cut off) read as "intense"; a middling
    // rating is the thin, low-key line.
    return 2 + Math.abs(closeness - 3) * 1.1;
  }

  function buildNode(svgEl, id, x, y, person, isClient, m, clientPos) {
    var group = document.createElementNS(NS, "g");
    group.setAttribute("class", "gb-node-group" + (isClient ? "" : " gb-node-draggable"));
    group.setAttribute("data-person-id", id);

    var gender = isClient ? state.client.gender : person.gender;
    var lifeStatus = isClient ? "living" : person.lifeStatus;
    var influence = isClient ? 5 : ratingsFor(person, m).influence;
    var shape = gbShapeForGender(gender);
    var r = nodeRadius(influence);

    function makeShapeEl(radius) {
      var el;
      if (shape === "circle") {
        el = document.createElementNS(NS, "circle");
        el.setAttribute("cx", x); el.setAttribute("cy", y); el.setAttribute("r", radius);
      } else if (shape === "square") {
        el = document.createElementNS(NS, "rect");
        el.setAttribute("x", x - radius); el.setAttribute("y", y - radius);
        el.setAttribute("width", radius * 2); el.setAttribute("height", radius * 2);
      } else {
        var pts = [[x, y - radius], [x + radius, y], [x, y + radius], [x - radius, y]]
          .map(function (p) { return p.join(","); }).join(" ");
        el = document.createElementNS(NS, "polygon");
        el.setAttribute("points", pts);
      }
      return el;
    }

    if (isClient) {
      var outer = makeShapeEl(r + 5);
      outer.setAttribute("class", "gb-node-shape-outer");
      group.appendChild(outer);
    }
    var main = makeShapeEl(r);
    main.setAttribute("class", "gb-node-shape" + (lifeStatus === "deceased" ? " gb-node-deceased" : ""));
    // Outline color mirrors the relationship's quality (green = supportive
    // through red/amber = strained, cut off, or estranged), the same
    // red-to-green logic as the connecting line. Inline style is required
    // here -- the .gb-node-shape class sets its own `stroke`, which beats
    // a plain setAttribute("stroke", ...) in the cascade.
    if (!isClient) main.style.stroke = gbQuality(ratingsFor(person, m).quality).color;
    group.appendChild(main);

    var label = document.createElementNS(NS, "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y + r + 18);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "gb-node-label");
    label.textContent = isClient ? (state.client.name || "You") : (person.name || "Unnamed");
    group.appendChild(label);

    if (!isClient && person.relationship) {
      var subLabel = document.createElementNS(NS, "text");
      subLabel.setAttribute("x", x);
      subLabel.setAttribute("y", y + r + 31);
      subLabel.setAttribute("text-anchor", "middle");
      subLabel.setAttribute("class", "gb-node-sub-label");
      subLabel.textContent = person.relationship;
      group.appendChild(subLabel);
    }

    var suppressNextClick = false;
    group.addEventListener("click", function () {
      if (suppressNextClick) { suppressNextClick = false; return; }
      selectedPersonId = (selectedPersonId === id) ? null : id;
      renderSelectedPanel();
    });

    if (!isClient) {
      attachNodeDrag(group, svgEl, person, m, x, y, clientPos, function (didDrag) {
        suppressNextClick = didDrag;
      });
    }

    svgEl.appendChild(group);
  }

  // Lets a person's node be dragged to a manually-nudged position when
  // the automatic layout still puts a line too close to (or through)
  // another node. During the drag, only this node's <g> transform and its
  // own connector path(s) are touched directly (not a full re-render,
  // which would tear down the very element being dragged and break the
  // gesture); the real position is committed to state and a full re-render
  // happens once, on release.
  function attachNodeDrag(group, svgEl, person, m, baseX, baseY, clientPos, onDragEnd) {
    var ratings = ratingsFor(person, m);
    var quality = gbQuality(ratings.quality);
    var weight = lineWeightForCloseness(ratings.closeness);
    var dragging = false, moved = false;
    var startSvg = null, baseOffset = { dx: 0, dy: 0 };

    function toSvgPoint(evt) {
      var ctm = svgEl.getScreenCTM();
      if (!ctm) return { x: evt.clientX, y: evt.clientY };
      var pt = svgEl.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      var svgP = pt.matrixTransform(ctm.inverse());
      return { x: svgP.x, y: svgP.y };
    }

    function updateConnector(nx, ny) {
      var segs = connectorPaths(clientPos, { x: nx, y: ny }, quality.lineStyle);
      var els = svgEl.querySelectorAll('.gb-connector[data-person-id="' + person.id + '"]');
      segs.forEach(function (seg, i) {
        if (els[i]) els[i].setAttribute("d", seg.d);
      });
    }

    group.addEventListener("pointerdown", function (evt) {
      if (evt.button !== undefined && evt.button !== 0) return;
      dragging = true; moved = false;
      baseOffset = ratings.offset || { dx: 0, dy: 0 };
      startSvg = toSvgPoint(evt);
      try { group.setPointerCapture(evt.pointerId); } catch (e) {}
    });

    group.addEventListener("pointermove", function (evt) {
      if (!dragging) return;
      var p = toSvgPoint(evt);
      var liveDx = p.x - startSvg.x, liveDy = p.y - startSvg.y;
      if (!moved && Math.hypot(liveDx, liveDy) > 3) {
        moved = true;
        group.classList.add("gb-node-dragging");
      }
      if (!moved) return;
      group.setAttribute("transform", "translate(" + liveDx + "," + liveDy + ")");
      updateConnector(baseX + liveDx, baseY + liveDy);
    });

    function finish(evt) {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        var p = toSvgPoint(evt);
        var liveDx = p.x - startSvg.x, liveDy = p.y - startSvg.y;
        ratings.offset = { dx: baseOffset.dx + liveDx, dy: baseOffset.dy + liveDy };
        group.classList.remove("gb-node-dragging");
        onDragEnd(true);
        renderMap();
        updatePrintSheet();
      }
      try { group.releasePointerCapture(evt.pointerId); } catch (e) {}
    }
    group.addEventListener("pointerup", finish);
    group.addEventListener("pointercancel", finish);
  }

  function buildGenogramSVG(svgEl, m) {
    svgEl.innerHTML = "";
    svgEl.setAttribute("viewBox", "0 0 " + CHART_W + " " + CHART_H);
    var layout = computeLayout(m);
    var positions = layout.positions;

    // Generation row gridlines, labeled, for orientation.
    var generationsUsed = [];
    state.people.forEach(function (p) { if (generationsUsed.indexOf(p.generation) === -1) generationsUsed.push(p.generation); });
    if (generationsUsed.indexOf(0) === -1) generationsUsed.push(0);
    generationsUsed.forEach(function (gen) {
      var y = layout.centerY + gen * layout.rowHeight;
      var line = document.createElementNS(NS, "line");
      line.setAttribute("x1", 20); line.setAttribute("x2", CHART_W - 20);
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("class", "gb-gen-row-line");
      svgEl.appendChild(line);
      var label = document.createElementNS(NS, "text");
      label.setAttribute("x", 26);
      label.setAttribute("y", y - 8);
      label.setAttribute("class", "gb-gen-row-label");
      label.textContent = generationLabel(gen);
      svgEl.appendChild(label);
    });

    // Connectors, drawn before nodes so nodes sit on top of the line ends.
    state.people.forEach(function (person) {
      var ratings = ratingsFor(person, m);
      var quality = gbQuality(ratings.quality);
      var p0 = positions[GB_CLIENT_ID];
      var p1 = positions[person.id];
      var weight = lineWeightForCloseness(ratings.closeness);
      connectorPaths(p0, p1, quality.lineStyle).forEach(function (seg) {
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", seg.d);
        path.setAttribute("class", "gb-connector");
        path.setAttribute("data-person-id", person.id);
        path.setAttribute("stroke", quality.color);
        path.setAttribute("stroke-width", seg.isCrossMark ? Math.max(2, weight - 1) : weight);
        if (seg.dash) path.setAttribute("stroke-dasharray", seg.dash);
        svgEl.appendChild(path);
      });
    });

    buildNode(svgEl, GB_CLIENT_ID, positions[GB_CLIENT_ID].x, positions[GB_CLIENT_ID].y, null, true, m);
    state.people.forEach(function (person) {
      var pos = positions[person.id];
      buildNode(svgEl, person.id, pos.x, pos.y, person, false, m, positions[GB_CLIENT_ID]);
    });
  }

  function renderMap() {
    var hasPeople = state.people.length >= GB_MIN_PEOPLE_FOR_CHART;
    $("gb-empty-message").hidden = hasPeople;
    $("gb-map-area").hidden = !hasPeople;
    if (!hasPeople) { renderSelectedPanel(); return; }

    $("gb-map-single").hidden = sideBySide;
    $("gb-map-pair").hidden = !sideBySide;

    if (sideBySide) {
      buildGenogramSVG($("gb-chart-current"), "current");
      buildGenogramSVG($("gb-chart-ideal"), "ideal");
    } else {
      buildGenogramSVG($("gb-chart"), mode);
    }
    renderSelectedPanel();
  }

  function renderSelectedPanel() {
    var panel = $("gb-selected-panel");
    var person = state.people.filter(function (p) { return p.id === selectedPersonId; })[0];
    if (!person) { panel.hidden = true; return; }
    panel.hidden = false;
    $("gb-selected-name").textContent = person.name || "Unnamed person";
    var notesCurrent = person.current.notes.trim();
    var notesIdeal = person.ideal.notes.trim();
    var lines = [];
    if (notesCurrent) lines.push("Current: " + notesCurrent);
    if (notesIdeal) lines.push("Ideal: " + notesIdeal);
    $("gb-selected-notes").textContent = lines.length ? lines.join("  —  ") : GB_COPY.map.selectedPersonNotesEmpty;
  }

  $("gb-side-by-side-toggle").addEventListener("change", function () {
    sideBySide = this.checked;
    renderMap();
  });

  $("gb-reset-positions-btn").addEventListener("click", function () {
    state.people.forEach(function (person) {
      person.current.offset = null;
      person.ideal.offset = null;
    });
    renderMap();
    updatePrintSheet();
  });

  /* ---------------------------------------------------------------------
   * EXAMPLE + RESET
   * ------------------------------------------------------------------- */

  $("gb-load-example-btn").addEventListener("click", function () {
    personCounter = 0;
    state = {
      client: { name: GB_EXAMPLE.client.name, gender: GB_EXAMPLE.client.gender },
      people: GB_EXAMPLE.people.map(function (p) {
        var person = newPerson(p.name, p.gender, p.generation);
        person.relationship = p.relationship || "";
        person.lifeStatus = p.lifeStatus;
        person.current = { closeness: p.current.closeness, influence: p.current.influence, quality: p.current.quality, notes: p.current.notes, offset: null };
        person.ideal = { closeness: p.ideal.closeness, influence: p.ideal.influence, quality: p.ideal.quality, notes: p.ideal.notes, offset: null };
        return person;
      }),
      reflections: blankReflections()
    };
    selectedPersonId = null;
    renderAll();
  });

  function startOver() {
    state = defaultState();
    selectedPersonId = null;
    mode = "current";
    sideBySide = false;
    $("gb-side-by-side-toggle").checked = false;
    renderAll();
    var heading = $("gb-people-heading");
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: false }); }
  }
  $("gb-reset-btn").addEventListener("click", startOver);
  $("gb-start-new-btn").addEventListener("click", startOver);

  /* ---------------------------------------------------------------------
   * PRINT SHEET -- always shows both Current and Ideal, regardless of
   * which one is active on screen, so the printed copy is the complete
   * record.
   * ------------------------------------------------------------------- */

  function updatePrintSheet() {
    $("gb-print-crisis").textContent = GB_CRISIS_LINE;
    $("gb-print-disclaimer").textContent = GB_STANDING_DISCLAIMER;

    if (state.people.length >= GB_MIN_PEOPLE_FOR_CHART) {
      ["current", "ideal"].forEach(function (m) {
        var holder = $("gb-print-chart-" + m);
        holder.innerHTML = "";
        var svg = document.createElementNS(NS, "svg");
        buildGenogramSVG(svg, m);
        holder.appendChild(svg);
      });
    }

    var peopleHolder = $("gb-print-people");
    peopleHolder.innerHTML = "";
    var heading = document.createElement("p");
    heading.innerHTML = "<strong>" + (state.client.name || "You") + "</strong> and " + state.people.length + " " + (state.people.length === 1 ? "relationship" : "relationships") + ":";
    peopleHolder.appendChild(heading);
    var ul = document.createElement("ul");
    state.people.forEach(function (p) {
      var li = document.createElement("li");
      li.textContent = (p.name || "Unnamed") + (p.relationship ? " (" + p.relationship + ")" : "") + " — " + generationLabel(p.generation) + ", " + (p.lifeStatus === "deceased" ? "deceased" : "living") + " — " +
        "Current: " + gbQuality(p.current.quality).label + ", closeness " + p.current.closeness + "/5, influence " + p.current.influence + "/5" +
        (p.current.notes ? " (" + p.current.notes + ")" : "") + ". " +
        "Ideal: " + gbQuality(p.ideal.quality).label + ", closeness " + p.ideal.closeness + "/5, influence " + p.ideal.influence + "/5" +
        (p.ideal.notes ? " (" + p.ideal.notes + ")" : "") + ".";
      ul.appendChild(li);
    });
    peopleHolder.appendChild(ul);

    var reflectionsHolder = $("gb-print-reflections");
    reflectionsHolder.innerHTML = "";
    var reflectionsHeading = document.createElement("p");
    reflectionsHeading.innerHTML = "<strong>Reflections</strong>";
    reflectionsHolder.appendChild(reflectionsHeading);
    GB_REFLECTION_QUESTIONS.forEach(function (q, i) {
      var block = document.createElement("p");
      var question = document.createElement("em");
      question.textContent = q;
      block.appendChild(question);
      block.appendChild(document.createElement("br"));
      var answer = (state.reflections[i] || "").trim();
      if (answer) {
        answer.split("\n").forEach(function (line, lineIdx) {
          if (lineIdx > 0) block.appendChild(document.createElement("br"));
          block.appendChild(document.createTextNode(line));
        });
      } else {
        block.appendChild(document.createTextNode("(No response)"));
      }
      reflectionsHolder.appendChild(block);
    });
  }

  $("gb-save-copy-btn").addEventListener("click", function () {
    window.print();
  });

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */

  function renderAll() {
    renderClientFields();
    renderPeopleList();
    renderRatingsList();
    renderReflectionList();
    renderMap();
    updatePrintSheet();
  }

  renderStaticCopy();
  state = defaultState();
  renderAll();
})();
