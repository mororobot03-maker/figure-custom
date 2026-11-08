// 그림으로 보기(손그림 맞춰보기)용 파츠 대응표.
// 그림 파일은 모두 같은 크기·같은 좌표로 잘라 둬서, 겹치기만 하면 관절이 맞는다 (public/sketch/*.png).
// 3D 카탈로그 파츠 id → 그림 파일. 그림이 없는 파츠는 SketchStage에서 "그림 준비 중" 점선 칸으로 보인다.
//
// extras: 그 파츠에 딸린 소품. 지금은 이끼 버섯 요정 하체(벨트 바지)의 골반 옆 주머니 하나.
//         소품은 몸통 위, 머리 아래 층에 그려진다. 다른 파츠에 달고 싶으면 이 표만 바꾸면 된다.

export const SKETCH_RATIO = { w: 448, h: 729 };

const dir = '/sketch/';

export const SKETCH = {
  head_01: { src: `${dir}set_01_head.png` },
  body_01: { src: `${dir}set_01_body.png` },
  legs_01: { src: `${dir}set_01_legs.png`, extras: [{ id: 'pouch_01', src: `${dir}set_01_pouch.png` }] },

  head_04: { src: `${dir}set_04_head.png` },
  body_04: { src: `${dir}set_04_body.png` },
  legs_04: { src: `${dir}set_04_legs.png` },
};

export const hasSketch = (id) => !!SKETCH[id];

export const allSketchSrcs = () =>
  Object.values(SKETCH).flatMap((s) => [s.src, ...(s.extras || []).map((e) => e.src)]);
