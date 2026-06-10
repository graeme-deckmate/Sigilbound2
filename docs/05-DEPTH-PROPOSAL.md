# 05 - DEPTH PROPOSAL (v1.1)

**Status: ACCEPTED 2026-06-10. Folded into docs 00/02/03/04. This file is now a design rationale record; where it disagrees with 02/03, those win.**

Written 2026-06-10 after a full v1.0 review plus a read of the Glyphwright design docs (`~/Documents/AI_STUFF/Glyphwright`).

## Decision log (Grae, 2026-06-10)

1. Starter trio Ember/Rime/Thorn confirmed. No 6th element (Claude ruling, accepted): the Wheel is a 5-cycle aligned to unlock order and twins already expand element identity to 15; a 6th costs far more than it adds.
2. Wheel reactions consume the status they cash in. Reaction table in section 3 (2A) approved as penned. (Interpretation of "remove the 2 old statuses" logged in PROGRESS; correct there if misread.)
3. Potency is locked at inscribe time.
4. Twin elements are IN v1.1 scope (Phase 14).
5. Level cap stays 12.
6. Essence drop on defeat: in.
7. Scrolls: cap 3 held, confirmed after explanation.
8. Summon form: in, ships with Act 4 (Phase 14), unlocked early in the Sunken Sanctum.
9. Mastery gains per battle won (anti-farm).
10. 00-BRIEF rewritten for v1.1 in the same session as the spec fold-in. Done.

---

## 1. Diagnosis

Three separate problems are tangled together. They need different fixes.

### 1.1 The first two level-ups are RNG-hard

This is a measurable agency problem, not a tuning problem.

- At Lv 1 the player has one element (Ember), two forms, no runes, and 22 MP. That funds **3 Emberbolts** before a forced Focus.
- Pondscale **resists Ember** (x0.6). The only counter unlocks at Lv 2. Until then a pondscale takes 4+ bolts, which is more than the MP pool.
- `[gloop,gloop]` deals roughly 14 damage per round into a 46 HP pool. Killing both takes 4+ rounds. That is most of the player's HP decided almost entirely by the 0.9-1.1 variance roll and the 8% crit roll.
- Net: at Lv 1-2 there are **no meaningful decisions to make**, so variance is the only author of the outcome. It feels random because it is.

### 1.2 Everything after Lv 4 is easy

- Player damage scales **multiplicatively**: level scaling (x3.42 across the game) x form x rune x 1.6 weakness. Enemy HP scales linearly.
- The Phase 6/7 tuning logs cut enemy attack growth hard to protect baseline players (correctly, per the sim floors). The side effect: an optimal player never feels pressure again after Volt unlocks.
- The balance sim only asserts **floors** (baseline >= 70%, weakness-aware >= 95%). There is no ceiling. The critical path is, by design, unloseable for a player like Grae.

### 1.3 The game is shallow once solved

- 5x5x6 = 150 combos, but they collapse into about 6 archetypes (weakness bolt/lance, Fury lance, Thirst nova, a veil, a Keen lance). Once found, the Grimoire never needs reopening except at unlock toasts.
- Statuses never interact with each other or with follow-up casts. There is no sequencing, so there is no plan deeper than "cast the weakness."
- Runes are mostly flat multipliers, which is stat choice, not build identity.
- There is nothing optional: no hidden content beyond 4 shrines, no reason to detour, no post-game but free roam.

**Design conclusion:** keep the critical path winnable for new players (the sim floors are right). Add agency at the bottom, a ceiling at the top via *optional* content, and decision depth in the middle. Do not fix 45-minute dev runs by inflating numbers.

---

## 2. What Glyphwright offers Sigilbound

Glyphwright's docs (design doc, spell-system spec, mobile mechanics spec, plus the Runecast reference folder) are built on one thesis: **authorship is the reward, and cost is a conversation**. Most of its mechanics translate cleanly into Sigilbound's turn-based instanced frame.

