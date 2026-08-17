"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadItems() {
      const { data, error } = await supabase
        .from("items")
        .select("*");

      if (error) {
        setError(error.message);
        return;
      }

      setItems(data ?? []);
    }

    loadItems();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold">Supabase Test</h1>

      {error && (
        <p className="text-red-400 mt-4">
          {error}
        </p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className="mt-4 border border-zinc-700 p-4 rounded-xl"
        >
          <p>{item.serial}</p>
          <p>{item.product}</p>
          <p>{item.grade}</p>
          <p>LVL {item.level}</p>
          <p>SIZE {item.size}</p>
        </div>
      ))}
    </main>
  );
}