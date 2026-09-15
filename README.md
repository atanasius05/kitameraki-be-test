# 📋 Task Management Backend - Kitameraki Technical Test

Backend REST API untuk **manajemen Task** berbasis **Azure Functions v4** (TypeScript) + **Azure Cosmos DB**.

- **Stack**: Node.js ≥18, TypeScript, Azure Functions v4, Cosmos DB SQL API

---

## 🗂️ Struktur Project

```
kitameraki-be-test/
├── src/
│   ├── index.ts                  # Entry point Azure Functions
│   ├── taskApi.ts                # Domain logic: types + validasi + builders
│   ├── functions/
│   │   ├── index.ts              # Registry semua endpoint (barrel file)
│   │   ├── InsertTask.ts         # POST   /api/InsertTask
│   │   ├── GetTasks.ts           # GET    /api/GetTasks
│   │   ├── GetTask.ts            # GET    /api/GetTask
│   │   ├── UpdateTask.ts         # POST   /api/UpdateTask
│   │   ├── DeleteTask.ts         # DELETE /api/DeleteTask
│   │   ├── BulkDeleteTasks.ts    # DELETE /api/BulkDeleteTasks
│   │   ├── GetFormSettings.ts    # GET    /api/GetFormSettings
│   │   ├── SaveFormSettings.ts   # POST   /api/SaveFormSettings
│   │   └── GetTaskFormSettings.ts# GET    /api/GetTaskFormSettings
│   └── utils/
│       ├── cosmos.ts             # Cosmos DB helper (singleton client)
│       └── http.ts               # HTTP utils: error handler, parse body, dll.
├── host.json                     # Konfigurasi Azure Functions Runtime
├── tsconfig.json                 # Konfigurasi TypeScript compiler
├── package.json
└── task.schema.json              # JSON Schema untuk data Task
```

---

## ⚙️ Prasyarat

Pastikan sudah terinstall di mesin Anda:

| Komponen | Versi | Link |
|----------|-------|------|
| Node.js  | ≥ 18.x LTS | https://nodejs.org |
| Azure Functions Core Tools | v4 | `npm i -g azure-functions-core-tools@4 --unsafe-perm true` |
| Azure Cosmos DB | - | Account di Azure **ATAU** Cosmos DB Emulator (local) |

