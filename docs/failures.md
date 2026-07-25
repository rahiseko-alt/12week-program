# failures（失敗の蓄積ログ / append-only・消さない）

同じ失敗を繰り返さないための**蓄積型**ログ。handoff（`docs/roadmap.html` の `meta.handoff`・毎回上書き）とは
役割が違い、ここは**消さずに積む**。1件＝**日付＋事象＋根因＋教訓**。

---

## 2026-07-22 handoff が既マージ枝に取り残され次セッションに渡らなかった
- 事象：前回チェックアウトで handoff を、PR#14 が既にマージ済みのブランチ（`claude/language-granularity-verification-6mr28i`）
  先端へ余分に1コミット push（`af0d724`）。PR は既にクローズ/マージ済みのため main に取り込まれず、ブランチ上に取り残された。
  次セッションは main（旧 handoff）から生えたため読めなかった（＝消滅ではなく未マージの取り残し）。
- 根因：handoff が本編（毎PRで必ず main に乗る `docs/roadmap.html`）と別ファイル・別経路。マージ済み枝への追い push は main に届かない。
- 教訓：handoff は roadmap（`meta.handoff`）に同梱し、本編と一緒に必ずマージする。commit/push の自己申告を鵜呑みにせず存否を確認する。

## 2026-07-22 stale なローカル参照を鵜呑みにして「消滅」と誤断定
- 事象：`git cat-file -t af0d724` がローカルで「Not a valid object」を返したのを根拠に「af0d724 は消滅」と断言。
  実際は GitHub 上に実在（上記ブランチ先端）。ローカル clone の `origin/main` も stale（fef4360=Initial commit を指す）で、
  「main は空」とも誤断定した。真の main は cf22e57。
- 根因：ローカルの remote-tracking 参照が古いまま、リモート実データ（`git ls-remote` / GitHub API `list_branches`）で照合せず結論した。
  「本人の自己申告を信じない」を掲げながら、自分のローカル状態を自己申告として鵜呑みにした。
- 教訓：ブランチ/コミットの存否・main の位置は、**ローカルの `origin/*` ではなくリモート実データ**で確認してから断定する。

## 2026-07-22 roadmap-required の必須チェック名を job 名≠登録名で登録し、全PRをブロック
- 事象：`roadmap-required` を必須チェックに登録する際、登録名を **workflow 名**「roadmap-required」にした。だが GitHub Actions
  が報告するチェック名は **job 名**「PRにroadmap更新があるか（例外なし）」。両者が食い違い、必須コンテキスト「roadmap-required」が
  永久に未報告 → roadmap を更新した正当なPRを含め**全PRがマージ不能**（`405 Required status check "roadmap-required" is expected`）。
- 根因：Actions の必須チェック名は **job 名（check run 名）** と一致させる必要があるのに workflow 名で登録した。加えて
  「#17 が blocked」を「必須化が正しく機能」と早合点し、**pass→merge できることを確認せず「検証済み」と報告**した。
