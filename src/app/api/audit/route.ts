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
  quick: 10000,  // ~1 minute, concise report with all severities
  deep: 20000,   // ~2-3 minutes, comprehensive analysis
};

// Model selection: Quick mode uses Sonnet (fast + cheap), Deep mode uses Opus (best quality)
const LITELLM_MODELS: Record<AuditDepth, string> = {
  quick: process.env.LITELLM_MODEL_QUICK || 'claude-sonnet-4.5',
  deep: process.env.LITELLM_MODEL_DEEP || 'claude-opus-4.5',
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

async function callLiteLLM(apiKey: string, systemPrompt: string, userMessage: string, maxTokens: number, auditDepth: AuditDepth): Promise<string> {
  const baseURL = process.env.LITELLM_BASE_URL || 'https://api.ai.tokamak.network';
  const model = LITELLM_MODELS[auditDepth];
  
  const openai = new OpenAI({ 
    apiKey,
    baseURL 
  });

  console.log(`LiteLLM using model: ${model} for ${auditDepth} mode`);
  
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

    // Combine all contract source code for contextual checklist detection
    const allSourceCode = contracts.map(c => c.content).join('\n\n');

    // Generate context-aware system prompt with contextual checklist and audit depth
    const systemPrompt = generateSystemPrompt(context, allSourceCode, auditDepth);

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
      userMessage += '⚡ **QUICK AUDIT MODE** - Be concise but complete:\n';
      userMessage += '- Include Executive Summary with Risk Matrix\n';
      userMessage += '- All severity levels (Critical, High, Medium, Low, Info)\n';
      userMessage += '- Each finding: Title, Location, Description (2-3 sentences), Impact\n';
      userMessage += '- Brief code fix recommendation (no full Before/After)\n';
      userMessage += '- Skip detailed exploit scenarios and PoC code\n';
      userMessage += '- MAX 4000 words. Prioritize COMPLETION.\n\n';
    } else {
      userMessage += '🔍 **DEEP AUDIT MODE** - Be COMPREHENSIVE:\n';
      userMessage += '- Executive Summary with Risk Matrix\n';
      userMessage += '- All severity levels with detailed descriptions\n';
      userMessage += '- Complete Before/After code examples for each finding\n';
      userMessage += '- Detailed exploit paths and PoC scenarios\n';
      userMessage += '- Architecture review and recommendations\n';
      userMessage += '- Gas optimizations if relevant\n\n';
    }
    
    userMessage += 'Generate a SINGLE comprehensive SECURITY_AUDIT_REPORT.md that includes:\n';
    userMessage += '1. Executive Summary with Risk Assessment Matrix\n';
    userMessage += '2. Contracts in Scope\n';
    userMessage += '3. Detailed Findings (each with: Description, Vulnerable Code, Impact, Recommendation/Fix)\n';
    userMessage += '4. Conclusions and Next Steps\n';
    
    if (context?.targetNetworks.length) {
      userMessage += '\nIMPORTANT: Pay special attention to network-specific issues for the target networks listed above.\n';
    }
    
    userMessage += '\nRespond with valid JSON: {"report": "<markdown content>"}. Ensure JSON is complete and properly closed.';

    // Call the appropriate AI provider
    let responseText: string;
    if (provider === 'litellm') {
      responseText = await callLiteLLM(apiKey, systemPrompt, userMessage, maxTokens, auditDepth);
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
      let report = '';
      
      // Look for report content
      const reportMatch = responseText.match(/"report"\s*:\s*"([\s\S]*)/);
      if (reportMatch) {
        report = reportMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/"\s*\}\s*$/, ''); // Remove trailing "}" if present
      }
      
      if (report) {
        console.log('Recovered truncated response successfully');
        return NextResponse.json({ report });
      }
      
      // If recovery failed, return raw markdown (strip JSON wrapper)
      const cleanedResponse = responseText
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .replace(/^\{\s*"report"\s*:\s*"/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');
      
      return NextResponse.json({
        report: cleanedResponse.substring(0, 50000) || '# Security Audit Report\n\n## Response Parsing Issue\n\nThe AI generated a response but it could not be parsed. Please try again.',
      });
    }

    return NextResponse.json({
      report: parsedResponse.report || '# No report generated',
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
