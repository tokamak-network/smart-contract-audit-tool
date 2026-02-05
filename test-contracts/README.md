# 🧪 Audit Tool Test Suite

This folder contains intentionally vulnerable contracts for testing the AI auditor's detection capabilities.

## Purpose

1. **Regression Testing** - Verify the auditor catches known vulnerabilities after code changes
2. **Quality Metrics** - Track detection rate over time
3. **False Positive Testing** - Ensure safe patterns aren't flagged incorrectly
4. **Mode Comparison** - Compare Quick vs Deep audit performance

## Structure

```
test-contracts/
├── README.md                         # This file
├── vulnerable/
│   ├── VulnerableBridge.sol          # Bridge with 8 vulnerabilities
│   ├── VulnerableBridge.vulns.md     # Expected findings
│   ├── VulnerableVault.sol           # DeFi vault with vulnerabilities
│   └── VulnerableVault.vulns.md      # Expected findings
├── safe/
│   ├── SafePatterns.sol              # Safe code that looks suspicious
│   └── SafePatterns.expected.md      # Should NOT flag these
└── results/
    └── .gitkeep                      # Store historical test results
```

## How to Use

### Manual Testing

1. Upload a vulnerable contract to the auditor
2. Run both Quick and Deep audits
3. Compare findings against the `.vulns.md` file
4. Record results in `results/` folder

### Scoring

For each contract, calculate:

```
Detection Rate = (Vulnerabilities Found / Expected Vulnerabilities) × 100%
False Positive Rate = (Incorrect Flags / Total Flags) × 100%
```

### Target Metrics

| Mode | Detection Rate | False Positive Rate |
|------|---------------|---------------------|
| Quick | ≥70% Critical/High | ≤20% |
| Deep | ≥90% All Severities | ≤10% |

## Vulnerability Categories

| Category | Contract | Count |
|----------|----------|-------|
| Bridge/Cross-chain | VulnerableBridge.sol | 8 |
| DeFi Vault | VulnerableVault.sol | 7 |
| False Positive Tests | SafePatterns.sol | 5 |

## Adding New Test Cases

When adding a new vulnerable contract:

1. Create `ContractName.sol` with intentional vulnerabilities
2. Create `ContractName.vulns.md` documenting:
   - Line numbers
   - Expected severity
   - Brief description
   - Whether it's a "MUST DETECT" or "NICE TO HAVE"
3. Include at least one FALSE POSITIVE test (safe code)

## Version History

| Date | Version | Quick Detection | Deep Detection | Notes |
|------|---------|-----------------|----------------|-------|
| 2024-XX-XX | Baseline | -% | -% | Initial test suite |
