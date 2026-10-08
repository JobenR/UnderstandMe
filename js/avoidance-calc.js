/* Avoidance Cost Calculator — pure calculation module.
   No DOM access, no dependencies, no side effects. Every function here takes
   plain numbers/objects in and returns plain numbers/objects out, so the
   arithmetic can be verified in isolation from the page that uses it.

   Loaded as a plain <script> in the browser (exposes the global
   AvoidanceCalc), and also require()-able from a Node test file via the
   module.exports guard at the bottom — no build step either way. */

var AvoidanceCalc = {
  MAX_MINUTES_PER_EPISODE: 480,
  MAX_EPISODES_PER_MONTH: 60,
  MAX_YEARS_REPORTED: 40,
  HIGH_TOTAL_MONTHLY_HOURS: 250,

  clampMinutes: function (minutesPerEpisode) {
    return Math.min(minutesPerEpisode, AvoidanceCalc.MAX_MINUTES_PER_EPISODE);
  },

  clampEpisodes: function (episodesPerMonth) {
    return Math.min(episodesPerMonth, AvoidanceCalc.MAX_EPISODES_PER_MONTH);
  },

  clampYears: function (yearsReported) {
    return Math.min(yearsReported, AvoidanceCalc.MAX_YEARS_REPORTED);
  },

  // (frequency value * minutes) / 60, with the sanity-rail caps applied first.
  domainMonthlyHours: function (episodesPerMonth, minutesPerEpisode) {
    var e = AvoidanceCalc.clampEpisodes(episodesPerMonth);
    var m = AvoidanceCalc.clampMinutes(minutesPerEpisode);
    return (e * m) / 60;
  },

  // Sum of every domain's monthly hours.
  totalMonthlyHours: function (domains) {
    return domains.reduce(function (sum, d) {
      return sum + AvoidanceCalc.domainMonthlyHours(d.episodesPerMonth, d.minutesPerEpisode);
    }, 0);
  },

  annualHours: function (totalMonthlyHoursValue) {
    return totalMonthlyHoursValue * 12;
  },

  // annualHours * years reported, with the 40-year cap applied.
  cumulativeHours: function (annualHoursValue, yearsReported) {
    return annualHoursValue * AvoidanceCalc.clampYears(yearsReported);
  },

  // Sum of every domain's monthly dollars, annualized.
  annualDirectCost: function (domains) {
    var totalMonthlyDollars = domains.reduce(function (sum, d) {
      return sum + d.dollarsPerMonth;
    }, 0);
    return totalMonthlyDollars * 12;
  },

  tenYearCost: function (annualDirectCostValue) {
    return annualDirectCostValue * 10;
  },

  wakingDaysPerYear: function (annualHoursValue) {
    return annualHoursValue / 16;
  },

  workWeeksPerYear: function (annualHoursValue) {
    return annualHoursValue / 40;
  },

  weeksOfWakingLife: function (cumulativeHoursValue) {
    return cumulativeHoursValue / 112;
  },

  // The domain with the highest monthly hours. Null for an empty list.
  largestDomain: function (domains) {
    if (!domains.length) return null;
    return domains.reduce(function (max, d) {
      var dHours = AvoidanceCalc.domainMonthlyHours(d.episodesPerMonth, d.minutesPerEpisode);
      var maxHours = AvoidanceCalc.domainMonthlyHours(max.episodesPerMonth, max.minutesPerEpisode);
      return dHours > maxHours ? d : max;
    }, domains[0]);
  },

  isHighTotal: function (totalMonthlyHoursValue) {
    return totalMonthlyHoursValue > AvoidanceCalc.HIGH_TOTAL_MONTHLY_HOURS;
  },

  // Nearest 10 below 1000; nearest 100 at 1000 and above.
  roundHours: function (hours) {
    if (hours < 1000) return Math.round(hours / 10) * 10;
    return Math.round(hours / 100) * 100;
  },

  // Nearest $10, always.
  roundDollars: function (amount) {
    return Math.round(amount / 10) * 10;
  },

  // Optional, hypothetical, and never folded into annualDirectCost.
  timeValueAnnual: function (annualHoursValue, hourlyRate) {
    return annualHoursValue * hourlyRate;
  },

  // Convenience bundle: everything the results step needs from one call.
  // domains: array of { id, label, episodesPerMonth, minutesPerEpisode, dollarsPerMonth }
  computeTotals: function (domains, yearsReported, opportunityCount) {
    var totalMonthly = AvoidanceCalc.totalMonthlyHours(domains);
    var annual = AvoidanceCalc.annualHours(totalMonthly);
    var cumulative = AvoidanceCalc.cumulativeHours(annual, yearsReported);
    var directCost = AvoidanceCalc.annualDirectCost(domains);
    var tenYear = AvoidanceCalc.tenYearCost(directCost);
    var largest = AvoidanceCalc.largestDomain(domains);
    var largestAnnualHours = largest
      ? AvoidanceCalc.domainMonthlyHours(largest.episodesPerMonth, largest.minutesPerEpisode) * 12
      : 0;

    return {
      totalMonthlyHours: totalMonthly,
      annualHours: annual,
      cumulativeHours: cumulative,
      annualDirectCost: directCost,
      tenYearCost: tenYear,
      wakingDaysPerYear: AvoidanceCalc.wakingDaysPerYear(annual),
      workWeeksPerYear: AvoidanceCalc.workWeeksPerYear(annual),
      weeksOfWakingLife: AvoidanceCalc.weeksOfWakingLife(cumulative),
      largestDomain: largest,
      largestDomainAnnualHours: largestAnnualHours,
      domainCount: domains.length,
      opportunityCount: opportunityCount,
      isHighTotal: AvoidanceCalc.isHighTotal(totalMonthly)
    };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AvoidanceCalc;
}
