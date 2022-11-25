import { randomUUID } from "crypto";
import { SyncService } from "./sync.service";

describe('sync service 유닛 테스트', () => {
    const service = new SyncService();
    const testChannelId = randomUUID();
    test('없는 채널 버킷 가져오기', () => {
        //expect.
        expect(service.getList).toThrowError(new Error('invalid channel id'));
    });
    
})


