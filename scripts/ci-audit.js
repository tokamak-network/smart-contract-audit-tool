#!/usr/bin/env node

/**
 * CI Audit Script - Runs security audit on changed Solidity files
 * Uses qwen3-coder-flash via Tokamak Network LiteLLM proxy (FREE)
 * 
 * Usage: node scripts/ci-audit.js <file-list.txt>
 *   OR:  node scripts/ci-audit.js path/to/Contract.sol [path/to/Other.sol ...]
 * 
 * Environment variables:
 *   LITELLM_API_KEY   - API key for Tokamak LiteLLM proxy
 *   LITELLM_BASE_URL  - LiteLLM proxy URL (default: https://api.ai.tokamak.network)
 *   LITELLM_MODEL     - Model to use (default: qwen3-coder-flash)
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────

const LITELLM_API_KEY = process.env.LITELLM_API_KEY;
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'https://api.ai.tokamak.network';
const MODEL = process.env.LITELLM_MODEL || 'qwen3-coder-flash';
const MAX_TOKENS = 16000;
const REPORT_PATH = '/tmp/audit-report.md';

// ─── Severity thresholds for exit codes ─────────────────────────────────────
// Exit 0 = pass, Exit 1 = has critical/high findings
const FAIL_ON_CRITICAL = true;
const FAIL_ON_HIGH = false;

// ─── System prompt (condensed for CI) ───────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert smart contract security auditor. Perform a quick security audit.

## Rules
- Follow Trail of Bits Testing Handbook methodology
- Only report HIGH and MEDIUM confidence findings
- Do NOT flag reentrancy unless there is a specific callback mechanism (ERC777/ERC1155)
- Do NOT flag overflow/underflow in Solidity >=0.8.0 (built-in protection)
- If you cannot construct a concrete exploit, DOWNGRADE the severity
- Be concise — this runs in CI

## FALSE POSITIVE PREVENTION
- USDC/USDT/DAI = standard ERC20, no transfer callbacks
- Solidity >=0.8.0 has built-in overflow checks
- Check for constructors/initializers before flagging uninitialized state
- Do NOT flag test contracts, mocks, interfaces, or abstract contracts

## Severity
- 🔴 CRITICAL: Direct fund loss, no user action needed
- 🟠 HIGH: Fund loss with conditions, or severe DoS
- 🟡 MEDIUM: Limited impact, unusual conditions
- 🔵 LOW: Best practices, gas optimization
- ℹ️ INFO: Suggestions

## Output Format
Return a markdown report with:
1. Summary table: | Severity | Count |
2. Findings list (numbered: CRITICAL-1, HIGH-1, etc.)
3. Each finding: severity, location, description, impact, fix recommendation
4. Keep it under 3000 words

Respond ONLY with the markdown report. No JSON wrapping needed.`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveFiles(args) {
  if (args.length === 1 && args[0].endsWith('.txt')) {
    // Read file list from text file
    const content = fs.readFileSync(args[0], 'utf8').trim();
    return content.split('\n').filter(f => f.endsWith('.sol'));
  }
  return args.filter(f => f.endsWith('.sol'));
}

function readContracts(files) {
  const contracts = [];
  for (const file of files) {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ File not found: ${file}`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    contracts.push({ name: path.basename(file), path: file, content });
  }
  return contracts;
}

async function callLiteLLM(systemPrompt, userMessage) {
  const url = `${LITELLM_BASE_URL}/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LITELLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LiteLLM API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function hasCriticalFindings(report) {
  const critical = (report.match(/🔴\s*CRITICAL/gi) || []).length;
  const high = (report.match(/🟠\s*HIGH/gi) || []).length;
  
  return {
    critical,
    high,
    shouldFail: (FAIL_ON_CRITICAL && critical > 0) || (FAIL_ON_HIGH && high > 0),
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: ci-audit.js <file-list.txt | contract.sol ...>');
    process.exit(2);
  }

  if (!LITELLM_API_KEY) {
    console.error('❌ LITELLM_API_KEY is not set');
    console.error('   Add it as a GitHub secret: Settings → Secrets → LITELLM_API_KEY');
    process.exit(2);
  }

  // Resolve and read contract files
  const files = resolveFiles(args);
  if (files.length === 0) {
    console.log('✅ No Solidity files to audit');
    fs.writeFileSync(REPORT_PATH, '✅ No Solidity files changed — nothing to audit.\n');
    process.exit(0);
  }

  const contracts = readContracts(files);
  if (contracts.length === 0) {
    console.log('✅ No readable contracts found');
    fs.writeFileSync(REPORT_PATH, '✅ No readable contracts found — nothing to audit.\n');
    process.exit(0);
  }

  console.log(`🔍 Auditing ${contracts.length} contract(s) with ${MODEL}...`);
  contracts.forEach(c => console.log(`   📄 ${c.path}`));

  // Build the prompt
  let userMessage = '# Security Audit Request (CI/CD)\n\n';
  userMessage += `Audit the following ${contracts.length} Solidity contract(s):\n\n`;

  for (const contract of contracts) {
    userMessage += `## ${contract.name}\n`;
    userMessage += `Path: \`${contract.path}\`\n`;
    userMessage += '```solidity\n';
    userMessage += contract.content;
    userMessage += '\n```\n\n';
  }

  userMessage += '⚡ QUICK MODE — be concise. Focus on Critical and High findings.\n';

  // Call the API
  const startTime = Date.now();
  let report;
  
  try {
    report = await callLiteLLM(SYSTEM_PROMPT, userMessage);
  } catch (err) {
    console.error(`❌ Audit failed: ${err.message}`);
    fs.writeFileSync(REPORT_PATH, `❌ **Audit failed:** ${err.message}\n`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Audit completed in ${elapsed}s`);

  // Save report
  fs.writeFileSync(REPORT_PATH, report);
  console.log(`📝 Report saved to ${REPORT_PATH}`);

  // Check findings
  const { critical, high, shouldFail } = hasCriticalFindings(report);
  
  if (critical > 0) console.log(`🔴 ${critical} CRITICAL finding(s)`);
  if (high > 0) console.log(`🟠 ${high} HIGH finding(s)`);
  if (critical === 0 && high === 0) console.log('✅ No critical or high severity findings');

  if (shouldFail) {
    console.log('\n⛔ Audit gate: FAIL — critical issues detected');
    process.exit(1);
  }

  console.log('\n✅ Audit gate: PASS');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
