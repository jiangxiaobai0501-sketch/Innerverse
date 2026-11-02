import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Desktop operations pass a revocable context; existing isolated storage callers need none.
export const NO_CONTEXT = Object.freeze({ check() {}, commit: action => action() })

// A file:// page must never read userData through img/script URLs instead of the IPC gate.
export function allowPublicFile(url, directory) {
  try {
    const inside = (base, file) => { const relative = path.relative(base, file); return Boolean(relative) && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) }
    const filename = fileURLToPath(url)
    // Reject outside/UNC paths before filesystem access as well as after resolving links.
    if (!inside(path.resolve(directory), path.resolve(filename))) return false
    return inside(realpathSync(directory), realpathSync(filename))
  } catch { return false }
}
