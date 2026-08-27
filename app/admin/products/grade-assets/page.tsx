"use client";

import {
  ChangeEvent,
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import Navbar from "@/components/Navbar";
import AdminModelPreview from "@/components/AdminModelPreview";

import {
  supabase,
} from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type GradeAsset = {
  id: number;

  design_id: number;

  grade: Grade;

  thumbnail_url:
    | string
    | null;

  thumbnail_path:
    | string
    | null;

  model_url:
    | string
    | null;

  model_path:
    | string
    | null;

  image_ready: boolean;

  model_ready: boolean;

  created_at: string;

  updated_at: string;
};

type ProductDesign = {
  id: number;

  product_id: number;

  design_code: string;

  name: string;

  craft_cost_lt: number;

  thumbnail_url:
    | string
    | null;

  model_url:
    | string
    | null;

  available_sizes: string[];

  sort_order: number;

  is_active: boolean;
};

type Product = {
  id: number;

  code: string;

  name: string;

  category: string;

  equip_slot: string;

  season: string;

  description:
    | string
    | null;

  is_active: boolean;

  designs: ProductDesign[];
};

type UploadState = {
  grade: Grade;

  type:
    | "IMAGE"
    | "MODEL";
};

/* =========================================================
   CONFIG
========================================================= */

const grades: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const gradeText: Record<
  Grade,
  string
> = {
  COMMON:
    "text-zinc-300",

  RARE:
    "text-cyan-400",

  EPIC:
    "text-purple-400",

  LEGENDARY:
    "text-orange-400",
};

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON:
    "border-zinc-700",

  RARE:
    "border-cyan-400/40",

  EPIC:
    "border-purple-400/40",

  LEGENDARY:
    "border-orange-400/40",
};

const gradeBackground: Record<
  Grade,
  string
> = {
  COMMON:
    "bg-zinc-400/[0.025]",

  RARE:
    "bg-cyan-400/[0.025]",

  EPIC:
    "bg-purple-400/[0.025]",

  LEGENDARY:
    "bg-orange-400/[0.025]",
};

/* =========================================================
   PAGE

   useSearchParams() requires a Suspense boundary above it for
   static export/prerendering (Next.js "missing-suspense-with-csr-
   bailout") -- the default export below wraps the actual page in
   one; this inner component is unchanged otherwise.
========================================================= */

export default function AdminGradeAssetsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white">
          <Navbar />
          <div className="flex min-h-[80vh] items-center justify-center text-sm font-black tracking-[0.3em] text-cyan-400">
            LOADING...
          </div>
        </main>
      }
    >
      <AdminGradeAssetsContent />
    </Suspense>
  );
}

function AdminGradeAssetsContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  /* =======================================================
     URL PARAMS

     Example:

     /admin/products/grade-assets
       ?product_id=1
       &design_id=3
  ======================================================= */

  const requestedProductId =
    useMemo(() => {
      const value =
        Number(
          searchParams.get(
            "product_id"
          )
        );

      return Number.isInteger(
        value
      ) &&
        value > 0
        ? value
        : null;
    }, [
      searchParams,
    ]);

  const requestedDesignId =
    useMemo(() => {
      const value =
        Number(
          searchParams.get(
            "design_id"
          )
        );

      return Number.isInteger(
        value
      ) &&
        value > 0
        ? value
        : null;
    }, [
      searchParams,
    ]);

  /* =======================================================
     STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    loadingAssets,
    setLoadingAssets,
  ] =
    useState(false);

  const [
    products,
    setProducts,
  ] =
    useState<Product[]>(
      []
    );

  const [
    selectedProductId,
    setSelectedProductId,
  ] =
    useState<
      number | null
    >(null);

  const [
    selectedDesignId,
    setSelectedDesignId,
  ] =
    useState<
      number | null
    >(null);

  const [
    assets,
    setAssets,
  ] =
    useState<
      GradeAsset[]
    >([]);

  const [
    uploading,
    setUploading,
  ] =
    useState<
      UploadState | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    previewModel,
    setPreviewModel,
  ] =
    useState<{
      grade: Grade;

      url: string;
    } | null>(
      null
    );

  /* =======================================================
     SELECTED PRODUCT
  ======================================================= */

  const selectedProduct =
    useMemo(
      () =>
        products.find(
          (product) =>
            product.id ===
            selectedProductId
        ) ??
        null,
      [
        products,
        selectedProductId,
      ]
    );

  /* =======================================================
     SELECTED DESIGN
  ======================================================= */

  const selectedDesign =
    useMemo(
      () =>
        selectedProduct?.designs.find(
          (design) =>
            design.id ===
            selectedDesignId
        ) ??
        null,
      [
        selectedProduct,
        selectedDesignId,
      ]
    );

  /* =======================================================
     SESSION TOKEN
  ======================================================= */

  async function getSessionToken() {
    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (!session) {
      router.push(
        "/login"
      );

      return null;
    }

    return session.access_token;
  }

  /* =======================================================
     UPDATE URL

     Keeps Product / Design selection shareable
     and allows Product Catalog to deep-link here.
  ======================================================= */

  function updateSelectionUrl(
    productId: number,
    designId:
      | number
      | null
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "product_id",
      String(
        productId
      )
    );

    if (
      designId
    ) {
      params.set(
        "design_id",
        String(
          designId
        )
      );
    }

    router.replace(
      `/admin/products/grade-assets?${params.toString()}`,
      {
        scroll:
          false,
      }
    );
  }

  /* =======================================================
     LOAD PRODUCTS
  ======================================================= */

  async function loadProducts() {
    setLoading(
      true
    );

    setErrorMessage(
      ""
    );

    try {
      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          "/api/admin/products",
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
          result.error ||
          "Unable to load Product Catalog"
        );
      }

      const loadedProducts =
        (
          Array.isArray(
            result.products
          )
            ? result.products
            : Array.isArray(
                result.catalog
              )
              ? result.catalog
              : []
        ) as Product[];

      setProducts(
        loadedProducts
      );

      /* ---------------------------------------------------
         NO PRODUCT
      --------------------------------------------------- */

      if (
        loadedProducts.length ===
        0
      ) {
        setSelectedProductId(
          null
        );

        setSelectedDesignId(
          null
        );

        setAssets(
          []
        );

        return;
      }

      /* ---------------------------------------------------
         REQUESTED PRODUCT

         Prefer URL product_id.

         Invalid URL product:
         fallback to first Product.
      --------------------------------------------------- */

      const requestedProduct =
        requestedProductId
          ? loadedProducts.find(
              (product) =>
                product.id ===
                requestedProductId
            )
          : null;

      const product =
        requestedProduct ??
        loadedProducts[0];

      setSelectedProductId(
        product.id
      );

      /* ---------------------------------------------------
         NO DESIGN
      --------------------------------------------------- */

      if (
        !Array.isArray(
          product.designs
        ) ||
        product.designs.length ===
          0
      ) {
        setSelectedDesignId(
          null
        );

        setAssets(
          []
        );

        updateSelectionUrl(
          product.id,
          null
        );

        return;
      }

      /* ---------------------------------------------------
         REQUESTED DESIGN

         Must belong to selected Product.

         Invalid URL design:
         fallback to first Design.
      --------------------------------------------------- */

      const requestedDesign =
        requestedDesignId
          ? product.designs.find(
              (design) =>
                design.id ===
                requestedDesignId
            )
          : null;

      const design =
        requestedDesign ??
        product.designs[0];

      setSelectedDesignId(
        design.id
      );

      /*
        Normalize URL only when URL was missing
        or invalid.
      */

      if (
        requestedProductId !==
          product.id ||
        requestedDesignId !==
          design.id
      ) {
        updateSelectionUrl(
          product.id,
          design.id
        );
      }
    } catch (
      error
    ) {
      console.error(
        "GRADE ASSET PRODUCT LOAD ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Product Catalog"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* =======================================================
     LOAD GRADE ASSETS
  ======================================================= */

  async function loadGradeAssets(
    designId: number
  ) {
    setLoadingAssets(
      true
    );

    setErrorMessage(
      ""
    );

    try {
      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `/api/admin/products/grade-assets?design_id=${designId}`,
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        result.ok !==
          true
      ) {
        throw new Error(
          result.error ||
          result.message ||
          "Unable to load Grade Assets"
        );
      }

      const loadedAssets =
        Array.isArray(
          result.assets
        )
          ? result.assets
          : [];

      setAssets(
        loadedAssets
      );
    } catch (
      error
    ) {
      console.error(
        "LOAD GRADE ASSETS ERROR:",
        error
      );

      setAssets(
        []
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Grade Assets"
      );
    } finally {
      setLoadingAssets(
        false
      );
    }
  }

  /* =======================================================
     FIRST LOAD
  ======================================================= */

  useEffect(() => {
    loadProducts();
  }, []);

  /* =======================================================
     LOAD ASSETS WHEN DESIGN CHANGES
  ======================================================= */

  useEffect(() => {
    if (
      selectedDesignId
    ) {
      loadGradeAssets(
        selectedDesignId
      );
    } else {
      setAssets(
        []
      );
    }
  }, [
    selectedDesignId,
  ]);

  /* =======================================================
     PRODUCT CHANGE
  ======================================================= */

  function changeProduct(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    const productId =
      Number(
        event.target.value
      );

    const product =
      products.find(
        (item) =>
          item.id ===
          productId
      );

    if (
      !product
    ) {
      return;
    }

    setSelectedProductId(
      product.id
    );

    setSuccessMessage(
      ""
    );

    setErrorMessage(
      ""
    );

    const design =
      product.designs?.[0] ??
      null;

    if (
      design
    ) {
      setSelectedDesignId(
        design.id
      );

      updateSelectionUrl(
        product.id,
        design.id
      );
    } else {
      setSelectedDesignId(
        null
      );

      setAssets(
        []
      );

      updateSelectionUrl(
        product.id,
        null
      );
    }
  }

  /* =======================================================
     DESIGN CHANGE
  ======================================================= */

  function changeDesign(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    if (
      !selectedProduct
    ) {
      return;
    }

    const designId =
      Number(
        event.target.value
      );

    const design =
      selectedProduct
        .designs.find(
          (item) =>
            item.id ===
            designId
        );

    if (
      !design
    ) {
      return;
    }

    setSelectedDesignId(
      design.id
    );

    setSuccessMessage(
      ""
    );

    setErrorMessage(
      ""
    );

    updateSelectionUrl(
      selectedProduct.id,
      design.id
    );
  }

  /* =======================================================
     ASSET BY GRADE
  ======================================================= */

  function getAsset(
    grade: Grade
  ) {
    return (
      assets.find(
        (asset) =>
          asset.grade ===
          grade
      ) ??
      null
    );
  }

  /* =======================================================
     IMAGE UPLOAD
  ======================================================= */

  async function uploadImage(
    grade: Grade,
    file: File
  ) {
    if (
      !selectedProduct ||
      !selectedDesign
    ) {
      return;
    }

    setUploading({
      grade,

      type:
        "IMAGE",
    });

    setErrorMessage(
      ""
    );

    setSuccessMessage(
      ""
    );

    try {
      const validTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (
        !validTypes.includes(
          file.type
        )
      ) {
        throw new Error(
          "ใช้ได้เฉพาะ JPEG, PNG หรือ WEBP"
        );
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        throw new Error(
          "รูปต้องมีขนาดไม่เกิน 5 MB"
        );
      }

      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "product_id",
        String(
          selectedProduct.id
        )
      );

      formData.append(
        "design_id",
        String(
          selectedDesign.id
        )
      );

      formData.append(
        "grade",
        grade
      );

      const response =
        await fetch(
          "/api/admin/products/grade-assets/upload-image",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body:
              formData,
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        result.success !==
          true
      ) {
        throw new Error(
          result.message ||
          result.error ||
          "Unable to upload Grade image"
        );
      }

      setSuccessMessage(
        `${selectedDesign.design_code} ${grade} IMAGE SAVED`
      );

      await loadGradeAssets(
        selectedDesign.id
      );
    } catch (
      error
    ) {
      console.error(
        "GRADE IMAGE UPLOAD ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload Grade image"
      );
    } finally {
      setUploading(
        null
      );
    }
  }

  /* =======================================================
     MODEL UPLOAD
  ======================================================= */

  async function uploadModel(
    grade: Grade,
    file: File
  ) {
    if (
      !selectedProduct ||
      !selectedDesign
    ) {
      return;
    }

    setUploading({
      grade,

      type:
        "MODEL",
    });

    setErrorMessage(
      ""
    );

    setSuccessMessage(
      ""
    );

    try {
      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".glb"
          )
      ) {
        throw new Error(
          "รองรับเฉพาะไฟล์ .glb"
        );
      }

      if (
        file.size >
        50 * 1024 * 1024
      ) {
        throw new Error(
          "GLB ต้องมีขนาดไม่เกิน 50 MB"
        );
      }

      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      /* ---------------------------------------------------
         1. PREPARE SIGNED UPLOAD
      --------------------------------------------------- */

      const prepareResponse =
        await fetch(
          "/api/admin/products/grade-assets/upload-model",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                product_id:
                  selectedProduct.id,

                design_id:
                  selectedDesign.id,

                grade,

                file_name:
                  file.name,

                file_size:
                  file.size,

                file_type:
                  file.type ||
                  "model/gltf-binary",
              }),
          }
        );

      const prepareResult =
        await prepareResponse.json();

      if (
        !prepareResponse.ok ||
        prepareResult.success !==
          true
      ) {
        throw new Error(
          prepareResult.message ||
          "Unable to prepare GLB upload"
        );
      }

      const uploadPath =
        prepareResult.upload
          ?.path;

      const uploadToken =
        prepareResult.upload
          ?.token;

      const publicUrl =
        prepareResult.upload
          ?.public_url;

      if (
        !uploadPath ||
        !uploadToken ||
        !publicUrl
      ) {
        throw new Error(
          "Signed upload information is incomplete"
        );
      }

      /* ---------------------------------------------------
         2. BROWSER -> SUPABASE
      --------------------------------------------------- */

      const {
        error:
          storageError,
      } =
        await supabase
          .storage
          .from(
            "product-models"
          )
          .uploadToSignedUrl(
            uploadPath,
            uploadToken,
            file,
            {
              contentType:
                file.type ||
                "model/gltf-binary",
            }
          );

      if (
        storageError
      ) {
        throw new Error(
          storageError.message
        );
      }

      /* ---------------------------------------------------
         3. FINALIZE DATABASE
      --------------------------------------------------- */

      const finalizeResponse =
        await fetch(
          "/api/admin/products/grade-assets/upload-model",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                product_id:
                  selectedProduct.id,

                design_id:
                  selectedDesign.id,

                grade,

                model_url:
                  publicUrl,

                model_path:
                  uploadPath,
              }),
          }
        );

      const finalizeResult =
        await finalizeResponse.json();

      if (
        !finalizeResponse.ok ||
        finalizeResult.success !==
          true
      ) {
        throw new Error(
          finalizeResult.message ||
          "Unable to finalize GLB"
        );
      }

      setSuccessMessage(
        `${selectedDesign.design_code} ${grade} GLB SAVED`
      );

      await loadGradeAssets(
        selectedDesign.id
      );
    } catch (
      error
    ) {
      console.error(
        "GRADE GLB UPLOAD ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload Grade GLB"
      );
    } finally {
      setUploading(
        null
      );
    }
  }

  /* =======================================================
     INPUT HELPERS
  ======================================================= */

  function onImageSelected(
    grade: Grade,
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    uploadImage(
      grade,
      file
    );
  }

  function onModelSelected(
    grade: Grade,
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    uploadModel(
      grade,
      file
    );
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center">

          <p className="animate-pulse text-xs font-black tracking-[0.35em] text-orange-400">
            LOADING GRADE ASSETS...
          </p>

        </div>

      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      <Navbar />

      {/* ===================================================
          BACKGROUND
      =================================================== */}

      <div className="pointer-events-none fixed inset-0">

        <div className="absolute left-1/2 top-[-400px] h-[800px] w-[1000px] -translate-x-1/2 rounded-full bg-orange-400/[0.045] blur-[180px]" />

        <div className="absolute bottom-[-450px] left-[-300px] h-[700px] w-[700px] rounded-full bg-cyan-400/[0.035] blur-[180px]" />

        <div className="grade-grid absolute inset-0 opacity-[0.025]" />

      </div>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-8 sm:px-7 lg:px-9">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-3">

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                className="text-[9px] font-black tracking-[0.22em] text-zinc-600 transition hover:text-white"
              >
                ADMIN
              </button>

              <span className="text-zinc-800">
                /
              </span>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/products"
                  )
                }
                className="text-[9px] font-black tracking-[0.22em] text-zinc-600 transition hover:text-cyan-400"
              >
                PRODUCT CATALOG
              </button>

              <span className="text-zinc-800">
                /
              </span>

              <p className="text-[9px] font-black tracking-[0.22em] text-orange-400">
                GRADE ASSETS
              </p>

            </div>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              GRADE{" "}
              <span className="text-orange-400">
                ASSETS
              </span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Manage Image and GLB separately for COMMON, RARE, EPIC and LEGENDARY.
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin/products"
              )
            }
            className="rounded-xl border border-zinc-800 bg-black/40 px-5 py-3 text-xs font-black text-zinc-400 transition hover:border-cyan-400 hover:text-cyan-400"
          >
            ← PRODUCT CATALOG
          </button>

        </header>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/[0.06] px-5 py-4 text-sm font-bold text-red-400">
            {
              errorMessage
            }
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-lime-400/30 bg-lime-400/[0.06] px-5 py-4 text-sm font-bold text-lime-400">

            ✓{" "}
            {
              successMessage
            }

          </div>
        )}

        {/* =================================================
            SELECTORS
        ================================================= */}

        <section className="mt-7 rounded-[28px] border border-white/[0.09] bg-zinc-950/70 p-5 sm:p-6">

          <div className="grid gap-5 lg:grid-cols-2">

            {/* PRODUCT */}

            <label>

              <span className="text-[8px] font-black tracking-[0.24em] text-cyan-400">
                PRODUCT
              </span>

              <select
                value={
                  selectedProductId ??
                  ""
                }
                onChange={
                  changeProduct
                }
                className="mt-3 w-full rounded-xl border border-zinc-800 bg-black px-4 py-4 text-sm font-black text-white outline-none transition focus:border-cyan-400"
              >

                {products.map(
                  (
                    product
                  ) => (
                    <option
                      key={
                        product.id
                      }
                      value={
                        product.id
                      }
                    >
                      {
                        product.code
                      }
                      {" — "}
                      {
                        product.name
                      }
                      {
                        product.is_active
                          ? " [LIVE]"
                          : " [DRAFT]"
                      }
                    </option>
                  )
                )}

              </select>

            </label>

            {/* DESIGN */}

            <label>

              <span className="text-[8px] font-black tracking-[0.24em] text-orange-400">
                DESIGN
              </span>

              <select
                value={
                  selectedDesignId ??
                  ""
                }
                onChange={
                  changeDesign
                }
                disabled={
                  !selectedProduct ||
                  selectedProduct
                    .designs.length ===
                    0
                }
                className="mt-3 w-full rounded-xl border border-zinc-800 bg-black px-4 py-4 text-sm font-black text-white outline-none transition focus:border-orange-400 disabled:text-zinc-700"
              >

                {selectedProduct
                  ?.designs.map(
                    (
                      design
                    ) => (
                      <option
                        key={
                          design.id
                        }
                        value={
                          design.id
                        }
                      >
                        {
                          design.design_code
                        }
                        {" — "}
                        {
                          design.name
                        }
                        {
                          design.is_active
                            ? " [VISIBLE]"
                            : " [DRAFT]"
                        }
                      </option>
                    )
                  )}

              </select>

            </label>

          </div>

          {selectedProduct &&
            selectedDesign && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">

              <Info
                label="PRODUCT"
                value={
                  selectedProduct.name
                }
              />

              <Info
                label="DESIGN"
                value={
                  selectedDesign.design_code
                }
              />

              <Info
                label="CRAFT COST"
                value={`${selectedDesign.craft_cost_lt} LT`}
              />

              <Info
                label="STATUS"
                value={
                  selectedProduct
                    .is_active &&
                  selectedDesign
                    .is_active
                    ? "CRAFT VISIBLE"
                    : "DRAFT"
                }
              />

            </div>
          )}

        </section>

        {/* =================================================
            NO PRODUCTS
        ================================================= */}

        {products.length ===
          0 && (
          <section className="mt-7 rounded-[28px] border border-dashed border-zinc-800 p-12 text-center">

            <p className="text-sm font-black text-zinc-600">
              NO PRODUCT AVAILABLE
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/admin/products"
                )
              }
              className="mt-5 rounded-xl border border-cyan-400/30 px-5 py-3 text-xs font-black text-cyan-400"
            >
              OPEN PRODUCT CATALOG
            </button>

          </section>
        )}

        {/* =================================================
            GRADE MATRIX
        ================================================= */}

        {selectedProduct &&
          selectedDesign && (
          <section className="mt-7">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <p className="text-[9px] font-black tracking-[0.28em] text-orange-400">
                  {
                    selectedProduct.code
                  }
                  {" // "}
                  {
                    selectedDesign.design_code
                  }
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  RARITY ASSET MATRIX
                </h2>

                <p className="mt-2 text-xs text-zinc-600">
                  Each Grade owns its own Image and GLB.
                </p>

              </div>

              <div className="rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[8px] font-black tracking-[0.18em] text-zinc-600">
                4 GRADE SLOTS
              </div>

            </div>

            {loadingAssets ? (
              <div className="mt-6 flex min-h-[360px] items-center justify-center rounded-[30px] border border-white/[0.08]">

                <p className="animate-pulse text-xs font-black tracking-[0.3em] text-cyan-400">
                  LOADING ASSETS...
                </p>

              </div>
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">

                {grades.map(
                  (
                    grade
                  ) => {
                    const asset =
                      getAsset(
                        grade
                      );

                    const imageUploading =
                      uploading
                        ?.grade ===
                        grade &&
                      uploading
                        ?.type ===
                        "IMAGE";

                    const modelUploading =
                      uploading
                        ?.grade ===
                        grade &&
                      uploading
                        ?.type ===
                        "MODEL";

                    const busy =
                      uploading !==
                      null;

                    return (
                      <article
                        key={
                          grade
                        }
                        className={`
                          relative
                          overflow-hidden
                          rounded-[28px]
                          border
                          p-5

                          ${
                            gradeBorder[
                              grade
                            ]
                          }

                          ${
                            gradeBackground[
                              grade
                            ]
                          }
                        `}
                      >

                        {/* GRADE */}

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="text-[8px] font-black tracking-[0.25em] text-zinc-700">
                              RARITY
                            </p>

                            <h3
                              className={`
                                mt-2
                                text-2xl
                                font-black

                                ${
                                  gradeText[
                                    grade
                                  ]
                                }
                              `}
                            >
                              {
                                grade
                              }
                            </h3>

                          </div>

                          <div
                            className={`
                              h-3
                              w-3
                              rounded-full

                              ${
                                asset
                                  ?.image_ready &&
                                asset
                                  ?.model_ready
                                  ? "bg-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.8)]"
                                  : asset
                                      ?.image_ready ||
                                    asset
                                      ?.model_ready
                                    ? "bg-yellow-400"
                                    : "bg-zinc-800"
                              }
                            `}
                          />

                        </div>

                        {/* IMAGE */}

                        <div className="mt-5">

                          <div className="flex items-center justify-between">

                            <p className="text-[8px] font-black tracking-[0.18em] text-cyan-400">
                              IMAGE
                            </p>

                            <Status
                              ready={
                                Boolean(
                                  asset
                                    ?.image_ready
                                )
                              }
                            />

                          </div>

                          <div className="mt-3 flex h-[240px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-black">

                            {asset
                              ?.thumbnail_url ? (
                              <img
                                src={
                                  asset.thumbnail_url
                                }
                                alt={`${selectedDesign.design_code} ${grade}`}
                                className="h-full w-full object-contain p-2"
                              />
                            ) : (
                              <div className="text-center">

                                <p
                                  className={`
                                    text-4xl
                                    font-black

                                    ${
                                      gradeText[
                                        grade
                                      ]
                                    }
                                  `}
                                >
                                  ?
                                </p>

                                <p className="mt-3 text-[8px] font-black tracking-[0.18em] text-zinc-700">
                                  IMAGE NOT SET
                                </p>

                              </div>
                            )}

                          </div>

                          <label
                            className={`
                              mt-3
                              flex
                              min-h-[46px]
                              cursor-pointer
                              items-center
                              justify-center
                              rounded-xl
                              border
                              text-[9px]
                              font-black
                              transition

                              ${
                                busy
                                  ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-700"
                                  : "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-400 hover:border-cyan-400"
                              }
                            `}
                          >

                            {
                              imageUploading
                                ? "UPLOADING IMAGE..."
                                : asset
                                    ?.image_ready
                                  ? "CHANGE IMAGE"
                                  : "IMPORT IMAGE"
                            }

                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={
                                busy
                              }
                              className="hidden"
                              onChange={(
                                event
                              ) =>
                                onImageSelected(
                                  grade,
                                  event
                                )
                              }
                            />

                          </label>

                        </div>

                        {/* MODEL */}

                        <div className="mt-5 border-t border-white/[0.07] pt-5">

                          <div className="flex items-center justify-between">

                            <p className="text-[8px] font-black tracking-[0.18em] text-purple-400">
                              3D MODEL
                            </p>

                            <Status
                              ready={
                                Boolean(
                                  asset
                                    ?.model_ready
                                )
                              }
                            />

                          </div>

                          {asset
                            ?.model_url ? (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                setPreviewModel({
                                  grade,

                                  url:
                                    asset.model_url as string,
                                })
                              }
                              className="mt-3 w-full rounded-xl border border-purple-400/20 bg-purple-400/[0.05] px-4 py-3 text-[9px] font-black text-purple-400 transition hover:border-purple-400 disabled:opacity-40"
                            >
                              VIEW 3D
                            </button>
                          ) : (
                            <div className="mt-3 rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-center text-[8px] font-black text-zinc-700">
                              NO GLB
                            </div>
                          )}

                          <label
                            className={`
                              mt-2
                              flex
                              min-h-[46px]
                              cursor-pointer
                              items-center
                              justify-center
                              rounded-xl
                              border
                              text-[9px]
                              font-black
                              transition

                              ${
                                busy
                                  ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-700"
                                  : "border-purple-400/25 bg-purple-400/[0.05] text-purple-400 hover:border-purple-400"
                              }
                            `}
                          >

                            {
                              modelUploading
                                ? "UPLOADING GLB..."
                                : asset
                                    ?.model_ready
                                  ? "CHANGE GLB"
                                  : "IMPORT GLB"
                            }

                            <input
                              type="file"
                              accept=".glb,model/gltf-binary,application/octet-stream"
                              disabled={
                                busy
                              }
                              className="hidden"
                              onChange={(
                                event
                              ) =>
                                onModelSelected(
                                  grade,
                                  event
                                )
                              }
                            />

                          </label>

                        </div>

                        {/* SUMMARY */}

                        <div className="mt-5 grid grid-cols-2 gap-2">

                          <MiniStatus
                            label="ART"
                            ready={
                              Boolean(
                                asset
                                  ?.image_ready
                              )
                            }
                          />

                          <MiniStatus
                            label="3D"
                            ready={
                              Boolean(
                                asset
                                  ?.model_ready
                              )
                            }
                          />

                        </div>

                      </article>
                    );
                  }
                )}

              </div>
            )}

            {/* FLOW */}

            <div className="mt-6 rounded-[24px] border border-orange-400/15 bg-orange-400/[0.025] p-5">

              <p className="text-[9px] font-black tracking-[0.22em] text-orange-400">
                ITEM IDENTITY FLOW
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black">

                <Flow>
                  PRODUCT
                </Flow>

                <Arrow />

                <Flow>
                  DESIGN
                </Flow>

                <Arrow />

                <Flow>
                  SERVER ROLL
                </Flow>

                <Arrow />

                <Flow>
                  GRADE
                </Flow>

                <Arrow />

                <Flow>
                  GRADE ASSET
                </Flow>

                <Arrow />

                <Flow>
                  ITEM SNAPSHOT
                </Flow>

              </div>

            </div>

          </section>
        )}

      </div>

      {/* ===================================================
          3D MODAL
      =================================================== */}

      {previewModel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl">

          <div className="relative h-[88vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-purple-400/30 bg-zinc-950">

            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-black/70 px-5 py-4 backdrop-blur-xl">

              <div>

                <p className="text-[8px] font-black tracking-[0.2em] text-purple-400">
                  GRADE 3D PREVIEW
                </p>

                <p
                  className={`
                    mt-1
                    text-lg
                    font-black

                    ${
                      gradeText[
                        previewModel.grade
                      ]
                    }
                  `}
                >
                  {
                    selectedDesign
                      ?.design_code
                  }
                  {" // "}
                  {
                    previewModel.grade
                  }
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setPreviewModel(
                    null
                  )
                }
                className="rounded-xl border border-zinc-700 bg-black px-4 py-2 text-xs font-black text-zinc-400 transition hover:border-red-400 hover:text-red-400"
              >
                CLOSE
              </button>

            </div>

            <div className="h-full w-full pt-[76px]">

              <AdminModelPreview
                modelUrl={
                  previewModel.url
                }
                modelName={
                  `${selectedDesign?.design_code ?? "GRADE ASSET"} // ${previewModel.grade}`
                }
                onClose={() =>
                  setPreviewModel(
                    null
                  )
                }
              />

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          CSS
      =================================================== */}

      <style jsx global>{`

        .grade-grid {
          background-image:
            linear-gradient(
              rgba(
                255,
                255,
                255,
                0.16
              )
              1px,
              transparent
              1px
            ),
            linear-gradient(
              90deg,
              rgba(
                255,
                255,
                255,
                0.16
              )
              1px,
              transparent
              1px
            );

          background-size:
            42px
            42px;
        }

      `}</style>

    </main>
  );
}

