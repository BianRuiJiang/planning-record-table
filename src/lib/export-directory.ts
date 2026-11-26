import type { ExportFile } from './export'

// 浏览器不允许网站静默写入任意本地路径；这里通过目录句柄记住用户授权的目录。
// 目录名与 IndexedDB 名称都和时间追踪项目一致：授权一次，两边导出都落在同一个「时间开销」文件夹。
const DIRECTORY_NAME = '时间开销'
const DB_NAME = 'time-tracker-export'
const STORE_NAME = 'directories'
const KEY = 'markdown-directory'

type PickerOptions = { id?: string; mode?: 'read' | 'write' | 'readwrite' }

// 当前 DOM 类型库没有收录目录句柄的权限方法，这里补充实际浏览器能力。
type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: PickerOptions) => Promise<PermissionedDirectoryHandle>
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('导出目录数据库打开失败'))
  })
}

async function readDirectory(): Promise<PermissionedDirectoryHandle | null> {
  const database = await openDatabase()
  if (!database) return null

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(KEY)
    request.onsuccess = () => resolve((request.result as PermissionedDirectoryHandle | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('导出目录读取失败'))
    transaction.oncomplete = () => database.close()
  })
}

async function saveDirectory(directory: PermissionedDirectoryHandle) {
  const database = await openDatabase()
  // 保存失败不影响本次导出，只是下次需要重新选择目录。
  if (!database) return

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(directory, KEY)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => reject(transaction.error ?? new Error('导出目录保存失败'))
  })
}

async function clearDirectory() {
  const database = await openDatabase()
  if (!database) return

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(KEY)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => reject(transaction.error ?? new Error('导出目录清除失败'))
  })
}

async function ensureWritableDirectory(
  directory: PermissionedDirectoryHandle,
): Promise<PermissionedDirectoryHandle | null> {
  const state = await directory.queryPermission({ mode: 'readwrite' })
  if (state === 'granted') return directory
  if (typeof directory.requestPermission !== 'function') return null
  const next = await directory.requestPermission({ mode: 'readwrite' })
  return next === 'granted' ? directory : null
}

async function pickDirectory(): Promise<PermissionedDirectoryHandle> {
  const directory = await window.showDirectoryPicker!({ id: 'time-expense', mode: 'readwrite' })
  if (directory.name !== DIRECTORY_NAME) {
    throw new Error(`请选择「${DIRECTORY_NAME}」文件夹，与时间追踪导出的位置保持一致；本次导出未完成`)
  }
  return directory
}

async function resolveExportDirectory(): Promise<PermissionedDirectoryHandle> {
  const saved = await readDirectory()
  if (saved) {
    const directory = await ensureWritableDirectory(saved)
    if (!directory) await clearDirectory()
    else return directory
  }
  return pickDirectory()
}

async function writeFile(directory: PermissionedDirectoryHandle, file: ExportFile) {
  const handle = await directory.getFileHandle(file.name, { create: true })
  const stream = await handle.createWritable()
  try {
    await stream.write(new Blob([file.content], { type: 'text/markdown;charset=utf-8' }))
    await stream.close()
  } catch (error) {
    // 写入中断时关闭流，避免留下未完成的文件句柄。
    try {
      await stream.close()
    } catch {
      // 原始错误更有用，这里忽略关闭失败。
    }
    throw error
  }
}

export function supportsDirectoryExport() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export type SaveResult =
  | { mode: 'directory'; directory: string; files: string[] }
  | { mode: 'download' }

// 一次授权写入一批文件；返回最终写入位置，调用方据此提示并标记已导出。
export async function saveExportFiles(files: ExportFile[]): Promise<SaveResult> {
  if (!supportsDirectoryExport()) return { mode: 'download' }
  if (files.length === 0) return { mode: 'directory', directory: DIRECTORY_NAME, files: [] }

  const directory = await resolveExportDirectory()
  for (const file of files) await writeFile(directory, file)
  // 文件已经写入成功；目录句柄保存失败只影响下次是否需要重新授权。
  await saveDirectory(directory).catch((error) => console.error(error))
  return { mode: 'directory', directory: directory.name, files: files.map((file) => file.name) }
}
