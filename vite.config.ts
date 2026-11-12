import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * 내부망판(단일 HTML) — 바깥 주소 호출 0건.
 *  · CDN 서체 @import 제거 → src/fonts 의 파일을 파일 안에 묶음
 *  · 자료는 받을 때 파일 안에 넣음 (scripts/standalone.mjs, 웹의 「내부망용 파일 받기」)
 */
const standaloneEdition = (): Plugin => ({
  name: 'standalone-edition',
  enforce: 'pre',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/src/index.css')) return null;
    return code
      .replace(/@import\s*(?:url\()?\s*["']?https?:\/\/[^;]+;/g, '')
      .replace(/url\(["']?https?:\/\/[^)]*GangwonEduPowerExtraBoldA\.woff["']?\)/, 'url("./fonts/GangwonEduPowerExtraBoldA.woff")')
      .concat(
        '\n@font-face { font-family: "SUIT Variable"; font-weight: 100 900; font-display: swap; src: url("./fonts/SUIT-Variable.woff2") format("woff2"); }\n',
      );
  },
});

export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    base: './',
    plugins: [...(standalone ? [standaloneEdition()] : []), react(), tailwindcss(), ...(standalone ? [viteSingleFile()] : [])],
    build: standalone
      ? { outDir: 'dist-standalone', assetsInlineLimit: 100_000_000 }
      : { outDir: 'dist' },
  };
});
