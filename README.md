# Ringkasan Perubahan Backend Task Management

PR ini melakukan refaktorisasi menyeluruh pada backend Azure Functions guna meningkatkan aspek keamanan, stabilitas sistem, dan keterbacaan kode, sekaligus menambahkan endpoint API yang diperlukan untuk fitur Form Settings (Bagian 2).

Diajukan oleh: Haryo Prastiko

---

## Daftar Perubahan

### Keamanan (Security)

- **Kredensial Database Diamankan**: String koneksi Cosmos DB tidak lagi di-hardcode di dalam source code, melainkan dimuat dari environment variable `CosmosDBConnectionString` melalui helper [getConnectionString](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/utils/cosmos.ts#L21-L29) agar tidak terekspos ke version control.
- **SQL Injection Ditangani**: Fungsi [GetTasks](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/functions/GetTasks.ts#L146-L174) sebelumnya menggabungkan `organizationId` langsung ke string query (raw concatenation). Kini telah diperbaiki menggunakan **parameterized query** dengan `SqlParameter` yang aman untuk nilai `@organizationId`, `@status`, `@priority`, dan `@search`.
- **Validasi Body Request pada Endpoint Write**: Semua endpoint yang menerima payload (POST/PUT/DELETE) kini dilengkapi validasi input ketat sebelum data menyentuh database:
  - Endpoint **InsertTask** & **UpdateTask**: Menggunakan [validateTaskInput](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/taskApi.ts#L53-L201) untuk memastikan tipe data, panjang field, enum yang valid, serta sanitasi whitespace otomatis.
  - Endpoint **SaveFormSettings**: Menggunakan [validateFormSettingsInput](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/taskApi.ts#L658-L797) untuk memverifikasi struktur array fields, kelengkapan `name` dan `label`, serta tipe field yang diizinkan.
  - Endpoint **BulkDeleteTasks**: Memvalidasi bahwa body merupakan array string ID yang tidak kosong.

### Keandalan (Reliability)

- **Singleton CosmosClient**: Klien Cosmos DB tidak lagi di-instansiasi baru setiap request (yang menyebabkan pemborosan resource dan connection pool). Kini diterapkan pola **singleton** `cachedClient` di [getClient](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/utils/cosmos.ts#L32-L37) sehingga satu koneksi dipakai bersama untuk seluruh umur aplikasi.
- **BulkDeleteTasks Lebih Aman**: Implementasi lama menggunakan `forEach` dengan callback async tanpa `await` (race condition, error tidak tertangani). Kini diganti dengan **Promise.all** paralel di [BulkDeleteTasks](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/functions/BulkDeleteTasks.ts#L47-L55), dengan:
  - Tracking detail per-item (berhasil/gagal)
  - HTTP status **207 Multi-Status** ketika sebagian task gagal dihapus
  - Penghitungan `deletedCount` dan `failedCount` secara akurat
- **Error Handling Standar di Seluruh Endpoint**: Semua endpoint dibungkus dengan middleware [withErrorHandler](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/utils/http.ts#L22-L38) yang melakukan:
  - Global try/catch agar tidak ada unhandled exception bocor ke runtime
  - Mapping `error.code` otomatis ke status HTTP yang sesuai: **400** (Bad Request), **404** (Not Found), dan **500** (Internal Server Error)
  - Format error response yang konsisten `{ error: "<pesan>" }`
- **Strategi Update Task**: Endpoint **UpdateTask** melakukan **read-then-merge-then-patch** di [UpdateTask.ts](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/functions/UpdateTask.ts#L44-L92). Task existing dibaca terlebih dahulu untuk melakukan merge `customFields` dan `customFieldDefinitions`, sehingga definisi custom field lama tidak hilang saat partial update. Selalu memperbarui `updatedAt` setiap ada perubahan.
- **Pagination GetTasks yang Akurat**: Fungsi [GetTasks](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/functions/GetTasks.ts#L32-L197) dilengkapi:
  - Parameter `page` dan `per_page` (default 5, maks 100)
  - Filter `status` dan `priority` dengan **mapping case-sensitive** (PascalCase frontend → lowercase/kebab-case database) via `STATUS_INPUT_TO_DB` dan `PRIORITY_INPUT_TO_DB`
  - Pengecualian eksplisit dokumen `form_settings` dari query (agar tidak merusak hitungan `total_items`)
  - Fitur pencarian (`search`) pada title, description, dan assignee

### Endpoint Baru (Bagian 2 — Form Settings)

- **GET /api/GetFormSettings**: Mengambil konfigurasi layout form field custom per organisasi. Jika belum ada konfigurasi tersimpan, fallback ke `DEFAULT_FORM_FIELDS` (6 field default: Title, Status, Priority, Due Date, Assignee, Description) dengan response envelope standar. Lihat [GetFormSettings.ts](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/functions/GetFormSettings.ts).
- **POST /api/SaveFormSettings**: Menyimpan atau memperbarui (UPSERT) konfigurasi form field. Menggunakan `FORM_SETTINGS_DOCUMENT_ID = "form_settings"` dengan `organizationId` sebagai partition key (Single Container Pattern — task dan config share container yang sama). Mengembalikan **201** jika baru dibuat, atau **200** jika diperbarui. Lihat [SaveFormSettings.ts](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/functions/SaveFormSettings.ts).

### Lainnya

- **TypeScript Strict Mode Diaktifkan**: `tsconfig.json` kini mengaktifkan `"strict": true` untuk type-safety maksimal (strict null checks, strict function types, no implicit any, dll).
- **Pemisahan Kode Berdasarkan Peran (Separation of Concerns)**:
  - `src/functions/` — Semua HTTP trigger endpoint Azure Functions
  - `src/utils/` — Helper reusable: [cosmos.ts](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/utils/cosmos.ts) (koneksi DB) dan [http.ts](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/utils/http.ts) (error handling, parsing)
  - `src/taskApi.ts` — Domain logic terpusat: type definitions, validators, builder functions, normalisasi form fields, dan helper custom fields
- **Normalisasi & Kompatibilitas Form Field**:
  - [normalizeFormFields](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/taskApi.ts#L529-L542): Fallback ke default jika struktur field dari database invalid
  - [adaptFieldsForFrontend](file:///d:/Temp/Lamar%20Kerja/kitameraki-be-test/src/taskApi.ts#L560-L634): Melengkapi property field (`id`, `isDefault`, `colSpan`, auto-generate `name` dari `label` via slugify) agar frontend selalu menerima struktur yang lengkap dan aman
- **3 Lapis Sanitasi Data Task**:
  1. **validateTaskInput**: Normalisasi in-place (trim, clean, validate)
  2. **buildTaskForCreate**: Fail-safe sanitasi pada operasi create
  3. **buildPatchOperations**: Proteksi sanitasi pada operasi update (field kosong di-skip, description dihapus jika whitespace-only)

---

## Cara Testing di Lokal

1. **Persiapkan Cosmos DB**: Jalankan **Azure Cosmos DB Emulator** (atau siapkan instance Cosmos DB nyata).
2. **Atur Environment Variables**: Buat file `local.settings.json` atau export variabel:
   - `CosmosDBConnectionString` — Connection string emulator/produksi
   - `CosmosDBDatabaseId` — (opsional) Default: `TaskApp`
   - `CosmosDBContainerId` — (opsional) Default: `Tasks`
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Build & Jalankan Functions**:
   ```bash
   npm run prestart && npm start
   ```
   — atau untuk mode watch (auto-recompile):
   ```bash
   npm run watch
   # Terminal lain:
   npm start
   ```
5. **Daftar Endpoint Tersedia**:
   - `GET    /api/GetTasks?organizationId={uuid}&page=1&per_page=5`
   - `GET    /api/GetTask?id={id}&organizationId={uuid}`
   - `POST   /api/InsertTask`
   - `POST   /api/UpdateTask?id={id}&organizationId={uuid}`
   - `DELETE /api/DeleteTask?id={id}&organizationId={uuid}`
   - `DELETE /api/BulkDeleteTasks?organizationId={uuid}`
   - `GET    /api/GetFormSettings?organizationId={uuid}`
   - `POST   /api/SaveFormSettings`
