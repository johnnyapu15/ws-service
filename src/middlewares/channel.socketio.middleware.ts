import { ChannelError, ChannelErrorCode } from "@/exceptions/ChannelError";
import { createChannelAsync, isExistChannelAsync, updateConnectionDeltaAsync } from "@/utils/coordinator/websocketServer.coordinator";
import { logger } from "@/utils/logger";
import { Socket } from "socket.io";
import { ExtendedError } from "socket.io/dist/namespace";
import Lock from 'async-lock';

const lock = new Lock({});

/** nspToChannelId: socketIO의 namespace를 channelId로 변경하는 로직  */
const coordinateChannelMiddleware = (nspToChannelId: (nsp: string) => string) => async (socket: Socket, next: ((err?: ExtendedError) => void)) => {
    try {
        const channelId = nspToChannelId(socket.nsp.name);

        /** 채널이 생성되었는 지 확인하고, 없으면 생성합니다. */
        await lock.acquire(channelId, async () => {
            const isExistChannel = await isExistChannelAsync(channelId);
            if (!isExistChannel) {
                /** 채널이 존재하지 않으면 생성합니다. */
                const channelCreateResult = await createChannelAsync(channelId);
                if (channelCreateResult !== 'OK') {
                    throw new ChannelError(ChannelErrorCode.COORDINATOR_ERROR, 'Coordinator error');
                }
            }
            await updateConnectionDeltaAsync(channelId, 1);
        })

        socket.on('disconnect', async (reason) => {
            /** 접속이 종료되면 채널에서 제외 */
            await lock.acquire(channelId, async () => {
                await updateConnectionDeltaAsync(channelId, -1);
            })
        })
        next();

    }
    catch (e) {
        if (e instanceof Error) {
            logger.info(e.message);
            next(e);
        }
    }
}

export { coordinateChannelMiddleware };