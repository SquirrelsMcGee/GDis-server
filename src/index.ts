import { ApiManager } from './api';
import { ClientManager } from './discord-client/client-manager';

console.log('\x1b[32m Server Starting... \x1b[0m');

const clientManager = new ClientManager();
const apiManager = new ApiManager(4090, clientManager);
//apiManager.listen();
//const testSearch = new BraveSearch();
//
//testSearch.search("california").pipe(first()).subscribe(results => {
//  console.log(results.map(r => r.description));
//});
