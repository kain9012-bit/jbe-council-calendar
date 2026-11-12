import { useEffect, useState } from 'react';
import type { CEvent, Payload, Session } from '../types';
import { SHEET_DATA_TAB, SHEET_ID } from '../config';

export const COUNCIL = 'https://www.jbstatecouncil.jeonbuk.kr';
export const postUrl = (board: number, id: number) => `${COUNCIL}/jbassem/board/${board}/1/read/${id}`;
export const BOARD_PLAN = `${COUNCIL}/jbassem/board/23`;
export const BOARD_DAILY = `${COUNCIL}/jbassem/board/24`;
export const MONTHLY = `${COUNCIL}/jbassem/scheduleMonth`;

/** 보여 줄 회의 — 교육위·본회의·예결특위(교육청 소관만). 다른 위원회는 보이지 않음 */
export const EDU_BODIES = ['교육위원회', '본회의', '예산결산특별위원회'];

/**
 * 예결특위 일정이 교육청 소관인지.
 *  · 교육청·교육감·교육비 → 교육청
 *  · 전북특별자치도(도의회·도교육청 아님)·도정·부지사 → 도청 (숨김) — 도청 부서 '특별자치교육협력국'도 여기
 *  · 둘 다 없으면 공통(간담회·계수조정·심사의결 등) → 보임
 */
export const isEdu = (e: CEvent) => {
  if (e.body === '교육위원회' || e.body === '본회의' || e.body === '안내') return true;
  if (e.body !== '예산결산특별위원회') return false;
  if (/교육청|교육감|교육비/.test(e.text)) return true;
  if (/전북특별자치도(?!의회|교육청)|도정|부지사/.test(e.text)) return false;
  return true;
};

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

/** 내부망용 단일 파일 — 자료는 늘 구글 시트에서 읽음(파일 안에 일정 없음) */
export const STANDALONE = import.meta.env.MODE === 'standalone';

/** 웹판 — 내부망용 파일(자료 없는 틀) 내려받기. 열 때마다 구글 시트에서 읽으므로 다시 받을 필요 없음 */
export async function downloadStandalone() {
  const r = await fetch(`./standalone-template.html?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`파일 HTTP ${r.status}`);
  const html = await r.text();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  a.download = '도의회_회의운영_달력.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * 구글 시트(_data 탭)에서 자료 읽기 — 시각화 API(gviz)의 JSONP 응답.
 * 파일(file://)로 열어도 동작하도록 script 태그로 부름.
 */
export type Phase = 'connect' | 'receive' | 'done' | 'error';

export function loadSheet(onPhase: (p: Phase) => void = () => {}, timeout = 20000): Promise<Payload> {
  return new Promise((resolve, reject) => {
    if (!SHEET_ID) return reject(new Error('시트 ID 없음'));
    const cb = `jbcSheet${Date.now()}`;
    const s = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    let timer = 0;
    const done = (fn: () => void) => {
      window.clearTimeout(timer);
      delete w[cb];
      s.remove();
      fn();
    };
    timer = window.setTimeout(() => done(() => reject(new Error('시트 응답 없음'))), timeout);
    w[cb] = (resp: { status?: string; errors?: { detailed_message?: string }[]; table?: { rows?: { c?: ({ v?: unknown } | null)[] }[] } }) =>
      done(() => {
        onPhase('receive');
        try {
          if (resp.status === 'error') throw new Error(resp.errors?.[0]?.detailed_message ?? '시트 오류');
          const text = (resp.table?.rows ?? [])
            .map((r) => String(r.c?.[0]?.v ?? ''))
            .filter((v) => v.startsWith('~'))
            .map((v) => v.slice(1))
            .join('');
          const d = JSON.parse(text) as Payload;
          if (!d.events || !d.sessions || !d.generated) throw new Error('시트 자료 형식 이상');
          resolve(d);
        } catch (e) {
          reject(e);
        }
      });
    s.onerror = () => done(() => reject(new Error('시트 접속 실패')));
    s.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_DATA_TAB)}&headers=1&tqx=responseHandler:${cb}`;
    onPhase('connect');
    document.head.appendChild(s);
  });
}

/** 자료 출처 — web: 웹(GitHub Pages) · sheet: 구글 시트 연결됨 · loading: 시트 읽는 중 · error: 시트 연결 안 됨 */
export type Live = 'web' | 'sheet' | 'loading' | 'error';

export function useData() {
  const [data, setData] = useState<Payload | null>(null);
  const [live, setLive] = useState<Live>(STANDALONE ? 'loading' : 'web');
  const [phase, setPhase] = useState<Phase>('connect');
  const [error, setError] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    setError('');
    if (STANDALONE) {
      // 내부망 파일: 구글 시트만 읽음. 못 읽으면 옛 자료로 대신하지 않고 연결 안 됨을 알림
      setLive('loading');
      setPhase('connect');
      loadSheet(setPhase)
        .then((d) => {
          setPhase('done');
          setData(d);
          setLive('sheet');
        })
        .catch((e) => {
          setPhase('error');
          setError(e instanceof Error ? e.message : String(e));
          setLive('error');
        });
      return;
    }
    fetch(`./data/schedule.json?v=${Date.now()}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [n]);
  return { data, error, live, phase, retry: () => setN((x) => x + 1) };
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

/** 화면에 보일 일정 — 교육청 소관만. 당일 운영상황으로 대체된 계획, 자료수집 같은 빈 일정은 기본 숨김 */
export function visible(ev: CEvent[], body: string, showMinor: boolean) {
  return ev.filter((e) => !e.superseded && (showMinor || !e.minor) && isEdu(e) && (!body || e.body === body));
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
