"""
OBJ 파츠(머리/몸통/하체) → 웹용 GLB 변환 (임시 도구).
실제 파이프라인(.blend → GLB, 관절은 J_* Empty)이 갖춰지기 전까지 Groot 테스트 모델용으로 쓴다.

- OBJ는 '하나로 조립된 피규어에서 분리 추출된' 파츠라 원본 좌표 그대로 두면 서로 맞는다.
  (원본 스크립트 paint_and_render.py의 설명 참고) → 세 파츠에 같은 이동·크기 변환만 적용한다.
- 이동: 하체 바닥 y=0, 하체 중심이 x,z 원점 (ASSET_UPLOAD_RULES 5장). 크기: 파일 단위 × UNIT_SCALE
- 관절: OBJ에는 Empty가 없으므로, 맞닿는 두 파츠의 겹치는 구간 한가운데를 같은 좌표로 정한다.
  → 같은 세트끼리는 원본 위치 그대로 재현된다.
- 채색: paint_and_render.py의 팔레트 그대로 (머리 아래 60% 나무색 / 위 40% 잎색, 몸통 나무색, 하체 밝은 나무색)
- 폴리곤: 웹 예산에 맞게 quadric decimation

사용: python3 -I tools/convert_obj.py <obj_dir> <out_dir>
"""
import json, sys
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OBJ_DIR, OUT_DIR = sys.argv[1], sys.argv[2]
SET = 'set_04_base'
UNIT_SCALE = 0.0015           # 파일 단위 → 미터 (전체 키 약 11.6cm)
FACES = {'head': 26000, 'body': 26000, 'legs': 12000, 'stand': 12000}
SRC = {'head': 'head_base.obj', 'body': 'body_base.obj', 'legs': 'leg_base.obj', 'stand': 'stand_base.obj'}


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(name, rgb, rough=0.85, metal=0.0):
    # glTF baseColorFactor는 리니어 값
    lin = [srgb_to_lin(c) for c in rgb] + [1.0]
    return PBRMaterial(name=name, baseColorFactor=lin, roughnessFactor=rough, metallicFactor=metal)


WOOD = mat('wood', (0.55, 0.38, 0.24))
WOOD_L = mat('wood_light', (0.64, 0.46, 0.30))
LEAF = mat('leaf', (0.47, 0.76, 0.61))
STAND_LOW = mat('base', (0.38, 0.27, 0.18))
# 원본은 metallic 0.8이지만 환경맵이 없는 웹 장면에서는 검게 보여 낮춘다
STAND_HIGH = mat('metal', (0.70, 0.72, 0.74), rough=0.45, metal=0.35)

raw = {}
for k, f in SRC.items():
    m = trimesh.load(f'{OBJ_DIR}/{f}', file_type='obj', force='mesh', process=True)
    raw[k] = m
    print(k, 'verts', len(m.vertices), 'faces', len(m.faces))

# 세 파츠 공통 변환 (원본 상대 위치 유지)
lb = raw['legs'].bounds
shift = np.array([-(lb[0][0] + lb[1][0]) / 2, -lb[0][1], -(lb[0][2] + lb[1][2]) / 2])


def xf(v):
    return (v + shift) * UNIT_SCALE


b = {k: (raw[k].bounds * 1.0) for k in raw}
cx = (np.mean([b['head'][:, 0].mean(), b['body'][:, 0].mean()]) + shift[0]) * UNIT_SCALE
cz = (np.mean([b['head'][:, 2].mean(), b['body'][:, 2].mean()]) + shift[2]) * UNIT_SCALE
neck_y = ((b['head'][0][1] + b['body'][1][1]) / 2 + shift[1]) * UNIT_SCALE
waist_y = ((b['body'][0][1] + b['legs'][1][1]) / 2 + shift[1]) * UNIT_SCALE
joints = {
    'head': {'J_neck': [cx, neck_y, cz]},
    'body': {'J_neck': [cx, neck_y, cz], 'J_waist': [cx, waist_y, cz]},
    'legs': {'J_waist': [cx, waist_y, cz]},
}

stats = {}
for k, m in raw.items():
    d = m.simplify_quadric_decimation(face_count=FACES[k])
    d.vertices = xf(d.vertices)
    d.remove_unreferenced_vertices()
    d.fix_normals()

    parts = []
    if k == 'stand':
        # 베이스: 아래 45% 나무 받침색 / 위 55% 금속색 (paint_and_render.py와 같은 기준)
        ys = d.vertices[:, 1]
        cut = ys.min() + (ys.max() - ys.min()) * 0.45
        cy = d.vertices[d.faces][:, :, 1].mean(axis=1)
        for name, material, sel in (('stand_low', STAND_LOW, cy <= cut), ('stand_high', STAND_HIGH, cy > cut)):
            sub = d.submesh([np.where(sel)[0]], append=True)
            sub.visual = trimesh.visual.TextureVisuals(material=material)
            parts.append((name, sub))
    elif k == 'head':
        ys = d.vertices[:, 1]
        y0, y1 = ys.min(), ys.max()
        cut = y0 + (y1 - y0) * 0.60
        cy = d.vertices[d.faces][:, :, 1].mean(axis=1)
        for name, material, sel in (('head_wood', WOOD, cy <= cut), ('head_leaf', LEAF, cy > cut)):
            sub = d.submesh([np.where(sel)[0]], append=True)
            sub.visual = trimesh.visual.TextureVisuals(material=material)
            parts.append((name, sub))
    else:
        d.visual = trimesh.visual.TextureVisuals(material=WOOD if k == 'body' else WOOD_L)
        parts.append((k, d))

    scene = trimesh.Scene()
    for name, sub in parts:
        scene.add_geometry(sub, geom_name=name, node_name=name)
    out = f'{OUT_DIR}/{SET}_{k}.glb'
    data = scene.export(file_type='glb')
    open(out, 'wb').write(data)
    tb = d.bounds
    stats[k] = {'tris': int(len(d.faces)), 'kb': len(data) // 1024,
                'min': [round(float(x), 4) for x in tb[0]], 'max': [round(float(x), 4) for x in tb[1]]}
    print(k, stats[k])

json.dump({'set': SET, 'unitScale': UNIT_SCALE, 'joints': joints, 'parts': stats},
          open(f'{OUT_DIR}/{SET}.json', 'w'), indent=2)
print('joints', json.dumps(joints))
