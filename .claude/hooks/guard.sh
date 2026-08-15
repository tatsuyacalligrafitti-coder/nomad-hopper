#!/bin/bash
# PreToolUseフック：危険コマンドの決定論的ブロック
# 置き場所の方針：このファイルはリポジトリの外に置く。git管理下に置くと、
# 設定を持たないブランチに切り替えた瞬間にブロックが無効化されるため。
INPUT=$(cat)

# ---- コマンド文字列の取り出し -----------------------------------------
# ここは過去に2度、穴が見つかっている。どちらも「文字列の切り出し方」が原因。
#
#   2026-08-12 朝  末尾に残る引用符のせいで "( |$)" で終わるパターン
#                  （main/develop へのpush）が一致せず素通りした
#   2026-08-12 夕  内側の引用符が \" のまま残るため、危険な操作を引用符で
#                  包んだ形（bash -c で本番ブランチへ送信するなど）が素通りした。
#                  さらに [^,}]* での切り出しが「,」や「}」で値を途中で
#                  打ち切っていた（カンマをはさむと後ろを見落とす）
#
# そこで切り出しを次の手順に変えた。ブロック規則そのものは1つも変えていない。
#   1. "command" が出てくるたびに、その値を取り出す（出現順に依存しない）
#   2. \\ と \" をいったん目印に退避し、次の「生の "」までを値とする
#      （= 内側の引用符で値が途切れない。「,」「}」でも途切れない）
#   3. 退避した目印と残った \ は空白に戻す
#      （引用符・改行などの区切りを空白として扱うので、
#        引用符で包まれていても "main" の直後が空白になり、パターンに当たる）
CMD=""
REST="$INPUT"
while :; do
  case "$REST" in
    *'"command"'*) ;;
    *) break ;;
  esac
  REST="${REST#*\"command\"}"
  S="${REST#*:}"
  S="${S#*\"}"
  S="${S//\\\\/$'\001'}"
  S="${S//\\\"/$'\002'}"
  S="${S%%\"*}"
  S="${S//$'\002'/ }"
  S="${S//$'\001'/ }"
  S="${S//\\/ }"
  CMD="${CMD}
${S}"
done

# 【重要】ここの書き方について
# 2026-08-12から、guard.sh は「走らせるスクリプトの中身」も検査する。
# そのため、パターンをそのままの文字列で書くと、guard.sh 自身が
# 自分のパターン一覧に反応してしまい、guard.sh を走らせられなくなる。
# （実際にそうなった。cp で配ることすらできなかった）
#
# そこで最後の1文字を [ ] で囲む。正規表現としての意味は変わらない
#   [e] は「eという1文字」＝ e と同じ
# が、この行そのものはパターンに一致しなくなる。
# 例: "--forc[e]" は --force に一致するが、"--forc[e]" という文字列には一致しない。
#
# 2026-08-16 に見つかった4つ目の穴について
#   作業フォルダを2つに増やす作業の実測中に見つかった。
#   git は「git」と「push」の間にオプションを挟める。
#     git -C <フォルダ> push origin main
#     git -c core.pager=cat push origin main
#     git --no-pager push origin main
#   どれも「git push」という並びを含まないため、素通りしていた（実測で確認）。
#   worktree でフォルダが増えると -C を使う書き方が普通になるため、
#   当たる見込みが上がる。そこで「git と push の間にオプションが挟まる形」を
#   足した。既存の規則は1つも消していない。締める方向だけ。
#   -C はフォルダ名を、-c は設定を、それぞれ後ろに1語ともなう。
#   オプションだけを読み飛ばす書き方では -C の後ろのフォルダ名で外れる
#   （最初にそう書いて、実測で外れることを確かめた）。
#   そこで「-で始まる語」＋「その後ろに続く1語（あれば）」の繰り返しとする。
GIT_OPT="( +-[^ ]+( +[^- ][^ ]*)?)*"
BLOCK_PATTERNS=(
  "git${GIT_OPT} push.*origin (main|develop)( |$)"
  "git${GIT_OPT} push.*origin .*:(main|develop)( |$)"
  "git${GIT_OPT} push --forc[e]"
  "git${GIT_OPT} push -[f]"
  "rm -r[f] /"
  "rm -r[f] ~"
  "sud[o] "
  "cur[l].*\|.*bash"
  "cur[l].*\|.*sh"
  "wge[t].*\|.*bash"
  "chmod -R 77[7]"
  "verce[l].*--prod"
  "npx verce[l].*--prod"
)

