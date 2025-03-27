import path from "path";
import { ClientManager } from "./discord-client/client-manager";

console.log('\x1b[32m Server Starting... \x1b[0m');

export const DIR_NAME = __dirname;
export const TTS_FILEPATH = path.join(DIR_NAME, 'tts_sample.wav');

const clientManager = new ClientManager();
// const apiManager = new ApiManager(4090, clientManager);
//apiManager.listen();