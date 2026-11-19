// Copies the voice-activity-detection assets out of node_modules into public/vad/, so they
// are served from our own origin (no third-party CDN, nothing for a candidate's browser to
// fetch from anyone else). Runs before `dev` and `build`; the output is gitignored.
//
// Four files only: Vercel Hobby limits the number of files in a deployment (see the
// archive-upload fix), and these are all the Silero v5 + ONNX Runtime wasm path needs.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "vad");

const vadDist = dirname(require.resolve("@ricky0123/vad-web/package.json")) + "/dist";
const ortDist = dirname(require.resolve("onnxruntime-web/wasm"));

const files = [
  [vadDist, "silero_vad_v5.onnx"],
  [vadDist, "vad.worklet.bundle.min.js"],
  [ortDist, "ort-wasm-simd-threaded.wasm"],
  [ortDist, "ort-wasm-simd-threaded.mjs"],
];

mkdirSync(out, { recursive: true });
for (const [dir, name] of files) copyFileSync(join(dir, name), join(out, name));
console.log(`copied ${files.length} VAD assets to public/vad`);
