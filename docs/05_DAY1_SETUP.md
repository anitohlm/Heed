# Day 1 — Azure Setup

This document is the Day 1 infrastructure checklist. Estimated time: 3 hours including troubleshooting.

By the end of Day 1: all Azure resources exist, secrets are in Key Vault, seed data is loaded into Cosmos, and AI Search indexes are populated. No agent code yet — that is Day 2.

## Prerequisites

- Azure account with active subscription
- Azure CLI installed (`az --version` returns a version)
- Node 18+ and Python 3.11+ installed
- VS Code with the Azure Functions extension
- Empty GitHub repo named `heed`, cloned locally

---

## 1. Create resource group

```bash
az login
az group create --name rg-heed-hack --location southeastasia
```

Region rationale: lowest latency from PH; all required services available.

## 2. Provision the data layer

### Cosmos DB

- Portal → create `cosmos-heed`, NoSQL API, Serverless capacity mode
- Create database `heed`
- Create four containers:
  - `users` — partition key `/id`
  - `tasks`, `completions`, `user_context` — partition key `/user_id`
- Note the **primary connection string** (will be moved to Key Vault)

### Azure AI Search

- Portal → create `search-heed`, Free tier (50MB, sufficient for seed data)
- Note the **admin key** (will be moved to Key Vault)
- Indexes are created by the loader script in step 6

## 3. Provision the model layer

### Azure AI Foundry / OpenAI

Model deployment can take 10+ minutes per model.

- Create `openai-heed`
- Deploy three models in sequence:
  1. `gpt-4o` — deployment name `heed-advisor`
  2. `gpt-4o-mini` — deployment name `heed-keeper`
  3. `text-embedding-3-small` — deployment name `heed-embed`
- Note the **endpoint URL** and **key**

If `gpt-4o` is not available in southeastasia, fall back to eastus2 and document the cross-region setup in the README.

### Bing grounding

- Portal → search "Bing Search v7"
- Create resource on F1 (free) tier
- Note the **subscription key**

## 4. Provision Key Vault and store secrets

```bash
az keyvault create --name kv-heed-hack --resource-group rg-heed-hack --location southeastasia
```

Add secrets via portal or CLI:
- `cosmos-connection-string`
- `search-admin-key`
- `openai-endpoint`
- `openai-key`
- `bing-key`

Create `functions/local.settings.json` (gitignored):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "KEY_VAULT_NAME": "kv-heed-hack",
    "COSMOS_DATABASE": "heed",
    "OPENAI_DEPLOYMENT_ADVISOR": "heed-advisor",
    "OPENAI_DEPLOYMENT_KEEPER": "heed-keeper",
    "OPENAI_DEPLOYMENT_EMBED": "heed-embed"
  }
}
```

Also create `functions/local.settings.json.example` (committed) with the same shape but no values.

## 5. Provision the compute layer

### Azure Functions

- Create Function App `func-heed`, Python 3.11, Consumption plan
- Same region as Cosmos (southeastasia)
- Enable Managed Identity → grant `Key Vault Secrets User` role on `kv-heed-hack`

### Azure Static Web Apps

- Create `swa-heed`, Free tier
- Connect to GitHub repo `heed`, branch `main`
- Build presets: Next.js
- App location: `web`
- API location: leave blank (external Functions, not integrated API)
- Output location: leave default

The first deploy will fail because there is no code yet. This is expected — code is pushed in step 7.

## 6. Load seed data

Copy `data/seed-data/` and the loader script (`data/load_seed.py`) into the repo. Install dependencies:

```bash
cd data
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install azure-cosmos azure-search-documents azure-identity python-dotenv
```

Set local environment variables in `data/.env` (gitignored), then run:

```bash
python load_seed.py
```

The script:
1. Connects to Cosmos and creates containers if missing
2. Loads the four JSON files into the four containers
3. Connects to AI Search and creates the `task_memory` and `ph_calendar` indexes
4. Pushes documents into both indexes

Verification: open Cosmos Data Explorer, browse `tasks`, see 18 records. Open AI Search portal, query `task_memory`, see results.

## 7. Bare-bones deploy

This step confirms the deployment pipeline works before any real code is written.

- In `web/`: create a Next.js project with one page that says "Heed — coming soon" and one API route returning hardcoded JSON.
- In `functions/`: create one HTTP-triggered Function returning "hello from Functions" and reading one Cosmos record to confirm connectivity.
- Push to GitHub. Static Web App auto-deploys.
- Manually deploy Functions:

```bash
cd functions
func azure functionapp publish func-heed
```

- Open the SWA URL. Confirm the page loads.
- Curl the Functions URL. Confirm a 200 response.

## End-of-day checkpoint

All of the following must be true:

- [ ] Resource group exists with all named resources
- [ ] All five secrets in Key Vault
- [ ] Functions has Managed Identity wired to Key Vault
- [ ] Cosmos has seed data loaded (18 tasks, 432 completions in Data Explorer)
- [ ] AI Search has both indexes populated
- [ ] Bare-bones SWA deployed and accessible at a public URL
- [ ] Bare-bones Functions deployed and accessible
- [ ] curl to the Functions endpoint returns 200

## Scope reduction options if behind schedule

If end-of-day checkpoint is not met, drop scope in this order:

1. Drop the timer-triggered Function (rebuild Day 4 if time)
2. Drop Bing grounding (use only indexed data)
3. Cut model deployments to GPT-4o only (skip mini)

Do not drop:
- The bare-bones deploy
- Seed data loading
- Key Vault setup

## Day 1 scope explicitly excludes

- Agent code (advisor.py, memory_keeper.py)
- UI customization in /web beyond hello world
- Authentication
- CI/CD beyond what SWA provides
- Alternative compute (Container Apps, AKS)
