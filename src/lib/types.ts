// Types for the Smart Contract Auditor

export interface ContractFile {
  name: string;
  content: string;
  type: 'contract' | 'test';
}

// Network-specific configuration
export type TargetNetwork = 
  | 'ethereum'
  | 'optimism'
  | 'arbitrum'
  | 'base'
  | 'zksync'
  | 'polygon'
  | 'avalanche'
  | 'bsc'
  | 'fantom'
  | 'linea'
  | 'scroll'
  | 'blast'
  | 'mantle'
  | 'mode'
  | 'other';

export type ProtocolCategory =
  | 'defi-lending'
  | 'defi-dex'
  | 'defi-yield'
  | 'defi-derivatives'
  | 'bridge'
  | 'nft'
  | 'dao-governance'
  | 'staking'
  | 'launchpad'
  | 'gaming'
  | 'other';

export type UpgradePattern =
  | 'none'
  | 'uups'
  | 'transparent'
  | 'diamond'
  | 'beacon'
  | 'custom';

export type ExternalIntegration =
  | 'chainlink'
  | 'uniswap'
  | 'aave'
  | 'compound'
  | 'openzeppelin'
  | 'layerzero'
  | 'wormhole'
  | 'ccip'
  | 'pyth'
  | 'redstone'
  | 'gelato'
  | 'safe'
  | 'other';

// Audit context configuration
export interface AuditContext {
  // Target deployment
  targetNetworks: TargetNetwork[];
  
  // Protocol info
  protocolCategory: ProtocolCategory;
  
  // Technical config
  upgradePattern: UpgradePattern;
  externalIntegrations: ExternalIntegration[];
  
  // Additional context
  usesFlashLoans: boolean;
  handlesNativeETH: boolean;
  hasPrivilegedRoles: boolean;
  interactsWithEOAs: boolean;
  
  // Solidity version (extracted from contracts or user-specified)
  solidityVersion?: string;
  
  // Custom notes
  additionalNotes?: string;
}

export interface AuditRequest {
  contracts: ContractFile[];
  tests: ContractFile[];
  protocolDescription: string;
  provider?: string;
  context?: AuditContext;
}

export interface AuditResponse {
  report: string;
  success: boolean;
  error?: string;
}

export interface AuditState {
  isLoading: boolean;
  reports: {
    report: string;
  } | null;
  error: string | null;
}

// Network-specific vulnerability info
export interface NetworkInfo {
  id: TargetNetwork;
  name: string;
  evmVersion: string;
  supportsPUSH0: boolean;
  hasSequencer: boolean;
  precompiles: string[];
  notes: string[];
}

// Predefined network configurations
export const NETWORK_INFO: Record<TargetNetwork, NetworkInfo> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    evmVersion: 'shanghai',
    supportsPUSH0: true,
    hasSequencer: false,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing', 'blake2f'],
    notes: []
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    evmVersion: 'bedrock',
    supportsPUSH0: true,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['Block timestamps from sequencer', 'L1 gas costs in transactions', 'Sequencer uptime oracle available']
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    evmVersion: 'nitro',
    supportsPUSH0: true,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing', 'arbos'],
    notes: ['Custom precompiles for L1 interaction', 'Different block number behavior', 'Sequencer timestamp control']
  },
  base: {
    id: 'base',
    name: 'Base',
    evmVersion: 'bedrock',
    supportsPUSH0: true,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['OP Stack based', 'Similar to Optimism considerations']
  },
  zksync: {
    id: 'zksync',
    name: 'zkSync Era',
    evmVersion: 'zksync',
    supportsPUSH0: false,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'keccak256'],
    notes: ['PUSH0 NOT supported', 'Different opcode gas costs', 'Limited precompile support', 'Account abstraction native', 'CREATE/CREATE2 work differently']
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon PoS',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: false,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['PUSH0 NOT supported', 'Reorgs possible', 'Fast block times (2s)']
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: false,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['PUSH0 NOT supported', 'Fast finality', 'Subnet compatibility considerations']
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: false,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['PUSH0 NOT supported', '3s block times', 'Validator centralization']
  },
  fantom: {
    id: 'fantom',
    name: 'Fantom Opera',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: false,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity'],
    notes: ['PUSH0 NOT supported', 'Limited precompiles', 'Fast finality']
  },
  linea: {
    id: 'linea',
    name: 'Linea',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity'],
    notes: ['PUSH0 NOT supported', 'zkEVM', 'Limited precompile support']
  },
  scroll: {
    id: 'scroll',
    name: 'Scroll',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp'],
    notes: ['PUSH0 NOT supported', 'zkEVM', 'Some opcodes more expensive']
  },
  blast: {
    id: 'blast',
    name: 'Blast',
    evmVersion: 'bedrock',
    supportsPUSH0: true,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['Native yield for ETH/USDB', 'Gas rebates', 'OP Stack based']
  },
  mantle: {
    id: 'mantle',
    name: 'Mantle',
    evmVersion: 'london',
    supportsPUSH0: false,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity'],
    notes: ['PUSH0 NOT supported', 'Modular architecture', 'MNT for gas']
  },
  mode: {
    id: 'mode',
    name: 'Mode Network',
    evmVersion: 'bedrock',
    supportsPUSH0: true,
    hasSequencer: true,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity', 'modexp', 'ecadd', 'ecmul', 'ecpairing'],
    notes: ['OP Stack based', 'Sequencer fee sharing']
  },
  other: {
    id: 'other',
    name: 'Other Network',
    evmVersion: 'unknown',
    supportsPUSH0: false,
    hasSequencer: false,
    precompiles: ['ecrecover', 'sha256', 'ripemd160', 'identity'],
    notes: ['Unknown network - verify EVM compatibility manually']
  }
};

