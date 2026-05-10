"""
Generates docs/Heed-Solution-Architecture.pdf — the one-pager judges read
alongside the demo video.

Run: python docs/generate_architecture_pdf.py
"""
import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Preformatted,
)

OUT = os.path.join(os.path.dirname(__file__), "Heed-Solution-Architecture.pdf")

# ── Palette (matches the rest of the Heed doc set) ─────────────────────────────
DARK_GREEN  = colors.HexColor("#2D4A3E")
MID_GREEN   = colors.HexColor("#3D6B57")
LIGHT_GREEN = colors.HexColor("#D6E9DF")
WARM_DARK   = colors.HexColor("#7C5333")
INK         = colors.HexColor("#2A3522")
INK_SOFT    = colors.HexColor("#7A7060")
INK_MUTE    = colors.HexColor("#A8987A")
PAPER       = colors.HexColor("#F9F6EE")
HAIRLINE    = colors.HexColor("#E0D8C0")
ACCENT      = colors.HexColor("#8B4A20")  # ochre

# ── Styles ─────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()
H1 = ParagraphStyle(
    "H1",
    parent=styles["Heading1"],
    fontName="Times-Bold",
    fontSize=22,
    leading=26,
    textColor=DARK_GREEN,
    spaceBefore=0,
    spaceAfter=4,
)
SUB = ParagraphStyle(
    "Sub",
    parent=styles["Normal"],
    fontName="Times-Italic",
    fontSize=11,
    leading=15,
    textColor=INK_SOFT,
    spaceAfter=14,
)
H2 = ParagraphStyle(
    "H2",
    parent=styles["Heading2"],
    fontName="Times-Bold",
    fontSize=14,
    leading=18,
    textColor=DARK_GREEN,
    spaceBefore=14,
    spaceAfter=6,
)
BODY = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Times-Roman",
    fontSize=10.5,
    leading=14.5,
    textColor=INK,
    spaceAfter=6,
)
BULLET = ParagraphStyle(
    "Bullet",
    parent=BODY,
    leftIndent=14,
    bulletIndent=2,
    spaceAfter=3,
)
CODE = ParagraphStyle(
    "Code",
    parent=styles["Normal"],
    fontName="Courier",
    fontSize=8.5,
    leading=11,
    textColor=INK,
    backColor=PAPER,
    borderColor=HAIRLINE,
    borderWidth=0.5,
    borderPadding=8,
    leftIndent=0,
    rightIndent=0,
    spaceBefore=4,
    spaceAfter=10,
)
CAPTION = ParagraphStyle(
    "Caption",
    parent=BODY,
    fontSize=9,
    textColor=INK_SOFT,
    alignment=TA_CENTER,
    spaceAfter=10,
)

