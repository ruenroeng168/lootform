import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <p className="mt-2 text-stone-700">ไม่พบหน้าที่คุณต้องการ</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-brand-600 px-5 py-3 font-semibold text-white">
        กลับหน้าแรก
      </Link>
    </div>
  );
}
