process.env.PUBLIC_HOSTNAME = 'channel.unit.test'

import app from '../http.app'
import { initiated } from '../utils/coordinator/coordinator';
import {isInitAsync, createChannelAsync, Cache, getChannel, updateConnectionDeltaAsync, initializeServiceAsync, deleteServiceAsync, } from '../utils/coordinator/websocketServer.coordinator'



const a = new app([])
initializeServiceAsync();


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

beforeAll(async () => { await poll() });
afterAll(async() => {
   await deleteServiceAsync();
})

const CHANNEL = 'testChannel';

describe('[코디네이터] 테스트용 채널 정보 생성 및 확인', () => {
    test('초기화 테스트', async () => {
        const got = await isInitAsync();
        expect(got).toBe(true)
    })
    test('채널 생성 시도', async () => {
        try {
        const got = await createChannelAsync(CHANNEL);
        expect(got === 'OK')
        } catch(e) {
            // 임시 노드가 생성되어있을 수 있음. (테스트를 연속적으로 실행한다면.)
            expect(e.code).toBe(-110)
        }
    })
    test('캐시에 채널이 잘 생성되었는가?', ()=>{
        expect(Cache.get(CHANNEL)).not.toBeUndefined();
    })

    test('코디네이터 서버에 채널이 잘 생성되었는가?', async () => {
        const got = await getChannel(CHANNEL);
        expect(got.queuedConnections).toBe(0);
    })

    test('update connections', async() => {
        await updateConnectionDeltaAsync(CHANNEL, 2);
    })

    test('cxs 업데이트 체크', async () => {
        const got = getChannel(CHANNEL);
        expect(got.queuedConnections === 0 && got.connections === 2);
    })
    test('delete connections', async() => {
        await updateConnectionDeltaAsync(CHANNEL, -2);
    })

    test('cxs 업데이트 체크', async () => {
        const got = getChannel(CHANNEL);
        expect(got);
    })
})
