import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowUpRight, Check, ChevronRight, Download, Home, Link2, X } from 'lucide-react';
import { BOARD_DAILY, BOARD_PLAN, MONTHLY, STANDALONE, downloadStandalone, type Live } from '../lib/data';
import { Lamp } from './Splash';
import { BrandIcon } from './BrandIcon';

/**
 * 전북교육청 누리집 하위 화면 틀 (기준: jbe-staff-tools-board Shell.tsx)
 * 머리말 → [왼쪽 메뉴 | 위치 표시 + 본문] → 바닥글
 */
export type MenuKey = 'calendar' | 'list' | 'sessions' | 'about';
export const MENU: { key: MenuKey; label: string; href: string }[] = [
  { key: 'calendar', label: '월간 달력', href: '#/' },
  { key: 'list', label: '다가오는 일정', href: '#/list' },
  { key: 'sessions', label: '연간 회기', href: '#/sessions' },
  { key: 'about', label: '자료 출처·한계', href: '#/about' },
];

export const BOX = 'mx-4 min-[1024px]:mx-5 min-[1200px]:mx-auto min-[1200px]:max-w-[1200px] min-[1600px]:max-w-[1620px]';

const Ext: React.FC<{ href: string; children: React.ReactNode; className?: string }> = ({ href, children, className = '' }) => (
  <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-0.5 ${className}`}>
    {children}
    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
    <span className="sr-only">(새 창)</span>
  </a>
);

/** 웹판 — 지금 자료를 담은 내부망용 단일 HTML 내려받기 */
export const DownloadButton: React.FC<{ variant?: 'link' | 'block' | 'small' }> = ({ variant = 'link' }) => {
  const [st, setSt] = useState<'idle' | 'busy' | 'err'>('idle');
  if (STANDALONE) return null;
  const go = async () => {
    setSt('busy');
    try {
      await downloadStandalone();
      setSt('idle');
    } catch {
      setSt('err');
      setTimeout(() => setSt('idle'), 3000);
    }
  };
  const label = st === 'busy' ? '파일 만드는 중…' : st === 'err' ? '받기 실패 — 다시 시도' : '내부망용 파일 받기';
  const cls =
    variant === 'block'
      ? 'flex w-full items-center justify-center gap-1.5 h-11 rounded-[10px] bg-[var(--nr-p3)] text-white text-[15px] font-bold hover:bg-[var(--nr-p2)] disabled:opacity-70'
      : variant === 'small'
        ? 'inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--nr-p3)] text-white text-[13px] font-bold disabled:opacity-70'
        : 'inline-flex items-center gap-1 font-bold text-[var(--nr-p3)] hover:underline disabled:opacity-70';
  return (
    <button type="button" onClick={go} disabled={st === 'busy'} className={cls}>
      <Download className="w-3.5 h-3.5" aria-hidden="true" /> {label}
    </button>
  );
};

const LIVE_LABEL: Record<Live, string> = { web: '', sheet: '구글 시트 연결됨', error: '구글 시트 연결 안 됨', loading: '구글 시트 연결 중' };

/** 내부망 파일 — 구글 시트 연결 표시등 (초록·빨강·주황) */
export const SheetStatus: React.FC<{ live: Live; asOf?: string; onRetry?: () => void }> = ({ live, asOf, onRetry }) => (
  <span
    role="status"
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] sm:text-[14px] font-bold whitespace-nowrap ${
      live === 'sheet'
        ? 'border-[#bfe5c8] bg-[#eaf6ec] text-[#1f6a33]'
        : live === 'error'
          ? 'border-[#f5c2c0] bg-[#fdeeee] text-[#b42318]'
          : 'border-[#f3d9a4] bg-[#fff3db] text-[#8a5c00]'
    }`}
  >
    <Lamp live={live} />
    {LIVE_LABEL[live]}
    {live === 'sheet' && asOf && <span className="hidden sm:inline font-medium opacity-80 tabular-nums">· {asOf} 수집</span>}
    {live === 'error' && onRetry && (
      <button type="button" onClick={onRetry} className="underline underline-offset-2">다시 시도</button>
    )}
  </span>
);

