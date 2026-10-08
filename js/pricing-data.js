/* Pricing copy -- placeholder amounts for preview. Edit here; pricing.html
   renders from this file. "soon: true" marks features that are not built yet. */
var UM_PRICING_NOTE = "Preview pricing. Everything on this site is free while accounts are in development, and the amounts below are placeholders, not a commitment.";

var UM_PLANS = [
  {
    name: "Free",
    forWho: "Patients and anyone exploring the toolkit.",
    price: "$0", per: "forever",
    features: [
      { text: "All eight exercises" },
      { text: "Print, PDF, text and email export" },
      { text: "No account, nothing stored online" }
    ],
    cta: { label: "Try a tool", href: "index.html#tools", style: "btn-outline" }
  },
  {
    name: "Provider",
    forWho: "Solo clinicians who assign work between sessions.",
    price: "$19", per: "per month",
    featured: true,
    features: [
      { text: "Everything in Free" },
      { text: "Your name and contact on every printout" },
      { text: "Guided packets: several tools, one link" },
      { text: "Profile saved on your device, portable by file" },
      { text: "Provider sign-in across devices", soon: true },
      { text: "Your logo on printouts", soon: true }
    ],
    cta: { label: "Open the dashboard", href: "providers.html", style: "btn-primary" }
  },
  {
    name: "Practice",
    forWho: "Group practices that want one shared identity.",
    price: "$79", per: "per month",
    features: [
      { text: "Everything in Provider" },
      { text: "Up to 10 clinicians", soon: true },
      { text: "Shared practice profile and logo", soon: true },
      { text: "Reusable packet templates", soon: true },
      { text: "Priority support", soon: true }
    ],
    cta: { label: "Coming soon", href: "", style: "btn-disabled" }
  }
];

var UM_PRICING_FAQ = [
  { q: "Is it really free right now?",
    a: "Yes. Every tool and every provider feature that exists today is free to use while the paid plans are being built." },
  { q: "Do patients ever pay or need an account?",
    a: "No. Patients open a link, complete the exercise in their browser, and print or save the results. There is nothing to sign up for." },
  { q: "Will you store patient results if I upgrade?",
    a: "Not in the current design. The plans above brand and organize what you send. They do not collect what patients enter. Anything that stores clinical data would be announced separately and would need to meet healthcare privacy requirements first." },
  { q: "Can I use these in sessions with clients?",
    a: "Yes. They are designed to support the conversation between provider and patient. They are educational tools, not diagnostic instruments, and they do not replace clinical judgment." }
];
