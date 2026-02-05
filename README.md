# 🛡️ AI Smart Contract Auditor

A Next.js web application that uses AI to perform security audits on Solidity smart contracts, following the **Trail of Bits Testing Handbook** methodology.

## ✨ Features

- **📤 Drag & Drop Upload**: Upload Solidity contracts and test files
- **🤖 Multiple AI Providers**: Supports LiteLLM proxy, Anthropic Claude, and OpenAI
- **⚡ Quick & Deep Audit Modes**: Fast overview or comprehensive analysis
- **🎯 Context-Aware Analysis**: Configure target networks, protocol type, and integrations
- **📋 Professional Audit Report**: Generates a comprehensive security audit report with:
  - Executive summary with risk assessment matrix
  - Detailed findings with Before/After code examples
  - Exploit scenarios and proof-of-concept code (Deep mode)
  - Architecture review and recommendations
- **👀 Live Preview**: View reports in rendered markdown or raw format
- **⬇️ Download**: Export reports as markdown files
- **🌐 Network-Specific Checks**: PUSH0 compatibility, L2 sequencer risks, and more

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- One of the following API keys:
  - **LiteLLM Proxy** (recommended for organizations)
  - **Anthropic API key** ([get one here](https://console.anthropic.com/))
  - **OpenAI API key** ([get one here](https://platform.openai.com/))

### Installation

1. **Install dependencies**:
   ```bash
   cd smart-contract-auditor
   npm install
   ```

2. **Configure your API key** (choose ONE option):
   
   Create a `.env` file:
   ```bash
   cp .env.example .env
   ```
   
   **Option A: LiteLLM Proxy (Recommended)**
   ```env
   LITELLM_API_KEY=sk-your-litellm-key
   LITELLM_BASE_URL=https://api.ai.tokamak.network
   LITELLM_MODEL=claude-sonnet-4.5
   ```
   
   **Option B: Direct Anthropic**
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```
   
   **Option C: Direct OpenAI**
   ```env
   OPENAI_API_KEY=sk-your-openai-key-here
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open the app**:
   Visit [http://localhost:3000](http://localhost:3000)

## 📖 How to Use

### 1. Upload Contracts
Drag and drop your `.sol` files into the contracts upload area.

### 2. Add Tests (Optional)
Upload test files for coverage analysis context.

### 3. Configure Audit Context (Optional but Recommended)
Expand the **Audit Context Configuration** section to provide context for more accurate detection:

#### Target Deployment Networks
Select where your contracts will be deployed. This enables:
- **PUSH0 warnings** for networks that don't support it (zkSync, Polygon, BSC, etc.)
- **L2 sequencer risk checks** for Optimism, Arbitrum, Base, etc.
- **Network-specific precompile compatibility**

#### Protocol Category
Choose your protocol type to enable specialized checks:
| Category | Special Checks |
|----------|---------------|
| DeFi - Lending | Liquidation attacks, bad debt, interest manipulation |
| DeFi - DEX/AMM | MEV, sandwich attacks, slippage exploits |
| DeFi - Yield/Vault | Share manipulation, first depositor attacks |
| Bridge/Cross-chain | Message replay, finality issues |
| Staking | Withdrawal delays, slashing conditions |

#### Upgrade Pattern
Select your upgrade mechanism for targeted checks:
- **Not Upgradeable**: Standard immutable contract checks
- **UUPS**: Missing `_authorizeUpgrade`, selfdestruct risks
- **Transparent Proxy**: Admin slot collision, selector clashing
- **Diamond (EIP-2535)**: Facet conflicts, storage corruption

#### External Integrations
Check the protocols you integrate with:
- **Chainlink**: Stale price checks, sequencer uptime feeds
- **Uniswap**: TWAP vs spot price, flash swap validation
- **Aave/Compound**: Liquidation bonus exploits
- **LayerZero/Wormhole**: Cross-chain message validation

#### Additional Flags
- **Uses Flash Loans**: Prioritizes price manipulation vectors
- **Handles Native ETH**: Checks for stuck ETH, reentrancy via receive()
- **Has Privileged Roles**: Centralization analysis, admin key risks
- **EOA-Only Functions**: tx.origin checks, contract interaction issues

### 4. Choose Audit Mode

| Mode | Time | Output | Best For |
|------|------|--------|----------|
| ⚡ **Quick Audit** | ~1 min | Concise report, all severities, brief descriptions | Fast overview, initial assessment |
| 🔍 **Deep Audit** | ~2-3 min | Comprehensive report, detailed exploit paths, code examples | Full security review, pre-deployment |

### 5. Review Results
- **Preview**: View rendered markdown with syntax highlighting
- **Raw**: See the raw markdown source
- **Download**: Export as `.md` files

## 🧠 How the AI Audit Works

The AI auditor combines multiple security knowledge sources with contextual understanding to deliver accurate, relevant findings.

### Knowledge Foundation

The system is built on three authoritative security methodologies:

1. **Trail of Bits Testing Handbook** - Industry-standard vulnerability patterns and testing procedures
2. **Cyfrin Audit Checklist** - Comprehensive smart contract security checklist from professional auditors  
3. **RareSkills Security Guides** - Advanced DeFi-specific attack patterns and edge cases

These are embedded into the system prompt, giving the AI a structured framework for what to look for and how to classify findings.

### Context-Aware Analysis

The **Audit Context Configuration** directly influences what the AI checks for:

| Context Type | What It Enables |
|-------------|-----------------|
| **Network Selection** | L2 sequencer risks, PUSH0 compatibility, EVM version-specific vulnerabilities |
| **Protocol Category** | Category-specific checklists (lending → liquidation attacks, DEX → MEV/slippage, bridges → replay attacks) |
| **External Integrations** | Integration-aware checks (Chainlink → stale prices, Uniswap → slot0 manipulation, LayerZero → message validation) |
| **Upgrade Pattern** | Proxy-specific vulnerabilities (UUPS → `_authorizeUpgrade`, Transparent → admin slot collision) |

### Dynamic Checklist Loading

Instead of checking everything generically, the system:

1. **Detects contract type** from the source code (ERC20, DeFi, Bridge, etc.)
2. **Loads relevant checklists** based on detected patterns + user-provided context
3. **Applies false-positive guards** to prevent common misclassifications (e.g., reentrancy in standard ERC20)

This means:
- **More relevant findings** - Checks match your actual contract architecture
- **Fewer false positives** - Context prevents irrelevant warnings
- **Appropriate severity** - Network/integration context influences risk assessment

### Quick vs Deep Mode

| Aspect | Quick Mode | Deep Mode |
|--------|------------|-----------|
| **AI Model** | Claude Sonnet 4.5 (fast, cost-effective) | Claude Opus 4.5 (best quality) |
| **Token Budget** | ~10K tokens | ~20K tokens |
| **Checklist** | Core checks only (~20 items) | Full contextual checklist (~50+ items) |
| **Output** | Concise findings, brief descriptions | Detailed exploits, multiple remediation options |
| **Best For** | Initial assessment, CI/CD integration | Pre-deployment review, thorough analysis |
| **Cost** | $ | $$$$$ (~5x more) |

---

## 🔍 Audit Methodology

Follows **Trail of Bits Testing Handbook**, checking for:

### Classic Vulnerabilities
- ✅ Access Control vulnerabilities
- ✅ Reentrancy issues (including cross-function and read-only)
- ✅ Locked Ether problems
- ✅ Integer overflow/underflow
- ✅ Front-running vulnerabilities
- ✅ Input validation issues
- ✅ Proxy pattern safety

### Advanced DeFi Patterns
- ✅ Flash loan attack vectors
- ✅ Oracle manipulation (TWAP bypasses, spot price attacks)
- ✅ MEV extraction points (sandwich attacks)
- ✅ First depositor / donation attacks
- ✅ Precision loss and rounding attacks
- ✅ Governance flash loan voting

### Network-Specific Issues
- ✅ PUSH0 opcode compatibility (Solidity ≥0.8.20)
- ✅ L2 sequencer downtime handling
- ✅ Cross-chain message validation
- ✅ Precompile availability per network

### Severity Classification

| Level | Emoji | Description |
|-------|-------|-------------|
| Critical | 🔴 | Complete loss of funds or control |
| High | 🟠 | Significant loss of funds or functionality |
| Medium | 🟡 | Limited loss or degraded functionality |
| Low | 🔵 | Minor issues, best practices |
| Info | ℹ️ | Code quality, gas optimization |

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v4
- **AI Providers**: 
  - LiteLLM Proxy (OpenAI-compatible)
  - Anthropic Claude (claude-sonnet-4)
  - OpenAI GPT-4o
- **Icons**: Lucide React
- **Markdown**: react-markdown + remark-gfm

## 📁 Project Structure

```
smart-contract-auditor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── audit/route.ts    # AI audit endpoint
│   │   │   └── providers/route.ts # Available providers
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Main audit form
│   │   └── globals.css
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── FileUpload.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── ReportPreview.tsx
│   │   └── AuditContextForm.tsx  # Context configuration
│   └── lib/
│       ├── playbook.ts           # Audit methodology & system prompt
│       ├── auditChecklist.ts     # Cyfrin/RareSkills security checklists
│       ├── types.ts              # TypeScript types
│       └── sampleReports.ts      # Demo preview data
├── test-contracts/               # Regression test suite
│   ├── vulnerable/               # Intentionally vulnerable contracts
│   │   ├── VulnerableBridge.sol  # 8 known vulnerabilities
│   │   └── VulnerableVault.sol   # 7 known vulnerabilities
│   ├── safe/                     # False positive tests
│   │   └── SafePatterns.sol      # 5 safe patterns that should NOT be flagged
│   ├── results/                  # Historical test results (JSON)
│   └── test-definitions.json     # Machine-readable expected findings
├── scripts/
│   └── test-regression.js        # Automated regression test runner
├── .env.example
└── package.json
```

## 🧪 Regression Testing

**Why Regression Testing?**

The AI auditor's quality depends heavily on its prompts (`playbook.ts`) and security checklists (`auditChecklist.ts`). When we tweak these to improve detection of certain vulnerabilities, we might accidentally introduce false positives or miss other issues. Regression testing provides **objective, reproducible metrics** to validate that changes actually improve audit quality without breaking existing detection capabilities.

The test suite uses intentionally vulnerable smart contracts with known security issues. After each change, we measure:
- **Detection rate**: Are critical vulnerabilities being caught?
- **False positive rate**: Is safe code incorrectly flagged as high-severity?
- **Consistency**: Do results stay stable across runs?

This transforms audit quality from subjective ("seems better") to measurable ("detection improved from 75% → 87.5%").

### Test Contracts

| Contract | Type | Vulnerabilities | Purpose |
|----------|------|-----------------|---------|
| `VulnerableBridge.sol` | Bridge | 8 intentional + 1 FP test | Critical vuln detection |
| `VulnerableVault.sol` | DeFi Vault | 7 intentional + 1 FP test | DeFi-specific patterns |
| `SafePatterns.sol` | Safe Code | 5 safe patterns | False positive prevention |

### Running Tests

```bash
# Start the dev server (required)
npm run dev

# In another terminal:

# Quick mode (default) - ~1 min per contract
npm run test:audit

# Deep mode - ~2-3 min per contract
npm run test:audit:deep

# Test specific contract only
npm run test:audit -- --contract bridge
npm run test:audit -- --contract vault

# CI mode (exits with code 1 on failure)
npm run test:audit:ci
```

### Understanding Results

The test runner checks three categories of findings:

| Category | Icon | Pass Criteria |
|----------|------|---------------|
| **Must Detect** | 🔴 | 100% required - Critical vulns that MUST be found |
| **Should Detect** | 🟠 | Important but minor misses acceptable |
| **Nice to Detect** | 🔵 | Bonus points for thoroughness |
| **False Positives** | 🚫 | 0% is the goal - Safe code flagged as Critical/High |

### Example Output

```
════════════════════════════════════════════════════════════
  📋 Testing: VulnerableBridge
════════════════════════════════════════════════════════════

  🔴 MUST DETECT:
    ✅ VULN-1: Uninitialized storage variables [CRITICAL]
    ✅ VULN-2: Arbitrary token bridging [CRITICAL]
    ✅ VULN-4: Integer underflow DoS in withdrawal [HIGH]

  🟠 SHOULD DETECT:
    ✅ VULN-5: Bypassable EOA check [HIGH]
    ⚠️ VULN-7: Missing replay protection [HIGH]

  🚫 FALSE POSITIVE TESTS:
    ✅ PASS: safeWithdraw() CEI pattern should NOT be flagged

  📊 SCORES:
    Must Detect:  3/3 (100.0%)
    Overall:      7/8 (87.5%)
    False Positive: 0/1 (0%)

════════════════════════════════════════════════════════════
  ✅ ALL TESTS PASSED
════════════════════════════════════════════════════════════
```

### Comparing Quick vs Deep Mode

Run both modes to see the quality difference:

```bash
# Quick mode
npm run test:audit

# Deep mode  
npm run test:audit:deep
```

Results are saved to `test-contracts/results/` with timestamps, allowing you to:
- Track quality improvements over time
- Compare detection rates between modes
- Identify regressions after code changes

### Target Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Must Detect | **100%** | Non-negotiable critical findings |
| Overall Detection | **≥80%** | Higher is better |
| False Positive Rate | **0%** | Safe code should not be flagged as Critical/High |

## 🤖 GitHub Actions CI/CD

The project includes automated regression testing via GitHub Actions to prevent quality regressions when modifying the audit logic.

### How It Works

The workflow (`.github/workflows/audit-regression.yml`) automatically runs when:

| Trigger | What Runs | Use Case |
|---------|-----------|----------|
| **Push to main** | Quick mode tests | Fast feedback after merge |
| **PR to main** | Quick + Deep mode tests | Full validation before merge |
| **Manual trigger** | Quick mode tests | On-demand testing |

**Only triggers when these files change:**
- `src/lib/playbook.ts` — System prompt & methodology
- `src/lib/auditChecklist.ts` — Security checklists

### Setup (One-time)

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the secret:
   - **Name:** `LITELLM_API_KEY`
   - **Value:** Your LiteLLM API key

### Running Manually

1. Go to your GitHub repo → **Actions** tab
2. Select **"Audit Quality Regression Tests"** from the left sidebar
3. Click **"Run workflow"** dropdown (top right)
4. Select branch (`main`) and click **"Run workflow"**

![Manual trigger location](https://docs.github.com/assets/cb-37128/images/help/actions/workflow-dispatch-run.png)

### What the Workflow Does

```
1. Checkout code
2. Setup Node.js 20
3. Install dependencies (npm ci)
4. Create .env from GitHub Secrets
5. Build the app (npm run build)
6. Start production server
7. Run regression tests
8. Upload results as artifacts
9. Comment on PR with results table (if PR)
10. Fail CI if tests don't pass
```

### CI Pass/Fail Criteria

| Condition | Result |
|-----------|--------|
| Must Detect = 100% AND False Positives = 0% | ✅ **Pass** |
| Must Detect < 100% | ❌ **Fail** |
| False Positives > 0% | ❌ **Fail** |

### Viewing Results

**After a run completes:**

1. Go to **Actions** → Click on the workflow run
2. **Summary tab**: See pass/fail status
3. **Artifacts section**: Download `regression-test-results` for detailed JSON
4. **PR comments**: If triggered by PR, results are posted as a comment

### Example PR Comment

When a PR triggers the workflow, it automatically comments with results:

```markdown
## 🛡️ Audit Regression Test Results

### ✅ QUICK Mode
| Metric | Result |
|--------|--------|
| Must Detect | 3/3 (100.0%) |
| Overall | 8/8 (100.0%) |
| False Positives | 0/1 (0%) |
| Time | 91.4s |

### ✅ DEEP Mode
| Metric | Result |
|--------|--------|
| Must Detect | 3/3 (100.0%) |
| Overall | 8/8 (100.0%) |
| False Positives | 0/1 (0%) |
| Time | 185.2s |
```

### Protecting Main Branch (Optional)

To require tests to pass before merging:

1. Go to **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Check **"Require status checks to pass before merging"**
4. Select **"Run Audit Regression Tests"**
5. Save changes

Now PRs cannot be merged until regression tests pass.

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LITELLM_API_KEY` | One of these | LiteLLM proxy API key |
| `LITELLM_BASE_URL` | With LiteLLM | Proxy endpoint URL |
| `LITELLM_MODEL` | With LiteLLM | Model name (e.g., claude-sonnet-4.5) |
| `ANTHROPIC_API_KEY` | One of these | Direct Anthropic API key |
| `OPENAI_API_KEY` | One of these | Direct OpenAI API key |

### Supported Networks

| Network | Type | PUSH0 Support |
|---------|------|---------------|
| Ethereum Mainnet | L1 | ✅ Yes |
| Optimism, Base, Blast, Mode | L2 - OP Stack | ✅ Yes |
| Arbitrum One | L2 - Arbitrum | ✅ Yes |
| zkSync Era | L2 - zkEVM | ❌ No |
| Linea, Scroll | L2 - zkEVM | ❌ No |
| Polygon PoS | Sidechain | ❌ No |
| BNB Smart Chain | Sidechain | ❌ No |
| Avalanche C-Chain | Alt L1 | ❌ No |

---

**⚠️ Disclaimer**: This tool provides AI-generated security analysis and should not replace professional security audits for production contracts.