export const SiteHeader: React.FC<{ active: MenuKey; asOf?: string; live?: Live; onRetry?: () => void }> = ({ active, asOf, live = 'web', onRetry }) => (
  <header className="bg-white border-b border-[var(--nr-line)] jbe-noprint">
    <div className={BOX}>
      <div className="hidden md:flex justify-end gap-3 pt-3 text-[13px] text-slate-600">
        {STANDALONE ? <b className="text-slate-800">내부망용 파일</b> : <DownloadButton />}
        <span className="text-slate-300" aria-hidden="true">|</span>
        <span>비공식 업무지원 도구</span>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <span className="tabular-nums">{asOf ? `${asOf} 수집 기준` : '수집 시점 확인 중'}</span>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <Ext href={BOARD_PLAN} className="hover:text-[var(--nr-p3)]">도의회 의사일정 게시판</Ext>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <Ext href={BOARD_DAILY} className="hover:text-[var(--nr-p3)]">일일회의운영상황</Ext>
      </div>
      <div className="flex items-center gap-4 py-3 md:py-2">
        <a href="#/" className="flex items-center gap-2.5">
          <BrandIcon size={34} className="shrink-0" />
          <span className="leading-tight">
            <strong className="nr-title block text-[1.375rem] text-[#002f63]">도의회 회의운영 달력</strong>
            <span className="block text-[12px] text-slate-500">전북특별자치도교육청 · 전북특별자치도의회 일정</span>
          </span>
        </a>
        {STANDALONE ? (
          <span className="ml-auto"><SheetStatus live={live} asOf={asOf} onRetry={onRetry} /></span>
        ) : (
          <span className="ml-auto md:hidden"><DownloadButton variant="small" /></span>
        )}
      </div>
    </div>
    <nav aria-label="주메뉴" className="border-t border-[var(--nr-line)] lg:hidden">
      <div className={BOX}>
        <ul className="-mx-3 flex overflow-x-auto no-scrollbar">
          {MENU.map((m) => (
            <li key={m.key}>
              <a
                href={m.href}
                aria-current={active === m.key ? 'page' : undefined}
                className={`block whitespace-nowrap px-3 py-3 text-base border-b-[3px] transition-colors ${
                  active === m.key
                    ? 'border-[var(--nr-p3)] text-[var(--nr-p3)] font-bold'
                    : 'border-transparent text-[var(--nr-text)] hover:text-[var(--nr-p3)]'
                }`}
              >
                {m.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  </header>
);

export const Breadcrumb: React.FC<{ trail: string[] }> = ({ trail }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 권한 없으면 넘어감 */
    }
  };
  return (
    <div className="h-12 lg:h-[60px] flex items-center gap-2 text-[13px] text-slate-600 jbe-noprint">
      <a href="#/" aria-label="처음으로" className="hover:text-[var(--nr-p3)]">
        <Home className="w-4 h-4" aria-hidden="true" />
      </a>
      {trail.map((t, i) => (
        <span key={i} className="flex items-center gap-2 min-w-0">
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <span className={i === trail.length - 1 ? 'font-bold text-slate-800 truncate' : 'whitespace-nowrap'}>{t}</span>
        </span>
      ))}
      <button
        type="button"
        onClick={copy}
        className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--nr-p2)] px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90"
      >
        {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Link2 className="w-3.5 h-3.5" aria-hidden="true" />}
        {copied ? '복사됨' : '주소 복사'}
      </button>
    </div>
  );
};

export interface LnbSub {
  label: string;
  href: string;
  on: boolean;
  count?: number;
}

