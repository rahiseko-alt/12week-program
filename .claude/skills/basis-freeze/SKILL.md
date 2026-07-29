---
name: basis-freeze
description: 受入基準（docs/roadmap.html の criteria / verify）を新規作成・変更・凍結するときに必ず発動する。基準は書いた本人が確定してはならず、basis-reviewer サブエージェントの敵対的レビューで pass を得てから凍結する。ロードマップに葉を足す・割る・criteria や verify の文言を直す・新しいゴールのツリーを描く、といった作業のたびに使う。CI（scripts/verify-roadmap-evidence.mjs）が criteria の指紋と meta.basis_review を突き合わせて機械的に強制するため、飛ばすとCIが赤になりマージできない。
---

# 基準凍結の門（basis-freeze）

`docs/roadmap.html` の `criteria` / `verify` に触れたら、**例外なく** basis-reviewer を通す。

## なぜ機械で止めるのか

AGENTS.md に「本人採点の禁止」と書いてあるだけでは守られない。実際、2026-07-29 に
新ゴール G2 のツリー（7枝21葉）を、担当AIが**自分で書いて自分で確定させ**、マスターから
「原子だ。まじで何回言わす？サブに検証させろ、ルール読んだのか？」と指摘された。
掛けてみたら **不合格**で、原子性違反8件・被覆の抜け6件・合格ラインのすり替え5件が出た。

**文章で書いても読まれない。だから CI で落とす。**

## 手順（この順にやる。飛ばさない）

### 1. 基準を書く／直す
`docs/roadmap.html` の `criteria` / `verify` を書く。この時点では**まだ確定していない**。

### 2. basis-reviewer に敵対的レビューをさせる（必須）
Agent ツールで `subagent_type: "basis-reviewer"` を呼ぶ。プロンプトには必ず入れる：

- **対象**：どのルート／枝／葉を見てほしいか（既に done の範囲は対象外だと明示する）
- **マスターの指示原文**：要件の抜けを判定できるよう、言われたことをそのまま貼る
- **自分が自信を持てていない箇所**：ただし「このリストに限定せず全葉を見よ」と添える
- **落としにいけという指示**：忖度は不要、疑わしきは割る方向で、と明示する

### 3. 判定を受け取る
- **objection（不合格）** → 反証に従って割り直す。**2 に戻る。** 自分の判断で「これは指摘が過剰だ」と
  握りつぶさない。過剰だと思うならその理由をマスターに出して判断を仰ぐ。
- **pass（合格）** → 4 へ。

### 4. 指紋を取って記録する
```bash
node scripts/verify-roadmap-evidence.mjs
```
未記録／不一致なら、エラーメッセージが**現在の指紋**を教えてくれる。それを `meta.basis_review` に記録する：

```json
"basis_review": {
  "verdict": "pass",
  "criteria_hash": "<リンタが出した16桁>",
  "reviewed_at": "YYYY-MM-DD",
  "scope": "レビューさせた範囲（例：G2 全8枝36葉）",
  "note": "何を指摘され、どう直して pass になったかの要点"
}
```

再度リンタを走らせて緑になったら凍結完了。

## 禁止事項

- **自分でレビュー結果を書いて通す**こと。`criteria_hash` だけ合わせて `verdict:"pass"` と書くのは
  本人採点そのもので、このリポジトリが最も禁じている行為（`docs/failures.md` の
  2026-07-26 C-10-2 の項を読むこと）。
- **objection のまま実装に進む**こと。リンタが `verdict !== "pass"` で落とす。
- 指摘を受けて基準を**緩める**方向に直すこと。基準は実測に合わせて動かさない。

## 機械強制の中身

`scripts/verify-roadmap-evidence.mjs` が、全 `criteria` の `text` + `verify` を木の順に連結して
SHA-256 の先頭16桁を取り、`meta.basis_review.criteria_hash` と突き合わせる。

- `criteria` を1文字でも変えれば指紋が変わる → 記録と食い違う → **CI が赤**
- 指紋を合わせるには `meta.basis_review` を更新するしかない → その瞬間に `verdict` の申告を強制される
- `verdict` が `pass` 以外なら落ちる

つまり「基準をこっそり書き換えて通す」経路が塞がれている。
CI（`ci-green`）は branch protection の必須チェックなので、赤のままではマージできない。

## 併用するもの

- **basis-reviewer**（`.claude/agents/basis-reviewer.md`）＝ 基準そのものの質を見る。この門で使う。
- **independent-verifier**（`.claude/agents/independent-verifier.md`）＝ 基準を満たしたかの done 判定を見る。
  役割が違うので取り違えない。
