/**
 * AI Security Audit Checklist
 * Based on Cyfrin's audit-checklist and RareSkills security guide
 * Organized for contextual loading to optimize token usage
 */

// ============================================================================
// CORE VULNERABILITY CHECKS (~50 items, always included)
// These are the most critical and common vulnerabilities
// ============================================================================

export const CORE_CHECKS = `
## CORE SECURITY CHECKLIST

### Reentrancy [CRITICAL]
- [ ] State changes AFTER external calls? → CEI pattern violation
- [ ] View functions readable during state changes? → Read-only reentrancy
- [ ] Cross-function reentrancy via shared state?
- [ ] Does nonReentrant modifier come BEFORE other modifiers?

### Access Control [CRITICAL]
- [ ] Functions missing access modifiers (onlyOwner, onlyRole)?
- [ ] Privilege transfer uses 2-step process?
- [ ] tx.origin used for auth? → Phishing risk
- [ ] Inherited functions properly restricted?

### Input Validation [HIGH]
- [ ] Zero address checks for critical parameters?
- [ ] Array length validated (no unbounded loops)?
- [ ] Duplicate items in arrays handled?
- [ ] Edge values (0, max) cause unexpected behavior?

### Arithmetic [HIGH]
- [ ] Division before multiplication? → Precision loss
- [ ] Division by zero possible?
- [ ] Rounding direction favors protocol?
- [ ] Type casting without SafeCast? → Silent overflow
- [ ] unchecked{} blocks validated?

### External Calls [HIGH]
- [ ] Return value of .call() checked?
- [ ] Contract existence verified before call?
- [ ] Arbitrary address in delegatecall?
- [ ] msg.value used in loop? → Double-spend

### Denial of Service [HIGH]
- [ ] Pull-over-push pattern for withdrawals?
- [ ] Minimum transaction amounts enforced?
- [ ] Token blacklisting handled (USDC, USDT)?
- [ ] External call failures block critical paths?

### Signature Security [HIGH]
- [ ] Nonce prevents replay?
- [ ] chainId in signature (EIP-712)?
- [ ] ecrecover result != address(0)?
- [ ] Signature expiry (deadline)?
- [ ] msg.sender bound to signature?

### Initialization [MEDIUM]
- [ ] Proxies use initializer modifier?
- [ ] Implementation contract disables initializers?
- [ ] Constructor logic in upgradeable contract?
- [ ] Critical state variables initialized?

### Logic Errors [MEDIUM]
- [ ] Off-by-one in comparisons (< vs <=)?
- [ ] Logical operators correct (&&, ||, !)?
- [ ] Code asymmetry (deposit vs withdraw mirror)?
- [ ] First/last iteration edge cases?
`;

// ============================================================================
// ERC20 TOKEN CHECKS
// ============================================================================

export const ERC20_CHECKS = `
## ERC20 TOKEN CHECKLIST

### Transfer Issues
- [ ] Uses SafeERC20 for transfers?
- [ ] Fee-on-transfer tokens handled? → Balance check before/after
- [ ] Rebasing tokens break accounting?
- [ ] Zero transfer reverts on some tokens (BNB)
- [ ] Return value checked? (USDT doesn't return bool)
- [ ] Token has multiple addresses? (Synthetix)

### Approval Issues
- [ ] Approval race condition? → Set to 0 first
- [ ] Max approval (type(uint256).max) reverts on some tokens
- [ ] Permit front-running possible?

### Decimal Handling
- [ ] Different decimal tokens (6 vs 18) calculated correctly?
- [ ] Precision loss in conversions?

### Malicious Tokens
- [ ] ERC777 hooks enable reentrancy?
- [ ] Pausable tokens block protocol?
- [ ] Blacklistable tokens (USDC) cause DoS?
- [ ] Upgradeable tokens change behavior?
`;

// ============================================================================
// ERC721/ERC1155 NFT CHECKS
// ============================================================================

export const NFT_CHECKS = `
## NFT CHECKLIST (ERC721/ERC1155)

### Transfer Safety
- [ ] Using safeTransferFrom (not transferFrom)?
- [ ] onERC721Received callback reentrancy?
- [ ] onERC1155Received callback reentrancy?
- [ ] from parameter validated as msg.sender or approved?

### Interface Compliance
- [ ] supportsInterface correctly implemented?
- [ ] Both ERC721 AND ERC1155 supported if needed?
- [ ] Royalty standard (EIP-2981) implemented correctly?

### Special Cases
- [ ] CryptoPunks don't have transferFrom → special handling?
- [ ] Airdrops/claims for staked NFTs accessible?
`;

