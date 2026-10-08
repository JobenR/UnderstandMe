/* Catalog of the eight tools -- single source for the home page and the
   provider dashboard. Copy only; each tool's own text lives in its -data.js. */
var UM_TOOLS = [
  { id: "values-sort", file: "values-sort.html", icon: '<path d="M12 20.5s-7.5-4.6-9.2-9.3A5.2 5.2 0 0 1 12 8a5.2 5.2 0 0 1 9.2 3.2C19.5 15.9 12 20.5 12 20.5z"/>', name: "Values Card Sort", who: "Patient", time: "20–30 min",
    blurb: "Sort and rank-order a deck of values down to a core top 10, then reflect on how closely daily life matches each one." },
  { id: "avoidance-calculator", file: "avoidance-calculator.html", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', name: "Avoidance Cost Calculator", who: "Patient", time: "10 min",
    blurb: "Tally the time and money an anxiety trigger is costing, so the price of avoiding it becomes visible." },
  { id: "suds-tracker", file: "suds-tracker.html", icon: '<path d="M3 12h4l2.5-6.5L14 18l2.5-6H21"/>', name: "Exposure & SUDS Tracker", who: "Clinician-led", time: "In session",
    blurb: "An in-session stopwatch with timed distress (SUDS) check-ins and a habituation chart across exposures." },
  { id: "wheel-of-life", file: "wheel-of-life.html", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.800 12.800M18.4 5.6L5.6 18.4"/>', name: "Wheel of Life", who: "Patient", time: "10 min",
    blurb: "Rate satisfaction across life domains and see, in one picture, where you feel full and where you feel depleted." },
  { id: "decision-matrix", file: "decision-matrix.html", icon: '<path d="M12 3v18M6 21h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>', name: "Weigh Your Options", who: "Patient", time: "15 min",
    blurb: "A weighted decision matrix: list options, weight what matters, and see a calculated winner." },
  { id: "genogram", file: "genogram.html", icon: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5V13M12 13l-7 3.5M12 13l7 3.5"/>', name: "Genogram Builder", who: "Patient", time: "20 min",
    blurb: "Map the people in your life by closeness and relationship quality, with a Current map and an Ideal map side by side." },
  { id: "step-builder", file: "step-builder.html", icon: '<path d="M3 20h5v-5h5v-5h5V5h3"/>', name: "Step Builder", who: "Patient", time: "15 min",
    blurb: "Break an avoided task into graded steps, find a first step small enough to try, and log expected versus actual outcomes." },
  { id: "week-builder", file: "week-builder.html", icon: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', name: "Week Builder", who: "Patient", time: "20 min",
    blurb: "Behavioral activation: build an activity menu, schedule it into the week, and log mood before and after." }
];

/* SVG markup for a tool's line icon (24px grid, drawn with currentColor). */
function umToolIcon(tool) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + tool.icon + '</svg>';
}

function umToolById(id) {
  for (var i = 0; i < UM_TOOLS.length; i++) if (UM_TOOLS[i].id === id) return UM_TOOLS[i];
  return null;
}