# ── Content ────────────────────────────────────────────────────────────────────
ARCH_DIAGRAM = """\
+---------------------------------------------------------------------+
|                          BROWSER (PWA)                              |
|   Next.js 14 static export . Lora + Nunito Sans . 5 themes          |
|   localStorage: identity, themes, demo cache, plans, chat           |
+---------------------------------------------------------------------+
                                   |   X-User-ID + X-Auth-Token (HMAC)
                                   v
+---------------------------------------------------------------------+
|        AZURE STATIC WEB APPS  ->  AZURE FUNCTIONS                   |
|            (Free tier)             (Consumption . Python 3.11)      |
|                                                                     |
|   /api/tasks  .  /api/completions  .  /api/context  .  /api/plans   |
|   /api/advisor_stream      <-  streams NDJSON of agent events       |
|   /api/parse_capture       <-  free-text -> task or routine (mini)  |
|   /api/execute_action      <-  gated mutations from agent proposals |
|   /api/memory_keeper_run   <-  timer-triggered cadence learner      |
+---------------------------------------------------------------------+
        |                             |
        v                             v
+------------------+    +------------------------------------------+
|   COSMOS DB      |    |         AGENT LAYER (Python)             |
|   (NoSQL)        |    |                                          |
|   users . tasks  |    |  advisor.py     <-  multi-step planning  |
|   completions    |    |    +- tools/cosmos_tool   (read state)   |
|   user_context   |    |    +- tools/search_tool   (AI Search)    |
|   user_state     |    |    +- tools/bing_tool     (web grounding)|
|   (plans /       |    |    +- tools/action_tools  (proposals +   |
|    routines)     |    |    |                       Risk-7 gate)  |
|                  |    |    +- tools/safety_tool   (prompt shield)|
|  partition:      |    |                                          |
|   /user_id       |    |  memory_keeper.py  <-  cadence learner   |
+------------------+    |     (timer . every 6h)                   |
                        |                                          |
                        |  auth.py  .  telemetry.py                |
                        +-------------------+----------------------+
                                            |
                +---------------------------+----------------------+
                |                           |                      |
                v                           v                      v
       +-----------------+    +----------------+    +------------------+
       | AZURE OPENAI    |    | AZURE AI       |    | GROUNDING WITH   |
       | (Foundry)       |    | SEARCH         |    | BING             |
       |                 |    |                |    |                  |
       | heed-advisor    |    | task_memory    |    | Web facts for    |
       |  (gpt-5.4)      |    |  (vector+text) |    | time-sensitive   |
       |                 |    |                |    | queries          |
       | heed-keeper     |    | ph_calendar    |    |                  |
       |  (gpt-5.4-mini) |    |  (cultural)    |    |                  |
       |                 |    |                |    |                  |
       | heed-embed      |    |                |    |                  |
       |  (text-embed-3) |    |                |    |                  |
       +-----------------+    +----------------+    +------------------+"""


# ── Helpers ────────────────────────────────────────────────────────────────────
def _on_page(canvas, doc):
    canvas.saveState()
    # Footer
    canvas.setFillColor(INK_MUTE)
    canvas.setFont("Times-Italic", 8.5)
    canvas.drawString(
        0.75 * inch, 0.55 * inch,
        "Heed — Solution Architecture · CWB Hackathon 2026"
    )
    canvas.drawRightString(
        LETTER[0] - 0.75 * inch, 0.55 * inch,
        f"page {canvas.getPageNumber()}",
    )
    canvas.restoreState()


def _table(rows, col_widths, header_bg=DARK_GREEN, header_fg=PAPER):
    cell = ParagraphStyle("cell", parent=BODY, fontSize=9.5, leading=12.5, spaceAfter=0)
    cell_h = ParagraphStyle("cellh", parent=BODY, fontSize=9.5, leading=12.5,
                            spaceAfter=0, textColor=header_fg, fontName="Times-Bold")
    rendered = []
    for ri, row in enumerate(rows):
        rendered_row = []
        for col in row:
            style = cell_h if ri == 0 else cell
            rendered_row.append(Paragraph(col, style))
        rendered.append(rendered_row)
    t = Table(rendered, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("BOX", (0, 0), (-1, -1), 0.5, HAIRLINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, HAIRLINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
    ]))
    return t


