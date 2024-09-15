import { resolve, join } from 'node:path';
import { readdir, unlink } from 'node:fs/promises';

export const cleanDataFolder = async (path: string) => {
  // Clear the database
  const dataDir = resolve(process.cwd(), path);
  try {
    const files = await readdir(dataDir);
    const unlinkPromises = files.map((file) => unlink(join(dataDir, file)));
    await Promise.all(unlinkPromises);
  } catch (err) {
    // If error just skip
  }
};
