/**
 * Azure Functions App Entry Point
 * -------------------------------
 * File ini dieksekusi PERTAMA KALI saat Azure Functions runtime
 * memulai app (sesuai konfigurasi di tsconfig.json: rootDir=src,
 * package.json main="dist/{index.js,functions/*.js}").
 *
 * Tanggung jawab:
 *   Meng-import seluruh function definitions yang ada di folder
 *   functions/. Tiap file function memanggil app.http() yang akan
 *   me-register endpoint ke Functions runtime.
 */

import "./functions";