# ── Document ───────────────────────────────────────────────────────────────────
def build():
    doc = SimpleDocTemplate(
        OUT,
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.85 * inch,
        title="Heed — Solution Architecture",
        author="anitohlm",
    )
    story = []

    # ── Title ──────────────────────────────────────────────────────────────────
    story.append(Paragraph("Heed — Solution Architecture", H1))
    story.append(Paragraph(
        "A gentle agentic personal assistant for what you forget. "
        "Built for the Microsoft CWB Hackathon 2026.",
        SUB,
    ))

    # ── 1. Problem & Solution ─────────────────────────────────────────────────
    story.append(Paragraph("1. Problem &amp; Solution", H2))
    story.append(Paragraph(
        "Most productivity apps treat people like project managers — lists, deadlines, "
        "guilt-tinged streaks. Real life isn't a project; it's a quiet stream of small "
        "things that quietly slip: utility bills, calls to family, savings goals, trip prep. "
        "Heed is an agentic personal assistant that learns the user's real cadences from "
        "behavior, surfaces what's at risk first, and adapts to actual capacity instead of "
        "an aspirational one. Every state-changing action is proposed by the agent and "
        "explicitly confirmed by the user — the agent proposes, the user disposes.",
        BODY,
    ))

    # ── 2. Architecture diagram ───────────────────────────────────────────────
    story.append(Paragraph("2. System Architecture", H2))
    story.append(Preformatted(ARCH_DIAGRAM, CODE))
    story.append(Paragraph(
        "Live demo: <font color='#7C5333'>brave-pond-035757400.7.azurestaticapps.net</font> &nbsp;·&nbsp; "
        "Source: <font color='#7C5333'>github.com/anitohlm/Heed</font>",
        CAPTION,
    ))

    # ── 3. Azure services ─────────────────────────────────────────────────────
    story.append(Paragraph("3. Azure Services", H2))
    rows = [
        ["Layer", "Service", "Role"],
        ["Frontend", "Azure Static Web Apps (Free tier)",
         "Serves the pre-built Next.js 14 PWA at <i>web/out/</i>; GitHub Actions auto-deploys on push to main."],
        ["Backend API", "Azure Functions (Consumption, Python 3.11 v2)",
         "All HTTP endpoints + the timer-triggered Memory Keeper."],
        ["Database", "Azure Cosmos DB for NoSQL",
         "users · tasks · completions · user_context · user_state. Every container partitioned on /user_id."],
        ["LLM", "Azure OpenAI (AI Foundry)",
         "<i>heed-advisor</i> (gpt-5.4) for the agentic loop; <i>heed-keeper</i> (gpt-5.4-mini) for capture, Memory Keeper, and Bing summarisation; <i>heed-embed</i> (text-embedding-3-small) for AI Search vectors."],
        ["Personal grounding", "Azure AI Search",
         "<i>task_memory</i> (vector + text over user tasks &amp; notes) and <i>ph_calendar</i> (PH holidays + cultural events). Indexer pulls from the Cosmos change feed every 5 minutes."],
        ["Public grounding", "Grounding with Bing",
         "Called as a tool by the advisor for time-sensitive web facts; results cited with source URLs."],
        ["Content safety", "Azure AI Content Safety",
         "Prompt shield runs on every chat input before the advisor sees it (Risk-1 mitigation)."],
        ["Secrets", "Azure Key Vault + Managed Identity",
         "No API keys in source. Functions read at runtime via MI; the frontend has zero secrets."],
        ["Observability", "Application Insights",
         "Spans around every advisor call, every tool invocation, every Cosmos write — debug an agent loop like a microservice."],
    ]
    story.append(_table(rows, col_widths=[1.2 * inch, 2.0 * inch, 3.3 * inch]))

    story.append(PageBreak())

    # ── 4. Multi-model strategy ───────────────────────────────────────────────
    story.append(Paragraph("4. Multi-Model Strategy", H2))
    story.append(Paragraph(
        "Three deployments in one <i>openai-heed</i> Foundry resource. The split keeps cost "
        "low on high-volume paths (capture parsing, the every-6-hours Memory Keeper) while the "
        "user-facing reasoning surface stays sharp. Eval and trade-offs documented in "
        "<i>docs/MULTI_MODEL_COMPARISON.md</i>.",
        BODY,
    ))
    rows = [
        ["Deployment", "Model", "Where it runs", "Why"],
        ["heed-advisor", "gpt-5.4",
         "advisor.py — the agentic loop",
         "Multi-step planning, tool selection, weighing trade-offs across the user's full context."],
        ["heed-keeper", "gpt-5.4-mini",
         "parse_capture · memory_keeper · bing_tool",
         "Narrow extraction + pattern detection. Sub-500ms latency on capture parsing."],
        ["heed-embed", "text-embedding-3-small",
         "search_tool — task_memory vectors",
         "Semantic recall over task names + completion notes."],
    ]
    story.append(_table(rows, col_widths=[1.05 * inch, 1.05 * inch, 2.0 * inch, 2.4 * inch]))

    # ── 5. Grounding & Agent loop ─────────────────────────────────────────────
    story.append(Paragraph("5. Grounding &amp; the Agent Loop", H2))
    story.append(Paragraph(
        "The advisor reasons in two retrieval surfaces — one personal, one public — so it never "
        "confuses what's about <i>you</i> with what's about <i>the world</i>:",
        BODY,
    ))
    story.append(Paragraph(
        "<b>Personal data</b> via Azure AI Search. The <i>task_memory</i> index is a per-user vector "
        "+ text store of tasks, completion history, and the last five completion notes per task; "
        "the <i>ph_calendar</i> index adds Philippine holidays and cultural events for local-time "
        "grounding.",
        BULLET, bulletText="•",
    ))
    story.append(Paragraph(
        "<b>Public web</b> via Grounding with Bing. The advisor calls <i>bing_search</i> for fresh "
        "facts (\"is Memorial Day a long weekend this year?\", \"weather forecast for the trip?\") "
        "and the response carries source URLs surfaced to the user.",
        BULLET, bulletText="•",
    ))
    story.append(Paragraph(
        "On the action side, the advisor never writes to Cosmos directly. It calls <i>propose_action</i>; "
        "the frontend renders each proposal as a confirm chip; only after the user taps does "
        "<i>/api/execute_action</i> route through <i>validate_action</i> (the Risk-7 multi-task gate) "
        "and hit Cosmos. The agent proposes; the user disposes. That separation is structural, not "
        "a behavioral hope.",
        BODY,
    ))

    # ── 6. Safety & Risk model ────────────────────────────────────────────────
    story.append(Paragraph("6. Safety &amp; Risk Model", H2))
    story.append(Paragraph(
        "Seven risk scenarios are mitigated in code. Full eval in <i>docs/SAFETY.md</i>.",
        BODY,
    ))
    rows = [
        ["Risk", "Mitigation in code"],
        ["1. Prompt injection via task names / chat",
         "Azure AI Content Safety prompt shield on every chat input; advisor system prompt distrusts task content as instructions."],
        ["2. Hallucinated mutations (\"I added that for you\")",
         "Every mutation goes through propose_action; user must tap a confirm chip before execute_action fires."],
        ["3. Unsafe defer/skip on health-critical tasks",
         "Tasks marked importance: 'non-negotiable' are excluded from auto-lighten."],
        ["4. Stale cadence learning",
         "Memory Keeper requires ≥5 completions across ≥3 weeks before learning a cadence."],
        ["5. Cross-user data leak",
         "Every Cosmos query partitioned on /user_id; HMAC verifies X-User-ID matches X-Auth-Token bearer."],
        ["6. Fabricated URLs from web grounding",
         "Bing tool wraps the official Grounding-with-Bing API; results carry real cited URLs surfaced to the user."],
        ["7. Multi-task destructive actions",
         "validate_action gate blocks proposals with requires_confirmation=true until user_confirmed=true."],
    ]
    story.append(_table(rows, col_widths=[2.2 * inch, 4.3 * inch]))

    # ── 7. Compliance ─────────────────────────────────────────────────────────
    story.append(Paragraph("7. Compliance", H2))
    story.append(Paragraph(
        "<b>No PII anywhere.</b> The chelle persona, her Singapore trip, her overdue Maynilad bill, "
        "the missed calls to Mom — all synthetic. The demo Cosmos bucket and committed seeds contain "
        "no real data.",
        BODY,
    ))
    story.append(Paragraph(
        "<b>No keys in source.</b> Secrets live in Azure Key Vault. Functions read at runtime via "
        "Managed Identity; the frontend has zero secrets and uses an HMAC token issued at "
        "registration. <i>.env.local</i> and <i>local.settings.json</i> are gitignored.",
        BODY,
    ))

    # ── Build ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
