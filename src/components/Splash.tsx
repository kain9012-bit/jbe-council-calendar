import React, { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import type { Live, Phase } from '../lib/data';

/** 상태 표시등 — 초록: 연결됨 · 빨강: 연결 안 됨 · 주황: 연결 중 */
export const Lamp: React.FC<{ live: Live; size?: number }> = ({ live, size = 10 }) => (
  <span
    aria-hidden="true"
    style={{ width: size, height: size }}
    className={`inline-block shrink-0 rounded-full jbc-lamp ${
      live === 'sheet' ? 'jbc-lamp-on' : live === 'error' ? 'jbc-lamp-off' : 'jbc-lamp-wait'
    }`}
  />
);

const STEPS: { key: Phase; label: string }[] = [
  { key: 'connect', label: '구글 시트 연결' },
  { key: 'receive', label: '최신 일정 받기' },
  { key: 'done', label: '달력 그리기' },
];
const ORDER: Phase[] = ['connect', 'receive', 'done'];

/**
 * 내부망 파일을 열 때의 로딩 화면.
 * 시트를 읽는 동안 단계·경과 시간을 보여 주고, 실패하면 같은 자리에서 원인과 다시 시도를 보여 줌.
 * 성공하면 부드럽게 사라짐.
 */
export const Splash: React.FC<{ live: Live; phase: Phase; error: string; onRetry: () => void }> = ({ live, phase, error, onRetry }) => {
  const [sec, setSec] = useState(0);
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (live !== 'loading') return;
    setSec(0);
    const t = window.setInterval(() => setSec((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [live]);
  useEffect(() => {
    if (live !== 'sheet') return;
    setLeaving(true);
    const t = window.setTimeout(() => setGone(true), 700);
    return () => window.clearTimeout(t);
  }, [live]);
  if (gone) return null;
  const failed = live === 'error';
  const cur = ORDER.indexOf(phase === 'error' ? 'connect' : phase);
  return (
    <div
      role={failed ? 'alert' : 'status'}
      aria-live="polite"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[var(--nr-band)] px-5 ${leaving ? 'jbc-fade-out' : ''}`}
    >
      <div className="w-full max-w-[460px] rounded-[20px] bg-white px-7 py-9 sm:px-10 shadow-[0_10px_40px_rgba(28,100,172,0.12)] text-center">
        <span aria-hidden="true" className="mx-auto grid grid-cols-2 gap-1 w-12 h-12">
          {['var(--nr-p1)', '#32bdb8', '#fecd20', 'var(--nr-p2)'].map((c, i) => (
            <span
              key={i}
              className={`rounded-[4px] ${failed || leaving ? '' : 'jbc-tile'}`}
              style={{ background: c, animationDelay: `${[0, 0.15, 0.45, 0.3][i]}s` }}
            />
          ))}
        </span>
        <p className="nr-title mt-4 text-[24px] text-[#002f63]">도의회 회의운영 달력</p>
        <p className="mt-1 text-[13px] text-slate-500">내부망용 파일 · 일정은 구글 시트에서 불러옴</p>

        <div className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-bold ${
          failed ? 'bg-[#fdeeee] text-[#b42318]' : leaving ? 'bg-[#eaf6ec] text-[#267337]' : 'bg-[#fff3db] text-[#8a5c00]'}`}>
          <Lamp live={live} />
          {failed ? '구글 시트 연결 안 됨' : leaving ? '구글 시트 연결됨' : '구글 시트 연결 중'}
        </div>

        {!failed ? (
          <>
            <p className="mt-5 text-[17px] font-bold text-slate-900">{leaving ? '최신 일정을 불러왔습니다' : '최신 일정을 불러오는 중입니다'}</p>
            <p className="mt-1 text-[14px] text-slate-500">
              {leaving ? '달력을 엽니다' : sec >= 8 ? '조금 더 걸리고 있습니다. 망 상태에 따라 최대 20초' : '잠시만 기다려 주세요'}
              {!leaving && <span className="ml-1 tabular-nums">· {sec}초</span>}
            </p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--nr-bg)]">
              {leaving ? <div className="h-full w-full bg-[#22c55e]" /> : <div className="jbc-bar h-full w-2/5 rounded-full bg-[var(--nr-p3)]" />}
            </div>
            <ol className="mt-6 space-y-2 text-left text-[15px]">
              {STEPS.map((s, i) => {
                const doneStep = leaving || i < cur;
                const now = !leaving && i === cur;
                return (
                  <li key={s.key} className={`flex items-center gap-2.5 ${doneStep ? 'text-slate-800' : now ? 'text-[var(--nr-p3)] font-bold' : 'text-slate-400'}`}>
                    <span className={`grid place-items-center w-6 h-6 rounded-full ${doneStep ? 'bg-[#22c55e] text-white' : now ? 'bg-[var(--nr-bg)]' : 'bg-[#f1f3f6]'}`}>
                      {doneStep ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : now ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <span className="text-[12px] tabular-nums">{i + 1}</span>}
                    </span>
                    {s.label}
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <>
            <p className="mt-5 text-[17px] font-bold text-slate-900">최신 일정을 불러오지 못했습니다</p>
            <ul className="mt-4 rounded-[14px] bg-[var(--nr-bg)] px-5 py-4 text-left text-[14px] text-slate-700 space-y-1.5">
              <li className="flex gap-2"><X className="w-4 h-4 mt-0.5 shrink-0 text-[#b42318]" aria-hidden="true" />이 PC에서 구글 시트(docs.google.com) 접속 가능 여부 확인</li>
              <li className="flex gap-2"><X className="w-4 h-4 mt-0.5 shrink-0 text-[#b42318]" aria-hidden="true" />잠시 뒤 다시 시도</li>
            </ul>
            <p className="mt-2 text-[12px] text-slate-400">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex items-center gap-1.5 h-11 px-6 rounded-[10px] bg-[var(--nr-p3)] text-white text-[15px] font-bold hover:bg-[var(--nr-p2)]"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" /> 다시 시도
            </button>
          </>
        )}
      </div>
    </div>
  );
};
