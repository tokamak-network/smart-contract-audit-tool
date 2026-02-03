import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { generateSystemPrompt } from '@/lib/playbook';
import { AuditRequest, AuditContext, NETWORK_INFO } from '@/lib/types';

// ============================================================================
// CONFIGURATION - SUPPORTS LITELLM, ANTHROPIC, AND OPENAI
// ============================================================================
// Set ONE of these configurations in your .env file:
//
//   LITELLM_API_KEY=sk-...                           (for LiteLLM Proxy)
//   LITELLM_BASE_URL=https://api.ai.tokamak.network  (LiteLLM endpoint)
//   LITELLM_MODEL=claude-sonnet-4.5                  (model name)
//
//   ANTHROPIC_API_KEY=sk-ant-api03-...  (for direct Claude API)
//   OPENAI_API_KEY=sk-...               (for direct OpenAI API)
//
// The app will prefer LiteLLM if configured, then Anthropic, then OpenAI.
// ============================================================================

type AIProvider = 'litellm' | 'anthropic' | 'openai';
type AuditDepth = 'quick' | 'deep';

const MAX_TOKENS: Record<AuditDepth, number> = {
  quick: 16000,  // ~1-2 minutes, concise report (2000 words = ~2800 tokens, plenty of buffer)
  deep: 64000,   // ~3-5 minutes, comprehensive
};

function getProvider(requestedProvider?: string): { provider: AIProvider; apiKey: string } {
  // If user requested a specific provider, try to use it
  if (requestedProvider === 'litellm' && process.env.LITELLM_API_KEY) {
    return { provider: 'litellm', apiKey: process.env.LITELLM_API_KEY };
  }
  if (requestedProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (requestedProvider === 'openai' && process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
  }
  
  // Otherwise, auto-detect available provider (prefer LiteLLM)
  if (process.env.LITELLM_API_KEY) {
    return { provider: 'litellm', apiKey: process.env.LITELLM_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY };
  }
  throw new Error('No API key configured. Please add LITELLM_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to .env');
}

async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}

async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const openai = new OpenAI({ apiKey });
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',  // or 'gpt-4-turbo' or 'gpt-4'
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  return completion.choices[0]?.message?.content || '';
}

