export type LLMProvider = 'openai' | 'ollama';

export type LLMOptions = {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function chatJson(opts: {
  system: string;
  user: string;
  options?: LLMOptions;
}): Promise<{ ok: true; content: string; provider: LLMProvider; model: string } | { ok: false; error: string; provider: LLMProvider; model: string }> {
  const provider = (opts.options?.provider || (process.env.QA_LLM_PROVIDER as LLMProvider) || 'openai') as LLMProvider;

  if (provider === 'ollama') {
    let model = opts.options?.model || process.env.QA_OLLAMA_MODEL || 'gemma3:4b';
    const base = process.env.QA_OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    try {
      const resp = await fetchWithTimeout(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: { temperature: opts.options?.temperature ?? 0.2 },
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
        }),
      }, opts.options?.timeoutMs ?? 30000);
      if (!resp.ok) {
        // model not found: auto-fallback to first installed local model
        if (resp.status === 404 && !opts.options?.model) {
          const tags = await fetchWithTimeout(`${base}/api/tags`, {}, opts.options?.timeoutMs ?? 15000).then((r) => r.json()).catch(() => null as any);
          const fallback = tags?.models?.[0]?.name;
          if (fallback && fallback !== model) {
            model = fallback;
            const retry = await fetchWithTimeout(`${base}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model,
                stream: false,
                format: 'json',
                options: { temperature: opts.options?.temperature ?? 0.2 },
                messages: [
                  { role: 'system', content: opts.system },
                  { role: 'user', content: opts.user },
                ],
              }),
            }, opts.options?.timeoutMs ?? 30000);
            if (retry.ok) {
              const data: any = await retry.json();
              const content = data?.message?.content;
              if (content) return { ok: true, content, provider, model };
            }
          }
        }
        return { ok: false, error: `ollama http ${resp.status}`, provider, model };
      }
      const data: any = await resp.json();
      const content = data?.message?.content;
      if (!content) return { ok: false, error: 'ollama empty content', provider, model };
      return { ok: true, content, provider, model };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'ollama error', provider, model };
    }
  }

  const model = opts.options?.model || process.env.QA_OPENAI_MODEL || 'gpt-4o-mini';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY not set', provider, model };

  try {
    const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: opts.options?.temperature ?? 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
    }, opts.options?.timeoutMs ?? 30000);
    if (!resp.ok) return { ok: false, error: `openai http ${resp.status}`, provider, model };
    const data: any = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'openai empty content', provider, model };
    return { ok: true, content, provider, model };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'openai error', provider, model };
  }
}
