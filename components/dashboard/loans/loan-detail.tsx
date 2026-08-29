"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  HandCoins,
  Loader2,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiLoanGivenDetail } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { accrueLoanInterest } from "@/lib/loan-interest";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, SectionHeading, StatTile } from "@/components/dashboard/panel";
import { RepaymentSection } from "./repayment-section";

const STATUS_LABELS: Record<ApiLoanGivenDetail["status"], string> = {
  active: "Active",
  partially_repaid: "Partially repaid",
  fully_repaid: "Fully repaid",
  defaulted: "Written off",
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function LoanDetail({ loanId }: { loanId: string }) {
  const { data, loading, error, refresh } = useApiQuery<ApiLoanGivenDetail>(
    `/api/loans-given/${loanId}`,
  );

  // Not persisted: this is a figure for the conversation, not a decision about
  // the loan. "If you clear it by December it's £X, if it slips to March it's
  // £Y" is the only leverage an informal lender has.
  const [whatIfDate, setWhatIfDate] = useState("");

  const { toast } = useToast();
  const [changingStatus, setChangingStatus] = useState(false);

  /**
   * Writing a loan off is the brake on accrual, so it lives here rather than in
   * the edit dialog: the figure it stops is on this page. Reinstating clears the
   * freeze and the months resume from where they left off.
   */
  const setWrittenOff = async (writeOff: boolean) => {
    if (
      writeOff &&
      !confirm(
        "Write this loan off? Interest stops accruing today and the total freezes at its current figure.",
      )
    ) {
      return;
    }

    setChangingStatus(true);
    try {
      await apiFetch(`/api/loans-given/${loanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: writeOff ? "defaulted" : "active" }),
      });
      toast({
        title: "Success",
        description: writeOff ? "Loan written off; interest frozen" : "Loan reinstated",
      });
      refresh();
    } catch (mutationError: unknown) {
      toast({
        title: "Error",
        description:
          mutationError instanceof Error ? mutationError.message : "Failed to update loan",
        variant: "destructive",
      });
    } finally {
      setChangingStatus(false);
    }
  };

  const whatIf = useMemo(() => {
    if (!data || !whatIfDate) return null;
    const schedule = accrueLoanInterest({
      principal: data.amount,
      monthlyRatePercent: data.interest_rate,
      loanDate: data.loan_date,
      accrualStoppedOn: data.accrual_stopped_on,
      repayments: data.repayments.map((entry) => ({
        amount: entry.amount,
        repaymentDate: entry.repayment_date,
      })),
      asOf: whatIfDate,
    });
    return { accrued: schedule.accruedInterest, payoff: schedule.payoffToday };
  }, [data, whatIfDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <EmptyState
          icon={HandCoins}
          title="Loan unavailable"
          description={error ?? "This loan could not be loaded."}
          action={
            <Button variant="outline" onClick={refresh}>
              Retry
            </Button>
          }
        />
      </Card>
    );
  }

  const { interest } = data;
  const overdue =
    data.expected_payback_date != null &&
    interest.settled_on == null &&
    data.expected_payback_date < new Date().toISOString().slice(0, 10);

  // The overrun is the whole point of the page: what they agreed to versus what
  // it has actually reached.
  const overrun =
    interest.expected_interest == null
      ? null
      : Math.round((interest.accrued_interest - interest.expected_interest) * 100) / 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/loans"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All loans
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">
            {data.borrower_name}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {formatCurrency(data.amount)} lent on {formatDate(data.loan_date)}
            {" · "}
            {STATUS_LABELS[data.status]}
            {data.interest_rate != null && ` · ${data.interest_rate}% a month`}
            {data.accrual_stopped_on != null &&
              ` · interest frozen ${formatDate(data.accrual_stopped_on)}`}
          </p>
        </div>

        {data.status === "defaulted" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={changingStatus}
            onClick={() => setWrittenOff(false)}
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Reinstate
          </Button>
        ) : (
          interest.settled_on == null && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={changingStatus}
              onClick={() => setWrittenOff(true)}
            >
              <Ban className="mr-1.5 size-3.5" />
              Write off
            </Button>
          )
        )}
      </div>

      {/* The four figures, side by side, because comparing them is the point. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Principal outstanding"
          value={formatCurrency(data.outstanding_balance)}
          tone={data.outstanding_balance > 0 ? "text-obligation" : undefined}
        />
        <StatTile
          label={interest.settled_on ? "Interest charged" : "Interest accrued"}
          value={formatCurrency(interest.accrued_interest)}
          tone={interest.interest_outstanding > 0 ? "text-obligation" : undefined}
          note={
            interest.months_elapsed > 0
              ? `${interest.months_elapsed} month${interest.months_elapsed === 1 ? "" : "s"} charged`
              : "No full month yet"
          }
        />
        <StatTile
          label="Expected interest"
          value={
            interest.expected_interest == null
              ? "—"
              : formatCurrency(interest.expected_interest)
          }
          note={
            data.expected_payback_date == null
              ? "No payback date agreed"
              : `If repaid by ${formatDate(data.expected_payback_date)}`
          }
        />
        <StatTile
          label={interest.settled_on ? "Settled" : "To settle today"}
          value={formatCurrency(interest.payoff_today)}
          note={
            interest.settled_on
              ? `Cleared ${formatDate(interest.settled_on)}`
              : "Principal plus interest owed"
          }
        />
      </div>

      {overrun != null && overrun > 0 && (
        <Card className="border-obligation/30 bg-obligation-surface/40">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 flex-none text-obligation" />
            <p className="text-[13px] text-foreground">
              This loan has run past its agreed date. Interest has reached{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(interest.accrued_interest)}
              </span>{" "}
              against the{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(interest.expected_interest ?? 0)}
              </span>{" "}
              assumed at the outset —{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(overrun)}</span>{" "}
              more.
              {overdue &&
                data.expected_payback_date != null &&
                ` Payback was due ${formatDate(data.expected_payback_date)}.`}
            </p>
          </CardContent>
        </Card>
      )}

      {interest.interest_paid > 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          Repayments settle principal first.{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(interest.interest_paid)}
          </span>{" "}
          of what they have paid has gone to interest,{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(interest.interest_outstanding)}
          </span>{" "}
          still owed.
        </p>
      )}

      {/* What-if */}
      {data.interest_rate != null && data.interest_rate > 0 && interest.settled_on == null && (
        <div>
          <SectionHeading title="If they pay later" />
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="loan-whatif">Settlement date</Label>
                  <Input
                    id="loan-whatif"
                    type="date"
                    className="w-auto"
                    value={whatIfDate}
                    onChange={(event) => setWhatIfDate(event.target.value)}
                  />
                </div>
                {whatIf && (
                  <p className="pb-2 text-[13px]">
                    Interest would reach{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(whatIf.accrued)}
                    </span>
                    , settling at{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(whatIf.payoff)}
                    </span>
                    .
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Month-by-month schedule */}
      <div>
        <SectionHeading
          title="Interest schedule"
          aside={
            interest.months_elapsed > 0
              ? `${formatCurrency(interest.accrued_interest)} total`
              : undefined
          }
        />
        <Card>
          {data.interest_schedule.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title={
                data.interest_rate == null || data.interest_rate === 0
                  ? "Interest-free loan"
                  : "No interest yet"
              }
              description={
                data.interest_rate == null || data.interest_rate === 0
                  ? "No rate was agreed, so nothing accrues."
                  : `The first charge lands on ${formatDate(data.loan_date)} next month.`
              }
            />
          ) : (
            <CardContent className="p-0">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border/60 text-left text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Month
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Charged
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      On balance
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Interest
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.interest_schedule.map((month) => (
                    <tr key={month.index} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-2.5 tabular-nums">{month.index}</td>
                      <td className="px-5 py-2.5 text-muted-foreground tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-3 flex-none" />
                          {formatDate(month.charged_on)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatCurrency(month.opening_balance)}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                        {formatCurrency(month.charge)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/60 font-semibold">
                    <td className="px-5 py-3" colSpan={3}>
                      Total interest
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(interest.accrued_interest)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          )}
        </Card>
      </div>

      <div>
        <SectionHeading title="Repayments" />
        <Card>
          <CardContent className="pt-4">
            <RepaymentSection loanId={loanId} onChanged={refresh} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
