/** IndexedDB 封装：存储书籍原始文件（ArrayBuffer） */

const DB_NAME = 'reader-files'
const DB_VERSION = 1
const STORE = 'files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
  })
}

function txn<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        transaction.oncomplete = () => {
          db.close()
          resolve(request.result)
        }
        transaction.onabort = () => {
          db.close()
          reject(transaction.error ?? new Error('IndexedDB 事务失败'))
        }
      }),
  )
}

export function putFile(id: string, data: ArrayBuffer): Promise<IDBValidKey> {
  return txn('readwrite', (store) => store.put(data, id))
}

export async function getFile(id: string): Promise<ArrayBuffer | undefined> {
  const result = await txn('readonly', (store) => store.get(id) as IDBRequest<ArrayBuffer | undefined>)
  return result ?? undefined
}

export function deleteFile(id: string): Promise<undefined> {
  return txn('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>)
}
