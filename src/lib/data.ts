import { useEffect, useState } from 'react';
import type { CEvent, Payload, Scope, Session } from '../types';

export const COUNCIL = 'https://www.jbstatecouncil.jeonbuk.kr';
export const postUrl = (board: number, id: number) => `${COUNCIL}/jbassem/board/${board}/1/read/${id}`;
export const BOARD_PLAN = `${COUNCIL}/jbassem/board/23`;
export const BOARD_DAILY = `${COUNCIL}/jbassem/board/24`;
export const MONTHLY = `${COUNCIL}/jbassem/scheduleMonth`;

/** 교육청 직원이 챙길 회의 — 교육위·본회의(교육·학예 행정 질문 포함)·예결특위 */
export const EDU_BODIES = ['교육위원회', '본회의', '예산결산특별위원회'];

export const SHORT: Record<string, string> = {
  교육위원회: '교육위',
  본회의: '본회의',
  예산결산특별위원회: '예결특위',
  의회운영위원회: '운영위',
  기획행정위원회: '기획행정위',
  농업복지환경위원회: '농업복지환경위',
  경제산업건설위원회: '경제산업건설위',
  문화안전소방위원회: '문화안전소방위',
  윤리특별위원회: '윤리특위',
};
export const short = (b: string) => SHORT[b] ?? b.replace('특별위원회', '특위').replace('위원회', '위');

/** 회의체 색 — 칩 바탕/글자 */
export const tone = (b: string) =>
  b === '본회의'
    ? 'bg-[var(--nr-p2)] text-white'
    : b === '교육위원회'
      ? 'bg-[var(--nr-p3)] text-white'
      : b === '예산결산특별위원회'
        ? 'bg-[#e3f6f5] text-[#0b6b67] ring-1 ring-inset ring-[#9fdedb]'
        : 'bg-[#f1f3f6] text-[#3d4651]';

/** 내부망용 단일 파일 — 파일 안에 자료가 들어 있음 */
export const STANDALONE = import.meta.env.MODE === 'standalone';
const embedded = (): Payload | null => {
  const raw = document.getElementById('jbc-data')?.textContent?.trim() ?? '';
  if (!raw.startsWith('{')) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const SLOT_OPEN = '<script id="jbc-data" type="application/json">';
/** 웹판 — 자료 없는 틀 + 지금 자료를 합쳐 단일 HTML 내려받기 */
export async function downloadStandalone() {
  const [tpl, data] = await Promise.all([
    fetch('./standalone-template.html').then((r) => {
      if (!r.ok) throw new Error(`틀 파일 HTTP ${r.status}`);
      return r.text();
    }),
    fetch(`./data/schedule.json?v=${Date.now()}`).then((r) => {
      if (!r.ok) throw new Error(`자료 HTTP ${r.status}`);
      return r.json();
    }),
  ]);
  const slot = `${SLOT_OPEN}__JBC_DATA__</script>`;
  if (!tpl.includes(slot)) throw new Error('틀에 자료 자리가 없음');
  const safe = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = tpl.replace(slot, () => `${SLOT_OPEN}${safe}</script>`);
  const stamp = String(data.generated).slice(0, 10).replace(/-/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  a.download = `도의회_회의운영_달력_${stamp}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function useData() {
  const [data, setData] = useState<Payload | null>(() => embedded());
  const [error, setError] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    if (embedded()) return;
    setError('');
    fetch(`./data/schedule.json?v=${Date.now()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [n]);
  return { data, error, retry: () => setN((x) => x + 1) };
}

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const dow = (s: string) => DOW[parse(s).getDay()];
export const md = (s: string) => {
  const d = parse(s);
  return `${d.getMonth() + 1}. ${d.getDate()}.(${DOW[d.getDay()]})`;
};
export const span = (a: string, b: string) => (a === b ? md(a) : `${md(a)} ~ ${md(b)}`);
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000) + 1;

export const sessionOn = (ss: Session[], d: string) => ss.find((s) => s.start <= d && d <= s.end);

/** 화면에 보일 일정 — 당일 운영상황으로 대체된 계획, 자료수집 같은 빈 일정은 기본 숨김 */
export function visible(ev: CEvent[], scope: Scope, body: string, showMinor: boolean) {
  return ev.filter(
    (e) =>
      !e.superseded &&
      (showMinor || !e.minor) &&
      (body ? e.body === body : scope === 'all' || EDU_BODIES.includes(e.body) || e.body === '안내'),
  );
}

export const onDay = (ev: CEvent[], d: string) => ev.filter((e) => e.start <= d && d <= e.end);

/** 시각 정렬 — '본회의 종료 후' 같은 글은 14:00 뒤 */
export const timeKey = (t: string) => (/^\d{1,2}:\d{2}/.test(t) ? t.padStart(5, '0') : t ? '14:01' : '99');
export const byTime = (a: CEvent, b: CEvent) =>
  timeKey(a.time).localeCompare(timeKey(b.time)) || (EDU_BODIES.indexOf(b.body) - EDU_BODIES.indexOf(a.body));

export const firstLine = (e: CEvent) => {
  if (e.body === '본회의' && e.meeting) return `${e.meeting} 본회의`;
  const l = e.text.split('\n').find((x) => x.trim() && !x.startsWith('-')) ?? e.text.split('\n')[0] ?? '';
  return l.replace(/^\d+\.\s*/, '').trim();
};
