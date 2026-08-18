#!/usr/bin/env node
/**
 * make-articles.mjs — 記事2本の数値部分を生成する（2026-08-18）。
 *
 *   rindo-closure.html … 林道の通行止めはどこで調べるか（自治体の公表状況を数える）
 *   rindo-dirt.html    … ダート（未舗装）の林道はどこに多いか
 *
 * 出典はアプリ同梱データの正本（_tools/rindo-store/dist-public/）。
 * **記事中の数値を手で打たない**——サイトとアプリが食い違うと、その食い違い自体が
 * 信用を失う（make-ranking.mjs と同じ型）。
 *
 * 使い方: node make-articles.mjs
 *   各ページの <!-- data:start --> 〜 <!-- data:end --> を書き換える。
 *   マーカーの外は手書きの本文なので触らない。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, "..", "..", "_tools", "rindo-store", "dist-public");
const load = (f) => JSON.parse(readFileSync(join(DIST, f), "utf8"));

const pub = load("public-routes.json");
const cov = load("coverage.json");

const n = (v) => v.toLocaleString("ja-JP");
const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) : "0.0");

/** 記事の「時点」。データの取得日の最大値を使う（今日の日付を焼かない） */
const asOf = (() => {
  const ds = pub.flatMap((r) => (r.取得日 ? [r.取得日.slice(0, 10)] : []));
  return ds.length ? ds.sort().at(-1) : cov.時点 ?? "";
})();

function replaceBlock(file, html, marker = "data") {
  const path = join(here, file);
  const page = readFileSync(path, "utf8");
  const s = page.indexOf(`<!-- ${marker}:start`);
  const e = page.indexOf(`<!-- ${marker}:end -->`);
  if (s < 0 || e < 0) throw new Error(`${file}: ${marker} マーカーが無い`);
  const head = page.slice(0, page.indexOf("-->", s) + 3);
  writeFileSync(path, head + "\n" + html + "\n" + page.slice(e), "utf8");
}

/**
 * FAQ の構造化データ。
 *
 * 【なぜ要るか】2026-08-16 の実査で、AIに推薦されるかを7問で試したら**引用面が0/7**だった。
 * 原因はページが読み物でしかなく、「問い→答え」の形になっていないこと。
 * FAQPage にすると、問いに対する答えとして拾える面ができる。
 *
 * ⚠ **答えの中の数値も生成する。** 本文だけ生成して答えを手打ちすると、データを
 * 差し替えたときに同じページの中で数値が食い違う（この記事の信用そのものが飛ぶ）。
 */
function faqBlock(file, qa) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  replaceBlock(file, `<script type="application/ld+json">\n${JSON.stringify(ld, null, 1)}\n</script>`, "faq");
}

