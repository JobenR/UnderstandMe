"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var SudsCalc = require("./suds-tracker-calc.js");

test("formatElapsed pads under a minute", function () {
  assert.equal(SudsCalc.formatElapsed(5), "00:05");
  assert.equal(SudsCalc.formatElapsed(0), "00:00");
});

test("formatElapsed handles minutes and grows past 59:59", function () {
  assert.equal(SudsCalc.formatElapsed(125), "02:05");
  assert.equal(SudsCalc.formatElapsed(3600), "60:00");
  assert.equal(SudsCalc.formatElapsed(3725), "62:05");
});

test("formatElapsed rounds and floors negative input to zero", function () {
  assert.equal(SudsCalc.formatElapsed(4.6), "00:05");
  assert.equal(SudsCalc.formatElapsed(-10), "00:00");
});

var risesThenFalls = [
  { elapsedSeconds: 0, suds: 3 },
  { elapsedSeconds: 60, suds: 7 },
  { elapsedSeconds: 120, suds: 9 },
  { elapsedSeconds: 180, suds: 6 },
  { elapsedSeconds: 240, suds: 2 }
];

test("peakRating finds the highest value", function () {
  assert.deepEqual(SudsCalc.peakRating(risesThenFalls), { elapsedSeconds: 120, suds: 9 });
});

test("peakRating keeps the earliest occurrence on a tie", function () {
  var tie = [
    { elapsedSeconds: 0, suds: 5 },
    { elapsedSeconds: 60, suds: 8 },
    { elapsedSeconds: 120, suds: 8 }
  ];
  assert.deepEqual(SudsCalc.peakRating(tie), { elapsedSeconds: 60, suds: 8 });
});

test("peakRating is null for an empty list", function () {
  assert.equal(SudsCalc.peakRating([]), null);
});

test("netChange is positive when the exposure ends lower than it started", function () {
  assert.equal(SudsCalc.netChange(risesThenFalls), 1); // 3 -> 2
});

test("netChange is negative when the exposure ends higher than it started", function () {
  var worsened = [
    { elapsedSeconds: 0, suds: 2 },
    { elapsedSeconds: 60, suds: 6 }
  ];
  assert.equal(SudsCalc.netChange(worsened), -4);
});

test("netChange is zero for an empty or single-point list", function () {
  assert.equal(SudsCalc.netChange([]), 0);
  assert.equal(SudsCalc.netChange([{ elapsedSeconds: 0, suds: 5 }]), 0);
});

test("percentReductionFromPeak computes the percent given back from peak by the end", function () {
  var partialReturn = [
    { elapsedSeconds: 0, suds: 4 },
    { elapsedSeconds: 60, suds: 8 },
    { elapsedSeconds: 120, suds: 4 }
  ];
  // peak 8, end 4 -> (8-4)/8 * 100 = 50
  assert.equal(SudsCalc.percentReductionFromPeak(partialReturn), 50);
});

test("percentReductionFromPeak from a peak of 10 down to the minimum of 1 is 90%", function () {
  var fullReturn = [
    { elapsedSeconds: 0, suds: 2 },
    { elapsedSeconds: 60, suds: 10 },
    { elapsedSeconds: 120, suds: 1 }
  ];
  assert.equal(SudsCalc.percentReductionFromPeak(fullReturn), 90);
});

test("percentReductionFromPeak is 0 when the exposure ends exactly at its peak", function () {
  var endsAtPeak = [
    { elapsedSeconds: 0, suds: 3 },
    { elapsedSeconds: 60, suds: 9 }
  ];
  assert.equal(SudsCalc.percentReductionFromPeak(endsAtPeak), 0);
});

test("percentReductionFromPeak is 0 when distress was still climbing when the exposure ended", function () {
  var stillClimbing = [
    { elapsedSeconds: 0, suds: 3 },
    { elapsedSeconds: 60, suds: 6 },
    { elapsedSeconds: 120, suds: 9 }
  ];
  // the last point (9) is also the peak by definition, so this is 0.
  assert.equal(SudsCalc.percentReductionFromPeak(stillClimbing), 0);
});

test("exposureSummary bundles pre/peak/end/duration correctly", function () {
  var exposure = { id: 1, label: "Doorknob", ratings: risesThenFalls };
  var summary = SudsCalc.exposureSummary(exposure);
  assert.equal(summary.preSuds, 3);
  assert.equal(summary.peakSuds, 9);
  assert.equal(summary.peakElapsedSeconds, 120);
  assert.equal(summary.endSuds, 2);
  assert.equal(summary.netChange, 1);
  assert.equal(summary.durationSeconds, 240);
  assert.equal(summary.ratingCount, 5);
});

test("exposureSummary handles an exposure with no ratings yet", function () {
  var summary = SudsCalc.exposureSummary({ id: 1, label: "Empty", ratings: [] });
  assert.equal(summary.preSuds, null);
  assert.equal(summary.peakSuds, null);
  assert.equal(summary.endSuds, null);
  assert.equal(summary.durationSeconds, 0);
});

