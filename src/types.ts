export interface Session {
  no: number;
  title: string;
  kind: '정례회' | '임시회';
  start: string;
  end: string;
  id: number;
}

export interface Source {
  type: '계획' | '당일';
  board: number;
  id: number;
  title: string;
  posted: string;
}

export interface CEvent {
  start: string;
  end: string;
  time: string;
  body: string;
  meeting: string;
  text: string;
  agenda?: string[];
  source: Source;
  minor: boolean;
  session: number | null;
  superseded: boolean;
  notInDaily?: boolean;
  changed?: string[];
  planned?: { time: string; text: string }[];
  unplanned?: boolean;
}

export interface HealthItem {
  level: 'ok' | 'warn' | 'fail';
  area: string;
  msg: string;
  link?: string;
}

export interface Payload {
  generated: string;
  lastSuccess?: string;
  health?: { checked: string; status: 'ok' | 'warn' | 'fail'; items: HealthItem[] };
  sessions: Session[];
  events: CEvent[];
  documents: Source[];
}

export type Scope = 'edu' | 'all';