| Glyphwright mechanic | Sigilbound translation | Verdict |
|---|---|---|
| Sequenced casting (Noita-style strips) | **Status reactions**: setup one turn, detonate the next | Adopt. This is the depth core. |
| Dual schools + antipode/cohesion costs (Runecast pairs doc) | **Twin-element inscription**, 10 hybrids, MP surcharge | Adopt, late-game gated |
| Tunable knobs, live cost ledger | **Potency setting** per inscription (Faint/Standard/Greedy) | Adopt |
| Relic glyphs that bend one formula rule | **Relic runes**, hidden, one per region | Adopt |
| Soft gating by spell *shape*, never specific spells | **Element gates** in the overworld with cache rewards | Adopt |
| Warden enemy class (armored, combo-keyed) | **Sealed enemies**: armor that only a reaction or anti-element cracks | Adopt |
| 3-phase shape-vulnerable boss (mobile spec M10) | Post-game **superboss** with 3 bars, each demanding a different spell shape | Adopt |
| Umbra chaos table (Runecast reference) | **Wyrd rune**: power boost + a seeded chaos roll | Adopt, small |
| Naming as ownership, grimoire as character sheet | Optional spell rename + cast counts + page flavor | Adopt, cheap |
| Apprentice quests (write me a spell) | **Spell commissions** from NPCs | Adopt |
| Essence/inkwell scarcity economy | Conflicts with "no economy" in 00-BRIEF | Skip |
| Cast-failure chance (60% floor) | Feels terrible in turn-based; punishes without teaching | Skip |
| Real-time deliveries (Beam, Linger, Ward) | No real-time layer exists | Skip |
| Free-form magnitude/duration sliders | Mobile UI friction; discrete Potency tiers instead | Adapt |

---

## 3. The proposal, in three tiers

Tiers are independently shippable. Tier 1 is the fix; Tiers 2-3 are the game getting deeper.

### TIER 1: Fix the curve, add variance (no new systems)

**1A. Starter element choice.** The Elder offers Ember, Rime, or Thorn with the Grimoire ("The first page answers to you. What does it ask for?"). Fixes the Lv 1-2 single-element trap (each starter is resisted by a different Act 1 enemy, so the trap becomes a teach), and adds real replay variance for free. Unlock schedule backfills the unpicked starters at Lv 2 and Lv 6.

**1B. Early smoothing.** Pick from (sim decides final values):

- Lv 1 MP 22 -> 26, or Wisp cost 3 -> 2 (the panic button gets cheaper, not stronger)
- Meadow zone rolls no 2-enemy packs until player Lv 2 (formation tables already support weighting; add a level gate)
- XP curve reshaped: cheaper Lv 2-3, pricier Lv 9-11, so the early "stuck" window shortens and the late game stops outleveling itself

**1C. Elite variants ("aspected" enemies).** Roughly 10% of rolls after Act 1 promote one enemy: a prefix, one affix, double XP. Examples: **Veiled** (starts shielded 20), **Frenzied** (+40% damage below half HP), **Mirrorhide** (reflects its own element back as a player status), **Fleet** (acts twice at x0.6 damage). Five affixes cover the roster. Adds midgame threat and variance without touching base tuning.

**1D. Rare encounter rolls.** ~4% of encounters are special: an ambush (enemies act first), a wandering elite pack, or a "glimmer" (a fleeing bonus-XP creature). Small table, big texture.

### TIER 2: Decision depth (the Glyphwright core)

**2A. Status reactions: the Vale's Wheel.** The one-sentence rule, in unlock order:

> **Each element cashes in the status before it.** Ember -> Rime -> Volt -> Thorn -> Gloom -> Ember.

| Status on enemy | Reacting element | Reaction | Effect (deterministic, consumes the status) |
|---|---|---|---|
| Burning (Ember) | Rime hit | **Scald** | Instant damage equal to 2 burn ticks |
| Chilled (Rime) | Volt hit | **Shatter** | That hit deals +60% |
| Stunned (Volt) | Thorn hit | **Snare** | Envenomed applied at 100%, +1 turn duration |
| Envenomed (Thorn) | Gloom hit | **Blight** | All remaining venom ticks deal immediately |
| Withered (Gloom) | Ember hit | **Kindle** | That hit +40% and Burning applied at 100% |

This is Glyphwright's sequenced mode translated to turn-based: a real two-turn plan, taught by one gossiping Twin and one log line ("The frost SHATTERS!"). Reactions are deterministic (no proc roll) so they are a plan, not a prayer. The choice is real: cash in a status or keep its passive value. Sim policies gain a "reaction-aware" tier, and the optimal-play ceiling finally has something to measure.

