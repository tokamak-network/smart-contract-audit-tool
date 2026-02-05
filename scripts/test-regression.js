#!/usr/bin/env node

/**
 * AI Audit Regression Test Script
 * 
 * Tests the audit tool against known vulnerable contracts
 * and verifies detection rates.
 * 
 * Usage:
 *   npm run test:audit                    # Test all contracts (quick mode)
 *   npm run test:audit -- --deep          # Test all contracts (deep mode)
 *   npm run test:audit -- --contract bridge  # Test only bridge contract
 *   npm run test:audit -- --ci            # CI mode (exit code = fail)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = process.env.AUDIT_TEST_URL || 'http://localhost:3000';
const TEST_DIR = path.join(__dirname, '..', 'test-contracts');
const RESULTS_DIR = path.join(TEST_DIR, 'results');

// Parse CLI arguments
const args = process.argv.slice(2);
const AUDIT_DEPTH = args.includes('--deep') ? 'deep' : 'quick';
const CI_MODE = args.includes('--ci');
const CONTRACT_FILTER = args.find(a => a.startsWith('--contract='))?.split('=')[1]
  || (args.includes('--contract') ? args[args.indexOf('--contract') + 1] : null);

// Severity ranking for comparison
const SEVERITY_RANK = {
  'INFO': 0,
  'INFORMATIONAL': 0,
  'LOW': 1,
  'MEDIUM': 2,
  'HIGH': 3,
  'CRITICAL': 4,
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(msg, color = '') {
  if (CI_MODE && !color) {
    console.log(msg);
  } else {
    console.log(`${color}${msg}${colors.reset}`);
  }
}

// ============================================================================
// AUDIT API CLIENT
// ============================================================================

async function runAudit(contractContent, contractName, context, depth) {
  const payload = {
    contracts: [{ name: contractName, content: contractContent, type: 'contract' }],
    tests: [],
    protocolDescription: '',
    auditDepth: depth,
    context: context,
  };

  log(`\n  Calling audit API (${depth} mode)...`, colors.dim);

  const startTime = Date.now();
  
  const response = await fetch(`${BASE_URL}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Audit API returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  log(`  Audit completed in ${elapsed}s`, colors.dim);
  
  return data.report || data.result || '';
}

// ============================================================================
// DETECTION ANALYSIS
// ============================================================================

function checkFindingDetected(report, finding) {
  const reportLower = report.toLowerCase();
  
  // Check if ANY of the keywords appear in the report
  for (const keyword of finding.keywords) {
    const kw = keyword.toLowerCase();
    
    // Support regex patterns in keywords
    if (kw.includes('.*') || kw.includes('[') || kw.includes('(')) {
      try {
        const regex = new RegExp(kw, 'i');
        if (regex.test(report)) return true;
      } catch {
        // If regex fails, try as plain text
        if (reportLower.includes(kw)) return true;
      }
    } else {
      if (reportLower.includes(kw)) return true;
    }
  }
  
  return false;
}

function detectSeverityForFinding(report, finding) {
  // Try to find the severity associated with this finding in the report
  const reportLower = report.toLowerCase();
  
  // Look for severity indicators near the keyword matches
  for (const keyword of finding.keywords) {
    const kw = keyword.toLowerCase();
    const idx = reportLower.indexOf(kw);
    if (idx === -1) continue;
    
    // Check surrounding text (~500 chars before) for severity
    const contextBefore = reportLower.substring(Math.max(0, idx - 500), idx);
    
    if (contextBefore.includes('critical') || contextBefore.includes('🔴')) return 'CRITICAL';
    if (contextBefore.includes('high') || contextBefore.includes('🟠')) return 'HIGH';
    if (contextBefore.includes('medium') || contextBefore.includes('🟡')) return 'MEDIUM';
    if (contextBefore.includes('low') || contextBefore.includes('🔵')) return 'LOW';
    if (contextBefore.includes('info') || contextBefore.includes('ℹ️')) return 'INFO';
  }
  
  return null;
}

function checkFalsePositive(report, fp) {
  // Check if the false positive pattern exists in the report
  const reportLower = report.toLowerCase();
  
  // Check if ANY keyword is mentioned near a high severity
  let foundHighSeverity = false;
  
  for (const keyword of fp.keywords) {
    const kw = keyword.toLowerCase();
    const idx = reportLower.indexOf(kw);
    if (idx === -1) continue;
    
    // Check surrounding text for high severity
    const start = Math.max(0, idx - 800);
    const end = Math.min(reportLower.length, idx + 200);
    const context = reportLower.substring(start, end);
    
    const maxRank = SEVERITY_RANK[fp.maxAcceptableSeverity.toUpperCase()] || 1;
    
    // Check if context contains a severity above acceptable
    if ((context.includes('critical') || context.includes('🔴')) && maxRank < SEVERITY_RANK['CRITICAL']) {
      foundHighSeverity = true;
    }
    if ((context.includes('high') || context.includes('🟠')) && maxRank < SEVERITY_RANK['HIGH']) {
      foundHighSeverity = true;
    }
  }
  
  return foundHighSeverity; // true = FALSE POSITIVE detected (bad)
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function testContract(suite) {
  log(`\n${'═'.repeat(60)}`, colors.cyan);
  log(`  📋 Testing: ${suite.name}`, colors.bold + colors.cyan);
  log(`${'═'.repeat(60)}`, colors.cyan);
  
  // Read contract file
  const contractPath = path.join(TEST_DIR, suite.contractFile);
  if (!fs.existsSync(contractPath)) {
    log(`  ❌ Contract not found: ${contractPath}`, colors.red);
    return null;
  }
  
  const contractContent = fs.readFileSync(contractPath, 'utf-8');
  log(`  📄 Contract: ${suite.contractFile} (${contractContent.split('\n').length} lines)`);
  
  // Run audit
  let report;
  try {
    report = await runAudit(contractContent, path.basename(suite.contractFile), suite.context, AUDIT_DEPTH);
  } catch (err) {
    log(`  ❌ Audit failed: ${err.message}`, colors.red);
    return null;
  }
  
  if (!report || report.length < 100) {
    log(`  ❌ Empty or invalid report received`, colors.red);
    return null;
  }
  
  log(`  📊 Report length: ${report.length} chars\n`);
  
  // Analyze results
  const results = {
    name: suite.name,
    depth: AUDIT_DEPTH,
    timestamp: new Date().toISOString(),
    mustDetect: { found: 0, total: 0, items: [] },
    shouldDetect: { found: 0, total: 0, items: [] },
    niceToDetect: { found: 0, total: 0, items: [] },
    falsePositives: { triggered: 0, total: 0, items: [] },
  };
  
  // Check MUST DETECT
  if (suite.expectedFindings.mustDetect.length > 0) {
    log(`  🔴 MUST DETECT:`, colors.bold);
    for (const finding of suite.expectedFindings.mustDetect) {
      results.mustDetect.total++;
      const detected = checkFindingDetected(report, finding);
      results.mustDetect.found += detected ? 1 : 0;
      results.mustDetect.items.push({ ...finding, detected });
      
      const icon = detected ? '✅' : '❌';
      const color = detected ? colors.green : colors.red;
      log(`    ${icon} ${finding.id}: ${finding.description} [${finding.severity}]`, color);
    }
  }
  
  // Check SHOULD DETECT
  if (suite.expectedFindings.shouldDetect.length > 0) {
    log(`\n  🟠 SHOULD DETECT:`, colors.bold);
    for (const finding of suite.expectedFindings.shouldDetect) {
      results.shouldDetect.total++;
      const detected = checkFindingDetected(report, finding);
      results.shouldDetect.found += detected ? 1 : 0;
      results.shouldDetect.items.push({ ...finding, detected });
      
      const icon = detected ? '✅' : '⚠️';
      const color = detected ? colors.green : colors.yellow;
      log(`    ${icon} ${finding.id}: ${finding.description} [${finding.severity}]`, color);
    }
  }
  
  // Check NICE TO DETECT
  if (suite.expectedFindings.niceToDetect.length > 0) {
    log(`\n  🔵 NICE TO DETECT:`, colors.bold);
    for (const finding of suite.expectedFindings.niceToDetect) {
      results.niceToDetect.total++;
      const detected = checkFindingDetected(report, finding);
      results.niceToDetect.found += detected ? 1 : 0;
      results.niceToDetect.items.push({ ...finding, detected });
      
      const icon = detected ? '✅' : '⬜';
      const color = detected ? colors.green : colors.dim;
      log(`    ${icon} ${finding.id}: ${finding.description} [${finding.severity}]`, color);
    }
  }
  
  // Check FALSE POSITIVES
  if (suite.expectedFindings.falsePositives.length > 0) {
    log(`\n  🚫 FALSE POSITIVE TESTS:`, colors.bold);
    for (const fp of suite.expectedFindings.falsePositives) {
      results.falsePositives.total++;
      const triggered = checkFalsePositive(report, fp);
      results.falsePositives.triggered += triggered ? 1 : 0;
      results.falsePositives.items.push({ ...fp, triggered });
      
      const icon = triggered ? '❌ FALSE POSITIVE' : '✅ PASS';
      const color = triggered ? colors.red : colors.green;
      log(`    ${icon}: ${fp.description}`, color);
    }
  }
  
  // Calculate scores
  const totalExpected = results.mustDetect.total + results.shouldDetect.total + results.niceToDetect.total;
  const totalFound = results.mustDetect.found + results.shouldDetect.found + results.niceToDetect.found;
  const criticalScore = results.mustDetect.total > 0 
    ? ((results.mustDetect.found / results.mustDetect.total) * 100).toFixed(1)
    : 'N/A';
  const overallScore = totalExpected > 0
    ? ((totalFound / totalExpected) * 100).toFixed(1)
    : 'N/A';
  const fpRate = results.falsePositives.total > 0
    ? ((results.falsePositives.triggered / results.falsePositives.total) * 100).toFixed(1)
    : '0';
  
  results.scores = {
    critical: criticalScore,
    overall: overallScore,
    falsePositiveRate: fpRate,
  };
  
  log(`\n  ${'─'.repeat(40)}`);
  log(`  📊 SCORES:`, colors.bold);
  
  const critColor = parseFloat(criticalScore) >= 100 ? colors.green : 
                     parseFloat(criticalScore) >= 80 ? colors.yellow : colors.red;
  log(`    Must Detect:  ${results.mustDetect.found}/${results.mustDetect.total} (${criticalScore}%)`, critColor);
  
  const overallColor = parseFloat(overallScore) >= 80 ? colors.green :
                        parseFloat(overallScore) >= 60 ? colors.yellow : colors.red;
  log(`    Overall:      ${totalFound}/${totalExpected} (${overallScore}%)`, overallColor);
  
  const fpColor = parseFloat(fpRate) === 0 ? colors.green : colors.red;
  log(`    False Positive: ${results.falsePositives.triggered}/${results.falsePositives.total} (${fpRate}%)`, fpColor);
  
  return results;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log(`\n${'═'.repeat(60)}`, colors.magenta);
  log(`  🛡️  AI Audit Regression Test Suite`, colors.bold + colors.magenta);
  log(`  Mode: ${AUDIT_DEPTH.toUpperCase()} | Target: ${BASE_URL}`, colors.magenta);
  if (CONTRACT_FILTER) log(`  Filter: ${CONTRACT_FILTER}`, colors.magenta);
  log(`${'═'.repeat(60)}`, colors.magenta);
  
  // Load test definitions
  const defsPath = path.join(TEST_DIR, 'test-definitions.json');
  if (!fs.existsSync(defsPath)) {
    log(`\n  ❌ Test definitions not found: ${defsPath}`, colors.red);
    process.exit(1);
  }
  
  const definitions = JSON.parse(fs.readFileSync(defsPath, 'utf-8'));
  let suites = definitions.testSuites;
  
  // Apply filter
  if (CONTRACT_FILTER) {
    suites = suites.filter(s => s.name.toLowerCase().includes(CONTRACT_FILTER.toLowerCase()));
    if (suites.length === 0) {
      log(`\n  ❌ No contracts match filter: "${CONTRACT_FILTER}"`, colors.red);
      process.exit(1);
    }
  }
  
  // Check server is running
  try {
    await fetch(`${BASE_URL}/api/providers`);
  } catch {
    log(`\n  ❌ Server not reachable at ${BASE_URL}`, colors.red);
    log(`  Run 'npm run dev' first, then try again.\n`, colors.yellow);
    process.exit(1);
  }
  
  log(`\n  ✅ Server is running at ${BASE_URL}`, colors.green);
  log(`  📦 Testing ${suites.length} contract(s)...`);
  
  // Run all tests
  const allResults = [];
  const startTime = Date.now();
  
  for (const suite of suites) {
    const result = await testContract(suite);
    if (result) allResults.push(result);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  log(`\n${'═'.repeat(60)}`, colors.magenta);
  log(`  📊 FINAL SUMMARY`, colors.bold + colors.magenta);
  log(`${'═'.repeat(60)}`, colors.magenta);
  
  let totalMust = 0, foundMust = 0;
  let totalAll = 0, foundAll = 0;
  let totalFP = 0, triggeredFP = 0;
  
  for (const r of allResults) {
    totalMust += r.mustDetect.total;
    foundMust += r.mustDetect.found;
    totalAll += r.mustDetect.total + r.shouldDetect.total + r.niceToDetect.total;
    foundAll += r.mustDetect.found + r.shouldDetect.found + r.niceToDetect.found;
    totalFP += r.falsePositives.total;
    triggeredFP += r.falsePositives.triggered;
    
    const status = (r.mustDetect.found === r.mustDetect.total && r.falsePositives.triggered === 0) 
      ? '✅ PASS' : '⚠️ ISSUES';
    log(`  ${status}  ${r.name}: Must=${r.mustDetect.found}/${r.mustDetect.total}, Overall=${r.scores.overall}%, FP=${r.falsePositives.triggered}`);
  }
  
  log(`\n  ${'─'.repeat(40)}`);
  
  const mustScore = totalMust > 0 ? ((foundMust / totalMust) * 100).toFixed(1) : '100';
  const allScore = totalAll > 0 ? ((foundAll / totalAll) * 100).toFixed(1) : '100';
  const fpScore = totalFP > 0 ? ((triggeredFP / totalFP) * 100).toFixed(1) : '0';
  
  log(`  Must Detect:     ${foundMust}/${totalMust} (${mustScore}%)`, parseFloat(mustScore) >= 100 ? colors.green : colors.red);
  log(`  Overall:         ${foundAll}/${totalAll} (${allScore}%)`, parseFloat(allScore) >= 80 ? colors.green : colors.yellow);
  log(`  False Positives: ${triggeredFP}/${totalFP} (${fpScore}%)`, parseFloat(fpScore) === 0 ? colors.green : colors.red);
  log(`  Time:            ${totalTime}s`);
  log(`  Mode:            ${AUDIT_DEPTH.toUpperCase()}`);
  
  // Save results
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const resultsFile = path.join(RESULTS_DIR, `${timestamp}-${AUDIT_DEPTH}.json`);
  
  const savedResults = {
    timestamp: new Date().toISOString(),
    depth: AUDIT_DEPTH,
    summary: {
      mustDetect: `${foundMust}/${totalMust} (${mustScore}%)`,
      overall: `${foundAll}/${totalAll} (${allScore}%)`,
      falsePositives: `${triggeredFP}/${totalFP} (${fpScore}%)`,
      totalTime: `${totalTime}s`,
    },
    contracts: allResults,
  };
  
  fs.writeFileSync(resultsFile, JSON.stringify(savedResults, null, 2));
  log(`\n  💾 Results saved: ${path.relative(process.cwd(), resultsFile)}`, colors.dim);
  
  // Final verdict
  const passed = parseFloat(mustScore) >= 100 && parseFloat(fpScore) === 0;
  
  log(`\n${'═'.repeat(60)}`, passed ? colors.green : colors.red);
  if (passed) {
    log(`  ✅ ALL TESTS PASSED`, colors.bold + colors.green);
  } else {
    log(`  ❌ TESTS FAILED`, colors.bold + colors.red);
    if (parseFloat(mustScore) < 100) log(`     Missing critical detections`, colors.red);
    if (parseFloat(fpScore) > 0) log(`     False positives detected`, colors.red);
  }
  log(`${'═'.repeat(60)}\n`, passed ? colors.green : colors.red);
  
  if (CI_MODE && !passed) {
    process.exit(1);
  }
}

main().catch(err => {
  log(`\n  ❌ Fatal error: ${err.message}`, colors.red);
  if (CI_MODE) process.exit(1);
});
