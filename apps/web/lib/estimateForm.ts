// D2: 概算UI（apps/web/app/estimate）の状態→表示ロジック。
// D1（lib/estimate.ts）の純関数を、フォーム入力の生の状態から呼び出す薄い変換層。
// UI側はこの結果をそのまま描画するだけにし、DOM非依存でテストできるようここへ分離する。

import {
  type EstimateInput,
  type EstimateResult,
  type RecalcResult,
  type ScopeChange,
  type ThreePoint,
  estimate,
  recalcWithChange,
} from "./estimate";

/** フォームの生入力（すべて編集中の状態として保持する）。 */
export interface EstimateFormState {
  effort: ThreePoint;
  /** 未入力は null（コスト/期間はオプション出力のため）。 */
  dayRate: number | null;
  capacityPerDay: number | null;
  /** 要件変更。未入力（追加/削減を検討していない）は null。 */
  scopeChange: ScopeChange | null;
}

/** 画面に出す結果。バリデーション失敗時は result/recalc を持たず error のみ。 */
export interface EstimateView {
  result: EstimateResult | null;
  recalc: RecalcResult | null;
  error: string | null;
}

export const INITIAL_FORM_STATE: EstimateFormState = {
  effort: { optimistic: 2, mostLikely: 4, pessimistic: 12 },
  dayRate: null,
  capacityPerDay: null,
  scopeChange: null,
};

function buildInput(state: EstimateFormState): EstimateInput {
  const input: EstimateInput = { effort: state.effort };
  if (state.dayRate !== null) input.dayRate = state.dayRate;
  if (state.capacityPerDay !== null) input.capacityPerDay = state.capacityPerDay;
  return input;
}

/**
 * フォーム状態から表示用の見積り結果を導出する。
 * 要件変更(scopeChange)が入力されていれば再計算(before/after/delta)を、
 * なければ単発の見積りを返す。estimate.ts の RangeError は画面向けエラー文言に変換する。
 */
export function deriveEstimateView(state: EstimateFormState): EstimateView {
  const input = buildInput(state);
  try {
    if (state.scopeChange) {
      const recalc = recalcWithChange(input, state.scopeChange);
      return { result: null, recalc, error: null };
    }
    const result = estimate(input);
    return { result, recalc: null, error: null };
  } catch (err) {
    const message = err instanceof RangeError ? err.message : "入力値を計算できませんでした。";
    return { result: null, recalc: null, error: message };
  }
}
