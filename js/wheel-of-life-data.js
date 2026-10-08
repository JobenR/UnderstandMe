/* Wheel of Life — domain list and every user-facing copy string, centralized.
   Nothing in js/wheel-of-life.js should hard-code a string that belongs here. */

var WOL_DOMAINS = [
  { id: "physical", label: "Physical health", prompt: "Energy, sleep, movement, body" },
  { id: "emotional", label: "Emotional well-being", prompt: "Mood, stress, inner life" },
  { id: "career", label: "Career / work", prompt: "Meaning, workload, trajectory" },
  { id: "finances", label: "Finances", prompt: "Security, stress, freedom" },
  { id: "romantic", label: "Romantic / partner", prompt: "Intimacy, connection, conflict" },
  { id: "family", label: "Family & friends", prompt: "Belonging, support, obligations" },
  { id: "growth", label: "Personal growth", prompt: "Learning, purpose, creativity" },
  { id: "fun", label: "Fun & recreation", prompt: "Play, rest, enjoyment" }
];

var WOL_OPTIONAL_DOMAINS = [
  { id: "spirituality", label: "Spirituality", prompt: "Faith, meaning, practice" },
  { id: "environment", label: "Environment / home", prompt: "Your space, comfort, order" },
  { id: "community", label: "Community", prompt: "Belonging beyond family, contribution" },
  { id: "parenting", label: "Parenting", prompt: "Role as a parent, connection with kids" }
];

var WOL_MIN_DOMAINS = 6;
var WOL_MAX_DOMAINS = 10;

var WOL_DEBRIEF_QUESTIONS = [
  "What do you notice when you look at the whole picture?",
  "Which score surprised you, higher or lower than expected?",
  "Which domain is highest? What's contributing to it, and can any of that transfer?",
  "Which domain, if it moved up two points, would lift other areas?",
  "Where is a low score a problem versus an intentional trade-off (e.g., low fun during a demanding season)?",
  "What would a 1-point increase look like, concretely and in the next two weeks?",
  "Which domains seem to be in tension with each other?"
];

var WOL_IMPORTANCE_QUESTION =
  "Where is satisfaction lowest relative to importance?";

var WOL_STANDING_DISCLAIMER =
  "This is an educational self-assessment, not a psychological assessment. It doesn't diagnose anything, it isn't treatment, and using it doesn't create a therapist–client relationship.";

var WOL_CRISIS_LINE =
  "If you're in crisis or thinking about harming yourself, call or text 988 — the Suicide & Crisis Lifeline, available 24/7 in the US.";

var WOL_COPY = {
  opening: {
    heading: "Wheel of Life",
    attribution: "Commonly attributed to Paul J. Meyer's work in the goal-setting and coaching tradition. It is distinct from the Tibetan Buddhist “Wheel of Life” (bhavachakra).",
    body: [
      "This is a self-assessment that maps your satisfaction across major life domains on a circular chart. The shape of the filled-in wheel shows where you feel full and where you feel depleted, and it gives you a concrete anchor for goal-setting.",
      "Rate each area from 0 (empty) to 10 (completely full) based on how satisfied you feel right now — not how you think it should be. There are no right answers.",
      "You can rename any domain, add one of the optional areas below, or remove one you don't need. Nothing you enter is saved or sent anywhere; it lives in this browser tab and disappears when you close it."
    ],
    meta: {
      bestFor: "Intake or early sessions, values clarification, goal-setting, transitions, burnout or “stuck” conversations.",
      time: "10–15 minutes, including debrief."
    }
  },
  scale: {
    heading: "Rate each area",
    helper: "0 means completely empty or depleted in that area. 10 means completely full or satisfied. Drag each slider to where it feels true right now.",
    addDomainLabel: "Add a domain",
    removeLabel: "Remove",
    minNotice: "A wheel needs at least " + WOL_MIN_DOMAINS + " areas to stay meaningful.",
    maxNotice: "That's enough areas for one wheel — up to " + WOL_MAX_DOMAINS + " at a time keeps it readable.",
    importanceToggleLabel: "Also rate how important each area is to you right now",
    importanceHelper: "Importance and satisfaction are different questions. An area can score low on satisfaction without being a priority — the gap between the two is often more useful than either number alone.",
    importanceSliderLabel: "Importance"
  },
  chart: {
    heading: "Your wheel"
  },
  debrief: {
    heading: "Questions to sit with",
    helper: "Go through these on your own, or talk them through with your therapist. There's no need to answer all of them.",
    importanceAddOn: "(For the importance gap) " + WOL_IMPORTANCE_QUESTION,
    gapInsightTemplate: "Based on what you entered, {domain} has the largest gap between how important it is to you and how satisfied you feel there."
  },
  actions: {
    saveCopy: "Save a copy",
    seeWheel: "See my wheel",
    editAnswers: "← Edit my answers"
  }
};
