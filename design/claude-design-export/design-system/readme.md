# Corthex Classmate Design System

Corthex Classmate is a desktop AI study aid for beginners learning Java and Spring during live online classes. It lives in a **vertical Chrome side panel (default 380 × 900 px, usable from 360 to 520 px wide) docked next to Google Meet** on a Windows PC. The learner watches the teacher's shared screen in Meet and types along in IntelliJ; the teacher's voice is transcribed live by Tiro on an iPhone. When the learner gets stuck, one action catches the moment, the tutor reads the recent transcript + Meet screen + IntelliJ code, and returns one short sentence — then the learner steps back into class.

Success is **not** a long chat. Success is: one action → one sentence → back to class.

## Sources
No codebase, Figma file, logo, font files, or screenshots were provided. The system was authored from the product brief (the project's first message) and four UX explorations built here in `explorations/` (see below). There is **no logo**: wherever a mark would go, render the wordmark "Corthex Classmate" in plain type (`assets/wordmark.html`). Fonts are Google Fonts substitutes.

Background research folded into the design (no product data yet):
- "Confusion button" studies (Echo360's confusion alert; Choudhury & Hargis 2017; Baron et al. 2016 backchannel) — students rarely ask out loud; a one-tap, anonymous, *no-typing* signal gets used, and knowing *where* in the lecture confusion happened is what makes it useful. This is why catching a moment must never require composing a question.
- Chrome's side panel: default ≈360 px, user-resizable but width is not persisted, and extensions cannot set it. The kit therefore treats 360 as the practical minimum and re-flows at 360 / 380 / 520.

## The interaction model — 단어 잡기 (catch the word)
The learner cannot say what they don't understand, so the panel never asks them to. Instead:
1. **The teacher's words flow** at the bottom of the panel, large (19/31), newest last. Terms the tutor recognizes carry a dotted underline. Only the last two sentences are full ink; older ones fade toward paper. (`TranscriptFlow`)
2. **Tapping a word is the question.** Tapping the sentence catches the whole sentence; `Alt+S` catches the last one. Nothing else to press. The tap saves the recent transcript, the Meet frame and the IntelliJ file.
3. **The answer is a margin note** under that very sentence. While it is being prepared (≈1.6 s) the note first shows the three sources it sealed — 전사 · Meet · IntelliJ with their ages — then the one-line wait. Ready: word · time, one-sentence conclusion, how the tutor knows it (확인됨 / 일부 확인 / 추론 / 자료 지연), two or three chips (더 쉽게 · 왜 필요한데? · 내 코드와 비교), "자세히 보기 ▸". It folds to one dashed line after 18 s and stays in 기록. (`MarginNote`, `Evidence`, `Chip`)
4. **Caught a sentence, not a word?** The tutor offers 2–3 guesses: "혹시 이게 막혔나요?" (`GuessList`)
5. **Going back is nothing.** The learner never left: the transcript keeps flowing under the note, and a `NowLine` says where the teacher is now ("지금 · 생성자 주입 코드로 넘어갔어요") — pinned quietly under the header on the listening screen as well, so the empty top of the panel always says where the teacher is. Only the detail screen has a primary button, "수업으로 돌아가기".
6. **Status is one quiet line** at the bottom: "전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전 · 기록 1". When something stops it becomes amber and says what stopped and what continues. Red only when the tutor itself is unreachable. (`SourceFooter`)

`explorations/Directions.html` holds the four directions this grew from: 단어 잡기 (chosen), 되감기 (drag the time ruler up to catch a span), 내 코드 옆에 (the differing code line is the question — its `CodeCompare` survives as a chip), 조용한 불빛 (hold Alt while confused; dark). They remain as reference; the kit builds only the first.

## Design principles
1. **The transcript is the interface.** Chrome and controls stay small and gray; the teacher's sentence is the biggest thing on screen.
2. **Conclusion first.** One sentence in `--type-conclusion`; reasoning, code and the teacher's exact words sit behind `Disclosure`s.
3. **Say how you know.** Every claim carries an `Evidence` tag. Never blend checked and guessed in one untagged sentence.
4. **Calm for eight periods.** Warm paper, ink text, one ink-green accent, hairlines, almost no shadow, motion under 250 ms, no purple, no gradients, no emoji, few icons.
5. **Reassure when something breaks.** Amber footer: what stopped, what still records, one action. Never a modal for a connection problem.
6. **Never demand a typed question.** Words, sentences, guesses and chips come first; a text field exists only on the detail screen.

---

## CONTENT FUNDAMENTALS

**Language.** Korean first, 해요체. Product/tool names stay Latin: Tiro (shown to learners as 전사), Meet, IntelliJ, Java, Spring. Code identifiers in `--font-mono`.

**Voice.** A calm classmate sitting next to you — not a teacher, not an assistant. Never "저는/제가", never names itself, never addresses the learner with a pronoun. The tutor's own state is described plainly: "튜터는 조용히 있어요", "튜터가 돌아오면 여기에 한 줄이 나타나요".

**Verbs of the product.** 붙잡다 (catch a moment), 접히다 (a note folds), 남다 (stays in 기록), 돌아가다 (back to class). Not 저장/제출/전송/질문하기.

**Buttons speak for the learner.** "수업으로 돌아가기", "더 쉽게", "왜 필요한데?", "내 코드와 비교", "다시 연결", "자세히는 나중에".

**Conclusion first.** One sentence, ≤ 40 Korean characters when possible, ending "~예요/~해요". Then labeled disclosures: 왜 그런가요 · 내 코드와 비교 · 선생님 화면 코드 · 선생님이 말한 부분.

> `new` 자체가 틀린 건 아니지만, 객체를 바꾸거나 테스트하기 어려워져서 생성 책임을 분리해요.
> 확인됨 · 전사 &nbsp; 일부 확인 · Meet 화면 &nbsp; 추론 · 테스트 이야기

**Evidence labels.** 확인됨 · 전사 / 일부 확인 · Meet 화면 / 추론 · (short reason) / 자료 지연 · IntelliJ.

**Status copy.** What stopped → what continues → the one thing to do. "전사가 잠시 멈췄어요. 화면과 코드는 계속 기록하고 있어요. 다시 연결". "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요."

**Casing & punctuation.** Sentence case for Latin. No exclamation marks. Periods on full sentences only. Middle dot ( · ) separates meta. Times `10:32:18` (seconds matter in class), periods `3교시`. Digits for numbers.

**No emoji, no icons-as-words.** Icons sit beside text or inside `IconButton` with `aria-label`. ▸ and ▾ are allowed as disclosure marks in text.

**Empty & waiting.** Present tense, no apology: "아직 붙잡은 순간이 없어요", "한 줄로 정리하고 있어요".

---

## VISUAL FOUNDATIONS

**Motif: notes in the margin of a lecture.** The teacher's sentences are the page; answers are notes pinned under them; time is a mono stamp. Not a chat, not a dashboard.

**Color.** Warm paper neutrals (`--paper-0…5`, oklch hue 85), cool near-black ink (`--text-1` #1B212A), one accent `--ink-600` #155D53 — a deep green taken from the Sites UX lab's 수업 핀 direction (2026-09-02; was ink-blue #335493) — hover 700, pressed 800; `--ink-50/100` tint selected/verified/caught surfaces. Status: green = live, amber = partial (the default problem color, also for "일부 확인" and "내 코드" in comparisons), red = tutor unreachable (rare). Transcript recency: `--transcript-1/2/3`. Never more than one saturated block on screen — on the listening screen there is none.

**Type.** `Pretendard Variable` 400/500/700 (jsDelivr; replaced Gothic A1 on 2026-09-02 for tighter Korean/Latin harmony), `IBM Plex Mono` for code and clocks. Scale: transcript 19/31 (400), display 22/30, title 17/24, conclusion 16/25 (500), body 14/22, label 13/18 (500), caption 12/16, time 11.5/16 mono, code 12.5/20 mono. `word-break: keep-all`. Titles −0.015em, transcript −0.012em.

**Spacing.** 4 px base (`--space-1…10`). `--panel-inset` 14 / 16 / 20 at 360 / 380 / 520. Transcript lines 20 px apart; note padding 12 × 14; rows 10 px vertical.

**Layout.** Single column. 44 px header (dot · topic · 교시 · clock). Listening screen: transcript bottom-anchored, footer status line. Detail screen: scroll + sticky bottom bar with the one primary button. 기록/설정: plain rows with hairline dividers, no cards.

**Corners.** 3/4/6/8/12. Chips and evidence 4, controls 6, notes and code 8, dialog 12, dots 999.

**Borders & surfaces.** Notes = `--paper-0` + 1 px `--border-hairline`, no shadow; a folded note is a dashed hairline. Sunken areas (code, quotes) = `--paper-2`. Dividers full-bleed inside a list.

**Shadows.** Dialog `--shadow-lg`, toast/tooltip `--shadow-md`, nothing else. Scrim `rgba(20,22,31,.32)` + 2 px blur under dialogs only.

**Backgrounds.** Flat. No imagery, patterns, illustrations (none provided; do not invent).

**Motion.** Lines and notes enter with fade + 4 px rise (180–240 ms, `--ease-enter`). Caught terms and hover: 120 ms color. Live dots breathe over 2.4 s. Waiting = slow sweep on a 2 px hairline. No bounce, no scale, no spinners. `prefers-reduced-motion` → 0.

**States.** Hover: one step darker / `--paper-3`. Press: no transform. Focus: 2 px `--ink-400` ring, keyboard only. Disabled: `--paper-5` + `--text-4`. Caught term: `--ink-100` fill + solid `--ink-600` underline; previously caught: solid `--ink-400` underline.

**Transparency & blur.** Dialog scrim only.

**Imagery.** None. Meet frames, if ever shown, unfiltered in an 8 px hairline card with source + time.

---

## ICONOGRAPHY

No icon assets were provided. **Lucide** (1.75 px stroke) via the `Icon` component (CDN, pinned 0.460.0). Used sparingly: the listening screen shows one icon (설정). Sizes: 11 in evidence chips, 13 in note headers, 14 in chips, 16 inline, 18 in controls. Color = `currentColor`. Vocabulary: `bookmark` 붙잡음, `circle-check` 확인됨, `circle-dot` 일부 확인, `circle-help` 추론, `clock` 자료 지연, `monitor` Meet, `code-xml` IntelliJ, `git-compare` 내 코드와 비교, `arrow-left` 돌아가기, `chevron-down/right`, `settings-2`, `x`. Banned: `sparkles`, `bot`, `brain`, any "AI glitter". Status is a 6–8 px dot, never an icon. No emoji; ( · ), ▸, ▾ are the only symbolic characters. Logo: none — plain-type wordmark.

To self-host: drop SVGs into `assets/icons/` and point `components/core/Icon.jsx` at them.

---

## COMPONENTS
Under `components/<group>/` as `<Name>.jsx` + `<Name>.d.ts` + `<Name>.prompt.md`; each injects one small token-based stylesheet. Namespace: `window.CorthexClassmateDesignSystem_a7a453`.

- **core/** — `Button`, `IconButton`, `Icon`
- **forms/** — `Input`, `Select`, `Checkbox`, `Radio` + `RadioGroup`, `Switch`, `Chip` + `ChipGroup`
- **surfaces/** — `Card`, `Disclosure`, `CodeBlock` (+ `tokenizeJava`)
- **feedback/** — `Badge`, `Tag`, `Evidence` (확인됨 / 일부 확인 / 추론 / 자료 지연), `StatusDot`, `Banner`, `Toast` + `ToastHost`, `Tooltip`
- **navigation/** — `Tabs`, `PanelHeader` (44 px: dot · topic · clock)
- **overlay/** — `Dialog`
- **classmate/** — the product: `TranscriptFlow` (the teacher's words, tappable terms), `MarginNote` (the answer under the sentence; preparing / choosing / ready / collapsed), `GuessList` (혹시 이게 막혔나요?), `NowLine` (where the teacher is now), `SourceFooter` (freshness line + 기록 count; amber/red warn), `CodeCompare` (teacher's line vs mine), `MomentRow` (기록 row), `AnswerCard` (detail screen answer with sections), `SourceStatus` (settings-style source list), `StuckButton` (56 px hero button — fallback for a transcript-less mode; not on the default listening screen)

**Intentional additions** beyond a standard set (no source inventory existed): everything in `classmate/`, plus `Chip`, `Disclosure`, `CodeBlock`, `Evidence`, `StatusDot`, `Banner`, `Icon` — each exists because the brief demands it (no typing, conclusion first, checked vs guessed, calm degraded states).

## UI KIT
`ui_kits/sidepanel/` — the Chrome side panel, interactive: the transcript streams on a class clock; tap a dotted word → margin note (preparing → ready → folds after 18 s); tap a sentence or Alt+S → guesses; 자세히 보기 → detail screen → 수업으로 돌아가기; 기록 and 설정. The 시연 column switches 360 / 380 / 520 and simulates 전사 끊김 / 튜터 끊김. See its `README.md`.

## INDEX
- `readme.md` — this guide · `SKILL.md` — agent skill entry
- `styles.css` → `tokens/` (`fonts`, `colors`, `typography`, `spacing`, `elevation`, `motion`, `base`)
- `guidelines/` — foundation cards (Colors, Type, Spacing, Elevation, Brand)
- `assets/wordmark.html` — plain-type wordmark (no logo, no stored icons/images)
- `components/` — see COMPONENTS; one `*.card.html` per group
- `ui_kits/sidepanel/` — the product kit
- `explorations/Directions.html` + `explorations/directions/01…04` — the four UX directions (tagged as Explorations cards)
- `templates/side-panel-screen/SidePanelScreen.dc.html` — Design Component template of the listening screen
- `thumbnail.html` — homepage tile
