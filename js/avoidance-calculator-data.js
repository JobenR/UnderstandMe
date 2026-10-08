/* Avoidance Cost Calculator — domain list, bucket definitions, and every
   user-facing copy string, centralized. Nothing in js/avoidance-calculator.js
   should hard-code a string that belongs here. */

var AC_DOMAINS = [
  { id: "social", label: "Social gatherings" },
  { id: "restrooms", label: "Public restrooms" },
  { id: "flying", label: "Air travel" },
  { id: "driving", label: "Driving, or certain roads and routes" },
  { id: "errands", label: "Running errands or being out in public" },
  { id: "medical", label: "Medical or dental appointments" },
  { id: "work", label: "Work situations — meetings, calls, presentations" },
  { id: "dating", label: "Dating or physical closeness" },
  { id: "eating", label: "Eating in front of other people" },
  { id: "speaking", label: "Speaking in front of a group" },
  { id: "alone", label: "Being alone" },
  { id: "conflict", label: "Difficult conversations or confrontation" },
  { id: "phone", label: "Phone calls" },
  { id: "financial", label: "Financial tasks — bills, banking, taxes" },
  { id: "sensations", label: "Physical sensations — exercise, caffeine, a racing heart" }
];

// label -> hidden numeric value used in the arithmetic; the visitor never sees the numbers.
var AC_FREQUENCY_BUCKETS = [
  { label: "Rarely", value: 1 },
  { label: "A few times a month", value: 3 },
  { label: "About weekly", value: 4 },
  { label: "Several times a week", value: 12 },
  { label: "Most days", value: 24 },
  { label: "Multiple times a day", value: 60 }
];

var AC_DURATION_BUCKETS = [
  { label: "About a year", value: 1 },
  { label: "A few years", value: 3 },
  { label: "About five years", value: 5 },
  { label: "Ten years or so", value: 10 },
  { label: "Fifteen years or more", value: 15 },
  { label: "As long as I can remember", value: 20 }
];

// Spec: "Duration values are expressed in natural language where they appear
// in copy -- 'the five years you've described,' not '5 years.'" Only these
// six values are ever produced (duration is bucket-selected), so a fixed
// word map covers every case exactly.
var AC_DURATION_WORDS = {
  1: "one",
  3: "three",
  5: "five",
  10: "ten",
  15: "fifteen",
  20: "twenty"
};

var AC_OPPORTUNITY_ITEMS = [
  { id: "invitation", label: "Turned down an invitation" },
  { id: "trip", label: "Skipped a trip or vacation" },
  { id: "job", label: "Didn't apply for a job, promotion, or role" },
  { id: "appointment", label: "Put off a medical, dental, or mental health appointment" },
  { id: "relationship", label: "Didn't pursue a relationship, or let one fade" },
  { id: "leftJob", label: "Left or changed a job because of it" },
  { id: "livedAround", label: "Chose where to live, or stayed somewhere, around it" },
  { id: "familyEvent", label: "Missed a family event or milestone" },
  { id: "conversation", label: "Avoided a conversation you needed to have" },
  { id: "spokeUp", label: "Didn't speak up for yourself — at work, at home, or somewhere else" },
  { id: "billsTasks", label: "Let a bill, task, or errand pile up longer than it should have" },
  { id: "hobby", label: "Skipped exercise, a hobby, or something you used to enjoy" },
  { id: "support", label: "Put off getting support for this sooner" }
];

// Shown under the time slider. items are short, single phrases -- no
// label/detail split needed since each is already scannable on its own.
var AC_TIME_HELPER = {
  intro: "Think about one typical occurrence, start to finish — not the whole month. Add up:",
  items: [
    "Planning or preparing beforehand",
    "Checking, scouting, or double-checking",
    "Any extra travel",
    "Worrying in the lead-up",
    "Time to settle afterward once it's over"
  ]
};

// Shown under the money input. items are {label, detail} so the category
// name can render bold with its examples following, and outro carries the
// "how to average an irregular cost" guidance -- the actual math skill this
// question needs from the reader.
var AC_MONEY_HELPER = {
  intro: "Money spent to make this manageable adds up in different ways. Common categories:",
  items: [
    { label: "Transportation", detail: "rideshares, extra fuel, parking, choosing a farther option to avoid something closer, or a taxi instead of a crowded bus or train" },
    { label: "Paying someone else to do it for you", detail: "grocery or food delivery instead of going yourself, hiring a cleaner because the mess feels too big to face, or asking someone else to make a call you didn't want to make" },
    { label: "Fees from avoiding it", detail: "late fees, cancellation charges, lost deposits, overdraft or interest charges, or a library fine" },
    { label: "Paying more to skip discomfort", detail: "a pricier direct flight, a private appointment, upgraded service to avoid a wait or a crowd, or takeout instead of cooking because the grocery store felt like too much" },
    { label: "Redoing or replacing something", detail: "rewashing a load of laundry left in the machine too long, remaking food that spoiled while you put off dealing with it, or replacing something that got damaged because it sat too long" }
  ],
  outro: "If it doesn't happen every month, average it out: something that costs $30 and happens about every other month works out to roughly $15 a month. Leave it at zero if nothing comes to mind."
};

var AC_STANDING_DISCLAIMER =
  "This is an educational reflection tool, not a psychological assessment. It doesn't diagnose anything, it isn't treatment, and using it doesn't create a therapist–client relationship.";

