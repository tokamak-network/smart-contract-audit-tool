import { NextResponse } from 'next/server';

export interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  available: boolean;
}

export async function GET() {
  const providers: ProviderInfo[] = [
    {
      id: 'litellm',
      name: 'Tokamak AI (Opus 4.6 → DeepSeek Reasoner)',
      model: `Quick: ${process.env.LITELLM_MODEL_QUICK || 'qwen3-coder-flash'} | Deep: ${process.env.LITELLM_MODEL_DEEP || 'anthropic-max-claude-opus-4-6'} → ${process.env.LITELLM_MODEL_DEEP_FALLBACK || 'deepseek-reasoner'}`,
      available: !!process.env.LITELLM_API_KEY,
    },
    {
      id: 'anthropic',
      name: 'Claude (Anthropic Direct)',
      model: 'claude-sonnet-4-20250514',
      available: !!process.env.ANTHROPIC_API_KEY,
    },
    {
      id: 'openai',
      name: 'GPT-4 (OpenAI)',
      model: 'gpt-4o',
      available: !!process.env.OPENAI_API_KEY,
    },
  ];

  return NextResponse.json({ providers });
}
