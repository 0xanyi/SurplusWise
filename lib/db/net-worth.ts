import * as investmentsService from "./investments";
import * as loansService from "./loans-given";
import * as debtsService from "./debts-credits";

export async function getNetWorthSummary(userId: string, workspaceId: string) {
  const [investments, loans, debts] = await Promise.all([
    investmentsService.getSummary(userId, workspaceId),
    loansService.getSummary(userId, workspaceId),
    debtsService.getSummary(userId, workspaceId),
  ]);

  const assets = investments.totalCurrentValue + loans.totalOutstanding;
  const liabilities = debts.totalBalance;
  const netWorth = assets - liabilities;

  return {
    assets,
    liabilities,
    netWorth,
    investmentsValue: investments.totalCurrentValue,
    loansReceivable: loans.totalOutstanding,
    debtsOwed: debts.totalBalance,
    investmentCount: investments.count,
    loanCount: loans.count,
    debtCount: debts.count,
  };
}
