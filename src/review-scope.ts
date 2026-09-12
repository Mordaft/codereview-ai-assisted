import type { StoredReviewFile } from './review-db'

const analyzableExtensions = new Set([
  'c', 'cc', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'jsx', 'json', 'kt', 'kts', 'md', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'vue', 'xml', 'yml', 'yaml', 'ini', 'conf', 'config', 'env.example',
])
const maxFileCharacters = 120_000

export function isAnalyzableReviewFile(file: StoredReviewFile) {
  const normalizedPath = file.path.toLowerCase()
  const extension = normalizedPath.split('.').slice(1).join('.')
  const hasSupportedExtension = analyzableExtensions.has(extension) || analyzableExtensions.has(normalizedPath.split('.').at(-1) ?? '')
  const content = file.content ?? ''
  return hasSupportedExtension && content.length > 0 && content.length <= maxFileCharacters && !file.path.startsWith('package-lock.')
}

export function selectAnalyzableReviewFiles(files: StoredReviewFile[]) {
  return files.filter(isAnalyzableReviewFile)
}
