"use client";

import Link from "next/link";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import AdminModelPreview from "@/components/AdminModelPreview";
import { supabase } from "@/lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type ProductCategory =
  | "TEE"
  | "HOODIE"
  | "JACKET"
  | "PANTS"
  | "CAP"
  | "SHOES"
  | "ACCESSORY";

type EquipSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM"
  | "SHOES"
  | "ACCESSORY";

type Design = {
  id: number;
  product_id: number;

  design_code: string;
  name: string;

  craft_cost_lt: number;

  available_sizes: string[];

  thumbnail_url: string | null;
  model_url: string | null;

  sort_order: number;

  is_active: boolean;

  total_crafted_count: number;
  test_crafted_count: number;
  live_crafted_count: number;
  legacy_crafted_count: number;
  protected_crafted_count: number;

  identity_locked: boolean;
};

type Product = {
  id: number;

  code: string;
  name: string;

  category: ProductCategory;
  equip_slot: EquipSlot;

  season: string;

  description: string | null;

  is_active: boolean;

  protected_crafted_count: number;
  identity_locked: boolean;

  designs: Design[];
};

type ProductForm = {
  code: string;
  name: string;

  category: ProductCategory;
  equip_slot: EquipSlot;

  season: string;

  description: string;
};

type DesignForm = {
  design_code: string;
  name: string;

  craft_cost_lt: string;

  available_sizes: string[];

  model_url: string;

  sort_order: string;
};

type PreparedModelUpload = {
  ok: boolean;

  bucket: string;
  path: string;

  token: string;

  signed_url: string;
  public_url: string;

  content_type: string;

  original_filename: string;

  size: number;
};

type PreviewModel = {
  url: string;
  name: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const PRODUCT_CATEGORIES: ProductCategory[] = [
  "TEE",
  "HOODIE",
  "JACKET",
  "PANTS",
  "CAP",
  "SHOES",
  "ACCESSORY",
];

const EQUIP_SLOTS: EquipSlot[] = [
  "HEAD",
  "TOP",
  "BOTTOM",
  "SHOES",
  "ACCESSORY",
];

const ALL_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "FREE",
];

const MAX_MODEL_SIZE =
  50 * 1024 * 1024;

const DEFAULT_PRODUCT_FORM: ProductForm = {
  code: "",
  name: "",

  category: "TEE",
  equip_slot: "TOP",

  season: "S01",

  description: "",
};

const DEFAULT_DESIGN_FORM: DesignForm = {
  design_code: "D01",

  name: "",

  craft_cost_lt: "100",

  available_sizes: [
    "S",
    "M",
    "L",
    "XL",
    "XXL",
  ],

  model_url: "",

  sort_order: "1",
};

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400";

const INPUT_ORANGE_CLASS =
  "w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400";

const LOCKED_INPUT_CLASS =
  "w-full cursor-not-allowed rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3 text-sm text-zinc-500 outline-none opacity-70";

/* =========================================================
   HELPERS
========================================================= */

function slotForCategory(
  category: ProductCategory
): EquipSlot {
  if (
    category === "TEE" ||
    category === "HOODIE" ||
    category === "JACKET"
  ) {
    return "TOP";
  }

  if (category === "PANTS") {
    return "BOTTOM";
  }

  if (category === "CAP") {
    return "HEAD";
  }

  if (category === "SHOES") {
    return "SHOES";
  }

  return "ACCESSORY";
}

function defaultSizesForProduct(
  product: Product
) {
  if (
    product.category === "CAP" ||
    product.category === "ACCESSORY"
  ) {
    return ["FREE"];
  }

  return [
    "S",
    "M",
    "L",
    "XL",
    "XXL",
  ];
}

