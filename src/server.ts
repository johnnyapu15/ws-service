import HttpApp from '@/http.app';
import AuthRoute from '@routes/auth.route';
import IndexRoute from '@routes/index.route';
import UsersRoute from '@routes/users.route';
import validateEnv from '@utils/validateEnv';
import { Server } from 'http';
import { ServiceRoute } from './routes/service.websocket.route';
import { deleteServiceAsync, initializeServiceAsync } from './utils/coordinator/websocketServer.coordinator';
import { logger } from './utils/logger';
import { socketIO } from './utils/socket.io';
import { WebsocketApp } from './websocket.app';

validateEnv();
let serverInitiated = false;
let httpServer: Server;
(async () => {

    await initializeServiceAsync();
    logger.info('coordinator initialized!');

    const httpApp = new HttpApp([new IndexRoute(), new UsersRoute(), new AuthRoute()]);
    httpServer = httpApp.http;

    socketIO().attach(httpServer);
    const websocketApp = new WebsocketApp([new ServiceRoute()]);

    httpApp.listen();

    process.on('SIGINT', async () => {
        await deleteServiceAsync();
        process.exit(0);
    });

    serverInitiated = true;
})();

const closeAsync = async () => {
    await new Promise(r =>  httpServer.close(r));
}

export { serverInitiated, closeAsync }