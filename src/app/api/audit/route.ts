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
//   LITELLM_MODEL_QUICK=qwen3-coder-flash            (quick mode - FREE)
//
//   ANTHROPIC_API_KEY=sk-ant-api03-...  (for direct Claude API)
//   OPENAI_API_KEY=sk-...               (for direct OpenAI API)
//
// The app will prefer LiteLLM if configured, then Anthropic, then OpenAI.
// ============================================================================

type AIProvider = 'litellm' | 'anthropic' | 'openai';
type AuditDepth = 'quick' | 'deep';

const MAX_TOKENS: Record<AuditDepth, number> = {
  quick: 10000,
  deep: 10000,
};

// Model selection: Quick mode uses Qwen3 (fast + FREE)
// Deep mode: Opus 4.6 primary → DeepSeek Reasoner fallback
const LITELLM_MODELS: Record<AuditDepth, string> = {
  quick: process.env.LITELLM_MODEL_QUICK || 'qwen3-coder-flash',
  deep: process.env.LITELLM_MODEL_DEEP || 'anthropic-max-claude-opus-4-5',
};

const DEEP_FALLBACK_MODEL = process.env.LITELLM_MODEL_DEEP_FALLBACK || 'deepseek-reasoner';

// ============================================================================
// OPUS RATE LIMIT CACHE - Approach 1+3 Combined
// After Opus hits rate limit, skip it for CACHE_DURATION and use fallback directly
// ============================================================================
const FALLBACK_CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
let lastOpusFailureTimestamp: number | null = null;

function isOpusCached(): boolean {
  if (!lastOpusFailureTimestamp) return false;
  const elapsed = Date.now() - lastOpusFailureTimestamp;
  if (elapsed > FALLBACK_CACHE_DURATION_MS) {
    // Cache expired — Opus might be available again
    lastOpusFailureTimestamp = null;
    return false;
  }
  return true;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('rate limit') ||
           msg.includes('429') ||
           msg.includes('quota') ||
           msg.includes('exceeded') ||
           msg.includes('too many requests') ||
           msg.includes('budget') ||
           msg.includes('limit reached') ||
           msg.includes('key not allowed') ||
           msg.includes('key_model_access_denied') ||
           msg.includes('invalid model') ||
           msg.includes('401') ||
           msg.includes('400');
  }
  return false;
}

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

interface LiteLLMResult {
  text: string;
  modelUsed: string;
  wasFallback: boolean;
}

