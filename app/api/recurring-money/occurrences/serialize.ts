import type { RecurringMoneyOccurrence } from "@/lib/recurring-money-occurrences";

export function toOccurrence(occurrence: RecurringMoneyOccurrence) {
  return {
    id: occurrence.id,
    recurring_money_id: occurrence.recurringMoneyId,
    period_month: occurrence.periodMonth,
    state: occurrence.state,
    name: occurrence.name,
    due_date: occurrence.dueDate,
    expected_amount: occurrence.expectedAmount,
    type: occurrence.type,
    category: occurrence.category,
    payee: occurrence.payee,
    client_id: occurrence.clientId,
    giving_recipient_id: occurrence.givingRecipientId,
    giving_designation_id: occurrence.givingDesignationId,
    notes: occurrence.notes,
    rebill_mode: occurrence.rebillMode,
    rebill_amount: occurrence.rebillAmount,
    status: occurrence.status,
    recorded_amount: occurrence.recordedAmount,
    outstanding_amount: occurrence.outstandingAmount,
    overpaid_amount: occurrence.overpaidAmount,
    settlements: occurrence.settlements.map((settlement) => ({
      id: settlement.id,
      transaction_id: settlement.transactionId,
      amount: settlement.amount,
      date: settlement.date,
      payee: settlement.payee,
      provenance: settlement.provenance,
      created_at: settlement.createdAt.toISOString(),
    })),
  };
}
