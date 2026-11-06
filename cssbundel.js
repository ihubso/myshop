const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const sources = [
  "styles/style.css",
  "styles/adptive.css",
  "styles/recipt.css",
  "styles/print.css",
  "styles/output.css",
  "styles/language-direction.css",
  "css/fontawesome-simple.css",
  "styles/navbar.css",
];

const bundle = sources
  .map((relativePath) => {
    const filePath = path.join(root, relativePath);
    const css = fs.readFileSync(filePath, "utf8");
    return `/* ${relativePath} */\n${css}${css.endsWith("\n") ? "" : "\n"}`;
  })
  .join("\n");

fs.writeFileSync(path.join(root, "styles", "bundle.css"), bundle, "utf8");
console.log(`Bundled ${sources.length} CSS files into styles/bundle.css`);
