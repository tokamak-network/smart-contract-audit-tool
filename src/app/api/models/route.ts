import { NextResponse } from 'next/server';

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  tier: 'free' | 'standard' | 'premium';
}

// Model metadata for display in the UI
const MODEL_META: Record<string, Omit<ModelInfo, 'id'>> = {
  'qwen3-coder-flash': {
    label: 'Qwen3 Coder Flash',
    description: 'Fast code analysis, FREE',
    speed: 'fast',
    tier: 'free',
  },
  'qwen3-235b-thinking': {
    label: 'Qwen3 235B Thinking',
    description: 'Large reasoning model with thinking traces',
    speed: 'slow',
    tier: 'free',
  },
  'qwen3-235b': {
    label: 'Qwen3 235B',
    description: 'Large model, fast without reasoning overhead',
    speed: 'medium',
    tier: 'free',
  },
  'qwen3-80b-next': {
    label: 'Qwen3 80B Next',
    description: 'Mid-size Qwen, good balance of speed & quality',
    speed: 'fast',
    tier: 'free',
  },
  'glm-4.7': {
    label: 'GLM 4.7',
    description: 'GLM series general model',
    speed: 'medium',
    tier: 'free',
  },
  'deepseek-reasoner': {
    label: 'DeepSeek Reasoner',
    description: 'Best reasoning for exploit paths',
    speed: 'slow',
    tier: 'standard',
  },
  'deepseek-chat': {
    label: 'DeepSeek Chat',
    description: 'Fast general analysis',
    speed: 'fast',
    tier: 'standard',
  },
  'deepseek-v3.2': {
    label: 'DeepSeek V3.2',
    description: 'Latest DeepSeek general model',
    speed: 'medium',
    tier: 'standard',
  },
  'claude-sonnet-4.5': {
    label: 'Claude Sonnet 4.5',
    description: 'Balanced speed & quality',
    speed: 'medium',
    tier: 'standard',
  },
  'anthropic-max-claude-sonnet-4-5': {
    label: 'Claude Sonnet 4.5 (Max)',
    description: 'Extended context Sonnet',
    speed: 'medium',
    tier: 'standard',
  },
  'anthropic-max-claude-haiku-4-5': {
    label: 'Claude Haiku 4.5 (Max)',
    description: 'Fast and lightweight Claude',
    speed: 'fast',
    tier: 'standard',
  },
  'gemini-3-flash': {
    label: 'Gemini 3 Flash',
    description: 'Google fast model',
    speed: 'fast',
    tier: 'standard',
  },
  'gemini-3-pro': {
    label: 'Gemini 3 Pro',
    description: 'Google flagship model',
    speed: 'medium',
    tier: 'standard',
  },
  'gemini-2.5-flash-image': {
    label: 'Gemini 2.5 Flash Image',
    description: 'Multimodal with image support',
    speed: 'fast',
    tier: 'standard',
  },
  'perplexity/sonar': {
    label: 'Perplexity Sonar',
    description: 'Search-augmented analysis',
    speed: 'medium',
    tier: 'standard',
  },
  'perplexity/sonar-deep-research': {
    label: 'Perplexity Sonar Deep Research',
    description: 'Deep research with web search',
    speed: 'slow',
    tier: 'standard',
  },
  'grok-4-1-fast-reasoning': {
    label: 'Grok 4.1 Fast Reasoning',
    description: 'xAI reasoning model, fast',
    speed: 'fast',
    tier: 'standard',
  },
  'grok-4-1-fast-non-reasoning': {
    label: 'Grok 4.1 Fast',
    description: 'xAI fast model without reasoning',
    speed: 'fast',
    tier: 'standard',
  },
  'gpt-5.2': {
    label: 'GPT-5.2',
    description: 'OpenAI base model',
    speed: 'medium',
    tier: 'premium',
  },
  'gpt-5.2-pro': {
    label: 'GPT-5.2 Pro',
    description: 'Top-tier general intelligence',
    speed: 'medium',
    tier: 'premium',
  },
  'gpt-5.2-codex': {
    label: 'GPT-5.2 Codex',
    description: 'Specialized for code analysis',
    speed: 'medium',
    tier: 'premium',
  },
  'anthropic-max-claude-opus-4-5': {
    label: 'Claude Opus 4.5 (Max)',
    description: 'Best quality, comprehensive audits',
    speed: 'slow',
    tier: 'premium',
  },
  'anthropic-max-claude-opus-4-6': {
    label: 'Claude Opus 4.6 (Max)',
    description: 'Latest Opus, highest quality',
    speed: 'slow',
    tier: 'premium',
  },
};

export async function GET() {
  const apiKey = process.env.LITELLM_API_KEY;
  const baseURL = process.env.LITELLM_BASE_URL || 'https://api.ai.tokamak.network';

  if (!apiKey) {
    return NextResponse.json({ models: [] });
  }

  try {
    // Fetch available models from LiteLLM proxy
    const response = await fetch(`${baseURL}/v1/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error('Failed to fetch models:', response.status);
      return NextResponse.json({ models: [] });
    }

    const data = await response.json();
    const rawModels: { id: string }[] = data.data || [];

    // Map to ModelInfo with metadata
    const models: ModelInfo[] = rawModels
      .map(m => {
        const meta = MODEL_META[m.id];
        if (meta) {
          return { id: m.id, ...meta };
        }
        // Unknown model — include with generic metadata
        return {
          id: m.id,
          label: m.id,
          description: 'Available model',
          speed: 'medium' as const,
          tier: 'standard' as const,
        };
      })
      // Sort: free first, then by tier
      .sort((a, b) => {
        const tierOrder = { free: 0, standard: 1, premium: 2 };
        return tierOrder[a.tier] - tierOrder[b.tier];
      });

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json({ models: [] });
  }
}
