import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react';
import type { CEvent, Payload } from './types';
import { Splash } from './components/Splash';
import { DownloadButton, Lnb, Modal, PageTitle, SiteFooter, SiteHeader, SubLayout, TopButton, type MenuKey } from './components/Shell';
import { EventCard, Pill } from './components/Event';
import {
  BOARD_DAILY, BOARD_PLAN, MONTHLY, isEdu, isMinor, STANDALONE, type Live, addDays, byTime, daysBetween, dow, firstLine, iso, md, onDay, parse,
  sessionOn, short, span, today, tone, useData, visible,
} from './lib/data';

/* ---------- 주소(해시) ---------- */
const useRoute = () => {
  const get = () => (window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'calendar') as MenuKey;
  const [r, setR] = useState<MenuKey>(get());
  useEffect(() => {
    const f = () => {
      setR(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return ['calendar', 'sessions', 'about'].includes(r) ? r : 'calendar';
};

/** 휴대폰 폭(640px 미만) — 달력 날짜를 누르면 창 대신 달력 아래에 그날 일정 */
const useNarrow = () => {
  const q = '(max-width: 639px)';
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setN(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return n;
};

const store = {
  get: (k: string, d: string) => {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 저장 불가 환경 */
    }
  },
};

const TITLE: Record<MenuKey, string> = { calendar: '월간 달력', sessions: '연간 회기', about: '자료 출처·한계' };

export default function App() {
  const route = useRoute();
  const { data, error, retry, live, phase } = useData();
  const [body, setBody] = useState(() => store.get('jbc-body', ''));
  useEffect(() => store.set('jbc-body', body), [body]);

  return (
    <div className="min-h-screen bg-white text-[var(--nr-text)] flex flex-col">
      <SiteHeader active={route} asOf={data?.generated.replace('T', ' ').slice(0, 16)} live={live} onRetry={retry} />
      {STANDALONE && <Splash live={live} phase={phase} error={error} onRetry={retry} />}
      <SubLayout lnb={<Lnb active={route} />} trail={['도의회 일정', TITLE[route]]}>
        {error && !STANDALONE ? (
          <div className="rounded-[14px] border border-[var(--nr-line)] p-8 text-center">
            <p className="nr-title text-[20px]">일정 자료를 받지 못함</p>
            <p className="mt-2 text-[15px] text-slate-600">잠시 뒤 다시 시도. 급하면 도의회 원문 확인</p>
            <p className="mt-1 text-[13px] text-slate-400">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={retry} className="inline-flex items-center gap-1 h-9 px-4 rounded-[10px] bg-[var(--nr-p3)] text-white font-bold hover:bg-[var(--nr-p2)]">
                <RefreshCw className="w-4 h-4" aria-hidden="true" /> 다시 시도
              </button>
              <a href={BOARD_PLAN} target="_blank" rel="noreferrer" className="inline-flex items-center h-9 px-4 rounded-[10px] border border-[var(--nr-line)] font-bold">
                의사일정 게시판
              </a>
            </div>
          </div>
        ) : !data ? (
          STANDALONE ? <div className="py-20" /> : <div className="py-20 text-center text-slate-500">일정 자료 불러오는 중…</div>
        ) : (
          <HealthBanner data={data} live={live} />
        )}
        {(error && !STANDALONE) || !data ? null : route === 'calendar' ? (
          <CalendarPage data={data} body={body} setBody={setBody} />
        ) : route === 'sessions' ? (
          <SessionsPage data={data} />
        ) : (
          <AboutPage data={data} />
        )}
      </SubLayout>
      <SiteFooter />
      <TopButton />
    </div>
  );
}

/* ---------- 수집 점검 안내 ---------- */
const stamp = (s?: string) => (s ? s.replace('T', ' ').slice(0, 16) : '');
const hoursSince = (s?: string) => (s ? (Date.now() - new Date(s).getTime()) / 3600000 : Infinity);

const HealthBanner: React.FC<{ data: Payload; live: Live }> = ({ data }) => {
  const h = data.health;
  const stale = hoursSince(data.lastSuccess ?? data.generated) > 36;
  const fails = h?.items.filter((i) => i.level === 'fail') ?? [];
  const warns = h?.items.filter((i) => i.level === 'warn') ?? [];
  if (!stale && !fails.length && !warns.length) return null;
  const bad = fails.length > 0 || stale;
  return (
    <div className={`mb-6 flex gap-3 rounded-[14px] px-4 py-3 text-[15px] ${bad ? 'bg-[#fdeeee] text-[#8a1c1c]' : 'bg-[#fff3db] text-[#6b4700]'}`} role="status">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold">
          {stale && STANDALONE
            ? `구글 시트 자료가 ${stamp(data.generated)} 이후 갱신되지 않음 — 최신 일정과 다를 수 있음`
            : stale
            ? `마지막 정상 수집 ${stamp(data.lastSuccess ?? data.generated)} — 최신 일정과 다를 수 있음`
            : fails.length
              ? `자동 수집 실패 ${fails.length}건 — 해당 자료는 직전 정상 수집본 표시`
              : `자동 수집 확인 필요 ${warns.length}건 — 일부 일정 누락 가능`}
        </p>
        <p className="mt-0.5 text-[14px] opacity-90">
          {(fails[0] ?? warns[0])?.msg ?? '수집 작업이 멈췄을 가능성'} ·{' '}
          <a href="#/about" className="font-bold underline underline-offset-2">점검 결과 보기</a>
        </p>
      </div>
    </div>
  );
};

/* ---------- 회의체 고르개 — 교육위·본회의·예결특위(교육청 소관) ---------- */
interface ScopeProps {
  data: Payload;
  body: string;
  setBody: (b: string) => void;
}
const ScopeBar: React.FC<ScopeProps> = ({ data, body, setBody }) => {
  const count = (b: string) => visible(data.events, b, false).length;
  const items: [string, string, string][] = [['', '전체', '전체'], ['교육위원회', '교육위원회', '교육위'], ['본회의', '본회의', '본회의'], ['예산결산특별위원회', '예결특위', '예결특위']];
  return (
    <div role="group" aria-label="회의체" className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      {items.map(([v, label, shortLabel]) => {
        const on = body === v;
        return (
          <button
            key={label}
            type="button"
            onClick={() => setBody(v)}
            aria-pressed={on}
            className={`h-10 px-1 sm:px-4 rounded-full text-[14px] sm:text-[15px] whitespace-nowrap transition-colors ${
              on ? 'bg-[var(--nr-p2)] text-white font-bold' : 'bg-[var(--nr-bg)] text-slate-800 hover:text-[var(--nr-p3)]'
            }`}
          >
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span> <span className="text-[12px] sm:text-[13px] opacity-70 tabular-nums">{count(v)}</span>
          </button>
        );
      })}
      <span className="hidden sm:inline text-[13px] text-slate-500">예결특위는 교육청 소관·공통 일정만</span>
    </div>
  );
};

/* ---------- 한 줄 띠 — 회기 몇째 날 + 오늘 의회 일정(없으면 다음 회의) ---------- */
const Hero: React.FC<{ data: Payload }> = ({ data }) => {
  const t = today();
  const s = sessionOn(data.sessions, t);
  const next = data.sessions.find((x) => x.start > t);
  const all = visible(data.events, '', false);
  const todays = onDay(all, t).sort(byTime);
  // 회의체마다 첫 일정만, 나머지는 '외 ○건'
  const firsts = todays.filter((e, i) => todays.findIndex((x) => x.body === e.body) === i);
  const rest = todays.length - firsts.length;
  const upcoming = all.filter((e) => e.start > t).sort((a, b) => a.start.localeCompare(b.start) || byTime(a, b))[0];
  const name = (x: { title: string }) => x.title.replace('전북특별자치도의회 ', '');
  const item = (e: CEvent) => (
    <span key={`${e.body}${e.time}${e.text}`} className="whitespace-nowrap">
      <b>{short(e.body)}</b> <span className="tabular-nums">{/^\d/.test(e.time) ? e.time : ''}</span> {firstLine(e)}
    </span>
  );
  return (
    <section className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-[12px] bg-[var(--nr-p2)] px-4 py-3 sm:px-5 text-white text-[14px] sm:text-[15px] leading-[1.4]">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {s ? (
          <>
            <b className="nr-title text-[16px] sm:text-[17px] leading-none translate-y-[1px]">{name(s)}</b>
            <b className="nr-title text-[16px] sm:text-[17px] leading-none translate-y-[1px] text-[#ffd85c] tabular-nums">{daysBetween(s.start, t)}일째</b>
            <span className="text-[13px] opacity-70 tabular-nums">/ {daysBetween(s.start, s.end)}일간</span>
          </>
        ) : next ? (
          <>
            <b className="nr-title text-[16px] sm:text-[17px] leading-none translate-y-[1px]">폐회 중</b>
            <span className="text-[13px] opacity-80 tabular-nums">다음 회기 {name(next)} {md(next.start)}부터 ({daysBetween(t, next.start) - 1}일 뒤)</span>
          </>
        ) : (
          <b className="nr-title text-[16px] sm:text-[17px] leading-none translate-y-[1px]">폐회 중</b>
        )}
      </span>
      <span className="hidden sm:inline opacity-40" aria-hidden="true">|</span>
      <span className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {todays.length ? (
          <>
            <span className="rounded-full bg-[#ffd85c] text-[#1d2550] px-2 h-[22px] inline-flex items-center text-[12px] font-bold">오늘</span>
            {firsts.map(item)}
            {rest > 0 && <span className="opacity-75 whitespace-nowrap">외 {rest}건</span>}
          </>
        ) : (
          <>
            <span className="opacity-75">오늘 회의 없음{upcoming ? ' ·' : ''}</span>
            {upcoming && (
              <span className="whitespace-nowrap">
                <span className="opacity-75">다음</span> <b className="tabular-nums">{md(upcoming.start)}</b> {item(upcoming)}
              </span>
            )}
          </>
        )}
      </span>
    </section>
  );
};

/* ---------- 월간 달력 ---------- */
const CalendarPage: React.FC<ScopeProps> = (p) => {
  const { data, body } = p;
  const t = today();
  const [ym, setYm] = useState(t.slice(0, 7));
  const [pick, setPick] = useState<string | null>(null);
  const [sel, setSel] = useState(t);
  const narrow = useNarrow();
  const [showMinor, setShowMinor] = useState(false);
  const ev = useMemo(() => visible(data.events, body, showMinor), [data, body, showMinor]);
  const first = parse(`${ym}-01`);
  const gridStart = addDays(`${ym}-01`, -first.getDay());
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);
  const move = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1);
    setYm(iso(d).slice(0, 7));
    setSel(iso(d));
  };
  const monthSessions = data.sessions.filter((s) => s.end >= `${ym}-01` && s.start <= iso(last));
  return (
    <>
      <PageTitle desc="회기와 교육위원회·본회의·예결특위(교육청 소관) 일정. 일일회의운영상황이 올라온 날은 그 내용이 우선">월간 달력</PageTitle>
      <div className="mt-4 sm:mt-5"><Hero data={data} /></div>
      <div className="mt-3 sm:mt-4"><ScopeBar {...p} /></div>
      <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="grid place-items-center w-10 h-10 rounded-full border border-[var(--nr-line)] hover:border-[var(--nr-p3)]">
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <h2 className="nr-title w-[120px] sm:w-[150px] text-center text-[21px] sm:text-[24px] tabular-nums">{first.getFullYear()}. {first.getMonth() + 1}.</h2>
          <button type="button" onClick={() => move(1)} aria-label="다음 달" className="grid place-items-center w-10 h-10 rounded-full border border-[var(--nr-line)] hover:border-[var(--nr-p3)]">
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {ym !== t.slice(0, 7) && (
          <button type="button" onClick={() => (setYm(t.slice(0, 7)), setSel(t))} className="h-9 px-3 rounded-[10px] border border-[var(--nr-line)] text-[14px] font-bold hover:border-[var(--nr-p3)]">
            이번 달
          </button>
        )}
        <div className="hidden sm:flex flex-wrap gap-1.5">
          {monthSessions.map((s) => (
            <Pill key={s.no} className={s.kind === '정례회' ? 'bg-[#e8f0fb] text-[var(--nr-p3)]' : 'bg-[#e3f6f5] text-[#0b6b67]'}>
              제{s.no}회 {s.kind} {span(s.start, s.end)}
            </Pill>
          ))}
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-[14px] text-slate-600">
          <input type="checkbox" checked={showMinor} onChange={(e) => setShowMinor(e.target.checked)} className="w-4 h-4" />
          <span className="sm:hidden">자료수집 표시</span><span className="hidden sm:inline">자료수집 기간도 표시</span>
        </label>
      </div>

      <div className="mt-3 sm:mt-4 overflow-hidden rounded-[14px] border border-[var(--nr-line)]">
        <div className="grid grid-cols-7 bg-[#eef3f9] border-b border-[var(--nr-line)] text-center text-[13px] sm:text-[14px] font-bold">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`py-2 ${i === 0 ? 'text-[#c0392b]' : i === 6 ? 'text-[var(--nr-p3)]' : ''}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const d = addDays(gridStart, i);
            const inMonth = d.slice(0, 7) === ym;
            const s = sessionOn(data.sessions, d);
            const items = onDay(ev, d).sort(byTime);
            const isToday = d === t;
            const isSel = narrow && d === sel;
            const changed = items.some((e) => e.changed && e.changed.length);
            const label = s && (d === s.start || (parse(d).getDay() === 0 && d <= s.end)) ? `제${s.no}회` : '';
            return (
              <button
                key={d}
                type="button"
                onClick={() => (narrow ? setSel(d) : setPick(d))}
                aria-pressed={narrow ? isSel : undefined}
                className={`relative flex flex-col justify-start items-center sm:items-stretch min-w-0 min-h-[56px] sm:min-h-[132px] border-b border-r border-[var(--nr-line)] p-1 sm:p-1.5 pt-2 sm:pt-2.5 sm:text-left transition-colors hover:bg-[var(--nr-bg)] ${
                  (i + 1) % 7 === 0 ? 'border-r-0' : ''
                } ${isSel ? 'bg-[var(--nr-bg)] ring-2 ring-inset ring-[var(--nr-p3)]' : inMonth ? '' : 'bg-[#fafbfc] text-slate-400'}`}
              >
                {s && (
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${s.kind === '정례회' ? 'bg-[var(--nr-p1)]' : 'bg-[#32bdb8]'} ${inMonth ? '' : 'opacity-40'}`} />
                )}
                <span className="flex items-center gap-1">
                  <span
                    className={`grid place-items-center min-w-[26px] h-[26px] rounded-full text-[14px] tabular-nums ${
                      isToday ? 'bg-[#fecd20] text-[#1d2550] font-bold' : parse(d).getDay() === 0 ? 'text-[#c0392b]' : parse(d).getDay() === 6 ? 'text-[var(--nr-p3)]' : ''
                    }`}
                  >
                    {parse(d).getDate()}
                  </span>
                  {label && <span className={`hidden sm:inline text-[11px] font-bold ${s?.kind === '정례회' ? 'text-[var(--nr-p1)]' : 'text-[#0b6b67]'}`}>{label}</span>}
                  {changed && <span className="hidden sm:inline ml-auto w-2 h-2 rounded-full bg-[#f0a500]" title="계획과 다름" />}
                </span>
                <span className="mt-1 hidden sm:flex flex-col gap-0.5">
                  {items.slice(0, 4).map((e, k) => (
                    <span key={k} className={`block rounded px-1.5 py-[2px] text-[12px] leading-[16px] [overflow-wrap:anywhere] line-clamp-2 ${tone(e.body)} ${isMinor(e) ? 'opacity-60' : ''}`}>
                      <b>{short(e.body)}</b> <span className="tabular-nums">{/^\d/.test(e.time) ? e.time : ''}</span>{' '}
                      <span className="opacity-90">{firstLine(e)}</span>
                    </span>
                  ))}
                  {items.length > 4 && <span className="text-[12px] font-bold text-[var(--nr-p3)]">+{items.length - 4}건</span>}
                </span>
                <span className="mt-1 flex sm:hidden flex-wrap justify-center gap-0.5">
                  {items.slice(0, 6).map((e, k) => (
                    <span key={k} className={`w-1.5 h-1.5 rounded-full ${e.body === '본회의' ? 'bg-[var(--nr-p2)]' : e.body === '교육위원회' ? 'bg-[var(--nr-p3)]' : e.body === '예산결산특별위원회' ? 'bg-[#7cc4ef]' : 'bg-slate-400'}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <Legend />
      {narrow && <DayAgenda data={data} d={sel} body={body} showMinor={showMinor} />}
      {pick && <DayModal data={data} d={pick} body={body} showMinor={showMinor} onClose={() => setPick(null)} />}
    </>
  );
};

const Legend: React.FC = () => (
  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-600">
    <li className="flex items-center gap-1.5"><span className="w-4 h-1 bg-[var(--nr-p1)]" /> 정례회 기간</li>
    <li className="flex items-center gap-1.5"><span className="w-4 h-1 bg-[#32bdb8]" /> 임시회 기간</li>
    <li className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f0a500]" /> 계획(안)과 달라진 회의 있음</li>
    <li className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> <span className="sm:hidden">날짜 누르면 아래에 일정</span><span className="hidden sm:inline">날짜 누르면 상세</span></li>
  </ul>
);

/** 휴대폰 — 달력 바로 아래에 고른 날(처음엔 오늘)의 일정 */
const DayAgenda: React.FC<{ data: Payload; d: string; body: string; showMinor: boolean }> = ({ data, d, body, showMinor }) => {
  const s = sessionOn(data.sessions, d);
  const items = onDay(visible(data.events, body, showMinor), d).sort(byTime);
  const hasDaily = onDay(data.events, d).some((e) => e.source.type === '당일');
  return (
    <section className="mt-5" aria-live="polite">
      <h2 className="flex flex-wrap items-baseline gap-x-2 border-b-2 border-[#33363d] pb-2">
        <span className="nr-title text-[20px] tabular-nums">{md(d)}</span>
        {d === today() && <Pill className="bg-[var(--nr-p3)] text-white">오늘</Pill>}
        <span className="text-[13px] text-slate-500">{s ? `제${s.no}회 ${s.kind} ${daysBetween(s.start, d)}일째` : '회기 아님'}</span>
      </h2>
      {items.length > 0 && (
        <p className="mt-2 text-[12px] text-slate-500">{hasDaily ? '일일회의운영상황 반영' : '의사일정(안) 기준 · 바뀔 수 있음'}</p>
      )}
      <div className="mt-2 space-y-2.5">
        {items.length ? items.map((e, i) => <EventCard key={i} e={e} />) : <p className="py-6 text-center text-[15px] text-slate-500">회의 없음</p>}
      </div>
    </section>
  );
};

const DayModal: React.FC<{ data: Payload; d: string; body: string; showMinor: boolean; onClose: () => void }> = ({ data, d, body, showMinor, onClose }) => {
  const [all, setAll] = useState(!body);
  const s = sessionOn(data.sessions, d);
  const items = onDay(visible(data.events, all ? '' : body, showMinor), d).sort(byTime);
  const hidden = onDay(data.events.filter((e) => e.notInDaily), d);
  const hasDaily = onDay(data.events, d).some((e) => e.source.type === '당일');
  return (
    <Modal
      onClose={onClose}
      title={
        <div>
          <p className="nr-title text-[22px] tabular-nums">{md(d)}</p>
          <p className="text-[13px] text-slate-500">{s ? `${s.title} · ${daysBetween(s.start, d)}일째` : '회기 아님'}</p>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={hasDaily ? 'bg-[#eaf6ec] text-[#267337]' : 'bg-[#f1f3f6] text-[#58616a]'}>
          {hasDaily ? '일일회의운영상황 반영' : '의사일정(안) 기준 · 바뀔 수 있음'}
        </Pill>
        {body && (
          <label className="ml-auto inline-flex items-center gap-2 text-[14px] text-slate-600">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="w-4 h-4" /> 교육위·본회의·예결특위 모두 보기
          </label>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((e, i) => <EventCard key={i} e={e} />) : <p className="py-8 text-center text-slate-500">해당 범위 일정 없음</p>}
        {hidden.filter((e) => isEdu(e) && (all || !body || e.body === body)).length > 0 && hasDaily && (
          <details className="rounded-[14px] bg-[var(--nr-bg)] px-4 py-3">
            <summary className="cursor-pointer text-[14px] font-bold text-slate-700">계획(안)에만 있던 일정</summary>
            <div className="mt-3 space-y-3">
              {hidden.filter((e) => isEdu(e) && (all || !body || e.body === body)).map((e, i) => <EventCard key={i} e={e} />)}
            </div>
          </details>
        )}
      </div>
    </Modal>
  );
};

/* ---------- 연간 회기 ---------- */
const SessionsPage: React.FC<{ data: Payload }> = ({ data }) => {
  const t = today();
  const years = [...new Set(data.sessions.map((s) => s.start.slice(0, 4)))].sort().reverse();
  return (
    <>
      <PageTitle desc="도의회 월간 의사일정에 등록된 회기. 다음 해 계획은 전년 11월 정례회에서 확정">연간 회기</PageTitle>
      {years.map((y) => {
        const ss = data.sessions.filter((s) => s.start.startsWith(y));
        const total = ss.reduce((a, s) => a + daysBetween(s.start, s.end), 0);
        return (
          <section key={y} className="mt-8">
            <h2 className="flex items-baseline gap-2">
              <span className="nr-title text-[22px]">{y}년</span>
              <span className="text-[15px] font-extrabold text-[var(--nr-p3)] tabular-nums">{ss.length}회</span>
              <span className="text-[13px] text-slate-500 tabular-nums">회기일수 합 {total}일</span>
            </h2>
            {/* 휴대폰: 표 대신 한 줄씩 */}
            <ul className="sm:hidden mt-3 border-t-2 border-[#33363d] divide-y divide-[var(--nr-line)]">
              {ss.map((s) => {
                const st = s.end < t ? '지남' : s.start > t ? '예정' : '진행 중';
                return (
                  <li key={s.no} className={`py-2.5 px-1 ${st === '진행 중' ? 'bg-[var(--nr-bg)]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <b className="tabular-nums text-[15px]">제{s.no}회</b>
                      <span className="text-[14px]">{s.title.match(/제\d차 정례회/)?.[0] ?? s.kind}</span>
                      <Pill className={`ml-auto ${st === '진행 중' ? 'bg-[#eaf6ec] text-[#267337]' : st === '예정' ? 'bg-[var(--nr-bg)] text-[var(--nr-p3)]' : 'bg-[#f1f3f6] text-[#58616a]'}`}>{st}</Pill>
                    </div>
                    <p className="mt-0.5 text-[14px] text-slate-600 tabular-nums">{span(s.start, s.end)} · {daysBetween(s.start, s.end)}일</p>
                  </li>
                );
              })}
            </ul>
            <div className="hidden sm:block mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-t-2 border-[#33363d] text-[15px]">
                <thead className="bg-[#eef3f9]">
                  <tr>
                    <th scope="col" className="py-2.5 px-3 text-left">회기</th>
                    <th scope="col" className="py-2.5 px-3 text-left">구분</th>
                    <th scope="col" className="py-2.5 px-3 text-left">기간</th>
                    <th scope="col" className="py-2.5 px-3 text-right">일수</th>
                    <th scope="col" className="py-2.5 px-3 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {ss.map((s) => {
                    const st = s.end < t ? '지남' : s.start > t ? '예정' : '진행 중';
                    return (
                      <tr key={s.no} className={`border-b border-[var(--nr-line)] ${st === '진행 중' ? 'bg-[var(--nr-bg)]' : ''}`}>
                        <td className="py-2.5 px-3 font-bold tabular-nums">제{s.no}회</td>
                        <td className="py-2.5 px-3">{s.title.match(/제\d차 정례회/)?.[0] ?? s.kind}</td>
                        <td className="py-2.5 px-3 tabular-nums">{span(s.start, s.end)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{daysBetween(s.start, s.end)}일</td>
                        <td className="py-2.5 px-3 text-center">
                          <Pill className={st === '진행 중' ? 'bg-[#eaf6ec] text-[#267337]' : st === '예정' ? 'bg-[var(--nr-bg)] text-[var(--nr-p3)]' : 'bg-[#f1f3f6] text-[#58616a]'}>{st}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
};

/* ---------- 자료 출처·한계 ---------- */
const AboutPage: React.FC<{ data: Payload }> = ({ data }) => {
  const plans = data.documents.filter((d) => d.type === '계획');
  const dailies = data.documents.filter((d) => d.type === '당일');
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    data.events.forEach((e: CEvent) => (c[e.source.type] = (c[e.source.type] ?? 0) + 1));
    return c;
  }, [data]);
  const Box: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-[14px] bg-[var(--nr-bg)] px-5 py-4">
      <h2 className="font-bold text-[17px]">{title}</h2>
      <ul className="mt-2 space-y-1.5 text-[15px] text-slate-700 list-disc pl-5">{children}</ul>
    </section>
  );
  return (
    <>
      <PageTitle desc="어디서 가져오고, 무엇을 우선하고, 어디까지 믿을 수 있는지">자료 출처·한계</PageTitle>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Box title="출처 세 갈래 (도의회 누리집, 공개 자료)">
          <li><a className="text-[var(--nr-p3)] underline" href={MONTHLY} target="_blank" rel="noreferrer">월간 의사일정</a> — 회기 시작·끝, 다음 해 회기운영계획 포함 · {data.sessions.length}회기</li>
          <li><a className="text-[var(--nr-p3)] underline" href={BOARD_PLAN} target="_blank" rel="noreferrer">의사일정 게시판</a> — 회기별 상임위·본회의 의사일정(안) 한글 첨부 · {plans.length}건 · {counts['계획'] ?? 0}개 일정</li>
          <li><a className="text-[var(--nr-p3)] underline" href={BOARD_DAILY} target="_blank" rel="noreferrer">일일회의운영상황</a> — 회의 날 아침 게시되는 그날 실제 운영 · {dailies.length}일 · {counts['당일'] ?? 0}개 일정</li>
        </Box>
        <Box title="우선 규칙">
          <li>같은 날 일일회의운영상황이 있으면 그 내용이 정답, 계획(안)은 참고로 내림</li>
          <li>같은 회기 의사일정(안)이 다시 올라오면 가장 최근 글만 사용</li>
          <li>계획(안)과 당일 운영상황의 대상 기관·시작 시각이 다르면 「계획과 다름」 표시</li>
        </Box>
        <Box title="한계">
          <li>회의 전날까지는 의사일정(안) 기준 — 도의회 사정으로 바뀔 수 있음</li>
          <li>일일회의운영상황은 그날 아침 게시 → 반영은 다음 수집 때</li>
          <li>한글 첨부를 표 칸 단위로 읽음 — 표 모양이 크게 바뀌면 일부 누락 가능</li>
          <li>문구는 원문 그대로(원문 오탈자 포함). 확정 여부는 원문 확인</li>
        </Box>
        <Box title="수집 시점">
          <li className="tabular-nums">마지막 수집 {data.generated.replace('T', ' ').slice(0, 16)}</li>
          <li>가장 최근 당일 운영상황 {dailies[0]?.posted ?? '없음'}</li>
          <li>가장 최근 의사일정(안) {[...plans].sort((a, b) => b.posted.localeCompare(a.posted))[0]?.posted ?? '없음'} 게시분</li>
        </Box>
      </div>
      <section className="mt-8">
        <h2 className="nr-title text-[20px]">내부망용 파일</h2>
        <div className="mt-3 rounded-[14px] bg-[var(--nr-bg)] px-5 py-4 text-[15px] text-slate-700">
          <ul className="list-disc pl-5 space-y-1">
            <li>화면·글꼴만 담은 HTML 파일 하나 — 일정은 열 때마다 구글 시트에서 읽음 (시트 외 바깥 호출 없음)</li>
            <li>구글 시트는 30분마다 이 웹의 자료로 갱신 — 파일은 한 번 배포하면 다시 받을 필요 없음</li>
            <li>머리 오른쪽 표시등: 초록 = 연결됨, 빨강 = 연결 안 됨</li>
          </ul>
          {!STANDALONE && <div className="mt-4 max-w-[280px]"><DownloadButton variant="block" /></div>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="nr-title text-[20px]">수집 점검</span>
          <span className="text-[13px] text-slate-500 tabular-nums">
            {data.health ? `${stamp(data.health.checked)} 점검` : '점검 기록 없음'} · 마지막 정상 수집 {stamp(data.lastSuccess ?? data.generated)}
          </span>
        </h2>
        {!data.health || data.health.items.length === 0 ? (
          <p className="mt-3 rounded-[14px] bg-[#eaf6ec] px-4 py-3 text-[15px] text-[#267337] font-bold">이상 없음 — 세 출처 모두 정상 수집</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--nr-line)] border-t-2 border-[#33363d] text-[15px]">
            {data.health.items.map((i, k) => (
              <li key={k} className="py-2.5 flex flex-wrap items-start gap-2">
                <Pill className={i.level === 'fail' ? 'bg-[#fdeeee] text-[#b42318]' : 'bg-[#fff3db] text-[#8a5c00]'}>{i.level === 'fail' ? '실패' : '확인 필요'}</Pill>
                <b className="shrink-0">{i.area}</b>
                <span className="min-w-0 flex-1">{i.msg}</span>
                {i.link && (
                  <a href={i.link} target="_blank" rel="noreferrer" className="shrink-0 text-[14px] font-bold text-[var(--nr-p3)] hover:underline">원문 ↗</a>
                )}
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-4 rounded-[14px] bg-[var(--nr-bg)] px-5 py-4 text-[14px] text-slate-700 list-disc pl-9 space-y-1">
          <li>누리집 화면·게시판 목록을 못 읽으면 → 실패 기록, 그 출처 일정은 직전 정상본 유지</li>
          <li>한글 첨부를 못 읽으면(서식 변경) → 그 글만 직전 정상본 유지, 새 글이면 「원문 확인」 안내 표시</li>
          <li>달력의 회기 기간과 문서 머리의 기간이 다르면 → 회기 변경 의심으로 표시</li>
          <li>일정 수가 직전보다 30% 넘게 줄면 → 읽기 누락 의심으로 표시</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="nr-title text-[20px]">반영한 의사일정(안) <span className="text-[15px] font-extrabold text-[var(--nr-p3)]">{plans.length}</span></h2>
        <ul className="mt-3 divide-y divide-[var(--nr-line)] border-t-2 border-[#33363d] text-[15px]">
          {[...plans].sort((a, b) => b.posted.localeCompare(a.posted)).map((d) => (
            <li key={d.id} className="py-2.5 flex flex-wrap gap-x-3">
              <a href={`https://www.jbstatecouncil.jeonbuk.kr/jbassem/board/23/1/read/${d.id}`} target="_blank" rel="noreferrer" className="hover:text-[var(--nr-p3)] hover:underline">{d.title}</a>
              <span className="text-[13px] text-slate-500 tabular-nums">{d.posted} ({dow(d.posted)})</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};