- 対処：job の `name` を `roadmap-required` に改名して報告名を登録名に一致させ、roadmap 更新PR(#18)が緑通過→マージ成立で実証。
- 教訓：必須チェックは「**blocked を観測」だけでなく「pass して merge できる**」ことまで実証して初めて"効く"証拠になる。
  GitHub Actions の必須チェックは `jobs.<id>.name` を登録名に一致させる。

## 2026-07-23 粒度ルールの「機械的判定手順」を語の単位を揃えずに書き、合格例と自己矛盾させた
- 事象：AGENTS.md の粒度ルールを「原子まで分解」で AI 解釈がぶれない形へ改訂する際、判定手順を
  ①「verify が『かつ』(=`&&`)で2本以上に割れるか」②「独立2つ以上の理由で落ちうるか」で書いた。だが直後の合格例
  `typecheck && lint && test`（=1葉）に literal 適用すると、①は `&&`×3 で YES、②は型/lint/test の3独立原因で YES となり
  「割れ」＝逆判定。手順どおり読む AI と例に従う AI で結論が割れ、狙い（解釈ぶれ排除）を自壊させた。第2の目(basis-reviewer)が反証。
- 根因：停止条件の真の単位は「独立して落ちうる**受入事実**」なのに、判定手順を「`&&` の数／失敗原因の数」という
  **別の単位**で書いた。事実(fact)と、その検証手段（コマンド）・内部失敗原因(reason)を混同した。
- 対処：判定を「その verify は独立して落ちうる**受入事実**を2つ以上含むか？」の1問へ統一。受入事実＝マスターが独立に
  受け入れ判定したい結果／能力と定義し、複合コマンド=1事実の例と、secret scanning＋push protection=2事実の例を手順内に明示。
  basis-reviewer.md の atomic 定義も同じ1問へ整合。
- 教訓：ルールの「機械的判定」は、数える**単位**を規律本体（=受入事実）と厳密に一致させる。コマンド数・`&&`・失敗原因は
  代理指標であって単位ではない。判定手順を書いたら、必ず既存の合格例に literal 適用して逆判定が出ないか自己テストする。

## 2026-07-23 承認3層化で「審判集合」を狭く定義し、AIが自分のCIを緩められる裏口を開けた（マージ前に第2の目が捕捉）
- 事象：承認負担の構造改革B案で審判集合（tier-2＝人間必須）を `.github/workflows/**`・`.github/scripts/**`・reviewers台帳・
  ルートAGENTS.md・roadmap描画エンジンだけで定義した。だが CI の「緑」の定義を実際に決めるのは各 `package.json` の
  `test`/`lint` scripts・直下 `scripts/verify-roadmap-evidence.mjs`（evidence偽造検査器）・`tsconfig*`/`pnpm-lock`/`.node-version` 等で、
  これらが tier-0 に落ちていた。AI が `"test":"echo ok"` へ書き換えたPRが人間もbotも通さず自分で緩めたCIで緑になり
  auto-merge される裏口。＝本改革の目的（本人採点の禁止）を正面から破る穴。第2の目(basis-reviewer)が反証し objection。
- 根因：「審判＝審判を動かす仕組み(workflows/scripts)」とだけ捉え、「審判＝緑の判定基準そのもの(scripts本体/config/依存固定)」を
  取りこぼした。守るべき対象を"入れ物"で列挙し"中身"を落とした。特に evidence 検査器が `.github/scripts/` でなく直下 `scripts/` に
  在ることを実測せず、名前の近さで被覆したつもりになった。
- 対処：tier-2 に各 `package.json`・`^scripts/`・`tsconfig*`/`vitest`/`eslint`/`pnpm-workspace`/`pnpm-lock`/`.node-version`/
  `.tool-versions`/`.npmrc` を追加（basis-gate.sh・AGENTS.md・docs/basis-gate.md を同期）。実装コード本体(apps/**/src)は tier-0 のまま。
  併せて auto-merge の自己チェック除外を部分一致→完全一致(job名 `auto-merge`)へ、skipped を緑扱いしない強化も実施。
- 教訓：「AI が自分の合格を偽造できる経路」を塞ぐときは、審判を動かす仕組みだけでなく**緑の判定基準を決める全ファイル**
  （scripts本体・各config・依存/ランタイム固定）まで含める。パスは思い込みでなく `git ls-files` で実測して被覆を確認する。
  基準を凍結する変更は必ず第2の目に敵対レビューさせてからマージへ回す（今回それが穴を捕捉した＝門が機能した実例）。

## 2026-07-23 branch protection 未設定のまま運用し、赤の tier-2 PR(#26)が手動マージで通った／handoff を tier-2 と束ね余計に手動を増やした
- 事象：tier-1 の bot 登録PR#26 は basis-gate が「tier-2 承認待ち」で赤だったが、**branch protection 未設定のため物理ブロックが効かず手動マージが通った**。
  結果、実稼働未確認の coderabbitai[bot] が tier-1 レビュアーとして main に載る footgun 化。さらに是正+handoff を1つのPR#27に束ねたため、
  本来 master のマージ不要な handoff(tier-0=roadmap meta+failures.md)まで tier-2 に巻き込み、master の手動マージを不要に増やした。
- 根因：①門を「赤/緑の信号」までしか作らず**物理強制(required status check)を有効化しないまま実運用**した＝ソフト信号は人が無視できる。
  ②tier-0(handoff)と tier-2(審判集合の変更)を**1PRに混載**した＝混ぜると全体が厳しい方(tier-2)に倒れ、自動で流れるはずの handoff まで手動化する。
- 対処：handoff を tier-0 単独PRに分離（auto-merge で master 操作なしに main へ）。bot是正(placeholder 戻し)は独立の tier-2 小PRに切り出す。
  次セッション最優先で branch protection を設定し basis-gate 等を必須チェック化（check名=job名一致）。
- 教訓：①門は「信号」だけでは守れない。**物理強制を入れて初めて赤が赤として効く**。②PRは tier をまたいで混載しない
  ＝tier-0(コード/文章/meta)と tier-2(審判集合)は別PRに割る。混ぜると自動で流れる分まで人間のマージ律速になる（＝改革の旨味を自分で消す）。

## 2026-07-23 自作 auto-merge.yml が「対象PRなし」で毎回空振り＝tier-0でも自動マージされなかった（実テストで発覚）
- 事象：tier-0 の handoff PR#28 は全11チェック緑・basis-gate=tier-0 success だったが auto-merge が一度もマージしなかった。実行ログは
  毎回 **「対象の open PR なし。」**＝ PR 一覧取得 `gh api "repos/$REPO/pulls?state=open&base=main&per_page=50" --jq '...'` が
  空を返し、マージ手前で continue/exit していた。結局 Claude が MCP の merge_pull_request で手動マージして handoff を main に載せた。
- 根因：①自作ワークフローの PR 列挙クエリが実環境で PR を拾えていない（`&base=main` 等のクエリ/トークン権限まわりの不備の疑い）。
  実イベントでは走っていた（status/pull_request で発火）ので「発火しない」ではなく「発火後の列挙が空」。②そもそも private 時代の
  自作 auto-merge は GITHUB_TOKEN 起因イベントが別ワークフローを再起動しない制約とも相性が悪く、堅牢でない。
- 対処(方針)：**公開化した今、自作 auto-merge.yml を捨て、GitHub ネイティブの auto-merge + branch protection に置換する**（次セッション）。
  ネイティブは「必須チェック緑で自動マージ」を公式提供し、GITHUB_TOKEN 制約や列挙バグの影響を受けない。＝物理強制(branch protection)と一体で入る。
- 教訓：自動化は「動くはず」で終わらせず**実PRで最後(マージ成立)まで通して確認**する。既製の堅牢機構(ネイティブ auto-merge)がある所を
  自作ワークフローで代替しない（特に GITHUB_TOKEN の再起動制約が絡む領域）。当座は tier-0 を Claude が MCP で直接マージすれば master は不介在。

## 2026-07-24 tier-1 bot の設定ファイル(.coderabbit.yaml)を審判集合から落としかけた／branch protection 物理強制はツールで実行不能と確定
- 事象：承認ゼロ化のため CodeRabbit を実稼働させる `.coderabbit.yaml`(`request_changes_workflow: true`) を追加する際、当初これを
  tier-0 のまま入れようとした（basis-gate の tier-2 リスト外）。tier-0 だと AI が後で `request_changes_workflow: false` 等へ勝手に
  緩め、tier-1 の反証(CHANGES_REQUESTED)機能を無力化する裏口になる（2026-07-23「審判集合を狭く定義」と同型の穴）。実装中に気づき
  tier-2 へ格上げした。加えて、branch protection の物理強制 ON は当セッションのツールでは実行不能と確定：MCP github に該当ツール
  無し／直 API は proxy が 403(GitHub access is not enabled)／`gh` CLI 無し。＝マスターが GitHub 画面で Ruleset を作る1操作が構造的に必須。
- 根因：①「bot が誰か(bot-reviewers.txt)」は審判集合に入れていたが「bot が**どう裁くか**(.coderabbit.yaml)」を見落とした＝審判の
  "中身"の取りこぼし。②「branch protection を設定する」を暗にツールで代行できると仮定しかけた（実際は admin の画面操作のみ）。
- 対処：basis-gate.sh の tier-2 判定に `.coderabbit.yaml` を追加し、AGENTS.md・docs/basis-gate.md の審判集合列挙にも明記。
  docs/basis-gate.md に「必須チェックに Require approvals を付けると tier-0 が formal Approve を持たず自作 auto-merge の
  GITHUB_TOKEN マージが永久ブロックされる」ことも明記（承認は basis-gate に一元化）。
- 教訓：①第2の目(bot)を導入する時は「誰が裁くか」だけでなく「どの設定でどう裁くか」の**設定ファイルまで審判集合に凍結**する。
  ②branch protection/Ruleset の作成・変更は **admin の画面操作のみ＝AI は代行不能**。手順を docs 化してマスターに委ねる（ツールで
  やろうとして空回りしない）。③承認は `basis-gate`(必須ステータスチェック)に一元化し、GitHub native の Require approvals は使わない
  （bot 承認を数えない＋GITHUB_TOKEN マージを殺す）。

## 2026-07-24 tier-2 の「マスターが自分のPRをApprove」は GitHub 仕様で不可能＝承認導線が破綻していた
- 事象：承認ゼロ化のため tier-2 PR(#30)をマスターに承認させようとしたが、GitHub は**PR作者が自分のPRをApproveできない**仕様。
  当リポの全PRは Claude Code が `rahiseko-alt`（＝マスター本人）名義で作成するため、basis-gate の tier-2「rahiseko-alt の APPROVED で緑」は
  **永久に満たせない**。＝branch protection で `basis-gate` を必須化し Bypass を空にすると、tier-2 は誰にも通せず全ルール変更がデッドロック。
- 根因：basis-gate のtier-2 承認を「GitHub formal Approve」に固定したが、作者=承認者が同一人物になる本運用（AIがマスター名義でPR作成）を
  考慮していなかった。過去の tier-2 PR は実は Approve ではなく**マスターの手動マージ**で通しており（＝承認導線は最初から機能していない）、
  branch protection 未設定ゆえ表面化していなかっただけ。
- 対処：tier-2 の承認＝**マスターが自分でMergeボタンを押す**行為に定義し直す。物理強制は「Bypass list にリポ管理者(マスター)を入れる」
  ＝AI(auto-merge/MCP)は必須チェック赤で物理ブロック・マスターだけが赤いtier-2を意図的にMergeできる、で実現（Bypass空は不可）。
  基準変更を機械承認で完全ロックしたい場合の次善は、Approveの代わりにマスターのコメント/ラベル信号をbasis-gateが読む改修（将来課題）。
- 教訓：承認の「導線」は仕組みを作る前に**実際に人がその操作をできるか**を1回試す。AIがマスター名義でPRを作る運用では formal Approve は
  使えない＝tier-2の合格条件は「作者本人が実行可能な操作」（Merge/コメント/ラベル）で設計する。物理強制は AI を縛り、マスターは Bypass で通す。

## 2026-07-24 承認の階層(tier-1/tier-2＝basis-gate)そのものが過剰＝マスターの使い勝手を破壊していた。廃止して普通のPRフローへ
- 事象：basis-gate による承認3層（変更のたびに「許可が要るか」を判定して止める検問所）を導入して以降、マスターが承認待ちに追われ、
  2日間を消耗。自己承認不可・自作auto-merge空振り・branch protection 手動必須…と副次問題が連鎖し、非エンジニアのマスターには
  理解も運用も不能な複雑さに。マスターの明確な指示により **basis-gate(tier-1/tier-2)を全廃**し、「AIがPRを出す→誰でもレビュー/承認→マージ」
  の一般的なフローへ戻すことを決定。
- 根因：ソロ/少人数・非エンジニアのオーナーという実態に対し、大企業級の多層承認ガバナンスを自作で被せた＝**要件に対して過剰設計**。
  「本人採点の禁止」を突き詰めるあまり、日常の全変更に承認判定を挟み、CI(普通の自動テスト)だけで足りる所を検問所で二重化した。
- 対処：basis-gate 一式（`.github/workflows/basis-gate.yml`／`.github/scripts/basis-gate.sh`／`roadmap-basis-changed.mjs`／
  `basis-reviewers.txt`／`bot-reviewers.txt`／`.coderabbit.yaml`／`docs/basis-gate.md`）を削除、AGENTS.md の「承認は3層」を撤去。
  チェックイン/アウト(handoff)・CI・roadmap-required・evidence 検査は温存。main の branch protection から必須チェック `basis-gate` を
  外すのはマスターの画面操作（ツール不可）。
- 教訓：**ガバナンスは組織規模と運用者のリテラシーに合わせる**。ソロ/非エンジニアには「PR＋CI緑＋誰でも承認→マージ」で十分。
  仕組みが目的化して使い勝手を殺したら、それ自体が最大の失敗。足す前に「この人がこれを毎日回せるか」を問う。

## 2026-07-24 検査スクリプト追記で JS 文字列を壊しかけた（コミット前に検知）
- 事象：`scripts/verify-roadmap-evidence.mjs` に日本語のエラーメッセージを追記した際、二重引用符 `"..."` の
  文字列内に生の `"ツリー"` を入れてしまい、JS 文字列が途中で閉じてパースエラーになる寸前だった。
- 根因：日本語文中の強調に半角ダブルクォートを使い、外側のリテラルと衝突させた。
- 対処：`『ツリー』` に置換。**コミット前に `node scripts/verify-roadmap-evidence.mjs` をローカル実行**して緑を確認してから push。
- 教訓：**文字列リテラル内の強調は全角『』か鉤括弧を使う**（半角クォートを本文に混ぜない）。スクリプト変更は必ず
  ローカル実行で構文まで通してからコミットする（型/lint/実行のどれかで機械に踏ませる）。

## 2026-07-24 setup.sh の owner/repo 判別を dry-run で修正（先頭2要素→末尾2要素）
- 事象：`scripts/setup.sh` で origin URL からリポジトリを判別する際、パスの「先頭2要素」を owner/repo と
  していたため、プロキシ経由の origin（`http://host/git/OWNER/REPO`）で owner=`git` と誤判定した。
- 根因：GitHub の owner/repo は常にパスの「末尾2要素」なのに、前置きパスの可能性を無視した。
- 対処：末尾2要素（`repo=${path##*/}` / `owner=$(dirname)`相当）を取る方式へ変更。`--dry-run` を先に実行して
  判別結果とペイロードを目視確認してから適用する運用にした。
- 教訓：**外部から与えられる URL は前置き・末尾の揺れを想定して末尾から取る**。破壊的操作（branch protection の
  PUT 等）は必ず `--dry-run` を実装し、対象を目視確認してから本実行する。

## 2026-07-24 「ブラウザ1クリックで branch protection」ボタンが原理的に不可能だった（実リポジトリで露見）
- 事象：新リポジトリの Actions で1クリック実行する `.github/workflows/setup.yml` を追加したが、実際に
  コピーした menu-saas で startup failure（赤×・-1s）。ワークフロー名も出ずファイルパス表示になった。
- 根因：(1) `permissions: administration: write` は GITHUB_TOKEN の有効スコープに存在せず、ワークフローが
  不正で起動失敗。(2) そもそも GitHub Actions の自動トークン(GITHUB_TOKEN)には branch protection を変更する
  権限が無い＝この方式は根本的に成立しない。ローカルの YAML parse は通るため机上では気づけず、実適用を
  検証しないまま「1クリックで済む」と説明してしまった。
- 対処：setup.yml を撤去。branch protection は「管理者本人のブラウザ操作(Settings→Branches、道具不要)」を
  正の手順にし、`bash scripts/setup.sh` は gh 認証済みエンジニア向けの代替に降格。AGENTS.md 手順0/_TEMPLATE.md/
  setup.sh コメントを是正。
- 教訓：**「サーバー側の権限が要る操作」を自動トークンで賄えると仮定しない**。権限モデル(誰のトークンに何が
  できるか)を先に確認する。**外部に出す前に必ず実環境で1回実行して赤/緑を見る**（机上の parse 成功を根拠に
  「動く」と言わない）。非エンジニア向けは「その人が実際にクリックだけで完了できるか」を実物で確かめる。

## 2026-07-24 手順0-b/nav が「Branches」を指したが GitHub 現行UIは Rulesets 既定＝実操作で迷子になった
- 事象：新リポ(public)の機械強制を有効化する実作業で、AGENTS.md 手順0-b と roadmap の nav は「Settings→**Branches**
  で branch protection、**Rulesets ではない**」と書いていた。だが GitHub の現行 UI はデフォルトで **Rulesets**
  (`settings/rules/...`) に誘導し、マスターはそこへ着いた。Rulesets 側は (1)Enforcement status が既定 **Disabled**
  (2)Target branches が未設定だと **"Applies to 0 targets"** で一切適用されない、という有効化2点が doc に無く、
  「ci-green は選べたのに効かない(作ったのに適用0件)」状態で手が止まった。ナビの都度説明で復旧したが、次コピーで再発する構造だった。
- 根因：①「Rulesets ではない」という記述が**無料 Private 前提の古い知見**のまま絶対化されていた。**public では Rulesets は
  正常に効く**うえ現行UIの既定なのに、doc が経路そのものを否定していた。②Rulesets 特有の有効化手順(Active 化／Include default
  branch)を doc 化しておらず、UI の既定経路に沿うと必ず詰まる状態だった。
- 対処：AGENTS.md 手順0-b を「public ならどちらでも効く。**(A) Rulesets(現行UI既定・推奨)＝Active化+Include default branch+
  ci-green の3点**／(B) 従来 Branches は代替」へ改訂。roadmap の `meta.handoff.nav` 項目2も同じ3点＋"Applies to 0 targets"の
  警告を明記。無料 Private で効かない旨は前提(0-a)側へ寄せた。
- 教訓：**UI 手順 doc は「そのツールの現行の既定経路」に追従させる**（否定形で古い前提を絶対化しない）。設定は「作れたか」でなく
  「**Active かつ対象が1件以上で実際に適用されているか**」まで書く／確かめる。実操作で詰まった箇所は、その場の口頭ナビで終わらせず
  **必ず doc(手順0・nav)に反映**して次コピーでの再発を断つ。

## 2026-07-25 自分の diff と無関係に pnpm audit が新規 advisory で赤化しマージを塞いだ
- 事象：roadmap ツリー作成のPR#2で CI が赤。原因は自分の変更ではなく、新規公表の advisory
  GHSA-mh99-v99m-4gvg（brace-expansion <=5.0.7 の DoS）を `pnpm audit --audit-level moderate` が検出。lockfile に
  実際の脆弱版 `brace-expansion@5.0.7` が推移依存で入っていた（前日まで緑＝時刻ベースで新規赤化＝base の main でも赤化する条件）。
- 根因：依存の脆弱性は"自分のdiffと無関係"に時刻で赤化しうる。加えて `roadmap-required`（全PRに roadmap 差分必須）があるため
  **audit 修正だけの単独PRは作れない**（roadmap 差分ゼロで弾かれる）。この2制約で「無関係な赤をどう緑にしてマージするか」で一瞬詰まる。
- 対処：`pnpm.overrides` に `"brace-expansion@<5.0.8": ">=5.0.8"` を追加→ `pnpm install` で lockfile 更新→ 型/Lint/テスト/
  ビルド/audit をローカル全緑確認→ **roadmap PR に同梱**して push。ブランチ保護の ci-green を満たしマージ成立。
- 教訓：①CI 赤を見たら**まず自分のdiff起因か advisory/base起因かを切り分ける**（audit ログの Package/GHSA を読む）。
  ②依存脆弱性は `pnpm.overrides` の**範囲指定（`pkg@<patched`: `>=patched`）**でピンポイント修正し、必ずローカルで全チェック緑まで確認してから push。
  ③`roadmap-required` 環境では**"無関係な修正"も roadmap 更新PRに同梱する**のが構造上正しい（単独PRは弾かれる）。

## 2026-07-25 セッション環境からnpmレジストリに到達できずローカルの型/Lint/テスト/ビルド/auditが実行不能だった（D2実装セッション）
- 事象：D2（概算UI）実装後、AGENTS.md の「コミット前に必ずワークスペース全体のチェックを緑にする」に従い
  `pnpm install --frozen-lockfile` を実行したところ、`@swc/helpers` 等のtarball取得で `ERR_PNPM_FETCH_403`。
  `registry.npmjs.org` への直接curl・プロキシ経由curlのどちらも403。pnpmの仮想ストア(`node_modules/.pnpm/*`)には
  パッケージ名のディレクトリだけが存在し中身(tarball展開後の実体)が空という状態で、実際にはほぼ何も取得できていなかった。
- 根因：このセッションの egress ポリシーで `registry.npmjs.org` へのアクセスが拒否されていた
  （`/root/.ccr/README.md` の分類でいう「403 = org policy denial、リトライ・迂回禁止、報告のみ」に該当）。
  過去セッション（D1実装時など）は同じリポジトリでも通っていた形跡があり、セッションごとにネットワークポリシーが
  異なりうる。
- 対処：ローカルでの機械検証を諦めず代替を積んだ——①グローバル（`/opt/node22`配下）の prettier で追加ファイルの
  構文パースが通ることを確認、②型・エクスポート名は依存先ファイル（lib/estimate.ts）と手動で照合、③テストの期待値は
  PERT計算を手計算で検算、④ネットワーク不要な `node scripts/verify-roadmap-evidence.mjs` はローカル実行して緑を確認。
  その上で「ローカルでは typecheck/lint/test/build/audit を実行できなかった」ことを handoff.trouble と meta.next に
  明記し、CI（ネットワークのあるGitHub Actions側）での確認を次アクションとして引き継いだ。
- 教訓：**セッションのネットワークポリシーは毎回同じとは限らない**。`pnpm install` が失敗したら早めに
  `curl -sS $HTTPS_PROXY/__agentproxy/status` と直接curlで「一時的な障害か org policy denial か」を切り分け、
  denial ならリトライで粘らず（README方針どおり）代替検証に切り替えて時間を浪費しない。**ローカル全緑にできない
  ときは、それを隠さず handoff/次の一手に明記し、CIでの確認をタスクとして必ず引き継ぐ**（本人採点で「多分大丈夫」と
  コミットしない）。

## 2026-07-25 auto-mergeがPR#13の最初のコミットだけで先にマージし、後続のレビュー修正・ドキュメントがmainから漏れた
- 事象：D2実装PR#13にauto-mergeが有効で、最初のコミット（`4cfb9d0` feat(D2)）でCIが緑になった時点で即座にsquash-merge（`41c9786`）された。
  その後同じブランチに積んだ「CodeRabbit指摘（入力欄の空欄化・負値入力で直前値へ差し戻される不具合）の修正コミット」と
  「D2デモ台本の追加コミット」はPRが既にclosed/merged状態だったため、pushしてもmainに反映されず、リモートブランチ上に取り残された。
  次のセッションでPR状態を確認して初めて発覚（実際に修正・ドキュメントがmainに載ったかを自己申告のpush成功だけで確認していなかった）。
- 根因：①auto-mergeは「PRが開いている間の最新コミット」ではなく「その時点でCIが緑になったコミット」を対象にマージするため、
  レビュー対応中の追いpushとauto-mergeのタイミングが競合しうる。②pushが成功した＝mainに反映された、と暗黙に仮定し、
  PRのマージ後に`pull_request_read`でhead shaとmainの実差分を照合していなかった。
- 対処：`git rebase --onto origin/main <merged-commit> <branch>`で未マージの2コミットをmain最新の上に載せ直し、
  force-with-leaseでpushして新PRを作成（既マージPRへの追いpushはしない＝2026-07-22の教訓と同型）。
- 教訓：**レビュー指摘やフォローアップをauto-mergeが効いているPRの同一ブランチに追いpushしない**。マージ後に気づいた場合は
  「新規ブランチとして続きを積む」手順（本セッションの運用ルールに明記済み）に必ず従う。**pushが通った＝mainに入った、
  と自己申告を信じず、`pull_request_read`のhead sha / `git log origin/main..branch`で実際にmainへ届いたか毎回照合する**。

## 2026-07-25（追記）上記エントリの根因記述を直接編集で書き換えかけた（append-only原則違反）
- 事象：直前のエントリ（本ファイル同日）に対し、CodeRabbitのレビューで「auto-mergeが複数コミットから特定の
  コミットを選んだ、という内部動作までは断定できない」という妥当な指摘を受けた際、**元の根因記述を編集で
  書き換えて**しまった。本ファイルの冒頭で明言している「消さずに積む（append-only）」という自分自身のルールに反する。
  CodeRabbitの再レビューで「既存の失敗記録を書き換えず、日付つきの追記として残すべき」と再度指摘され気づいた。
- 根因：「記述を正確にする」という目的にのみ気を取られ、**その記述がappend-onlyログの既存エントリである**という
  制約を見落とした。ドキュメント修正＝Editツールでその場を直す、という通常の作業パターンをfailures.mdにもそのまま
  適用してしまった。
- 対処：書き換えた根因記述を元の文言に復元し、本エントリを新規追記として積むことで訂正した。
- 教訓：**`docs/failures.md` の既存エントリは内容が不正確だと分かっても直接編集しない**。訂正は必ず
  「日付＋（追記）＋何がどう不正確だったか＋正しい理解」の新規エントリとして積む。failures.md を触る前に
  「これは新規追記か、既存エントリの編集か」を自問し、編集ならEditツールを使う前に立ち止まる。

## 2026-07-25 同一セッション内でauto-mergeが3回連続でレビュー対応中のPRを先にマージした（PR#13→#14→#15）
- 事象：D2枝の作業で、PR#13（初期実装）・PR#14（CodeRabbit修正+デモ台本）・PR#15（さらなるCodeRabbit修正）の
  3件が、いずれも「CIが緑になった直後」にauto-mergeで即マージされた。CodeRabbitの非同期レビューはCIより遅れて
  到着するため、毎回「マージ後にレビューコメントが届く→追いpushできない→mainからブランチを作り直して新PRを出す」
  というサイクルを3回繰り返した。
- 根因：このリポジトリの運用モデル（AGENTS.md）は「CIが緑＝auto-mergeで即マージしてよい」を前提にしているが、
  CodeRabbitのレビューはCIの完了を待たず並行して走り、CI完了（＝auto-merge発火）より後に結果が届くことがある。
  レビューが「マージを止める」役割を持たない設計のため、**レビューコメントが有効な間はPRがまだ開いている**という
  暗黙の前提が成立しない。
- 対処：都度、`git checkout -B <branch> origin/main` でブランチを作り直し、未反映の修正を新PRとして出し直した
  （既マージPRへの追いpushはしない、を徹底）。
- 教訓：**このリポジトリでは「PRを出したら早期にauto-mergeされうる」を前提に動く**。レビュー対応を待ってから
  1つのPRにまとめようとせず、①CIを通すために必要な変更を最初のPRで一括して出し切る、②マージ後に届いた
  レビュー指摘は「新しいフォローアップ作業」として都度ブランチを作り直す、の2点を徹底する。頻発するようなら、
  「レビュー対応を待ってからマージしたい」という運用に変えたいかどうかをマスターに確認する価値がある
  （auto-mergeの無効化やレビュー必須化はリポジトリ設定の変更を伴うため、AIの独断では変更しない）。

## 2026-07-25（さらに追記）「元の文言へ復元する」編集そのものも append-only 違反だった
- 事象：直前々のエントリで「書き換えてしまった根因記述を元の文言に復元した」と記録したが、CodeRabbitの
  再レビューで「復元という行為自体も、過去エントリの行を diff で書き換えている点で append-only 違反」と
  指摘された。確認すると、その通りだった——訂正の方向（書き換え／復元のどちらか）に関わらず、**過去に
  書かれた行に一切触れないこと**が append-only の要件であり、「正しい内容に戻す」ことは免罪符にならない。
- 根因：「append-only＝内容を勝手に劣化させない」という理解に留まり、「append-only＝過去の行を diff 上で
  一切変更しない（内容が改善方向でも不可）」という、より厳密な要件まで踏み込めていなかった。
- 対処：これ以上、上記の根因記述（直前々のエントリの該当行）には一切手を加えない。現在mainに存在する
  文言をそのまま確定させる。今後の訂正は本エントリのように**新規追記のみ**で行う。
- 教訓：**failures.md の既存行は「復元」を含め二度と Edit しない**。誤りに気づいた時点で、その場で直そうとせず
  必ず新規エントリを追記する。この判断に迷う余地を無くすため、「failures.mdで最初にEditツールを使いたくなったら、
  対象が既存行かどうかをまず確認し、既存行なら使わずAppend（ファイル末尾への追記）に切り替える」を機械的な
  手順として徹底する。
