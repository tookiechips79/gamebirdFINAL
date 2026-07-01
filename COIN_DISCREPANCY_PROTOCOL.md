# Coin Discrepancy Protocol

Use this when a player reports they didn't get paid, got shorted, or their balance looks wrong.

## 1. Get the basics from the player
- Which game number (or approx time)?
- Which team did they bet on, and how much?

## 2. Check GAME BAL tab (Coin Audit → Game Balances)
Sourced from `gameHistory`, same data as the Whitebook.
- Find the game number, expand it.
- Look for their name in the player list — confirms whether their bet was actually **booked** (matched). If they don't appear at all, their bet was likely unmatched and refunded, not "lost."
- Check their row: `bal before`, `bal after`, `WON`/`LOST` tag, and the `bal before:` line under their bet — this is the ground truth of what the system recorded.

## 3. Check PLAYERS tab (Coin Audit → Players)
Sourced from `playerSnaps` — captures ALL users, matched or not.
- Find the same game number, expand it.
- Find the player — shows `before`, `after`, `NET` for that game specifically.
- If `NET` is 0 but they expected a win: either their bet was unmatched (refunded, no win/loss) or the payout never landed.
- If `NET` matches what they expected, the system paid correctly and the player is mistaken/misremembering.

## 4. Check DRIFT tab (Coin Audit → Drift)
- Find the game — `✓ CLEAN` means total coins in = total coins out for that game (nothing vanished from the system overall, though it doesn't by itself prove the right person got paid).
- If it shows `⚠ drift`, expand it — players with nonzero `NET` are highlighted red, pointing straight at whoever the money actually went to (or didn't come from).

## 5. Check ACTIVITY tab (Coin Audit → Activity)
- Look for a `P2P TRANSFER` or `ADMIN ADD/DEDUCT` entry near that timestamp — rules out (or confirms) a manual/admin adjustment touched their balance around the same time.

## 6. Cross-check the player's own TXN tab
Ask them to open Wallet → TXN and find the entry for that game.
- A `bet_placed` → `bet_win`/`bet_loss` pair should exist with matching amounts and timestamps.
- If `bet_placed` exists but there's no matching win/loss entry, that's a real gap — the bet never got settled, and that's your answer.

## Fastest path
GAME BAL tab first (confirms booked/unmatched + win/loss) → PLAYERS tab NET for that game (confirms actual coin movement) → DRIFT tab (confirms system-wide integrity). Three lookups, same game number, and you'll know definitively whether they were shorted or mistaken.
