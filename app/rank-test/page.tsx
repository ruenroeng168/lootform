"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RankResult = {
  ok?: boolean;
  rank?: {
    collection_score: number;
    global_rank: number;
    total_players: number;
    total_items: number;
    common_items: number;
    rare_items: number;
    epic_items: number;
    legendary_items: number;
  };
  player?: {
    user_id: string;
  };
  code?: string;
  error?: string;
};

export default function RankTestPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<RankResult | null>(null);

  useEffect(() => {
    async function testRankApi() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          setResult({
            ok: false,
            error: "No active login session.",
          });

          return;
        }

        const response = await fetch("/api/profile/rank", {
          method: "GET",

          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },

          cache: "no-store",
        });

        const data = (await response.json()) as RankResult;

        setStatus(response.status);
        setResult(data);
      } catch (error) {
        setResult({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        });
      } finally {
        setLoading(false);
      }
    }

    void testRankApi();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-black tracking-[0.3em] text-cyan-400">
          LOOTFORM DEBUG
        </p>

        <h1 className="mt-3 text-3xl font-black">
          COLLECTION RANK API TEST
        </h1>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="animate-pulse font-black text-cyan-400">
              TESTING...
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <p className="text-xs text-zinc-500">HTTP STATUS</p>

              <p
                className={`mt-2 text-2xl font-black ${
                  status === 200 ? "text-lime-400" : "text-red-400"
                }`}
              >
                {status ?? "-"}
              </p>
            </div>

            <pre className="mt-4 overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm leading-7 text-zinc-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </>
        )}
      </div>
    </main>
  );
}