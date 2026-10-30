/**
 * Regenerates THIRD_PARTY_NOTICES.md from the license files in node_modules, so the
 * texts and versions always match what is actually bundled. Run `npm run notices`
 * after adding or upgrading a runtime dependency.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8').trim();
const version = (pkg) => JSON.parse(read(`node_modules/${pkg}/package.json`)).version;
const fence = (text) => '```text\n' + text + '\n```';

const upng = existsSync(join(root, 'node_modules/@pdf-lib/upng/LICENSE'))
  ? `**@pdf-lib/upng (MIT)**\n\n${fence(read('node_modules/@pdf-lib/upng/LICENSE'))}\n\n`
  : '';

const QR_LICENSE = `MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const FFMPEG_WASM_LICENSE = `MIT License

Copyright (c) 2019 Jerome Wu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const notices = `# Third-party notices

DoItLocal Toolkit is released under the MIT license (see [LICENSE](LICENSE)). The production build
bundles the open-source components below, whose license texts are reproduced as required.
Development-only tools (Vite, TypeScript, Vitest, ESLint, Prettier and so on) are not shipped to users.

| Component | Version | License | Used for |
| --- | --- | --- | --- |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | ${version('pdf-lib')} | MIT | Merging PDFs and building PDFs from images (bundles @pdf-lib/standard-fonts, @pdf-lib/upng and pako) |
| [PDF.js](https://github.com/mozilla/pdf.js) (pdfjs-dist) | ${version('pdfjs-dist')} | Apache-2.0 | Reading PDFs: page counts, thumbnails and page images |
| [SortableJS](https://github.com/SortableJS/Sortable) | ${version('sortablejs')} | MIT | Drag-and-drop reordering |
| [fflate](https://github.com/101arrowz/fflate) | ${version('fflate')} | MIT | Packing page images into a ZIP (SnapPages) |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | ${version('qrcode-generator')} | MIT | Encoding QR codes (EzQR) |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (@ffmpeg/ffmpeg) | ${version('@ffmpeg/ffmpeg')} | MIT | Running ffmpeg in a Web Worker (ReelBack) |
| [ffmpeg.wasm core](https://github.com/ffmpegwasm/ffmpeg.wasm) (@ffmpeg/core: FFmpeg, x264 and other libraries) | ${version('@ffmpeg/core')} | GPL-2.0-or-later | Reversing videos (ReelBack) |

---

## pdf-lib (MIT)

${fence(read('node_modules/pdf-lib/LICENSE.md'))}

### Bundled with pdf-lib

**@pdf-lib/standard-fonts (MIT)**

${fence(read('node_modules/@pdf-lib/standard-fonts/LICENSE.md'))}

${upng}**pako (MIT and Zlib)**

${fence(read('node_modules/pako/LICENSE'))}

---

## PDF.js (Apache License 2.0)

Copyright Mozilla Foundation and PDF.js contributors. The unmodified PDF.js library and worker
are included in the build. The full license text is below and at
<https://www.apache.org/licenses/LICENSE-2.0>.

${fence(read('node_modules/pdfjs-dist/LICENSE'))}

---

## SortableJS (MIT)

${fence(read('node_modules/sortablejs/LICENSE'))}

---

## fflate (MIT)

${fence(read('node_modules/fflate/LICENSE'))}

---

## qrcode-generator (MIT)

The package ships no separate license file; the notice below is taken from the header of its
source. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

${fence(QR_LICENSE)}

---

## ffmpeg.wasm (MIT)

The package ships no separate license file; the notice below is taken from the project's
repository.

${fence(FFMPEG_WASM_LICENSE)}

---

## ffmpeg.wasm core (GNU GPL, version 2 or later)

\`@ffmpeg/core\` ${version('@ffmpeg/core')} is [FFmpeg](https://ffmpeg.org/) compiled to WebAssembly together
with libraries such as x264, and is distributed under the GNU General Public License, version 2
or (at your option) any later version. It is included unmodified, as the separate files
\`ffmpeg-core.js\` and \`ffmpeg-core.wasm\`, and is loaded only by ReelBack.

- License text: <https://www.gnu.org/licenses/old-licenses/gpl-2.0.html>
- Source code of this exact build, with its build scripts:
  <https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v${version('@ffmpeg/core')}>
- FFmpeg's own license notes: <https://ffmpeg.org/legal.html>
`;

writeFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), notices);
console.log('wrote THIRD_PARTY_NOTICES.md');
