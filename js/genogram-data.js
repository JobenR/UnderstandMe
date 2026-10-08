/* Genogram Builder — encoding definitions, starter content, and every
   user-facing copy string, centralized. Nothing in js/genogram.js should
   hard-code a string or encoding value that belongs here. */

var GB_CLIENT_ID = "client";

// Shape convention is the standard genogram one: square = male,
// circle = female, diamond = nonbinary/other.
var GB_GENDERS = [
  { id: "female", label: "Female", shape: "circle" },
  { id: "male", label: "Male", shape: "square" },
  { id: "other", label: "Nonbinary / other", shape: "diamond" }
];
function gbShapeForGender(genderId) {
  var g = GB_GENDERS.filter(function (x) { return x.id === genderId; })[0];
  return g ? g.shape : "circle";
}

// Free-text suggestions for "relationship to you" -- a datalist, not a
// closed set, since real families use labels no fixed list can cover
// (e.g., "Sister-in-law," "Godmother," "Ex-husband").
var GB_RELATIONSHIP_SUGGESTIONS = [
  "Mother", "Father", "Parent", "Step-parent", "Spouse / Partner",
  "Sister", "Brother", "Sibling", "Step-sibling", "Half-sibling",
  "Son", "Daughter", "Child", "Step-child",
  "Grandmother", "Grandfather", "Grandparent", "Grandchild",
  "Aunt", "Uncle", "Niece", "Nephew", "Cousin",
  "Mother-in-law", "Father-in-law", "Sister-in-law", "Brother-in-law",
  "Ex-spouse", "Friend", "Other"
];

var GB_LIFE_STATUSES = [
  { id: "living", label: "Living" },
  { id: "deceased", label: "Deceased" }
];

// Generations as a labeled select rather than a raw signed integer, so
// nobody has to guess whether parents are -1 or +1.
var GB_GENERATIONS = [
  { value: -3, label: "Great-grandparents’ generation" },
  { value: -2, label: "Grandparents’ generation" },
  { value: -1, label: "Parents’ generation" },
  { value: 0, label: "Your generation" },
  { value: 1, label: "Children’s generation" },
  { value: 2, label: "Grandchildren’s generation" }
];

var GB_CLOSENESS_ANCHORS = [
  { value: 1, label: "Estranged or cut off" },
  { value: 2, label: "Distant" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "Close" },
  { value: 5, label: "Very close" }
];

var GB_INFLUENCE_ANCHORS = [
  { value: 1, label: "Minor presence" },
  { value: 2, label: "Some influence" },
  { value: 3, label: "Meaningful influence" },
  { value: 4, label: "Major influence" },
  { value: 5, label: "Central figure" }
];

// Quality drives both line color (a supportive-to-conflictual gradient)
// and line style. Cutoff and enmeshed aren't really points on that same
// gradient -- a cutoff is categorically severe rather than "very
// conflictual," and an enmeshed tie isn't simply "very supportive" -- so
// each gets its own distinct hue instead of being forced onto the line
// between the other two.
var GB_QUALITIES = [
  { id: "supportive", label: "Supportive", color: "#3F8F6E", lineStyle: "solid" },
  { id: "neutral", label: "Neutral", color: "#8A93A6", lineStyle: "dashed" },
  { id: "conflictual", label: "Conflictual", color: "#C1503A", lineStyle: "jagged" },
  { id: "estranged", label: "Estranged", color: "#B07A1E", lineStyle: "broken" },
  { id: "cutoff", label: "Cutoff", color: "#7A2E2E", lineStyle: "slashed" },
  { id: "enmeshed", label: "Enmeshed", color: "#8456A8", lineStyle: "wavy" }
];
function gbQuality(id) {
  return GB_QUALITIES.filter(function (q) { return q.id === id; })[0] || GB_QUALITIES[1];
}

var GB_MODES = [
  { id: "current", label: "Current" },
  { id: "ideal", label: "Ideal" }
];

