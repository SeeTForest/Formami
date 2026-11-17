export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface FormamiClientOptions {
  /**
   * Explicit API base URL for your Formami instance; no default hosted endpoint.
   * For self-hosted installs use your instance URL plus `/api`, e.g. `https://analytics.example.com/api`.
   */
  baseUrl?: string;
  /**
   * Bearer token: a login token from `POST /api/auth/login`, or a
   * self-hosted API key (`formami_…`).
   */
  token?: string;
  /**
   * Formami instance API key. Sent as `x-formami-api-key`. When no `token` is provided the key is also
   * sent as a bearer token so that self-hosted `formami_…` keys work with either option.
   */
  apiKey?: string;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (testing, alternative runtimes, in-process dispatch). */
  fetch?: FetchLike;
  /** Per-request timeout in milliseconds. Disabled by default. */
  timeout?: number;
}

export interface RequestOptions {
  /** Extra headers for this request only. */
  headers?: Record<string, string>;
  /** Abort signal for this request. */
  signal?: AbortSignal;
}