check_text() {   # $1=調べる文字列  $2=どこから来たかの説明
  local PATTERN
  for PATTERN in "${BLOCK_PATTERNS[@]}"; do
    if printf '%s' "$1" | grep -qE "$PATTERN"; then
      echo "【guard.sh】危険パターンを検出したためブロックしました: $PATTERN" >&2
      [ -n "$2" ] && echo "  見つかった場所: $2" >&2
      exit 2
    fi
  done
}

# ---- まずコマンド文字列そのものを見る ---------------------------------
check_text "$CMD" ""

# ---- 次に、走らせようとしているスクリプトの中身を見る -------------------
# 2026-08-12の実測で分かったこと:
#   guard.sh はコマンド文字列しか見ていなかったため、危険な操作を
#   スクリプトに書いて bash で走らせると素通りしていた。
#     直接書く            → 止まる
#     bash ファイル       → 素通り  ← ここをふさぐ
#     sh ファイル         → 素通り
#     . ファイル          → 素通り
#
# 調査のたびに承認ダイアログが出るのを避けるため、複雑なコマンドは
# ファイルに書いてから走らせる方針にした。その方針が安全装置の抜け道に
# ならないよう、走らせるファイルの中身も同じ規則で調べる。
#
# スクリプトがさらに別のスクリプトを呼ぶ場合も3段までたどる。
# 同じファイルは1度しか読まない（呼び合っていても止まらないように）。
# 大事な条件: 「走らせようとしているファイル」だけを見る。
# ファイル名がただ書かれているだけ（rm や cp や cat の相手）は見ない。
# 2026-08-12の実測で、ここを区別しないと
#   rm -f 調査用スクリプト.sh
# のような後片づけまでブロックされることが分かった（締めすぎ）。
SEEN_FILES=""

scan_scripts() {   # $1=調べる文字列  $2=あと何段たどるか
  local TEXT="$1"
  local DEPTH="$2"
  [ "$DEPTH" -le 0 ] && return 0

  local NORM TOK BODY CAND AT_CMD WANT

  # 改行と区切り記号を目印(@@)に変える。目印の直後がコマンドの先頭になる
  NORM="$(printf '%s' "$TEXT" | tr '\n' ';' | sed -e 's/[;|&()]/ @@ /g' -e 's/[`"'"'"']/ /g')"

  set -f                 # ここでは * を勝手に展開させない
  AT_CMD=1               # 次の語はコマンドの先頭か
  WANT=0                 # bash / sh / source の直後を待っているか
  for TOK in $NORM; do
    if [ "$TOK" = "@@" ]; then AT_CMD=1; WANT=0; continue; fi

    # bash / sh / zsh / source / . はコマンドの先頭のときだけ意味を持つ
    if [ "$AT_CMD" -eq 1 ]; then
      case "$TOK" in
        bash|sh|zsh|ksh|source|.) WANT=1; AT_CMD=0; continue ;;
      esac
    fi

    case "$TOK" in -*) continue ;; esac      # -x などのオプションは読み飛ばす

    CAND=""
    if [ "$WANT" -eq 1 ]; then
      # bash / sh / source の直後。拡張子は問わない。
      # mktemp で作った名前（拡張子なし）のスクリプトも見張るため。
      # 2026-08-12、拡張子を必須にしていたせいで .sh でないスクリプトが
      # 素通りしていた（点検スクリプトが自分で見つけた）
      CAND="$TOK"
    elif [ "$AT_CMD" -eq 1 ]; then
      # ./foo や /abs/foo のように、直接走らせようとしている形だけ。
      # git や npm のような、パスを含まないコマンド名は対象にしない
      case "$TOK" in */*) CAND="$TOK" ;; esac
    fi
    AT_CMD=0; WANT=0
    [ -n "$CAND" ] || continue

    case "$CAND" in "~/"*) CAND="$HOME/${CAND#\~/}" ;; esac
    [ -f "$CAND" ] || continue
    case "$SEEN_FILES" in *"|$CAND|"*) continue ;; esac
    SEEN_FILES="$SEEN_FILES|$CAND|"

    # 中身が文字でないもの（アプリ本体など）は読まない
    grep -Iq . "$CAND" 2>/dev/null || continue

    # 大きすぎるファイルは先頭1MBだけ見る（ふつうのスクリプトは数KB）
    BODY="$(head -c 1000000 "$CAND" 2>/dev/null)" || continue
    set +f
    check_text "$BODY" "$CAND"
    scan_scripts "$BODY" $((DEPTH - 1))
    set -f
  done
  set +f
}

scan_scripts "$CMD" 3

exit 0
