import { PUBLIC_HOSTNAME } from "@/config";
import { ChannelError, ChannelErrorCode } from "@/exceptions/ChannelError";
import { ChannelStat, coordinator, CoordinatorPaths, CreateMode, ToBuffer, Ids, InitializeService } from "@/utils/coordinator/coordinator";



const statCache = new Map<string, ChannelStat>();

const TOTAL_STAT_KEY = 'TOTAL_STAT'
const TOTAL_STAT = () => statCache.get(TOTAL_STAT_KEY);

/** 채널 서비스 초기화 메소드.
 *  - 서비스 노드, 채널 노드 생성 
 *  - 현재 public host 기반 서비스 임시 노드, 커넥션 정보 관련 임시 노드 생성
 */
const initializeServiceAsync = async () => {
    return InitializeService(async () => {
        if (await (coordinator.exists(CoordinatorPaths.AVAILABLE_SERVERS(PUBLIC_HOSTNAME)))) {
            await deleteServiceAsync();
        }

        statCache.set(TOTAL_STAT_KEY, new ChannelStat(PUBLIC_HOSTNAME, PUBLIC_HOSTNAME, true));

        const promises = [
            coordinator.shell.mkdirp(`${CoordinatorPaths.SERVER_PATH}`),
            coordinator.shell.mkdirp(`${CoordinatorPaths.CHANNEL_PATH}`),
            TOTAL_STAT().initiateAsync()
        ]

        await Promise.all(promises);
    })
}

const deleteServiceAsync = async () => {
    const promises: Promise<any>[] = []
    for (var channelStat of statCache.values()) {
        if (await channelStat.isInitiatedAsync())
            promises.push(channelStat.deleteChannelAsync());
    }
    await Promise.all(promises);
    statCache.clear();
}


/** 코디네이터 서비스가 적절히 초기화되어있는 지 확인하는 메소드 */
const isInitAsync = async () => {
    const got = await Promise.all([
        coordinator.exists(CoordinatorPaths.SERVER_PATH),
        TOTAL_STAT().isInitiatedAsync()
    ]);
    const ret =
        got[0] !== null
        &&
        got[1]
    return ret

}

const isExistChannelAsync = async (channelId: string) => {
    return await coordinator.exists(CoordinatorPaths.AVAILABLE_CHANNELS(channelId));
}

const createChannelAsync = async (channelId: string) => {
    if (statCache.has(channelId)) {
        throw new ChannelError(ChannelErrorCode.INVALID_ID);
    }
    const channelStat = new ChannelStat(channelId);
    await channelStat.initiateAsync();

    statCache.set(channelId, channelStat);
    return 'OK'
};

const getChannel = (channelId: string) => {
    return statCache.get(channelId);
}

const updateConnectionDeltaAsync = async (channelId: string, delta: number) => {
    const channel = statCache.get(channelId);
    if (!channel) throw new Error('invalid channel id');

    await Promise.all([
        channel.updateConnectionAsync(delta),
        TOTAL_STAT().updateConnectionAsync(delta)
    ]);

    /** check deletion */
    if (channel.connections === 0) {
        statCache.delete(channelId);
    }

    return channel;
}

const deleteChannelAsync = async (channelId: string) => {
    await coordinator.transaction()
        .remove(CoordinatorPaths.AVAILABLE_CHANNELS(channelId))
        .remove(CoordinatorPaths.CURRENT_CHANNEL_CONNECTIONS(channelId))
        .remove(CoordinatorPaths.CURRENT_CHANNEL_QUEUED_CONNECTIONS(channelId))
        .commit();
}

/** 트랜잭션 실행 결과에서 에러가 있는 지 확인하고, 없으면 콜백을 실행하는 메소드. */
const checkTx = (got: {
    header: {
        type: number
        done: boolean
        err: number
    }
    payload: any
}[], callback: any) => {
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

export { statCache as Cache, initializeServiceAsync, deleteServiceAsync, isInitAsync, isExistChannelAsync, createChannelAsync, getChannel, updateConnectionDeltaAsync } 