/**
 * Cosmos DB Connection Helper
 * ---------------------------
 * Utility untuk membuat dan me-manage koneksi ke Azure Cosmos DB.
 * Menyediakan singleton CosmosClient + helper untuk mengambil
 * reference Database dan Container dengan konfigurasi dari
 * environment variables (atau default fallback).
 *
 * Environment Variables:
 *   CosmosDBConnectionString  (WAJIB)
 *   CosmosDBDatabaseId        (opsional, default: TaskApp)
 *   CosmosDBContainerId       (opsional, default: Tasks)
 */

import { CosmosClient, Container, Database } from "@azure/cosmos";

/** Nama database default jika tidak ada override dari env. */
const DEFAULT_DATABASE_ID = "TaskApp";

/** Nama container default jika tidak ada override dari env. */
const DEFAULT_CONTAINER_ID = "Tasks";

/**
 * Singleton CosmosClient. Satu instance cukup untuk seluruh app;
 * CosmosClient sudah thread-safe dan melakukan pooling internal.
 */
let cachedClient: CosmosClient | null = null;

/**
 * Ambil connection string dari environment variable.
 * Akan throw error code 500 jika tidak dikonfigurasi.
 */
function getConnectionString(): string {
    const cs = process.env.CosmosDBConnectionString;
    if (!cs) {
        const err = new Error("CosmosDBConnectionString is not configured in environment variables");
        (err as any).code = 500;
        throw err;
    }
    return cs;
}

/**
 * Dapatkan (atau buat) singleton CosmosClient.
 * Client pertama kali dibuat saat pertama dipanggil, lalu di-caching.
 */
function getClient(): CosmosClient {
    if (!cachedClient) {
        cachedClient = new CosmosClient(getConnectionString());
    }
    return cachedClient;
}

/**
 * Dapatkan reference Database dengan ID tertentu.
 *
 * @param databaseIdOverride  Jika diberikan, pakai ID ini;
 *                            jika tidak, baca dari env CosmosDBDatabaseId
 *                            atau fallback ke DEFAULT_DATABASE_ID
 */
export function getDatabase(databaseIdOverride?: string): Database {
    const dbId = databaseIdOverride || process.env.CosmosDBDatabaseId || DEFAULT_DATABASE_ID;
    return getClient().database(dbId);
}

/**
 * Dapatkan reference Container (table/collection) untuk operasi CRUD.
 * Ini adalah helper yang paling sering dipanggil oleh function handlers.
 *
 * @param containerIdOverride Override nama container
 * @param databaseIdOverride  Override nama database
 */
export function getContainer(containerIdOverride?: string, databaseIdOverride?: string): Container {
    const containerId = containerIdOverride || process.env.CosmosDBContainerId || DEFAULT_CONTAINER_ID;
    return getDatabase(databaseIdOverride).container(containerId);
}

/** Type untuk error konfigurasi Cosmos (dipakai oleh error handler). */
export interface CosmosConfigError {
    code: number;
    message: string;
}
