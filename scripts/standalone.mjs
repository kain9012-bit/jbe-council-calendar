// 단일 HTML 조립
//  1) dist-standalone/index.html(자료 없는 틀)을 웹판 dist/standalone-template.html 로 복사 — 웹의 「내부망용 파일 받기」가 씀
//  2) 지금 자료(public/data/schedule.json)를 넣은 완성본을 release/ 에 만듦 — 내부망에 바로 배포
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const tpl = readFileSync('dist-standalone/index.html', 'utf8');
const SLOT = '<script id="jbc-data" type="application/json">__JBC_DATA__</script>';
if (!tpl.includes(SLOT)) throw new Error('틀에 자료 자리가 없음');
if (existsSync('dist')) copyFileSync('dist-standalone/index.html', 'dist/standalone-template.html');

const data = readFileSync('public/data/schedule.json', 'utf8');
const safe = JSON.stringify(JSON.parse(data)).replace(/</g, '\\u003c');
const html = tpl.replace(SLOT, () => SLOT.replace('__JBC_DATA__', safe));
const stamp = JSON.parse(data).generated.slice(0, 10).replace(/-/g, '');
mkdirSync('release', { recursive: true });
const name = `release/도의회_회의운영_달력_${stamp}.html`;
writeFileSync(name, html);
console.log(`${name} (${(html.length / 1024 / 1024).toFixed(1)} MB)`);
