/* Week Builder — encoding definitions, starter content, and every
   user-facing copy string, centralized. Nothing in js/week-builder.js
   should hard-code a string that belongs here. Every string here comes
   from the product spec; none of it is paraphrased. */

var WB_STANDING_DISCLAIMER =
  "This is an educational tool, not a psychological assessment or a treatment program. It doesn't diagnose anything, and using it doesn't create a therapist–client relationship. If your mood has been low for a while, this works much better alongside a therapist than on its own.";

var WB_CRISIS_LINE =
  "If you're in crisis or thinking about harming yourself, call or text 988 — the Suicide & Crisis Lifeline, available 24/7 in the US.";

var WB_STORAGE_OFFER_TEXT =
  "Want to keep this on this device? It stays in this browser, on this device only. It isn't sent anywhere, we can't see it, and it won't follow you to another computer or phone. You can delete it at any time.";

var WB_STORAGE_WHAT_IS_KEPT =
  "What's kept, if you say yes: your activity menu, your weekly plans, and your log — all of it stored only in this browser, on this device. Nothing is sent anywhere, ever. Deleting it is immediate and total.";


var WB_BLOCKS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" }
];

var WB_DAYS = [
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" }
];

var WB_WEEK_SOFT_CAP = 6;
var WB_WEEK_DEFAULT_SUGGESTION = 4;

/* -------------------------------------------------------------------------
 * Phase 1 — Noticing (optional)
 * ---------------------------------------------------------------------- */
var WB_MOOD_ANCHORS_NOTICING = [
  { value: 0, label: "As low as it gets" },
  { value: 5, label: "Neutral" },
  { value: 10, label: "As good as it gets" }
];

/* -------------------------------------------------------------------------
 * Phase 2 — Building the menu: six categories
 * ---------------------------------------------------------------------- */
var WB_MENU_CATEGORIES = [
  {
    id: "enjoyed",
    label: "Things I used to enjoy",
    prompt: "Things that used to be worth doing, even if they don't sound like much right now. Especially those.",
    examples: [
      "listening to a whole album", "cooking something", "a specific show", "reading", "a game",
      "being outside", "a particular café", "music", "drawing", "a bath", "a podcast", "photography"
    ]
  },
  {
    id: "progress",
    label: "Things that feel like getting somewhere",
    prompt: "Small things that leave something different afterward. They don't have to be enjoyable.",
    examples: [
      "one load of laundry", "the sink emptied", "a bill paid", "a drawer sorted", "an email sent",
      "ten minutes of tidying", "watering plants", "a form filled in"
    ]
  },
  {
    id: "people",
    label: "People",
    prompt: "Contact with someone. Smaller counts — this doesn't have to mean seeing anybody.",
    examples: [
      "a text to someone", "a phone call", "a walk with someone", "sitting in a café near other people",
      "a meal with someone", "replying to the message you've been avoiding", "a video call"
    ]
  },
  {
    id: "moving",
    label: "Moving",
    prompt: "Any movement. There's no amount that's the right amount.",
    examples: [
      "walking around the block", "stretching", "going up the stairs twice", "a swim",
      "gardening", "dancing to one song", "parking further away"
    ]
  },
  {
    id: "selfcare",
    label: "Looking after myself",
    prompt: "The basic things that quietly fall away.",
    examples: [
      "eating something that isn't whatever's nearest", "a shower", "getting dressed", "going outside once",
      "going to bed before midnight", "taking medication at a set time", "opening the curtains"
    ]
  },
  {
    id: "matters",
    label: "Things that matter to me",
    prompt: "Things connected to what you actually care about, regardless of whether they're enjoyable.",
    examples: [
      "time with a child", "something for someone else", "something related to work I care about",
      "a creative thing", "something connected to faith or community", "learning something", "volunteering"
    ]
  }
];

var WB_MENU_ENCOURAGE_AT = 8;

/* -------------------------------------------------------------------------
 * Phase 4 — Logging
 * ---------------------------------------------------------------------- */
var WB_COMPLETION_OPTIONS = [
  { id: "yes", label: "Yes" },
  { id: "partly", label: "Partly" },
  { id: "no", label: "No" }
];

var WB_BARRIER_OPTIONS = [
  { id: "couldnt_face", label: "I couldn't face it" },
  { id: "no_time", label: "No time" },
  { id: "something_came_up", label: "Something came up" },
  { id: "forgot", label: "I forgot" },
  { id: "changed_mind", label: "I changed my mind" },
  { id: "something_else", label: "Something else" }
];

/* -------------------------------------------------------------------------
 * All screen copy
 * ---------------------------------------------------------------------- */
