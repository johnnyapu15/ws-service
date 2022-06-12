
import app from '../app'
import ChannelService from '../services/channel.service';
import { initiated } from '../utils/coordinator';
const a = new app([])
const service = new ChannelService;
const coordinator = service.coordinator;

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

/** 코디네이터 유틸이 초기화되기를 기다림. */
const poll = async () => {
    while (!initiated) {
        await sleep(1000);
    }
}

beforeAll(poll);

const CHANNEL = 'testChannel';

describe('test', () => {
    test('초기화 테스트', async () => {
        const got = await service.isInitAsync();
        expect(got).toBe(true)
    })
    test('채널 생성 시도', async () => {
        try {
        const got = await service.createChannelAsync(CHANNEL);
        expect(got === 'OK')
        } catch(e) {
            // 임시 노드가 생성되어있을 수 있음. (테스트를 연속적으로 실행한다면.)
            expect(e.code).toBe(-110)
        }
    })
    test('캐시에 채널이 잘 생성되었는가?', ()=>{
        expect(service.Cache.get(CHANNEL)).not.toBeUndefined();
    })

    test('코디네이터 서버에 채널이 잘 생성되었는가?', async () => {
        const got = await service.getChannelAsync(CHANNEL);
        expect(got.queuedConnections).toBe(0);
    })


    test('update q connections', async() => {
        await service.updateQueuedConnectionDeltaAsync(CHANNEL, 2);
    })

    test('queuedCxs 업데이트 체크', async () => {
        const got = await service.getChannelAsync(CHANNEL);
        expect(got.queuedConnections).toBe(2);
    })

    test('update connections', async() => {
        await service.updateQueuedConnectionDeltaAsync(CHANNEL, -2);
        await service.updateConnectionDeltaAsync(CHANNEL, 2);
    })

    test('cxs 업데이트 체크', async () => {
        const got = await service.getChannelAsync(CHANNEL);
        expect(got.queuedConnections === 0 && got.connections === 2);
    })
   
})
