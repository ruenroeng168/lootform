"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  supabase,
} from "@/lib/supabase";

import AdminModelPreview from "@/components/AdminModelPreview";

/* =========================================================
   LOOTFORM
   STEP 10D-3A
   ADMIN CHARACTER LIBRARY

   FEATURES

   - Load Character Library
   - Create Character Draft
   - Edit Character Metadata
   - Upload Preview Image
   - Import GLB with Signed Upload
   - View 3D
   - Publish / Hide
   - Set Default Character
========================================================= */

/* =========================================================
   TYPES
========================================================= */

type CharacterModel = {
  id: number;

  code: string;

  name: string;

  description:
    | string
    | null;

  version: number;

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

  is_active: boolean;

  is_default: boolean;

  sort_order: number;

  created_at: string;

  updated_at: string;

  image_ready: boolean;

  model_ready: boolean;

  status:
    | "DEFAULT"
    | "ACTIVE"
    | "DRAFT";
};

type CharacterForm = {
  code: string;

  name: string;

  description: string;

  version: string;

  sort_order: string;
};

type PreviewModel = {
  url: string;

  name: string;
};

/* =========================================================
   DEFAULT FORM
========================================================= */

const DEFAULT_FORM:
  CharacterForm = {
    code:
      "",

    name:
      "",

    description:
      "",

    version:
      "1",

    sort_order:
      "0",
  };

/* =========================================================
   FILE LIMITS
========================================================= */

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const MAX_MODEL_SIZE =
  100 * 1024 * 1024;

/* =========================================================
   FORM CLASS
========================================================= */

const INPUT_CLASS =
  `
    w-full
    rounded-xl
    border
    border-zinc-800
    bg-black/70
    px-4
    py-3
    text-sm
    text-white
    outline-none
    transition
    placeholder:text-zinc-700
    focus:border-cyan-400/60
  `;

/* =========================================================
   HELPERS
========================================================= */

function formatFileSize(
  bytes: number
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

/* =========================================================
   IMAGE VALIDATION
========================================================= */

function validateImageFile(
  file: File
) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (
    !allowed.includes(
      file.type
    )
  ) {
    return "รองรับเฉพาะ JPEG, PNG และ WEBP";
  }

  if (
    file.size >
    MAX_IMAGE_SIZE
  ) {
    return "Preview Image ต้องไม่เกิน 5 MB";
  }

  return "";
}

/* =========================================================
   MODEL VALIDATION
========================================================= */

