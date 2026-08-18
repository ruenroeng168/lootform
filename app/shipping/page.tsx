"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// =====================================
// TYPES
// =====================================

type ShippingAddress = {
  id: number;
  user_id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postal_code: string;
  note: string | null;
  is_default: boolean;
  created_at: string;
};

// =====================================
// PAGE
// =====================================

export default function ShippingPage() {
  const router = useRouter();

  // =====================================
  // USER / ADDRESS DATA
  // =====================================

  const [
    addresses,
    setAddresses,
  ] = useState<ShippingAddress[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  // =====================================
  // FORM
  // =====================================

  const [
    recipientName,
    setRecipientName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    addressLine,
    setAddressLine,
  ] = useState("");

  const [
    subdistrict,
    setSubdistrict,
  ] = useState("");

  const [
    district,
    setDistrict,
  ] = useState("");

  const [
    province,
    setProvince,
  ] = useState("");

  const [
    postalCode,
    setPostalCode,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    isDefault,
    setIsDefault,
  ] = useState(true);

  // =====================================
  // UI STATE
  // =====================================

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    settingDefaultId,
    setSettingDefaultId,
  ] = useState<number | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  // =====================================
  // LOAD ADDRESSES
  // =====================================

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.push("/login");
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from(
          "shipping_addresses"
        )
        .select(`
          id,
          user_id,
          recipient_name,
          phone,
          address_line,
          subdistrict,
          district,
          province,
          postal_code,
          note,
          is_default,
          created_at
        `)
        .eq(
          "user_id",
          user.id
        )
        .order(
          "is_default",
          {
            ascending: false,
          }
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      const loadedAddresses =
        (data ?? []) as ShippingAddress[];

      setAddresses(
        loadedAddresses
      );

      // ถ้ายังไม่มีที่อยู่เลย
      // เปิด Form ให้อัตโนมัติ

      if (
        loadedAddresses.length ===
        0
      ) {
        resetForm();
        setIsDefault(true);
        setFormOpen(true);
      }
    } catch (error) {
      console.error(
        "LOAD SHIPPING ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดที่อยู่จัดส่งได้"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================
  // RESET FORM
  // =====================================

  function resetForm() {
    setEditingId(null);

    setRecipientName("");
    setPhone("");
    setAddressLine("");
    setSubdistrict("");
    setDistrict("");
    setProvince("");
    setPostalCode("");
    setNote("");

    setIsDefault(
      addresses.length === 0
    );

    setErrorMessage("");
  }

  // =====================================
  // ADD NEW ADDRESS
  // =====================================

  function startNewAddress() {
    resetForm();

    setIsDefault(
      addresses.length === 0
    );

    setFormOpen(true);

    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================
  // EDIT ADDRESS
  // =====================================

  function startEditAddress(
    address: ShippingAddress
  ) {
    setEditingId(address.id);

    setRecipientName(
      address.recipient_name
    );

    setPhone(
      address.phone
    );

    setAddressLine(
      address.address_line
    );

    setSubdistrict(
      address.subdistrict ?? ""
    );

    setDistrict(
      address.district ?? ""
    );

    setProvince(
      address.province
    );

    setPostalCode(
      address.postal_code
    );

    setNote(
      address.note ?? ""
    );

    setIsDefault(
      address.is_default
    );

    setFormOpen(true);

    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =====================================
  // CANCEL FORM
  // =====================================

  function cancelForm() {
    resetForm();
    setFormOpen(false);
  }

  // =====================================
  // VALIDATE
  // =====================================

  function validateForm() {
    if (
      !recipientName.trim() ||
      !phone.trim() ||
      !addressLine.trim() ||
      !district.trim() ||
      !province.trim() ||
      !postalCode.trim()
    ) {
      setErrorMessage(
        "กรุณากรอกข้อมูลที่จำเป็นให้ครบ"
      );

      return false;
    }

    const cleanedPhone =
      phone.replace(
        /[\s-]/g,
        ""
      );

    if (
      !/^0\d{8,9}$/.test(
        cleanedPhone
      )
    ) {
      setErrorMessage(
        "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง"
      );

      return false;
    }

    if (
      !/^\d{5}$/.test(
        postalCode.trim()
      )
    ) {
      setErrorMessage(
        "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก"
      );

      return false;
    }

    return true;
  }

  // =====================================
  // SAVE ADDRESS
  // =====================================

  async function saveAddress() {
    if (saving) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.push("/login");
        return;
      }

      // =====================================
      // ถ้าเลือกเป็น Default
      // ปิด Default ของที่อยู่อื่นก่อน
      // =====================================

      if (isDefault) {
        const {
          error:
            clearDefaultError,
        } = await supabase
          .from(
            "shipping_addresses"
          )
          .update({
            is_default: false,
          })
          .eq(
            "user_id",
            user.id
          );

        if (
          clearDefaultError
        ) {
          throw clearDefaultError;
        }
      }

      const payload = {
        recipient_name:
          recipientName.trim(),

        phone:
          phone
            .replace(
              /[\s-]/g,
              ""
            )
            .trim(),

        address_line:
          addressLine.trim(),

        subdistrict:
          subdistrict.trim() ||
          null,

        district:
          district.trim() ||
          null,

        province:
          province.trim(),

        postal_code:
          postalCode.trim(),

        note:
          note.trim() ||
          null,

        is_default:
          isDefault,
      };

      // =====================================
      // EDIT EXISTING
      // =====================================

      if (editingId) {
        const {
          error,
        } = await supabase
          .from(
            "shipping_addresses"
          )
          .update(payload)
          .eq(
            "id",
            editingId
          )
          .eq(
            "user_id",
            user.id
          );

        if (error) {
          throw error;
        }

        setSuccessMessage(
          "แก้ไขที่อยู่จัดส่งเรียบร้อยแล้ว"
        );
      }

      // =====================================
      // CREATE NEW
      // =====================================

      else {
        const {
          error,
        } = await supabase
          .from(
            "shipping_addresses"
          )
          .insert({
            user_id:
              user.id,

            ...payload,
          });

        if (error) {
          throw error;
        }

        setSuccessMessage(
          "บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว"
        );
      }

      resetForm();
      setFormOpen(false);

      await loadAddresses();
    } catch (error) {
      console.error(
        "SAVE SHIPPING ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกที่อยู่ได้"
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================
  // SET DEFAULT ADDRESS
  // =====================================

  async function setDefaultAddress(
    addressId: number
  ) {
    if (settingDefaultId) {
      return;
    }

    setSettingDefaultId(
      addressId
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.push("/login");
        return;
      }

      // ปิด Default ทั้งหมดก่อน

      const {
        error:
          clearDefaultError,
      } = await supabase
        .from(
          "shipping_addresses"
        )
        .update({
          is_default: false,
        })
        .eq(
          "user_id",
          user.id
        );

      if (
        clearDefaultError
      ) {
        throw clearDefaultError;
      }

      // เปิด Default ตัวที่เลือก

      const {
        error:
          setDefaultError,
      } = await supabase
        .from(
          "shipping_addresses"
        )
        .update({
          is_default: true,
        })
        .eq(
          "id",
          addressId
        )
        .eq(
          "user_id",
          user.id
        );

      if (
        setDefaultError
      ) {
        throw setDefaultError;
      }

      setSuccessMessage(
        "ตั้งเป็นที่อยู่หลักเรียบร้อยแล้ว"
      );

      await loadAddresses();
    } catch (error) {
      console.error(
        "DEFAULT ADDRESS ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถตั้งที่อยู่หลักได้"
      );
    } finally {
      setSettingDefaultId(null);
    }
  }

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />

        <div className="min-h-[75vh] flex items-center justify-center">
          <p className="text-cyan-400 tracking-[0.35em] animate-pulse">
            LOADING SHIPPING...
          </p>
        </div>
      </main>
    );
  }

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* =====================================
            HEADER
        ===================================== */}

        <section>
          <div className="flex items-end justify-between gap-5 flex-wrap">

            <div>
              <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
                PHYSICAL DELIVERY
              </p>

              <h1 className="text-4xl sm:text-6xl font-black mt-3">
                ที่อยู่
                <span className="text-cyan-400">
                  จัดส่ง
                </span>
              </h1>

              <p className="text-zinc-500 mt-3 max-w-xl">
                จัดการข้อมูลสำหรับจัดส่งไอเทมจริงจาก LOOTFORM
              </p>
            </div>

            <div className="flex gap-3">

              <button
                onClick={() =>
                  router.push(
                    "/collection"
                  )
                }
                className="
                  border
                  border-zinc-800
                  text-zinc-400
                  px-5
                  py-3
                  rounded-xl
                  text-xs
                  font-black
                  hover:border-cyan-400
                  hover:text-cyan-400
                  transition
                "
              >
                ← COLLECTION
              </button>

              {!formOpen && (
                <button
                  onClick={
                    startNewAddress
                  }
                  className="
                    bg-cyan-400
                    text-black
                    px-5
                    py-3
                    rounded-xl
                    text-xs
                    font-black
                    hover:bg-cyan-300
                    transition
                  "
                >
                  + เพิ่มที่อยู่ใหม่
                </button>
              )}

            </div>
          </div>
        </section>

        {/* =====================================
            MESSAGE
        ===================================== */}

        {errorMessage && (
          <div
            className="
              mt-6
              border
              border-red-400/30
              bg-red-400/[0.07]
              text-red-400
              rounded-xl
              p-5
            "
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="
              mt-6
              border
              border-lime-400/30
              bg-lime-400/[0.07]
              text-lime-400
              rounded-xl
              p-5
            "
          >
            ✓ {successMessage}
          </div>
        )}

        {/* =====================================
            FORM
        ===================================== */}

        {formOpen && (
          <section
            className="
              mt-8
              border
              border-cyan-400/20
              bg-zinc-950/75
              rounded-[26px]
              overflow-hidden
            "
          >
            <div
              className="
                border-b
                border-zinc-800
                bg-cyan-400/[0.03]
                px-6
                sm:px-8
                py-5
              "
            >
              <p
                className="
                  text-cyan-400
                  text-[9px]
                  tracking-[0.25em]
                "
              >
                {editingId
                  ? "EDIT SHIPPING ADDRESS"
                  : "NEW SHIPPING ADDRESS"}
              </p>

              <h2
                className="
                  text-2xl
                  font-black
                  mt-2
                "
              >
                {editingId
                  ? "แก้ไขที่อยู่จัดส่ง"
                  : "เพิ่มที่อยู่จัดส่ง"}
              </h2>
            </div>

            <div
              className="
                p-6
                sm:p-8
                space-y-5
              "
            >
              <Field
                label="ชื่อผู้รับ *"
                value={
                  recipientName
                }
                onChange={
                  setRecipientName
                }
                placeholder="ชื่อ-นามสกุล"
              />

              <Field
                label="เบอร์โทร *"
                value={phone}
                onChange={setPhone}
                placeholder="08xxxxxxxx"
                inputMode="tel"
              />

              <Field
                label="ที่อยู่ *"
                value={
                  addressLine
                }
                onChange={
                  setAddressLine
                }
                placeholder="บ้านเลขที่ หมู่ ถนน ซอย"
              />

              <div
                className="
                  grid
                  sm:grid-cols-2
                  gap-4
                "
              >
                <Field
                  label="ตำบล / แขวง"
                  value={
                    subdistrict
                  }
                  onChange={
                    setSubdistrict
                  }
                  placeholder="ตำบล / แขวง"
                />

                <Field
                  label="อำเภอ / เขต *"
                  value={
                    district
                  }
                  onChange={
                    setDistrict
                  }
                  placeholder="อำเภอ / เขต"
                />
              </div>

              <div
                className="
                  grid
                  sm:grid-cols-2
                  gap-4
                "
              >
                <Field
                  label="จังหวัด *"
                  value={
                    province
                  }
                  onChange={
                    setProvince
                  }
                  placeholder="จังหวัด"
                />

                <Field
                  label="รหัสไปรษณีย์ *"
                  value={
                    postalCode
                  }
                  onChange={
                    setPostalCode
                  }
                  placeholder="34000"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label
                  className="
                    text-zinc-500
                    text-xs
                  "
                >
                  หมายเหตุจัดส่ง
                </label>

                <textarea
                  value={note}
                  onChange={(
                    event
                  ) =>
                    setNote(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="เช่น ฝากไว้กับ รปภ. หรือโทรก่อนจัดส่ง"
                  className="
                    w-full
                    mt-2
                    border
                    border-zinc-800
                    bg-black
                    rounded-xl
                    px-4
                    py-3
                    outline-none
                    focus:border-cyan-400
                    resize-none
                  "
                />
              </div>

              <label
                className="
                  flex
                  items-center
                  gap-3
                  cursor-pointer
                  border
                  border-zinc-800
                  bg-black/40
                  rounded-xl
                  p-4
                "
              >
                <input
                  type="checkbox"
                  checked={
                    isDefault
                  }
                  onChange={(
                    event
                  ) =>
                    setIsDefault(
                      event.target.checked
                    )
                  }
                  className="
                    w-4
                    h-4
                  "
                />

                <div>
                  <p
                    className="
                      text-white
                      text-sm
                      font-bold
                    "
                  >
                    ใช้เป็นที่อยู่หลัก
                  </p>

                  <p
                    className="
                      text-zinc-600
                      text-xs
                      mt-1
                    "
                  >
                    ระบบจะเลือกที่อยู่นี้เป็นค่าเริ่มต้นสำหรับการจัดส่ง
                  </p>
                </div>
              </label>

              <div
                className="
                  grid
                  sm:grid-cols-2
                  gap-3
                  pt-2
                "
              >
                <button
                  onClick={
                    saveAddress
                  }
                  disabled={
                    saving
                  }
                  className="
                    bg-lime-400
                    text-black
                    py-4
                    rounded-xl
                    font-black
                    hover:bg-lime-300
                    disabled:opacity-40
                    transition
                  "
                >
                  {saving
                    ? "กำลังบันทึก..."
                    : editingId
                    ? "บันทึกการแก้ไข"
                    : "บันทึกที่อยู่จัดส่ง"}
                </button>

                <button
                  onClick={
                    cancelForm
                  }
                  disabled={
                    saving
                  }
                  className="
                    border
                    border-zinc-800
                    text-zinc-400
                    py-4
                    rounded-xl
                    font-black
                    hover:border-zinc-600
                    hover:text-white
                    disabled:opacity-40
                    transition
                  "
                >
                  ยกเลิก
                </button>
              </div>

            </div>
          </section>
        )}

        {/* =====================================
            SAVED ADDRESSES
        ===================================== */}

        <section className="mt-10">

          <div
            className="
              flex
              items-center
              justify-between
              gap-4
            "
          >
            <div>
              <p
                className="
                  text-zinc-600
                  text-[9px]
                  tracking-[0.25em]
                "
              >
                SAVED ADDRESSES
              </p>

              <h2
                className="
                  text-2xl
                  font-black
                  mt-2
                "
              >
                ที่อยู่ของฉัน
              </h2>
            </div>

            <div
              className="
                border
                border-zinc-800
                bg-zinc-950
                rounded-xl
                px-4
                py-3
              "
            >
              <p
                className="
                  text-zinc-600
                  text-[8px]
                "
              >
                TOTAL
              </p>

              <p
                className="
                  text-cyan-400
                  font-black
                  mt-1
                "
              >
                {addresses.length}
              </p>
            </div>
          </div>

          {/* EMPTY */}

          {addresses.length ===
          0 ? (
            <div
              className="
                mt-5
                border
                border-zinc-800
                bg-zinc-950/60
                rounded-[24px]
                p-10
                text-center
              "
            >
              <p
                className="
                  text-zinc-600
                  text-sm
                "
              >
                ยังไม่มีที่อยู่จัดส่ง
              </p>

              <button
                onClick={
                  startNewAddress
                }
                className="
                  mt-5
                  bg-cyan-400
                  text-black
                  px-6
                  py-3
                  rounded-xl
                  text-xs
                  font-black
                "
              >
                + เพิ่มที่อยู่
              </button>
            </div>
          ) : (
            <div
              className="
                grid
                lg:grid-cols-2
                gap-4
                mt-5
              "
            >
              {addresses.map(
                (address) => (
                  <AddressCard
                    key={
                      address.id
                    }
                    address={
                      address
                    }
                    settingDefault={
                      settingDefaultId ===
                      address.id
                    }
                    onEdit={() =>
                      startEditAddress(
                        address
                      )
                    }
                    onSetDefault={() =>
                      setDefaultAddress(
                        address.id
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

// =====================================
// ADDRESS CARD
// =====================================

function AddressCard({
  address,
  settingDefault,
  onEdit,
  onSetDefault,
}: {
  address: ShippingAddress;
  settingDefault: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  return (
    <article
      className={`
        relative
        border
        rounded-[22px]
        p-6
        transition

        ${
          address.is_default
            ? `
              border-lime-400/40
              bg-lime-400/[0.04]
              shadow-[0_0_30px_rgba(163,230,53,0.05)]
            `
            : `
              border-zinc-800
              bg-zinc-950/70
            `
        }
      `}
    >
      {/* DEFAULT BADGE */}

      {address.is_default && (
        <div
          className="
            absolute
            top-5
            right-5
            border
            border-lime-400/30
            bg-lime-400/[0.08]
            text-lime-400
            rounded-full
            px-3
            py-1
            text-[8px]
            font-black
            tracking-[0.15em]
          "
        >
          DEFAULT
        </div>
      )}

      <p
        className="
          text-cyan-400
          text-[8px]
          tracking-[0.2em]
        "
      >
        RECIPIENT
      </p>

      <h3
        className="
          text-xl
          font-black
          mt-2
          pr-20
        "
      >
        {
          address.recipient_name
        }
      </h3>

      <p
        className="
          text-zinc-400
          text-sm
          mt-2
        "
      >
        {address.phone}
      </p>

      <div
        className="
          mt-5
          border-t
          border-zinc-800
          pt-5
        "
      >
        <p
          className="
            text-zinc-300
            text-sm
            leading-7
          "
        >
          {
            address.address_line
          }

          {address.subdistrict
            ? ` ต.${address.subdistrict}`
            : ""}

          {address.district
            ? ` อ.${address.district}`
            : ""}

          {` จ.${address.province}`}

          {` ${address.postal_code}`}
        </p>

        {address.note && (
          <div
            className="
              mt-4
              border
              border-zinc-800
              bg-black/40
              rounded-xl
              p-3
            "
          >
            <p
              className="
                text-zinc-600
                text-[8px]
              "
            >
              NOTE
            </p>

            <p
              className="
                text-zinc-400
                text-xs
                mt-1
              "
            >
              {address.note}
            </p>
          </div>
        )}
      </div>

      <div
        className="
          grid
          sm:grid-cols-2
          gap-2
          mt-5
        "
      >
        <button
          onClick={
            onEdit
          }
          className="
            border
            border-cyan-400/25
            bg-cyan-400/[0.03]
            text-cyan-400
            py-3
            rounded-xl
            text-xs
            font-black
            hover:border-cyan-400
            hover:bg-cyan-400/[0.08]
            transition
          "
        >
          แก้ไข
        </button>

        {!address.is_default ? (
          <button
            onClick={
              onSetDefault
            }
            disabled={
              settingDefault
            }
            className="
              border
              border-lime-400/25
              bg-lime-400/[0.03]
              text-lime-400
              py-3
              rounded-xl
              text-xs
              font-black
              hover:border-lime-400
              hover:bg-lime-400/[0.08]
              disabled:opacity-40
              transition
            "
          >
            {settingDefault
              ? "กำลังตั้งค่า..."
              : "ตั้งเป็นที่อยู่หลัก"}
          </button>
        ) : (
          <div
            className="
              border
              border-lime-400/20
              bg-lime-400/[0.04]
              text-lime-400
              py-3
              rounded-xl
              text-xs
              font-black
              text-center
            "
          >
            ✓ ที่อยู่หลัก
          </div>
        )}
      </div>
    </article>
  );
}

// =====================================
// INPUT FIELD
// =====================================

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder: string;
  inputMode?:
    | "text"
    | "tel"
    | "numeric";
}) {
  return (
    <div>
      <label
        className="
          text-zinc-500
          text-xs
        "
      >
        {label}
      </label>

      <input
        type="text"
        inputMode={
          inputMode
        }
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="
          w-full
          mt-2
          border
          border-zinc-800
          bg-black
          rounded-xl
          px-4
          py-3
          outline-none
          focus:border-cyan-400
          transition
        "
      />
    </div>
  );
}