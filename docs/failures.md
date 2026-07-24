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