test("trendDirection: strictly decreasing values", function () {
  assert.equal(SudsCalc.trendDirection([9, 7, 5]), "decreasing");
});

test("trendDirection: flat, non-increasing counts as decreasing (ties allowed)", function () {
  assert.equal(SudsCalc.trendDirection([9, 9, 7]), "decreasing");
});

test("trendDirection: strictly increasing values", function () {
  assert.equal(SudsCalc.trendDirection([3, 5, 8]), "increasing");
});

test("trendDirection: all equal is flat", function () {
  assert.equal(SudsCalc.trendDirection([6, 6, 6]), "flat");
});

test("trendDirection: up then down is mixed", function () {
  assert.equal(SudsCalc.trendDirection([5, 8, 4]), "mixed");
});

test("trendDirection: fewer than two values is insufficient", function () {
  assert.equal(SudsCalc.trendDirection([]), "insufficient");
  assert.equal(SudsCalc.trendDirection([5]), "insufficient");
});

test("crossExposureTrend reads peak and end trends across exposures run in order", function () {
  var exposures = [
    { id: 1, label: "Exposure 1", ratings: [{ elapsedSeconds: 0, suds: 3 }, { elapsedSeconds: 60, suds: 9 }, { elapsedSeconds: 120, suds: 6 }] },
    { id: 2, label: "Exposure 2", ratings: [{ elapsedSeconds: 0, suds: 3 }, { elapsedSeconds: 60, suds: 7 }, { elapsedSeconds: 120, suds: 3 }] },
    { id: 3, label: "Exposure 3", ratings: [{ elapsedSeconds: 0, suds: 2 }, { elapsedSeconds: 60, suds: 5 }, { elapsedSeconds: 120, suds: 2 }] }
  ];
  var trend = SudsCalc.crossExposureTrend(exposures);
  assert.equal(trend.peakTrend, "decreasing"); // 9 -> 7 -> 5
  assert.equal(trend.endTrend, "decreasing");  // 6 -> 3 -> 2
  assert.equal(trend.peakDeltaFirstToLast, 4); // 9 - 5
  assert.equal(trend.endDeltaFirstToLast, 4);  // 6 - 2
});

test("buildChartScale maps SUDS 1-10 to the full inner height, inverted (10 at top)", function () {
  var padding = { top: 10, right: 10, bottom: 10, left: 10 };
  var scale = SudsCalc.buildChartScale(
    [{ ratings: [{ elapsedSeconds: 0, suds: 1 }, { elapsedSeconds: 100, suds: 10 }] }],
    200, 100, padding
  );
  assert.equal(scale.yForSuds(10), 10); // top of inner area
  assert.equal(scale.yForSuds(1), 90);  // bottom of inner area (100 - 10)
  assert.equal(scale.maxElapsedSeconds, 100);
});

test("buildChartScale spans the shared x-axis across the longest exposure", function () {
  var padding = { top: 0, right: 0, bottom: 0, left: 0 };
  var scale = SudsCalc.buildChartScale(
    [
      { ratings: [{ elapsedSeconds: 0, suds: 5 }, { elapsedSeconds: 60, suds: 5 }] },
      { ratings: [{ elapsedSeconds: 0, suds: 5 }, { elapsedSeconds: 180, suds: 5 }] }
    ],
    100, 100, padding
  );
  assert.equal(scale.maxElapsedSeconds, 180);
  assert.equal(scale.xForSeconds(0), 0);
  assert.equal(scale.xForSeconds(180), 100);
  assert.equal(scale.xForSeconds(90), 50);
});

test("buildChartScale guards against a zero-width time domain (single-point exposure)", function () {
  var padding = { top: 0, right: 0, bottom: 0, left: 0 };
  var scale = SudsCalc.buildChartScale(
    [{ ratings: [{ elapsedSeconds: 0, suds: 5 }] }],
    100, 100, padding
  );
  assert.equal(scale.maxElapsedSeconds, 0);
  assert.ok(Number.isFinite(scale.xForSeconds(0)));
});

test("ratingsToPoints maps ratings through a scale into plain x/y points", function () {
  var padding = { top: 0, right: 0, bottom: 0, left: 0 };
  var ratings = [{ elapsedSeconds: 0, suds: 1 }, { elapsedSeconds: 50, suds: 10 }];
  var scale = SudsCalc.buildChartScale([{ ratings: ratings }], 100, 100, padding);
  var points = SudsCalc.ratingsToPoints(ratings, scale);
  assert.equal(points.length, 2);
  assert.equal(points[0].x, 0);
  assert.equal(points[0].y, 100);
  assert.equal(points[1].x, 100);
  assert.equal(points[1].y, 0);
});
