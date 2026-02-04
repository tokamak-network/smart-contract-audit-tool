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
│       ├── playbook.ts           # Audit methodology
│       ├── types.ts              # TypeScript types
│       └── sampleReports.ts      # Demo preview data
├── .env.example
└── package.json
```

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
