
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
const poll = async () => {
    while (!initiated) {
        console.log('test');
        await sleep(1000);
    }
    console.log('connected. wait!')
    await sleep(1000)

}

beforeAll(poll);
const CHANNEL = 'testChannel';

describe('test', () => {
    test('test1', async () => {

        const got = await service.isInitAsync();
        expect(got[0]).not.toBeNull()
    })
    test('test2', async () => {
        try {
        const got = await service.CreateChannelAsync(CHANNEL);
        console.log('순서/')
        expect(got === 'OK')
        } catch(e) {
            // 임시 노드가 생성되어있을 수 있음. (테스트를 연속적으로 실행한다면.)
            expect(e.code).toBe(-110)
        }
    })
    test('created?', ()=>{
        expect(service.Cache.get(CHANNEL)).not.toBeUndefined();
    })

    test('코디네이터 서버에 채널이 잘 생성되었는가?', async () => {
        const got = await service.GetChannelAsync(CHANNEL);
        expect(got.queuedConnections).toBe(0);
    })


    test('update q connections', async() => {
        await service.UpdateQueuedConnectionDeltaAsync(CHANNEL, 2);
    })

    test('queuedCxs 업데이트 체크', async () => {
        const got = await service.GetChannelAsync(CHANNEL);
        expect(got.queuedConnections).toBe(2);
    })

    test('update connections', async() => {
        await service.UpdateQueuedConnectionDeltaAsync(CHANNEL, -2);
        await service.UpdateConnectionDeltaAsync(CHANNEL, 2);
    })

    test('cxs 업데이트 체크', async () => {
        const got = await service.GetChannelAsync(CHANNEL);
        expect(got.queuedConnections === 0 && got.connections === 2);
    })
   
})
