import type { Database } from "bun:sqlite";

export const getFileExtension = (fileName: string) => {
	return fileName.split(".").pop();
};

export const checkIfFileExists = async (filePath: string) => {
	const file = Bun.file(filePath);
	const exists = await file.exists();
	return exists;
};

export const prepareDatabase = (database: Database) => {
	const query = database.query(`CREATE TABLE IF NOT EXISTS uploads (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  path text NOT NULL,
	  user_id text NOT NULL,
	  key text NOT NULL
	);`)
	const result = query.run();
  }