import { Server } from 'socket.io'
import { CREDENTIALS, ORIGIN } from '@/config';
import cors from 'cors';

let instance: Server;
const socketIO = (option?: any) => {
    if (!instance) {
        if (option) {
            instance = new Server(
                {
                    cors: { origin: ORIGIN, credentials: CREDENTIALS },
                    transports: ['websocket', 'polling'],
                    ...option
                }
            );
        } else {
            instance = new Server(
                {
                    cors: { origin: ORIGIN, credentials: CREDENTIALS },
                    transports: ['websocket', 'polling'],
                }
            );
        }
    }
    return instance;
}

export { socketIO };