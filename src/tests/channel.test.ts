process.env.PUBLIC_HOSTNAME = 'channel.test'

import { socketIO } from '../utils/socket.io'
import { WebsocketApp } from '../websocket.app'
import { ServiceRoute } from '../routes/service.websocket.route'
import { Manager, io } from 'socket.io-client'
import HttpApp from '../http.app';
import { deleteServiceAsync, getChannel, initializeServiceAsync } from '../utils/coordinator/websocketServer.coordinator';

import { closeAsync, serverInitiated } from '../server'
import { Socket } from 'socket.io'
import { SocketReservedEventsMap } from 'socket.io/dist/socket'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

/** 코디네이터 유틸이 초기화되기를 기다림. */
const poll = async () => {
    while (!serverInitiated) {
        await sleep(1000);
    }
}

beforeAll(async () => { await poll() });

afterAll(async () => {
    await closeAsync();
})

const url = 'http://localhost:3000'
class TestClient {
    socket: Socket<DefaultEventsMap, DefaultEventsMap> | any
    constructor(nsp: string) {
        this.socket = io(url + nsp, { autoConnect: false });
    }
    async onConnect() {
        await new Promise(r => {
            this.socket.on('connect', () => { r(true) })
            this.socket.connect()
        })
    }
    close() {
        this.socket.close();
    }
}
describe('클라이언트 입장-퇴장', () => {
    const channelId = 'test';
    const arr: TestClient[] = [];
    const connectionCount = 24;
    const evalConnectionGrade = (value: number) => {
        return (Math.ceil(value / 10) * 10).toString(10) + '>';
    }
    test(`${connectionCount}명이 잘 들어가는가?`, async () => {
        for (var i = 0; i < connectionCount; i++) arr.push(new TestClient(`/channel-${channelId}`));

        for (var i = 0; i < connectionCount; i++) await arr[i].onConnect()
        // 10명?
        const got = getChannel(channelId)
        expect(got.connections === connectionCount
            && got.connectionGrade === evalConnectionGrade(connectionCount));
    });

    test('grade 변경 테스트', async () => {
        const first = getChannel(channelId)

        for (var i = 0; i < 10; i++) arr[i].close() // 10명 제거

        await sleep(500) // wait for delete (클라이언트에서는 서버측 삭제 과정을 알지 못하므로 그냥 기다림.)
        const second = getChannel(channelId)

        expect(first.connectionGrade !== second.connectionGrade)
    });

    test('close all', async () => {
        for (var i = 10; i < connectionCount; i++) arr[i].close() // 모두 제거

        await sleep(500) // wait for delete (클라이언트에서는 서버측 삭제 과정을 알지 못하므로 그냥 기다림.)
        const got = getChannel(channelId)

        expect(got === undefined)
    })
})