function validateModelFile(
  file: File
) {
  if (
    !file.name
      .toLowerCase()
      .endsWith(
        ".glb"
      )
  ) {
    return "รองรับเฉพาะไฟล์ .glb";
  }

  if (
    file.size >
    MAX_MODEL_SIZE
  ) {
    return "Character GLB ต้องไม่เกิน 100 MB";
  }

  if (
    file.size <= 0
  ) {
    return "GLB file is empty";
  }

  return "";
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminCharactersPage() {
  /* =======================================================
     STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    busyKey,
    setBusyKey,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    characters,
    setCharacters,
  ] =
    useState<
      CharacterModel[]
    >([]);

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(false);

  const [
    createForm,
    setCreateForm,
  ] =
    useState<CharacterForm>(
      DEFAULT_FORM
    );

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      number | null
    >(null);

  const [
    editForm,
    setEditForm,
  ] =
    useState<CharacterForm>(
      DEFAULT_FORM
    );

  const [
    previewModel,
    setPreviewModel,
  ] =
    useState<
      PreviewModel | null
    >(null);

  /* =======================================================
     AUTHENTICATED JSON FETCH
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
          await supabase
            .auth
            .getSession();

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

                ...(options
                  ?.headers ??
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
     LOAD CHARACTERS
  ======================================================= */

  const loadCharacters =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const result =
            await authenticatedFetch(
              "/api/admin/characters"
            );

          setCharacters(
            result.characters ??
              []
          );
        } catch (
          loadError
        ) {
          console.error(
            "LOAD CHARACTER LIBRARY ERROR:",
            loadError
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "Cannot load Character Library"
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
    loadCharacters();
  }, [
    loadCharacters,
  ]);

  /* =======================================================
     CREATE CHARACTER
  ======================================================= */

  async function createCharacter(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const code =
      createForm.code.trim();

    const name =
      createForm.name.trim();

    const version =
      Number(
        createForm.version
      );

    const sortOrder =
      Number(
        createForm.sort_order
      );

    if (!code) {
      setError(
        "Character Code is required."
      );

      return;
    }

    if (!name) {
      setError(
        "Character Name is required."
      );

      return;
    }

    if (
      !Number.isInteger(
        version
      ) ||
      version <= 0
    ) {
      setError(
        "Version must be 1 or greater."
      );

      return;
    }

    if (
      !Number.isInteger(
        sortOrder
      ) ||
      sortOrder < 0
    ) {
      setError(
        "Sort Order must be 0 or greater."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setBusyKey(
        "create"
      );

      const result =
        await authenticatedFetch(
          "/api/admin/characters",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                action:
                  "create_character",

                code,

                name,

                description:
                  createForm
                    .description,

                version,

                sort_order:
                  sortOrder,
              }),
          }
        );

      setSuccess(
        `${result.character.name} CREATED AS DRAFT`
      );

      setCreateForm(
        DEFAULT_FORM
      );

      setShowCreate(
        false
      );

      await loadCharacters();
    } catch (
      createError
    ) {
      console.error(
        "CREATE CHARACTER ERROR:",
        createError
      );

      setError(
        createError instanceof
        Error
          ? createError.message
          : "Cannot create Character"
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey(
        ""
      );
    }
  }

  /* =======================================================
     START EDIT
  ======================================================= */

  function startEdit(
    character:
      CharacterModel
  ) {
    setError("");
    setSuccess("");

    setEditingId(
      character.id
    );

    setEditForm({
      code:
        character.code,

      name:
        character.name,

      description:
        character
          .description ??
        "",

      version:
        String(
          character.version
        ),

      sort_order:
        String(
          character.sort_order
        ),
    });
  }

  /* =======================================================
     SAVE EDIT
  ======================================================= */

  async function saveEdit(
    event:
      FormEvent<HTMLFormElement>,
    character:
      CharacterModel
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const code =
      editForm.code.trim();

    const name =
      editForm.name.trim();

    const version =
      Number(
        editForm.version
      );

    const sortOrder =
      Number(
        editForm.sort_order
      );

    if (!code) {
      setError(
        "Character Code is required."
      );

      return;
    }

    if (!name) {
      setError(
        "Character Name is required."
      );

      return;
    }

    if (
      !Number.isInteger(
        version
      ) ||
      version <= 0
    ) {
      setError(
        "Version must be 1 or greater."
      );

      return;
    }

    if (
      !Number.isInteger(
        sortOrder
      ) ||
      sortOrder < 0
    ) {
      setError(
        "Sort Order must be 0 or greater."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      setBusyKey(
        `edit-${character.id}`
      );

      await authenticatedFetch(
        "/api/admin/characters",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "update_character",

              character_id:
                character.id,

              code,

              name,

              description:
                editForm
                  .description,

              version,

              sort_order:
                sortOrder,
            }),
        }
      );

      setEditingId(
        null
      );

      setSuccess(
        `${name} UPDATED`
      );

      await loadCharacters();
    } catch (
      editError
    ) {
      console.error(
        "EDIT CHARACTER ERROR:",
        editError
      );

      setError(
        editError instanceof
        Error
          ? editError.message
          : "Cannot update Character"
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey(
        ""
      );
    }
  }

  /* =======================================================
     PUBLISH / HIDE
  ======================================================= */

  async function toggleCharacter(
    character:
      CharacterModel
  ) {
    const willPublish =
      !character.is_active;

    setError("");
    setSuccess("");

    try {
      setSaving(
        true
      );

      setBusyKey(
        `status-${character.id}`
      );

      await authenticatedFetch(
        "/api/admin/characters",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "update_character",

              character_id:
                character.id,

              is_active:
                willPublish,
            }),
        }
      );

      setSuccess(
        willPublish
          ? `${character.name} PUBLISHED`
          : `${character.name} HIDDEN`
      );

      await loadCharacters();
    } catch (
      statusError
    ) {
      console.error(
        "CHARACTER STATUS ERROR:",
        statusError
      );

      setError(
        statusError instanceof
        Error
          ? statusError.message
          : "Cannot update Character status"
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey(
        ""
      );
    }
  }

  /* =======================================================
     SET DEFAULT
  ======================================================= */

  async function setDefaultCharacter(
    character:
      CharacterModel
  ) {
    if (
      character.is_default
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      setSaving(
        true
      );

      setBusyKey(
        `default-${character.id}`
      );

      await authenticatedFetch(
        "/api/admin/characters",
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              action:
                "set_default",

              character_id:
                character.id,
            }),
        }
      );

      setSuccess(
        `${character.name} IS NOW DEFAULT`
      );

      await loadCharacters();
    } catch (
      defaultError
    ) {
      console.error(
        "SET DEFAULT CHARACTER ERROR:",
        defaultError
      );

      setError(
        defaultError instanceof
        Error
          ? defaultError.message
          : "Cannot set Default Character"
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey(
        ""
      );
    }
  }

  /* =======================================================
     IMAGE UPLOAD
  ======================================================= */

  async function uploadCharacterImage(
    character:
      CharacterModel,
    file: File
  ) {
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

    setError("");
    setSuccess("");

    try {
      setSaving(
        true
      );

      setBusyKey(
        `image-${character.id}`
      );

      const {
        data,
        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

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
        "character_id",
        String(
          character.id
        )
      );

      const response =
        await fetch(
          "/api/admin/characters/upload-image",
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
            "Character image upload failed"
        );
      }

      setSuccess(
        `${character.name} PREVIEW IMAGE UPDATED`
      );

      await loadCharacters();
    } catch (
      uploadError
    ) {
      console.error(
        "CHARACTER IMAGE UPLOAD ERROR:",
        uploadError
      );

      setError(
        uploadError instanceof
        Error
          ? uploadError.message
          : "Cannot upload Character image"
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey(
        ""
      );
    }
  }

  /* =======================================================
     IMAGE INPUT
  ======================================================= */

  function handleImageChange(
    event:
      ChangeEvent<HTMLInputElement>,
    character:
      CharacterModel
  ) {
    const file =
      event.target
        .files?.[0] ??
      null;

    event.target.value =
      "";

    if (!file) {
      return;
    }

    void uploadCharacterImage(
      character,
      file
    );
  }

  /* =======================================================
     MODEL UPLOAD
  ======================================================= */

  async function uploadCharacterModel(
    character:
      CharacterModel,
    file: File
  ) {
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

      return;
    }

    setError("");
    setSuccess("");

    try {
      setSaving(
        true
      );

      setBusyKey(
        `model-${character.id}`
      );

      const {
        data,
        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

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

      /* ===================================================
         1. PREPARE SIGNED UPLOAD
      =================================================== */

      setSuccess(
        `PREPARING ${file.name} (${formatFileSize(
          file.size
        )})...`
      );

      const prepareResponse =
        await fetch(
          "/api/admin/characters/upload-model",
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
                character_id:
                  character.id,

                file_name:
                  file.name,

                file_size:
                  file.size,

                file_type:
                  file.type,
              }),
          }
        );

      const prepareResult =
        await prepareResponse
          .json();

      if (
        !prepareResponse.ok ||
        !prepareResult?.ok
      ) {
        throw new Error(
          prepareResult?.error ||
            "Cannot prepare Character GLB upload."
        );
      }

      const prepared =
        prepareResult.upload;

      if (
        !prepared?.bucket ||
        !prepared?.path ||
        !prepared?.token
      ) {
        throw new Error(
          "Signed upload data is incomplete."
        );
      }

      /* ===================================================
         2. BROWSER → SUPABASE DIRECT
      =================================================== */

      setSuccess(
        `UPLOADING ${file.name} (${formatFileSize(
          file.size
        )})...`
      );

      const {
        error:
          storageError,
      } =
        await supabase
          .storage
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
        storageError
      ) {
        throw new Error(
          storageError.message
        );
      }

      /* ===================================================
         3. FINALIZE
      =================================================== */

      setSuccess(
        "FINALIZING CHARACTER GLB..."
      );

      const finalizeResponse =
        await fetch(
          "/api/admin/characters/upload-model",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${data.session.access_token}`,
            },

            body:
              JSON.stringify({
                character_id:
                  character.id,

                model_path:
                  prepared.path,
              }),
          }
        );

      const finalizeResult =
        await finalizeResponse
          .json();

      if (
        !finalizeResponse.ok ||
        !finalizeResult?.ok
      ) {
        throw new Error(
          finalizeResult?.error ||
            "Cannot finalize Character GLB."
        );
      }

      setSuccess(
        `${character.name} GLB IMPORTED`
      );

      await loadCharacters();
    } catch (
      uploadError
    ) {
      console.error(
        "CHARACTER MODEL UPLOAD ERROR:",
        uploadError
      );

      setError(
        uploadError instanceof
        Error
          ? uploadError.message
          : "Cannot upload Character GLB"
      );

      setSuccess(
        ""
      );
    } finally {
      setSaving(
        false
      );

      setBusyKey(
        ""
      );
    }
  }

  /* =======================================================
     MODEL INPUT
  ======================================================= */

  function handleModelChange(
    event:
      ChangeEvent<HTMLInputElement>,
    character:
      CharacterModel
  ) {
    const file =
      event.target
        .files?.[0] ??
      null;

    event.target.value =
      "";

    if (!file) {
      return;
    }

    void uploadCharacterModel(
      character,
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
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-xs font-black tracking-[0.3em] text-cyan-400 animate-pulse">
              LOADING CHARACTER LIBRARY...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <>
      <main className="min-h-screen bg-black text-white">

        {/* =================================================
            BACKGROUND
        ================================================= */}

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-1/2 top-[-420px] h-[900px] w-[1200px] -translate-x-1/2 rounded-full bg-cyan-500/[0.06] blur-[190px]" />

          <div className="absolute bottom-[-500px] right-[-350px] h-[900px] w-[900px] rounded-full bg-purple-500/[0.07] blur-[200px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-8 sm:px-8">

          {/* =================================================
              HEADER
          ================================================= */}

          <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-[9px] font-black tracking-[0.35em] text-purple-400">
                LOOTFORM ADMIN SYSTEM
              </p>

              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                CHARACTER{" "}
                <span className="text-cyan-400">
                  LIBRARY
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
                Manage base Characters, preview artwork,
                GLB models, publishing and Default Character.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                href="/admin"
                className="rounded-xl border border-zinc-800 bg-black/60 px-5 py-3 text-xs font-black text-zinc-400 transition hover:border-cyan-400 hover:text-cyan-400"
              >
                ← ADMIN
              </Link>

              <button
                type="button"
                onClick={() => {
                  setShowCreate(
                    (current) =>
                      !current
                  );

                  setEditingId(
                    null
                  );

                  setError("");
                  setSuccess("");
                }}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black text-black transition hover:bg-cyan-300"
              >
                + NEW CHARACTER
              </button>

            </div>

          </header>

          {/* =================================================
              MESSAGES
          ================================================= */}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-5">
              <p className="text-xs font-black text-red-400">
                ERROR
              </p>

              <p className="mt-2 text-sm text-red-300">
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-2xl border border-lime-400/30 bg-lime-400/[0.05] p-5">
              <p className="text-xs font-black text-lime-400">
                ✓ {success}
              </p>
            </div>
          )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">

            <SummaryCard
              label="CHARACTERS"
              value={
                String(
                  characters.length
                )
              }
            />

            <SummaryCard
              label="ACTIVE"
              value={
                String(
                  characters.filter(
                    (character) =>
                      character.is_active
                  ).length
                )
              }
            />

            <SummaryCard
              label="3D READY"
              value={
                String(
                  characters.filter(
                    (character) =>
                      character.model_ready
                  ).length
                )
              }
            />

            <SummaryCard
              label="DEFAULT"
              value={
                characters.find(
                  (character) =>
                    character.is_default
                )?.code ??
                "NONE"
              }
            />

          </section>

          {/* =================================================
              CREATE CHARACTER
          ================================================= */}

          {showCreate && (
            <form
              onSubmit={
                createCharacter
              }
              className="mt-7 rounded-[28px] border border-cyan-400/25 bg-zinc-950/80 p-6 sm:p-8"
            >
              <div className="flex items-start justify-between gap-5">

                <div>
                  <p className="text-[9px] font-black tracking-[0.3em] text-cyan-400">
                    NEW CHARACTER
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    CREATE DRAFT
                  </h2>

                  <p className="mt-2 text-xs text-yellow-400">
                    New Characters start as DRAFT.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(
                      false
                    )
                  }
                  className="h-10 w-10 rounded-xl border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                >
                  ×
                </button>

              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">

                <div>
                  <label className="text-[9px] font-black text-zinc-500">
                    CHARACTER CODE
                  </label>

                  <input
                    value={
                      createForm.code
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,

                          code:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="LF-BASE-002"
                    className={`${INPUT_CLASS} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-zinc-500">
                    CHARACTER NAME
                  </label>

                  <input
                    value={
                      createForm.name
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,

                          name:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="LOOTFORM BASE CHARACTER 02"
                    className={`${INPUT_CLASS} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-zinc-500">
                    VERSION
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      createForm.version
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,

                          version:
                            event.target.value,
                        })
                      )
                    }
                    className={`${INPUT_CLASS} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-zinc-500">
                    SORT ORDER
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      createForm.sort_order
                    }
                    onChange={(event) =>
                      setCreateForm(
                        (current) => ({
                          ...current,

                          sort_order:
                            event.target.value,
                        })
                      )
                    }
                    className={`${INPUT_CLASS} mt-2`}
                  />
                </div>

              </div>

              <div className="mt-4">
                <label className="text-[9px] font-black text-zinc-500">
                  DESCRIPTION
                </label>

                <textarea
                  value={
                    createForm.description
                  }
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,

                        description:
                          event.target.value,
                      })
                    )
                  }
                  rows={4}
                  placeholder="Character description..."
                  className={`${INPUT_CLASS} mt-2 resize-none`}
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
                  "create"
                    ? "CREATING..."
                    : "CREATE DRAFT CHARACTER"}
                </button>

              </div>

            </form>
          )}

          {/* =================================================
              API STATUS
          ================================================= */}

          <div className="mt-7 rounded-2xl border border-lime-400/20 bg-lime-400/[0.03] p-5">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>
                <p className="text-xs font-black text-lime-400">
                  CHARACTER API CONNECTED
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  {characters.length} Character record(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadCharacters()
                }
                disabled={
                  saving
                }
                className="rounded-xl border border-zinc-800 px-4 py-2 text-[10px] font-black text-zinc-400 hover:border-cyan-400 hover:text-cyan-400"
              >
                REFRESH
              </button>

            </div>

          </div>

          {/* =================================================
              CHARACTER LIST
          ================================================= */}

          <section className="mt-5 space-y-5">

            {characters.length ===
            0 ? (
              <div className="rounded-[28px] border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center">

                <p className="text-sm font-black text-zinc-600">
                  NO CHARACTERS
                </p>

              </div>
            ) : (
              characters.map(
                (character) => {

                  const editing =
                    editingId ===
                    character.id;

                  return (
                    <article
                      key={
                        character.id
                      }
                      className={
                        character.is_default
                          ? "overflow-hidden rounded-[30px] border border-lime-400/30 bg-zinc-950/85 shadow-[0_0_80px_rgba(163,230,53,0.04)]"
                          : character.is_active
                          ? "overflow-hidden rounded-[30px] border border-cyan-400/20 bg-zinc-950/80"
                          : "overflow-hidden rounded-[30px] border border-yellow-400/20 bg-zinc-950/75"
                      }
                    >

                      {/* =====================================
                          CHARACTER HEADER
                      ===================================== */}

                      <div className="border-b border-zinc-900 p-6 sm:p-7">

                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <CharacterStatus
                                character={
                                  character
                                }
                              />

                              {character.model_ready ? (
                                <span className="rounded-full border border-purple-400/25 bg-purple-400/[0.06] px-3 py-1 text-[9px] font-black text-purple-400">
                                  3D READY
                                </span>
                              ) : (
                                <span className="rounded-full border border-zinc-700 px-3 py-1 text-[9px] font-black text-zinc-600">
                                  NO GLB
                                </span>
                              )}

                              {character.image_ready ? (
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-1 text-[9px] font-black text-cyan-400">
                                  IMAGE READY
                                </span>
                              ) : (
                                <span className="rounded-full border border-zinc-700 px-3 py-1 text-[9px] font-black text-zinc-600">
                                  NO IMAGE
                                </span>
                              )}

                            </div>

                            <h2 className="mt-4 text-2xl font-black sm:text-3xl">
                              {character.name}
                            </h2>

                            <div className="mt-3 flex flex-wrap gap-2">

                              <span className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-cyan-400">
                                {character.code}
                              </span>

                              <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">
                                VERSION {character.version}
                              </span>

                              <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">
                                SORT {character.sort_order}
                              </span>

                              <span className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500">
                                ID {character.id}
                              </span>

                            </div>

                            {character.description && (
                              <p className="mt-4 max-w-3xl text-xs leading-6 text-zinc-600">
                                {character.description}
                              </p>
                            )}

                          </div>

                          <div className="flex flex-wrap gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                startEdit(
                                  character
                                )
                              }
                              disabled={
                                saving
                              }
                              className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] px-4 py-3 text-[10px] font-black text-cyan-400 disabled:opacity-40"
                            >
                              EDIT
                            </button>

                            {character.model_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewModel({
                                    url:
                                      character.model_url as string,

                                    name:
                                      `${character.name} · V${character.version}`,
                                  })
                                }
                                className="rounded-xl border border-purple-400/25 bg-purple-400/[0.05] px-4 py-3 text-[10px] font-black text-purple-400"
                              >
                                VIEW 3D
                              </button>
                            )}

                            {!character.is_default && (
                              <button
                                type="button"
                                onClick={() =>
                                  void setDefaultCharacter(
                                    character
                                  )
                                }
                                disabled={
                                  saving ||
                                  !character.model_ready
                                }
                                className="rounded-xl border border-lime-400/25 bg-lime-400/[0.05] px-4 py-3 text-[10px] font-black text-lime-400 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {busyKey ===
                                `default-${character.id}`
                                  ? "SETTING..."
                                  : "SET DEFAULT"}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                void toggleCharacter(
                                  character
                                )
                              }
                              disabled={
                                saving ||
                                character.is_default
                              }
                              className={
                                character.is_active
                                  ? "rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3 text-[10px] font-black text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                                  : "rounded-xl border border-lime-400/20 bg-lime-400/[0.04] px-4 py-3 text-[10px] font-black text-lime-400 disabled:cursor-not-allowed disabled:opacity-30"
                              }
                            >
                              {busyKey ===
                              `status-${character.id}`
                                ? "SAVING..."
                                : character.is_active
                                ? character.is_default
                                  ? "DEFAULT LOCKED"
                                  : "HIDE"
                                : "PUBLISH"}
                            </button>

                          </div>

                        </div>

                      </div>

                      {/* =====================================
                          EDIT FORM
                      ===================================== */}

                      {editing && (
                        <form
                          onSubmit={(event) =>
                            saveEdit(
                              event,
                              character
                            )
                          }
                          className="border-b border-zinc-900 bg-cyan-400/[0.025] p-6 sm:p-7"
                        >

                          <div className="flex items-center justify-between gap-4">

                            <div>
                              <p className="text-[9px] font-black tracking-[0.25em] text-cyan-400">
                                EDIT CHARACTER
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                Character metadata
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(
                                  null
                                )
                              }
                              className="h-9 w-9 rounded-xl border border-zinc-800 text-zinc-500"
                            >
                              ×
                            </button>

                          </div>

                          <div className="mt-5 grid gap-4 lg:grid-cols-2">

                            <input
                              value={
                                editForm.code
                              }
                              onChange={(event) =>
                                setEditForm(
                                  (current) => ({
                                    ...current,

                                    code:
                                      event.target.value,
                                  })
                                )
                              }
                              placeholder="CHARACTER CODE"
                              className={
                                INPUT_CLASS
                              }
                            />

                            <input
                              value={
                                editForm.name
                              }
                              onChange={(event) =>
                                setEditForm(
                                  (current) => ({
                                    ...current,

                                    name:
                                      event.target.value,
                                  })
                                )
                              }
                              placeholder="CHARACTER NAME"
                              className={
                                INPUT_CLASS
                              }
                            />

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                editForm.version
                              }
                              onChange={(event) =>
                                setEditForm(
                                  (current) => ({
                                    ...current,

                                    version:
                                      event.target.value,
                                  })
                                )
                              }
                              className={
                                INPUT_CLASS
                              }
                            />

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={
                                editForm.sort_order
                              }
                              onChange={(event) =>
                                setEditForm(
                                  (current) => ({
                                    ...current,

                                    sort_order:
                                      event.target.value,
                                  })
                                )
                              }
                              className={
                                INPUT_CLASS
                              }
                            />

                          </div>

                          <textarea
                            value={
                              editForm.description
                            }
                            onChange={(event) =>
                              setEditForm(
                                (current) => ({
                                  ...current,

                                  description:
                                    event.target.value,
                                })
                              )
                            }
                            rows={3}
                            placeholder="DESCRIPTION"
                            className={`${INPUT_CLASS} mt-4 resize-none`}
                          />

                          <div className="mt-5 flex justify-end">

                            <button
                              type="submit"
                              disabled={
                                saving
                              }
                              className="rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black text-black disabled:opacity-50"
                            >
                              {busyKey ===
                              `edit-${character.id}`
                                ? "SAVING..."
                                : "SAVE CHARACTER"}
                            </button>

                          </div>

                        </form>
                      )}

                      {/* =====================================
                          ASSETS
                      ===================================== */}

                      <div className="grid gap-5 p-6 sm:p-7 xl:grid-cols-2">

                        {/* ===================================
                            PREVIEW IMAGE
                        =================================== */}

                        <section className="rounded-2xl border border-zinc-800 bg-black/50 p-5">

                          <div className="flex items-start justify-between gap-4">

                            <div>
                              <p className="text-[9px] font-black tracking-[0.2em] text-cyan-400">
                                CHARACTER PREVIEW
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                JPEG / PNG / WEBP · MAX 5 MB
                              </p>
                            </div>

                            <span
                              className={
                                character.image_ready
                                  ? "text-[9px] font-black text-lime-400"
                                  : "text-[9px] font-black text-zinc-600"
                              }
                            >
                              {character.image_ready
                                ? "READY"
                                : "NOT SET"}
                            </span>

                          </div>

                          <div className="mt-5 flex h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950">

                            {character.thumbnail_url ? (
                              <img
                                src={
                                  character.thumbnail_url
                                }
                                alt={
                                  character.name
                                }
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="text-center">

                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-zinc-800 text-3xl text-zinc-800">
                                  ◇
                                </div>

                                <p className="mt-4 text-[10px] font-black tracking-[0.2em] text-zinc-700">
                                  NO PREVIEW IMAGE
                                </p>

                              </div>
                            )}

                          </div>

                          <label
                            className={
                              saving
                                ? "mt-4 block cursor-not-allowed rounded-xl border border-zinc-800 px-4 py-3 text-center text-[10px] font-black text-zinc-700"
                                : "mt-4 block cursor-pointer rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] px-4 py-3 text-center text-[10px] font-black text-cyan-400 transition hover:border-cyan-400"
                            }
                          >
                            {busyKey ===
                            `image-${character.id}`
                              ? "UPLOADING IMAGE..."
                              : character.image_ready
                              ? "CHANGE PREVIEW IMAGE"
                              : "UPLOAD PREVIEW IMAGE"}

                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={
                                saving
                              }
                              onChange={(event) =>
                                handleImageChange(
                                  event,
                                  character
                                )
                              }
                              className="hidden"
                            />
                          </label>

                        </section>

                        {/* ===================================
                            GLB MODEL
                        =================================== */}

                        <section className="rounded-2xl border border-zinc-800 bg-black/50 p-5">

                          <div className="flex items-start justify-between gap-4">

                            <div>
                              <p className="text-[9px] font-black tracking-[0.2em] text-purple-400">
                                CHARACTER 3D MODEL
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">
                                GLB · MAX 100 MB
                              </p>
                            </div>

                            <span
                              className={
                                character.model_ready
                                  ? "text-[9px] font-black text-lime-400"
                                  : "text-[9px] font-black text-zinc-600"
                              }
                            >
                              {character.model_ready
                                ? "3D READY"
                                : "NOT SET"}
                            </span>

                          </div>

                          <div className="mt-5 flex h-[360px] items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-950 p-6">

                            {character.model_ready ? (
                              <div className="w-full text-center">

                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-purple-400/25 bg-purple-400/[0.05] text-4xl text-purple-400">
                                  3D
                                </div>

                                <p className="mt-5 text-lg font-black text-white">
                                  MODEL READY
                                </p>

                                <p className="mt-2 break-all text-[10px] leading-5 text-zinc-600">
                                  {character.model_path ??
                                    character.model_url}
                                </p>

                                {character.model_url && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewModel({
                                        url:
                                          character.model_url as string,

                                        name:
                                          `${character.name} · V${character.version}`,
                                      })
                                    }
                                    className="mt-5 rounded-xl border border-purple-400/25 bg-purple-400/[0.05] px-5 py-3 text-[10px] font-black text-purple-400 hover:border-purple-400"
                                  >
                                    VIEW 3D MODEL
                                  </button>
                                )}

                              </div>
                            ) : (
                              <div className="text-center">

                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-zinc-800 text-3xl text-zinc-800">
                                  3D
                                </div>

                                <p className="mt-5 text-[10px] font-black tracking-[0.2em] text-zinc-700">
                                  NO GLB IMPORTED
                                </p>

                                <p className="mt-2 text-xs text-zinc-700">
                                  Character cannot be published until a GLB is ready.
                                </p>

                              </div>
                            )}

                          </div>

                          <label
                            className={
                              saving
                                ? "mt-4 block cursor-not-allowed rounded-xl border border-zinc-800 px-4 py-3 text-center text-[10px] font-black text-zinc-700"
                                : "mt-4 block cursor-pointer rounded-xl border border-purple-400/25 bg-purple-400/[0.04] px-4 py-3 text-center text-[10px] font-black text-purple-400 transition hover:border-purple-400"
                            }
                          >
                            {busyKey ===
                            `model-${character.id}`
                              ? "IMPORTING GLB..."
                              : character.model_ready
                              ? "CHANGE CHARACTER GLB"
                              : "IMPORT CHARACTER GLB"}

                            <input
                              type="file"
                              accept=".glb,model/gltf-binary,application/octet-stream"
                              disabled={
                                saving
                              }
                              onChange={(event) =>
                                handleModelChange(
                                  event,
                                  character
                                )
                              }
                              className="hidden"
                            />
                          </label>

                        </section>

                      </div>

                      {/* =====================================
                          RULES FOOTER
                      ===================================== */}

                      <div className="border-t border-zinc-900 bg-black/30 px-6 py-5 sm:px-7">

                        {character.is_default ? (
                          <p className="text-xs font-bold text-lime-400">
                            DEFAULT CHARACTER · Cannot be hidden until another Character becomes Default.
                          </p>
                        ) : !character.model_ready ? (
                          <p className="text-xs font-bold text-yellow-400">
                            GLB REQUIRED · Import a Character GLB before Publish or Set Default.
                          </p>
                        ) : character.is_active ? (
                          <p className="text-xs font-bold text-cyan-400">
                            ACTIVE CHARACTER · Available for future Player Character assignment.
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-yellow-400">
                            DRAFT CHARACTER · Ready for Admin review before Publish.
                          </p>
                        )}

                      </div>

                    </article>
                  );
                }
              )
            )}

          </section>

        </div>

      </main>

      {/* ===================================================
          3D PREVIEW MODAL
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

/* =========================================================
   CHARACTER STATUS
========================================================= */

function CharacterStatus({
  character,
}: {
  character:
    CharacterModel;
}) {
  if (
    character.is_default
  ) {
    return (
      <span className="rounded-full border border-lime-400/30 bg-lime-400/[0.07] px-3 py-1 text-[9px] font-black text-lime-400">
        ★ DEFAULT
      </span>
    );
  }

  if (
    character.is_active
  ) {
    return (
      <span className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.05] px-3 py-1 text-[9px] font-black text-cyan-400">
        ACTIVE
      </span>
    );
  }

  return (
    <span className="rounded-full border border-yellow-400/25 bg-yellow-400/[0.05] px-3 py-1 text-[9px] font-black text-yellow-400">
      DRAFT
    </span>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">

      <p className="text-[8px] font-black tracking-[0.2em] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 truncate text-xl font-black text-white sm:text-2xl">
        {value}
      </p>

    </div>
  );
}