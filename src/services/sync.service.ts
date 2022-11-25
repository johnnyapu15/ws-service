import { SyncItem } from "@/interfaces/sync.interface";
import { randomInt } from "crypto";
import { Socket } from "socket.io"


/** db[channelId][itemId] */
const db = new Map<string, Map<string, SyncItem>>();

class SyncService {
    append = (channelId: string, items: SyncItem[]) => {
        if (!db.has(channelId)) db.set(channelId, new Map());
        const bucket = db.get(channelId);

        for (const item of items) {
            bucket.set(item._id, item);
        };
    }

    getList = (channelId: string) => {
        if (!db.has(channelId)) throw new Error('invalid channel id');
        return new Array(db.get(channelId).values());
    }

    addValue = (channelId: string, id: string, value: number) => {
        if (!db.has(channelId)) throw new Error('invalid channel id');
        const bucket = db.get(channelId);
        if (!bucket.has(id)) throw new Error('invalid item id');
        const item = bucket.get(id);
        item.value += value;
        return item;
    }

    pick = (channelId: string) => {
        if (!db.has(channelId)) throw new Error('invalid channel id');
        const bucket = db.get(channelId);

        /** random pick using value of items */

        let totalValue = 0;
        const weights: [string, number][] = [];

        for (const item of bucket.values()) {
            const { _id, value } = item;
            totalValue += value;
            weights.push([_id, totalValue]); // 이때의 total value를 accumulated value로 활용합니다.
        }

        const result = randomInt(totalValue);
        for (const weight of weights) {
            const [_id, accumulatedValue] = weight;
            if (result < accumulatedValue) {
                return bucket.get(_id);
            }
        }

        // 위 for 문에서 리턴되었어야 합니다.
        throw new Error('logic error.');
    }

}

export { SyncService }