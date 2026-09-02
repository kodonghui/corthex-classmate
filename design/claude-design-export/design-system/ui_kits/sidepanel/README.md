# UI kit · Classmate side panel

Interactive recreation of the only product surface: the Chrome side panel docked next to Google Meet (380 × 900 default; 360–520 wide).

Open `index.html`. A class clock starts at 10:32:10 and the 3교시 transcript (IoC 컨테이너와 의존성 주입) streams in on schedule.

Screens
- **듣는 중** `ListeningScreen.jsx` — `PanelHeader` (dot · topic · 교시 · clock), `TranscriptFlow` bottom-anchored, `SourceFooter`. Tap a dotted term → `MarginNote` (preparing 1.6 s → ready → folds after 18 s, countdown in the footer of the note). Tap a sentence or press Alt+S → `MarginNote` in choosing state with `GuessList`. Chips: 더 쉽게 / 왜 필요한데? / 내 코드와 비교 (`CodeCompare`). A `NowLine` appears under the note when the teacher moves on.
- **자세히** `DetailScreen.jsx` — the caught sentence (`TranscriptFlow size="md"`), `AnswerCard` with 왜 그런가요 / 내 코드와 비교 / 선생님 화면 코드 / 선생님이 말한 부분, follow-up chips, sticky "수업으로 돌아가기".
- **기록** `HistoryScreen.jsx` — `MomentRow`s grouped by 교시 (today's live catches + earlier periods).
- **설정** `SettingsScreen.jsx` — answer length, auto-fold, sources to save, 교시, Alt+S, clear-today `Dialog`.

시연 column: panel width 360 / 380 / 520 (Chrome's own minimum is ≈360), 전사 끊김 (transcript stops, footer turns amber, tip changes), 튜터 끊김 (notes wait with an amber tint, footer turns red), 수업 처음부터.

Notes
- Copy lives in `data.jsx`: `CM_TRANSCRIPT` (9 lines with `at` seconds), `CM_ANSWERS` (per term: conclusion / easier / why / evidence / compare), `CM_SENTENCE_GUESSES`, `CM_GUESS_TERM`.
- Screens compose design-system components only; kit-level CSS is layout (`.cm-screen*`, `.cm-group*`, `.cm-rows`, `.cm-set*`, `.cm-kbd`, `.cm-demo`).
- `--panel-inset` is set per width here; inside a real side panel the `clamp()` in `tokens/spacing.css` does it.
