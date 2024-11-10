import { ApiManager } from './api';
import { ClientManager } from './client';

const clientManager = new ClientManager();
const apiManager = new ApiManager(4090, clientManager);
//apiManager.listen();