async function callLiteLLM(apiKey: string, systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const baseURL = process.env.LITELLM_BASE_URL || 'https://api.ai.tokamak.network';
  const model = process.env.LITELLM_MODEL || 'claude-sonnet-4.5';
  
  const openai = new OpenAI({ 
    apiKey,
    baseURL 
  });
  
  const completion = await openai.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  return completion.choices[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditRequest & { provider?: string; auditDepth?: AuditDepth } = await request.json();
    const { contracts, tests, protocolDescription, provider: requestedProvider, context, auditDepth = 'quick' } = body;

    const { provider, apiKey } = getProvider(requestedProvider);
    const maxTokens = MAX_TOKENS[auditDepth];
    console.log(`Using AI provider: ${provider}, depth: ${auditDepth}, maxTokens: ${maxTokens}`);

    if (!contracts || contracts.length === 0) {
      return NextResponse.json(
        { error: 'At least one contract is required' },
        { status: 400 }
      );
    }

    // Generate context-aware system prompt
    const systemPrompt = generateSystemPrompt(context);

    // Build the user message with all contracts and context
    let userMessage = '# Smart Contract Security Audit Request\n\n';

    // Add audit context summary if provided
    if (context) {
      userMessage += '## Audit Context\n\n';
      
      if (context.targetNetworks.length > 0) {
        userMessage += '### Target Networks\n';
        context.targetNetworks.forEach(network => {
          const info = NETWORK_INFO[network];
          userMessage += `- **${info.name}**: EVM ${info.evmVersion}, PUSH0: ${info.supportsPUSH0 ? 'Yes' : 'NO'}, Sequencer: ${info.hasSequencer ? 'Yes' : 'No'}\n`;
        });
        userMessage += '\n';
      }

      userMessage += `### Protocol Category: ${context.protocolCategory}\n`;
      userMessage += `### Upgrade Pattern: ${context.upgradePattern}\n`;
      
      if (context.externalIntegrations.length > 0) {
        userMessage += `### External Integrations: ${context.externalIntegrations.join(', ')}\n`;
      }
      
      userMessage += '\n### Flags\n';
      userMessage += `- Uses Flash Loans: ${context.usesFlashLoans ? 'YES' : 'No'}\n`;
      userMessage += `- Handles Native ETH: ${context.handlesNativeETH ? 'YES' : 'No'}\n`;
      userMessage += `- Has Privileged Roles: ${context.hasPrivilegedRoles ? 'YES' : 'No'}\n`;
      userMessage += `- EOA-Only Functions: ${context.interactsWithEOAs ? 'YES' : 'No'}\n`;
      
      if (context.additionalNotes) {
        userMessage += `\n### Additional Notes\n${context.additionalNotes}\n`;
      }
      userMessage += '\n';
    }

    if (protocolDescription) {
      userMessage += '## Protocol Description\n';
      userMessage += protocolDescription + '\n\n';
    }

    userMessage += '## Contracts to Audit\n\n';
    for (const contract of contracts) {
      userMessage += `### ${contract.name}\n`;
      userMessage += '```solidity\n';
      userMessage += contract.content;
      userMessage += '\n```\n\n';
    }

    if (tests && tests.length > 0) {
      userMessage += '## Test Files (for coverage analysis)\n\n';
      for (const test of tests) {
        userMessage += `### ${test.name}\n`;
        userMessage += '```solidity\n';
        userMessage += test.content;
        userMessage += '\n```\n\n';
      }
    }

    userMessage += '## Instructions\n';
    
    // Add mode-specific instructions
    if (auditDepth === 'quick') {
      userMessage += '⚡ **QUICK AUDIT MODE**:\n';
      userMessage += '- Report ALL Critical and High severity issues (do not skip any!)\n';
      userMessage += '- Keep descriptions concise: 3-4 sentences per finding\n';
      userMessage += '- Include one brief code snippet per critical finding\n';
      userMessage += '- Skip Medium/Low/Info severity issues\n';
      userMessage += '- Skip architecture review, gas optimization, testing sections\n';
      userMessage += '- Target: ~3000 words total. Ensure JSON completes properly.\n\n';
    } else {
      userMessage += '🔍 **DEEP AUDIT MODE** - Be COMPREHENSIVE. Include:\n';
      userMessage += '- All severity levels (Critical, High, Medium, Low, Info)\n';
      userMessage += '- Detailed exploit paths and PoC scenarios\n';
      userMessage += '- Complete Before/After code examples\n';
      userMessage += '- Extensive recommendations with code fixes\n';
      userMessage += '- Architecture review and gas optimizations\n\n';
    }
    
    userMessage += 'Generate:\n';
    userMessage += '1. SECURITY_AUDIT_REPORT.md - Executive summary with findings\n';
    userMessage += '2. VULNERABILITY_ANALYSIS.md - Technical details with Before/After code\n';
    
    if (context?.targetNetworks.length) {
      userMessage += '\nIMPORTANT: Pay special attention to network-specific issues for the target networks listed above.\n';
    }
    
    userMessage += '\nRespond with valid JSON containing both reports. IMPORTANT: Ensure the JSON is complete and properly closed with }}. Do not get cut off mid-response.';

    // Call the appropriate AI provider
    let responseText: string;
    if (provider === 'litellm') {
      responseText = await callLiteLLM(apiKey, systemPrompt, userMessage, maxTokens);
    } else if (provider === 'anthropic') {
      responseText = await callAnthropic(apiKey, systemPrompt, userMessage, maxTokens);
    } else {
      responseText = await callOpenAI(apiKey, systemPrompt, userMessage, maxTokens);
    }

    // Parse the JSON response
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      
      // Try to recover truncated JSON by extracting markdown content
      let securityReport = '';
      let vulnerabilityAnalysis = '';
      
      // Look for securityReport content
      const securityMatch = responseText.match(/"securityReport"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"vulnerabilityAnalysis"|$)/);
      if (securityMatch) {
        securityReport = securityMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
      
      // Look for vulnerabilityAnalysis content
      const vulnMatch = responseText.match(/"vulnerabilityAnalysis"\s*:\s*"([\s\S]*)/);
      if (vulnMatch) {
        vulnerabilityAnalysis = vulnMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/"\s*\}\s*$/, ''); // Remove trailing "}" if present
      }
      
      if (securityReport || vulnerabilityAnalysis) {
        console.log('Recovered truncated response successfully');
        return NextResponse.json({
          securityReport: securityReport || '# Security Audit Report\n\n*Report was truncated. See Vulnerability Analysis for available findings.*',
          vulnerabilityAnalysis: vulnerabilityAnalysis || '# Vulnerability Analysis\n\n*Analysis was truncated during generation.*',
        });
      }
      
      // If recovery failed, return raw markdown (strip JSON wrapper)
      const cleanedResponse = responseText
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .replace(/^\{\s*"securityReport"\s*:\s*"/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');
      
      return NextResponse.json({
        securityReport: cleanedResponse.substring(0, 50000) || '# Security Audit Report\n\n## Response Parsing Issue\n\nThe AI generated a response but it could not be parsed. Please try again.',
        vulnerabilityAnalysis: '# Vulnerability Analysis\n\n*See Security Report above for all findings.*',
      });
    }

    return NextResponse.json({
      securityReport: parsedResponse.securityReport || '# No security report generated',
      vulnerabilityAnalysis: parsedResponse.vulnerabilityAnalysis || '# No vulnerability analysis generated',
    });

  } catch (error) {
    console.error('Audit API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: `Audit failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