**2B. Potency setting.** At inscribe time each spell picks Faint (x0.7 power, x0.6 MP), Standard, or Greedy (x1.5 power, x2.0 MP). Shown as a third stat line in the existing Grimoire preview (the cost conversation, Glyphwright pillar 3). Late game MP pools currently make everything affordable; Greedy re-tightens the economy by choice, Faint makes sustain builds real.

**2C. Relic runes.** One hidden per region, occupying the rune slot (a real trade against Fury/Keen). Each bends exactly one formula rule, Glyphwright-style:

- **Emberglass** (Hearthvale): resists count as neutral for this spell
- **Stillwater** (Westwood): variance floor becomes 1.0 (no low rolls)
- **Stormcoil** (Ashen Reach): Echo's second hit at full power
- **Hollowlight** (North Hollow): kill with this spell, refund its MP

Found via element gates (2E), not shrines. Rarity moment Glyphwright calls the "Black Hole card."

**2D. Sealed enemies.** A late-Act-2/Act-3 enemy trait: a sigil-seal (shield that ignores damage) that only breaks to a **reaction** or to the seal's stated anti-element. The log states the key ("The seal drinks the light. Frost, then storm."). This is Glyphwright's Warden enemy class, and it makes the Wheel mandatory somewhere safe before the superboss demands it.

**2E. Element gates + caches.** Overworld obstacles keyed to spell *shape*, never a specific spell: withered briars (any Ember), a frozen spring crossing (any Rime), a dead rune-circuit (any Volt), a barren trellis (any Thorn), a lightless hollow (any Gloom). Each gate hides a cache: relic runes, charms (3B), lore, a commission NPC. Re-uses all five existing maps; "small world, dense secrets" finally pays off. Plain-text requirement at the gate, multiple valid spells, per Glyphwright's soft-gating rule.

**2F. Spell commissions.** Three or four NPCs ask for a spell by composition ("My nets freeze stiff. Write me something warm that wears a shield."). Talking to them with a matching spell inscribed completes it. Rewards: a charm, a relic hint, a unique log title for the spell. Authorship made social, Glyphwright pillar 1, near-zero new machinery (dialogue + a spell predicate).

**2G. Naming and the grimoire page.** Optional rename on inscribe (keep the generated name as the subtitle), per-spell cast count, and the ending stats screen names your most-cast spell. "I made this" for one day of work.

### TIER 3: Content and ceiling (optional, post-curve)

**3A. Act 4 seed: the Hollow Warden.** The lore already plants it (Dreamer: "the Wraith was a Warden once. The fourth one."). After the Wraith falls, a sunken trial opens off North Hollow: 3 sealed trial fights (each demanding a different Wheel reaction), then the **Warden of Hollows** superboss using the Glyphwright M10 pattern: three HP bars, each vulnerable only to a different spell shape (area / single-target burst / a completed reaction). No sim floor applies; this is the optional ceiling. Target: a Lv 12 optimal player wins ~40-60%.

**3B. Charms.** Already stretch item 4. Two passive slots, found only in caches and commissions: e.g. statuses last +1 turn, Focus cleanses all, battles start with a 10-point shield, +1 regen per 4 steps, reactions +20%. Build identity for the slot players who do not want to re-craft.

**3C. Twin-element inscription.** Unlocked by the Act 4 trial (or NG+): a spell may carry two elements for a stacked MP surcharge (x1.6) and a thinner matchup peak (best element counts at x1.3, not x1.6). Each of the 10 pairs gets one bespoke rider in the Runecast dual-element spirit, e.g. Ember+Rime applies both statuses at half proc, Volt+Gloom's stun also Withers, Thorn+Rime's DoT ignores resist. Element choice goes from 5 to 15 and the Grimoire reopens for everyone. Biggest single depth add, also the biggest balance risk, hence last.

**3D. NG+.** Already stretch item 3: carry the grimoire, +50% enemy stats. Add: elites common (25%), all zones can roll attuned modifiers (one element weakened vale-wide for the run), charms carried. Cheap once 1C exists.

**3E. Bestiary.** Stretch item 2, unchanged. Records discovered weaknesses AND discovered reactions, which makes it a combo journal.

