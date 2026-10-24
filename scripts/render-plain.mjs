import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const window = {};
for (const file of ["content.js", "assets/sections.js"]) {
  runInNewContext(readFileSync(new URL(file, root), "utf8"), { window }, { filename: file });
}
const { SITE, PA } = window;
const template = readFileSync(new URL("plain/template.html", root), "utf8");
const html = template.replace(/\{\{(site|section):([a-z]+)\}\}/g, (_, kind, key) => {
  if (kind === "site") return PA.esc(SITE[key]);
  const section = PA.sections[key];
  const title = section.title();
  const subtitle = section.label === title ? "" : '<span class="dlg-sub">' + PA.esc(section.label) + "</span>";
  return '<h2 class="dlg-title" id="' + key + '-title">' + PA.esc(title) + subtitle + '</h2>\n      <div class="body">' + PA.render(key) + '</div>';
});
writeFileSync(fileURLToPath(new URL("plain/index.html", root)), html);
