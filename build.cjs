const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "public");

const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );

// 一例であり、編集可能
const groups = {
  "00": "アーキテクチャ・サーバー構築",
  "01": "フロントエンド",
  "02": "バックエンド・DB",
};

// __workのファイル取得
const files = fs
  .readdirSync(path.join(root, "__work"), { withFileTypes: true })
  .filter((file) => file.isFile() && file.name.endsWith(".html"))
  .map((file) => file.name)
  .sort();

// __workのリンク生成
const links = files
  .map((name) => {
    const category = name.slice(0, 2);
    const source = fs.readFileSync(path.join(root, "__work", name), "utf8");
    const title = (
      source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1].trim() ||
      escape(name)
    )
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<li data-category="${escape(category)}">
      <a href="__work/${encodeURIComponent(name)}">${title}</a>
      <small>${escape(groups[category] || "その他")} · ${escape(name)}</small>
    </li>`;
  })
  .join("\n");

// __workの目次HTML
const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" href="image/icon.png">
<title>auto build html</title>
<style>
body {
  font-family: sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}
li {
  margin: 12px 0;
}
small {
  display: block;
  color: #666;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}
input,
select {
  padding: 8px;
  font: inherit;
}
[hidden] {
  display: none !important;
}
</style>
</head>
<body>
<h1>学習資料の目次</h1>
<p>全${files.length}件の学習ガイド</p>
<div class="filters">
  <input id="search" type="search" placeholder="タイトル・ファイル名で検索" aria-label="資料を検索">
  <select id="category" aria-label="カテゴリで絞り込み">
    <option value="all">すべて</option>
    ${Object.entries(groups)
      .map(
        ([key, value]) =>
          `<option value="${key}">${key} - ${escape(value)}</option>`,
      )
      .join("\n")}
  </select>
</div>
<p id="count" aria-live="polite"></p>
<ul id="list">
${links || "<li>学習資料はまだありません。</li>"}
</ul>
<p id="empty" hidden>該当する資料がありません。</p>
<script>
const search = document.getElementById("search");
const category = document.getElementById("category");
const items = [...document.querySelectorAll("#list li[data-category]")];
const count = document.getElementById("count");
const empty = document.getElementById("empty");
function filter() {
  const keyword = search.value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const item of items) {
    const matchesCategory = category.value === "all" || item.dataset.category === category.value;
    const matchesSearch = item.textContent.toLocaleLowerCase().includes(keyword);
    item.hidden = !(matchesCategory && matchesSearch);
    if (!item.hidden) visible++;
  }
  count.textContent = visible + " / " + items.length + " 件表示";
  empty.hidden = visible !== 0 || items.length === 0;
}
search.addEventListener("input", filter);
category.addEventListener("change", filter);
filter();
</script>
</body>
</html>`;

// 出力ディレクトリを初期化
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

// ディレクトリ同期
function syncFolder(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(target)) {
    if (!fs.existsSync(path.join(source, entry))) {
      fs.rmSync(path.join(target, entry), {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      syncFolder(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

// 静的ファイルのコピー
for (const folder of ["__work", "image"]) {
  syncFolder(path.join(root, folder), path.join(output, folder));
}

// 目次HTMLの出力
fs.writeFileSync(path.join(output, "index.html"), html);
console.log(`Generated public/index.html (${files.length} pages)`);
