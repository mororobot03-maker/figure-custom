// 관절 기준 조립 (PRD M1).
// 위치만 맞추고 회전은 맞추지 않는다. 모든 파츠는 똑바로 선 자세, 정면 +Z(glTF)로 만들어진다는 전제.
//
//  1. 하체: 원본 좌표 그대로 (바닥 y=0)
//  2. 몸통: body.J_waist == legs.J_waist
//  3. 머리: head.J_neck  == body.J_neck
//  4. 팔은 몸통 group의 자식이므로 몸통을 따라간다 (J_shoulder는 몸통 안에서 이미 일치)

import * as THREE from 'three';

export function assemble(parts, root) {
  const { head, body, legs } = parts;

  // 이전 배치를 비우고 다시 배치 (파츠 group은 캐시된 객체라 dispose하지 않는다)
  while (root.children.length) root.remove(root.children[0]);

  legs.group.position.set(0, 0, 0);
  const waistWorld = legs.joints.J_waist.clone();

  body.group.position.copy(waistWorld).sub(body.joints.J_waist);
  const neckWorld = body.group.position.clone().add(body.joints.J_neck);

  head.group.position.copy(neckWorld).sub(head.joints.J_neck);

  root.add(legs.group, body.group, head.group);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  return { height: size.y, width: Math.max(size.x, size.z), box };
}

// 인사 모션의 어깨 월드 좌표 확인 등 디버그용
export function jointWorld(part, name) {
  const v = part.joints[name];
  if (!v) return null;
  return part.group.localToWorld(v.clone());
}
