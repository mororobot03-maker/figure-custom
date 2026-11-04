# FiguMix (피규믹스) v0.2

머리·몸통·하체 3D 파츠를 한 화면에서 바꿔 끼우고, 돌려보고, 인사 모션 뒤 주문까지 가는 커스텀 피규어 웹.
기준 문서: PRD v0.2 / DESIGN.md v2 / ASSET_UPLOAD_RULES.md (프로젝트 문서)

## 실행

```bash
npm install
npm run dev        # http://localhost:3966
# 또는
npm run build && npm start
```

- 점검용: 주소 뒤에 `?debug`를 붙이면 상태 미리보기 셀렉트가 보이고, 콘솔에서 `window.__stage`로 3D 장면에 접근할 수 있다.
- 폰트(Google Fonts, Pretendard)는 CDN에서 받는다. 오프라인이면 시스템 글꼴로 보인다.

## 구조

| 경로 | 역할 |
|---|---|
| `app/page.js` | 메인 — 조합 + 3D 뷰, 구역 화살표, 원본 세트 칩, 선택 완료 흐름 |
| `app/order/page.js` | 주문 — 캡처 이미지, 파츠 요약, 배송지 폼, 완료 모달 |
| `app/api/orders/route.js` | 주문 접수. 파츠 ID 검증, 재고 확인·차감(잠금), 금액은 서버에서 재계산 |
| `app/api/stock/route.js` | 현재 재고 |
| `components/Stage3D.js` | Three.js 스테이지: 회전·줌(pan 없음), 파츠 교체, 정면 이동, 캡처, 인사 모션 |
| `lib/catalog.js` | 파츠 카탈로그 (세트·가격·재고·관절 이름) |
| `lib/parts3d.js` | 파츠 로더. **지금은 임시 절차적 모델**, GLB 연결 자리가 `buildFromModel` |
| `lib/assemble.js` | 관절 기준 조립 (하체 → 몸통 `J_waist` → 머리 `J_neck`, 위치만 맞춤) |
| `lib/serverStore.js` | 재고·주문 저장소(메모리). 실제 서비스에서는 DB + 행 잠금으로 교체 |
| `app/globals.css` | 디자인 토큰(`.theme-glade` / `.theme-workshop`)과 컴포넌트 스타일 |

## 실제 .blend/GLB로 바꾸기

1. `lib/catalog.js` 항목에 `modelUrl`을 채운다 (예: `/models/set_01_mosscap_head.glb`).
2. `lib/parts3d.js`의 `buildFromModel`에서 `GLTFLoader` + `DRACOLoader`로 불러와 같은 형태를 돌려준다:
   `{ group, joints: { J_neck: Vector3, ... }, arm }` — 관절은 GLB 안의 `J_*` Empty 노드 위치, 팔은 이름이 `arm_R1`인 노드.
3. 나머지(조립·교체·인사·캡처)는 그대로 동작한다. 팔이 없는 몸통은 자동으로 점프+한 바퀴(Plan B) 인사를 한다.

## 베이스(스탠드) 보이기/숨기기

- 메인 화면의 [베이스 보이기]/[베이스 숨기기] 버튼. 상태는 주문 화면에 갔다 와도 유지되고, 3D 캡처에도 같이 찍힌다.
- 스탠드(`stand_base.obj` → `set_04_base_stand.glb`)는 **나무결 몸통·하체의 원본 좌표에 맞춰** 만들어져 있어, 그 파츠일 때만 막대가 등에 정확히 닿는다.
- 보이면 이끼 바닥이 베이스 밑면까지 내려가고, 인사의 한 바퀴 회전 때 함께 돈다.
- 변환: `python3 -I tools/convert_obj.py <obj_dir> public/models`

## 알려둘 점

- 주문 시 이름·주소·연락처는 **저장하지 않는다** (시연용, PRD 7장). 주문에는 파츠 ID·합계·상태만 남긴다.
- 서버 메모리 저장이라 서버를 다시 켜면 재고·주문이 초기화된다.
- 시안의 숲 배경 사진은 이미지 파일이 없어서 그라디언트·이끼 바닥·반딧불 입자로 대신했다.
