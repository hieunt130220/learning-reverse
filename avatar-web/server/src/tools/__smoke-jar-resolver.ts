import { resolveJarGameServer } from '../game/jarServerExtractor.js';
const ep = await resolveJarGameServer();
console.log(JSON.stringify(ep, null, 2));