var AC_CRISIS_LINE =
  "If you're in crisis or thinking about harming yourself, call or text 988 — the Suicide & Crisis Lifeline, available 24/7 in the US.";

var AC_COPY = {
  opening: {
    heading: "What is avoidance costing you?",
    body: [
      "Avoiding something that makes you anxious works. In the short term, the relief is real. What's harder to see is the running total — the time spent planning around it, the money spent working around it, the things quietly crossed off the list.",
      "Budget about a minute for each area you pick — most people finish in five to ten minutes. There are no right answers and nothing is being measured. You're just adding up what's already happening.",
      "Nothing you enter is saved or sent anywhere. It lives in this browser tab and disappears when you close it."
    ],
    action: "Start"
  },
  domainSelect: {
    heading: "What do you find yourself avoiding, or planning around?",
    helper: "Pick as many as apply. You can add your own at the bottom.",
    // PLACEHOLDER -- not specified verbatim in the spec. The spec describes
    // the *behavior* ("a free-text field lets the visitor name something not
    // listed" / "if they try to continue with none selected, say so gently")
    // but doesn't give exact wording for these three strings. Using a plain,
    // minimal default so the tool is functional; flagged for sign-off before
    // this is considered final copy.
    addOwnLabel: "Something else",
    addOwnPlaceholder: "Name it here",
    addOwnButton: "Add",
    noneSelectedNotice: "Pick at least one area to continue.",
    action: "Continue"
  },
  domainLoop: {
    // No {area} placeholder in any of these -- the specific domain is shown
    // as its own badge above the question instead of grammatically embedded,
    // since most domain labels are plural noun phrases ("Phone calls") that
    // don't agree with a fixed "does X come up" sentence.
    frequencyHeading: "In a typical month, how often does this come up?",
    timeHeading: "When it comes up, how much time does it take, start to finish?",
    moneyHeading: "In a typical month, what does working around this cost you?"
  },
  opportunities: {
    heading: "Has avoidance ever led to any of these?",
    helper: "Check anything that's true. These don't get turned into numbers — some costs shouldn't be.",
    action: "Continue"
  },
  duration: {
    heading: "Roughly how long has this been part of your life?",
    action: "Continue"
  },
  review: {
    heading: "Here's what you entered.",
    highTotalNotice: "That adds up to more than eight hours a day. For some people that's genuinely accurate — but it's worth a second look before we total it up.",
    action: "Add it up"
  },
  total: {
    // {annualHours} etc. are placeholders filled in by avoidance-calculator.js.
    // Count-dependent nouns ({wakingDaysUnit}, {workWeeksUnit}, {yearsUnit},
    // {weeksUnit}, {areaUnit}, {thingUnit}) are also filled in there, via a
    // pluralize() helper, so "1 weeks" / "1 areas" etc. can't happen.
    primaryLine: "In a typical year, this adds up to about {annualHours} hours.",
    secondaryLine: "That's about {wakingDays} {wakingDaysUnit}, or {workWeeks} {workWeeksUnit}.",
    retrospectiveLine: "Over the {years} {yearsUnit} you've described, roughly {weeksOfWakingLife} {weeksUnit} of waking life.",
    moneyLine: "You estimated about ${annualCost} a year in direct costs — around ${tenYearCost} over ten years.",
    lifeRadiusLine: "You named {domainCount} {areaUnit}, and {opportunityCount} {thingUnit} you've turned down.",
    largestPieceLine: "The biggest single piece is {topDomainLabel}, at about {topDomainAnnualHours} hours a year.",
    valueToggleLabel: "See what that time might be worth in dollars",
    hourlyRateHelper: "Use whatever feels meaningful: your actual hourly wage, your yearly salary divided by about 2,080 (a typical full-time work-year), or simply your best guess at what your time is worth to you. There's no right number.",
    timeValueLine: "At ${rate} an hour, that time would be worth about ${value} a year. This is a hypothetical comparison, not money you've actually spent — kept separate from the direct dollar costs above.",
    closingNote: "These are estimates built from what you entered, projected forward assuming nothing changes. They're a rough order of magnitude, not a measurement.",
    action: "What's next"
  },
  reframe: {
    heading: "This is a baseline, not a verdict.",
    body: [
      "The number is large because avoidance is good at hiding. Each individual instance is small and sensible — a detour, a decline, a bit of extra planning. It's only the total that's startling, and you've probably never had the total before.",
      "Nothing here says anything about your character or your willpower. Avoidance is what anxiety does; it isn't a personal failing. It's also one of the most changeable things in mental health — the evidence on that is unusually strong.",
      "You don't have to take on all of it. Working on {topDomainLabel} alone would give back roughly {topDomainAnnualHours} hours a year."
    ],
    action: "What's next"
  },
  nextStep: {
    heading: "Where to take this",
    // Each option is its own clickable card (its title is the action), so no
    // separate button-label string is needed.
    saveCopy: {
      title: "Save a copy"
    },
    bringToTherapist: {
      title: "Bring it to a therapist"
    }
  },
  discussionQuestions: [
    "Which of these areas has cost you the most — and which would you most want back?",
    "What has avoiding this protected you from? What has it taken in exchange?",
    "If one of these got easier, which would change your life the most?",
    "What's made this hard to change before now?"
  ],
  print: {
    questionsHeading: "Questions worth sitting with"
  }
};