**Explicitly not proposed:** real-time anything, retuning the critical-path floors downward. The other v1.0 exclusions (economy, sliders, cast-failure, items, weather, sharing) are reassessed in section 7 with the brief's guardrails lifted.

---

## 4. Effort and order

| Item | Depth gain | Effort | Risk |
|---|---|---|---|
| 1A starter choice | High | S | Low (matchup audit needed) |
| 1B early smoothing | High (feel) | S | Low |
| 1C/1D elites + rare rolls | Med | M | Low |
| 2A Vale's Wheel | **Very high** | M | Med (sim policies must learn it) |
| 2B potency | Med | S | Low |
| 2C relic runes | Med | S-M | Low |
| 2D sealed enemies | Med | S | Low (needs 2A) |
| 2E gates + caches | High (exploration) | M | Low |
| 2F commissions | Med | S | Low |
| 2G naming | Low-Med | S | None |
| 3A Hollow Warden | High (ceiling) | L | Med |
| 3B charms | Med | M | Low |
| 3C twin elements | Very high | L | **High** (balance) |
| 3D NG+ | Med | S (after 1C) | Low |
| 3E bestiary | Low-Med | M | Low |

**Recommended phase cut** (pending your kill list):

- **Phase 11**: Tier 1 complete + 2B + 2G. The curve is fixed, variance exists, sim re-passes with new assertions (including a first optimal-play ceiling metric).
- **Phase 12**: 2A + 2D. The Wheel ships with sealed enemies to teach it. Sim gains the reaction-aware policy.
- **Phase 13**: 2C + 2E + 2F. The discovery layer: gates, caches, relics, commissions.
- **Phase 14**: 3A + 3B. Post-game ceiling and charms.
- **Phase 15**: 3C + 3D + 3E. Twins, NG+, bestiary.

Estimated new-player playtime after Phases 11-14: 4 to 5 hours plus a reason to replay. Dev-optimal time stops being the relevant metric once the superboss and NG+ hold the ceiling.

---

## 5. Balance guardrails (carried over and extended)

- Tune data, never formulas, except where this proposal explicitly amends a formula (reactions, potency, twins), and each amendment lands with worked examples in 03 plus exact-value tests, Glyphwright-style ("implement byte-for-byte").
- The sim keeps its floors. New ceiling assertions live only on optional content.
- Reactions are deterministic. Variance lives in encounters and elites, not in whether your plan works.
- Never nerf a build players found; tune the constant that made it dominant (Glyphwright section 11, anti-fragile balance).
- No em dashes in any new player-facing text.

---

## 6. Questions for Grae

1. Starter trio: Ember/Rime/Thorn keeps Volt and Gloom as earned power spikes. Happy, or do you want all five offered?
2. The Wheel consumes the status it cashes in. Confirm you want the trade (keep the DoT vs detonate it), or should reactions leave the status standing at reduced duration?
3. Potency tiers at inscribe time (locked per slot) or switchable in battle? Inscribe-time is the recommendation: it keeps battle UI clean and makes slots matter.
4. Twin elements in v1.1 scope at all, or park Tier 3C for v1.2? It is the riskiest item on the list.
5. Cap check: level cap stays 12? Reactions and potency add power without levels, so the cap can hold.

---

## 7. Reassessment with the v1.0 brief lifted (Grae's request, 2026-06-10)

The 00-BRIEF "Out" list was a v1.0 scope guardrail, not a design verdict. Re-examined on merit. Some items flip to adopt, some flip to "adopt the underlying idea in a different shape," and a few I will keep arguing against because the objection was identity, not scope.

### 7.1 Cast-failure chance: still no, but steal the system underneath

**The fatal flaw stands without the brief.** Glyphwright's 60%-base cast chance works because it is real-time: a fizzle costs half a second and half the mana, you cast again immediately, and the failure animates a mastery curve. In Sigilbound a standard fight is 2-4 player turns. A fizzle is a **lost turn**, which is 25-50% of the fight decided by a die roll. That recreates, in a worse form, the exact early-game RNG feel this whole proposal exists to kill. Turn-based games that use action-failure get away with it only when failure is informational and positional (XCOM cover math); naked percentage fizzle in a JRPG frame reads as theft.

