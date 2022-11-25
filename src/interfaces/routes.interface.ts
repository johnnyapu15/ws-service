import { Router } from 'express';
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http'

export interface Routes {
  path?: string;
  router: Router;
}

export interface WebsocketRoutes {
  path?: string;
  io: Server;
  initialize: () => void
}