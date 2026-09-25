import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(process.argv[2])) });
const res = await parser.getText();
console.log(res.text);
await parser.destroy();
