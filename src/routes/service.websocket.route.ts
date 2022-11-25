
import { socketIO } from "@/utils/socket.io";
import { Namespace, Server } from "socket.io";
import { Server as HttpServer } from 'http'
import { WebsocketRoutes } from "@/interfaces/routes.interface";
import { SyncService } from "@/services/sync.service";
import { logger } from "@/utils/logger";
import { createChannelAsync, isExistChannelAsync, updateConnectionDeltaAsync } from "@/utils/coordinator/websocketServer.coordinator";
import { ChannelError, ChannelErrorCode } from "@/exceptions/ChannelError";
import { coordinateChannelMiddleware } from "@/middlewares/channel.socketio.middleware";

class ServiceRoute implements WebsocketRoutes {
    path?: string;
    io: Server;
    nsp: Namespace;
    service = new SyncService();

    initialize = () => {
        this.io = socketIO();
        const nspName = /^\/channel-\w+$/;
        const nspToChannelId = (nsp: string) => nsp.substring(nsp.indexOf('-') + 1);
        this.nsp = this.io.of(nspName);

        this.nsp.use(coordinateChannelMiddleware(nspToChannelId));
        this.nsp.on('connection', async socket => {

            /** 초기화 */
            logger.info(`new connection! ${socket.id}`);

            const channelId = nspToChannelId(socket.nsp.name);

            socket.on('disconnect', (reason) => {
                logger.info(`disconntected! ${socket.id}`);
            })

            ///

            /** 서비스 route */
            
            ///
        });
        logger.info(`socket service ${this.path} initialized.`);
    }
}

export { ServiceRoute }