// ============================================================================
// DeFi LENDING CHECKS
// ============================================================================

export const DEFI_LENDING_CHECKS = `
## DEFI LENDING CHECKLIST

### Liquidation
- [ ] Liquidation works during market crashes?
- [ ] All position sizes incentivized for liquidation?
- [ ] Self-liquidation profitable? → Exploit
- [ ] Front-running adds collateral to prevent liquidation?
- [ ] Paused state blocks liquidations? → Bad debt

### Interest & Accounting
- [ ] Interest included in LTV calculation?
- [ ] Repayment reduces principal correctly?
- [ ] Bad debt accumulation handled?
- [ ] Flash loan + borrow same token blocked?

### Collateral
- [ ] Collateral drops below threshold → liquidatable?
- [ ] User can never repay (trapped)?
- [ ] Collateral factor manipulation possible?
`;

// ============================================================================
// DeFi AMM/DEX CHECKS
// ============================================================================

export const DEFI_AMM_CHECKS = `
## AMM/DEX CHECKLIST

### Slippage & MEV
- [ ] User-specified slippage (not hardcoded)?
- [ ] Slippage calculated off-chain (not on-chain)?
- [ ] Deadline parameter prevents stale trades?
- [ ] minAmountOut enforced at FINAL step?

### Price Manipulation
- [ ] Spot price used for sensitive logic? → Flash loan attack
- [ ] Pool reserves trusted? → Manipulable
- [ ] TWAP with adequate time window?

### Swap Safety
- [ ] Callback function validates caller?
- [ ] Refunds after partial fills?
- [ ] token0/token1 order consistent across chains?
- [ ] Pool address whitelisted or factory verified?
`;

// ============================================================================
// VAULT/YIELD CHECKS
// ============================================================================

export const VAULT_CHECKS = `
## VAULT/YIELD CHECKLIST

### Share Manipulation
- [ ] First depositor attack? → Share inflation
- [ ] Donation attack? → Balance manipulation
- [ ] Direct token transfer breaks accounting?
- [ ] Share/asset ratio manipulable?

### Deposit/Withdraw
- [ ] Flash deposit-harvest-withdraw blocked?
- [ ] Minimum deposit enforced?
- [ ] Only 1 wei left causes issues?
- [ ] Emergency withdrawal works?

### Strategy Risks
- [ ] Strategy migration safe?
- [ ] Harvest function access controlled?
- [ ] Underlying protocol hack handling?
`;

// ============================================================================
// ORACLE CHECKS
// ============================================================================

export const ORACLE_CHECKS = `
## ORACLE CHECKLIST

### Chainlink Specific
- [ ] latestRoundData() staleness checked? (updatedAt)
- [ ] answeredInRound >= roundId? (round completeness)
- [ ] Price != 0 validation?
- [ ] Sequencer uptime feed on L2?
- [ ] Heartbeat matches asset volatility?

### Price Manipulation
- [ ] AMM spot price used? → Flash loan attack
- [ ] Single oracle dependency? → Use multiple
- [ ] Price bounds validated (minAnswer < price < maxAnswer)?

### General Oracle Risks
- [ ] Oracle pause causes DoS?
- [ ] try/catch for oracle calls?
- [ ] ETH/stETH or BTC/WBTC depeg risk?
- [ ] Price update front-runnable?
`;

// ============================================================================
// CROSS-CHAIN / BRIDGE CHECKS
// ============================================================================

export const CROSSCHAIN_CHECKS = `
## CROSS-CHAIN CHECKLIST

### Message Validation
- [ ] Source chain whitelisted?
- [ ] Sender address validated against allowlist?
- [ ] Message replay prevented?
- [ ] Payload encoding/decoding matches?

### Finality & Timing
- [ ] Source chain finality respected?
- [ ] Block time differences handled?
- [ ] Sequencer downtime handled?
- [ ] Reorg depth considered?

### LayerZero Specific
- [ ] Using _lzSend() not lzEndpoint.send()?
- [ ] Non-blocking pattern (not blocking)?
- [ ] forceResumeReceive implemented?
- [ ] Custom config (not defaults)?

### CCIP Specific
- [ ] Router address verified in ccipReceive?
- [ ] extraArgs not hardcoded (mutable)?
- [ ] Failed message handling (8hr window)?
`;

