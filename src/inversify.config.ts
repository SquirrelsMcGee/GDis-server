import { Container } from "inversify";
import { ClientManager } from "./discord-client/client-manager";
import { Logger } from "./helpers/logger";
import { TYPES } from "./types";

const iocContainer = new Container();

iocContainer.bind<ClientManager>(TYPES.ClientManager).to(ClientManager);
iocContainer.bind<Logger>(TYPES.Logger).to(Logger);

export { iocContainer };