async function callLiteLLMWithModel(apiKey: string, systemPrompt: string, userMessage: string, maxTokens: number, model: string): Promise<string> {
  const baseURL = process.env.LITELLM_BASE_URL || 'https://api.ai.tokamak.network';
  
  const openai = new OpenAI({ 
    apiKey,
    baseURL 
  });

  console.log(`LiteLLM calling model: ${model}`);
  
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

async function callLiteLLM(apiKey: string, systemPrompt: string, userMessage: string, maxTokens: number, auditDepth: AuditDepth): Promise<LiteLLMResult> {
  const primaryModel = LITELLM_MODELS[auditDepth];

  // Quick mode: no fallback needed (Qwen is free)
  if (auditDepth === 'quick') {
    const text = await callLiteLLMWithModel(apiKey, systemPrompt, userMessage, maxTokens, primaryModel);
    return { text, modelUsed: primaryModel, wasFallback: false };
  }

  // Deep mode: Opus 4.6 → DeepSeek Reasoner fallback
  // Check if Opus recently hit rate limit (cached failure)
  if (isOpusCached()) {
    console.log(`⚡ Opus rate limit cached (${Math.round((Date.now() - lastOpusFailureTimestamp!) / 60000)}min ago) — using ${DEEP_FALLBACK_MODEL} directly`);
    const text = await callLiteLLMWithModel(apiKey, systemPrompt, userMessage, maxTokens, DEEP_FALLBACK_MODEL);
    return { text, modelUsed: DEEP_FALLBACK_MODEL, wasFallback: true };
  }

  // Try Opus first
  try {
    console.log(`🔍 Trying primary deep model: ${primaryModel}`);
    const text = await callLiteLLMWithModel(apiKey, systemPrompt, userMessage, maxTokens, primaryModel);
    return { text, modelUsed: primaryModel, wasFallback: false };
  } catch (error) {
    if (isRateLimitError(error)) {
      // Cache the failure so subsequent requests skip Opus
      lastOpusFailureTimestamp = Date.now();
      console.log(`🟠 Opus rate limit hit — caching for ${FALLBACK_CACHE_DURATION_MS / 60000}min, falling back to ${DEEP_FALLBACK_MODEL}`);
      const text = await callLiteLLMWithModel(apiKey, systemPrompt, userMessage, maxTokens, DEEP_FALLBACK_MODEL);
      return { text, modelUsed: DEEP_FALLBACK_MODEL, wasFallback: true };
    }
    // Non-rate-limit error — rethrow
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AuditRequest & { provider?: string; auditDepth?: AuditDepth; customModel?: string } = await request.json();
    const { contracts, tests, protocolDescription, provider: requestedProvider, context, auditDepth = 'quick', customModel } = body;

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
    let modelUsed: string | undefined;
    let wasFallback = false;

    if (provider === 'litellm') {
      if (customModel) {
        // Custom model: call directly, no fallback logic
        console.log(`🧪 Custom model selected: ${customModel}`);
        responseText = await callLiteLLMWithModel(apiKey, systemPrompt, userMessage, maxTokens, customModel);
        modelUsed = customModel;
      } else {
        const result = await callLiteLLM(apiKey, systemPrompt, userMessage, maxTokens, auditDepth);
        responseText = result.text;
        modelUsed = result.modelUsed;
        wasFallback = result.wasFallback;
        if (wasFallback) {
          console.log(`✅ Fallback successful: used ${modelUsed} instead of Opus`);
        }
      }
    } else if (provider === 'anthropic') {
      responseText = await callAnthropic(apiKey, systemPrompt, userMessage, maxTokens);
      modelUsed = 'claude-sonnet-4';
    } else {
      responseText = await callOpenAI(apiKey, systemPrompt, userMessage, maxTokens);
      modelUsed = 'gpt-4o';
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
      
      // Look for report content - handle both escaped and unescaped formats
      const reportMatch = responseText.match(/"report"\s*:\s*"([\s\S]*)/);
      if (reportMatch) {
        report = reportMatch[1]
          // Unescape JSON string sequences
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          // Remove trailing incomplete sequences
          .replace(/\\[^ntr"\\]?$/, '')  // Remove incomplete escape at end
          .replace(/"\s*\}\s*$/, '')      // Remove trailing "}" if present
          .replace(/"\s*$/, '');          // Remove trailing quote if present
        
        // If truncated mid-section, add a note
        if (!report.includes('## Conclusions') && !report.includes('---\n\n*')) {
          report += '\n\n---\n\n*Note: Report was truncated due to response length limits. Consider using Deep Audit for longer contracts.*';
        }
      }
      
      if (report && report.length > 100) {
        console.log('Recovered truncated response successfully');
        return NextResponse.json({ report, modelUsed, wasFallback });
      }
      
      // If recovery failed, return raw markdown (strip JSON wrapper)
      const cleanedResponse = responseText
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .replace(/^\{\s*"report"\s*:\s*"/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"');
      
      if (cleanedResponse && cleanedResponse.length > 100) {
        return NextResponse.json({
          report: cleanedResponse.substring(0, 50000) + '\n\n---\n\n*Note: Report may be incomplete due to response parsing issues.*',
          modelUsed,
          wasFallback,
        });
      }
      
      return NextResponse.json({
        report: '# Security Audit Report\n\n## Response Parsing Issue\n\nThe AI generated a response but it could not be parsed. Please try again with Deep Audit mode.',
      });
    }

    return NextResponse.json({
      report: parsedResponse.report || '# No report generated',
      modelUsed,
      wasFallback,
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