**What is worth stealing is the progression underneath it: craft skill by school.**

- **7A. Element Mastery.** Per-element mastery that grows through play (suggested: +1 per battle won in which that element dealt a hit, so it cannot be farmed by spamming wisps at a gloop). Thresholds, e.g. at 10/25/50: +5% power, +10% status proc, spell cost -1 for that element. Visible as five small progress bars in the Grimoire. What it buys: a specialise-vs-generalise decision that v1.0 completely lacks, long-arc progression that survives the Lv 12 cap, and synergy with starter choice (1A), since your starter is naturally your deepest element.
- **7B. Unstable casts (failure converted into content).** Where Glyphwright punishes overreach with a fizzle, Sigilbound can punish it with **wildness**: casting above your means (Greedy potency below a mastery threshold, twin elements before the trial, the Wyrd rune always) triggers a **surge roll** on a chaos table in the Runecast Umbra mold: 50% mild/cosmetic, 30% board-changing, 20% backfire. The spell always fires. The surge is a rider, never a refusal. Players retell surges; nobody retells fizzles. This also gives the Wyrd rune (Tier 2 adjacent) its mechanical home.

### 7.2 Essence economy: adopt, but inverted

Glyphwright taxes the act of inscription. That is right for Glyphwright, where authored spells are 4-8 hour milestones. It is wrong for Sigilbound, where crafting is the minute-to-minute toy: taxing inscription in a 4-5 hour game punishes experimentation, and experimentation is the pillar ("the spell is the hero"). The honest diagnosis from section 1 was never "inscribing is too cheap," it was "there is too little worth inscribing."

**So: inscription stays free forever. Essence funds everything around it.**

- **7C. Essence as the single currency.** Drops from battles (small), elites and rare encounters (large, giving 1C/1D a reward hook), caches, and commissions. No gold, no second currency.
- Essence sinks, in priority order:
  - **Grimoire slots 4 -> 6.** The two extra slots are the headline purchase. A 5th slot materially changes loadouts (room for a utility/gate spell at all times).
  - **Charm crafting and upgrading** (3B gets its acquisition loop).
  - **Scrolls** (7E below).
  - **Peddler trades** (7D below).
