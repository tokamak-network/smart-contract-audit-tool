# VulnerableVault.sol - Expected Findings

**Total Vulnerabilities:** 7
**False Positive Tests:** 1

---

## 🔴 CRITICAL - Must Detect

### VULN-2: First Depositor Attack / Share Inflation
- **Location:** Lines 27-40 - `deposit()` function
- **Severity:** 🔴 CRITICAL
- **Description:** No minimum deposit amount allows attacker to:
  1. Deposit 1 wei, get 1 share
  2. Donate large amount directly to vault (inflates share price)
  3. Next depositor gets 0 shares due to rounding
- **Impact:** Complete theft of subsequent deposits
- **Detection Priority:** MUST DETECT

### VULN-6: Unrestricted Admin Fund Drainage
- **Location:** Lines 82-87 - `emergencyWithdraw()` function
- **Severity:** 🔴 CRITICAL
- **Description:** Owner can instantly drain all vault funds with no:
  - Timelock delay
  - Multisig requirement
  - User notification
- **Impact:** Rug pull capability, complete loss of user funds
- **Detection Priority:** MUST DETECT

---

## 🟠 HIGH - Should Detect

### VULN-4: Precision Loss - Division Before Multiplication
- **Location:** Line 47 - `convertToShares()` function
- **Severity:** 🟠 HIGH
- **Description:** `(assets / totalAssets()) * supply` loses precision
- **Correct:** `(assets * supply) / totalAssets()`
- **Impact:** Users receive fewer shares than entitled, value extraction
- **Detection Priority:** MUST DETECT

### VULN-5: Potential Underflow in Allowance
- **Location:** Line 65 - `allowed - shares` in withdraw
- **Severity:** 🟠 HIGH
- **Description:** No check that `allowed >= shares` before subtraction
- **Impact:** DoS if shares > allowed (reverts in 0.8.x)
- **Detection Priority:** SHOULD DETECT

### VULN-7: Not Using SafeERC20
- **Location:** Lines 37, 73 - `transferFrom()` and `transfer()`
- **Severity:** 🟠 HIGH
- **Description:** Direct ERC20 calls without SafeERC20 wrapper
- **Impact:** Silent failures with non-standard tokens (USDT), fund loss
- **Detection Priority:** MUST DETECT

---

## 🟡 MEDIUM - Nice to Detect

### VULN-1: Missing Zero Address Validation
- **Location:** Line 22 - constructor `_asset` parameter
- **Severity:** 🟡 MEDIUM
- **Description:** No check that `_asset != address(0)`
- **Impact:** Vault deployed with zero address asset is bricked
- **Detection Priority:** SHOULD DETECT

### VULN-3: No Slippage Protection
- **Location:** Lines 32-34 - `deposit()` function
- **Severity:** 🟡 MEDIUM
- **Description:** No `minShares` parameter to protect against front-running
- **Impact:** MEV bots can sandwich deposits, extracting value
- **Detection Priority:** NICE TO HAVE

---

## ❌ FALSE POSITIVE TEST

### FP-1: Documented Admin Functions (Should NOT Over-Flag)
- **Location:** Lines 90-99 - `pause()` and `unpause()` functions
- **Expected:** Should NOT be flagged as "unexpected centralization risk"
- **Reason:**
  - Functions are clearly labeled
  - Access control is explicit (`require(msg.sender == owner)`)
  - Pause functionality is standard and expected
  - Does NOT allow fund drainage (unlike VULN-6)
- **Acceptable Flagging:**
  - ℹ️ INFO: "Consider timelock for admin functions"
  - 🔵 LOW: "Centralization risk - owner can pause"
- **False Positive If:** Flagged as 🔴 CRITICAL or 🟠 HIGH

---

## Scoring Guide

### Quick Audit Target
- **Must Detect:** VULN-2, VULN-6, VULN-4 (3/3 Critical+High Core)
- **Should Not Flag:** FP-1 as Critical/High

### Deep Audit Target
- **Must Detect:** All 7 vulnerabilities
- **Should Not Flag:** FP-1 as Critical/High

### Detection Score Calculation

```
Quick Score = (Critical+High Found / 5) × 100%
Deep Score = (All Found / 7) × 100%
FP Score = 100% if FP-1 not flagged as Critical/High, 0% otherwise
```

---

## First Depositor Attack - Detailed Exploit

For VULN-2, the complete attack flow:

```solidity
// 1. Attacker is first depositor
vault.deposit(1, attacker);  // Gets 1 share

// 2. Attacker donates directly to vault (not through deposit)
asset.transfer(address(vault), 1_000_000e18);

// 3. Vault state: totalAssets = 1_000_000e18 + 1, totalSupply = 1

// 4. Victim deposits 500_000e18
// shares = (500_000e18 / 1_000_000e18) * 1 = 0 shares!

// 5. Victim gets 0 shares, attacker's 1 share now worth 1.5M tokens
```

**Fix:** Add minimum deposit amount and/or virtual shares offset.
