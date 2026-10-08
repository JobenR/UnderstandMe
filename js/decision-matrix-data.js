/* Weigh Your Options — starter content and every user-facing copy string,
   centralized. Nothing in js/decision-matrix.js should hard-code a string
   that belongs here. */

var DM_MIN_OPTIONS = 2;
var DM_MAX_OPTIONS = 6;
var DM_MIN_CRITERIA = 2;
var DM_MAX_CRITERIA = 8;
var DM_SCORE_MIN = 1;
var DM_SCORE_MAX = 5;
var DM_IMPORTANCE_MIN = 1;
var DM_IMPORTANCE_MAX = 5;
var DM_DEFAULT_IMPORTANCE = 3;
var DM_TIE_MARGIN_PCT = 3; // percentage points

var DM_SCALE_ANCHORS = [
  { value: 5, label: "Excellent: fully meets what I want" },
  { value: 4, label: "Good" },
  { value: 3, label: "Okay: acceptable" },
  { value: 2, label: "Weak" },
  { value: 1, label: "Poor: doesn't meet what I want" }
];

var DM_IMPORTANCE_ANCHORS = [
  { value: 5, label: "Essential" },
  { value: 4, label: "Very important" },
  { value: 3, label: "Important" },
  { value: 2, label: "Somewhat important" },
  { value: 1, label: "Nice to have" }
];

// Tuned (by searching against the real scoring logic, not hand-calculated)
// so the result is genuinely close -- New offer wins 70% to 65% -- and the
// sensitivity check actually finds a flip: nudging Time with family from
// "Important" to "Very important" ties the two options exactly, which
// swings first place to Stay under the site's stable sort. That's what
// the "How solid is this result?" check is supposed to catch.
var DM_EXAMPLE = {
  decision: "Should I take the new job offer?",
  options: ["Stay in my current job", "Take the new offer"],
  criteria: [
    { label: "Pay", importance: 3, scores: [2, 4] },
    { label: "Time with family", importance: 3, scores: [5, 2] },
    { label: "Room to grow", importance: 3, scores: [2, 5] },
    { label: "Stability", importance: 3, scores: [4, 3] }
  ]
};

var DM_PITFALLS = [
  { pitfall: "Scoring a factor backwards (e.g., a “cost” factor where 5 means expensive)", fix: "Name every factor as something you want more of, so a higher score always means better" },
  { pitfall: "Setting importance after you've already seen how the options score", fix: "Rate importance first, before scoring any option" },
  { pitfall: "Two factors that really mean the same thing", fix: "Merge or remove the overlap so it isn't counted twice" },
  { pitfall: "Treating a close match (e.g., 72% vs 71%) as a clear win", fix: "Round, and use the sensitivity check instead" },
  { pitfall: "Ignoring a gut reaction that disagrees with the result", fix: "Use that mismatch to find a missing or underrated factor" }
];

var DM_STANDING_DISCLAIMER =
  "This is an educational self-help tool. It is not professional, legal, medical, or financial advice, and using it doesn't create a therapist–client relationship.";

var DM_CRISIS_LINE =
  "If you're in crisis or thinking about harming yourself, call or text 988, the Suicide & Crisis Lifeline, available 24/7 in the US.";

