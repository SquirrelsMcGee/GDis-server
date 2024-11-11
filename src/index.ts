import { ApiManager } from './api';
import { ClientManager } from './client';

const clientManager = new ClientManager();
const apiManager = new ApiManager(4090, clientManager);
//apiManager.listen();
//const testSearch = new BraveSearch();
//
//testSearch.search("california").pipe(first()).subscribe(results => {
//  console.log(results.map(r => r.description));
//});

console.log('hi hows it going');