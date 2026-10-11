export function mk(w, h, base = '.') {
  const g = Array.from({ length: h }, () => Array(w).fill(base));
  const ok = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const api = {
    g, w, h,
    fill(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ok(x, y)) g[y][x] = ch; return api; },
    put(ch, ...pts) { pts.forEach(([x, y]) => { if (ok(x, y)) g[y][x] = ch; }); return api; },
    rect(x0, y0, x1, y1, ch) { // 边框
      for (let x = x0; x <= x1; x++) { g[y0][x] = ch; g[y1][x] = ch; }
      for (let y = y0; y <= y1; y++) { g[y][x0] = ch; g[y][x1] = ch; }
      return api;
    },
    // 折线（只走横竖），宽度 wd
    path(ch, pts, wd = 1) {
      for (let i = 1; i < pts.length; i++) {
        let [x, y] = pts[i - 1]; const [tx, ty] = pts[i];
        const st = () => { for (let k = 0; k < wd; k++) { if (tx !== x || ty === y) { if (ok(x, y + k)) g[y + k][x] = ch; } else if (ok(x + k, y)) g[y][x + k] = ch; } };
        st();
        while (x !== tx || y !== ty) {
          if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
          st();
        }
      }
      return api;
    },
    // 在 only 字符上按确定性伪随机撒点
    scatter(ch, x0, y0, x1, y1, pct, seed = 1, only = '.') {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!ok(x, y) || !only.includes(g[y][x])) continue;
        const r = Math.abs(Math.sin((x * 12.9898 + y * 78.233 + seed * 37.719)) * 43758.5453) % 1;
        if (r < pct) g[y][x] = ch;
      }
      return api;
    },
    rows() { return g.map((r) => r.join('')); },
  };
  return api;
}
export function show(name, rows) {
  const w = rows[0].length;
  let hd = '    '; for (let x = 0; x < w; x++) hd += (x % 10);
  console.log(`== ${name} ${w}x${rows.length}`); console.log(hd);
  rows.forEach((r, y) => console.log(String(y).padStart(3) + ' ' + r));
}
export const lit = (rows) => rows.map((r) => `      '${r}',`).join('\n');