Opsional:
- [Azure Cosmos DB Emulator](https://learn.microsoft.com/en-us/azure/cosmos-db/local-emulator) untuk development tanpa koneksi internet.

---

## 🚀 Setup & Menjalankan Project

### Step 1: Install dependencies

```bash
cd kitameraki-be-test
npm install
```

### Step 2: Setup Environment Variables

Buat file **`local.settings.json`** di folder root project:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "CosmosDBConnectionString": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "CosmosDBDatabaseId": "TaskApp",
    "CosmosDBContainerId": "Tasks"
  }
}
```

> **Keterangan**:
> - `CosmosDBConnectionString` — Ganti dengan connection string Cosmos DB Anda (Portal Azure → Cosmos DB → Keys → Primary Connection String). Contoh di atas adalah default **Cosmos DB Emulator** lokal.
> - `CosmosDBDatabaseId` dan `CosmosDBContainerId` boleh diisi opsional. Defaultnya sudah `TaskApp` dan `Tasks`.

Database & container **akan otomatis dibuat** oleh Cosmos DB SDK jika belum ada saat pertama insert.

### Step 3: Jalankan Project

```bash
npm start
```

Command di atas akan menjalankan:
1. `npm run clean` (hapus folder `dist`)
2. `npm run build` (compile TypeScript → `dist/*.js`)
3. `func start` (jalankan Azure Functions Runtime lokal)

Jika berhasil, Anda akan melihat output:

```
Azure Functions Core Tools
...
Functions:

        BulkDeleteTasks:      [DELETE] http://localhost:7071/api/BulkDeleteTasks
        DeleteTask:           [DELETE] http://localhost:7071/api/DeleteTask
        GetFormSettings:      [GET]    http://localhost:7071/api/GetFormSettings
        GetTask:              [GET]    http://localhost:7071/api/GetTask
        GetTaskFormSettings:  [GET]    http://localhost:7071/api/GetTaskFormSettings
        GetTasks:             [GET]    http://localhost:7071/api/GetTasks
        InsertTask:           [POST]   http://localhost:7071/api/InsertTask
        SaveFormSettings:     [POST]   http://localhost:7071/api/SaveFormSettings
        UpdateTask:           [POST]   http://localhost:7071/api/UpdateTask

For detailed output, run func with --verbose flag.
```

🎉 **Backend sudah berjalan di `http://localhost:7071`**

---

## 📖 Daftar Endpoint

Base URL (local): **`http://localhost:7071/api`**

> 💡 **Pola Umum**: Semua endpoint Task menggunakan `organizationId` (UUID) sebagai **partition key** di Cosmos DB. Artinya data Task diisolasi per organisasi. Buat satu UUID untuk organisasi test Anda dan gunakan berulang di semua request.

Contoh UUID Organization untuk test:
```
123e4567-e89b-12d3-a456-426614174000
```

> 📐 **Dua Pola Response**:
> - **Task endpoints** (Insert/Get/Update/Delete): response langsung berupa object Task atau array Task.
> - **Form Settings endpoints**: response memakai envelope `{ result, code, message, data }`.
> - **Error** selalu memakai format `{ error: "<pesan>" }`.

---

### 1. 🆕 InsertTask — Buat Task Baru

| Item | Keterangan |
|------|-----------|
| Method | `POST` |
| Route | `/api/InsertTask` |
| Auth | Anonymous (development) |
| Body | JSON Task (lihat struktur di bawah) |
| Response 201 | Task yang berhasil dibuat |
| Response 400 | Body tidak valid |

**Request Body** — minimal `organizationId` + `title`:

```json
{
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Tulis proposal proyek",
  "description": "Buat draf proposal lengkap untuk klien XYZ",
  "dueDate": "2026-12-31T23:59:59Z",
  "priority": "high",
  "status": "todo",
  "tags": ["proyek", "urgent"],
  "customFields": {
    "client_name": "PT XYZ",
    "budget": 50000000
  }
}
```

**Response 201 Created**:
```json
{
  "id": "auto-generated-uuid",
  "organizationId": "...",
  "title": "Tulis proposal proyek",
  "description": "...",
  "dueDate": "2026-12-31T23:59:59Z",
  "priority": "high",
  "status": "todo",
  "tags": ["proyek", "urgent"],
  "customFields": { "client_name": "PT XYZ", "budget": 50000000 },
  "customFieldDefinitions": [],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "_rid": "...",
  "_self": "...",
  "_etag": "...",
  "_attachments": "...",
  "_ts": 1789223895
}
```

**Catatan**:
- Jika `id` tidak dikirim → **auto generate UUID**
- Jika `status` tidak dikirim → default **`todo`**
- Jika `tags` tidak dikirim → default **`[]`**
- Jika `customFields` tidak dikirim → default **`{}`**
- `customFieldDefinitions` akan di-snapshot dari form settings global (jika ada)

**cURL**:
```bash
curl -X POST http://localhost:7071/api/InsertTask \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"123e4567-e89b-12d3-a456-426614174000","title":"Tugas pertama","priority":"medium"}'
```

---

### 2. 📋 GetTasks — Ambil Task dengan Pagination + Search + Filter

| Item | Keterangan |
|------|-----------|
| Method | `GET` |
| Route | `/api/GetTasks` |
| Query Params | `organizationId` (**wajib**, UUID) |
| | `page` (opsional, default `1`) |
| | `per_page` (opsional, default `5`, max `100`) |
| | `search` (opsional, max 200 char) |
| | `status` (opsional) — `Todo` \| `InProgress` \| `Done` |
| | `priority` (opsional) — `Low` \| `Medium` \| `High` |
| Response 200 | Envelope dengan `data: Task[]` + `pagination` |
| Response 400 | Query param tidak valid |

**Contoh URL**:
```
GET http://localhost:7071/api/GetTasks?organizationId=123e4567-e89b-12d3-a456-426614174000&page=1&per_page=5&status=Todo&priority=High&search=proposal
```

**Response 200**:
```json
{
  "result": "Success",
  "code": 200,
  "message": "Berhasil mengambil data task",
  "data": {
    "data": [
      {
        "id": "uuid-task-1",
        "organizationId": "123e4567-e89b-12d3-a456-426614174000",
        "title": "Tugas pertama",
        "status": "todo",
        "priority": "high",
        "tags": []
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 5,
      "total_items": 1,
      "total_pages": 1
    }
  }
}
```

**Catatan**:
- `search` mencari di `title`, `description`, dan `assignee` (case-insensitive).
- Filter `status` & `priority` menggunakan input **PascalCase** (`Todo`, `InProgress`, `Done` / `Low`, `Medium`, `High`), bukan nilai DB.
- Nilai `all` (atau kosong) di `status` / `priority` = tanpa filter.

**cURL**:
```bash
curl "http://localhost:7071/api/GetTasks?organizationId=123e4567-e89b-12d3-a456-426614174000&page=1&per_page=10"
```

---

### 3. 🔍 GetTask — Ambil Satu Task by ID

| Item | Keterangan |
|------|-----------|
| Method | `GET` |
| Route | `/api/GetTask` |
| Query Params | `id` (wajib) + `organizationId` (wajib) |
| Response 200 | Object Task |
| Response 404 | `{ "error": "Task not found" }` |

**Contoh URL**:
```
GET http://localhost:7071/api/GetTask?organizationId=123e4567-e89b-12d3-a456-426614174000&id=<TASK_ID>
```

**cURL**:
```bash
curl "http://localhost:7071/api/GetTask?organizationId=123e4567-e89b-12d3-a456-426614174000&id=YOUR_TASK_UUID"
```

---

### 4. ✏️ UpdateTask — Update (Partial) Task

| Item | Keterangan |
|------|-----------|
| Method | `POST` |
| Route | `/api/UpdateTask` |
| Query Params | `id` (wajib) + `organizationId` (wajib) |
| Body | JSON field yang di-update SAJA (partial) |
| Response 200 | Task TERBARU setelah update |
| Response 404 | Task tidak ditemukan |
| Response 400 | Tidak ada field valid untuk diupdate |

Kelebihan Cosmos **Partial Patch**: Anda hanya kirim field yang berubah, tidak perlu kirim keseluruhan object.

**Contoh — hanya ubah status + title**:

```
POST http://localhost:7071/api/UpdateTask?organizationId=123e4567-e89b-12d3-a456-426614174000&id=<TASK_ID>
Content-Type: application/json

{
  "status": "completed",
  "title": "Tugas pertama (SELESAI)"
}
```

**Catatan**:
- `customFields` akan di-**merge** dengan nilai existing, bukan replace.
- `customFieldDefinitions` juga akan di-**merge** dengan definisi existing.
- `updatedAt` selalu diperbarui otomatis.

**cURL**:
```bash
curl -X POST "http://localhost:7071/api/UpdateTask?organizationId=123e4567-e89b-12d3-a456-426614174000&id=YOUR_TASK_UUID" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed","priority":"high"}'
```

---

### 5. 🗑️ DeleteTask — Hapus Satu Task

| Item | Keterangan |
|------|-----------|
| Method | `DELETE` |
| Route | `/api/DeleteTask` |
| Query Params | `id` (wajib) + `organizationId` (wajib) |
| Response 200 | `{ "message": "Task deleted successfully" }` |
| Response 404 | Task tidak ditemukan |

**cURL**:
```bash
curl -X DELETE "http://localhost:7071/api/DeleteTask?organizationId=123e4567-e89b-12d3-a456-426614174000&id=YOUR_TASK_UUID"
```

---

### 6. 🧹 BulkDeleteTasks — Hapus Banyak Task Sekaligus

| Item | Keterangan |
|------|-----------|
| Method | `DELETE` |
| Route | `/api/BulkDeleteTasks` |
| Query Param | `organizationId` (wajib) |
| Body | JSON **array of ID strings**, e.g. `["id1","id2","id3"]` |
| Response 200 | Semua task berhasil dihapus |
| Response 207 | Sebagian berhasil, sebagian gagal (Multi-Status) |
| Response 400 | Body bukan array / kosong / item bukan string |

**Contoh Request**:
```
DELETE http://localhost:7071/api/BulkDeleteTasks?organizationId=123e4567-e89b-12d3-a456-426614174000
Content-Type: application/json

["uuid-1", "uuid-2", "uuid-tidak-ada"]
```

**Response 207 Multi-Status** — satu item gagal (not found):
```json
{
  "message": "Successfully deleted 2 of 3 tasks",
  "deletedCount": 2,
  "failedCount": 1,
  "details": [
    { "id": "uuid-1",        "success": true },
    { "id": "uuid-2",        "success": true },
    { "id": "uuid-tidak-ada","success": false, "error": "Not found" }
  ]
}
```

**cURL**:
```bash
curl -X DELETE "http://localhost:7071/api/BulkDeleteTasks?organizationId=123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '["UUID1","UUID2","UUID3"]'
```

---

### 7. ⚙️ GetFormSettings — Ambil Konfigurasi Form Global

Mengambil konfigurasi form Task untuk satu organisasi. Jika belum ada config custom, mengembalikan **DEFAULT_FORM_FIELDS**.

| Item | Keterangan |
|------|-----------|
| Method | `GET` |
| Route | `/api/GetFormSettings` |
| Query Param | `organizationId` (wajib) |
| Response 200 | Envelope `{ result, code, message, data }` |

**Contoh URL**:
```
GET http://localhost:7071/api/GetFormSettings?organizationId=123e4567-e89b-12d3-a456-426614174000
```

**Response 200**:
```json
{
  "result": "Success",
  "code": 200,
  "message": "Berhasil mengambil konfigurasi form",
  "data": {
    "organizationId": "123e4567-e89b-12d3-a456-426614174000",
    "fields": [
      {
        "id": "title",
        "name": "title",
        "label": "Title",
        "type": "text",
        "required": true,
        "enabled": true,
        "isDefault": true,
        "colSpan": 2,
        "order": 1
      }
    ],
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**cURL**:
```bash
curl "http://localhost:7071/api/GetFormSettings?organizationId=123e4567-e89b-12d3-a456-426614174000"
```

---

### 8. 💾 SaveFormSettings — Simpan / Update Konfigurasi Form Global

Menyimpan konfigurasi form Task per organisasi via **UPSERT** (create jika belum ada, replace jika sudah ada).

| Item | Keterangan |
|------|-----------|
| Method | `POST` |
| Route | `/api/SaveFormSettings` |
| Body | `{ organizationId, fields: FormFieldConfig[], updatedAt? }` |
| Response 200 | Config diperbarui |
| Response 201 | Config baru dibuat |
| Response 400 | Validation error |

**Request Body**:
```json
{
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "fields": [
    {
      "name": "title",
      "label": "Title",
      "type": "text",
      "required": true,
      "colSpan": 2
    },
    {
      "name": "client_name",
      "label": "Nama Klien",
      "type": "text",
      "required": false
    }
  ]
}
```

**Response 200 / 201**:
```json
{
  "result": "Success",
  "code": 200,
  "message": "Berhasil memperbarui konfigurasi form",
  "data": {
    "id": "form_settings",
    "organizationId": "123e4567-e89b-12d3-a456-426614174000",
    "fields": [ "..." ],
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**cURL**:
```bash
curl -X POST "http://localhost:7071/api/SaveFormSettings" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"123e4567-e89b-12d3-a456-426614174000","fields":[{"name":"title","label":"Title","type":"text","required":true}]}'
```

---

### 9. 🧩 GetTaskFormSettings — Ambil Konfigurasi Form Spesifik Task

Menggabungkan **form settings global** + **customFieldDefinitions milik task** + **recover key legacy** dari `task.customFields` yang belum terdefinisi.

| Item | Keterangan |
|------|-----------|
| Method | `GET` |
| Route | `/api/GetTaskFormSettings` |
| Query Params | `id` (wajib) + `organizationId` (wajib) |
| Response 200 | Envelope `{ result, code, message, data }` |
| Response 404 | Task tidak ditemukan |

**Contoh URL**:
```
GET http://localhost:7071/api/GetTaskFormSettings?organizationId=123e4567-e89b-12d3-a456-426614174000&id=<TASK_ID>
```

**Response 200**:
```json
{
  "result": "Success",
  "code": 200,
  "message": "Berhasil mengambil konfigurasi form untuk task",
  "data": {
    "organizationId": "123e4567-e89b-12d3-a456-426614174000",
    "taskId": "uuid-task-1",
    "fields": [ "..." ],
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**cURL**:
```bash
curl "http://localhost:7071/api/GetTaskFormSettings?organizationId=123e4567-e89b-12d3-a456-426614174000&id=YOUR_TASK_UUID"
```

---

## 🧪 Format Error Response

**SEMUA** error (validasi, not found, bad request, internal) mengembalikan format **konsisten**:

```json
{
  "error": "<pesan error jelas>"
}
```

Contoh status code mapping:
- `400` — Validasi gagal / parameter kurang / body tidak valid JSON
- `404` — Task tidak ditemukan
- `500` — Kesalahan server (mis. connection string Cosmos salah)

---

## 🧱 Struktur Data Task

| Field | Type | Wajib | Keterangan |
|-------|------|-------|-----------|
| `id` | string (UUID) | auto | Jika tidak diisi → auto generate |
| `organizationId` | string (UUID) | ✅ | Partition key; unik per organisasi |
| `title` | string (≤100 chars) | ✅ | Judul Task |
| `description` | string (≤1000 chars) | ❌ | Detail penjelasan Task |
| `dueDate` | string (ISO 8601) | ❌ | Deadline, contoh `"2026-12-31T23:59:59Z"` |
| `priority` | `low` \| `medium` \| `high` | ❌ | Prioritas |
| `status` | `todo` \| `in-progress` \| `completed` | auto | Default: `todo` |
| `tags` | string[] (each ≤50 char) | ❌ | Default: `[]` |
| `customFields` | Record<string, any> | ❌ | Key-value custom field, max 50 key |
| `customFieldDefinitions` | TaskCustomFieldDefinition[] | auto | Snapshot definisi custom field |
| `createdAt` | string (ISO 8601) | auto | Diisi otomatis saat create |
| `updatedAt` | string (ISO 8601) | auto | Diperbarui otomatis saat update |

Definisi formal ada di file `task.schema.json` (JSON Schema Draft 7).

---

## 🧱 Struktur Data FormFieldConfig

| Field | Type | Wajib | Keterangan |
|-------|------|-------|-----------|
| `name` | string (≤50 char) | ✅ | Key unik field |
| `label` | string | ✅ | Label tampil di UI |
| `type` | `text` \| `textarea` \| `number` \| `date` \| `select` \| `multiselect` \| `checkbox` \| `radio` \| `tags` | ✅ | Tipe field |
| `required` | boolean | ✅ | Apakah wajib diisi |
| `placeholder` | string | ❌ | Placeholder input |
| `options` | `{ label, value }[]` | ❌ | Untuk type select/radio/multiselect |
| `defaultValue` | any | ❌ | Nilai default |
| `enabled` | boolean | auto | Default `true` |
| `order` | number | auto | Urutan tampil |
| `id` | string | auto | Fallback ke `name` |
| `isDefault` | boolean | auto | Apakah termasuk field default |
| `colSpan` | `1` \| `2` | auto | Lebar kolom di grid |

---

## 🔧 Perintah NPM yang Tersedia

| Perintah | Fungsi |
|----------|--------|
| `npm install` | Install semua dependency |
| `npm run build` | Compile TypeScript → `dist/` folder |
| `npm run watch` | Compile otomatis saat ada perubahan file |
| `npm run clean` | Hapus folder `dist/` |
| `npm start` | Clean + Build + Jalankan Functions (func start) |
| `npm test` | (placeholder) Test suite |
| `npx tsc --noEmit` | Type-check tanpa generate file output |

---

## 🚀 Deploy ke Azure

1. Buat **Function App** baru di Azure Portal (Runtime: Node.js 18/20 LTS, OS: Windows/Linux)
2. Buat **Azure Cosmos DB** account, lalu set connection string di Function App Configuration → **Application Settings** dengan key:
   - `CosmosDBConnectionString`
   - (opsional) `CosmosDBDatabaseId`
   - (opsional) `CosmosDBContainerId`
3. Deploy dari local:
   ```bash
   func azure functionapp publish <NAMA_FUNCTION_APP_ANDA>
   ```

---

## 📚 Referensi

- [Azure Functions TypeScript Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cconverta%2Cazure-powershell)
- [Azure Cosmos DB Node.js SDK (@azure/cosmos)](https://learn.microsoft.com/en-us/javascript/api/@azure/cosmos/)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)