/* Exposure & SUDS Tracker — pure calculation module.
   No DOM access, no dependencies, no side effects. Every function here takes
   plain numbers/objects in and returns plain numbers/objects out, so the
   timing and charting math can be verified in isolation from the page that
   uses it.

   Loaded as a plain <script> in the browser (exposes the global SudsCalc),
   and also require()-able from a Node test file via the module.exports
   guard at the bottom -- no build step either way. */

var SudsCalc = {
  MIN_SUDS: 1,
  MAX_SUDS: 10,

  // mm:ss for any non-negative number of seconds, however large (a long
  // exposure can run past 59:59, so this grows the minutes field rather
  // than wrapping to an hours field).
  formatElapsed: function (totalSeconds) {
    var s = Math.max(0, Math.round(totalSeconds));
    var mm = Math.floor(s / 60);
    var ss = s % 60;
    return (mm < 10 ? "0" + mm : String(mm)) + ":" + (ss < 10 ? "0" + ss : String(ss));
  },

  // The rating with the highest SUDS value. Ties keep the earliest
  // occurrence, since that's the point where distress first peaked.
  // Null for an empty list.
  peakRating: function (ratings) {
    if (!ratings.length) return null;
    return ratings.reduce(function (max, r) {
      return r.suds > max.suds ? r : max;
    }, ratings[0]);
  },

  firstRating: function (ratings) {
    return ratings.length ? ratings[0] : null;
  },

  lastRating: function (ratings) {
    return ratings.length ? ratings[ratings.length - 1] : null;
  },

  // First rating minus last rating -- positive means it went down
  // (habituation), negative means it ended higher than it started.
  netChange: function (ratings) {
    var first = SudsCalc.firstRating(ratings);
    var last = SudsCalc.lastRating(ratings);
    if (!first || !last) return 0;
    return first.suds - last.suds;
  },

  // How much of the peak was given back by the end of the exposure, as a
  // percentage. 100 = ended at zero; 0 = ended exactly at peak (including
  // when the peak IS the last rating, i.e. distress was still climbing
  // when the exposure ended). Always in [0, 100], since peak is defined
  // as the max over all ratings including the last one.
  percentReductionFromPeak: function (ratings) {
    var peak = SudsCalc.peakRating(ratings);
    var last = SudsCalc.lastRating(ratings);
    if (!peak || !last || peak.suds === 0) return 0;
    return ((peak.suds - last.suds) / peak.suds) * 100;
  },

  // Bundles everything the summary and comparison views need from one
  // exposure's rating list into a single object.
  exposureSummary: function (exposure) {
    var ratings = exposure.ratings || [];
    var first = SudsCalc.firstRating(ratings);
    var peak = SudsCalc.peakRating(ratings);
    var last = SudsCalc.lastRating(ratings);
    var durationSeconds = ratings.length ? ratings[ratings.length - 1].elapsedSeconds : 0;
    return {
      id: exposure.id,
      label: exposure.label,
      preSuds: first ? first.suds : null,
      peakSuds: peak ? peak.suds : null,
      peakElapsedSeconds: peak ? peak.elapsedSeconds : null,
      endSuds: last ? last.suds : null,
      netChange: SudsCalc.netChange(ratings),
      percentReductionFromPeak: SudsCalc.percentReductionFromPeak(ratings),
      durationSeconds: durationSeconds,
      ratingCount: ratings.length
    };
  },

  // Descriptive (not diagnostic) trend across a series of exposure
  // summaries, in the order they were run. "Decreasing" requires every
  // step to move the same direction or hold; anything else is "mixed" --
  // deliberately conservative so the tool doesn't overstate a pattern from
  // noisy, low-n clinical data.
  trendDirection: function (values) {
    if (values.length < 2) return "insufficient";
    var allNonIncreasing = true;
    var allNonDecreasing = true;
    var anyChange = false;
    for (var i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) allNonIncreasing = false;
      if (values[i] < values[i - 1]) allNonDecreasing = false;
      if (values[i] !== values[i - 1]) anyChange = true;
    }
    if (!anyChange) return "flat";
    if (allNonIncreasing) return "decreasing";
    if (allNonDecreasing) return "increasing";
    return "mixed";
  },

  // Peak-SUDS and end-SUDS trend across exposures, run in order, plus the
  // raw first-to-last deltas the UI can turn into a sentence.
  crossExposureTrend: function (exposures) {
    var summaries = exposures.map(SudsCalc.exposureSummary);
    var peaks = summaries.map(function (s) { return s.peakSuds; }).filter(function (v) { return v !== null; });
    var ends = summaries.map(function (s) { return s.endSuds; }).filter(function (v) { return v !== null; });
    return {
      peakTrend: SudsCalc.trendDirection(peaks),
      endTrend: SudsCalc.trendDirection(ends),
      peakDeltaFirstToLast: peaks.length > 1 ? peaks[0] - peaks[peaks.length - 1] : 0,
      endDeltaFirstToLast: ends.length > 1 ? ends[0] - ends[ends.length - 1] : 0
    };
  },

  // Shared x/y scale for plotting one or more exposures on the same chart,
  // so every series lines up on a common elapsed-time axis. SUDS is always
  // 1-10 on the y-axis; elapsed time is 0..maxElapsedSeconds on the x-axis,
  // padded so the last point isn't flush against the chart edge.
  buildChartScale: function (exposures, width, height, padding) {
    var maxElapsed = exposures.reduce(function (max, exp) {
      var last = SudsCalc.lastRating(exp.ratings || []);
      return last ? Math.max(max, last.elapsedSeconds) : max;
    }, 0);
    // Guard against a single-point exposure (maxElapsed 0), which would
    // otherwise divide by zero and collapse every x to the same pixel.
    var xDomain = Math.max(maxElapsed, 1);
    var innerWidth = width - padding.left - padding.right;
    var innerHeight = height - padding.top - padding.bottom;

    return {
      maxElapsedSeconds: maxElapsed,
      xForSeconds: function (seconds) {
        return padding.left + (seconds / xDomain) * innerWidth;
      },
      yForSuds: function (suds) {
        var t = (suds - SudsCalc.MIN_SUDS) / (SudsCalc.MAX_SUDS - SudsCalc.MIN_SUDS);
        return padding.top + (1 - t) * innerHeight;
      }
    };
  },

  // Maps one exposure's ratings through a scale (from buildChartScale)
  // into plain {x, y, suds, elapsedSeconds} points ready for an SVG
  // polyline/circle without any further math in the rendering code.
  ratingsToPoints: function (ratings, scale) {
    return ratings.map(function (r) {
      return {
        x: scale.xForSeconds(r.elapsedSeconds),
        y: scale.yForSuds(r.suds),
        suds: r.suds,
        elapsedSeconds: r.elapsedSeconds
      };
    });
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SudsCalc;
}
