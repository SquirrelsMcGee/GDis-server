import "reflect-metadata";
import { iocContainer } from './inversify.config';

import path from "path";
import { ClientManager } from './discord-client/client-manager';
import { TYPES } from "./types";

console.log('\x1b[32m Server Starting... \x1b[0m');

export const DIR_NAME = __dirname;
export const TTS_FILEPATH = path.join(DIR_NAME, 'tts_sample.wav');


const clientManager = iocContainer.get<ClientManager>(TYPES.ClientManager);



// const apiManager = new ApiManager(4090, clientManager);
//apiManager.listen();