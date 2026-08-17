// LP の図を、アプリ同梱データから生成する。
//   node make-figures.mjs
// 入力: ../../mobile/rindo-finder/src/data/*.json（読むだけ）
// 出力: assets/coverage-47.svg / coverage-47-wide.svg / layers.svg / layers-wide.svg
//
// 数字を手で書かないためのスクリプト。値を疑ったらこれを再実行して差分を見る。
// 図の中の文字は「軸ラベル・県名・値」だけ。読ませる文章は HTML 側に置くこと。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "mobile", "rindo-finder", "src", "data");
const OUT = join(HERE, "assets");
const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jp = (n) => n.toLocaleString("en-US");

// 図の中だけで使う色。ページの CSS 変数と同じ値を、img で読ませるため SVG に焼き込む。
const STYLE = `
  :root{
    --surface:#FFFFFF; --ink:#1C1915; --mute:#5E574E;
    --dirt:#E8590C; --ref:#983E08; --grid:#D8E4CC;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --surface:#14120E; --ink:#F2EEE7; --mute:#B6ADA0;
      --dirt:#E86A1F; --ref:#FFB183; --grid:#2E4022;
    }
  }
  .bg{fill:var(--surface)}
  .bar{fill:var(--dirt)}
  .grid{stroke:var(--grid);stroke-width:1}
  .ref{stroke:var(--ref);stroke-width:1.5;stroke-dasharray:4 3}
  text{font-family:"SF Mono",Menlo,"Hiragino Sans","Hiragino Kaku Gothic ProN",ui-monospace,monospace;
       font-variant-numeric:tabular-nums}
  .lbl{fill:var(--ink);font-size:11px}
  .val{fill:var(--mute);font-size:11px}
  .axis{fill:var(--mute);font-size:10px;letter-spacing:.08em}
  .reflbl{fill:var(--ref);font-size:10px;font-weight:600}
`;

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${STYLE}</style>
<rect class="bg" x="0" y="0" width="${w}" height="${h}"/>
${body}
</svg>
`;

/* ── 1. 都道府県別の被覆率 ────────────────────────────────────────── */
const cov = read("coverage.json");
const prefs = Object.entries(cov["県別"])
  .map(([k, v]) => ({ k, cov: v["被覆率"], mine: v["同梱km"], off: v["公式km"] }))
  .sort((a, b) => b.cov - a.cov);

const totalMine = prefs.reduce((s, p) => s + p.mine, 0);
const totalOff = prefs.reduce((s, p) => s + p.off, 0);
const national = +((totalMine / totalOff) * 100).toFixed(1);

const SCALE_MAX = 90; // 最大が北海道 85.5 なので 90 で切る
const ROW = 19;
const REF_Y = 13; // 「全国 44.3%」の行。目盛りの数字と重なるので独立した行にする
const TICK_Y = 30;
const GRID_TOP = 35;
const TOP = 39;
const PAD_B = 10;
const VAL_W = 44; // 値ラベルの幅（右端に3px余らせる）

function coverageSvg({ cols, colW, labelW, gap }) {
  const perCol = Math.ceil(prefs.length / cols);
  const barW = colW - labelW - VAL_W;
  const px = barW / SCALE_MAX;
  const w = colW * cols + gap * (cols - 1);
  const h = TOP + perCol * ROW + PAD_B;
  const out = [];

  for (let c = 0; c < cols; c++) {
    const x0 = c * (colW + gap);
    const bx = x0 + labelW;
    // 目盛り 0 / 30 / 60 / 90
    for (const t of [0, 30, 60, 90]) {
      const x = bx + t * px;
      out.push(`<line class="grid" x1="${x.toFixed(1)}" y1="${GRID_TOP}" x2="${x.toFixed(1)}" y2="${h - PAD_B}"/>`);
      out.push(`<text class="axis" x="${x.toFixed(1)}" y="${TICK_Y}" text-anchor="${t === 0 ? "start" : t === 90 ? "end" : "middle"}">${t}</text>`);
    }
    // 全国平均の基準線
    const rx = bx + national * px;
    out.push(`<line class="ref" x1="${rx.toFixed(1)}" y1="${GRID_TOP}" x2="${rx.toFixed(1)}" y2="${h - PAD_B}"/>`);
    out.push(`<text class="reflbl" x="${(rx - 4).toFixed(1)}" y="${REF_Y}" text-anchor="end">全国 ${national}%</text>`);
    // 単位は右端の値の上に置く。目盛りの 90 と重なるので中央寄せにはしない
    out.push(`<text class="axis" x="${x0 + colW - 3}" y="${REF_Y}" text-anchor="end">被覆率 %</text>`);

    for (let i = 0; i < perCol; i++) {
      const p = prefs[c * perCol + i];
      if (!p) break;
      const y = TOP + i * ROW;
      out.push(`<text class="lbl" x="${x0 + labelW - 8}" y="${y + 13}" text-anchor="end">${esc(p.k)}</text>`);
      out.push(`<rect class="bar" x="${bx}" y="${y + 5}" width="${Math.max(1, p.cov * px).toFixed(1)}" height="9" rx="1.5"/>`);
      out.push(`<text class="val" x="${x0 + colW - 3}" y="${y + 13}" text-anchor="end">${p.cov.toFixed(1)}</text>`);
    }
  }
  const title = `都道府県別の林道被覆率。全国平均 ${national}%。最も高いのは${prefs[0].k} ${prefs[0].cov}%、最も低いのは${prefs[prefs.length - 1].k} ${prefs[prefs.length - 1].cov}%。降順。`;
  return { svg: svg(w, h, out.join("\n"), title), w, h, title };
}

const covNarrow = coverageSvg({ cols: 1, colW: 358, labelW: 58, gap: 0 });
const covWide = coverageSvg({ cols: 2, colW: 356, labelW: 58, gap: 28 });
writeFileSync(join(OUT, "coverage-47.svg"), covNarrow.svg);
writeFileSync(join(OUT, "coverage-47-wide.svg"), covWide.svg);

/* ── 2. 収録の層 ──────────────────────────────────────────────────
   親より子が大きくならない形にする。
   （旧サイトは「自治体の公表ページ 1,707」の下に「うち台帳の値 2,130」を置いていた） */
const publicRoutes = read("public-routes.json");
const prefRoutes = read("pref-routes.json");
const kokuyu = read("kokuyu-routes.json");

const prefNamed = prefRoutes.filter((p) => p["名"]);
const layers = [
  { lbl: "国有林のGIS", n: kokuyu.length, depth: 0 },
  { lbl: "└ うち 林道名がある", n: kokuyu.filter((k) => k["林道名"]).length, depth: 1 },
  { lbl: "県の林道台帳（名前あり）", n: prefNamed.length, depth: 0 },
  { lbl: "└ うち 延長か幅員の値がある", n: prefNamed.filter((p) => p["延長m"] != null || p["幅員"]).length, depth: 1 },
  { lbl: "自治体の公表ページ", n: publicRoutes.length, depth: 0 },
  { lbl: "└ うち 規制情報が読める", n: publicRoutes.filter((p) => p["規制"] && p["規制"].length).length, depth: 1 },
  { lbl: "└ うち 公式台帳の値がある", n: publicRoutes.filter((p) => p["公式"]).length, depth: 1 },
];
// 親子が破綻していないことを、生成時に落として気づけるようにする
for (let i = 0; i < layers.length; i++) {
  if (layers[i].depth === 1) {
    let j = i;
    while (layers[j].depth !== 0) j--;
    if (layers[i].n > layers[j].n) throw new Error(`子が親より大きい: ${layers[i].lbl} ${layers[i].n} > ${layers[j].lbl} ${layers[j].n}`);
  }
}

function layersSvg(w) {
  const maxN = Math.max(...layers.map((l) => l.n));
  const rowH = 34;
  const h = layers.length * rowH + 12;
  const out = [];
  layers.forEach((l, i) => {
    const y = i * rowH + 6;
    const x = l.depth * 12;
    out.push(`<text class="lbl" x="${x}" y="${y + 11}">${esc(l.lbl)}</text>`);
    out.push(`<text class="val" x="${w - 3}" y="${y + 11}" text-anchor="end">${jp(l.n)}</text>`);
    out.push(`<rect class="bar" x="${x}" y="${y + 17}" width="${Math.max(2, ((w - 3 - x) * l.n) / maxN).toFixed(1)}" height="8" rx="1.5"/>`);
  });
  const title = `収録の層と本数。${layers.map((l) => `${l.lbl.replace("└ ", "")} ${jp(l.n)}`).join("、")}。`;
  return svg(w, h, out.join("\n"), title);
}
writeFileSync(join(OUT, "layers.svg"), layersSvg(358));
writeFileSync(join(OUT, "layers-wide.svg"), layersSvg(700));

/* ── 出力の要約。サイトの本文に書く数字はここから拾う ──────────────── */
console.log(`全国被覆率  ${national}%   (同梱 ${jp(totalMine)}km / 公式 ${jp(totalOff)}km)`);
console.log(`最大 ${prefs[0].k} ${prefs[0].cov}%   最小 ${prefs[46].k} ${prefs[46].cov}%   県数 ${prefs.length}`);
console.log(`規制情報が読める路線 ${layers.find((l) => l.lbl.includes("規制")).n}本`);
const regPrefs = new Set();
for (const p of publicRoutes) if (p["規制"] && p["規制"].length) for (const k of p["都道府県"]) regPrefs.add(k);
console.log(`その分布 ${regPrefs.size}都道府県`);
console.log(`coverage-47.svg      ${covNarrow.w}x${covNarrow.h}`);
console.log(`coverage-47-wide.svg ${covWide.w}x${covWide.h}`);
console.log(`alt(被覆率): ${covNarrow.title}`);
