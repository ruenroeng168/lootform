"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase";

type ApiResult = {
  status: number | null;
  data: unknown;
  error: string;
};

export default function EquipmentTestPage() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    getResult,
    setGetResult,
  ] =
    useState<ApiResult>({
      status: null,
      data: null,
      error: "",
    });

  const [
    postResult,
    setPostResult,
  ] =
    useState<ApiResult>({
      status: null,
      data: null,
      error: "",
    });

  const [
    testingPost,
    setTestingPost,
  ] =
    useState(false);

  async function getSessionToken() {
    const {
      data: {
        session,
      },
      error,
    } =
      await supabase
        .auth
        .getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      throw new Error(
        "NO ACTIVE SESSION"
      );
    }

    return session.access_token;
  }

  async function loadEquipment() {
    setLoading(true);

    try {
      const token =
        await getSessionToken();

      const response =
        await fetch(
          "/api/profile/equipment",
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

      const data =
        await response.json();

      setGetResult({
        status:
          response.status,

        data,

        error:
          "",
      });
    } catch (
      error
    ) {
      setGetResult({
        status:
          null,

        data:
          null,

        error:
          error instanceof
          Error
            ? error.message
            : "UNKNOWN ERROR",
      });
    } finally {
      setLoading(false);
    }
  }

  async function testEquip() {
    if (
      testingPost
    ) {
      return;
    }

    setTestingPost(true);

    setPostResult({
      status:
        null,

      data:
        null,

      error:
        "",
    });

    try {
      const token =
        await getSessionToken();

      const response =
        await fetch(
          "/api/profile/equipment",
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
                item_id:
                  160,
              }),
          }
        );

      const data =
        await response.json();

      setPostResult({
        status:
          response.status,

        data,

        error:
          "",
      });

      if (
        response.ok
      ) {
        await loadEquipment();
      }
    } catch (
      error
    ) {
      setPostResult({
        status:
          null,

        data:
          null,

        error:
          error instanceof
          Error
            ? error.message
            : "UNKNOWN ERROR",
      });
    } finally {
      setTestingPost(false);
    }
  }

  useEffect(() => {
    void loadEquipment();
  }, []);

  return (
    <main className="min-h-screen bg-black p-8 text-white">

      <div className="mx-auto max-w-5xl">

        <p className="text-xs tracking-[0.3em] text-cyan-400">
          LOOTFORM EQUIPMENT API TEST
        </p>

        <h1 className="mt-3 text-3xl font-black">
          STEP 11B TEST
        </h1>

        {/* GET TEST */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-xs text-zinc-500">
                TEST 1
              </p>

              <h2 className="mt-1 text-xl font-black">
                GET EQUIPMENT
              </h2>

            </div>

            <p className="text-2xl font-black text-lime-400">
              {loading
                ? "..."
                : getResult.status ??
                  "-"}
            </p>

          </div>

          {getResult.error && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-400">
              {getResult.error}
            </div>
          )}

          <pre className="mt-4 max-h-[350px] overflow-auto rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">
            {JSON.stringify(
              getResult.data,
              null,
              2
            )}
          </pre>

        </section>

        {/* POST TEST */}

        <section className="mt-5 rounded-2xl border border-orange-400/20 bg-zinc-950 p-6">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <p className="text-xs text-orange-400">
                TEST 2
              </p>

              <h2 className="mt-1 text-xl font-black">
                POST EQUIP ITEM
              </h2>

              <p className="mt-2 text-xs text-zinc-500">
                Test Item: LF-S01-0160 / Item ID 160
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                void testEquip()
              }
              disabled={
                testingPost
              }
              className="rounded-xl bg-lime-400 px-6 py-3 text-xs font-black text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testingPost
                ? "TESTING..."
                : "TEST EQUIP"}
            </button>

          </div>

          {postResult.status !==
            null && (
            <div className="mt-5">

              <p className="text-xs text-zinc-500">
                HTTP STATUS
              </p>

              <p
                className={`mt-1 text-2xl font-black ${
                  postResult.status ===
                  200
                    ? "text-lime-400"
                    : "text-red-400"
                }`}
              >
                {postResult.status}
              </p>

            </div>
          )}

          {postResult.error && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-400">
              {postResult.error}
            </div>
          )}

          {postResult.data !==
            null && (
            <pre className="mt-4 max-h-[350px] overflow-auto rounded-xl border border-zinc-800 bg-black p-4 text-xs leading-6 text-zinc-300">
              {JSON.stringify(
                postResult.data,
                null,
                2
              )}
            </pre>
          )}

        </section>

      </div>

    </main>
  );
}