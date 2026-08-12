export type AccountClass = "asset" | "liability";

/**
 * Apply movements expressed from an asset account's point of view.
 *
 * Income and incoming transfers are positive; expenses, giving, and outgoing
 * transfers are negative. Liability balances represent the positive amount
 * owed, so the same movement has the inverse effect there.
 */
export function calculateAccountBalance(
  openingBalance: number,
  accountClass: AccountClass,
  naturalMovementDelta: number,
) {
  return (
    openingBalance +
    (accountClass === "asset" ? naturalMovementDelta : -naturalMovementDelta)
  );
}
