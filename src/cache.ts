import { createHash } from 'node:crypto'

export interface CacheEntry {
	diffHash: string
	summary: string
	timestamp: number
}

export class SummaryCache {
	private cache: Map<string, CacheEntry> = new Map()

	public get(filePath: string): CacheEntry | undefined {
		return this.cache.get(filePath)
	}

	public set(filePath: string, diffHash: string, summary: string): void {
		this.cache.set(filePath, {
			diffHash,
			summary,
			timestamp: Date.now(),
		})
	}

	public has(filePath: string): boolean {
		return this.cache.has(filePath)
	}

	public clear(): void {
		this.cache.clear()
	}

	public computeHash(content: string): string {
		return createHash('sha256').update(content).digest('hex')
	}
}

export const summaryCache = new SummaryCache()
