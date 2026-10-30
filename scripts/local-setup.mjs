import { spawnSync } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { localEnvironment } from "./local-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = new URL("../.env.local", import.meta.url);
try {
  await access(target);
  console.error(
    ".env.local sudah ada. Setup dihentikan agar konfigurasi tidak tertimpa. Ikuti docs/local-development.md untuk konfigurasi manual.",
  );
  process.exit(1);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const docker = spawnSync(
  "docker",
  ["version", "--format", "{{.Server.Version}}"],
  { encoding: "utf8", timeout: 15000 },
);
if (docker.error || docker.status !== 0) {
  console.error(
    "Docker belum tersedia/aktif. Pasang dan jalankan Docker Desktop dengan Linux containers, lalu ulangi npm run local:setup. Tidak ada konfigurasi aplikasi yang diubah.",
  );
  process.exit(1);
}
const cli = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);
function supabase(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Supabase ${args[0]} gagal. Jalankan npx supabase ${args.join(" ")} secara lokal untuk diagnosis; output kredensial tidak ditampilkan oleh helper.`,
    );
  return result.stdout;
}
try {
  console.log(
    "Memulai Supabase lokal dan menerapkan migrasi yang belum dijalankan…",
  );
  supabase(["start"]);
  supabase(["migration", "up", "--local"]);
  const status = JSON.parse(supabase(["status", "-o", "json"]));
  await writeFile(
    target,
    localEnvironment(status, randomBytes(18).toString("base64url")),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Konfigurasi lokal tersimpan di .env.local (diabaikan Git). Lanjutkan npm run local:seed, lalu npm run dev. Studio: http://127.0.0.1:54323 · Email uji: http://127.0.0.1:54324",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
