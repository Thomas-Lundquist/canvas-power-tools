import { getLog } from '../dom/recovery-log.js'
import { filterForReport } from './privacy-filter.js'
import { getHealthCheckResults } from '../dom/health-check.js'

export async function generateIssueReport() {
  const { results, timestamp } = await getHealthCheckResults()
  const rawLog = await getLog()
  const filteredLog = filterForReport(rawLog.slice(0, 20))

  const failing = Object.entries(results)
    .filter(([, v]) => v.status === 'failing')
    .map(([k, v]) => `- ${k}: ${v.description}`)
    .join('\n')

  const warnings = Object.entries(results)
    .filter(([, v]) => v.status === 'warning')
    .map(([k, v]) => `- ${k}: ${v.description}`)
    .join('\n')

  const body = `
## Canvas Integration Issue Report

**Extension Version:** 1.0.0
**Health Check Timestamp:** ${timestamp ?? 'not run'}
**Canvas Version:** (visible in Settings > Canvas Integration Health)

### Failing Selectors
${failing || 'None'}

### Warning Selectors (using fallback)
${warnings || 'None'}

### Recent DOM Log (last 20 entries, PII removed)
\`\`\`json
${JSON.stringify(filteredLog, null, 2)}
\`\`\`

---
*Generated automatically by Canvas Power Tools. No personal data is included.*
`.trim()

  const title = encodeURIComponent('[Bug] Canvas integration selector failure')
  const bodyEncoded = encodeURIComponent(body)
  return `https://github.com/your-org/canvas-power-tools/issues/new?title=${title}&body=${bodyEncoded}`
}
