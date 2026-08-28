export const WALLET_BALANCE_UPDATED_EVENT = "lootform:wallet-balance-updated";

/*
  Navbar shows its own copy of the wallet balance, fetched once per
  pathname change (see components/Navbar.tsx). A same-page balance
  change -- Craft, Top-up -- never triggers that re-fetch, so the nav
  pill went stale until a full page reload. Call this right after a
  page updates its own local wallet balance from a server response so
  Navbar can mirror it immediately.
*/
export function broadcastWalletBalanceUpdated(
  balance: number
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WALLET_BALANCE_UPDATED_EVENT, {
      detail: { balance },
    })
  );
}
