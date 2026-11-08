'use client';

import { useEffect, useMemo } from 'react';
import { ZONE_META } from '@/lib/catalog';
import { SKETCH, SKETCH_RATIO, allSketchSrcs } from '@/lib/sketch';

// 손그림 파츠를 겹쳐 보여주는 "그림으로 보기" 레이어.
// 3D 캔버스 위에 덮이고, active가 켜지면 페이드로 전환된다 (전환은 globals.css).
// 층 순서(아래 → 위): 하체 → 몸통 → 소품(주머니) → 머리
export default function SketchStage({ parts, active, label }) {
  // 처음 한 번 전부 미리 받아 둬서, 파츠를 바꿀 때 깜빡이지 않게 한다
  useEffect(() => {
    allSketchSrcs().forEach((src) => { const im = new Image(); im.src = src; });
  }, []);

  const layers = useMemo(() => {
    if (!parts) return [];
    const out = [];
    const push = (zone, key, src) => out.push({ zone, key, src });
    for (const zone of ['legs', 'body']) {
      const s = SKETCH[parts[zone]?.id];
      push(zone, parts[zone]?.id + zone, s ? s.src : null);
    }
    const extras = SKETCH[parts.legs?.id]?.extras || [];
    extras.forEach((e) => push('extra', e.id, e.src));
    const h = SKETCH[parts.head?.id];
    push('head', parts.head?.id + 'head', h ? h.src : null);
    return out;
  }, [parts]);

  return (
    <div className="sketch-layer" data-on={active ? 'true' : 'false'} aria-hidden={!active}>
      <div
        className="sketch-sheet"
        role="img"
        aria-label={label}
        style={{ aspectRatio: `${SKETCH_RATIO.w} / ${SKETCH_RATIO.h}` }}
      >
        {layers.map((l) =>
          l.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.key} className={`sketch-part sketch-${l.zone}`} src={l.src} alt="" draggable={false} />
          ) : (
            <div key={l.key} className={`sketch-ghost sketch-ghost-${l.zone}`}>
              <span>{ZONE_META[l.zone].ko} 그림 준비 중</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
