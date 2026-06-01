import path from 'path';
import dotenv from 'dotenv';

// Load .env file from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Load .env.test file from test directory (overwrites any duplicate keys)
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true });
