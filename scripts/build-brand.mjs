import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
// Use Next's already pinned image dependency; no additional runtime package.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
// The user-approved imagegen artwork is the source of truth; do not redraw it.
const source = readFileSync('design/brand/negative-canopy-transparent.png');
const metadata = await sharp(source).metadata();
if (!metadata.hasAlpha) throw new Error('The approved logo must have a transparent alpha channel.');
const raster = await sharp(source).resize(256, 256).png().toBuffer();
const image = `data:image/png;base64,${raster.toString('base64')}`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a0d12"/><image width="64" height="64" href="${image}"/></svg>`;
writeFileSync('src/assets/logo.svg', icon);
writeFileSync('public/forami-icon.svg', icon);
writeFileSync(
  'public/safari-pinned-tab.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="${image}"/></svg>`,
);
// Keep the legacy export, using the same approved colored icon on every theme.
writeFileSync('src/assets/logo-white.svg', icon);
await sharp(source).resize(512, 512).png().toFile('public/forami-mark.png');
const sizes = {
  'favicon-16x16': 16,
  'favicon-32x32': 32,
  'apple-touch-icon': 180,
  'android-chrome-192x192': 192,
  'android-chrome-512x512': 512,
  'mstile-150x150': 150,
};
for (const [name, size] of Object.entries(sizes)) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`public/${name}.png`);
}
const frames = await Promise.all(
  [16, 32, 48].map(size => sharp(Buffer.from(icon)).resize(size, size).png().toBuffer()),
);
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = [16, 32, 48][index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([directory, ...frames]));
console.log('Generated Formami browser icons from the approved Negative Canopy artwork.');