- **Optional, flag for playtest:** defeat drops unbanked essence at the death site, recoverable by walking back (Glyphwright's death rule). It gives defeat a sting without progress loss. If it tests as anti-"respect the session," cut it; the economy works without it.

### 7.3 Free sliders: adopt, I was wrong to bin them

With the brief lifted the only blocker was mobile UI, and that is solvable. The three Potency tiers (2B) upgrade to a **continuous Potency slider**, roughly x0.6 to x2.0 on cost with a monotonic power mapping, drag handle at 44px, snap detents at the old Faint/Standard/Greedy points (the sim tests at the detents, players can live between them). The Grimoire preview already recomputes live; the ledger shows every term, Glyphwright-style. What it buys over tiers: the "I tuned this to exactly 1.3x" ownership feel, which is the cheapest authorship win available. Glyphwright's other knobs (duration, area) stay out: statuses have fixed durations and nova has no radius, so those knobs have nothing to grab.

### 7.4 The rest of the old "Out" list, on merit

| v1.0 exclusion | Verdict | Reasoning |
|---|---|---|
| Currency / shops | **Partial adopt** | Essence (7C) plus one **Peddler NPC** who wanders between maps trading essence for charms, scroll reagents, and relic hints. One currency, one trader, no shop economy. World texture, not an economy sim. |
| Inventory / consumables | **Adapt** | No potions: a generic heal item competes with Focus and deletes a designed verb. Instead **Scrolls (7E)**: at any shrine, pay essence to inscribe a one-use scroll of any craftable spell at x2.5 potency, castable in battle for 0 MP. It is an item system that is still spellcraft. Boss-prep becomes a ritual (Glyphwright's workshop moment). Cap held at 3 to keep the battle UI to one extra button. |
| Equipment / gear | **Still reject** | This was never a scope guardrail; it is identity. Glyphwright's own CLAUDE.md bans gear for the same reason: "your identity is your grimoire." Charms (3B) are the bounded version and they are enough. Full gear dilutes the one thing the game is about. |
| Party members | **Reject the system, adopt a bounded slice** | A party reworks the entire battle UI, turn order, and every formation balance number. The fun inside it is summoning. **7F. The Summon form** (sixth form, late unlock or Act 4 reward): conjure an elemental familiar as a battlefield actor with HP that enemies can target (the reducer already handles multi-actor sides for enemies; this mirrors it). One familiar at a time, replaces your Veil slot niche decision. Most expensive single item in section 7; only worth it if Act 4 ships. |
| Day/night, weather | **Adapt cheap** | Full day/night: no. **7G. Vale Aspects**: each time the player rests at a shrine/spring (or per save session), one element becomes ascendant vale-wide (+10% power, +10% proc for everyone, enemies included). Signs and the Scout announce it. One global modifier, rotating, seeded. Cheap variance that makes the same zones replay differently, and it teaches matchup thinking passively. |
| Procedural maps | **Still reject** | "Small world, dense secrets" is the content identity. Five hand-authored maps with gates and caches beat fifty generated ones at this scale. |
| Side quests + tracking UI | **Adopt minimal** | Commissions (2F) and gates (2E) now exist, so a tracker earns its place: **7H. The Notes page**, one extra Grimoire page auto-listing commissions heard and gates seen, each as a single line in the player's voice ("The fisher wants something warm that wears a shield."). No quest markers, no arrows. The vale stays a place, not a checklist. |
| Multiplayer / leaderboards | **Adopt the async slice only** | Glyphwright's spell codes port directly: **7I. Spell codes**, export any crafted spell as a short string (`sb1:` + base64 of the composition), import via paste. Recipe only: locked parts stay locked, the import shows what you are missing (Glyphwright's no-binary-gates rule). Zero servers, and it gives the itch.io comments section something to do. Folklore is the cheapest engagement system ever shipped. Leaderboards stay out: nothing to rank without servers. |

### 7.5 Two additions with no Glyphwright parent

- **7J. Feats page.** Local achievements on the ending-stats pattern: "won a fight with only Wisp," "Shattered three enemies in one battle," "finished a commission before meeting its giver." 15-20 entries, one Grimoire page. Cheap, and it quietly advertises mechanics the player has not tried (the discovery-beats-optimisation pillar doing retention work).
- **7K. Waystone rematches.** The boss waystones already exist (Phase 9). Interacting after victory offers a rematch at +2 levels with elite summons, paying essence. Boss-rush texture without new arenas, and a late essence sink.

### 7.6 Revised effort table (section 7 items only)

| Item | Engagement gain | Effort | Risk |
|---|---|---|---|
| 7A element mastery | High (long arc) | M | Med (farming incentives; gate gains to battle wins) |
| 7B unstable casts / surge table | Med-High (variance with stories) | M | Med (table needs the no-instant-kill rule) |
| 7C essence + slots 4 to 6 | **High** (the missing collect-spend loop) | M | Low |
| 7D peddler | Low-Med | S | Low |
| 7E scrolls | Med | M | Med (action economy; cap at 3 held) |
| 7F summon form | High | **XL** | High (reducer + UI + balance) |
| 7G vale aspects | Med | S | Low |
| 7H notes page | Med (friction killer) | S | None |
| 7I spell codes | Med (community) | S | Low |
| 7J feats | Low-Med | S | None |
| 7K waystone rematches | Med | S | Low |

**Phase impact:** 7C/7H slot into Phase 11 (the economy should exist before charms and caches land). 7A/7B/7G into Phase 12 alongside the Wheel. 7D/7E/7I/7J/7K into Phase 13. 7F only ships with Phase 14 (Act 4) or not at all.

### 7.7 New questions for Grae

6. Essence drop on defeat (recoverable corpse-run): in or out? My lean is in, with a generous radius and no decay, but it is the one item that touches "respect the session."
7. Scrolls cap at 3 held: agree, or do you want them rarer (boss-prep only, cap 1)?
8. Summon form (7F) is the only XL item. Gut call now, or park until Act 4 is real?
9. Mastery gains per battle won (anti-farm) or per cast (faster, farmable)? Recommendation: per battle won.
10. 00-BRIEF needs a v1.1 revision if any of section 7 lands; its "Out" list is now wrong. Want that rewrite in the same session as the spec fold-in?
