/* =========================================================
   LOOTFORM SHOP — shared types, constants and formatting

   Safe to import from both Server and Client Components.
   Prices are whole THB. The server is always the source of
   truth for price and stock — anything the client shows (cart,
   totals) is a preview that /api/shop/orders recalculates.
========================================================= */

export const SHOP_CATEGORIES = [
  { code: "TEES", label: "เสื้อยืด", labelEn: "TEES" },
  { code: "HOODIES", label: "ฮู้ดดี้", labelEn: "HOODIES" },
  { code: "OUTERWEAR", label: "แจ็กเก็ต", labelEn: "OUTERWEAR" },
  { code: "PANTS", label: "กางเกง", labelEn: "PANTS" },
  { code: "ACCESSORIES", label: "แอคเซสซอรี่", labelEn: "ACCESSORIES" },
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]["code"];

export const SHOP_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];

/* Flat-rate Thailand shipping, free above a threshold.
   Passed into store_place_order_atomic() so the database
   computes the same total the checkout page previews. */
export const SHIPPING_FEE_THB = 60;
export const FREE_SHIPPING_MIN_THB = 1500;

export const MAX_QTY_PER_LINE = 10;
export const MAX_CART_LINES = 20;

export type ShopVariant = {
  id: number;
  size: string;
  stock: number;
};

export type ShopProduct = {
  id: number;
  slug: string;
  name: string;
  category: ShopCategory;
  description: string;
  price_thb: number;
  compare_at_price_thb: number | null;
  images: string[];
  color_name: string | null;
  material: string | null;
  fit: string | null;
  care: string | null;
  is_featured: boolean;
  is_new: boolean;
  variants: ShopVariant[];
};

export type ShopOrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export const ORDER_STATUS_META: Record<
  ShopOrderStatus,
  { label: string; color: string; description: string }
> = {
  PENDING: {
    label: "รอตรวจสอบการชำระเงิน",
    color: "var(--grade-legendary)",
    description: "ทีมงานกำลังตรวจสอบสลิป โดยปกติภายใน 24 ชม.",
  },
  PAID: {
    label: "ชำระเงินแล้ว · กำลังแพ็ค",
    color: "var(--grade-rare)",
    description: "ยืนยันการชำระเงินแล้ว กำลังเตรียมจัดส่ง",
  },
  SHIPPED: {
    label: "จัดส่งแล้ว",
    color: "var(--grade-epic)",
    description: "พัสดุออกจากคลังแล้ว ตรวจสอบเลขพัสดุได้ด้านล่าง",
  },
  DELIVERED: {
    label: "จัดส่งสำเร็จ",
    color: "#7bd88f",
    description: "ขอบคุณที่ช้อปกับ LOOTFORM",
  },
  CANCELLED: {
    label: "ยกเลิกแล้ว",
    color: "#f87171",
    description: "คำสั่งซื้อนี้ถูกยกเลิก",
  },
};

export function formatTHB(value: number) {
  return `฿${Math.round(value).toLocaleString("th-TH")}`;
}

export function categoryLabel(code: string) {
  return SHOP_CATEGORIES.find((category) => category.code === code)?.label ?? code;
}

export function shippingFeeFor(subtotal: number) {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_MIN_THB ? 0 : SHIPPING_FEE_THB;
}

export function sortVariants<T extends { size: string }>(variants: T[]) {
  return [...variants].sort((a, b) => {
    const ia = SHOP_SIZE_ORDER.indexOf(a.size);
    const ib = SHOP_SIZE_ORDER.indexOf(b.size);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export function totalStock(product: Pick<ShopProduct, "variants">) {
  return product.variants.reduce((sum, variant) => sum + variant.stock, 0);
}

export function discountPercent(product: Pick<ShopProduct, "price_thb" | "compare_at_price_thb">) {
  const compare = product.compare_at_price_thb;
  if (!compare || compare <= product.price_thb) return 0;
  return Math.round(((compare - product.price_thb) / compare) * 100);
}

/* Size guide (cm) shared by product pages. Body measurements
   are for the regular-fit core tee; the oversized fit runs
   about one size larger. */
export const SIZE_GUIDE: Record<string, { size: string; chest: number; length: number }[]> = {
  TOPS: [
    { size: "S", chest: 96, length: 68 },
    { size: "M", chest: 102, length: 71 },
    { size: "L", chest: 108, length: 74 },
    { size: "XL", chest: 114, length: 77 },
    { size: "XXL", chest: 120, length: 80 },
  ],
  PANTS: [
    { size: "S", chest: 72, length: 98 },
    { size: "M", chest: 78, length: 100 },
    { size: "L", chest: 84, length: 102 },
    { size: "XL", chest: 90, length: 104 },
    { size: "XXL", chest: 96, length: 106 },
  ],
};