// =====================================================================
// 記事1: 通行止めの公表状況
// =====================================================================
{
  const total = pub.length;
  const withReg = pub.filter((r) => (r.規制 ?? []).length > 0).length;

  // 県ごとの公表本数（1路線が複数県にまたがることがあるので県ごとに数える）
  const byPref = new Map();
  for (const r of pub) for (const p of r.都道府県 ?? []) byPref.set(p, (byPref.get(p) ?? 0) + 1);
  const prefsWith = byPref.size;
  const prefsZero = 47 - prefsWith;
  const top = [...byPref.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // 規制の言葉の内訳
  const words = new Map();
  for (const r of pub) for (const k of r.規制 ?? []) words.set(k, (words.get(k) ?? 0) + 1);
  const topWords = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // 鮮度: 出典ページに日付があるものだけ数える（無いものを新しい扱いにしない）
  const latest = (r) => {
    const ds = (r.根拠 ?? []).map((g) => g.最新日).filter(Boolean).sort();
    return ds.length ? ds.at(-1).slice(0, 10) : null;
  };
  const dated = pub.map(latest).filter(Boolean).sort();
  const asOfMs = Date.parse(asOf);
  const days = dated.map((d) => Math.round((asOfMs - Date.parse(d)) / 86_400_000));
  const median = days.length ? [...days].sort((a, b) => a - b)[Math.floor(days.length / 2)] : 0;
  const within90 = days.filter((d) => d <= 90).length;

  replaceBlock(
    "rindo-closure.html",
    `  <p class="lead">自治体・都道府県が公表している林道の情報を集めたところ、
  全国で <strong>${n(total)}路線</strong>ぶんが見つかりました。
  そのうち通行止めなどの<strong>規制が書かれているのは ${n(withReg)}路線</strong>です
  （${pct(withReg, total)}%）。<br>
  つまり<strong>「ネットで探しても、その林道の通行状況は出てこない」ほうが普通</strong>です。</p>

  <h2>公表の熱心さは、県によって桁が違う</h2>
  <p>公表が1本でも見つかった県は <strong>${prefsWith}県</strong>。
  残りの <strong>${prefsZero}県</strong>では1本も見つかりませんでした。</p>
  <div class="scroll">
    <table>
      <thead><tr><th></th><th>都道府県</th><th>公表が見つかった路線</th></tr></thead>
      <tbody>
${top
  .map(
    ([name, c], i) =>
      `        <tr><td class="rank">${i + 1}</td><th scope="row">${name}</th><td>${n(c)}</td></tr>`
  )
  .join("\n")}
      </tbody>
    </table>
  </div>
  <p class="muted">※ 見つからなかった県＝その県が何も出していない、とは限りません。
  こちらが辿れていないだけの可能性もあります。1本も見つからなかった県は隠さずそう書いています。</p>

  <h2>何が書かれているか</h2>
  <div class="scroll">
    <table>
      <thead><tr><th>書かれている内容</th><th>路線数</th></tr></thead>
      <tbody>
${topWords
  .map(([w, c]) => `        <tr><th scope="row">${w}</th><td>${n(c)}</td></tr>`)
  .join("\n")}
      </tbody>
    </table>
  </div>

  <h2>いちばん大事なのは「いつの情報か」</h2>
  <p>出典のページに日付が入っていたのは <strong>${n(dated.length)}路線</strong>ぶん。
  その日付から数えた経過日数の<strong>中央値は ${n(median)}日</strong>で、
  90日以内に更新されていたのは <strong>${n(within90)}路線</strong>でした。
  いちばん古いものは <strong>${dated[0]}</strong> のページです。</p>
  <p>林道の通行止めは<strong>数日で変わります</strong>。
  「通行止めと書いていない＝通れる」ではありませんし、
  「解除と書いてある＝いま通れる」でもありません。
  日付を必ず見て、迷ったら管理者（市町村の林務担当・森林管理署）に電話するのが確実です。</p>
  <p class="muted">数え方: ${asOf} 時点で集めた公開情報。出典・時点はアプリ内の各路線カードに全部出しています。</p>`
  );

  faqBlock("rindo-closure.html", [
    [
      "林道の通行止めはどこで調べればいい？",
      `市町村の林務担当・都道府県の林務課・森林管理署の公表ページが一次情報です。ただし全国で見つかった${n(total)}路線のうち、規制が書かれているのは${n(withReg)}路線（${pct(withReg, total)}%）だけで、公表が1本も見つからない県も${prefsZero}県あります。載っていない林道のほうが多いので、迷ったら管理者に電話するのが確実です。`,
    ],
    [
      "「通行止め」と書かれていなければ通れる？",
      "いいえ。公表されていない林道のほうが多いので、記載が無いことは通行できる根拠になりません。逆に「解除」と書かれていても、その情報がいつ時点かを見る必要があります。",
    ],
    [
      "公表されている通行止め情報はどれくらい新しい？",
      `出典ページに日付が入っていた${n(dated.length)}路線で数えると、経過日数の中央値は${n(median)}日でした。90日以内に更新されていたのは${n(within90)}路線で、最も古いものは${dated[0]}のページです。`,
    ],
  ]);
}

// =====================================================================
// 記事2: ダート（未舗装）はどこに多いか
// =====================================================================
{
  const prefs = Object.entries(cov.県別).map(([name, p]) => ({
    name,
    count: p.osm.本数,
    dirt: p.osm.未舗装本数,
  }));
  const total = prefs.reduce((a, p) => a + p.count, 0);
  const dirt = prefs.reduce((a, p) => a + p.dirt, 0);
  const byCount = [...prefs].sort((a, b) => b.dirt - a.dirt).slice(0, 10);
  const byRate = [...prefs]
    .filter((p) => p.count >= 200) // 母数が小さい県が率で上位に来ないように
    .sort((a, b) => b.dirt / b.count - a.dirt / a.count)
    .slice(0, 5);

  replaceBlock(
    "rindo-dirt.html",
    `  <p class="lead">地図（OpenStreetMap）に線が引かれている林道は全国で <strong>${n(total)}本</strong>。
  そのうち<strong>「未舗装」と記録されているのは ${n(dirt)}本</strong>で、全体の
  <strong>${pct(dirt, total)}%</strong>しかありません。<br>
  これは「日本の林道の9割が舗装されている」という意味では<strong>ありません</strong>。
  <strong>路面が地図に書かれていない林道のほうが圧倒的に多い</strong>、という意味です。</p>

  <h2>未舗装の本数が多い都道府県</h2>
  <div class="scroll">
    <table>
      <thead><tr><th></th><th>都道府県</th><th>未舗装の本数</th><th>地図上の本数</th><th>割合</th></tr></thead>
      <tbody>
${byCount
  .map(
    (p, i) =>
      `        <tr><td class="rank">${i + 1}</td><th scope="row">${p.name}</th>` +
      `<td>${n(p.dirt)}</td><td>${n(p.count)}</td><td>${pct(p.dirt, p.count)}%</td></tr>`
  )
  .join("\n")}
      </tbody>
    </table>
  </div>

  <h2>割合で見ると、順位が入れ替わる</h2>
  <p>本数では北海道が圧倒的ですが、<strong>「その県の林道のうち何割が未舗装と分かっているか」</strong>で
  並べ替えると顔ぶれが変わります（地図上の本数が200本以上の県だけ）。</p>
  <div class="scroll">
    <table>
      <thead><tr><th></th><th>都道府県</th><th>未舗装の割合</th><th>未舗装 / 全体</th></tr></thead>
      <tbody>
${byRate
  .map(
    (p, i) =>
      `        <tr><td class="rank">${i + 1}</td><th scope="row">${p.name}</th>` +
      `<td>${pct(p.dirt, p.count)}%</td><td>${n(p.dirt)} / ${n(p.count)}</td></tr>`
  )
  .join("\n")}
      </tbody>
    </table>
  </div>

  <h2>「未舗装と書かれていない道」の中にダートがある</h2>
  <p>地図の路面情報は、その道を歩いた・走った誰かが書き込んだときだけ付きます。
  だから<strong>書かれていない＝舗装、ではありません</strong>。
  実際に走った人の記録と突き合わせると、
  <strong>記録上ダートだった林道のうち、地図にも未舗装と書かれていたのは1割ほど</strong>でした。</p>
  <p>ダートを探すときは、①地図で未舗装と分かっている ${n(dirt)}本を起点にしつつ、
  ②路面が空欄の林道も候補として見る、の両方が要ります。</p>
  <p class="muted">数え方: ${asOf} 時点のデータ。本数は OpenStreetMap の way 単位、
  未舗装は surface タグ（gravel / dirt / ground など）と tracktype から判定。</p>`
  );

  faqBlock("rindo-dirt.html", [
    [
      "ダート（未舗装）の林道はどこに多い？",
      `地図に未舗装と記録されている本数では${byCount[0].name}が${n(byCount[0].dirt)}本で最多です。次いで${byCount
        .slice(1, 5)
        .map((p) => `${p.name}${n(p.dirt)}本`)
        .join("、")}。割合で見ると${byRate
        .slice(0, 3)
        .map((p) => `${p.name}${pct(p.dirt, p.count)}%`)
        .join("、")}の順です。`,
    ],
    [
      "日本の林道はほとんど舗装されている？",
      `いいえ。地図に線のある${n(total)}本のうち未舗装と記録されているのは${n(dirt)}本（${pct(
        dirt,
        total
      )}%）ですが、これは路面が地図に書かれていない林道が多いためです。実際に走った記録と突き合わせると、ダートだった林道のうち地図にも未舗装と書かれていたのは1割ほどでした。`,
    ],
    [
      "ダートの林道を探すにはどうすればいい？",
      `地図で未舗装と分かっている${n(
        dirt
      )}本を起点にしつつ、路面が空欄の林道も候補として見る必要があります。路面情報は誰かが書き込んだときだけ付くので、空欄は「舗装」ではなく「不明」です。`,
    ],
  ]);
}

console.log(`完了（時点 ${asOf}）`);
