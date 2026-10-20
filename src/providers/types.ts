export const PROVIDER_IDS = ['ollama', 'openai-compatible'] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export function isProviderId(value: unknown): value is ProviderId {
	return (
		typeof value === 'string' &&
		(PROVIDER_IDS as readonly string[]).includes(value)
	)
}

export interface ConnectionConfig {
	host: string
	headers: Record<string, string>
}
