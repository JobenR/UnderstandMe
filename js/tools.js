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

/* Groups for the home page index and the Exercises menu. */
var UM_GROUPS = [
  { id: "see", title: "See where you are", tools: ["values-sort", "wheel-of-life", "genogram"] },
  { id: "move", title: "Move through what is hard", tools: ["avoidance-calculator", "step-builder", "decision-matrix"] },
  { id: "keep", title: "Keep it going", tools: ["week-builder"] },
  { id: "room", title: "In the room (clinicians)", tools: ["suds-tracker"] }
];

/* What to try after each exercise, and why. */
var UM_NEXT = {
  "values-sort": [
    { id: "step-builder", why: "Turn what matters into one small first step." },
    { id: "wheel-of-life", why: "See how those values show up across your life." }
  ],
  "avoidance-calculator": [
    { id: "step-builder", why: "Break the avoided thing into a step small enough to try." },
    { id: "values-sort", why: "Name what avoiding it is costing you." }
  ],
  "wheel-of-life": [
    { id: "values-sort", why: "Name what matters most in the areas that feel empty." },
    { id: "week-builder", why: "Schedule something for the area that feels lowest." }
  ],
  "decision-matrix": [
    { id: "values-sort", why: "Check your options against what you value." },
    { id: "step-builder", why: "Plan a first step toward the option you picked." }
  ],
  "genogram": [
    { id: "values-sort", why: "Clarify what you want your relationships to stand for." },
    { id: "wheel-of-life", why: "See how relationships sit among the rest of life." }
  ],
  "step-builder": [
    { id: "week-builder", why: "Put your first step on the calendar." },
    { id: "avoidance-calculator", why: "See what the avoidance has been costing." }
  ],
  "week-builder": [
    { id: "wheel-of-life", why: "Check how your week touches each area of life." },
    { id: "step-builder", why: "Break one activity down into a gentler first step." }
  ]
};

/* "What's on your mind?" on the home page. */
var UM_FINDER = [
  { label: "I am not sure what really matters to me", tool: "values-sort", then: "wheel-of-life",
    why: "Sorting a deck of values is the fastest way to put words to what you care about." },
  { label: "Life feels out of balance", tool: "wheel-of-life", then: "values-sort",
    why: "One picture of satisfaction across life areas shows where you feel full and where you feel depleted." },
  { label: "I keep avoiding something", tool: "avoidance-calculator", then: "step-builder",
    why: "Tallying the time and money avoidance takes makes its real cost visible." },
  { label: "I want to start something, but small", tool: "step-builder", then: "week-builder",
    why: "Break it into steps and find a first one small enough to actually try." },
  { label: "My mood or energy has been low", tool: "week-builder", then: "wheel-of-life",
    why: "Plan gentle activities, then notice how each one changes your mood." },
  { label: "I am facing a big decision", tool: "decision-matrix", then: "values-sort",
    why: "Weigh what matters, score each option, and let the math show what fits." },
  { label: "My relationships feel complicated", tool: "genogram", then: "values-sort",
    why: "Map the people in your life by closeness, then compare today with how you would like it to be." },
  { label: "I am a clinician running an exposure in session", tool: "suds-tracker", then: "step-builder",
    why: "A live stopwatch with timed distress check-ins and a chart across exposures." }
];
