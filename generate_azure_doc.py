"""
Generates the Azure setup technical documentation as a Word file.
Run once: python generate_azure_doc.py
Output: docs/Heed_Azure_Setup.docx
"""

from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from pathlib import Path


def add_horizontal_rule(doc):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "CCCCCC")
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p


def add_code_block(doc, code_text):
    p = doc.add_paragraph()
    p.style = doc.styles["No Spacing"]
    run = p.add_run(code_text)
    run.font.name = "Courier New"
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(0x1E, 0x1E, 0x1E)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:fill"), "F3F3F3")
    p._p.get_or_add_pPr().append(shading)
    return p


def add_status_row(table, step, resource, status, notes):
    row = table.add_row()
    row.cells[0].text = step
    row.cells[1].text = resource
    row.cells[2].text = status
    row.cells[3].text = notes
    color = "C6EFCE" if status == "Done" else "FFEB9C" if status == "Skipped" else "FFC7CE"
    for cell in row.cells:
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:fill"), color)
        tcPr.append(shd)


doc = Document()

# ── Title ──────────────────────────────────────────────────────────────────────
title = doc.add_heading("Heed — Azure Infrastructure Setup", 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_paragraph("Microsoft CWB Hackathon 2026  ·  Setup Date: 2026-05-02  ·  Engineer: Honey Lynne Manito").alignment = WD_ALIGN_PARAGRAPH.CENTER
add_horizontal_rule(doc)

# ── Table of Contents ──────────────────────────────────────────────────────────
doc.add_heading("Table of Contents", 1)
toc_items = [
    ("1", "Overview"),
    ("2", "Pre-existing Resources"),
    ("3", "Phase A — Azure Infrastructure Provisioning"),
    ("    3.1", "Resource Group"),
    ("    3.2", "Cosmos DB"),
    ("    3.3", "Azure AI Search"),
    ("    3.4", "Azure OpenAI"),
    ("    3.5", "Bing Search v7 (Skipped — Deprecated)"),
    ("    3.6", "Key Vault"),
    ("    3.7", "Azure Functions"),
    ("    3.8", "Static Web Apps"),
    ("4", "Phase B — Seed Data Load"),
    ("    4.1", "What Was Loaded"),
    ("    4.2", "AI Search Indexes Created"),
    ("    4.3", "Embeddings"),
    ("5", "Problems Encountered and Resolutions"),
    ("6", "Final Resource Inventory"),
    ("7", "Secrets in Key Vault"),
    ("8", "Known Gaps and Next Steps"),
]
for num, item in toc_items:
    p = doc.add_paragraph(style="List Bullet" if num.startswith("    ") else "Normal")
    p.add_run(f"{num.strip()}  {item}")
    if not num.startswith("    "):
        p.runs[0].bold = True

add_horizontal_rule(doc)

# ── 1. Overview ───────────────────────────────────────────────────────────────
doc.add_heading("1. Overview", 1)
doc.add_paragraph(
    "This document records the Azure infrastructure provisioning session for Heed, "
    "an agentic personal assistant built for the Microsoft CWB Hackathon 2026. "
    "All provisioning was performed on 2026-05-02 via Azure CLI (PowerShell) and the Azure Portal. "
    "The session covers resource creation, problems encountered, workarounds applied, and the final state of all resources."
)

doc.add_heading("Stack summary", 2)
stack_table = doc.add_table(rows=1, cols=2)
stack_table.style = "Table Grid"
hdr = stack_table.rows[0].cells
hdr[0].text = "Layer"
hdr[1].text = "Service / Tool"
for h in hdr:
    h.paragraphs[0].runs[0].bold = True
rows = [
    ("Frontend", "Next.js on Azure Static Web Apps (Free tier)"),
    ("Agent runtime", "Azure Functions, Python 3.11, Consumption plan"),
    ("User-facing agent", "GPT-5.4 via Azure OpenAI (deployment: heed-advisor)"),
    ("Background agent", "GPT-5.4-mini via Azure OpenAI (deployment: heed-keeper)"),
    ("Embeddings", "text-embedding-3-small (deployment: heed-embed)"),
    ("Vector search", "Azure AI Search (gratitudechain-search, reused)"),
    ("Data store", "Cosmos DB NoSQL, provisioned throughput"),
    ("Secrets", "Azure Key Vault (RBAC mode)"),
    ("Web grounding", "Skipped — Bing Search v7 deprecated for new accounts"),
]
for l, s in rows:
    r = stack_table.add_row()
    r.cells[0].text = l
    r.cells[1].text = s

doc.add_paragraph()

# ── 2. Pre-existing Resources ─────────────────────────────────────────────────
doc.add_heading("2. Pre-existing Resources", 1)
doc.add_paragraph("The following resources existed before this session and were reused:")
pre = doc.add_table(rows=1, cols=3)
pre.style = "Table Grid"
for i, h in enumerate(["Resource", "Name", "Notes"]):
    pre.rows[0].cells[i].text = h
    pre.rows[0].cells[i].paragraphs[0].runs[0].bold = True
pre_rows = [
    ("Resource Group", "heed", "southeastasia — used for all new resources"),
    ("Azure AI Search", "gratitudechain-search", "gratitudechain-rg, southeastasia — reused to avoid Free tier quota limit"),
]
for a, b, c in pre_rows:
    r = pre.add_row()
    r.cells[0].text = a
    r.cells[1].text = b
    r.cells[2].text = c

doc.add_paragraph()

# ── 3. Step-by-Step ───────────────────────────────────────────────────────────
doc.add_heading("3. Step-by-Step Provisioning", 1)

doc.add_heading("Phase A — Azure Infrastructure Provisioning", 1)

# 3.1
doc.add_heading("3.1 Resource Group", 2)
doc.add_paragraph("Pre-existing resource group reused. No new group created.")
add_code_block(doc, "# Used existing resource group\nName: heed\nLocation: southeastasia")

# 3.2
doc.add_heading("3.2 Cosmos DB", 2)
doc.add_paragraph(
    "Created via Azure CLI. Note: --capabilities EnableServerless was omitted on the first attempt. "
    "Serverless mode cannot be added post-creation. Decision: proceed with provisioned throughput (400 RU/s default) — "
    "cost impact under $2 for the hackathon window."
)
add_code_block(doc, "az cosmosdb create --name cosmos-heed --resource-group heed\n  --locations \"regionName=southeastasia\"\n  --kind GlobalDocumentDB\n\naz cosmosdb sql database create --account-name cosmos-heed\n  --resource-group heed --name heed\n\n# Four containers created:\n#   users          (partition key: /id)\n#   tasks          (partition key: /user_id)\n#   completions    (partition key: /user_id)\n#   user_context   (partition key: /user_id)")

# 3.3
doc.add_heading("3.3 Azure AI Search", 2)
doc.add_paragraph(
    "Free tier creation failed — subscription already has one Free-tier Search service (gratitudechain-search). "
    "Azure limits one Free-tier Search service per subscription. "
    "Decision: reuse gratitudechain-search rather than create a paid Basic tier."
)
add_code_block(doc, "# Reused existing service\nService: gratitudechain-search\nResource group: gratitudechain-rg\nLocation: southeastasia\nAdmin key: retrieved via az search admin-key show")

# 3.4
doc.add_heading("3.4 Azure OpenAI", 2)
doc.add_paragraph("Created via CLI. Three model deployments created via Azure Portal (AI Foundry). Models: GPT-5.4 (heed-advisor), GPT-5.4-mini (heed-keeper), text-embedding-3-small (heed-embed).")
add_code_block(doc, "az cognitiveservices account create --name openai-heed\n  --resource-group heed --kind OpenAI\n  --sku S0 --location southeastasia\n\n# Model deployments (via portal):\n#   heed-advisor   gpt-4o\n#   heed-keeper    gpt-4o-mini\n#   heed-embed     text-embedding-3-small")

# 3.5
doc.add_heading("3.5 Bing Search v7 (Skipped — Deprecated)", 2)
doc.add_paragraph(
    "Bing Search v7 is no longer available for new resource creation. "
    "Microsoft deprecated new account registration. "
    "The bing_tool.py module is preserved in the codebase and will activate if a key is provided, "
    "but Bing grounding is disabled for this submission. "
    "The demo's key moments (cadence learning, 'what am I forgetting?', context windows) do not require Bing. "
    "Listed as a known gap in the README."
)

# 3.6
doc.add_heading("3.6 Key Vault", 2)
doc.add_paragraph("Required registering the Microsoft.KeyVault provider namespace first. RBAC role assignment needed before secrets could be written.")
add_code_block(doc, "# Register namespace (subscription was unregistered)\naz provider register --namespace Microsoft.KeyVault\n\n# Create vault\naz keyvault create --name kv-heed-hack\n  --resource-group heed --location southeastasia\n\n# Assign Secrets Officer role to CLI user\naz role assignment create --role \"Key Vault Secrets Officer\"\n  --assignee <signed-in-user-object-id>\n  --scope /subscriptions/.../kv-heed-hack\n\n# Four secrets stored:\n#   cosmos-connection-string\n#   search-admin-key\n#   openai-endpoint\n#   openai-key")

# 3.7
doc.add_heading("3.7 Azure Functions", 2)
doc.add_paragraph("Required creating a storage account first. The name 'heedstorage' was already taken globally.")
add_code_block(doc, "# Storage account (heedstorage was taken globally)\naz storage account create --name heedhackstorage001\n  --resource-group heed --location southeastasia --sku Standard_LRS\n\n# Function App\naz functionapp create --name func-heed\n  --resource-group heed\n  --consumption-plan-location southeastasia\n  --runtime python --runtime-version 3.11\n  --functions-version 4 --os-type linux\n  --storage-account heedhackstorage001\n\n# Managed identity\naz functionapp identity assign --name func-heed --resource-group heed\n\n# Grant Key Vault Secrets User role to managed identity\naz role assignment create --role \"Key Vault Secrets User\"\n  --assignee <principalId> --scope /subscriptions/.../kv-heed-hack")

# 3.8
doc.add_heading("3.8 Static Web Apps", 2)
doc.add_paragraph(
    "Created via Azure Portal (CLI GitHub integration is unreliable). "
    "Connected to GitHub repo 'heed', branch 'main'. "
    "First deploy expected to fail — web/ directory not yet scaffolded."
)
add_code_block(doc, "Name:          swa-heed\nResource group: heed\nPlan:          Free\nRegion:        East Asia\nSource:        GitHub / heed / main\nApp location:  web\nAPI location:  (blank — external Functions)\nBuild preset:  Next.js")

add_horizontal_rule(doc)

# ── 4. Phase B ────────────────────────────────────────────────────────────────
doc.add_heading("4. Phase B — Seed Data Load", 1)
doc.add_paragraph(
    "Seed data was loaded into Cosmos DB and both AI Search indexes were created and populated "
    "using data/load_seed.py. All credentials were read from data/.env (gitignored)."
)

doc.add_heading("4.1 What Was Loaded", 2)
cosmos_table = doc.add_table(rows=1, cols=3)
cosmos_table.style = "Table Grid"
for i, h in enumerate(["Cosmos Container", "Source file", "Documents loaded"]):
    cosmos_table.rows[0].cells[i].text = h
    cosmos_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True
cosmos_rows = [
    ("users", "seed-data/users.json", "1 (Maya, usr_heed_demo_001)"),
    ("tasks", "seed-data/tasks.json", "18 active tasks across 7 categories"),
    ("completions", "seed-data/completions.json", "432 completion records spanning ~5 months"),
    ("user_context", "seed-data/user_context.json", "4 context windows (travel, busy periods)"),
]
for a, b, c in cosmos_rows:
    r = cosmos_table.add_row()
    r.cells[0].text = a
    r.cells[1].text = b
    r.cells[2].text = c

doc.add_heading("4.2 AI Search Indexes Created", 2)
search_table = doc.add_table(rows=1, cols=3)
search_table.style = "Table Grid"
for i, h in enumerate(["Index", "Documents", "Notes"]):
    search_table.rows[0].cells[i].text = h
    search_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True
search_rows = [
    ("task_memory", "18", "Vector index with content_vector field (1536 dimensions). Semantic search over tasks + completion notes."),
    ("ph_calendar", "30", "Static corpus of PH holidays, payday cycles, and bill cycles. No vector field — filter-based queries only."),
]
for a, b, c in search_rows:
    r = search_table.add_row()
    r.cells[0].text = a
    r.cells[1].text = b
    r.cells[2].text = c

doc.add_heading("4.3 Embeddings", 2)
doc.add_paragraph(
    "Embeddings for task_memory were generated using text-embedding-3-small (deployment: heed-embed) "
    "via Azure AI Foundry. Each document's embedding is computed from: task name + description + last 5 completion notes. "
    "18 embeddings generated in a single batch call. Dimension: 1536."
)
add_code_block(doc, "# Embedding endpoint (AI Foundry project — different from cognitive services base URL)\nhttps://heed-resource.services.ai.azure.com\n\n# Verified with quick search test:\n# Query: {\"search\": \"home maintenance\", \"top\": 3}\n# Expected: aircon filter, water dispenser, plants")

doc.add_paragraph()
add_horizontal_rule(doc)

# ── 5. Problems ───────────────────────────────────────────────────────────────
doc.add_heading("5. Problems Encountered and Resolutions", 1)

problems = [
    (
        "PowerShell line continuation",
        "All CLI commands were written with bash backslash continuations (\\). PowerShell does not support this syntax — each broken line was interpreted as a separate command, producing parse errors.",
        "Rewrote all commands as single-line PowerShell commands.",
        "None",
    ),
    (
        "Cosmos DB: missing --capabilities EnableServerless",
        "The first cosmosdb create command omitted --capabilities EnableServerless. Serverless mode cannot be applied after account creation.",
        "Proceeded with provisioned throughput (400 RU/s default). Cost impact is under $2 for the hackathon window — not worth recreating the resource.",
        "Cosmos DB account runs on provisioned throughput instead of serverless.",
    ),
    (
        "Cosmos DB: container creation before database existed",
        "Container create commands ran before the database heed was confirmed to exist, returning a NotFound error.",
        "Ran az cosmosdb sql database create first, confirmed success, then ran container commands.",
        "None",
    ),
    (
        "Azure AI Search: Free tier quota exceeded",
        "Subscription already has one Free-tier Search service (gratitudechain-search). Azure allows only one per subscription.",
        "Reused gratitudechain-search in gratitudechain-rg. Heed indexes will be created alongside existing gratitudechain indexes.",
        "Shared Search service. Risk: hitting the 3-index Free tier limit if gratitudechain already uses indexes.",
    ),
    (
        "Bing Search v7: deprecated",
        "az cognitiveservices account create with --kind Bing.Search.v7 failed with InvalidApiSetId. Microsoft has deprecated new Bing Search v7 account creation.",
        "Skipped Bing grounding entirely. bing_tool.py preserved for future use if a key becomes available.",
        "Bing grounding disabled. Demo relies on AI Search indexes only.",
    ),
    (
        "Key Vault: unregistered namespace",
        "Microsoft.KeyVault namespace was not registered on the subscription, blocking vault creation.",
        "Ran az provider register --namespace Microsoft.KeyVault, waited for Registered state.",
        "None",
    ),
    (
        "Key Vault: Forbidden on secret write",
        "After vault creation, az keyvault secret set returned Forbidden (ForbiddenByRbac). The vault uses RBAC access model; the CLI identity had no secrets permissions.",
        "Assigned Key Vault Secrets Officer role to the signed-in user's object ID on the vault scope.",
        "None",
    ),
    (
        "Storage account: name taken globally",
        "heedstorage was already taken by another Azure customer globally.",
        "Used heedhackstorage001 instead.",
        "None",
    ),
    (
        "Phase B: Cosmos connection string format",
        "COSMOS_CONNECTION_STRING in .env was empty or malformed, causing 'missing AccountEndpoint' error.",
        "Retrieved full connection string via az cosmosdb keys list and pasted the complete value (AccountEndpoint=...;AccountKey=...;) without quotes.",
        "None",
    ),
    (
        "Phase B: Wrong Azure OpenAI endpoint",
        "The az cognitiveservices account show command returns https://southeastasia.api.cognitive.microsoft.com/ — a generic multi-service endpoint. The OpenAI SDK could not find deployments at this URL, returning 404 Resource not found.",
        "Discovered that model deployments were created via Azure AI Foundry, which uses a separate project endpoint: https://heed-resource.services.ai.azure.com. Updated AZURE_OPENAI_ENDPOINT in .env to this URL.",
        "Two separate endpoints now exist: the cognitive services base URL (unused) and the AI Foundry project endpoint (used by all agents). Key Vault openai-endpoint secret updated accordingly.",
    ),
    (
        "Phase B: heed-embed not visible via CLI",
        "az cognitiveservices account deployment list only showed heed-advisor and heed-keeper, not heed-embed, even though the portal showed all three. The CLI lists deployments on the base cognitive services resource; AI Foundry manages deployments separately.",
        "Confirmed heed-embed exists via the AI Foundry portal. Used the AI Foundry project endpoint and key instead of the cognitive services key.",
        "None — all three deployments are accessible via the AI Foundry endpoint.",
    ),
    (
        "Phase B: API key mismatch",
        "Using the openai-heed cognitive services key against the AI Foundry endpoint returned 401 AuthenticationError.",
        "Retrieved the project-specific API key from ai.azure.com → project Settings. Updated AZURE_OPENAI_KEY in .env and Key Vault.",
        "None",
    ),
]

prob_table = doc.add_table(rows=1, cols=4)
prob_table.style = "Table Grid"
headers = ["Problem", "What happened", "Resolution", "Residual impact"]
for i, h in enumerate(headers):
    prob_table.rows[0].cells[i].text = h
    prob_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True

for title_p, what, resolution, residual in problems:
    row = prob_table.add_row()
    row.cells[0].text = title_p
    row.cells[1].text = what
    row.cells[2].text = resolution
    row.cells[3].text = residual

doc.add_paragraph()

# ── 6. Final Resource Inventory ───────────────────────────────────────────────
doc.add_heading("6. Final Resource Inventory", 1)

inv_table = doc.add_table(rows=1, cols=4)
inv_table.style = "Table Grid"
for i, h in enumerate(["Step", "Resource name", "Status", "Notes"]):
    inv_table.rows[0].cells[i].text = h
    inv_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True

inventory = [
    ("1", "Resource group: heed", "Done", "Pre-existing, southeastasia"),
    ("2", "Cosmos DB: cosmos-heed", "Done", "Provisioned throughput (not serverless)"),
    ("2", "Database: heed", "Done", "4 containers: users, tasks, completions, user_context"),
    ("3", "AI Search: gratitudechain-search", "Done", "Reused from gratitudechain-rg"),
    ("4", "Azure OpenAI: openai-heed", "Done", "3 deployments via AI Foundry: heed-advisor (gpt-4o), heed-keeper (gpt-4o-mini), heed-embed (text-embedding-3-small)"),
    ("5", "Bing Search v7", "Skipped", "Deprecated — new accounts blocked by Microsoft"),
    ("6", "Key Vault: kv-heed-hack", "Done", "RBAC mode, 4 secrets stored"),
    ("7", "Storage: heedhackstorage001", "Done", "Required for Function App"),
    ("7", "Function App: func-heed", "Done", "Python 3.11, managed identity, KV Secrets User role"),
    ("8", "Static Web App: swa-heed", "Done", "Free tier, East Asia, GitHub connected"),
]
for step, name, status, notes in inventory:
    add_status_row(inv_table, step, name, status, notes)

doc.add_paragraph()

# ── 7. Secrets in Key Vault ───────────────────────────────────────────────────
doc.add_heading("7. Secrets in Key Vault", 1)
doc.add_paragraph("The following secrets are stored in kv-heed-hack. Values are not recorded here.")

sec_table = doc.add_table(rows=1, cols=3)
sec_table.style = "Table Grid"
for i, h in enumerate(["Secret name", "What it contains", "Used by"]):
    sec_table.rows[0].cells[i].text = h
    sec_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True
secrets = [
    ("cosmos-connection-string", "Primary connection string for cosmos-heed", "cosmos_tool.py, load_seed.py"),
    ("search-admin-key", "Admin key for gratitudechain-search", "search_tool.py, load_seed.py"),
    ("openai-endpoint", "AI Foundry project endpoint (https://heed-resource.services.ai.azure.com)", "advisor.py, memory_keeper.py, search_tool.py"),
    ("openai-key", "AI Foundry project API key (not the cognitive services key)", "advisor.py, memory_keeper.py, search_tool.py"),
]
for name, content, used in secrets:
    r = sec_table.add_row()
    r.cells[0].text = name
    r.cells[1].text = content
    r.cells[2].text = used

doc.add_paragraph()

# ── 8. Known Gaps ─────────────────────────────────────────────────────────────
doc.add_heading("8. Known Gaps and Next Steps", 1)
gaps = [
    ("Cosmos DB not serverless", "Medium", "Negligible cost impact at demo scale. Post-hackathon: recreate with serverless if the product continues."),
    ("Shared AI Search service", "Low", "Monitor index count on gratitudechain-search. If limit hit, upgrade to Basic tier (~$0.10/hr)."),
    ("Bing grounding disabled", "Low", "bing_tool.py is preserved. If Microsoft re-enables v7 or a replacement is available, wire up the key and it activates automatically."),
    ("No infra-as-code", "Low", "All resources created via CLI/portal. Post-hackathon: write Bicep templates in infra/ for reproducibility."),
    ("No rate limiting on Functions", "Low", "Single-user demo — not a risk at this scale. Production would add API Management."),
    ("Two OpenAI endpoints in play", "Low", "The cognitive services base URL (southeastasia.api.cognitive.microsoft.com) and the AI Foundry project endpoint (heed-resource.services.ai.azure.com) both exist. All agents use the Foundry endpoint. The base URL is unused but still incurs the resource cost."),
    ("task_memory index not auto-reindexed from Cosmos", "Medium", "The load_seed.py loader was a one-time push. A live Cosmos indexer was not configured. Post-Phase C: set up an AI Search indexer pointing at the Cosmos change feed to keep task_memory in sync as tasks are updated."),
]

gap_table = doc.add_table(rows=1, cols=3)
gap_table.style = "Table Grid"
for i, h in enumerate(["Gap", "Severity", "Mitigation / Next step"]):
    gap_table.rows[0].cells[i].text = h
    gap_table.rows[0].cells[i].paragraphs[0].runs[0].bold = True
for gap, sev, mit in gaps:
    r = gap_table.add_row()
    r.cells[0].text = gap
    r.cells[1].text = sev
    r.cells[2].text = mit

# ── Save ──────────────────────────────────────────────────────────────────────
out_path = Path(__file__).parent / "docs" / "Heed_Azure_Setup.docx"
doc.save(out_path)
print(f"Saved: {out_path}")
