const { daysInMonth, parseYmd } = require("../dates");

/** Optional location estimates (PKR major / month). Statistical helpers, not poverty-line verdicts. */
const LOCATION_ESTIMATES = {
  Karachi: { foodPerPerson: 12000, utilitiesHousehold: 8000, localTransportPerPerson: 4000 },
  Lahore: { foodPerPerson: 11000, utilitiesHousehold: 7500, localTransportPerPerson: 3500 },
  Islamabad: { foodPerPerson: 13000, utilitiesHousehold: 9000, localTransportPerPerson: 4500 },
  Other: { foodPerPerson: 10000, utilitiesHousehold: 7000, localTransportPerPerson: 3000 },
};

function pick(userValue, estimate, useEstimate) {
  if (userValue != null && userValue !== "") return Number(userValue) || 0;
  return useEstimate ? estimate || 0 : 0;
}

function survivalBudget(input) {
  const {
    householdSize = 1,
    location = "Other",
    asOfDate,
    housingMinor,
    foodMinor,
    utilitiesMinor,
    transportMinor,
    medicalMinor,
    educationMinor,
    otherEssentialMinor,
    confirmedIncomeMinor = 0,
    expectedIncomeMinor = 0,
    useLocationEstimates = false,
  } = input;

  const loc = LOCATION_ESTIMATES[location] || LOCATION_ESTIMATES.Other;
  const size = Math.max(1, Number(householdSize) || 1);
  const foodEst = loc.foodPerPerson * size * 100;
  const utilEst = loc.utilitiesHousehold * 100;
  const transEst = loc.localTransportPerPerson * size * 100;

  const housing = pick(housingMinor, 0, false);
  const food = pick(foodMinor, foodEst, useLocationEstimates);
  const utilities = pick(utilitiesMinor, utilEst, useLocationEstimates);
  const transport = pick(transportMinor, transEst, useLocationEstimates);
  const medical = pick(medicalMinor, 0, false);
  const education = pick(educationMinor, 0, false);
  const other = pick(otherEssentialMinor, 0, false);

  const monthlyEssentialMinor = housing + food + utilities + transport + medical + education + other;
  const { year, month } = parseYmd(asOfDate);
  const dim = daysInMonth(year, month);
  const weeklyMinor = Math.round((monthlyEssentialMinor * 7) / dim);
  const dailyMinor = Math.round(monthlyEssentialMinor / dim);
  const availableMinor = confirmedIncomeMinor;
  const projectedIncomeMinor = confirmedIncomeMinor + expectedIncomeMinor;
  const remainingAfterConfirmed = availableMinor - monthlyEssentialMinor;
  const remainingAfterProjected = projectedIncomeMinor - monthlyEssentialMinor;

  let status = "covered";
  let headline = "Essential needs appear covered";
  if (remainingAfterProjected < 0) {
    status = "exceeds";
    headline = "Essential expenses may exceed available income";
  } else if (remainingAfterProjected < monthlyEssentialMinor * 0.1 || remainingAfterConfirmed < 0) {
    status = "tight";
    headline = "Budget is tight";
  }

  const explanations = [
    `Household size ${size} in ${location}.`,
    `Essentials = housing + food + utilities + transport + medical + education + other.`,
    useLocationEstimates
      ? "Missing food/utility/transport amounts used optional location estimates, not official living-cost guarantees."
      : "Only amounts you entered were used; location estimates were not applied.",
    "Confirmed income is cash you recorded as received. Expected income is not treated as guaranteed.",
    "This is not a poverty-line test and does not label a household as unable to survive.",
  ];

  const adjustments = [];
  if (status !== "covered") {
    adjustments.push("Review optional spending and delay non-essential purchases.");
    adjustments.push("Confirm which bills are truly essential this period.");
    adjustments.push("If income is delayed, protect rent, food, utilities, and medicine first.");
  }

  return {
    status,
    headline,
    monthlyEssentialMinor,
    weeklyMinor,
    dailyMinor,
    remainingAfterConfirmedMinor: remainingAfterConfirmed,
    remainingAfterProjectedMinor: remainingAfterProjected,
    breakdown: { housing, food, utilities, transport, medical, education, other },
    estimatesUsed: useLocationEstimates,
    location,
    householdSize: size,
    explanations,
    adjustments,
    locationEstimates: loc,
  };
}

module.exports = { survivalBudget, LOCATION_ESTIMATES };
