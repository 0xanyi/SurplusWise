import * as investmentsService from "./investments";
import * as loansService from "./loans-given";
import * as debtsService from "./debts-credits";
import * as financialAccountsService from "./financial-accounts";

export async function getNetWorthSummary(userId: string, workspaceId: string) {
  const [investments, loans, debts, accounts] = await Promise.all([
    investmentsService.getSummary(userId, workspaceId),
    loansService.getSummary(userId, workspaceId),
    debtsService.getSummary(userId, workspaceId),
    financialAccountsService.list(userId, workspaceId),
  ]);

  const accountAssets = accounts
    .filter((account) => account.accountClass === "asset")
    .reduce((sum, account) => sum + account.currentBalance, 0);
  const accountLiabilities = accounts
    .filter((account) => account.accountClass === "liability")
    .reduce((sum, account) => sum + account.currentBalance, 0);
  const assets = investments.totalCurrentValue + loans.totalOutstanding + accountAssets;
  const liabilities = debts.netWorthBalance + accountLiabilities;
  const netWorth = assets - liabilities;

  return {
    assets,
    liabilities,
    netWorth,
    investmentsValue: investments.totalCurrentValue,
    loansReceivable: loans.totalOutstanding,
    accountAssets,
    accountLiabilities,
    debtsOwed: debts.netWorthBalance,
    accountCount: accounts.length,
    investmentCount: investments.count,
    loanCount: loans.count,
    debtCount: debts.count,
  };
}
