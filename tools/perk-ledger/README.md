# Perk Ledger

A tracker for the credits on four cards: Chase Sapphire Reserve, Amex Platinum, United Club Infinite and Capital One Venture.

- `perk-ledger.html` is the source published as a claude.ai Artifact. There, usage is saved to the artifact's database.
- `index.html` is the same page wrapped in a full HTML document. Open it in any browser. Usage is saved in that browser's localStorage.

The benefit catalog is the `BENEFITS` array near the top of the script. Amounts marked `verify: true` are the most likely to differ from your card's current terms. You can also change amounts, hide credits, set a card's anniversary month and add custom credits from the page's **Edit** panel.

To rebuild `index.html` after editing the source:

```sh
(printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n'; cat perk-ledger.html; printf '\n</body></html>\n') > index.html
```
