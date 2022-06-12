import { PUBLIC_HOSTNAME } from "@/config";
import { Channel, coordinator, CoordinatorPaths, CreateMode, ToBuffer, Ids } from "@/utils/coordinator";
import { promisify } from "util";

export default class ChannelService {
    coordinator = coordinator
    TOTAL_STAT = { channelId: 'TOTAL_STAT', connections: 0, queuedConnections: 0 }
    Cache = new Map<string, Channel>(
        [
            [
                'TOTAL_STAT',
                this.TOTAL_STAT
            ]
        ]
    );

    public isInitAsync() {
        const got = Promise.all([coordinator.exists(CoordinatorPaths.SERVER_PATH), coordinator.exists(CoordinatorPaths.CHANNEL_PATH)]);
        return got

    }

    public async CreateChannelAsync(channelId: string) {

        const got = await coordinator.transaction()
            .create(CoordinatorPaths.AVAILABLE_CHANNELS(channelId), ToBuffer(PUBLIC_HOSTNAME), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId), ToBuffer(0), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId), ToBuffer(0), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
            .commit();

        this.CheckTx(got, () => {
            if (this.Cache.has(channelId)) {
                this.Cache.delete(channelId);
            }
            this.Cache.set(channelId, {
                channelId,
                connections: 0,
                queuedConnections: 0
            });
        })
        return 'OK'
    };

    public async GetChannelAsync(channelId: string) {
        const channelHostAsync = coordinator.getData(CoordinatorPaths.AVAILABLE_CHANNELS(channelId));
        const connectionAsync = coordinator.getData(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId));
        const queuedAsync = coordinator.getData(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId));
        const got = await Promise.all([channelHostAsync, connectionAsync, queuedAsync]);

        return {
            channelHost: got[0].data.toString(),
            connections: parseInt(got[1].data.toString(), 10),
            queuedConnections: parseInt(got[2].data.toString(), 10)
        };
    }

    public async UpdateConnectionDeltaAsync(channelId: string, delta: number) {
        const channel = this.Cache.get(channelId);
        if (!channel) throw new Error('invalid channel id');
        const nextValue = channel.connections + delta;
        const nextTotalValue = this.TOTAL_STAT.connections + delta;

        const got = await coordinator.transaction()
            .setData(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId), ToBuffer(nextValue))
            .setData(CoordinatorPaths.CURRENT_TOTAL_CONNECTIONS(PUBLIC_HOSTNAME), ToBuffer(nextTotalValue))
            .commit();

        this.CheckTx(got, () => {
            channel.connections = nextValue;
            this.TOTAL_STAT.connections = nextTotalValue;
        })

        return channel;
    }

    public async UpdateQueuedConnectionDeltaAsync(channelId: string, delta: number) {
        const channel = this.Cache.get(channelId);
        if (!channel) throw new Error('invalid channel id');
        const nextValue = channel.queuedConnections + delta;
        const nextTotalValue = this.TOTAL_STAT.queuedConnections + delta;

        const got = await coordinator.transaction()
            .setData(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId), ToBuffer(nextValue))
            .setData(CoordinatorPaths.CURRENT_TOTAL_QUEUED_CONNECTIONS(PUBLIC_HOSTNAME), ToBuffer(nextTotalValue))
            .commit();

        this.CheckTx(got, () => {
            channel.queuedConnections = nextValue;
            this.TOTAL_STAT.queuedConnections = nextTotalValue;
        })

        return channel;
    }


    CheckTx(got: {
        header: {
            type: number
            done: boolean
            err: number
        }
        payload: any
    }[], callback: any) {
        let errors = false;
        for (var e of got) {
            errors ||= (e.header.err != 0)
        }
        if (errors) {
            throw new Error(errors.toString())
        } else {
            callback();
        }
    }
}