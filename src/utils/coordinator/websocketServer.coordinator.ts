import { PUBLIC_HOSTNAME } from "@/config";
import { Channel, coordinator, CoordinatorPaths, CreateMode, ToBuffer, Ids, InitializeService } from "@/utils/coordinator/coordinator";

export default class WebsocketServerCoordinator {
    TOTAL_STAT = { channelId: 'TOTAL_STAT', connections: 0, queuedConnections: 0 } as Channel;
    Cache = new Map<string, Channel>(
        [
            ['TOTAL_STAT', this.TOTAL_STAT]
        ]
    );

    /** 코디네이터 초기화 메소드.
     *  - 서비스 노드, 채널 노드 생성 
     *  - 현재 public host 기반 서비스 임시 노드, 커넥션 정보 관련 임시 노드 생성
     */
    public static async initAsync() {
        InitializeService(async () => {
            const promises = [
                coordinator.shell.mkdirp(`${CoordinatorPaths.SERVER_PATH}`),
                coordinator.shell.mkdirp(`${CoordinatorPaths.CHANNEL_PATH}`),
                coordinator.create(`${CoordinatorPaths.AVAILABLE_SERVERS(PUBLIC_HOSTNAME)}`, undefined, undefined, CreateMode.EPHEMERAL),
                coordinator.create(`${CoordinatorPaths.CURRENT_TOTAL_CONNECTIONS(PUBLIC_HOSTNAME)}`, undefined, undefined, CreateMode.EPHEMERAL),
                coordinator.create(`${CoordinatorPaths.CURRENT_TOTAL_QUEUED_CONNECTIONS(PUBLIC_HOSTNAME)}`, undefined, undefined, CreateMode.EPHEMERAL),
            ]

            await Promise.all(promises);
        })

    }
    /** 코디네이터 서비스가 적절히 초기화되어있는 지 확인하는 메소드 */
    public async isInitAsync() {
        const got = await Promise.all([
            coordinator.exists(CoordinatorPaths.SERVER_PATH)
            , coordinator.exists(CoordinatorPaths.CHANNEL_PATH)
            , coordinator.exists(CoordinatorPaths.CURRENT_TOTAL_CONNECTIONS(PUBLIC_HOSTNAME))
            , coordinator.exists(CoordinatorPaths.CURRENT_TOTAL_QUEUED_CONNECTIONS(PUBLIC_HOSTNAME))
        ]);
        let ret = true;
        for (let e of got) {
            ret &&= (e != undefined);
        }
        return ret

    }

    public async createChannelAsync(channelId: string) {
        const got = await coordinator.transaction()
            .create(CoordinatorPaths.AVAILABLE_CHANNELS(channelId), ToBuffer(PUBLIC_HOSTNAME), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId), ToBuffer(0), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
            .create(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId), ToBuffer(0), Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL)
            .commit();

        this.checkTx(got, () => {
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

    public async getChannelAsync(channelId: string) {
        const channelHostAsync = coordinator.getData(CoordinatorPaths.AVAILABLE_CHANNELS(channelId));
        const connectionAsync = coordinator.getData(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId));
        const queuedAsync = coordinator.getData(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId));
        const got = await Promise.all([channelHostAsync, connectionAsync, queuedAsync]);

        return {
            channelId,
            channelHost: got[0].data.toString(),
            connections: parseInt(got[1].data.toString(), 10),
            queuedConnections: parseInt(got[2].data.toString(), 10)
        } as Channel
    }

    public async updateConnectionDeltaAsync(channelId: string, delta: number) {
        const channel = this.Cache.get(channelId);
        if (!channel) throw new Error('invalid channel id');
        const nextValue = channel.connections + delta;
        const nextTotalValue = this.TOTAL_STAT.connections + delta;

        const got = await coordinator.transaction()
            .setData(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId), ToBuffer(nextValue))
            .setData(CoordinatorPaths.CURRENT_TOTAL_CONNECTIONS(PUBLIC_HOSTNAME), ToBuffer(nextTotalValue))
            .commit();

        this.checkTx(got, () => {
            channel.connections = nextValue;
            this.TOTAL_STAT.connections = nextTotalValue;
        })

        return channel;
    }

    public async updateQueuedConnectionDeltaAsync(channelId: string, delta: number) {
        const channel = this.Cache.get(channelId);
        if (!channel) throw new Error('invalid channel id');
        const nextValue = channel.queuedConnections + delta;
        const nextTotalValue = this.TOTAL_STAT.queuedConnections + delta;

        const got = await coordinator.transaction()
            .setData(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId), ToBuffer(nextValue))
            .setData(CoordinatorPaths.CURRENT_TOTAL_QUEUED_CONNECTIONS(PUBLIC_HOSTNAME), ToBuffer(nextTotalValue))
            .commit();

        this.checkTx(got, () => {
            channel.queuedConnections = nextValue;
            this.TOTAL_STAT.queuedConnections = nextTotalValue;
        })

        return channel;
    }

    /** 트랜잭션 실행 결과에서 에러가 있는 지 확인하고, 없으면 콜백을 실행하는 메소드. */
    checkTx(got: {
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