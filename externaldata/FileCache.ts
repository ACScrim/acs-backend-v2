import * as fs from 'fs';
import * as path from 'path';

export class FileCache {
  private cacheDir: string;
  private expiryMs: number;

  constructor(cacheDir: string = 'cache', expiryHours: number = 24) {
    this.cacheDir = cacheDir;
    this.expiryMs = expiryHours * 60 * 60 * 1000;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const filePath = path.join(this.cacheDir, `${key}.json`);

    // Vérifier cache valide
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (Date.now() - stats.mtimeMs < this.expiryMs) {
        // console.log(`📦 Cache hit: ${key}`);
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }

    // Fetch et cache
    console.log(`🌐 Cache miss: ${key} - Fetching...`);
    const data = await fetcher();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Cached: ${key}`);
    
    return data;
  }
}