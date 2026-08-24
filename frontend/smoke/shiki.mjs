/**
 * Проверка, что highlighter собирается и реально красит код —
 * SSR-тест этого не покрывает: подсветка грузится асинхронно в эффекте.
 */
const [{ createHighlighterCore }, { createOnigurumaEngine }] = await Promise.all([
  import("shiki/core"),
  import("shiki/engine/oniguruma"),
]);

const hl = await createHighlighterCore({
  themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs")],
  langs: [import("shiki/langs/jsx.mjs"), import("shiki/langs/dockerfile.mjs"), import("shiki/langs/csharp.mjs")],
  engine: createOnigurumaEngine(import("shiki/wasm")),
});

let bad = 0;
for (const [lang, code] of [["jsx", "const a = <div />;"], ["dockerfile", "FROM node:20"], ["csharp", "var x = 1;"]]) {
  const html = hl.codeToHtml(code, {
    lang, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false,
  });
  const hasLight = html.includes("--shiki-light");
  const hasDark = html.includes("--shiki-dark");
  const ok = hasLight && hasDark;
  if (!ok) bad++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${lang}: обе темы в переменных (light=${hasLight} dark=${hasDark})`);
}
console.log(bad === 0 ? "\nПодсветка работает" : `\nПадений: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
