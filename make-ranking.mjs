#!/usr/bin/env node
/**
 * make-ranking.mjs — 記事 rindo-ranking.html の数値部分を生成する。
 *
 * 出典はアプリ同梱データの正本（_tools/rindo-store/dist-public/coverage.json）。
 * **記事中の数値を手で打たない**——サイトとアプリが食い違うと、その食い違い自体が
 * 信用を失う（pawweather-site / pooldose-site と同じ型）。
 *
 * 使い方: node make-ranking.mjs
 *   rindo-ranking.html の <!-- data:start --> 〜 <!-- data:end --> を書き換える。
 *   マーカーの外は手書きの本文なので触らない。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "..", "_tools", "rindo-store", "dist-public", "coverage.json");
const PAGE = join(here, "rindo-ranking.html");

const cov = JSON.parse(readFileSync(SRC, "utf8"));
const prefs = Object.entries(cov["県別"]).map(([name, p]) => ({
  name,
  officialKm: p["公式km"],
  officialKokuyuKm: p["公式国有林km"],
  osmKm: p.osm["km"],
  osmCount: p.osm["本数"],
  dirtCount: p.osm["未舗装本数"],
  bundledKm: p["同梱km"],
}));

const sum = (f) => prefs.reduce((a, p) => a + f(p), 0);
const fmt = (n) => Math.round(n).toLocaleString("ja-JP");

const totalOfficial = sum((p) => p.officialKm);
const totalKokuyu = sum((p) => p.officialKokuyuKm);
const totalOsmCount = sum((p) => p.osmCount);
const totalDirt = sum((p) => p.dirtCount);
const totalBundled = sum((p) => p.bundledKm);

const ranked = [...prefs].sort((a, b) => b.officialKm - a.officialKm);

const rows = ranked
  .map(
    (p, i) => `      <tr>
        <td class="rank">${i + 1}</td><th scope="row">${p.name}</th>
        <td>${fmt(p.officialKm)}</td><td>${fmt(p.bundledKm)}</td>
        <td>${fmt(p.osmCount)}</td><td>${fmt(p.dirtCount)}</td>
      </tr>`
  )
  .join("\n");

const asOf = `${cov["時点"]}（${cov["出典"]}）`;

// 「万km」の換算は1万で割る（1000で割ると桁が10倍ずれる——初版で実際に踏んだ）
const man = (km) =>
  (km / 10000).toFixed(1).replace(/\.0$/, "");

const block = `<!-- data:start（node make-ranking.mjs が生成。手で直さない） -->
  <p class="lead">全国の林道の総延長は<strong>約${man(totalOfficial)}万km</strong>
  （林野庁の統計・${cov["時点"]}）。うち約${man(totalKokuyu)}万kmが国有林の林道です。
  一方、地図（OpenStreetMap）に線として引かれている林道は全国で
  <strong>${fmt(totalOsmCount)}本</strong>、うち未舗装と記録されているのは
  ${fmt(totalDirt)}本にとどまります。</p>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th></th><th>都道府県</th>
          <th>公式延長<br><span class="unit">km</span></th>
          <th>地図で引ける延長<br><span class="unit">km ※</span></th>
          <th>地図上の本数</th><th>うち未舗装</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
      <tfoot>
        <tr>
          <td></td><th scope="row">全国</th>
          <td>${fmt(totalOfficial)}</td><td>${fmt(totalBundled)}</td>
          <td>${fmt(totalOsmCount)}</td><td>${fmt(totalDirt)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p class="hint">表は横にスワイプできます &rarr;</p>
  <p class="muted">公式延長: ${asOf}。国有林の林道を含む。<br>
     ※「地図で引ける延長」はアプリ同梱データ（OpenStreetMap＋林野庁 国有林GIS。
     両方に線がある区間の重複を除いた推定値）。本数・未舗装は OpenStreetMap の実測。</p>
  <!-- data:end -->`;

const page = readFileSync(PAGE, "utf8");
const next = page.replace(
  /<!-- data:start[\s\S]*?<!-- data:end -->/,
  block
);
if (next === page && !page.includes("data:start"))
  throw new Error("rindo-ranking.html にマーカーが無い");
writeFileSync(PAGE, next);
console.log(
  `更新した: 公式 ${fmt(totalOfficial)}km / 同梱 ${fmt(totalBundled)}km / ` +
    `OSM ${fmt(totalOsmCount)}本（未舗装 ${fmt(totalDirt)}本）/ 47都道府県`
);
