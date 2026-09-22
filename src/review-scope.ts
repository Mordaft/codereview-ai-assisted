import { trace } from './diagnostics'
import type { StoredReviewFile } from './review-db'

const analyzableExtensions = new Set([
  'c', 'cc', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'jsx', 'json', 'kt', 'kts', 'md', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'vue', 'xml', 'yml', 'yaml', 'ini', 'conf', 'config', 'env.example',
])
const maxFileCharacters = 120_000

export function getFileExclusionReason(file: StoredReviewFile): string | null {
  const normalizedPath = file.path.toLowerCase()
  if (file.path.startsWith('package-lock.')) {
    return 'ignored_package_lock'
  }
  const extension = normalizedPath.split('.').slice(1).join('.')
  const hasSupportedExtension = analyzableExtensions.has(extension) || analyzableExtensions.has(normalizedPath.split('.').at(-1) ?? '')
  if (!hasSupportedExtension) {
    return 'unsupported_extension'
  }
  const source = file.content ?? file.patch ?? ''
  if (source.length === 0) {
    return 'empty_content_and_patch'
  }
  if (source.length > maxFileCharacters) {
    return 'exceeds_max_characters'
  }
  return null
}

export function isAnalyzableReviewFile(file: StoredReviewFile): boolean {
  return getFileExclusionReason(file) === null
}

export function selectAnalyzableReviewFiles(files: StoredReviewFile[]): StoredReviewFile[] {
  const analyzable: StoredReviewFile[] = []
  for (const file of files) {
    const reason = getFileExclusionReason(file)
    if (reason === null) {
      analyzable.push(file)
    } else {
      trace('slm.scope.file_skipped', {
        filePath: file.path,
        reason,
        contentLength: file.content?.length ?? 0,
        patchLength: file.patch?.length ?? 0,
      })
    }
  }
  return analyzable
}
