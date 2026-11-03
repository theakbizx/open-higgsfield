/**
 * OpenRouter provider adapter.
 *
 * Keep OPENROUTER_API_KEY server-side only. Never expose it through NEXT_PUBLIC_*
 * variables or send it to client components.
 *
 * API reference: https://openrouter.ai/docs
 */
const API_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export type OpenRouterOptions = {
  apiKey?: string;
  fetch?: typeof fetch;
  siteUrl?: string;
  siteName?: string;
};

export function createOpenRouterClient(options: OpenRouterOptions = {}) {
  const apiKey = (options.apiKey ?? process.env.OPENROUTER_API_KEY ?? "").trim();
  if (!apiKey.startsWith("sk-or-")) {
    throw new Error("Missing or invalid OPENROUTER_API_KEY");
  }

  const fetchImpl = options.fetch ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(options.siteUrl ? { "HTTP-Referer": options.siteUrl } : {}),
        ...(options.siteName ? { "X-Title": options.siteName } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });

    const raw = await response.text();
    let payload: unknown = null;
    try { payload = raw ? JSON.parse(raw) : null; }
    catch { payload = raw; }

    if (!response.ok) {
      const detail = payload && typeof payload === "object"
        ? (payload as { error?: { message?: string } }).error?.message
        : undefined;
      throw new OpenRouterError(
        detail || `OpenRouter request failed (${response.status})`,
        response.status,
        payload,
      );
    }
    return payload as T;
  }

  return {
    chat(input: {
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string | unknown[] }>;
      temperature?: number;
      max_tokens?: number;
    }) {
      return request<{ choices: Array<{ message: { content?: string } }>; usage?: unknown }>(
        "/chat/completions",
        { method: "POST", body: JSON.stringify(input) },
      );
    },

    generateImage(input: {
      model: string;
      prompt: string;
      aspect_ratio?: string;
      n?: number;
      output_format?: "png" | "jpeg" | "webp";
      input_references?: Array<string | { type: "image_url"; image_url: { url: string } }>;
    }) {
      return request<{
        data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
        usage?: { cost?: number };
      }>("/images", { method: "POST", body: JSON.stringify(input) });
    },

    createVideo(input: {
      model: string;
      prompt: string;
      aspect_ratio?: string;
      duration?: number;
      resolution?: string;
      generate_audio?: boolean;
      frame_images?: Array<{ frame_type: "first_frame" | "last_frame"; image_url: string }>;
      input_references?: unknown[];
    }) {
      return request<{ id: string; polling_url?: string; status: string; generation_id?: string }>(
        "/videos",
        { method: "POST", body: JSON.stringify(input) },
      );
    },

    getVideoJob(jobId: string) {
      if (!jobId || jobId.includes("/")) throw new Error("Invalid video job id");
      return request<{
        id: string;
        status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "expired";
        error?: string;
        urls?: string[];
        unsigned_urls?: string[];
        usage?: { cost?: number };
      }>(`/videos/${encodeURIComponent(jobId)}`);
    },

    async downloadVideo(jobId: string, index = 0) {
      if (!jobId || jobId.includes("/") || !Number.isInteger(index) || index < 0) {
        throw new Error("Invalid video download request");
      }
      const response = await fetchImpl(
        `${API_BASE}/videos/${encodeURIComponent(jobId)}/content?index=${index}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
      );
      if (!response.ok) {
        const message = await response.text();
        throw new OpenRouterError(message || "Video download failed", response.status, message);
      }
      return response;
    },
  };
}
