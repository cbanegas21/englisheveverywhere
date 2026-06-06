# Live Call / Classroom QA backlog — Carlos walkthrough 2026-06-06 (Round 2)

Status: **PLANNING ONLY — do not build yet.** The LiveKit video classroom
(`/sala/[bookingId]`). Carlos: this is the **most important** surface — most user time is spent
here; it must feel **professional** (Google Meet / Teams / Zoom quality).

Legend: 🟢 like/keep · 🔧 fix · ✨ new · 🎨 polish · 🧭 decision · ⚙️ setup · 🔬 research

---

## Works / keep 🟢
Mic mute/unmute, stop & re-enable video, side-by-side layout, the **glass chat** (likes it),
screen share (full screen works), mic/camera settings, the transcript hide toggle.

## Chat
- **CALL-01 🔧 Overlap/stacking.** Self-camera (top-right) and the open glass chat sit on top of
  each other, and you can't move the camera up while chat is open. Rework z-index/layout so the
  camera PiP and chat don't collide.
- **CALL-02 🔧 Don't notify me of my OWN messages.** Sending a chat message shows an unread
  notification to yourself; the badge should only appear for messages from the **other**
  participant.

## Overall UI
- **CALL-03 🎨🔬 Make the call UI more professional — reference Google Meet (and Teams).** Polish
  the layout/controls toward a premium meeting feel. (The native screen-share source picker is
  browser-controlled — out of scope.)

## Whiteboard
- **CALL-04 🔧🧭 Verify real-time collaboration.** It seems to work now, but it's unclear whether
  the other participant sees it live / how sync works. QA it + document how it works.
- **CALL-05 ✨ Zoom + recenter controls.** Add +/− zoom and a "center/recenter" control so users
  don't get lost on the infinite canvas.

## Transcript & Vocabulary
- **CALL-06 🔧 Live transcript not working.** No transcript appears while speaking (tried
  switching to the streaming mic — still nothing). Fix the speech-to-text capture/stream.
- **CALL-07 🧭🔧 Vocabulary panel ("0 words today").** Clarify what it is (AI analyzing the
  transcript for vocabulary?) and fix it — likely depends on CALL-06.

## Self-camera (PiP) controls — important
- **CALL-08 🔧 Auto-place the self-camera in a VISIBLE corner.** On load it sat **behind the
  controls bar**; bottom-left/right corners hide it behind the buttons. Detect an unoccluded
  corner so the user can always see themselves.
- **CALL-09 ✨ Resize the self-camera (bigger/smaller).** Teacher + student.
- **CALL-10 ✨ Camera layout control during screen-share.** Resize or **hide** the camera (yours
  or theirs) while sharing; handle all camera-layout options. Teacher + student.

## Teams-style additions
- **CALL-11 ✨ Raise-hand button.**
- **CALL-12 ✨ Reactions / emoji.**
- (Meeting notes NOT needed — chat covers it.)

## Join flow — KEY
- **CALL-13 ✨🧭 Direct join link (lobby link) per class** (like Zoom/Teams/Meet). The reminder
  (SMS/WhatsApp/email) carries a link → click → log into EnglishKolab → straight into the call.
  Cuts the app → My Classes → join steps. **Ties directly to ST-04 notifications.**

---

## Big rocks
- **CALL-03** Meet-quality UI polish.
- **CALL-06/07** transcript + vocabulary pipeline (needs the STT/transcription decision).
- **CALL-08/09/10** camera layout/positioning system.
- **CALL-13** direct join link (ties to notifications).
