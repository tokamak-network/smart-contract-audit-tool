'use client';

import { useState } from 'react';
import {
  Globe,
  Layers,
  Shield,
  Link2,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Zap,
  Wallet,
  Users,
  FileCode,
} from 'lucide-react';
import {
  AuditContext,
  TargetNetwork,
  ProtocolCategory,
  UpgradePattern,
  ExternalIntegration,
  NETWORK_INFO,
} from '@/lib/types';

interface AuditContextFormProps {
  context: AuditContext;
  onChange: (context: AuditContext) => void;
}

// Display labels for networks
const NETWORK_OPTIONS: { id: TargetNetwork; label: string; group: string }[] = [
  { id: 'ethereum', label: 'Ethereum Mainnet', group: 'L1' },
  { id: 'optimism', label: 'Optimism', group: 'L2 - OP Stack' },
  { id: 'base', label: 'Base', group: 'L2 - OP Stack' },
  { id: 'blast', label: 'Blast', group: 'L2 - OP Stack' },
  { id: 'mode', label: 'Mode', group: 'L2 - OP Stack' },
  { id: 'arbitrum', label: 'Arbitrum One', group: 'L2 - Arbitrum' },
  { id: 'zksync', label: 'zkSync Era', group: 'L2 - zkEVM' },
  { id: 'linea', label: 'Linea', group: 'L2 - zkEVM' },
  { id: 'scroll', label: 'Scroll', group: 'L2 - zkEVM' },
  { id: 'polygon', label: 'Polygon PoS', group: 'Sidechains' },
  { id: 'bsc', label: 'BNB Smart Chain', group: 'Sidechains' },
  { id: 'avalanche', label: 'Avalanche C-Chain', group: 'Alt L1' },
  { id: 'fantom', label: 'Fantom Opera', group: 'Alt L1' },
  { id: 'mantle', label: 'Mantle', group: 'L2 - Other' },
  { id: 'other', label: 'Other Network', group: 'Other' },
];

const PROTOCOL_OPTIONS: { id: ProtocolCategory; label: string; icon: string }[] = [
  { id: 'defi-lending', label: 'DeFi - Lending/Borrowing', icon: '🏦' },
  { id: 'defi-dex', label: 'DeFi - DEX/AMM', icon: '🔄' },
  { id: 'defi-yield', label: 'DeFi - Yield/Vault', icon: '📈' },
  { id: 'defi-derivatives', label: 'DeFi - Derivatives/Perps', icon: '📊' },
  { id: 'bridge', label: 'Bridge/Cross-chain', icon: '🌉' },
  { id: 'nft', label: 'NFT/Marketplace', icon: '🖼️' },
  { id: 'dao-governance', label: 'DAO/Governance', icon: '🏛️' },
  { id: 'staking', label: 'Staking/Restaking', icon: '🥩' },
  { id: 'launchpad', label: 'Launchpad/Token Sale', icon: '🚀' },
  { id: 'gaming', label: 'Gaming/GameFi', icon: '🎮' },
  { id: 'other', label: 'Other', icon: '📦' },
];

const UPGRADE_OPTIONS: { id: UpgradePattern; label: string; description: string }[] = [
  { id: 'none', label: 'Not Upgradeable', description: 'Immutable contracts' },
  { id: 'uups', label: 'UUPS', description: 'Universal Upgradeable Proxy Standard' },
  { id: 'transparent', label: 'Transparent Proxy', description: 'OpenZeppelin TransparentUpgradeableProxy' },
  { id: 'diamond', label: 'Diamond (EIP-2535)', description: 'Multi-facet proxy pattern' },
  { id: 'beacon', label: 'Beacon Proxy', description: 'Shared implementation upgrades' },
  { id: 'custom', label: 'Custom Pattern', description: 'Custom upgrade mechanism' },
];

const INTEGRATION_OPTIONS: { id: ExternalIntegration; label: string; category: string }[] = [
  { id: 'chainlink', label: 'Chainlink (Oracle)', category: 'Oracles' },
  { id: 'pyth', label: 'Pyth Network', category: 'Oracles' },
  { id: 'redstone', label: 'RedStone', category: 'Oracles' },
  { id: 'uniswap', label: 'Uniswap', category: 'DeFi' },
  { id: 'aave', label: 'Aave', category: 'DeFi' },
  { id: 'compound', label: 'Compound', category: 'DeFi' },
  { id: 'openzeppelin', label: 'OpenZeppelin', category: 'Libraries' },
  { id: 'safe', label: 'Safe (Gnosis)', category: 'Wallets' },
  { id: 'layerzero', label: 'LayerZero', category: 'Cross-chain' },
  { id: 'wormhole', label: 'Wormhole', category: 'Cross-chain' },
  { id: 'ccip', label: 'Chainlink CCIP', category: 'Cross-chain' },
  { id: 'gelato', label: 'Gelato', category: 'Automation' },
  { id: 'other', label: 'Other', category: 'Other' },
];

