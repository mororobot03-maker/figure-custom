import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="theme-glade notfound">
      <div className="logo">Figu<b>Mix</b></div>
      <h1>이 늪은 아직 비어 있어요</h1>
      <p>찾고 있는 페이지가 이 안개 속 어딘가에 숨어 있는 것 같아요.</p>
      <Link href="/" className="btn btn-primary">메인으로 돌아가기</Link>
    </div>
  );
}
