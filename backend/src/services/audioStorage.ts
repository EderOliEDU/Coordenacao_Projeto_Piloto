import { promises as fs } from 'fs'
import * as path from 'path'

export function resolveAudioPath(rootPath: string, relativePath: string) {
  const root = path.resolve(rootPath)
  const absolute = path.resolve(root, relativePath)
  if (!relativePath || path.isAbsolute(relativePath) || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Caminho de áudio inválido')
  }
  return absolute
}

// Este caminho é usado apenas para reprodução; uploads e limpeza continuam locais.
export async function findReadableAudioPath(relativePath: string, localRoot: string, readOnlyRoot?: string) {
  const candidates = [resolveAudioPath(localRoot, relativePath)]
  if (readOnlyRoot) candidates.push(resolveAudioPath(readOnlyRoot, relativePath))
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code || '')) throw error
    }
  }
  return null
}