export const Lnb: React.FC<{ active: MenuKey; subs?: Partial<Record<MenuKey, LnbSub[]>> }> = ({ active, subs }) => (
  <aside className="hidden lg:block w-[200px] min-[1200px]:w-[280px] shrink-0 jbe-noprint" aria-label="메뉴">
    <h2 className="flex flex-col items-center justify-center gap-1.5 h-[130px] rounded-[10px_10px_40px_10px] bg-[var(--nr-p1)] text-white shadow-[0_0_10px_rgba(35,88,195,0.1)]">
      <span className="nr-title text-[22px] min-[1200px]:text-[28px] leading-none">도의회 일정</span>
      <span className="text-[13px] min-[1200px]:text-[14px] font-medium text-white/85">회의운영 달력</span>
    </h2>
    <ul className="mt-5 space-y-2">
      {MENU.map((m) => {
        const on = active === m.key;
        const sub = subs?.[m.key];
        return (
          <li key={m.key}>
            <a
              href={m.href}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center justify-between rounded-[10px] px-5 py-[18px] text-[18px] transition-colors ${
                on
                  ? 'bg-[var(--nr-p2)] text-white font-semibold'
                  : 'bg-white text-[var(--nr-text)] shadow-[0_0_0_1px_#eef0f4,0_2px_6px_rgba(0,0,0,0.04)] hover:text-[var(--nr-p3)]'
              }`}
            >
              {m.label}
              <ChevronRight className="w-4 h-4 opacity-70" aria-hidden="true" />
            </a>
            {on && sub && sub.length > 0 && (
              <ul className="mt-1 rounded-[10px] bg-[var(--nr-bg)] px-4 py-3 space-y-1.5">
                {sub.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      className={`flex items-center gap-1.5 text-[15px] ${
                        s.on ? 'font-bold text-[var(--nr-p2)] underline underline-offset-4' : 'text-slate-700 hover:text-[var(--nr-p3)]'
                      }`}
                    >
                      <span aria-hidden="true">•</span>
                      {s.label}
                      {s.count !== undefined && <span className="ml-auto tabular-nums text-[13px] text-slate-500">{s.count}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
    {!STANDALONE && (
      <div className="mt-6 rounded-[10px] border border-[var(--nr-line)] px-4 py-4 text-[13px] text-slate-600">
        <p className="font-bold text-slate-800">내부망에서 보기</p>
        <p className="mt-1">HTML 파일 하나. 열 때마다 구글 시트에서 최신 일정을 읽음</p>
        <div className="mt-3"><DownloadButton variant="block" /></div>
      </div>
    )}
    <div className="mt-4 rounded-[10px] bg-[var(--nr-bg)] px-4 py-3 text-[13px] text-slate-600 space-y-1">
      <p className="font-bold text-slate-800">원문 바로가기</p>
      <p><Ext href={MONTHLY} className="hover:text-[var(--nr-p3)]">월간 의사일정</Ext></p>
      <p><Ext href={BOARD_PLAN} className="hover:text-[var(--nr-p3)]">의사일정 게시판</Ext></p>
      <p><Ext href={BOARD_DAILY} className="hover:text-[var(--nr-p3)]">일일회의운영상황</Ext></p>
    </div>
  </aside>
);

export const SubLayout: React.FC<{ lnb: React.ReactNode; trail: string[]; children: React.ReactNode }> = ({ lnb, trail, children }) => (
  <div className="relative flex-1">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-12 lg:h-[100px] bg-[var(--nr-band)]" />
    <div className={`relative ${BOX} lg:pt-10 flex gap-10 min-[1200px]:gap-[60px]`}>
      {lnb}
      <main id="container" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <Breadcrumb trail={trail} />
        <div className="pt-6 lg:pt-8">{children}</div>
      </main>
    </div>
  </div>
);

export const PageTitle: React.FC<{ children: React.ReactNode; desc?: React.ReactNode; right?: React.ReactNode }> = ({ children, desc, right }) => (
  <div className="border-b border-[var(--nr-line)] pb-5 lg:pt-2">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="nr-title text-[28px] sm:text-[36px] leading-tight text-black">{children}</h1>
      {right}
    </div>
    {desc && <p className="mt-2 text-[15px] text-slate-600">{desc}</p>}
  </div>
);

export const SiteFooter: React.FC = () => (
  <footer className="mt-16 bg-[#f7f8fa] border-t border-[var(--nr-line)] jbe-noprint">
    <div className={`${BOX} py-8 text-[14px] text-slate-600 space-y-2`}>
      <p className="nr-title text-[18px] text-[#002f63]">도의회 회의운영 달력</p>
      <p>전북특별자치도의회 회기·본회의·위원회 일정을 교육청 직원이 한눈에 보도록 모은 비공식 업무지원 화면</p>
      {STANDALONE && <p className="font-bold text-slate-800">내부망용 파일 — 열 때마다 구글 시트에서 최신 일정을 읽음</p>}
      <p>
        <b className="text-slate-800">담당</b> 정책기획과 빅데이터담당 · <b className="text-slate-800">성격</b> 비공식 · 일정 확정은 도의회 원문 기준
      </p>
      <p className="pt-3 border-t border-[var(--nr-line)] text-[13px] text-slate-500">
        자료 출처 — 전북특별자치도의회 누리집{' '}
        <a href={MONTHLY} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--nr-p3)]">월간 의사일정</a>,{' '}
        <a href={BOARD_PLAN} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--nr-p3)]">의사일정 게시판</a>,{' '}
        <a href={BOARD_DAILY} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--nr-p3)]">일일회의운영상황</a>
      </p>
    </div>
  </footer>
);

/** 팝업 — Esc·바깥 누르기로 닫힘 */
export const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-[760px] max-h-[92vh] overflow-y-auto rounded-t-[18px] sm:rounded-[18px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--nr-line)] bg-white px-5 sm:px-6 py-4">
          <div className="min-w-0 flex-1">{title}</div>
          <button type="button" onClick={onClose} aria-label="닫기" className="grid place-items-center w-9 h-9 rounded-full bg-[#f1f3f6] hover:bg-[#e5e8ed]">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export const TopButton: React.FC = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const f = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return show ? (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="맨 위로"
      className="fixed right-4 bottom-4 z-40 grid place-items-center w-12 h-12 rounded-full bg-[var(--nr-p2)] text-white shadow-lg jbe-noprint"
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  ) : null;
};
