/**
 * Functions Registry - Barrel File
 * ---------------------------------
 * Import semua file HTTP trigger agar app.http() terdaftar ke runtime.
 *
 * Cara tambah endpoint baru:
 *   1. Buat file baru di folder ini (e.g. ArchiveTask.ts)
 *   2. Tambahkan import "./ArchiveTask" di bawah ini
 */

import "./InsertTask";
import "./GetTasks";
import "./GetTask";
import "./UpdateTask";
import "./DeleteTask";
import "./BulkDeleteTasks";
import "./GetFormSettings";
import "./SaveFormSettings";
import "./GetTaskFormSettings";