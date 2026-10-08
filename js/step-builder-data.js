/* Step Builder — encoding definitions, starter content, and every
   user-facing copy string, centralized. Nothing in js/step-builder.js
   should hard-code a string that belongs here. Every string here comes
   from the product spec; none of it is paraphrased. */

var SB_STANDING_DISCLAIMER =
  "This is an educational tool, not a psychological assessment or a treatment program. It doesn't diagnose anything, and using it doesn't create a therapist–client relationship. Practicing your way toward something you've been avoiding works best with a therapist's guidance, especially if what you're avoiding is connected to trauma, panic, or something that could put you at risk.";

var SB_CRISIS_LINE =
  "If you're in crisis or thinking about harming yourself, call or text 988 — the Suicide & Crisis Lifeline, available 24/7 in the US.";

var SB_STORAGE_OFFER_TEXT =
  "Want to keep this plan on this device? It stays in this browser, on this device only. It isn't sent anywhere, we can't see it, and it won't follow you to another computer or phone. You can delete it at any time.";

var SB_STORAGE_WHAT_IS_KEPT =
  "What's kept, if you say yes: your goal, your steps and their ratings, and your practice record — all of it stored only in this browser, on this device. Nothing is sent anywhere, ever. Deleting it is immediate and total.";


/* -------------------------------------------------------------------------
 * Rating anchors — 0–100 in steps of 5, used for difficulty/importance and
 * every other 0–100 slider in the tool.
 * ---------------------------------------------------------------------- */
var SB_DIFFICULTY_ANCHORS = [
  { value: 0, label: "No problem at all" },
  { value: 25, label: "Noticeable but fine" },
  { value: 50, label: "Difficult" },
  { value: 75, label: "Very hard" },
  { value: 100, label: "I can't imagine doing this" }
];

function sbNearestAnchorLabel(value, anchors) {
  var best = anchors[0], bestDist = Math.abs(value - anchors[0].value);
  anchors.forEach(function (a) {
    var d = Math.abs(value - a.value);
    if (d < bestDist) { best = a; bestDist = d; }
  });
  return best.label;
}

var SB_GAP_THRESHOLD = 20;

/* -------------------------------------------------------------------------
 * Screen 2 — The goal
 * ---------------------------------------------------------------------- */
var SB_GOAL_EXAMPLES = [
  "Use a public restroom when other people are around",
  "Fly without needing to plan around it for weeks",
  "Go to a party where I don't know many people",
  "Drive on the highway again",
  "Eat a meal in front of other people",
  "Give a presentation at work",
  "Go to a doctor's appointment without rescheduling it three times",
  "Be alone in the house in the evening",
  "Say no to someone without over-explaining"
];

/* -------------------------------------------------------------------------
 * Screen 3 — Generating situations: the variable prompts
 * ---------------------------------------------------------------------- */
var SB_VARIABLE_PROMPTS = [
  { id: "who", question: "Who's around?", options: ["alone", "one person I trust", "one stranger", "a few people", "a crowd", "someone specific"] },
  { id: "where", question: "Where?", options: ["home", "a friend's home", "work", "a familiar public place", "an unfamiliar public place", "somewhere far from home"] },
  { id: "howlong", question: "How long?", options: ["a few seconds", "a minute", "five minutes", "as long as it takes"] },
  { id: "when", question: "When?", options: ["planned days ahead", "planned that morning", "no warning"] },
  { id: "leave", question: "Can you leave?", options: ["I can leave any time", "I'd have to explain myself", "I'm committed once I start"] },
  { id: "state", question: "What state am I in?", options: ["rested and calm", "tired", "already stressed", "after caffeine"] },
  { id: "have", question: "What do I have?", options: ["my usual things that help", "without them"] }
];

var SB_SITUATIONS_MIN = 3;
var SB_SITUATIONS_SOFT_WARN = 25;
var SB_SITUATIONS_ENCOURAGE_AT = 6;

/* -------------------------------------------------------------------------
 * Screen 6 — Building a bridge step
 * ---------------------------------------------------------------------- */
var SB_BRIDGE_DURATIONS = ["a few seconds", "thirty seconds", "two minutes", "five minutes"];
var SB_BRIDGE_WHO_OPTIONS = ["alone", "one person you trust", "one stranger", "a few people", "a crowd"];
var SB_BRIDGE_LEAVE_OPTIONS = ["with an exit planned", "with someone who knows", "somewhere you could leave without explaining"];

/* -------------------------------------------------------------------------
 * After-practice branching
 * ---------------------------------------------------------------------- */
var SB_OUTCOME_OPTIONS = [
  { id: "yes", label: "Yes, all of it" },
  { id: "partly", label: "Part of it" },
  { id: "left", label: "I started and left" },
  { id: "no", label: "I didn't go" }
];

