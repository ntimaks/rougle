# ADR-0006 · Six more engineering problems, found while building

**Status:** Raised, unresolved. Each needs a rules or design decision.
**Numbering:** continues technical brief §13, which ends at I-14.

Technical brief §13 lists fourteen problems found by *reading* the specs. These
six were found by *building* them. Three are live bugs that were fixed in code
because a run cannot proceed without a fix; the fix is stated so the ruling can
overturn it.

---

## I-15 · RL.27 The Vault cannot be implemented as written

"Up to 10 leftover guesses carry into the next act instead of converting to
gold. Does not raise the act cap."

The pool refills to `poolMax` at act start (MECHANICS.md §2.1), and technical
brief §3 requires `pool` never to exceed `poolMax`. A pool that starts full has
no room for a carry, so under a literal reading a RARE relic does nothing at all.

Three readings, none of them stated:

1. The carry raises that act's cap and only that act's.
2. The pool may start above the cap and is clamped on the way down.
3. The act refills to `poolMax − carried` and the carry tops it back up, which
   is a no-op by another route.

Only (1) makes the relic do anything, and it contradicts the rule text.

→ **Blocking C-05.** RL.27 is unimplemented, and `refillPool` deliberately takes
no carry parameter so nothing is silently half-built.

---

## I-16 · Rule A truncation kills two relics outright

Rule A applied at the moment a refund fires means a refund on guess 1 can never
be granted, which makes RL.13 Opening Gambit and RL.19 The Moth's refund clause
dead. Full argument and the implemented fix (carry the shortfall within the
word) in ADR-0005.

→ **Needs a ruling.** Implemented provisionally so both relics function.

---

## I-17 · Silent Start has no slot in the transform order, and its rule is ambiguous

Two problems.

**Ordering.** "First guess returns GREY only; no yellows" alters feedback, so it
is a transform. MECHANICS.md §4.4's six steps do not include it. It has to run
before Rangefinder (step 3), because it changes which tiles are yellow.

→ Implemented as declared step 0, `suppression`, in `feedback/chain.ts`.

**The rule.** "Returns GREY only" and "no yellows" are not the same statement.
Read literally, the first says greens are hidden too; the second says only
yellows are. Hiding greens on the opening guess of an Act I modifier is
brutal — and it interacts badly with I-18 below.

→ Implemented as the second reading: yellows become grey, greens survive.

---

## I-18 · Three ways for The Sieve to lock a letter the solution needs

RL.02 The Sieve hard-locks letters proven GREY. R-003 guarantees that The Moth
and the Locked Key modifier never take a solution letter, so the solution stays
typable — but the Sieve is not covered by R-003 and three separate mechanics let
a GREY appear on a letter the solution actually contains:

1. **Liar Letter** corrupts a tile's reported state. A corrupted GREY is not
   evidence of anything.
2. **Silent Start** reports GREY in place of YELLOW on the first guess. Those
   greys mean "not green here", not "not in the word".
3. **Decay** reverts a GREEN to UNKNOWN. A letter green in one position and grey
   in another (the duplicate-letter case) then reads as GREY overall, and the
   Sieve locks it.

Each produces an unsolvable word with no counterplay, which is exactly what
R-003 forbids for the other two removal systems. All three were reproduced by
the harness before they were fixed — case 3 as a run that could not produce a
legal guess at all.

→ **Fixed in code**, because a run cannot continue without it.
`deriveProvenGrey` requires an honest, untainted GREY observation, and reads the
undecayed projection. `projection.test.ts` asserts all three.

→ **Still needs a ruling**, because the general principle — "no mechanic may
render a solution untypable" — belongs in MECHANICS.md §11 alongside R-003
rather than living in one function's comment.

---

## I-19 · Under Mirror, which solution does a pre-guess reveal describe?

The Twins has two solutions. Lexicon reports "how many vowels the answer holds".
Which answer?

The engine reveals the first solution's. A solver that applies that reveal to
the second solution eliminates the real answer on turn one — which is how this
was found: the Act I boss looked unbeatable in simulation, in a way that read as
a balance problem and was a rules gap.

Three plausible rules: describe solution A only; describe both (two reveals, and
the cap becomes very tight); or describe neither and suppress reveals under
Mirror.

→ **Not blocking.** Implemented as "solution A only", both in the engine and in
the solver's model. The Twins is playable either way; the number it costs
changes.

---

## I-20 · Character innates are not in §6.3's affected list

§6.3 caps pre-guess reveals at two and lists six relics. It does not mention
characters. But `relics.json` marks CH.01 The Linguist `pre_guess_reveal: true`,
and its innate — "sees the solution vowel count on every word, before the first
guess" — is exactly the effect the cap bounds.

It matters: a Linguist holding Lexicon and Palimpsest is at the cap before taking
a single further reveal relic, which changes what those relics are worth to that
character and only that character.

→ **Implemented per the data**, which is normative: the flag wins and the prose
list is what needs updating. `isPreGuessReveal` covers relics, consumables and
innates alike.