var GB_MIN_PEOPLE_FOR_CHART = 1;
var GB_MAX_PEOPLE = 16;

// A small, realistic starter cast so "See an example" shows every
// encoding at once (a mix of genders, generations, life statuses,
// closeness levels, and all five quality tags), with current and ideal
// ratings that genuinely differ from each other.
var GB_EXAMPLE = {
  client: { name: "You", gender: "female" },
  people: [
    {
      name: "Mom", relationship: "Mother", gender: "female", generation: -1, lifeStatus: "living",
      current: { closeness: 4, influence: 5, quality: "supportive", notes: "Talk most weeks." },
      ideal: { closeness: 4, influence: 5, quality: "supportive", notes: "" }
    },
    {
      name: "Dad", relationship: "Father", gender: "male", generation: -1, lifeStatus: "living",
      current: { closeness: 2, influence: 3, quality: "conflictual", notes: "Tense since the holidays." },
      ideal: { closeness: 3, influence: 3, quality: "neutral", notes: "Would settle for less tension, not closeness." }
    },
    {
      name: "Grandma Rose", relationship: "Grandmother", gender: "female", generation: -2, lifeStatus: "deceased",
      current: { closeness: 5, influence: 4, quality: "supportive", notes: "Passed 3 years ago; still think about her often." },
      ideal: { closeness: 5, influence: 4, quality: "supportive", notes: "" }
    },
    {
      name: "Older brother", relationship: "Brother", gender: "male", generation: 0, lifeStatus: "living",
      current: { closeness: 1, influence: 2, quality: "cutoff", notes: "Haven't spoken in about two years." },
      ideal: { closeness: 3, influence: 2, quality: "neutral", notes: "Not asking for closeness, just contact." }
    },
    {
      name: "Partner", relationship: "Spouse / Partner", gender: "male", generation: 0, lifeStatus: "living",
      current: { closeness: 5, influence: 5, quality: "enmeshed", notes: "We're together constantly -- barely any separate time." },
      ideal: { closeness: 4, influence: 5, quality: "supportive", notes: "Same closeness, a bit more room to breathe." }
    },
    {
      name: "Best friend", relationship: "Friend", gender: "female", generation: 0, lifeStatus: "living",
      current: { closeness: 3, influence: 2, quality: "neutral", notes: "" },
      ideal: { closeness: 4, influence: 3, quality: "supportive", notes: "Would like to prioritize this more." }
    }
  ]
};

// Deliberately not about any single node -- these are meant to be sat
// with after both maps are built, comparing the Current and Ideal
// pictures as a whole. Each gets its own response block in the UI and
// print sheet.
var GB_REFLECTION_QUESTIONS = [
  "Looking at your Current and Ideal maps side by side, what's the first difference that catches your eye — and what does that difference tell you about what you're longing for?",
  "Which relationship moved the most between Current and Ideal? What would actually have to change — in you, in them, or in your circumstances — for that shift to happen?",
  "Is there a relationship you rated close in both maps that still feels unsatisfying? What might that tell you about what closeness alone can't give you?",
  "Whose position barely changed between Current and Ideal? Is that because the relationship already feels right, or because you've quietly stopped imagining it could be different?",
  "If you could change only one relationship's quality — not how close it is, just how it feels — which would it be, and what's actually standing in the way?",
  "What would it cost you — in comfort, loyalty, or sense of self — to move even one relationship toward your Ideal map? Is that a cost you're willing to pay right now?"
];

var GB_STANDING_DISCLAIMER =
  "This is an educational self-reflection tool, not a psychological assessment. It doesn't diagnose anything, it isn't treatment, and using it doesn't create a therapist–client relationship.";

var GB_CRISIS_LINE =
  "If you're in crisis or thinking about harming yourself, call or text 988 — the Suicide & Crisis Lifeline, available 24/7 in the US.";

