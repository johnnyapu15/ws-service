import { Server as HttpServer } from 'http'
import { WebsocketRoutes } from "./interfaces/routes.interface";
import { initializeServiceAsync } from './utils/coordinator/websocketServer.coordinator';
import { logger } from './utils/logger';
import { socketIO } from './utils/socket.io';
class WebsocketApp {
    constructor(routes: WebsocketRoutes[]) {
        this.initializeWebsocketRoutes(routes);

    }

    private async initializeWebsocketRoutes(routes: WebsocketRoutes[]) {
        routes.forEach(route => {
            route.initialize();
        })
    }


}

export { WebsocketApp };