// ============================================================================
// STAKING CHECKS
// ============================================================================

export const STAKING_CHECKS = `
## STAKING CHECKLIST

### Reward Distribution
- [ ] Rewards updated before state changes?
- [ ] Claim reentrancy possible?
- [ ] Reward delay or early claim possible?
- [ ] Rounding favors protocol in distribution?

### Voting & Governance
- [ ] Token snapshot prevents double voting?
- [ ] Flash loan voting attack possible?
- [ ] Vote delegation attacks?

### Lock Mechanisms
- [ ] User can extend others' lock by staking?
- [ ] Lock bypass possible?
- [ ] Unbonding period enforced?
`;

// ============================================================================
// PROXY/UPGRADE CHECKS
// ============================================================================

export const PROXY_CHECKS = `
## PROXY/UPGRADE CHECKLIST

### Initialization
- [ ] Implementation has _disableInitializers() in constructor?
- [ ] initialize() has initializer modifier?
- [ ] All parent contracts initialized?
- [ ] No constructor logic in implementation?

### Storage Safety
- [ ] Storage layout preserved between versions?
- [ ] Gap variables in base contracts?
- [ ] No immutable variables in implementation?
- [ ] No selfdestruct in implementation?

### UUPS Specific
- [ ] _authorizeUpgrade() properly restricted?

### Transparent Proxy
- [ ] Admin slot collision avoided?
- [ ] No selector clashing?
`;

// ============================================================================
// L2/MULTICHAIN CHECKS
// ============================================================================

export const MULTICHAIN_CHECKS = `
## L2/MULTICHAIN CHECKLIST

### EVM Compatibility
- [ ] Solidity >=0.8.20 + PUSH0? → Not on all L2s
- [ ] Block.timestamp assumptions valid?
- [ ] Block.number meaning differs?
- [ ] Precompile availability verified?

### zkSync Era Specific
- [ ] PUSH0 NOT supported
- [ ] Different CREATE/CREATE2 behavior
- [ ] Higher gas costs for certain opcodes

### Sequencer Risks
- [ ] Sequencer downtime handling?
- [ ] Timestamp manipulation by sequencer?
- [ ] Transaction ordering trust assumptions?

### Cross-Chain Consistency
- [ ] Same behavior on all target chains?
- [ ] ERC20 decimals consistent?
- [ ] Token addresses differ per chain?
`;

// ============================================================================
// CENTRALIZATION CHECKS
// ============================================================================

export const CENTRALIZATION_CHECKS = `
## CENTRALIZATION CHECKLIST

### Admin Powers
- [ ] Admin can drain user funds?
- [ ] Instant parameter changes (no timelock)?
- [ ] Pause blocks critical functions (withdrawal)?
- [ ] Admin can upgrade to malicious code?

### Governance
- [ ] Ownership transfer is 2-step?
- [ ] Timelock on critical changes?
- [ ] Events emitted on admin actions?
- [ ] Parameter bounds validated?
`;

// ============================================================================
// CONTRACT TYPE DETECTION
// ============================================================================

export type ContractCategory = 
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'defi-lending'
  | 'defi-amm'
  | 'vault'
  | 'oracle'
  | 'bridge'
  | 'staking'
  | 'proxy'
  | 'governance'
  | 'multichain';

/**
 * Detects contract categories based on code patterns
 * Returns array of detected categories
 */