function nextDesignNumber(
  designs: Design[]
) {
  let highest = 0;

  for (const design of designs) {
    const number =
      Number(
        design.design_code.replace(
          /[^0-9]/g,
          ""
        )
      );

    if (
      Number.isFinite(number) &&
      number > highest
    ) {
      highest =
        number;
    }
  }

  return highest + 1;
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb =
    bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(
    kb / 1024
  ).toFixed(2)} MB`;
}

function getModelFileName(
  url: string | null
) {
  if (!url) {
    return "";
  }

  try {
    const pathname =
      new URL(
        url
      ).pathname;

    const fileName =
      pathname
        .split("/")
        .pop();

    return fileName
      ? decodeURIComponent(
          fileName
        )
      : url;
  } catch {
    return (
      url
        .split("/")
        .pop() ||
      url
    );
  }
}

function validateImageFile(
  file: File
) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    return "Only JPG, PNG and WEBP images are allowed.";
  }

  if (
    file.size >
    5 * 1024 * 1024
  ) {
    return "Image must be 5MB or smaller.";
  }

  return "";
}

function validateModelFile(
  file: File
) {
  if (
    !file.name
      .toLowerCase()
      .endsWith(".glb")
  ) {
    return "Only .glb model files are allowed.";
  }

  if (
    file.size <= 0
  ) {
    return "GLB file is empty.";
  }

  if (
    file.size >
    MAX_MODEL_SIZE
  ) {
    return "GLB file must be 50MB or smaller.";
  }

  return "";
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminProductsPage() {
  const [
    catalog,
    setCatalog,
  ] = useState<Product[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    busyKey,
    setBusyKey,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  /* =======================================================
     3D PREVIEW
  ======================================================= */

  const [
    previewModel,
    setPreviewModel,
  ] =
    useState<PreviewModel | null>(
      null
    );

  /* =======================================================
     NEW PRODUCT
  ======================================================= */

  const [
    showNewProduct,
    setShowNewProduct,
  ] = useState(false);

  const [
    productForm,
    setProductForm,
  ] = useState<ProductForm>(
    DEFAULT_PRODUCT_FORM
  );

  /* =======================================================
     EDIT PRODUCT
  ======================================================= */

  const [
    editingProductId,
    setEditingProductId,
  ] = useState<number | null>(
    null
  );

  const [
    editProductForm,
    setEditProductForm,
  ] = useState<ProductForm>(
    DEFAULT_PRODUCT_FORM
  );

  /* =======================================================
     ADD DESIGN
  ======================================================= */

  const [
    addingDesignTo,
    setAddingDesignTo,
  ] = useState<number | null>(
    null
  );

  const [
    designForm,
    setDesignForm,
  ] = useState<DesignForm>(
    DEFAULT_DESIGN_FORM
  );

  const [
    designImageFile,
    setDesignImageFile,
  ] = useState<File | null>(
    null
  );

  const [
    designImagePreview,
    setDesignImagePreview,
  ] = useState("");

  const [
    designModelFile,
    setDesignModelFile,
  ] = useState<File | null>(
    null
  );

  /* =======================================================
     EDIT DESIGN
  ======================================================= */

  const [
    editingDesignId,
    setEditingDesignId,
  ] = useState<number | null>(
    null
  );

  const [
    editDesignForm,
    setEditDesignForm,
  ] = useState<DesignForm>(
    DEFAULT_DESIGN_FORM
  );

  const [
    editDesignOriginalImage,
    setEditDesignOriginalImage,
  ] = useState<string | null>(
    null
  );

  const [
    editDesignImageFile,
    setEditDesignImageFile,
  ] = useState<File | null>(
    null
  );

  const [
    editDesignImagePreview,
    setEditDesignImagePreview,
  ] = useState("");

  const [
    removeEditImage,
    setRemoveEditImage,
  ] = useState(false);

  const [
    editDesignModelFile,
    setEditDesignModelFile,
  ] = useState<File | null>(
    null
  );

  const [
    removeEditModel,
    setRemoveEditModel,
  ] = useState(false);

  /* =======================================================
     CLEAN PREVIEWS
  ======================================================= */

  useEffect(() => {
    return () => {
      if (
        designImagePreview
      ) {
        URL.revokeObjectURL(
          designImagePreview
        );
      }
    };
  }, [
    designImagePreview,
  ]);

  useEffect(() => {
    return () => {
      if (
        editDesignImagePreview
      ) {
        URL.revokeObjectURL(
          editDesignImagePreview
        );
      }
    };
  }, [
    editDesignImagePreview,
  ]);

  /* =======================================================
     AUTH FETCH
  ======================================================= */

  const authenticatedFetch =
    useCallback(
      async (
        url: string,
        options?: RequestInit
      ) => {
        const {
          data,
          error:
            sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError
        ) {
          throw new Error(
            sessionError.message
          );
        }

        if (
          !data.session
        ) {
          throw new Error(
            "Admin session not found. Please login again."
          );
        }

        const response =
          await fetch(
            url,
            {
              ...options,

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${data.session.access_token}`,

                ...(options?.headers ??
                  {}),
              },
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
              "Request failed"
          );
        }

        return result;
      },
      []
    );

  /* =======================================================
     IMAGE UPLOAD
  ======================================================= */

  const uploadImage =
    useCallback(
      async (
        file: File,
        productId: number,
        designCode: string
      ) => {
        const {
          data,
          error:
            sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError
        ) {
          throw new Error(
            sessionError.message
          );
        }

        if (
          !data.session
        ) {
          throw new Error(
            "Admin session not found."
          );
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
            productId
          )
        );

        formData.append(
          "design_code",
          designCode
        );

        const response =
          await fetch(
            "/api/admin/products/upload",
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${data.session.access_token}`,
              },

              body:
                formData,
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
              "Image upload failed"
          );
        }

        return result.url as string;
      },
      []
    );

  /* =======================================================
     MODEL UPLOAD
  ======================================================= */

  const uploadModel =
    useCallback(
      async (
        file: File,
        productId: number,
        designCode: string
      ) => {
        const validationError =
          validateModelFile(
            file
          );

        if (
          validationError
        ) {
          throw new Error(
            validationError
          );
        }

        const {
          data,
          error:
            sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError
        ) {
          throw new Error(
            sessionError.message
          );
        }

        if (
          !data.session
        ) {
          throw new Error(
            "Admin session not found."
          );
        }

        const prepareResponse =
          await fetch(
            "/api/admin/products/upload-model",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${data.session.access_token}`,
              },

              body:
                JSON.stringify({
                  product_id:
                    productId,

                  design_code:
                    designCode,

                  filename:
                    file.name,

                  size:
                    file.size,

                  content_type:
                    file.type ||
                    "model/gltf-binary",
                }),
            }
          );

        const prepared =
          (await prepareResponse.json()) as
            PreparedModelUpload & {
              error?: string;
            };

        if (
          !prepareResponse.ok ||
          !prepared?.ok
        ) {
          throw new Error(
            prepared?.error ||
              "Cannot prepare GLB upload."
          );
        }

        const {
          error:
            uploadError,
        } =
          await supabase.storage
            .from(
              prepared.bucket
            )
            .uploadToSignedUrl(
              prepared.path,
              prepared.token,
              file,
              {
                contentType:
                  prepared.content_type ||
                  "model/gltf-binary",
              }
            );

        if (
          uploadError
        ) {
          throw new Error(
            uploadError.message
          );
        }

        return {
          url:
            prepared.public_url,

          path:
            prepared.path,

          filename:
            prepared.original_filename,

          size:
            prepared.size,
        };
      },
      []
    );

  /* =======================================================
     LOAD PRODUCTS
  ======================================================= */

  const loadProducts =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError("");

          const result =
            await authenticatedFetch(
              "/api/admin/products"
            );

          setCatalog(
            result.catalog ||
              []
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Cannot load product catalog"
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        authenticatedFetch,
      ]
    );

  useEffect(() => {
    loadProducts();
  }, [
    loadProducts,
  ]);

  /* =======================================================
     CREATE PRODUCT
  ======================================================= */

  async function createProduct(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !productForm.code.trim()
    ) {
      setError(
        "Please enter Product Code."
      );

      return;
    }

    if (
      !productForm.name.trim()
    ) {
      setError(
        "Please enter Product Name."
      );

      return;
    }

    if (
      !productForm.season.trim()
    ) {
      setError(
        "Please enter Season."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setBusyKey(
        "create-product"
      );

      const result =
        await authenticatedFetch(
          "/api/admin/products",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                action:
                  "create_product",

                code:
                  productForm.code,

                name:
                  productForm.name,

                category:
                  productForm.category,

                equip_slot:
                  productForm.equip_slot,

                season:
                  productForm.season,

                description:
                  productForm.description,
              }),
          }
        );

      setShowNewProduct(
        false
      );

      setProductForm(
        DEFAULT_PRODUCT_FORM
      );

      setSuccess(
        `${result.product.name} created as DRAFT.`
      );

      await loadProducts();
    } catch (
      createError
    ) {
      console.error(
        createError
      );

      setError(
        createError instanceof Error
          ? createError.message
          : "Cannot create product."
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey("");
    }
  }

  /* =======================================================
     PRODUCT EDIT
  ======================================================= */

  function startProductEdit(
    product: Product
  ) {
    setError("");
    setSuccess("");

    setAddingDesignTo(
      null
    );

    setEditingDesignId(
      null
    );

    setEditingProductId(
      product.id
    );

    setEditProductForm({
      code:
        product.code,

      name:
        product.name,

      category:
        product.category,

      equip_slot:
        product.equip_slot,

      season:
        product.season,

      description:
        product.description ??
        "",
    });
  }

  async function saveProductEdit(
    event: FormEvent<HTMLFormElement>,
    product: Product
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !editProductForm.code.trim()
    ) {
      setError(
        "Product Code is required."
      );

      return;
    }

    if (
      !editProductForm.name.trim()
    ) {
      setError(
        "Product Name is required."
      );

      return;
    }

    if (
      !editProductForm.season.trim()
    ) {
      setError(
        "Season is required."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setBusyKey(
        `edit-product-${product.id}`
      );

      await authenticatedFetch(
        "/api/admin/products",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "update_product",

              product_id:
                product.id,

              code:
                editProductForm.code,

              name:
                editProductForm.name,

              category:
                editProductForm.category,

              equip_slot:
                editProductForm.equip_slot,

              season:
                editProductForm.season,

              description:
                editProductForm.description,
            }),
        }
      );

      setEditingProductId(
        null
      );

      setSuccess(
        `${editProductForm.name} updated successfully.`
      );

      await loadProducts();
    } catch (
      editError
    ) {
      console.error(
        editError
      );

      setError(
        editError instanceof Error
          ? editError.message
          : "Cannot update product."
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey("");
    }
  }

  /* =======================================================
     PRODUCT STATUS
  ======================================================= */

  async function toggleProduct(
    product: Product
  ) {
    const willPublish =
      !product.is_active;

    setError("");
    setSuccess("");

    try {
      setSaving(
        true
      );

      setBusyKey(
        `product-${product.id}`
      );

      await authenticatedFetch(
        "/api/admin/products",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "update_product",

              product_id:
                product.id,

              is_active:
                willPublish,
            }),
        }
      );

      setSuccess(
        willPublish
          ? `${product.name} published.`
          : `${product.name} hidden from Craft. Existing player items are not affected.`
      );

      await loadProducts();
    } catch (
      toggleError
    ) {
      console.error(
        toggleError
      );

      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Cannot update product status."
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey("");
    }
  }

  /* =======================================================
     ADD DESIGN
  ======================================================= */

  function openAddDesign(
    product: Product
  ) {
    setError("");
    setSuccess("");

    setEditingProductId(
      null
    );

    setEditingDesignId(
      null
    );

    const number =
      nextDesignNumber(
        product.designs
      );

    const code =
      `D${String(
        number
      ).padStart(
        2,
        "0"
      )}`;

    setDesignForm({
      design_code:
        code,

      name:
        `${product.name} ${code}`,

      craft_cost_lt:
        "100",

      available_sizes:
        defaultSizesForProduct(
          product
        ),

      model_url:
        "",

      sort_order:
        String(
          number
        ),
    });

    if (
      designImagePreview
    ) {
      URL.revokeObjectURL(
        designImagePreview
      );
    }

    setDesignImageFile(
      null
    );

    setDesignImagePreview(
      ""
    );

    setDesignModelFile(
      null
    );

    setAddingDesignTo(
      product.id
    );
  }

  function closeAddDesign() {
    if (
      designImagePreview
    ) {
      URL.revokeObjectURL(
        designImagePreview
      );
    }

    setDesignImageFile(
      null
    );

    setDesignImagePreview(
      ""
    );

    setDesignModelFile(
      null
    );

    setAddingDesignTo(
      null
    );
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");

    const file =
      event.target.files?.[0] ??
      null;

    if (!file) {
      return;
    }

    const validationError =
      validateImageFile(
        file
      );

    if (
      validationError
    ) {
      setError(
        validationError
      );

      return;
    }

    if (
      designImagePreview
    ) {
      URL.revokeObjectURL(
        designImagePreview
      );
    }

    setDesignImageFile(
      file
    );

    setDesignImagePreview(
      URL.createObjectURL(
        file
      )
    );
  }

  function handleModelChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");

    const file =
      event.target.files?.[0] ??
      null;

    if (!file) {
      return;
    }

    const validationError =
      validateModelFile(
        file
      );

    if (
      validationError
    ) {
      setError(
        validationError
      );

      event.target.value =
        "";

      return;
    }

    setDesignModelFile(
      file
    );
  }

  function toggleSize(
    size: string
  ) {
    setDesignForm(
      (current) => {
        const selected =
          current.available_sizes.includes(
            size
          );

        return {
          ...current,

          available_sizes:
            selected
              ? current.available_sizes.filter(
                  (item) =>
                    item !==
                    size
                )
              : [
                  ...current.available_sizes,
                  size,
                ],
        };
      }
    );
  }

  async function createDesign(
    event: FormEvent<HTMLFormElement>,
    product: Product
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !designForm.design_code.trim()
    ) {
      setError(
        "Please enter Design Code."
      );

      return;
    }

    if (
      !designForm.name.trim()
    ) {
      setError(
        "Please enter Design Name."
      );

      return;
    }

    const craftCost =
      Number(
        designForm.craft_cost_lt
      );

    if (
      !Number.isInteger(
        craftCost
      ) ||
      craftCost < 0
    ) {
      setError(
        "Craft Cost must be 0 or greater."
      );

      return;
    }

    if (
      designForm.available_sizes.length ===
      0
    ) {
      setError(
        "Please select at least one size."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setBusyKey(
        `create-design-${product.id}`
      );

      let thumbnailUrl:
        string | null =
          null;

      if (
        designImageFile
      ) {
        setSuccess(
          "Uploading product image..."
        );

        thumbnailUrl =
          await uploadImage(
            designImageFile,
            product.id,
            designForm.design_code
          );
      }

      let modelUrl =
        designForm.model_url.trim();

      if (
        designModelFile
      ) {
        setSuccess(
          `Uploading ${designModelFile.name} (${formatFileSize(
            designModelFile.size
          )})...`
        );

        const model =
          await uploadModel(
            designModelFile,
            product.id,
            designForm.design_code
          );

        modelUrl =
          model.url;
      }

      setSuccess(
        "Saving Design..."
      );

      await authenticatedFetch(
        "/api/admin/products",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              action:
                "create_design",

              product_id:
                product.id,

              design_code:
                designForm.design_code,

              name:
                designForm.name,

              craft_cost_lt:
                craftCost,

              available_sizes:
                designForm.available_sizes,

              thumbnail_url:
                thumbnailUrl,

              model_url:
                modelUrl,

              sort_order:
                Number(
                  designForm.sort_order
                ),
            }),
        }
      );

      const createdCode =
        designForm.design_code;

      closeAddDesign();

      setSuccess(
        `${createdCode} created as DRAFT successfully.`
      );

      await loadProducts();
    } catch (
      createError
    ) {
      console.error(
        createError
      );

      setError(
        createError instanceof Error
          ? createError.message
          : "Cannot create design."
      );

      setSuccess("");
    } finally {
      setSaving(
        false
      );

      setBusyKey("");
    }
  }

  /* =======================================================
     DESIGN EDIT
  ======================================================= */

  function startDesignEdit(
    design: Design
  ) {
    setError("");
    setSuccess("");

    setAddingDesignTo(
      null
    );

    setEditingProductId(
      null
    );

    setEditingDesignId(
      design.id
    );

    setEditDesignForm({
      design_code:
        design.design_code,

      name:
        design.name,

      craft_cost_lt:
        String(
          design.craft_cost_lt
        ),

      available_sizes:
        design.available_sizes ??
        [],

      model_url:
        design.model_url ??
        "",

      sort_order:
        String(
          design.sort_order
        ),
    });

    setEditDesignOriginalImage(
      design.thumbnail_url
    );

    setEditDesignImageFile(
      null
    );

    if (
      editDesignImagePreview
    ) {
      URL.revokeObjectURL(
        editDesignImagePreview
      );
    }

    setEditDesignImagePreview(
      ""
    );

    setRemoveEditImage(
      false
    );

    setEditDesignModelFile(
      null
    );

    setRemoveEditModel(
      false
    );
  }

  function handleEditImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");

    const file =
      event.target.files?.[0] ??
      null;

    if (!file) {
      return;
    }

    const validationError =
      validateImageFile(
        file
      );

    if (
      validationError
    ) {
      setError(
        validationError
      );

      return;
    }

    if (
      editDesignImagePreview
    ) {
      URL.revokeObjectURL(
        editDesignImagePreview
      );
    }

    setEditDesignImageFile(
      file
    );

    setEditDesignImagePreview(
      URL.createObjectURL(
        file
      )
    );

    setRemoveEditImage(
      false
    );
  }

  function removeDesignImage() {
    if (
      editDesignImagePreview
    ) {
      URL.revokeObjectURL(
        editDesignImagePreview
      );
    }

    setEditDesignImagePreview(
      ""
    );

    setEditDesignImageFile(
      null
    );

    setRemoveEditImage(
      true
    );
  }

  function handleEditModelChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setError("");

    const file =
      event.target.files?.[0] ??
      null;

    if (!file) {
      return;
    }

    const validationError =
      validateModelFile(
        file
      );

    if (
      validationError
    ) {
      setError(
        validationError
      );

      event.target.value =
        "";

      return;
    }

    setEditDesignModelFile(
      file
    );

    setRemoveEditModel(
      false
    );
  }

  function removeDesignModel() {
    setEditDesignModelFile(
      null
    );

    setRemoveEditModel(
      true
    );
  }

  function toggleEditSize(
    size: string
  ) {
    setEditDesignForm(
      (current) => {
        const selected =
          current.available_sizes.includes(
            size
          );

        return {
          ...current,

          available_sizes:
            selected
              ? current.available_sizes.filter(
                  (item) =>
                    item !==
                    size
                )
              : [
                  ...current.available_sizes,
                  size,
                ],
        };
      }
    );
  }

  async function saveDesignEdit(
    event: FormEvent<HTMLFormElement>,
    product: Product,
    design: Design
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !editDesignForm.design_code.trim()
    ) {
      setError(
        "Design Code is required."
      );

      return;
    }

    if (
      !editDesignForm.name.trim()
    ) {
      setError(
        "Design Name is required."
      );

      return;
    }

    const craftCost =
      Number(
        editDesignForm.craft_cost_lt
      );

    if (
      !Number.isInteger(
        craftCost
      ) ||
      craftCost < 0
    ) {
      setError(
        "Craft Cost must be 0 or greater."
      );

      return;
    }

    if (
      editDesignForm.available_sizes.length ===
      0
    ) {
      setError(
        "Please select at least one size."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setBusyKey(
        `edit-design-${design.id}`
      );

      let thumbnailUrl:
        string | null =
          editDesignOriginalImage;

      if (
        removeEditImage
      ) {
        thumbnailUrl =
          null;
      }

      if (
        editDesignImageFile
      ) {
        setSuccess(
          "Uploading new product image..."
        );

        thumbnailUrl =
          await uploadImage(
            editDesignImageFile,
            product.id,
            editDesignForm.design_code
          );
      }

      let modelUrl =
        editDesignForm.model_url.trim();

      if (
        removeEditModel
      ) {
        modelUrl =
          "";
      }

      if (
        editDesignModelFile
      ) {
        setSuccess(
          `Uploading ${editDesignModelFile.name} (${formatFileSize(
            editDesignModelFile.size
          )})...`
        );

        const model =
          await uploadModel(
            editDesignModelFile,
            product.id,
            editDesignForm.design_code
          );

        modelUrl =
          model.url;
      }

      setSuccess(
        "Saving Design..."
      );

      await authenticatedFetch(
        "/api/admin/products",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "update_design",

              design_id:
                design.id,

              design_code:
                editDesignForm.design_code,

              name:
                editDesignForm.name,

              craft_cost_lt:
                craftCost,

              available_sizes:
                editDesignForm.available_sizes,

              thumbnail_url:
                thumbnailUrl ??
                "",

              model_url:
                modelUrl,

              sort_order:
                Number(
                  editDesignForm.sort_order
                ),
            }),
        }
      );

      const savedName =
        editDesignForm.name;

      setEditingDesignId(
        null
      );

      setEditDesignModelFile(
        null
      );

      setRemoveEditModel(
        false
      );

      setSuccess(
        `${savedName} updated successfully.`
      );

      await loadProducts();
    } catch (
      editError
    ) {
      console.error(
        editError
      );

      setError(
        editError instanceof Error
          ? editError.message
          : "Cannot update design."
      );

      setSuccess("");
    } finally {
      setSaving(
        false
      );

      setBusyKey("");
    }
  }

  /* =======================================================
     DESIGN STATUS
  ======================================================= */

  async function toggleDesign(
    product: Product,
    design: Design
  ) {
    const willPublish =
      !design.is_active;

    setError("");
    setSuccess("");

    try {
      setSaving(
        true
      );

      setBusyKey(
        `design-${design.id}`
      );

      await authenticatedFetch(
        "/api/admin/products",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "update_design",

              design_id:
                design.id,

              is_active:
                willPublish,
            }),
        }
      );

      if (
        willPublish &&
        !product.is_active
      ) {
        setSuccess(
          `${design.name} published, but Product is still DRAFT. It remains hidden from Craft.`
        );
      } else {
        setSuccess(
          willPublish
            ? `${design.name} published.`
            : `${design.name} hidden from Craft.`
        );
      }

      await loadProducts();
    } catch (
      toggleError
    ) {
      console.error(
        toggleError
      );

      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Cannot update design."
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey("");
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="font-black text-cyan-400">
            LOADING PRODUCT CATALOG...
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <>
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">

          {/* =================================================
              HEADER
          ================================================= */}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] text-orange-400">
                LOOTFORM ADMIN
              </p>

              <h1 className="mt-2 text-4xl font-black">
                PRODUCT{" "}
                <span className="text-cyan-400">
                  CATALOG
                </span>
              </h1>

              <p className="mt-2 text-sm text-zinc-600">
                Create, edit, preview and publish physical loot.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");

                  setShowNewProduct(
                    (current) =>
                      !current
                  );

                  setEditingProductId(
                    null
                  );

                  setEditingDesignId(
                    null
                  );

                  setAddingDesignTo(
                    null
                  );
                }}
                className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-3 text-xs font-black text-cyan-400"
              >
                + NEW PRODUCT
              </button>

              <Link
                href="/admin"
                className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black"
              >
                ADMIN
              </Link>
            </div>
          </div>

          {/* =================================================
              MESSAGES
          ================================================= */}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-5 font-bold text-lime-400">
              {success}
            </div>
          )}

          {/* =================================================
              NEW PRODUCT
          ================================================= */}

          {showNewProduct && (
            <form
              onSubmit={
                createProduct
              }
              className="mt-7 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-6"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] font-black tracking-[0.2em] text-cyan-400">
                    NEW PRODUCT
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    CREATE DRAFT LOOT
                  </h2>

                  <p className="mt-2 text-xs text-zinc-600">
                    New products start hidden from Craft.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowNewProduct(
                      false
                    )
                  }
                  className="text-zinc-500"
                >
                  X
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <input
                  value={
                    productForm.code
                  }
                  onChange={(event) =>
                    setProductForm(
                      (current) => ({
                        ...current,

                        code:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="PRODUCT CODE"
                  className={
                    INPUT_CLASS
                  }
                />

                <input
                  value={
                    productForm.name
                  }
                  onChange={(event) =>
                    setProductForm(
                      (current) => ({
                        ...current,

                        name:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="PRODUCT NAME"
                  className={
                    INPUT_CLASS
                  }
                />

                <input
                  value={
                    productForm.season
                  }
                  onChange={(event) =>
                    setProductForm(
                      (current) => ({
                        ...current,

                        season:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="S01"
                  className={
                    INPUT_CLASS
                  }
                />

                <select
                  value={
                    productForm.category
                  }
                  onChange={(event) => {
                    const category =
                      event.target.value as ProductCategory;

                    setProductForm(
                      (current) => ({
                        ...current,

                        category,

                        equip_slot:
                          slotForCategory(
                            category
                          ),
                      })
                    );
                  }}
                  className={
                    INPUT_CLASS
                  }
                >
                  {PRODUCT_CATEGORIES.map(
                    (category) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      >
                        {category}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={
                    productForm.equip_slot
                  }
                  onChange={(event) =>
                    setProductForm(
                      (current) => ({
                        ...current,

                        equip_slot:
                          event.target.value as EquipSlot,
                      })
                    )
                  }
                  className={
                    INPUT_CLASS
                  }
                >
                  {EQUIP_SLOTS.map(
                    (slot) => (
                      <option
                        key={
                          slot
                        }
                        value={
                          slot
                        }
                      >
                        {slot}
                      </option>
                    )
                  )}
                </select>

                <input
                  value={
                    productForm.description
                  }
                  onChange={(event) =>
                    setProductForm(
                      (current) => ({
                        ...current,

                        description:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="DESCRIPTION"
                  className={
                    INPUT_CLASS
                  }
                />
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-xl bg-cyan-400 px-6 py-3 text-xs font-black text-black disabled:opacity-50"
                >
                  {busyKey ===
                  "create-product"
                    ? "CREATING..."
                    : "CREATE DRAFT PRODUCT"}
                </button>
              </div>
            </form>
          )}

          {/* =================================================
              API STATUS
          ================================================= */}

          <div className="mt-8 rounded-2xl border border-lime-400/30 bg-lime-400/5 p-5">
            <p className="font-black text-lime-400">
              PRODUCT API CONNECTED
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Products:{" "}
              {catalog.length}
            </p>
          </div>

          {/* =================================================
              PRODUCTS
          ================================================= */}

          <div className="mt-5 space-y-5">
            {catalog.map(
              (product) => {
                const liveDesignCount =
                  product.designs.filter(
                    (design) =>
                      design.is_active
                  ).length;

                return (
                  <section
                    key={
                      product.id
                    }
                    className={
                      product.is_active
                        ? "rounded-2xl border border-lime-400/20 bg-zinc-950 p-6"
                        : "rounded-2xl border border-yellow-400/20 bg-zinc-950 p-6"
                    }
                  >

                    {/* =================================================
                        PRODUCT EDIT
                    ================================================= */}

                    {editingProductId ===
                    product.id ? (
                      <form
                        onSubmit={(event) =>
                          saveProductEdit(
                            event,
                            product
                          )
                        }
                        className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.04] p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-[10px] font-black tracking-[0.2em] text-cyan-400">
                              EDIT PRODUCT
                            </p>

                            <h3 className="mt-1 text-xl font-black">
                              {
                                product.name
                              }
                            </h3>
                          </div>

                          {product.identity_locked && (
                            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                              <p className="text-[10px] font-black text-red-400">
                                🔒 PRODUCT IDENTITY LOCKED
                              </p>

                              <p className="mt-1 text-[9px] text-red-300/60">
                                {
                                  product.protected_crafted_count
                                }{" "}
                                protected collectible(s)
                              </p>
                            </div>
                          )}
                        </div>

                        {product.identity_locked && (
                          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4">
                            <p className="text-xs font-black text-red-400">
                              COLLECTIBLE PROTECTION ACTIVE
                            </p>

                            <p className="mt-2 text-xs leading-5 text-zinc-500">
                              Product Code, Season, Category and Equip Slot can no longer be changed because protected collectible items exist.
                            </p>
                          </div>
                        )}

                        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                          {/* PRODUCT CODE */}

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[9px] font-black text-zinc-500">
                                PRODUCT CODE
                              </p>

                              {product.identity_locked && (
                                <span className="text-[9px] font-black text-red-400">
                                  🔒 LOCKED
                                </span>
                              )}
                            </div>

                            <input
                              value={
                                editProductForm.code
                              }
                              disabled={
                                product.identity_locked
                              }
                              onChange={(event) =>
                                setEditProductForm(
                                  (current) => ({
                                    ...current,

                                    code:
                                      event.target.value,
                                  })
                                )
                              }
                              className={
                                product.identity_locked
                                  ? LOCKED_INPUT_CLASS
                                  : INPUT_CLASS
                              }
                            />
                          </div>

                          {/* PRODUCT NAME */}

                          <div>
                            <p className="mb-2 text-[9px] font-black text-zinc-500">
                              PRODUCT NAME
                            </p>

                            <input
                              value={
                                editProductForm.name
                              }
                              onChange={(event) =>
                                setEditProductForm(
                                  (current) => ({
                                    ...current,

                                    name:
                                      event.target.value,
                                  })
                                )
                              }
                              className={
                                INPUT_CLASS
                              }
                            />
                          </div>

                          {/* SEASON */}

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[9px] font-black text-zinc-500">
                                SEASON
                              </p>

                              {product.identity_locked && (
                                <span className="text-[9px] font-black text-red-400">
                                  🔒 LOCKED
                                </span>
                              )}
                            </div>

                            <input
                              value={
                                editProductForm.season
                              }
                              disabled={
                                product.identity_locked
                              }
                              onChange={(event) =>
                                setEditProductForm(
                                  (current) => ({
                                    ...current,

                                    season:
                                      event.target.value,
                                  })
                                )
                              }
                              className={
                                product.identity_locked
                                  ? LOCKED_INPUT_CLASS
                                  : INPUT_CLASS
                              }
                            />
                          </div>

                          {/* CATEGORY */}

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[9px] font-black text-zinc-500">
                                CATEGORY
                              </p>

                              {product.identity_locked && (
                                <span className="text-[9px] font-black text-red-400">
                                  🔒 LOCKED
                                </span>
                              )}
                            </div>

                            <select
                              value={
                                editProductForm.category
                              }
                              disabled={
                                product.identity_locked
                              }
                              onChange={(event) => {
                                const category =
                                  event.target.value as ProductCategory;

                                setEditProductForm(
                                  (current) => ({
                                    ...current,

                                    category,

                                    equip_slot:
                                      slotForCategory(
                                        category
                                      ),
                                  })
                                );
                              }}
                              className={
                                product.identity_locked
                                  ? LOCKED_INPUT_CLASS
                                  : INPUT_CLASS
                              }
                            >
                              {PRODUCT_CATEGORIES.map(
                                (category) => (
                                  <option
                                    key={
                                      category
                                    }
                                    value={
                                      category
                                    }
                                  >
                                    {
                                      category
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          {/* EQUIP SLOT */}

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[9px] font-black text-zinc-500">
                                EQUIP SLOT
                              </p>

                              {product.identity_locked && (
                                <span className="text-[9px] font-black text-red-400">
                                  🔒 LOCKED
                                </span>
                              )}
                            </div>

                            <select
                              value={
                                editProductForm.equip_slot
                              }
                              disabled={
                                product.identity_locked
                              }
                              onChange={(event) =>
                                setEditProductForm(
                                  (current) => ({
                                    ...current,

                                    equip_slot:
                                      event.target.value as EquipSlot,
                                  })
                                )
                              }
                              className={
                                product.identity_locked
                                  ? LOCKED_INPUT_CLASS
                                  : INPUT_CLASS
                              }
                            >
                              {EQUIP_SLOTS.map(
                                (slot) => (
                                  <option
                                    key={
                                      slot
                                    }
                                    value={
                                      slot
                                    }
                                  >
                                    {slot}
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          {/* DESCRIPTION */}

                          <div>
                            <p className="mb-2 text-[9px] font-black text-zinc-500">
                              DESCRIPTION
                            </p>

                            <input
                              value={
                                editProductForm.description
                              }
                              onChange={(event) =>
                                setEditProductForm(
                                  (current) => ({
                                    ...current,

                                    description:
                                      event.target.value,
                                  })
                                )
                              }
                              className={
                                INPUT_CLASS
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProductId(
                                null
                              )
                            }
                            className="rounded-xl border border-white/10 px-5 py-3 text-xs font-black text-zinc-400"
                          >
                            CANCEL
                          </button>

                          <button
                            type="submit"
                            disabled={
                              saving
                            }
                            className="rounded-xl bg-cyan-400 px-6 py-3 text-xs font-black text-black disabled:opacity-50"
                          >
                            {busyKey ===
                            `edit-product-${product.id}`
                              ? "SAVING..."
                              : "SAVE PRODUCT"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-2xl font-black">
                              {
                                product.name
                              }
                            </h2>

                            {product.is_active ? (
                              <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[10px] font-black text-lime-400">
                                LIVE
                              </span>
                            ) : (
                              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[10px] font-black text-yellow-400">
                                DRAFT
                              </span>
                            )}

                            {product.identity_locked && (
                              <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-[10px] font-black text-red-400">
                                🔒 IDENTITY LOCKED
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm font-bold text-cyan-400">
                            {
                              product.code
                            }
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                              {
                                product.category
                              }
                            </span>

                            <span className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                              {
                                product.equip_slot
                              }
                            </span>

                            <span className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                              {
                                product.season
                              }
                            </span>
                          </div>

                          {product.description && (
                            <p className="mt-3 text-xs text-zinc-600">
                              {
                                product.description
                              }
                            </p>
                          )}

                          <p
                            className={
                              product.is_active
                                ? "mt-4 text-xs font-bold text-lime-400"
                                : "mt-4 text-xs font-bold text-yellow-400"
                            }
                          >
                            {product.is_active
                              ? `${liveDesignCount} published design(s)`
                              : "PRODUCT HIDDEN FROM CRAFT"}
                          </p>

                          {product.identity_locked && (
                            <p className="mt-2 text-[10px] font-bold text-red-400">
                              {
                                product.protected_crafted_count
                              }{" "}
                              protected collectible(s) lock Product identity.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              startProductEdit(
                                product
                              )
                            }
                            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-xs font-black text-cyan-400"
                          >
                            EDIT PRODUCT
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openAddDesign(
                                product
                              )
                            }
                            className="rounded-xl border border-orange-400/30 bg-orange-400/10 px-5 py-3 text-xs font-black text-orange-400"
                          >
                            + ADD DESIGN
                          </button>

                          <button
                            type="button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              toggleProduct(
                                product
                              )
                            }
                            className={
                              product.is_active
                                ? "rounded-xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-xs font-black text-red-400 disabled:opacity-50"
                                : "rounded-xl border border-lime-400/30 bg-lime-400/10 px-5 py-3 text-xs font-black text-lime-400 disabled:opacity-50"
                            }
                          >
                            {busyKey ===
                            `product-${product.id}`
                              ? "SAVING..."
                              : product.is_active
                                ? "HIDE PRODUCT"
                                : "PUBLISH PRODUCT"}
                          </button>
                        </div>
                      </div>
                    )}

                    {!product.is_active && (
                      <div className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                        <p className="text-xs font-black text-yellow-400">
                          DRAFT PRODUCT
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Product and every design under it are hidden from Craft.
                        </p>
                      </div>
                    )}

                    {/* =================================================
                        ADD DESIGN
                    ================================================= */}

                    {addingDesignTo ===
                      product.id && (
                      <form
                        onSubmit={(event) =>
                          createDesign(
                            event,
                            product
                          )
                        }
                        className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/5 p-5"
                      >
                        <div>
                          <p className="text-[10px] font-black tracking-[0.2em] text-orange-400">
                            NEW DESIGN
                          </p>

                          <h3 className="mt-1 text-xl font-black">
                            {
                              product.name
                            }
                          </h3>

                          <p className="mt-2 text-xs font-bold text-yellow-400">
                            New designs start as DRAFT.
                          </p>
                        </div>

                        <div className="mt-6 grid gap-5 lg:grid-cols-2">

                          {/* IMAGE */}

                          <div className="rounded-2xl border border-dashed border-orange-400/30 bg-black p-4">
                            <p className="text-[10px] font-black text-zinc-500">
                              PRODUCT IMAGE
                            </p>

                            {designImagePreview ? (
                              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                                <img
                                  src={
                                    designImagePreview
                                  }
                                  alt="Preview"
                                  className="h-[260px] w-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="mt-4 flex h-[220px] items-center justify-center rounded-xl border border-white/10 bg-zinc-950">
                                <p className="text-xs font-black text-zinc-700">
                                  NO IMAGE
                                </p>
                              </div>
                            )}

                            <label className="mt-4 block cursor-pointer rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-center text-xs font-black text-cyan-400">
                              IMPORT IMAGE

                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={
                                  handleImageChange
                                }
                                className="hidden"
                              />
                            </label>
                          </div>

                          {/* DATA */}

                          <div className="space-y-4">
                            <input
                              value={
                                designForm.design_code
                              }
                              onChange={(event) =>
                                setDesignForm(
                                  (current) => ({
                                    ...current,

                                    design_code:
                                      event.target.value,
                                  })
                                )
                              }
                              placeholder="DESIGN CODE"
                              className={
                                INPUT_ORANGE_CLASS
                              }
                            />

                            <input
                              value={
                                designForm.name
                              }
                              onChange={(event) =>
                                setDesignForm(
                                  (current) => ({
                                    ...current,

                                    name:
                                      event.target.value,
                                  })
                                )
                              }
                              placeholder="DESIGN NAME"
                              className={
                                INPUT_ORANGE_CLASS
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              value={
                                designForm.craft_cost_lt
                              }
                              onChange={(event) =>
                                setDesignForm(
                                  (current) => ({
                                    ...current,

                                    craft_cost_lt:
                                      event.target.value,
                                  })
                                )
                              }
                              placeholder="CRAFT COST"
                              className={
                                INPUT_ORANGE_CLASS
                              }
                            />

                            {/* MODEL */}

                            <div className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.04] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black text-purple-400">
                                    3D MODEL
                                  </p>

                                  <p className="mt-1 text-[10px] text-zinc-600">
                                    GLB - MAX 50MB
                                  </p>
                                </div>

                                {designModelFile && (
                                  <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[9px] font-black text-lime-400">
                                    READY
                                  </span>
                                )}
                              </div>

                              {designModelFile ? (
                                <div className="mt-4 rounded-xl border border-purple-400/20 bg-black p-4">
                                  <p className="break-all text-xs font-black">
                                    {
                                      designModelFile.name
                                    }
                                  </p>

                                  <p className="mt-1 text-[10px] text-zinc-500">
                                    {formatFileSize(
                                      designModelFile.size
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black p-5 text-center">
                                  <p className="text-[10px] font-black text-zinc-700">
                                    NO GLB SELECTED
                                  </p>
                                </div>
                              )}

                              <label className="mt-3 block cursor-pointer rounded-xl border border-purple-400/30 bg-purple-400/10 px-5 py-3 text-center text-xs font-black text-purple-400">
                                IMPORT GLB

                                <input
                                  type="file"
                                  accept=".glb,model/gltf-binary,application/octet-stream"
                                  onChange={
                                    handleModelChange
                                  }
                                  className="hidden"
                                />
                              </label>

                              {designModelFile && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDesignModelFile(
                                      null
                                    )
                                  }
                                  className="mt-2 w-full rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-500"
                                >
                                  CLEAR SELECTED GLB
                                </button>
                              )}

                              <div className="my-4 flex items-center gap-3">
                                <div className="h-px flex-1 bg-white/10" />

                                <span className="text-[9px] font-black text-zinc-700">
                                  OR MANUAL URL
                                </span>

                                <div className="h-px flex-1 bg-white/10" />
                              </div>

                              <input
                                value={
                                  designForm.model_url
                                }
                                onChange={(event) =>
                                  setDesignForm(
                                    (current) => ({
                                      ...current,

                                      model_url:
                                        event.target.value,
                                    })
                                  )
                                }
                                placeholder="3D MODEL URL - OPTIONAL"
                                className={
                                  INPUT_ORANGE_CLASS
                                }
                              />
                            </div>

                            {/* SIZES */}

                            <div>
                              <p className="text-[10px] font-black text-zinc-500">
                                AVAILABLE SIZES
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {ALL_SIZES.map(
                                  (size) => {
                                    const selected =
                                      designForm.available_sizes.includes(
                                        size
                                      );

                                    return (
                                      <button
                                        key={
                                          size
                                        }
                                        type="button"
                                        onClick={() =>
                                          toggleSize(
                                            size
                                          )
                                        }
                                        className={
                                          selected
                                            ? "rounded-lg border border-cyan-400 bg-cyan-400/15 px-4 py-2 text-xs font-black text-cyan-400"
                                            : "rounded-lg border border-white/10 bg-black px-4 py-2 text-xs font-black text-zinc-500"
                                        }
                                      >
                                        {
                                          size
                                        }
                                      </button>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={
                              closeAddDesign
                            }
                            className="rounded-xl border border-white/10 px-5 py-3 text-xs font-black"
                          >
                            CANCEL
                          </button>

                          <button
                            type="submit"
                            disabled={
                              saving
                            }
                            className="rounded-xl bg-orange-400 px-6 py-3 text-xs font-black text-black disabled:opacity-50"
                          >
                            {busyKey ===
                            `create-design-${product.id}`
                              ? "UPLOADING / SAVING..."
                              : "CREATE DRAFT DESIGN"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* =================================================
                        DESIGNS
                    ================================================= */}

                    <div className="mt-6 space-y-3">
                      {product.designs.length ===
                        0 && (
                        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                          <p className="text-xs font-black text-zinc-600">
                            NO DESIGN YET
                          </p>
                        </div>
                      )}

                      {product.designs.map(
                        (design) => {
                          const visibleInCraft =
                            product.is_active &&
                            design.is_active;

                          /* ===========================================
                             EDIT DESIGN
                          =========================================== */

                          if (
                            editingDesignId ===
                            design.id
                          ) {
                            const imageToShow =
                              removeEditImage
                                ? ""
                                : editDesignImagePreview ||
                                  editDesignOriginalImage ||
                                  "";

                            const currentModelUrl =
                              removeEditModel
                                ? ""
                                : editDesignForm.model_url;

                            return (
                              <form
                                key={
                                  design.id
                                }
                                onSubmit={(event) =>
                                  saveDesignEdit(
                                    event,
                                    product,
                                    design
                                  )
                                }
                                className="rounded-2xl border border-purple-400/30 bg-purple-400/[0.04] p-5"
                              >
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-[10px] font-black tracking-[0.2em] text-purple-400">
                                      EDIT DESIGN
                                    </p>

                                    <h3 className="mt-1 text-xl font-black">
                                      {
                                        design.name
                                      }
                                    </h3>
                                  </div>

                                  {design.identity_locked && (
                                    <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                                      <p className="text-[10px] font-black text-red-400">
                                        🔒 DESIGN IDENTITY LOCKED
                                      </p>

                                      <p className="mt-1 text-[9px] text-red-300/60">
                                        {
                                          design.protected_crafted_count
                                        }{" "}
                                        protected item(s)
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* COLLECTIBLE STATUS */}

                                <div
                                  className={
                                    design.identity_locked
                                      ? "mt-5 rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-5"
                                      : "mt-5 rounded-2xl border border-lime-400/20 bg-lime-400/[0.04] p-5"
                                  }
                                >
                                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                      <p className="text-[10px] font-black tracking-[0.2em] text-zinc-500">
                                        COLLECTIBLE IDENTITY
                                      </p>

                                      <p
                                        className={
                                          design.identity_locked
                                            ? "mt-2 text-lg font-black text-red-400"
                                            : "mt-2 text-lg font-black text-lime-400"
                                        }
                                      >
                                        {design.identity_locked
                                          ? "🔒 LOCKED"
                                          : "UNLOCKED"}
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-4 gap-5 text-center">
                                      <div>
                                        <p className="text-[9px] font-black text-zinc-600">
                                          TOTAL
                                        </p>

                                        <p className="mt-1 font-black text-white">
                                          {
                                            design.total_crafted_count
                                          }
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-[9px] font-black text-zinc-600">
                                          TEST
                                        </p>

                                        <p className="mt-1 font-black text-cyan-400">
                                          {
                                            design.test_crafted_count
                                          }
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-[9px] font-black text-zinc-600">
                                          LIVE
                                        </p>

                                        <p className="mt-1 font-black text-orange-400">
                                          {
                                            design.live_crafted_count
                                          }
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-[9px] font-black text-zinc-600">
                                          PROTECTED
                                        </p>

                                        <p className="mt-1 font-black text-red-400">
                                          {
                                            design.protected_crafted_count
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {design.identity_locked ? (
                                    <p className="mt-4 text-xs leading-5 text-red-300/70">
                                      Protected collectibles exist. Design Code is permanently protected for this collectible identity.
                                    </p>
                                  ) : design.test_crafted_count >
                                    0 ? (
                                    <p className="mt-4 text-xs leading-5 text-cyan-300/70">
                                      TEST crafts exist, but TEST items do not lock collectible identity.
                                    </p>
                                  ) : (
                                    <p className="mt-4 text-xs leading-5 text-zinc-600">
                                      No protected collectible exists yet.
                                    </p>
                                  )}
                                </div>

                                <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">

                                  {/* IMAGE */}

                                  <div className="rounded-2xl border border-white/10 bg-black p-4">
                                    <p className="text-[9px] font-black text-zinc-500">
                                      PRODUCT IMAGE
                                    </p>

                                    {imageToShow ? (
                                      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                                        <img
                                          src={
                                            imageToShow
                                          }
                                          alt={
                                            design.name
                                          }
                                          className="h-[240px] w-full object-contain"
                                        />
                                      </div>
                                    ) : (
                                      <div className="mt-3 flex h-[240px] items-center justify-center rounded-xl border border-white/10">
                                        <span className="text-[10px] font-black text-zinc-700">
                                          NO IMAGE
                                        </span>
                                      </div>
                                    )}

                                    <label className="mt-3 block cursor-pointer rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center text-xs font-black text-cyan-400">
                                      CHANGE IMAGE

                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={
                                          handleEditImageChange
                                        }
                                        className="hidden"
                                      />
                                    </label>

                                    {imageToShow && (
                                      <button
                                        type="button"
                                        onClick={
                                          removeDesignImage
                                        }
                                        className="mt-2 w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs font-black text-red-400"
                                      >
                                        REMOVE IMAGE
                                      </button>
                                    )}
                                  </div>

                                  {/* DATA */}

                                  <div className="space-y-4">

                                    {/* DESIGN CODE */}

                                    <div>
                                      <div className="mb-2 flex items-center justify-between">
                                        <p className="text-[9px] font-black text-zinc-500">
                                          DESIGN CODE
                                        </p>

                                        {design.identity_locked && (
                                          <span className="text-[9px] font-black text-red-400">
                                            🔒 LOCKED
                                          </span>
                                        )}
                                      </div>

                                      <input
                                        value={
                                          editDesignForm.design_code
                                        }
                                        disabled={
                                          design.identity_locked
                                        }
                                        onChange={(event) =>
                                          setEditDesignForm(
                                            (current) => ({
                                              ...current,

                                              design_code:
                                                event.target.value,
                                            })
                                          )
                                        }
                                        className={
                                          design.identity_locked
                                            ? LOCKED_INPUT_CLASS
                                            : INPUT_ORANGE_CLASS
                                        }
                                      />

                                      {design.identity_locked && (
                                        <p className="mt-2 text-[9px] text-red-400/60">
                                          Create a new Design such as D02 for a new collectible identity.
                                        </p>
                                      )}
                                    </div>

                                    {/* DESIGN NAME */}

                                    <div>
                                      <p className="mb-2 text-[9px] font-black text-zinc-500">
                                        DESIGN NAME
                                      </p>

                                      <input
                                        value={
                                          editDesignForm.name
                                        }
                                        onChange={(event) =>
                                          setEditDesignForm(
                                            (current) => ({
                                              ...current,

                                              name:
                                                event.target.value,
                                            })
                                          )
                                        }
                                        className={
                                          INPUT_ORANGE_CLASS
                                        }
                                      />
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">

                                      {/* CRAFT COST */}

                                      <div>
                                        <p className="mb-2 text-[9px] font-black text-zinc-500">
                                          CRAFT COST
                                        </p>

                                        <input
                                          type="number"
                                          min="0"
                                          value={
                                            editDesignForm.craft_cost_lt
                                          }
                                          onChange={(event) =>
                                            setEditDesignForm(
                                              (current) => ({
                                                ...current,

                                                craft_cost_lt:
                                                  event.target.value,
                                              })
                                            )
                                          }
                                          className={
                                            INPUT_ORANGE_CLASS
                                          }
                                        />
                                      </div>

                                      {/* SORT ORDER */}

                                      <div>
                                        <p className="mb-2 text-[9px] font-black text-zinc-500">
                                          SORT ORDER
                                        </p>

                                        <input
                                          type="number"
                                          value={
                                            editDesignForm.sort_order
                                          }
                                          onChange={(event) =>
                                            setEditDesignForm(
                                              (current) => ({
                                                ...current,

                                                sort_order:
                                                  event.target.value,
                                              })
                                            )
                                          }
                                          className={
                                            INPUT_ORANGE_CLASS
                                          }
                                        />
                                      </div>
                                    </div>

                                    {/* 3D MODEL */}

                                    <div className="rounded-2xl border border-purple-400/25 bg-purple-400/[0.04] p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <p className="text-[10px] font-black text-purple-400">
                                            3D MODEL
                                          </p>

                                          <p className="mt-1 text-[10px] text-zinc-600">
                                            GLB - MAX 50MB
                                          </p>
                                        </div>

                                        {editDesignModelFile ? (
                                          <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[9px] font-black text-lime-400">
                                            NEW GLB READY
                                          </span>
                                        ) : currentModelUrl ? (
                                          <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-[9px] font-black text-purple-400">
                                            MODEL SET
                                          </span>
                                        ) : (
                                          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[9px] font-black text-zinc-500">
                                            NOT SET
                                          </span>
                                        )}
                                      </div>

                                      {editDesignModelFile ? (
                                        <div className="mt-4 rounded-xl border border-lime-400/20 bg-black p-4">
                                          <p className="break-all text-xs font-black text-lime-400">
                                            {
                                              editDesignModelFile.name
                                            }
                                          </p>

                                          <p className="mt-1 text-[10px] text-zinc-500">
                                            {formatFileSize(
                                              editDesignModelFile.size
                                            )}
                                          </p>
                                        </div>
                                      ) : currentModelUrl ? (
                                        <div className="mt-4 rounded-xl border border-purple-400/20 bg-black p-4">
                                          <p className="text-[9px] font-black text-zinc-600">
                                            CURRENT MODEL
                                          </p>

                                          <p className="mt-2 break-all text-xs font-black text-purple-400">
                                            {getModelFileName(
                                              currentModelUrl
                                            )}
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black p-5 text-center">
                                          <p className="text-[10px] font-black text-zinc-700">
                                            NO 3D MODEL
                                          </p>
                                        </div>
                                      )}

                                      {currentModelUrl &&
                                        !editDesignModelFile && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewModel({
                                              url:
                                                currentModelUrl,

                                              name:
                                                `${product.name} / ${editDesignForm.design_code}`,
                                            })
                                          }
                                          className="mt-3 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-xs font-black text-cyan-400"
                                        >
                                          VIEW CURRENT 3D
                                        </button>
                                      )}

                                      <label className="mt-3 block cursor-pointer rounded-xl border border-purple-400/30 bg-purple-400/10 px-5 py-3 text-center text-xs font-black text-purple-400">
                                        {currentModelUrl ||
                                        editDesignModelFile
                                          ? "CHANGE GLB"
                                          : "IMPORT GLB"}

                                        <input
                                          type="file"
                                          accept=".glb,model/gltf-binary,application/octet-stream"
                                          onChange={
                                            handleEditModelChange
                                          }
                                          className="hidden"
                                        />
                                      </label>

                                      {editDesignModelFile && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditDesignModelFile(
                                              null
                                            )
                                          }
                                          className="mt-2 w-full rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-500"
                                        >
                                          CANCEL NEW GLB
                                        </button>
                                      )}

                                      {(currentModelUrl ||
                                        editDesignModelFile) &&
                                        !removeEditModel && (
                                        <button
                                          type="button"
                                          onClick={
                                            removeDesignModel
                                          }
                                          className="mt-2 w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs font-black text-red-400"
                                        >
                                          REMOVE GLB
                                        </button>
                                      )}

                                      {removeEditModel && (
                                        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3">
                                          <p className="text-[10px] font-black text-red-400">
                                            MODEL WILL BE REMOVED WHEN SAVED
                                          </p>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRemoveEditModel(
                                                false
                                              )
                                            }
                                            className="mt-2 text-[10px] font-black text-zinc-400 underline"
                                          >
                                            UNDO REMOVE
                                          </button>
                                        </div>
                                      )}

                                      <div className="my-4 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-white/10" />

                                        <span className="text-[9px] font-black text-zinc-700">
                                          MANUAL URL
                                        </span>

                                        <div className="h-px flex-1 bg-white/10" />
                                      </div>

                                      <input
                                        value={
                                          removeEditModel
                                            ? ""
                                            : editDesignForm.model_url
                                        }
                                        disabled={
                                          removeEditModel
                                        }
                                        onChange={(event) =>
                                          setEditDesignForm(
                                            (current) => ({
                                              ...current,

                                              model_url:
                                                event.target.value,
                                            })
                                          )
                                        }
                                        placeholder="MODEL URL"
                                        className={
                                          INPUT_ORANGE_CLASS
                                        }
                                      />
                                    </div>

                                    {/* SIZES */}

                                    <div>
                                      <p className="text-[9px] font-black text-zinc-500">
                                        AVAILABLE SIZES
                                      </p>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {ALL_SIZES.map(
                                          (size) => {
                                            const selected =
                                              editDesignForm.available_sizes.includes(
                                                size
                                              );

                                            return (
                                              <button
                                                key={
                                                  size
                                                }
                                                type="button"
                                                onClick={() =>
                                                  toggleEditSize(
                                                    size
                                                  )
                                                }
                                                className={
                                                  selected
                                                    ? "rounded-lg border border-cyan-400 bg-cyan-400/15 px-4 py-2 text-xs font-black text-cyan-400"
                                                    : "rounded-lg border border-white/10 bg-black px-4 py-2 text-xs font-black text-zinc-500"
                                                }
                                              >
                                                {
                                                  size
                                                }
                                              </button>
                                            );
                                          }
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-6 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                                  <p className="text-[10px] font-black text-yellow-400">
                                    COLLECTIBLE SAFETY
                                  </p>

                                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                                    A new physical artwork should become a new Design ID such as D02 instead of replacing an existing collectible identity.
                                  </p>
                                </div>

                                <div className="mt-5 flex justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingDesignId(
                                        null
                                      )
                                    }
                                    className="rounded-xl border border-white/10 px-5 py-3 text-xs font-black text-zinc-400"
                                  >
                                    CANCEL
                                  </button>

                                  <button
                                    type="submit"
                                    disabled={
                                      saving
                                    }
                                    className="rounded-xl bg-purple-400 px-6 py-3 text-xs font-black text-black disabled:opacity-50"
                                  >
                                    {busyKey ===
                                    `edit-design-${design.id}`
                                      ? "UPLOADING / SAVING..."
                                      : "SAVE DESIGN"}
                                  </button>
                                </div>
                              </form>
                            );
                          }

                          /* ===========================================
                             NORMAL DESIGN CARD
                          =========================================== */

                          return (
                            <div
                              key={
                                design.id
                              }
                              className={
                                visibleInCraft
                                  ? "grid gap-5 rounded-xl border border-lime-400/20 bg-lime-400/[0.03] p-4 md:grid-cols-[150px_1fr]"
                                  : "grid gap-5 rounded-xl border border-orange-400/20 bg-orange-400/5 p-4 md:grid-cols-[150px_1fr]"
                              }
                            >

                              {/* IMAGE */}

                              <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                                {design.thumbnail_url ? (
                                  <img
                                    src={
                                      design.thumbnail_url
                                    }
                                    alt={
                                      design.name
                                    }
                                    className="h-[150px] w-full object-contain"
                                  />
                                ) : (
                                  <div className="flex h-[150px] items-center justify-center">
                                    <span className="text-[10px] font-black text-zinc-700">
                                      NO IMAGE
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* INFO */}

                              <div>
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="font-black text-orange-400">
                                        {
                                          design.design_code
                                        }
                                      </span>

                                      <span className="font-black">
                                        {
                                          design.name
                                        }
                                      </span>

                                      {visibleInCraft ? (
                                        <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[9px] font-black text-lime-400">
                                          VISIBLE IN CRAFT
                                        </span>
                                      ) : design.is_active ? (
                                        <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[9px] font-black text-yellow-400">
                                          PRODUCT DRAFT
                                        </span>
                                      ) : (
                                        <span className="rounded-full border border-zinc-600 bg-zinc-900 px-3 py-1 text-[9px] font-black text-zinc-500">
                                          DESIGN DRAFT
                                        </span>
                                      )}

                                      {design.model_url ? (
                                        <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-[9px] font-black text-purple-400">
                                          3D READY
                                        </span>
                                      ) : (
                                        <span className="rounded-full border border-zinc-700 px-3 py-1 text-[9px] font-black text-zinc-600">
                                          NO 3D
                                        </span>
                                      )}

                                      {design.identity_locked ? (
                                        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-[9px] font-black text-red-400">
                                          🔒 IDENTITY LOCKED
                                        </span>
                                      ) : (
                                        <span className="rounded-full border border-lime-400/20 bg-lime-400/5 px-3 py-1 text-[9px] font-black text-lime-400">
                                          IDENTITY UNLOCKED
                                        </span>
                                      )}
                                    </div>

                                    <p
                                      className={
                                        visibleInCraft
                                          ? "mt-2 text-[10px] font-black text-lime-400"
                                          : "mt-2 text-[10px] font-black text-zinc-600"
                                      }
                                    >
                                      {visibleInCraft
                                        ? "LIVE - PLAYERS CAN CRAFT THIS DESIGN"
                                        : "HIDDEN FROM CRAFT"}
                                    </p>
                                  </div>

                                  {/* ACTIONS */}

                                  <div className="flex flex-wrap gap-2">
                                    {design.model_url && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewModel({
                                            url:
                                              design.model_url as string,

                                            name:
                                              `${product.name} / ${design.design_code}`,
                                          })
                                        }
                                        className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-[10px] font-black text-cyan-400"
                                      >
                                        VIEW 3D
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        startDesignEdit(
                                          design
                                        )
                                      }
                                      className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-3 text-[10px] font-black text-purple-400"
                                    >
                                      EDIT DESIGN
                                    </button>

                                    <Link
                                      href={`/admin/products/grade-assets?product_id=${product.id}&design_id=${design.id}`}
                                      className="rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-[10px] font-black text-orange-400 transition hover:border-orange-400 hover:bg-orange-400/15"
                                    >
                                      MANAGE GRADE ASSETS
                                    </Link>

                                    <button
                                      type="button"
                                      disabled={
                                        saving
                                      }
                                      onClick={() =>
                                        toggleDesign(
                                          product,
                                          design
                                        )
                                      }
                                      className={
                                        design.is_active
                                          ? "rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-[10px] font-black text-red-400 disabled:opacity-50"
                                          : "rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-[10px] font-black text-lime-400 disabled:opacity-50"
                                      }
                                    >
                                      {busyKey ===
                                      `design-${design.id}`
                                        ? "SAVING..."
                                        : design.is_active
                                          ? "HIDE FROM CRAFT"
                                          : "PUBLISH TO CRAFT"}
                                    </button>
                                  </div>
                                </div>

                                {/* BASIC INFO */}

                                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                                  <div>
                                    <p className="text-xs text-zinc-600">
                                      CRAFT COST
                                    </p>

                                    <p className="mt-1 font-black text-cyan-400">
                                      {
                                        design.craft_cost_lt
                                      }{" "}
                                      LT
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-zinc-600">
                                      SIZES
                                    </p>

                                    <p className="mt-1 font-bold">
                                      {
                                        design.available_sizes.join(
                                          " / "
                                        )
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs text-zinc-600">
                                      3D MODEL
                                    </p>

                                    {design.model_url ? (
                                      <>
                                        <p className="mt-1 break-all font-bold text-purple-400">
                                          {getModelFileName(
                                            design.model_url
                                          )}
                                        </p>

                                        <p className="mt-1 text-[9px] font-black text-lime-400">
                                          READY
                                        </p>
                                      </>
                                    ) : (
                                      <p className="mt-1 font-bold text-zinc-600">
                                        NOT SET
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* CRAFT STATS */}

                                <div
                                  className={
                                    design.identity_locked
                                      ? "mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4"
                                      : "mt-5 rounded-xl border border-white/10 bg-black/40 p-4"
                                  }
                                >
                                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                      <p className="text-[9px] font-black tracking-[0.2em] text-zinc-600">
                                        COLLECTIBLE STATUS
                                      </p>

                                      <p
                                        className={
                                          design.identity_locked
                                            ? "mt-2 text-sm font-black text-red-400"
                                            : "mt-2 text-sm font-black text-lime-400"
                                        }
                                      >
                                        {design.identity_locked
                                          ? "🔒 IDENTITY LOCKED"
                                          : "IDENTITY UNLOCKED"}
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                      <div className="min-w-[90px] rounded-lg border border-white/10 bg-black p-3 text-center">
                                        <p className="text-[8px] font-black text-zinc-600">
                                          TOTAL
                                        </p>

                                        <p className="mt-1 text-lg font-black text-white">
                                          {
                                            design.total_crafted_count
                                          }
                                        </p>
                                      </div>

                                      <div className="min-w-[90px] rounded-lg border border-cyan-400/10 bg-cyan-400/[0.03] p-3 text-center">
                                        <p className="text-[8px] font-black text-cyan-700">
                                          TEST
                                        </p>

                                        <p className="mt-1 text-lg font-black text-cyan-400">
                                          {
                                            design.test_crafted_count
                                          }
                                        </p>
                                      </div>

                                      <div className="min-w-[90px] rounded-lg border border-orange-400/10 bg-orange-400/[0.03] p-3 text-center">
                                        <p className="text-[8px] font-black text-orange-700">
                                          LIVE
                                        </p>

                                        <p className="mt-1 text-lg font-black text-orange-400">
                                          {
                                            design.live_crafted_count
                                          }
                                        </p>
                                      </div>

                                      <div className="min-w-[90px] rounded-lg border border-red-400/10 bg-red-400/[0.03] p-3 text-center">
                                        <p className="text-[8px] font-black text-red-800">
                                          PROTECTED
                                        </p>

                                        <p className="mt-1 text-lg font-black text-red-400">
                                          {
                                            design.protected_crafted_count
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {design.identity_locked ? (
                                    <p className="mt-3 text-[10px] font-bold text-red-400/70">
                                      Protected collectible records exist. Design Code is locked.
                                    </p>
                                  ) : design.test_crafted_count >
                                    0 ? (
                                    <p className="mt-3 text-[10px] font-bold text-cyan-400/70">
                                      TEST items are counted but do not lock collectible identity.
                                    </p>
                                  ) : (
                                    <p className="mt-3 text-[10px] text-zinc-700">
                                      No protected collectible exists yet.
                                    </p>
                                  )}

                                  {design.legacy_crafted_count >
                                    0 && (
                                    <p className="mt-2 text-[10px] font-bold text-yellow-400">
                                      LEGACY PROTECTED:{" "}
                                      {
                                        design.legacy_crafted_count
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </section>
                );
              }
            )}
          </div>
        </div>
      </main>

      {/* ===================================================
          3D PREVIEW
      =================================================== */}

      {previewModel && (
        <AdminModelPreview
          modelUrl={
            previewModel.url
          }
          modelName={
            previewModel.name
          }
          onClose={() =>
            setPreviewModel(
              null
            )
          }
        />
      )}
    </>
  );
}