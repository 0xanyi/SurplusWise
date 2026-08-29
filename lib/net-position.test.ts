import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { netPositionFigure, netPositionSentence, netPositionSplit } from "./net-position";

const gbp = (n: number) => `£${n.toFixed(2)}`;

describe("netPositionSplit", () => {
  it("does not report 0% shares when income is zero and money left", () => {
    const split = netPositionSplit({
      totalIncome: 0,
      totalExpenses: 162,
      totalGivings: 0,
      netBalance: -162,
    });
    assert.equal(split.barMode, "outflow-share");
    assert.equal(split.spentPct, 0);
    assert.equal(split.spentWidth, 100);
    assert.equal(split.givenWidth, 0);
  });

  it("collapses the bar when nothing moved", () => {
    const split = netPositionSplit({
      totalIncome: 0,
      totalExpenses: 0,
      totalGivings: 0,
      netBalance: 0,
    });
    assert.equal(split.barMode, "empty");
  });
});

describe("netPositionSentence", () => {
  it("names a no-payday deficit in pounds, not 0%", () => {
    assert.equal(
      netPositionSentence(
        {
          totalIncome: 0,
          totalExpenses: 162,
          totalGivings: 0,
          netBalance: -162,
        },
        gbp,
      ),
      "£162.00 more went out than came in",
    );
  });

  it("does not claim money was kept when nothing came in", () => {
    const sentence = netPositionSentence(
      {
        totalIncome: 0,
        totalExpenses: 162,
        totalGivings: 40,
        netBalance: -202,
      },
      gbp,
    );
    assert.equal(sentence.includes("kept"), false);
    assert.equal(sentence.includes("0%"), false);
  });
});

describe("netPositionFigure", () => {
  it("signs a deficit with a unicode minus", () => {
    assert.equal(netPositionFigure(-812.44, gbp), "−£812.44");
  });

  it("does not sign a surplus or a zero", () => {
    assert.equal(netPositionFigure(2466.91, gbp), "£2466.91");
    assert.equal(netPositionFigure(0, gbp), "£0.00");
  });

  it("signs an outflow-only window, which is always a loss", () => {
    const totals = {
      totalIncome: 0,
      totalExpenses: 162,
      totalGivings: 40,
      netBalance: -202,
    };
    assert.equal(netPositionSplit(totals).barMode, "outflow-share");
    assert.equal(netPositionFigure(totals.netBalance, gbp), "−£202.00");
  });
});
