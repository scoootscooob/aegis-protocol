# Plimsoll Protocol — Terminal Demo Recording
# https://github.com/charmbracelet/vhs
#
# Usage:
#   brew install vhs
#   cd demo && vhs demo.tape
#
# Generates: demo.gif (upload to assets/)

# ── Configuration ──────────────────────────────────────────────────
Output demo.gif
Set Theme "Rosé Pine Dawn"
Set FontFamily "JetBrains Mono"
Set FontSize 14
Set Width 1200
Set Height 800
Set Padding 24
Set Margin 16
Set MarginFill "#FAF9F6"
Set BorderRadius 0
Set WindowBar Colorful
Set TypingSpeed 40ms
Set CursorBlink false

# ── Phase 0: Setup ─────────────────────────────────────────────────
Type "# Plimsoll Protocol — Live Agent Demo"
Enter
Sleep 800ms

Type "# Proving that ALL frontier models break under prompt injection"
Enter
Type "# ...and that deterministic math catches every single one."
Enter
Sleep 1200ms

# ── Phase 1: Install ──────────────────────────────────────────────
Type "pip install plimsoll-protocol"
Enter
Sleep 2000ms

# ── Phase 2: Run Scare Campaign (offline demo) ────────────────────
Type "python3 demo/scare_campaign.py"
Enter
Sleep 6000ms

# ── Phase 3: Multi-Model Gauntlet ─────────────────────────────────
Type ""
Enter
Type "# Now the real thing — same attack, three frontier models"
Enter
Sleep 800ms

Type "python3 demo/live_agent.py --multi"
Enter
Sleep 15000ms

# ── Phase 4: Conclusion ───────────────────────────────────────────
Type ""
Enter
Type "# Every model compromised. Every attack blocked by Plimsoll."
Enter
Type "# Brains are probabilistic. Capital is deterministic."
Enter
Sleep 3000ms
