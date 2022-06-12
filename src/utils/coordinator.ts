import { COORDINATOR_CONNECTION, PUBLIC_HOSTNAME } from '@/config';
import { promisify } from 'util';
import { logger } from './logger';
import { createClient, CreateMode, Ids } from 'zk-client';
const PREFIX = '/Coordinator/';

export const CoordinatorPaths = {

    /** server config */
    SERVER_PATH: `${PREFIX}AvailableServers`,
    AVAILABLE_SERVERS: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}`,
    CURRENT_TOTAL_CONNECTIONS: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}.CurrentTotalConnections`,
    CURRENT_TOTAL_QUEUED_CONNECTIONS: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}.CurrentTotalQueuedConnections`,

    /** channel config */
    CHANNEL_PATH: `${PREFIX}Channels`,
    AVAILABLE_CHANNELS: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}`,
    CURRENT_CHANNEL_CONNECTIONS: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}.CurrentConnections`,
    CURRENT_CHANNEL_QUEUED_CONNECTIONS: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}.CurrentQueuedConnections`,
}

const coordinator = createClient(
    COORDINATOR_CONNECTION,
);

let initiated = false;

const InitializeServiceAsync = async (callback) => {

    await coordinator.connect();
    await callback();

    initiated = true;

};

interface Service {
    host: string,
    connections: number,
    queuedConnections: number,
}
const ServiceCoordinator = {
    Cache: new Map<string, Service>(),

    CreateServiceAsync: async () => {
        return coordinator.transaction()
            .create(CoordinatorPaths.AVAILABLE_SERVERS(PUBLIC_HOSTNAME), undefined, undefined, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_TOTAL_CONNECTIONS(PUBLIC_HOSTNAME), ToBuffer(0), undefined, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_TOTAL_QUEUED_CONNECTIONS(PUBLIC_HOSTNAME), ToBuffer(0), undefined, CreateMode.EPHEMERAL)
            .commit();
    },

    GetAllServicesAsync: async () => {
        return coordinator.getChildren(CoordinatorPaths.SERVER_PATH);
    },

    // WatchService: (serviceHost: string) => {
    //     Watch(
    //         CoordinatorPaths.AVAILABLE_SERVERS(serviceHost),
    //         (err, data) => {
    //             if (err) {
    //                 logger.error(err)
    //             }
    //             const got = ServiceCoordinator.Cache.get(serviceHost);
    //             if (!got) {
    //                 ServiceCoordinator.Cache.set(serviceHost, { host: serviceHost, connections: 0, queuedConnections: 0 });
    //             }
    //         }
    //         , null, null, null,
    //         // onDelete
    //         (path) => {
    //             ServiceCoordinator.Cache.delete(serviceHost);
    //         }, true
    //     );
    //     // connection
    // },

    WatchServices: () => {

    }
}


interface Channel {
    channelId: string;
    connections: number;
    queuedConnections: number;
}

const ChannelCoordinator = {
    /** 'total' -> {channelId: 'total', connections: TOTAL CONNECTIONS, queuedConntections: TOTAL QUEUED CONNECTIONS } */
    Cache: new Map<string, Channel>(),

    CreateChannelAsync: async (channelId: string) => {

        return coordinator.transaction()
            .create(CoordinatorPaths.AVAILABLE_CHANNELS(channelId), ToBuffer(PUBLIC_HOSTNAME), undefined, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId), ToBuffer('0'), undefined, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId), ToBuffer('0'), undefined, CreateMode.EPHEMERAL)
            .commit()
    },







    RemoveChannelAsync: async (channelId: string) => {

return            coordinator.transaction()
                .remove(CoordinatorPaths.AVAILABLE_CHANNELS(channelId))
                .remove(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId))
                .remove(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId))
                .commit();

    },

}

function ToBuffer(value: any): Buffer {
    if (typeof(value) === 'string') return Buffer.from(value);
    else if (typeof(value) === 'number') return Buffer.from(value.toString(10));
    else return Buffer.from('DEFAULT');
}


export { coordinator, InitializeServiceAsync as InitializeService, Service, Channel, ToBuffer, Ids, CreateMode, initiated };