/* =========================================================
   STATUS
========================================================= */

function Status({
  ready,
}: {
  ready: boolean;
}) {
  return (
    <span
      className={
        ready
          ? "rounded-full border border-lime-400/25 bg-lime-400/[0.06] px-2.5 py-1 text-[7px] font-black text-lime-400"
          : "rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-[7px] font-black text-zinc-600"
      }
    >
      {
        ready
          ? "READY"
          : "NOT SET"
      }
    </span>
  );
}

/* =========================================================
   MINI STATUS
========================================================= */

function MiniStatus({
  label,
  ready,
}: {
  label: string;

  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5">

      <p className="text-[7px] font-black text-zinc-700">
        {
          label
        }
      </p>

      <p
        className={
          ready
            ? "mt-1 text-[8px] font-black text-lime-400"
            : "mt-1 text-[8px] font-black text-zinc-600"
        }
      >
        {
          ready
            ? "READY"
            : "EMPTY"
        }
      </p>

    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3">

      <p className="text-[7px] font-black tracking-[0.16em] text-zinc-700">
        {
          label
        }
      </p>

      <p className="mt-1 truncate text-xs font-black text-white">
        {
          value
        }
      </p>

    </div>
  );
}

/* =========================================================
   FLOW
========================================================= */

function Flow({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <span className="rounded-lg border border-white/[0.08] bg-black/50 px-3 py-2 text-zinc-400">
      {
        children
      }
    </span>
  );
}

/* =========================================================
   ARROW
========================================================= */

function Arrow() {
  return (
    <span className="text-orange-400">
      →
    </span>
  );
}