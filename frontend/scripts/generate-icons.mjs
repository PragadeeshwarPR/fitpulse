// Renders public/icons/icon.svg to the PNG/ICO sizes the PWA manifest needs (uses Playwright).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import fs from "node:fs";

const svg = fs.readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(size, out, { maskable = false } = {}) {
  // Maskable icons need content inside the 80% safe zone on a full-bleed background.
  const inner = maskable ? Math.round(size * 0.72) : size;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? "#080B0A" : "transparent"}">
     <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  fs.writeFileSync(out, buf);
  return buf;
}

await render(192, "public/icons/icon-192.png");
await render(512, "public/icons/icon-512.png");
await render(512, "public/icons/icon-maskable-512.png", { maskable: true });
await render(180, "public/icons/apple-touch-icon.png", { maskable: true });
const png48 = await render(48, "public/icons/favicon-48.png");

// favicon.ico containing a single 48x48 PNG image.
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6); header.writeUInt8(48, 7); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png48.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync("public/favicon.ico", Buffer.concat([header, png48]));
fs.unlinkSync("public/icons/favicon-48.png");
await browser.close();
console.log("Icons generated.");
