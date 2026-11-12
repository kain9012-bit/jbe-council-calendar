import React, { useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, FileText } from 'lucide-react';
import type { CEvent } from '../types';
import { postUrl, span, tone } from '../lib/data';

export const Pill: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full text-[13px] font-bold whitespace-nowrap ${className}`}>{children}</span>
);

/** 출처 표지 — 당일 운영상황(확정) / 의사일정(안) */
export const SourcePill: React.FC<{ e: CEvent }> = ({ e }) =>
  e.source.type === '당일' ? (
    <Pill className="bg-[#eaf6ec] text-[#267337]">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> 당일 운영상황
    </Pill>
  ) : (
    <Pill className="bg-[var(--nr-bg)] text-[var(--nr-p3)]">
      <FileText className="w-3.5 h-3.5" aria-hidden="true" /> 의사일정(안)
    </Pill>
  );

/** 일정 한 건 — 회의체·차수·시각·내용·출처 */
export const EventCard: React.FC<{ e: CEvent; showDate?: boolean }> = ({ e, showDate }) => {
  const [open, setOpen] = useState(false);
  const lines = e.text.split('\n');
  const agenda = e.agenda ?? [];
  const [more, setMore] = useState(false);
  return (
    <article className={`rounded-[14px] border p-4 ${e.notInDaily ? 'border-dashed border-slate-300 bg-slate-50/60' : 'border-[var(--nr-line)] bg-white'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center h-[26px] px-2.5 rounded-md text-[13px] font-bold ${tone(e.body)}`}>{e.body}</span>
        {e.meeting && <span className="text-[14px] font-bold text-slate-700">{e.meeting}</span>}
        <span className="text-[15px] font-bold tabular-nums text-slate-900">{showDate ? span(e.start, e.end) + ' ' : ''}{e.time}</span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {e.changed && e.changed.length > 0 && (
            <Pill className="bg-[#fff3db] text-[#8a5c00]">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> 계획과 다름
            </Pill>
          )}
          <SourcePill e={e} />
        </span>
      </div>
      {e.notInDaily && <p className="mt-2 text-[13px] text-slate-500">! 의사일정(안)에는 있었으나 그날 일일회의운영상황에는 없던 일정</p>}
      {agenda.length > 0 ? (
        <ol className="mt-3 space-y-1 text-[15px] text-slate-800">
          {(more ? agenda : agenda.slice(0, 6)).map((a, i) => (
            <li key={i} className="pl-5 -indent-5">{a}</li>
          ))}
          {agenda.length > 6 && (
            <li>
              <button type="button" onClick={() => setMore(!more)} className="text-[14px] font-bold text-[var(--nr-p3)] hover:underline">
                {more ? '접기' : `안건 ${agenda.length - 6}건 더 보기`}
              </button>
            </li>
          )}
        </ol>
      ) : (
        <div className="mt-3 space-y-0.5 text-[15px] text-slate-800">
          {lines.map((l, i) =>
            l.startsWith('-') ? (
              <p key={i} className="pl-4 -indent-2 text-slate-600">{l}</p>
            ) : (
              <p key={i} className={i === 0 ? 'font-bold' : ''}>{l}</p>
            ),
          )}
        </div>
      )}
      {e.changed && e.changed.length > 0 && e.planned && (
        <div className="mt-3 rounded-[10px] bg-[#fffaf0] px-3 py-2 text-[14px]">
          <button type="button" onClick={() => setOpen(!open)} className="font-bold text-[#8a5c00] hover:underline">
            {open ? '계획표 내용 접기' : `계획표 내용 보기 (${e.changed.join(' · ')})`}
          </button>
          {open && (
            <div className="mt-2 space-y-2 text-slate-700">
              {e.planned.map((p, i) => (
                <p key={i} className="whitespace-pre-line"><b className="tabular-nums">{p.time || '시각 없음'}</b> {p.text}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-[13px] text-slate-500">
        <a href={postUrl(e.source.board, e.source.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[var(--nr-p3)] underline underline-offset-2">
          {e.source.title}
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>{' '}
        · {e.source.posted} 게시
      </p>
    </article>
  );
};
