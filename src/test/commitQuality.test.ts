import * as assert from 'node:assert'
import { isLowQualityCommit, isLowQualitySummary } from '../commitQuality'

suite('commit quality', () => {
	test('Should flag generic summaries', () => {
		assert.ok(isLowQualitySummary('No changes'))
		assert.ok(!isLowQualitySummary('Add validation for model selection'))
		assert.ok(!isLowQualitySummary('Update changelog for model selection flow'))
	})

	test('Should flag generic commit messages', () => {
		assert.ok(
			isLowQualityCommit('Empty commit or no changes provided', 'chore'),
		)
		assert.ok(isLowQualityCommit('Docs update', 'docs'))
		assert.ok(!isLowQualityCommit('Add model switch quick pick', 'feat'))
	})
})