var DM_COPY = {
  opening: {
    heading: "Weigh Your Options",
    tagline: "A step-by-step way to compare hard choices and see what actually matters most to you.",
    body: [
      "When you're stuck between a few choices that all seem reasonable, it's easy to go with whatever feels most familiar, or to keep going back and forth. This tool slows the decision down. You'll name what matters to you, rate how important each thing is, and score each option. The tool then does the math and shows you which option fits your priorities best, and why.",
    ],
    goodFor: "Good for: a job offer, where to live, which program or school, whether to make a big change, or any choice where several things pull in different directions.",
    notNeededIf: "Probably not needed if: one option is clearly better, or one thing rules the others out, such as “we can't go over this budget.”",
    howItWorksHeading: "How it works",
    howItWorks: [
      "List your choices and what matters to you.",
      "Rate each choice on each thing that matters.",
      "See which choice fits best, then check whether it feels right."
    ]
  },
  setup: {
    stepLabel: "Step 1",
    heading: "Set up your decision",
    decisionLabel: "What are you trying to decide?",
    decisionPlaceholder: "e.g., Should I take the new job offer?",
    optionsLabel: "Your options",
    optionsInstruction: "List the choices you're considering. Two to four is easiest; up to six works.",
    optionNamePlaceholders: ["Stay in my current job", "Take the new offer"],
    addOptionLabel: "+ Add option",
    optionsMinNotice: "A comparison needs at least " + DM_MIN_OPTIONS + " options.",
    optionsMaxNotice: "Up to " + DM_MAX_OPTIONS + " options keeps this readable — past that, consider screening some out first.",
    dealbreakerLabel: "Not possible for me",
    dealbreakerHelper: "Check this if an option fails something you absolutely can't compromise on, such as being too far to move or over your budget. It stays on the list but won't be scored.",
    criteriaLabel: "What matters to you?",
    criteriaInstruction: "List the things that matter in this decision. Three to six is usually enough.",
    criterionNamePlaceholders: ["Pay", "Time with family", "Room to grow"],
    criteriaTip: "Name each one as something you want more of. “Short commute” works better than “Commute,” and “Affordable” works better than “Cost.” That way a higher score always means better. If a factor only makes sense the other way, flip it with the “lower is better” switch next to it instead of renaming it.",
    importanceHeading: "How important is each one?",
    importanceInstruction: "Rate each from 1 to 5. Decide this before scoring your options. If you wait until afterward, it's easy to tilt the importance toward the option you already prefer.",
    addCriterionLabel: "+ Add factor",
    criteriaMinNotice: "Add at least " + DM_MIN_CRITERIA + " things that matter.",
    criteriaMaxNotice: "Past " + DM_MAX_CRITERIA + ", this gets hard to weigh meaningfully.",
    lowerIsBetterLabel: "Lower is better",
    weightSummaryTemplate: "Right now, {items} of your decision.",
    weightSummaryJoiner: " and ",
    weightSummaryItemTemplate: "{label} counts for {pct}%",
    loadExampleLabel: "See an example",
    resetLabel: "Start over"
  },
  scoring: {
    stepLabel: "Step 2",
    heading: "Rate your options",
    helper: "Go through one factor at a time and rate every option on it before moving to the next factor. This keeps a strong first impression of one option from coloring every other rating.",
    scaleLabel: "Scale",
    progressTemplate: "You've rated {done} of {total}.",
    progressRemaining: " Finish rating to see your results.",
    progressComplete: " All rated — see your results below."
  },
  results: {
    stepLabel: "Step 3",
    heading: "Your results",
    bestFitTemplate: "Best fit: {option}, a {pct}% match with your priorities",
    otherOptionTemplate: "{option}: {pct}%",
    excludedTemplate: "{option}: not scored (not possible for you)",
    whyHeading: "Why it came out this way",
    whyTemplate: "{winner} scored highest on {factors}, {factorsLabel} of your most important factors. {runnerUp} was stronger on {runnerUpFactor}, but not by enough to close the gap.",
    whySingleFactorLabel: "one",
    whyTwoFactorLabel: "two",
    whyNoContrastTemplate: "{winner} scored higher across most of what matters to you, without a single factor {runnerUp} could really compete on.",
    solidityHeading: "How solid is this result?",
    solidLabel: "Solid",
    solidMessage: "Small changes to your importance ratings don't change the winner.",
    cautionLabel: "Close call",
    cautionTemplate: "If {factor} were rated one point {direction}, {newWinner} would come out ahead. That's the real question in this decision: how much does {factorLower} matter compared with {anchorFactorLower} right now?",
    tieMessage: "These two are essentially tied. The numbers can't decide this one for you, and that's useful to know. Look at the questions below, or think about something the list didn't capture.",
    singleOptionMessage: "Only one scoreable option is left — add another to compare, or this is your answer by default."
  },
  beforeYouDecide: {
    heading: "Before you decide",
    feelingHeading: "How did the result feel?",
    feelingIntro: "Notice your first reaction when you saw the top choice.",
    feelingGood: "Relief or excitement? That's often a sign the result matches what you value.",
    feelingBad: "Disappointment, or an urge to change the numbers? That's useful too. It usually means something important is missing from your list, or one rating doesn't reflect how much it really matters to you. Go back and add it, then see what changes.",
    tryHeading: "Try changing one thing.",
    tryBody: "Raise or lower the importance of a factor you're unsure about and watch the results. If the winner flips easily, the decision comes down to that one trade-off.",
    valuesHeading: "Check it against your values.",
    valuesBody: "Which option moves you toward the kind of life you want to live, even if it's harder in the short term?",
    valuesLinkText: "Not sure what your core values are? The Values Card Sort exercise is coming soon."
  },
  reference: {
    pitfallsHeading: "Common pitfalls"
  },
  actions: {
    saveCopy: "Save a copy",
    startNewDecision: "Start a new decision"
  }
};
