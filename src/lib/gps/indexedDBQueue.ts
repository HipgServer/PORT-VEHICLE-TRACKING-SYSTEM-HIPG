import { openDB, IDBPDatabase } from "idb";
import { IQueuedGpsRecord } from "@/lib/types";

const DB_NAME = "peri_gps_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "gps_upload_queue";
const MAX_QUEUE_SIZE = 5000;

class IndexedDBQueue {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDB(): Promise<IDBPDatabase> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("IndexedDB is only available in browser environments"));
    }

    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "recordId" });
            store.createIndex("by_status", "uploadStatus");
            store.createIndex("by_timestamp", "timestamp");
            store.createIndex("by_retry", "retryCount");
          }
        },
      });
    }

    return this.dbPromise;
  }

  /**
   * Enqueue a GPS record locally before attempting network transmission.
   * Enforces queue limit to prevent storage exhaustion.
   */
  async enqueue(record: IQueuedGpsRecord): Promise<void> {
    try {
      const db = await this.getDB();
      const count = await db.count(STORE_NAME);

      if (count >= MAX_QUEUE_SIZE) {
        // Drop oldest uploaded or failed record if queue limit reached
        const tx = db.transaction(STORE_NAME, "readwrite");
        const index = tx.store.index("by_timestamp");
        let cursor = await index.openCursor();
        if (cursor) {
          await cursor.delete();
        }
        await tx.done;
      }

      await db.put(STORE_NAME, record);
    } catch (error) {
      if ((error as any)?.name === "QuotaExceededError") {
        console.warn("IndexedDB storage quota exceeded. Purging oldest uploaded records.");
        await this.purgeUploadedRecords();
      } else {
        console.error("Failed to enqueue GPS record in IndexedDB:", error);
      }
    }
  }

  /**
   * Retrieves pending records ordered chronologically
   */
  async getPendingRecords(limit: number = 50): Promise<IQueuedGpsRecord[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.store.index("by_timestamp");
      const records: IQueuedGpsRecord[] = [];

      let cursor = await index.openCursor();
      while (cursor && records.length < limit) {
        if (cursor.value.uploadStatus === "pending" || cursor.value.uploadStatus === "failed") {
          records.push(cursor.value);
        }
        cursor = await cursor.continue();
      }

      return records;
    } catch (error) {
      console.error("Failed to read pending GPS records from IndexedDB:", error);
      return [];
    }
  }

  /**
   * Counts how many records are currently pending in offline queue
   */
  async getPendingCount(): Promise<number> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.store.index("by_status");
      const pendingCount = await index.count("pending");
      const failedCount = await index.count("failed");
      return pendingCount + failedCount;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Mark record as currently uploading
   */
  async markUploading(recordIds: string[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    for (const id of recordIds) {
      const item = await tx.store.get(id);
      if (item) {
        item.uploadStatus = "uploading";
        item.lastAttemptAt = new Date().toISOString();
        await tx.store.put(item);
      }
    }
    await tx.done;
  }

  /**
   * Mark record upload as failed with incremented retry count
   */
  async markFailed(recordId: string, errorMessage?: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const item = await tx.store.get(recordId);
      if (item) {
        item.uploadStatus = "failed";
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastAttemptAt = new Date().toISOString();
        item.errorMessage = errorMessage;
        await tx.store.put(item);
      }
      await tx.done;
    } catch (error) {
      console.error("Failed to update record retry status:", error);
    }
  }

  /**
   * Permanently delete record ONLY after confirmed server acceptance (200/201 response)
   */
  async removeConfirmed(recordId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(STORE_NAME, recordId);
    } catch (error) {
      console.error(`Failed to remove confirmed record ${recordId}:`, error);
    }
  }

  /**
   * Purge old uploaded records to free quota
   */
  async purgeUploadedRecords(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const index = tx.store.index("by_status");
      let cursor = await index.openCursor(IDBKeyRange.only("uploaded"));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    } catch (error) {
      console.error("Failed to purge uploaded records:", error);
    }
  }
}

export const gpsOfflineQueue = new IndexedDBQueue();

