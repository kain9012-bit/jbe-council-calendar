// 내부망용 단일 파일 — 자료 없는 틀 그대로 (열 때마다 구글 시트에서 읽음)
//  · dist/standalone-template.html : 웹의 「내부망용 파일 받기」가 내려 주는 파일
//  · release/전북도의회_의사일정_교육청관련.html : 내부망에 바로 배포할 파일 (한 번 배포하면 다시 받을 필요 없음)
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';

const tpl = readFileSync('dist-standalone/index.html', 'utf8');
if (!tpl.includes('docs.google.com/spreadsheets')) throw new Error('시트 읽기 코드가 없음');
if (existsSync('dist')) copyFileSync('dist-standalone/index.html', 'dist/standalone-template.html');
mkdirSync('release', { recursive: true });
copyFileSync('dist-standalone/index.html', 'release/전북도의회_의사일정_교육청관련.html');
console.log(`release/전북도의회_의사일정_교육청관련.html (${(tpl.length / 1024 / 1024).toFixed(1)} MB)`);