export default function AuditContextForm({ context, onChange }: AuditContextFormProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateContext = (partial: Partial<AuditContext>) => {
    onChange({ ...context, ...partial });
  };

  const toggleNetwork = (network: TargetNetwork) => {
    const networks = context.targetNetworks.includes(network)
      ? context.targetNetworks.filter((n) => n !== network)
      : [...context.targetNetworks, network];
    updateContext({ targetNetworks: networks });
  };

  const toggleIntegration = (integration: ExternalIntegration) => {
    const integrations = context.externalIntegrations.includes(integration)
      ? context.externalIntegrations.filter((i) => i !== integration)
      : [...context.externalIntegrations, integration];
    updateContext({ externalIntegrations: integrations });
  };

  // Get warnings based on selected networks
  const getNetworkWarnings = (): string[] => {
    const warnings: string[] = [];
    
    context.targetNetworks.forEach((network) => {
      const info = NETWORK_INFO[network];
      if (!info.supportsPUSH0) {
        warnings.push(`⚠️ ${info.name}: PUSH0 opcode not supported. Use Solidity <0.8.20 or configure EVM version.`);
      }
      if (info.hasSequencer) {
        warnings.push(`⏰ ${info.name}: Has centralized sequencer. Consider sequencer uptime checks.`);
      }
    });

    // Check for cross-network deployment
    if (context.targetNetworks.length > 1) {
      const hasPUSH0Support = context.targetNetworks.some(n => NETWORK_INFO[n].supportsPUSH0);
      const hasNoPUSH0Support = context.targetNetworks.some(n => !NETWORK_INFO[n].supportsPUSH0);
      
      if (hasPUSH0Support && hasNoPUSH0Support) {
        warnings.push('🔀 Multi-chain deployment with mixed PUSH0 support. Ensure consistent EVM version.');
      }
    }

    return warnings;
  };

  const networkWarnings = getNetworkWarnings();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Audit Context Configuration</h3>
            <p className="text-sm text-gray-500">
              Provide context for more accurate vulnerability detection
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Network Warnings */}
          {networkWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 text-sm">Network Compatibility Warnings</h4>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    {networkWarnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Target Networks */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Globe className="w-4 h-4" />
              Target Deployment Networks
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {NETWORK_OPTIONS.map((network) => {
                const isSelected = context.targetNetworks.includes(network.id);
                const info = NETWORK_INFO[network.id];
                return (
                  <button
                    key={network.id}
                    onClick={() => toggleNetwork(network.id)}
                    className={`
                      p-3 rounded-lg border text-left transition-all text-sm
                      ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className={isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                        {network.label}
                      </span>
                      {!info.supportsPUSH0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          No PUSH0
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{network.group}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Protocol Category */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Layers className="w-4 h-4" />
              Protocol Category
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PROTOCOL_OPTIONS.map((protocol) => (
                <button
                  key={protocol.id}
                  onClick={() => updateContext({ protocolCategory: protocol.id })}
                  className={`
                    p-3 rounded-lg border text-left transition-all text-sm
                    ${context.protocolCategory === protocol.id
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="mr-2">{protocol.icon}</span>
                  <span className={context.protocolCategory === protocol.id ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                    {protocol.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Upgrade Pattern */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <FileCode className="w-4 h-4" />
              Upgrade Pattern
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {UPGRADE_OPTIONS.map((upgrade) => (
                <button
                  key={upgrade.id}
                  onClick={() => updateContext({ upgradePattern: upgrade.id })}
                  className={`
                    p-3 rounded-lg border text-left transition-all text-sm
                    ${context.upgradePattern === upgrade.id
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className={context.upgradePattern === upgrade.id ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                    {upgrade.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{upgrade.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* External Integrations */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Link2 className="w-4 h-4" />
              External Integrations
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {INTEGRATION_OPTIONS.map((integration) => {
                const isSelected = context.externalIntegrations.includes(integration.id);
                return (
                  <button
                    key={integration.id}
                    onClick={() => toggleIntegration(integration.id)}
                    className={`
                      p-2.5 rounded-lg border text-left transition-all text-sm
                      ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className={isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                      {integration.label}
                    </div>
                    <div className="text-xs text-gray-500">{integration.category}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Boolean Flags */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Info className="w-4 h-4" />
              Additional Context
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={context.usesFlashLoans}
                  onChange={(e) => updateContext({ usesFlashLoans: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-700">Uses Flash Loans</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Protocol interacts with flash loan providers</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={context.handlesNativeETH}
                  onChange={(e) => updateContext({ handlesNativeETH: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Handles Native ETH</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Receives/sends native ETH (not wrapped)</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={context.hasPrivilegedRoles}
                  onChange={(e) => updateContext({ hasPrivilegedRoles: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">Has Privileged Roles</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Owner, admin, or other privileged accounts</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={context.interactsWithEOAs}
                  onChange={(e) => updateContext({ interactsWithEOAs: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">EOA-Only Functions</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Has functions restricted to EOA callers</p>
                </div>
              </label>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              Additional Context Notes
            </label>
            <textarea
              value={context.additionalNotes || ''}
              onChange={(e) => updateContext({ additionalNotes: e.target.value })}
              placeholder="Any additional context that might help the audit (e.g., expected user flows, known limitations, specific areas of concern)..."
              className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Default context for initialization
export const DEFAULT_AUDIT_CONTEXT: AuditContext = {
  targetNetworks: ['ethereum'],
  protocolCategory: 'other',
  upgradePattern: 'none',
  externalIntegrations: [],
  usesFlashLoans: false,
  handlesNativeETH: false,
  hasPrivilegedRoles: true,
  interactsWithEOAs: false,
  additionalNotes: '',
};
