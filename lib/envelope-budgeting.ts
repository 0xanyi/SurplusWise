interface EnvelopeBudget {
  amount: number;
  period: "monthly" | "quarterly" | "yearly";
  start_date: string;
  end_date: string;
  type: "income" | "expense" | "giving";
}

export function getMonthlyEnvelopePlan(
  budgets: EnvelopeBudget[],
  currentMonth: { startDate: string; endDate: string },
) {
  const monthly = budgets.filter(
    (budget) =>
      budget.period === "monthly" &&
      budget.start_date <= currentMonth.endDate &&
      budget.end_date >= currentMonth.startDate,
  );
  const totalFor = (type: EnvelopeBudget["type"]) =>
    monthly
      .filter((budget) => budget.type === type)
      .reduce((total, budget) => total + budget.amount, 0);
  const expectedIncome = totalFor("income");
  const expenses = totalFor("expense");
  const giving = totalFor("giving");

  return {
    expectedIncome,
    expenses,
    giving,
    unassigned: expectedIncome - expenses - giving,
  };
}