var WB_COPY = {
  noticingIntro: {
    heading: "Start with what's already happening",
    body: [
      "Before planning anything, it's worth two or three days of just noticing — what you did, and how you felt. Most people find the picture isn't what they assumed. Some things they thought were neutral turn out to lift their mood. Some things they thought helped turn out not to.",
      "You can skip this and go straight to planning. But if you've got a few days, this makes everything after it more useful."
    ],
    declinedNote: "Last time, you chose not to keep anything on this device, so if you leave this page partway through, you'll need to start over. You can decide again once you've built something.",
    noticeAction: "I'll notice for a few days",
    skipAction: "Skip to planning"
  },
  noticingLog: {
    heading: "What's happening",
    whatLabel: "What were you doing?",
    whatPlaceholder: "Describe what you were doing...",
    moodLabel: "How was your mood?",
    enjoymentToggle: "How much did you enjoy it?",
    accomplishmentToggle: "How much did it feel like an accomplishment?",
    addEntry: "Add this",
    readyPrompt: "Ready to plan a week?",
    readyAction: "Plan a week",
    continueNoticing: "Keep noticing",
    entriesLogged: "{n} noticed so far."
  },
  menuIntro: {
    heading: "What's worth doing?",
    body: [
      "This is a list to draw from, not a list to get through. Most of it won't happen this week. The point is to have options in front of you when you're deciding what to put in the week, instead of trying to think of something from nothing."
    ]
  },
  menuGenerate: {
    heading: "Build your list",
    entryPlaceholder: "Add your own...",
    addLabel: "Add",
    countTemplate: "You've got {n} things.",
    countTemplateOne: "You've got 1 thing.",
    encourage: "A few more is better than fewer — you want options on a day when nothing sounds possible.",
    continue: "Continue",
    minNotice: "Add at least one thing to continue."
  },
  menuRate: {
    heading: "A couple of quick guesses",
    note: "These are guesses, and that's the point. Later you'll see how they compared to how things actually went.",
    enjoyLabel: "How good do you expect this would feel?",
    hardLabel: "How hard would it be to make yourself do it?",
    continue: "Continue"
  },
  week: {
    heading: "What's going in this week?",
    defaultGuidance: "Three or four is plenty for a first week. Pick ones you rated as easier, not the ones you think you should be doing. The point this week is to find out whether the plan holds at all.",
    softCapNotice: "That's six. Worth stopping there for the first week — a short list you actually do beats a full one you don't. You can always add more mid-week.",
    specificityNotice: "Worth making this more specific — \"walk around the block after lunch\" is much more likely to happen than \"exercise.\"",
    menuHeading: "Your list",
    selectHint: "Tap something in your list, then tap where it goes.",
    selectedLabel: "Placing: {text}",
    cancelSelect: "Cancel",
    wentBetterThanExpected: "Went better than you expected last time.",
    noteLabel: "Note (optional)",
    notePlaceholder: "Where, with whom, what exactly...",
    emptySlot: "+ add",
    continue: "That's my week"
  },
  storage: {
    heading: "One more thing",
    keepLabel: "Yes, keep it on this device",
    declineLabel: "No, don't save it",
    declineNote: "Everything still works for this session, and you can print the week before you close the tab.",
    whatsKeptToggle: "What exactly gets kept?",
    continue: "Done",
    printWeek: "Print the week"
  },
  currentWeek: {
    heading: "Your week",
    emptyMessage: "Nothing planned yet.",
    logUnplanned: "Log something else",
    reviewLink: "See what the record shows",
    printWeek: "Print this week",
    todayLabel: "Today"
  },
  log: {
    heading: "Did it happen?",
    moodAfterLabel: "How was your mood afterward?",
    enjoymentToggle: "How much did you enjoy it?",
    accomplishmentToggle: "Did it feel like getting somewhere?",
    moodBeforeToggle: "How was your mood before?",
    notesToggle: "Anything worth noting?",
    notesPlaceholder: "Anything worth noting...",
    submit: "Save",
    barrierLabel: "What got in the way?",
    barrierAck: "Fine. That's information, not a problem. Most weeks have some of these.",
    barrierNotesPlaceholder: "Anything worth noting...",
    couldntFaceFollowup: "Want to put a smaller version in instead?",
    couldntFaceAction: "Make it smaller",
    noTimeFollowup: "Want to move it to another slot?",
    noTimeAction: "Move it",
    unplannedHeading: "Log something that wasn't planned",
    unplannedWhatLabel: "What did you do?",
    unplannedWhatPlaceholder: "What did you do..."
  },
  review: {
    heading: "What the record shows",
    expectedActualHeading: "What you expected versus what happened",
    expectedActualSummaryTemplate: "Across {n} things you've logged, you expected an average of {x} and they came out at {y}.",
    betterThanExpectedNote: "Most of them went better than you expected. That's the usual pattern, and it's worth knowing about yourself — the part of you that predicts how things will go is running low at the moment.",
    worseThanExpectedNote: "These are coming out lower than you expected, which is worth bringing to someone. It can mean the activities aren't the right ones, or that something else needs attention first.",
    whatHelpsHeading: "What helps",
    whatHelpsNote: "These are the things that have come with the best moods afterward.",
    whatHelpsEmpty: "Not enough logged yet for this to mean much — it'll fill in as you go.",
    moodOverTimeHeading: "Mood over time",
    plansHeading: "What happened to the plans",
    plansEmpty: "Nothing planned yet.",
    footerNote: "Nothing here is a measurement. It's your own notes, added up.",
    saveCopy: "Save a copy",
    back: "Back to your week",
    planNextWeek: "Plan next week"
  },
  deleteControl: {
    label: "Delete saved data",
    confirmTemplate: "Delete everything saved on this device — your menu, plans, and log? This can't be undone."
  },
  print: {
    weekTitle: "Week Builder — The Week Ahead",
    recordTitle: "Week Builder — The Record",
    menuHeading: "The menu",
    logHeading: "The log",
    expectedActualHeading: "Expected versus actual",
    whatHelpsHeading: "What's helped",
    questionsHeading: "Questions worth sitting with",
    questions: [
      "Which predictions have been furthest off, and in which direction?",
      "What's the pattern in the things that don't get done — are they a particular kind of thing, or a particular time of day?",
      "Which of these actually matter to you, and which went on the list because they seemed like they should be there?",
      "What's changed that you wouldn't have noticed without writing it down?"
    ]
  }
};