var SB_COMPARISON_OPTIONS = [
  { id: "worse", label: "Worse than I expected" },
  { id: "expected", label: "About what I expected" },
  { id: "better", label: "Better than I expected" },
  { id: "different", label: "Completely different" }
];

var SB_BARRIER_OPTIONS = [
  { id: "too_hard", label: "It felt too hard" },
  { id: "ran_out_of_time", label: "I ran out of time" },
  { id: "didnt_come_up", label: "The situation didn't come up" },
  { id: "changed_mind", label: "I changed my mind" },
  { id: "something_else", label: "Something else" }
];

/* -------------------------------------------------------------------------
 * All screen copy
 * ---------------------------------------------------------------------- */
var SB_COPY = {
  opening: {
    heading: "Build your steps",
    body: [
      "When something makes you anxious enough to avoid it, it tends to show up in your mind as one solid wall. All of it, all at once, impossible.",
      "It's almost never actually one thing. It's dozens of related situations, some much harder than others, and the hardest version is usually not where anyone should start.",
      "This helps you break it apart, put the pieces in order, and find a first step small enough that you'd actually do it. Then it keeps track of what happens as you work up.",
      "Fifteen minutes to set up. After that you'll come back to it briefly, each time you practice."
    ],
    declinedNote: "Last time, you chose not to keep a plan on this device, so if you leave this page partway through building, you'll need to start over. You can decide again once you've built it.",
    start: "Start"
  },
  goal: {
    heading: "What do you want to be able to do?",
    helper: "Something specific you've been avoiding or working around. One thing, for now — you can build another plan later.",
    placeholder: "Use a public restroom when there are other people around",
    examplesToggle: "Need an idea?",
    whyLabel: "Why does this matter to you?",
    whyHelper: "What it would change, or what it's costing you not to do it. Worth writing down — it's the part that's hardest to remember when a step feels hard.",
    continue: "Continue"
  },
  generate: {
    heading: "What are all the versions of this?",
    helper: "Not just the hardest one. Every related situation you can think of, including the ones that are only slightly uncomfortable. Easy ones matter most — that's where you'll start.",
    entryPlaceholder: "Describe a situation...",
    addLabel: "Add",
    promptsHeading: "Need more? Try changing one thing",
    countTemplate: "You've named {n} situations.",
    countTemplateOne: "You've named 1 situation.",
    encourageAtSix: "Worth pushing for a few more — especially easier ones. The most useful step is usually one that sounds almost too small.",
    softWarnPastTwentyFive: "That's a lot of situations — plans this size can get hard to work with. You might want to trim it down to the ones that matter most.",
    minNotice: "Add at least " + SB_SITUATIONS_MIN + " situations to continue.",
    continue: "Continue"
  },
  rate: {
    heading: "How hard does this feel right now?",
    importanceHeading: "How much would it matter to be able to do this?",
    importanceHelper: "Some things are hard and not especially important. Some are hard and would change your week. Worth separating.",
    fearedToggle: "What are you afraid would happen?",
    fearedHelper: "As specific as you can get. \"I'd be humiliated\" is harder to work with than \"I'd freeze, someone would notice, and they'd say something.\"",
    fearedPlaceholder: "What would happen...",
    continue: "Continue",
    next: "Next",
    back: "Back"
  },
  stack: {
    heading: "Here's your plan",
    addLabel: "+ Add a situation",
    editLabel: "Edit",
    deleteLabel: "Delete",
    tooBigLabel: "This one feels too big",
    moveUpLabel: "Move up",
    moveDownLabel: "Move down",
    gapTemplate: "That's a big jump — about {n} points. Big jumps are where plans usually stall. Want to build something in between?",
    gapAction: "Build a bridge step",
    deleteConfirmTemplate: "Delete \"{text}\"? {attemptsNote}This can't be undone.",
    deleteConfirmAttemptsNote: "You've logged {n} practice attempts on this one — they'll be deleted too. ",
    allHighPrompt: "Everything here is at the top. It's worth seeing whether there are smaller versions — try the \"make it smaller\" questions on your easiest one.",
    continue: "Continue"
  },
  bridge: {
    heading: "Make it smaller",
    intro: "Here's the step:",
    shortenLabel: "Shorten it",
    shortenPrompt: "What if you only did it for a moment?",
    leaveLabel: "Make it easier to leave",
    leavePrompt: "What if you could stop whenever you wanted?",
    whoLabel: "Change who's there",
    whoPrompt: "What if the people were different?",
    partLabel: "Do part of it",
    partPrompt: "What's the first piece, on its own?",
    partHelper: "Walking to the door and turning around counts. So does driving to the parking lot. The piece before the piece is still a step.",
    partPlaceholder: "The first piece, on its own...",
    rateNewStep: "How hard does this feel?",
    addToStack: "Add to your plan",
    stillBig: "Still a big jump? You can keep going — there's no step too small to count.",
    makeSmallerAgain: "Make this smaller too",
    done: "Done",
    noSituation: "Choose a step to make smaller first."
  },
  firstStep: {
    heading: "Where will you start?",
    suggestionTemplate: "Most people start lower than they think they should. This one's rated {rating} — hard enough to count, not so hard you'd put it off.",
    allManageable: "Everything here is fairly manageable, which is a good position to be in. Start at the bottom and work up — you may find the plan needs harder steps added once you're moving.",
    topStepWarning: "That's the hardest thing on your list. Some people do start there and it works. More often it ends up proving that the thing is impossible, which isn't what you're after. Up to you.",
    chooseLabel: "Start here",
    continue: "Done — start practicing"
  },
  storage: {
    heading: "One more thing",
    keepLabel: "Yes, keep it on this device",
    declineLabel: "No, don't save it",
    declineNote: "Everything still works for this session, and you can save a copy before you close the tab.",
    whatsKeptToggle: "What exactly gets kept?",
    continue: "Done — start practicing"
  },
  practiceHome: {
    heading: "Your next step",
    goingToTry: "I'm about to try this",
    alreadyDid: "I already did it",
    stackHeading: "Your plan",
    recordLink: "See your record",
    changeStep: "Practice a different step"
  },
  before: {
    heading: "Before you go",
    expectLabel: "What do you expect will happen?",
    expectHelper: "Specifically. Not \"it'll be bad\" — what exactly do you think will happen?",
    expectPlaceholder: "I expect that...",
    sureLabel: "How sure are you?",
    sureTemplate: "{n}% sure",
    difficultyLabel: "How hard does this feel right now?",
    reminder1: "The goal isn't to stay calm. The goal is to stay long enough to find out what actually happens.",
    reminder2: "If you leave early, that's information, not failure. Log it anyway.",
    goAction: "I'm going",
    timerStart: "Start a timer",
    timerStop: "Stop",
    timerHelp: "Just to help you remember how long you stayed. No target, no alarm — start it, stop it, that's it."
  },
  after: {
    heading: "What happened?",
    didItLabel: "Did you do it?",
    durationLabel: "How long did you stay?",
    durationFromTimer: "From your timer: {duration}",
    durationPlaceholder: "e.g., about five minutes",
    whatHappenedLabel: "What actually happened?",
    whatHappenedPlaceholder: "Describe what happened...",
    comparisonLabel: "How did that compare to what you expected?",
    surpriseLabel: "How surprised were you?",
    difficultyDuringLabel: "How hard did it feel while you were in it?",
    difficultyNowLabel: "How hard does this same step feel now, thinking about doing it again?",
    easierToggle: "Anything you did to make it easier?",
    easierHelper: "Distracting yourself, keeping your phone out, rushing it, having an escape ready. Not a problem — just worth noticing, because those are usually the next thing to practice without.",
    easierPlaceholder: "Things that made it easier...",
    barrierLabel: "What got in the way?",
    tooHardFollowup: "That's useful. It usually means the step is bigger than it looked, not that you did something wrong. Want to build a smaller version?",
    tooHardAction: "Make it smaller",
    timePlanFollowup: "Happens. Want to plan when you'll try it?",
    planPlaceholder: "When you'll try it...",
    noNotesPlaceholder: "Anything worth noting...",
    submit: "Save this",
    done: "Back to your plan"
  },
  record: {
    heading: "Your record",
    emptyMessage: "Nothing logged yet. It'll show up here once you practice.",
    attemptsCountTemplate: "{n} attempts logged, across {steps} steps.",
    attemptsCountTemplateOne: "1 attempt logged.",
    expectedVsActualHeading: "What you expected versus what happened",
    expectedVsActualNote: "This is the part that does the work. Not getting comfortable — finding out that what you expected to happen mostly didn't.",
    perStepHeading: "Each step, over time",
    reorderNote: "Your plan has reordered as ratings changed — here's the shape of it now.",
    stepHistoryEmpty: "No attempts yet.",
    saveCopy: "Save a copy",
    backToPractice: "Back to practicing"
  },
  deleteControl: {
    label: "Delete saved plan",
    confirmTemplate: "Delete everything saved on this device — your goal, steps, and practice record? This can't be undone.",
    confirmButton: "Delete everything",
    cancelButton: "Cancel"
  },
  print: {
    title: "Step Builder — Your Plan",
    goalHeading: "The goal",
    stackHeading: "The plan",
    recordHeading: "The practice record",
    questionsHeading: "Questions worth sitting with",
    questions: [
      "Which predictions have turned out to be wrong, and in which direction?",
      "Which steps keep getting put off — and are they actually too big?",
      "What are you still doing to make these easier, and what would it be like to practice without it?",
      "What's changed that you wouldn't have noticed without the record?"
    ]
  }
};
