import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from "hono/adapter";
import { Resend } from "resend";

import { Database } from "bun:sqlite";

import { checkIfFileExists, getFileExtension, prepareDatabase } from "./lib/utils";
const TTLCache = require('@isaacs/ttlcache')

const UPLOAD_PATH = "./uploads"
const CACHE_RESET_TIME = 10000
const MAX_UPLOADS_PER_RESET_TIME = 2;

const db = new Database("mydb.sqlite", {create: true});
prepareDatabase(db);

const cache = new TTLCache({ max: 10000, ttl: CACHE_RESET_TIME })
const app = new Hono()

app.get('/', (c) => {
  const query = db.query("SELECT * FROM uploads");
  const result = query.run();
  console.log(result);
  return c.text('Hello Hono!')
})

app.use("/api/*", cors());

app.post("/api/upload", async (c) => {
  const { RESEND_API } = env<{RESEND_API: string}>(c);

  const userId = c.req.header("x-forwarded-for") ?? "user";
  const canUpload = checkIfUserCanUpload(userId);
  if(!canUpload) {
    return c.json({ success: false, message: "You have reached the upload limit." });
  }

  const userUsage = cache.get(userId) as number || 0;
  cache.set(userId, userUsage + 1);

  const body = await c.req.parseBody()
  let file = body.file;

	if (!file || !(file instanceof File)) {
		return c.json({ success: false, message: "No file found" });
	}

	const safeOldName = file.name.replaceAll(" ", "_");
	const extension = getFileExtension(safeOldName);
  const fileId = crypto.randomUUID()
	const newName = `${safeOldName}_${fileId}.${extension}`;

	file = new File([file], newName, { type: file.type });

	const exists = await checkIfFileExists(`${UPLOAD_PATH}/${newName}`);
	if (exists) {
		return c.json({ success: false, message: "File already exists" });
	}

	await Bun.write(`${UPLOAD_PATH}/${newName}`, file);

  const query = db.query("INSERT INTO uploads (path, user_id, key) VALUES ($path, $user_id, $key)");
  query.run({
    $path: `${UPLOAD_PATH}/${newName}`,
    $user_id: userId,
    $key: fileId
  })

  return c.json({ success: true })
})

const checkIfUserCanUpload = (id: string) => {
  const userUploads = cache.get(id) as number ?? 0;
  if(userUploads >= MAX_UPLOADS_PER_RESET_TIME) return false;
  return true;
}

class UploadRecord {
  id!: string;
  path!: string;
  user_id!: string;
  key!: string;
}


export default app
