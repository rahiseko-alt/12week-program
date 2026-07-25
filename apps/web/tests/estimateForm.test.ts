import { describe, expect, it } from "vitest";

import {
  INITIAL_FORM_STATE,
  deriveEstimateView,
  type EstimateFormState,
} from "../lib/estimateForm";

// D2 の実テスト（echo/ダミーではない代表ケース）。
// 「入力に対し即時に結果が反映される」の中核＝状態→表示の変換ロジックを、
// DOMなしで検証する（interactionはブラウザ/リモート実演側で検証）。

describe("deriveEstimateView: 単発の見積り", () => {
  it("初期状態は工数レンジを返す（コスト・期間はオプション未指定なので無し）", () => {
    const view = deriveEstimateView(INITIAL_FORM_STATE);
    expect(view.error).toBeNull();
    expect(view.recalc).toBeNull();
    expect(view.result?.effort.expected).toBe(5); // (2 + 4*4 + 12) / 6
    expect(view.result?.cost).toBeUndefined();
    expect(view.result?.period).toBeUndefined();
  });

  it("dayRate/capacityPerDay を入れるとコスト・期間も返る", () => {
    const state: EstimateFormState = {
      ...INITIAL_FORM_STATE,
      dayRate: 50000,
      capacityPerDay: 2,
    };
    const view = deriveEstimateView(state);
    expect(view.error).toBeNull();
    expect(view.result?.cost?.expected).toBe(250000);
    expect(view.result?.period?.expected).toBe(2.5);
  });

  it("optimistic > mostLikely 等の不整合は例外を投げずエラー文言で返す", () => {
    const state: EstimateFormState = {
      ...INITIAL_FORM_STATE,
      effort: { optimistic: 10, mostLikely: 4, pessimistic: 12 },
    };
    const view = deriveEstimateView(state);
    expect(view.result).toBeNull();
    expect(view.recalc).toBeNull();
    expect(view.error).toMatch(/optimistic ≤ mostLikely ≤ pessimistic/);
  });
});

describe("deriveEstimateView: 要件変更→即時再計算", () => {
  it("scopeChange が入力されると result ではなく recalc(before/after/delta) を返す", () => {
    const state: EstimateFormState = {
      ...INITIAL_FORM_STATE,
      scopeChange: { kind: "add", effort: { optimistic: 1, mostLikely: 2, pessimistic: 3 } },
    };
    const view = deriveEstimateView(state);
    expect(view.error).toBeNull();
    expect(view.result).toBeNull();
    expect(view.recalc?.before.effort.expected).toBe(5);
    expect(view.recalc?.after.effort.expected).toBe(7); // (3 + 4*6 + 15) / 6
    expect(view.recalc?.deltaEffort).toBe(2);
  });

  it("削減方向の要件変更は差分が負になる", () => {
    const state: EstimateFormState = {
      ...INITIAL_FORM_STATE,
      scopeChange: { kind: "remove", effort: { optimistic: 1, mostLikely: 1, pessimistic: 1 } },
    };
    const view = deriveEstimateView(state);
    expect(view.recalc?.deltaEffort).toBeLessThan(0);
  });
});
