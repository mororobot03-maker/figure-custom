'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZONES, ZONE_META, byId, isValidSelection, totalPrice, won } from '@/lib/catalog';
import { clearAll, loadCapture, loadSelection } from '@/lib/session';

const EMPTY = { name: '', address: '', phone: '' };

export default function OrderPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState(null);
  const [capture, setCapture] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { id, total, status }
  const confirmRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const sel = loadSelection();
    setSelection(isValidSelection(sel) ? sel : null);
    setCapture(loadCapture());
    setReady(true);
  }, []);

  const total = selection ? totalPrice(selection) : 0;

  const finish = () => { clearAll(); router.push('/'); };

  // 완료 모달: 포커스 가두기 + ESC로 닫기
  useEffect(() => {
    if (!done) return;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { finish(); return; }
      if (e.key === 'Tab') {
        const order = [closeRef.current, confirmRef.current];
        const i = order.indexOf(document.activeElement);
        e.preventDefault();
        order[(i + (e.shiftKey ? -1 : 1) + order.length) % order.length].focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.address.trim()) e.address = true;
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev?.preventDefault();
    if (submitting || !selection) return;
    setBanner('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selection, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) { setDone(data); return; }
      if (res.status === 409) {
        setBanner(`품절된 파츠가 있어요: ${(data.names || []).join(', ')}. 다시 조합해 주세요.`);
      } else {
        setBanner('요청을 처리하지 못했어요. 다시 시도해 주세요.');
      }
    } catch {
      setBanner('요청을 처리하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: false }));
  };

  if (!ready) return <div className="theme-workshop order-root" />;

  return (
    <div className="theme-workshop order-root">
      <div className="order-inner">
        <nav className="order-nav">
          <button id="btn-back" onClick={() => router.push('/')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
            다시 조합하기
          </button>
          <span className="arrive">반딧불 공방에 도착했어요</span>
          <div className="steps" aria-label="진행 단계: 주문">
            <div className="step done"><span className="pt" />조합</div>
            <span className="line" />
            <div className="step cur"><span className="pt" />주문</div>
          </div>
        </nav>

        <div id="error-banner" role="alert" hidden={!banner}>
          <span>{banner}</span>
          <button className="banner-close" aria-label="닫기" onClick={() => setBanner('')}>✕</button>
        </div>

        {!selection ? (
          <section id="order-invalid" className="card">
            <h2>조합이 완성되지 않았어요</h2>
            <p>메인 화면에서 피규어를 완성해 주세요.</p>
            <button className="btn btn-secondary" onClick={() => router.push('/')}>메인으로 돌아가기</button>
          </section>
        ) : (
          <>
            <div className="order-grid">
              <div id="capture-card" className="card" hidden={!capture}>
                {capture && <img id="capture-img" src={capture} alt="내가 조합한 피규어 정면 모습" />}
              </div>

              <section className="card parts-card" aria-label="선택한 파츠">
                <h2>선택한 파츠</h2>
                <div id="order-parts">
                  {ZONES.map((z) => {
                    const p = byId(selection[z]);
                    return (
                      <div className="part-row" key={z}>
                        <span className="num-tag">{ZONE_META[z].num} · {ZONE_META[z].en}</span>
                        <div className="meta">
                          <span className="nm">{p.name}</span>
                          <span className="pr num">{won(p.price)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="total-row">
                  <span>합계</span>
                  <span id="order-total" className="num">{won(total)}</span>
                </div>
              </section>
            </div>

            <form id="order-form" className="card form-card" onSubmit={submit} noValidate>
              <h2>배송지</h2>
              <div className={`field${errors.name ? ' has-error' : ''}`}>
                <label htmlFor="input-name">받는 사람</label>
                <input id="input-name" value={form.name} onChange={set('name')} placeholder="백조" autoComplete="off" maxLength={20} />
                <span className="err">필수 정보를 입력해주세요</span>
              </div>
              <div className={`field${errors.address ? ' has-error' : ''}`}>
                <label htmlFor="input-address">주소</label>
                <input id="input-address" value={form.address} onChange={set('address')} placeholder="가상시 임시구 테스트동" autoComplete="off" maxLength={80} />
                <span className="err">필수 정보를 입력해주세요</span>
              </div>
              <div className={`field${errors.phone ? ' has-error' : ''}`}>
                <label htmlFor="input-phone">연락처</label>
                <input id="input-phone" value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" inputMode="tel" autoComplete="off" maxLength={20} />
                <span className="err">필수 정보를 입력해주세요</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                결제 없이 진행되는 시연용 주문이에요. 실제 정보를 입력하지 않아도 돼요.
              </p>
            </form>
          </>
        )}
      </div>

      {selection && (
        <div className="order-bar">
          <div className="order-bar-inner">
            <div>
              <div className="lbl">선택한 파츠 합계</div>
              <div className="amt num">{won(total)}</div>
            </div>
            <button id="btn-submit" className="btn btn-primary" disabled={submitting} onClick={submit}>
              {submitting ? '접수 중…' : '주문 완료하기'}
            </button>
          </div>
        </div>
      )}

      <div id="complete-modal" className="modal-scrim" hidden={!done}>
        {done && (
          <div id="complete-modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button ref={closeRef} className="banner-close" aria-label="닫기" onClick={finish}
              style={{ position: 'absolute', top: 8, right: 8, color: 'var(--on-surface)' }}>✕</button>
            <div className="check">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <h2 id="modal-title">주문이 가상으로 접수되었습니다</h2>
            <div className="modal-summary">
              {capture && <img src={capture} alt="" />}
              <div className="rows">
                {ZONES.map((z) => (
                  <div className="r" key={z}>
                    <small>{ZONE_META[z].num} · {ZONE_META[z].en}</small>
                    {byId(selection[z]).name}
                  </div>
                ))}
                <div className="tot"><span>합계</span><span className="num">{won(done.total)}</span></div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <span className="chip chip-waiting">{done.status}</span>
            </div>
            <p className="modal-note">결제 없이 진행된 시연용 주문이에요</p>
            <button id="btn-modal-confirm" ref={confirmRef} className="btn btn-primary" onClick={finish}>확인</button>
          </div>
        )}
      </div>
    </div>
  );
}