export function detectContractCategories(sourceCode: string): ContractCategory[] {
  const categories: ContractCategory[] = [];
  const code = sourceCode.toLowerCase();

  // ERC20 detection
  if (
    code.includes('totalsupply') &&
    code.includes('balanceof') &&
    (code.includes('transfer(') || code.includes('transferfrom'))
  ) {
    categories.push('erc20');
  }

  // ERC721 detection
  if (
    code.includes('erc721') ||
    code.includes('ownerof') ||
    code.includes('safetransferfrom') ||
    code.includes('onerc721received')
  ) {
    categories.push('erc721');
  }

  // ERC1155 detection
  if (
    code.includes('erc1155') ||
    code.includes('balanceofbatch') ||
    code.includes('onerc1155received')
  ) {
    categories.push('erc1155');
  }

  // DeFi Lending detection
  if (
    code.includes('borrow') &&
    code.includes('repay') &&
    (code.includes('collateral') || code.includes('liquidat'))
  ) {
    categories.push('defi-lending');
  }

  // AMM/DEX detection
  if (
    (code.includes('swap') && code.includes('liquidity')) ||
    code.includes('amountout') ||
    code.includes('amountin') ||
    code.includes('getreserves') ||
    code.includes('uniswap') ||
    code.includes('pancake')
  ) {
    categories.push('defi-amm');
  }

  // Vault detection
  if (
    (code.includes('deposit') && code.includes('withdraw') && code.includes('shares')) ||
    code.includes('erc4626') ||
    code.includes('vault')
  ) {
    categories.push('vault');
  }

  // Oracle detection
  if (
    code.includes('chainlink') ||
    code.includes('latestrounddata') ||
    code.includes('pricefeed') ||
    code.includes('oracle') ||
    code.includes('pyth')
  ) {
    categories.push('oracle');
  }

  // Bridge/Cross-chain detection
  if (
    code.includes('layerzero') ||
    code.includes('lzsend') ||
    code.includes('ccip') ||
    code.includes('wormhole') ||
    code.includes('bridge') ||
    code.includes('crosschain')
  ) {
    categories.push('bridge');
  }

  // Staking detection
  if (
    (code.includes('stake') && code.includes('reward')) ||
    code.includes('staking') ||
    code.includes('claimreward')
  ) {
    categories.push('staking');
  }

  // Proxy detection
  if (
    code.includes('upgradeable') ||
    code.includes('proxy') ||
    code.includes('implementation') ||
    code.includes('initializable') ||
    code.includes('uups')
  ) {
    categories.push('proxy');
  }

  // Governance detection
  if (
    code.includes('governor') ||
    code.includes('proposal') ||
    code.includes('vote') ||
    code.includes('quorum') ||
    code.includes('timelock')
  ) {
    categories.push('governance');
  }

  // Multi-chain indicators
  if (
    code.includes('chainid') ||
    code.includes('l2') ||
    code.includes('arbitrum') ||
    code.includes('optimism') ||
    code.includes('zksync')
  ) {
    categories.push('multichain');
  }

  return categories;
}

/**
 * Gets the relevant checklists based on detected categories
 */
export function getContextualChecklist(categories: ContractCategory[]): string {
  // Always include core checks
  let checklist = CORE_CHECKS;

  // Add category-specific checks
  const categoryMap: Record<ContractCategory, string> = {
    'erc20': ERC20_CHECKS,
    'erc721': NFT_CHECKS,
    'erc1155': NFT_CHECKS,
    'defi-lending': DEFI_LENDING_CHECKS,
    'defi-amm': DEFI_AMM_CHECKS,
    'vault': VAULT_CHECKS,
    'oracle': ORACLE_CHECKS,
    'bridge': CROSSCHAIN_CHECKS,
    'staking': STAKING_CHECKS,
    'proxy': PROXY_CHECKS,
    'governance': STAKING_CHECKS, // Reuse staking checks for voting
    'multichain': MULTICHAIN_CHECKS,
  };

  // Deduplicate (e.g., erc721 and erc1155 both add NFT_CHECKS)
  const addedChecklists = new Set<string>();
  
  for (const category of categories) {
    const categoryChecklist = categoryMap[category];
    if (categoryChecklist && !addedChecklists.has(categoryChecklist)) {
      checklist += '\n' + categoryChecklist;
      addedChecklists.add(categoryChecklist);
    }
  }

  // Always include centralization checks
  checklist += '\n' + CENTRALIZATION_CHECKS;

  return checklist;
}

/**
 * Main function: analyzes source code and returns appropriate checklist
 */
export function generateAuditChecklist(sourceCode: string): {
  categories: ContractCategory[];
  checklist: string;
  tokenEstimate: number;
} {
  const categories = detectContractCategories(sourceCode);
  const checklist = getContextualChecklist(categories);
  
  // Rough token estimate: ~4 chars per token
  const tokenEstimate = Math.ceil(checklist.length / 4);

  return {
    categories,
    checklist,
    tokenEstimate,
  };
}
