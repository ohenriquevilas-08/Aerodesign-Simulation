import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "content.js",
  "random.js",
  "aircraft.js",
  "team.js",
  "rivals.js",
  "competition.js",
  "state.js",
  "game.js",
  "storage.js",
  "ui.js",
  "main.js"
];
const template = await readFile(path.join(root, "src", "index.template.html"), "utf8");
const marker = "/* __AERODESIGN_BUNDLE__ */";

if (template.split(marker).length !== 2) {
  throw new Error("The HTML template must contain exactly one game bundle marker.");
}

const bundle = (await Promise.all(sourceFiles.map(async (file) => {
  const contents = await readFile(path.join(root, "src", file), "utf8");
  return `\n/* ${file} */\n${contents.trim()}`;
}))).join("\n\n");

await writeFile(path.join(root, "index.html"), template.replace(marker, bundle), "utf8");
console.log(`Built index.html from ${sourceFiles.length} source modules.`);
