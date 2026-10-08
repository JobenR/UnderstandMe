/* Tests for js/avoidance-calc.js — run with: node --test js/avoidance-calc.test.js
   Uses Node's built-in test runner (node:test + node:assert), so this adds no
   dependency to a repo that otherwise has none. */

const test = require("node:test");
const assert = require("node:assert/strict");
const AvoidanceCalc = require("./avoidance-calc.js");

test("single domain, hand-verifiable: 12 episodes x 30 min = 6 monthly hrs, 72 annual hrs", () => {
  const monthly = AvoidanceCalc.domainMonthlyHours(12, 30);
  assert.equal(monthly, 6);
  assert.equal(AvoidanceCalc.annualHours(monthly), 72);
});

test("three domains sum correctly", () => {
  const domains = [
    { id: "a", episodesPerMonth: 12, minutesPerEpisode: 30, dollarsPerMonth: 0 }, // 6 hrs
    { id: "b", episodesPerMonth: 4, minutesPerEpisode: 60, dollarsPerMonth: 0 },  // 4 hrs
    { id: "c", episodesPerMonth: 24, minutesPerEpisode: 15, dollarsPerMonth: 0 }  // 6 hrs
  ];
  const total = AvoidanceCalc.totalMonthlyHours(domains);
  assert.equal(total, 16);
  assert.equal(AvoidanceCalc.annualHours(total), 192);
});

test("sanity rail: minutesPerEpisode hard-capped at 480", () => {
  // 60 episodes x 600 min would be 600 hrs uncapped; capped at 480 min -> 480 hrs
  const monthly = AvoidanceCalc.domainMonthlyHours(60, 600);
  assert.equal(monthly, (60 * 480) / 60);
  assert.equal(monthly, 480);
});

test("sanity rail: episodesPerMonth hard-capped at 60", () => {
  // 90 episodes capped to 60, x 60 min -> 60 hrs
  const monthly = AvoidanceCalc.domainMonthlyHours(90, 60);
  assert.equal(monthly, (60 * 60) / 60);
  assert.equal(monthly, 60);
});

test("sanity rail: yearsReported capped at 40", () => {
  const annual = 100;
  assert.equal(AvoidanceCalc.cumulativeHours(annual, 60), 100 * 40);
  assert.equal(AvoidanceCalc.cumulativeHours(annual, 40), 100 * 40);
  assert.equal(AvoidanceCalc.cumulativeHours(annual, 39), 100 * 39);
});

test("sanity rail: 250-hour high-total notice trigger fires at 250.1 but not at 250.0", () => {
  assert.equal(AvoidanceCalc.isHighTotal(250.0), false);
  assert.equal(AvoidanceCalc.isHighTotal(250.1), true);
});

test("rounding at boundaries: 994, 995, 1049, 1050, 1051", () => {
  assert.equal(AvoidanceCalc.roundHours(994), 990);
  assert.equal(AvoidanceCalc.roundHours(995), 1000);
  assert.equal(AvoidanceCalc.roundHours(1049), 1000);
  assert.equal(AvoidanceCalc.roundHours(1050), 1100);
  assert.equal(AvoidanceCalc.roundHours(1051), 1100);
});

test("dollar rounding to nearest $10", () => {
  assert.equal(AvoidanceCalc.roundDollars(124), 120);
  assert.equal(AvoidanceCalc.roundDollars(125), 130);
  assert.equal(AvoidanceCalc.roundDollars(126), 130);
});

test("translations: waking days, work weeks, weeks of waking life", () => {
  // 1600 annual hours -> 100 waking days, 40 work weeks
  assert.equal(AvoidanceCalc.wakingDaysPerYear(1600), 100);
  assert.equal(AvoidanceCalc.workWeeksPerYear(1600), 40);
  // 1120 cumulative hours -> 10 weeks of waking life
  assert.equal(AvoidanceCalc.weeksOfWakingLife(1120), 10);
});

test("edge case: zero domains", () => {
  const totals = AvoidanceCalc.computeTotals([], 1, 0);
  assert.equal(totals.totalMonthlyHours, 0);
  assert.equal(totals.annualHours, 0);
  assert.equal(totals.cumulativeHours, 0);
  assert.equal(totals.annualDirectCost, 0);
  assert.equal(totals.largestDomain, null);
  assert.equal(totals.largestDomainAnnualHours, 0);
  assert.equal(totals.domainCount, 0);
  assert.equal(totals.isHighTotal, false);
});

test("edge case: one domain at minimum values (1 episode, 5 minutes, $0)", () => {
  const domains = [{ id: "a", label: "A", episodesPerMonth: 1, minutesPerEpisode: 5, dollarsPerMonth: 0 }];
  const totals = AvoidanceCalc.computeTotals(domains, 1, 0);
  assert.equal(totals.totalMonthlyHours, 5 / 60);
  assert.equal(totals.largestDomain.id, "a");
  assert.equal(totals.isHighTotal, false);
});

test("edge case: all domains at maximum values trigger the high-total notice", () => {
  const domains = [
    { id: "a", label: "A", episodesPerMonth: 60, minutesPerEpisode: 480, dollarsPerMonth: 5000 },
    { id: "b", label: "B", episodesPerMonth: 60, minutesPerEpisode: 480, dollarsPerMonth: 5000 }
  ];
  const totals = AvoidanceCalc.computeTotals(domains, 40, 8);
  // each domain: 60 * 480 / 60 = 480 hrs/month; two domains -> 960
  assert.equal(totals.totalMonthlyHours, 960);
  assert.equal(totals.isHighTotal, true);
  assert.equal(totals.annualDirectCost, (5000 + 5000) * 12);
});

test("optional time valuation is excluded from annualDirectCost", () => {
  const domains = [{ id: "a", label: "A", episodesPerMonth: 12, minutesPerEpisode: 30, dollarsPerMonth: 50 }];
  const totals = AvoidanceCalc.computeTotals(domains, 1, 0);
  assert.equal(totals.annualDirectCost, 50 * 12);
  const withTimeValue = AvoidanceCalc.timeValueAnnual(totals.annualHours, 30);
  assert.equal(withTimeValue, totals.annualHours * 30);
  // timeValueAnnual must never be added into annualDirectCost
  assert.equal(totals.annualDirectCost, 600);
});
