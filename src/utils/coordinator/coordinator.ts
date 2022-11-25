import { COORDINATOR_CONNECTION, PUBLIC_HOSTNAME } from '@/config';
import { promisify } from 'util';
import { logger } from '../logger';
import { Client, createClient, CreateMode, Ids } from 'zk-client';
const PREFIX = '/Coordinator/';

export const CoordinatorPaths = {

    /** server config */
    SERVER_PATH: `${PREFIX}Servers`,
    AVAILABLE_SERVERS: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}`,
    CURRENT_TOTAL_CONNECTIONS: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}.CurrentTotalConnections`,
    CURRENT_SERVICE_GRADE: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}.CurrentServiceGrade`,
    CURRENT_TOTAL_QUEUED_CONNECTIONS: (publicHost: string) => `${CoordinatorPaths.SERVER_PATH}/${publicHost}.CurrentTotalQueuedConnections`,

    /** channel config */
    CHANNEL_PATH: `${PREFIX}Channels`,
    AVAILABLE_CHANNELS: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}`,
    CURRENT_CHANNEL_CONNECTIONS: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}.CurrentConnections`,
    CURRENT_CHANNEL_GRADE: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}.CurrentConnectionGrade`,
    CURRENT_CHANNEL_QUEUED_CONNECTIONS: (channelId: string) => `${CoordinatorPaths.CHANNEL_PATH}/${channelId}.CurrentQueuedConnections`,
}

let coordinator: Client;

try {
    coordinator = createClient(
        COORDINATOR_CONNECTION,
    );
} catch (e) {
    console.error(e);
    throw e;
}

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

interface IChannelPaths {
    channelPath: string;
    connectionPath: string;
    gradePath: string;
    queuedConnectionPath: string;
}

interface IChannelStat {
    channelId: string;
    channelHost?: string;
    connections: number;
    connectionGrade: string;
    queuedConnections: number;
    isTotalStat: boolean;
    initiated?: boolean;
    paths?: IChannelPaths;
}

const evalConnectionGrade = (value: number) => {
    return (Math.ceil(value / 10) * 10).toString(10) + '>';
}

/** 
 * total stat: service info
 * non total stat: channel info
 *  */
class ChannelStat implements IChannelStat {
    channelId: string;
    channelHost?: string;
    connections: number = 0;
    connectionGrade: string = '10>';
    queuedConnections: number = 0;
    isTotalStat: boolean;
    initiated = false;
    paths: IChannelPaths;

    constructor(channelId: string, channelHost?: string, isTotalStat = false) {
        this.channelId = channelId;
        this.channelHost = channelHost;
        this.isTotalStat = isTotalStat;

        if (isTotalStat) {
            this.paths = {
                channelPath: CoordinatorPaths.AVAILABLE_SERVERS(channelHost),
                connectionPath: CoordinatorPaths.CURRENT_TOTAL_CONNECTIONS(channelHost),
                gradePath: CoordinatorPaths.CURRENT_SERVICE_GRADE(channelHost),
                queuedConnectionPath: CoordinatorPaths.CURRENT_TOTAL_QUEUED_CONNECTIONS(channelHost)
            }
        } else {
            this.paths = {
                channelPath: CoordinatorPaths.AVAILABLE_CHANNELS(channelId),
                connectionPath: CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId),
                gradePath: CoordinatorPaths.CURRENT_CHANNEL_GRADE(channelId),
                queuedConnectionPath: CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId)
            }
        }
    }

    public async initiateAsync() {
        await createChannelAsync(this.paths);
        this.initiated = true;
    }

    public async isInitiatedAsync() {
        let result = true;
        const got = await checkChannelAsync(this.paths);
        for (const existsResult of got) {
            result &&= existsResult !== null;
        }
        return result;
    }

    /** return true when update grade. */
    public async updateConnectionAsync(delta: number) {
        if (!initiated) return false;

        this.connections += delta;

        /** check deletion */
        if (this.connections === 0) {
            /** delete this. */
            await deleteChannelAsync(this.paths);
            initiated = false;
            return false;
        }
        const tmp = evalConnectionGrade(this.connections);
        if (tmp !== this.connectionGrade) {
            /** update coordinator */
            await updateChannelGradeAsync(this.paths, tmp);

            this.connectionGrade = tmp;
            return true;
        }
        return false;
    }

    public async deleteChannelAsync() {
        return deleteChannelAsync(this.paths);
    }
}

/** Channel CRUD on coordinator */
const checkChannelAsync = async (paths: IChannelPaths) => {
    const { channelPath, connectionPath, gradePath, queuedConnectionPath } = paths;
    return Promise.all([
        coordinator.exists(channelPath),
        coordinator.exists(connectionPath),
        coordinator.exists(gradePath),
        coordinator.exists(queuedConnectionPath)
    ]);
}

const createChannelAsync = async (paths: IChannelPaths) => {
    const { channelPath, connectionPath, gradePath, queuedConnectionPath } = paths;
    return coordinator.transaction()
        .create(channelPath, ToBuffer(PUBLIC_HOSTNAME), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
        .create(connectionPath, ToBuffer(0), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
        .create(gradePath, '0<=', Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
        .create(queuedConnectionPath, ToBuffer(0), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
        .commit();
};

const updateChannelGradeAsync = async (paths: IChannelPaths, grade: string) => {
    return coordinator.setData(paths.gradePath, ToBuffer(grade));
}

const deleteChannelAsync = async (paths: IChannelPaths) => {
    const { channelPath, connectionPath, gradePath, queuedConnectionPath } = paths;

    return coordinator.transaction()
        .remove(channelPath)
        .remove(connectionPath)
        .remove(gradePath)
        .remove(queuedConnectionPath)
        .commit();
}

///

/** Channel total stat CRUD on coordinator  */
// 토탈 스탯 생성, 수정하는 기능을 구현하고,
// 매 커넥션 업데이트마다 코디네이터를 거치지 않도록 수정하자.

///


const ChannelCoordinator = {
    /** 'total' -> {channelId: 'total', connections: TOTAL CONNECTIONS, queuedConntections: TOTAL QUEUED CONNECTIONS } */
    Cache: new Map<string, ChannelStat>(),

    CreateChannelAsync: async (channelId: string) => {

        return coordinator.transaction()
            .create(CoordinatorPaths.AVAILABLE_CHANNELS(channelId), ToBuffer(PUBLIC_HOSTNAME), undefined, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId), ToBuffer('0'), undefined, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId), ToBuffer('0'), undefined, CreateMode.EPHEMERAL)
            .commit()
    },







    RemoveChannelAsync: async (channelId: string) => {

        return coordinator.transaction()
            .remove(CoordinatorPaths.AVAILABLE_CHANNELS(channelId))
            .remove(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId))
            .remove(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId))
            .commit();

    },

}

function ToBuffer(value: any): Buffer {
    if (typeof (value) === 'string') return Buffer.from(value);
    else if (typeof (value) === 'number') return Buffer.from(value.toString(10));
    else return Buffer.from('DEFAULT');
}


export { coordinator, InitializeServiceAsync as InitializeService, Service, ChannelStat, ToBuffer, Ids, CreateMode, initiated };