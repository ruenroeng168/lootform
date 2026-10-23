// Static business facts for Milestone 01. Values that the owner has not
// provided yet (coordinates, prices, PromptPay ID) are deliberately null and
// must not be replaced with invented data.

export const STORE = {
  name: "ลูกชิ้นนายช่าง",
  nameEn: "LUKCHIN NAICHANG",
  tagline: "ลูกชิ้นและอาหารปรุงสุก",
  city: "อุบลราชธานี",
  timezone: "Asia/Bangkok",
  openTime: "09:00",
  closeTime: "22:00",
  deliveryRadiusKm: 5,
  paymentMethod: "PromptPay",
  coordinates: null as { lat: number; lng: number } | null,
} as const;

// Hard switch: ordering and payment are not implemented in Milestone 01.
// Nothing in the app may submit an order or collect money while this is false.
export const ORDERING_ENABLED = false;

export const ORDERING_DISABLED_MESSAGE =
  "ขณะนี้ยังไม่เปิดรับคำสั่งซื้อและการชำระเงินออนไลน์ (ระบบอยู่ระหว่างพัฒนา)";