var GB_COPY = {
  opening: {
    heading: "Genogram Builder",
    tagline: "Map the people in your life the way they actually feel — who you're close to, who's distant, and where you'd like things to change.",
    body: [
      "A genogram is a family map that goes beyond a plain family tree: alongside who's related to whom, it shows how close each relationship feels, how much each person influences your life, and whether the tie is supportive, strained, cut off, or enmeshed.",
      "Build a “Current” map of your relationships as they are today, then switch to “Ideal” and adjust the same people to show how you'd want things to feel instead. Comparing the two is often where the useful conversation starts."
    ],
    howItWorksHeading: "How it works",
    howItWorks: [
      "Add yourself and the people you want to map, placed by generation.",
      "Rate how close each person feels, how much influence they have, and the general quality of the relationship.",
      "Switch between your Current and Ideal maps — or view them side by side — to see where the two differ."
    ]
  },
  people: {
    stepLabel: "Step 1",
    heading: "Add the people in your map",
    clientLabel: "You",
    clientInstruction: "This is your own node at the center of the map — set how you want it labeled and shown.",
    nameLabel: "Name",
    addPersonLabel: "+ Add person",
    personNamePlaceholder: "Name or label (e.g., “Mom,” “Older brother”)",
    relationshipLabel: "Relationship to you",
    relationshipPlaceholder: "e.g., Mother, Sister-in-law, Friend",
    genderLabel: "Shown as",
    generationLabel: "Generation",
    lifeStatusLabel: "Life status",
    minNotice: "Add at least one person to build a map.",
    maxNotice: "Up to " + GB_MAX_PEOPLE + " people keeps the map readable.",
    loadExampleLabel: "See an example",
    resetLabel: "Start over"
  },
  ratings: {
    stepLabel: "Step 2",
    heading: "Rate each relationship",
    helper: "Rate how this relationship is today, and how you'd want it to feel ideally — side by side. The two columns are independent; changing one doesn't touch the other.",
    currentColumnLabel: "Current",
    idealColumnLabel: "Ideal",
    closenessLabel: "Closeness",
    influenceLabel: "Influence",
    qualityLabel: "Quality",
    notesLabel: "Notes (optional, private — shown only when you select this person on the map)",
    notesPlaceholder: "Context for yourself or your therapist..."
  },
  map: {
    stepLabel: "Step 3",
    heading: "Your map",
    modeToggleLabel: "Showing",
    sideBySideLabel: "Side by side",
    dragHint: "Drag any person to fine-tune their position if a line ever crosses through another node.",
    resetPositionsLabel: "Reset positions",
    emptyMessage: "Add at least one person above to see your map.",
    selectedPersonNotesEmpty: "No notes for this relationship.",
    legendHeading: "How to read this map",
    legendShape: "Shape — how this person is shown: square, circle, or diamond.",
    legendSize: "Size — bigger means more influence in your life.",
    legendBorder: "Node outline — solid means living, dashed means deceased; your own node has a double outline. The outline color mirrors the relationship's quality, same as the connecting line.",
    legendColor: "Color — both the connecting line and the node outline reflect the overall quality of the relationship, from supportive (green) through neutral (gray) to conflictual, estranged, or cutoff (red/amber tones), with enmeshed shown in purple.",
    legendProximity: "Distance from you — closer relationships are drawn nearer to your node.",
    legendLineStyle: "Line style — shown below for each quality.",
    legendLineWeight: "Line thickness — thicker lines mark the most intense relationships, whether that intensity is closeness or conflict."
  },
  reflect: {
    stepLabel: "Step 4",
    heading: "Reflect",
    helper: "Now that both maps are built, sit with these for a few minutes. There's no right answer — type whatever comes up; it will be included in your printed copy.",
    responsePlaceholder: "Type your response here..."
  },
  actions: {
    saveCopy: "Save a copy",
    startNew: "Start a new map"
  }
};
