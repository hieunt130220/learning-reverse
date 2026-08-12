import crypto from 'node:crypto';

// In ra thẳng dòng để dán vào .env.
console.log(`MASTER_KEY=${crypto.randomBytes(32).toString('base64')}`);
