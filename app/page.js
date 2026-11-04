'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stage3D from '@/components/Stage3D';
import {
  CATALOG, DEFAULT_SELECTION, ZONES, ZONE_META,
  byCategory, byId, isValidSelection, originalSetFor, totalPrice, won,
} from '@/lib/catalog';
import { loadBase, loadSelection, saveBase, saveCapture, saveSelection } from '@/lib/session';

const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

export default function MainPage() {
  const router = useRouter();
  const stageRef = useRef(null);

  const [selection, setSelection] = useState(null);
  const [stockMap, setStockMap] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | completing
  const [zoneLoading, setZoneLoading] = useState({});
  const [flash, setFlash] = useState(null);
  const [hintOn, setHintOn] = useState(true);
  const [toast, setToast] = useState(null);
  const [fade, setFade] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [touch, setTouch] = useState(true);
  const [debug, setDebug] = useState(false);
  const [debugState, setDebugState] = useState('ready');
  const [announce, setAnnounce] = useState('');
  const [showBase, setShowBase] = useState(false);

  // 첫 진입: 직전 조합이 있으면 복원, 없으면 원본 세트
  useEffect(() => {
    const saved = loadSelection();
    setSelection(isValidSelection(saved) ? saved : DEFAULT_SELECTION);
    setShowBase(loadBase());
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    setDebug(new URLSearchParams(window.location.search).has('debug'));
  }, []);

  useEffect(() => { if (selection) saveSelection(selection); }, [selection]);

  // 재고 (서버가 기준)
  useEffect(() => {
    fetch('/api/stock', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setStockMap(d.stock))
      .catch(() => {});
  }, []);

  const stockOf = useCallback(
    (id) => (stockMap ? stockMap[id] : byId(id)?.stock) ?? 0,
    [stockMap]
  );
  const isSoldOut = (id) => stockOf(id) < 1 || (debugState === 'soldout' && !!selection && id === selection.legs);

  const parts = useMemo(
    () => (selection ? Object.fromEntries(ZONES.map((z) => [z, byId(selection[z])])) : null),
    [selection]
  );
  const total = selection ? totalPrice(selection) : 0;
  const anySoldOut = !!selection && ZONES.some((z) => isSoldOut(selection[z]));
  const originalApplied = !!selection && (() => {
    const o = originalSetFor(selection.head);
    return !!o && o.body === selection.body && o.legs === selection.legs;
  })();

  // 디버그용 상태 미리보기 (?debug)
  const shown = debugState === 'loading' || debugState === 'error' || debugState === 'completing'
    ? debugState
    : status;
  const busy = shown === 'completing';
  const canComplete = shown === 'ready' && !!selection && !anySoldOut;

  const swap = (zone, dir) => {
    if (busy || !selection) return;
    const list = byCategory(zone);
    const i = list.findIndex((p) => p.id === selection[zone]);
    const next = list[(i + (dir === 'next' ? 1 : -1) + list.length) % list.length];
    setSelection({ ...selection, [zone]: next.id });
    setFlash(zone);
    setTimeout(() => setFlash((f) => (f === zone ? null : f)), 320);
    setAnnounce(`${ZONE_META[zone].ko}: ${next.name}`);
  };

  const applyOriginal = () => {
    if (busy || !selection || originalApplied) return;
    const o = originalSetFor(selection.head);
    if (!o) return;
    setSelection(o);
    setToast('원본 세트로 맞췄어요');
    setTimeout(() => setToast(null), 3000);
  };

  const toggleBase = () => {
    if (busy) return;
    const next = !showBase;
    setShowBase(next);
    saveBase(next);
    setAnnounce(next ? '베이스를 보여요' : '베이스를 숨겨요');
  };

  const complete = async () => {
    if (!canComplete) return;
    setStatus('completing');
    setHintOn(false);
    const { image } = await stageRef.current.runGreeting();
    saveSelection(selection);
    saveCapture(image);
    setFade(true);
    setTimeout(() => router.push('/order'), 400);
  };

  const label = parts
    ? `${parts.head.name}, ${parts.body.name}, ${parts.legs.name}으로 조립된 피규어`
    : '피규어를 불러오는 중';

  return (
    <div className="theme-glade">
      <main className="main-root" data-state={shown}>
        <header className="glade-header">
          <div className="logo">Figu<b>Mix</b></div>
          {debug && (
            <label className="debug-select">
              상태 미리보기
              <select value={debugState} onChange={(e) => setDebugState(e.target.value)}>
                {['ready', 'loading', 'error', 'completing', 'soldout'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </header>

        <div className="stage-wrap">
          <div id="stage" role="img" aria-label={label}>
            <Stage3D
              ref={stageRef}
              selection={selection}
              showBase={showBase}
              onBaseError={() => { setShowBase(false); saveBase(false); setToast('베이스를 불러오지 못했어요'); setTimeout(() => setToast(null), 3000); }}
              retryKey={retryKey}
              onStatus={(s) => setStatus((cur) => (cur === 'completing' ? cur : s))}
              onZoneLoading={(z, v) => setZoneLoading((m) => ({ ...m, [z]: v }))}
              onZoneError={() => { setToast('파츠를 불러오지 못했어요'); setTimeout(() => setToast(null), 3000); }}
              onInteract={() => setHintOn(false)}
            />
          </div>
          <div className="vignette" />

          {parts && ZONES.map((z) => {
            const p = parts[z];
            const meta = ZONE_META[z];
            return (
              <div
                key={z}
                className={`zone${zoneLoading[z] ? ' is-loading' : ''}${isSoldOut(p.id) ? ' is-soldout' : ''}${flash === z ? ' flash' : ''}`}
                data-zone={z}
              >
                {/* pointerdown에서 stopPropagation: 회전 드래그와 분리 */}
                <button
                  className="zone-arrow" data-dir="prev"
                  aria-label={`${meta.ko} 이전 파츠`}
                  disabled={busy}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => swap(z, 'prev')}
                ><Chevron dir="prev" /></button>
                <div className="zone-label">
                  <span className="zone-num">{meta.num} · {meta.en}</span>
                  <span className="zone-name">{p.name}</span>
                  <span className="zone-price num">{won(p.price)}</span>
                  <span className="zone-status soldout chip chip-soldout">품절</span>
                  <span className="zone-dots" aria-hidden="true"><i /><i /><i /></span>
                </div>
                <button
                  className="zone-arrow" data-dir="next"
                  aria-label={`${meta.ko} 다음 파츠`}
                  disabled={busy}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => swap(z, 'next')}
                ><Chevron dir="next" /></button>
              </div>
            );
          })}

          <div className="stage-bottom">
            <p id="gesture-hint" hidden={!hintOn}>
              {touch ? '드래그로 돌리고, 두 손가락으로 확대해 보세요' : '드래그로 돌리고, 휠로 확대해 보세요'}
            </p>
            <div className="chip-row">
              <button
                id="original-set-chip"
                className={originalApplied ? 'is-applied' : ''}
                disabled={originalApplied || busy}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={applyOriginal}
              >
                <span className="dot" />
                {originalApplied ? '적용됨' : '원본 세트'}
              </button>
              <button
                id="base-toggle"
                aria-pressed={showBase}
                disabled={busy}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleBase}
              >
                <span className="dot" />
                {showBase ? '베이스 숨기기' : '베이스 보이기'}
              </button>
            </div>
          </div>

          <div id="stage-loading" className="stage-overlay" role="status">
            <h2>피규어를 깨우는 중…</h2>
            <div className="firefly-dots"><i /><i /><i /></div>
          </div>
          <div id="stage-error" className="stage-overlay" role="alert">
            <h2>피규어를 불러오지 못했어요</h2>
            <button
              id="btn-retry" className="btn btn-secondary"
              onClick={() => { setStatus('loading'); setDebugState('ready'); setRetryKey((k) => k + 1); }}
            >다시 시도</button>
          </div>

          <div className="toast" hidden={!toast} role="status">{toast}</div>
          <div className="sr-only" aria-live="polite">{announce}</div>
        </div>

        <div id="summary-bar">
          <div className="summary-inner">
            <div className="summary-left">
              <span id="summary-note" className={anySoldOut ? 'warn' : ''}>
                {anySoldOut ? '품절된 파츠가 포함돼 있어요' : '선택한 파츠 합계'}
              </span>
              <span id="total-price" className="num">{won(total)}</span>
            </div>
            <button
              id="btn-complete" className="btn btn-primary"
              disabled={!canComplete}
              onClick={complete}
            >선택 완료</button>
          </div>
        </div>
      </main>
      <div className={`fade-to-workshop${fade ? ' on' : ''}`} />
    </div>
  );
}
