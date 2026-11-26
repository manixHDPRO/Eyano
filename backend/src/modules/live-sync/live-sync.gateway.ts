import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { JwtTokenService } from "../auth/jwt-token.service";
import { LiveSyncService } from "./live-sync.service";

@WebSocketGateway({
  namespace: "/live-sync",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class LiveSyncGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveSyncGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly liveSync: LiveSyncService,
    private readonly jwt: JwtTokenService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.liveSync.attachServer(server);
    const corsOrigin = this.config.get<string>("CORS_ORIGIN", "http://localhost:5173");
    this.logger.log(`Passerelle live-sync prête (origines CORS : ${corsOrigin})`);
  }

  handleConnection(client: Socket): void {
    const token = extractHandshakeToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
      return;
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = typeof client.data.userId === "string" ? client.data.userId : "anonymous";
    this.logger.verbose(`Client live-sync déconnecté (${userId})`);
  }
}

function extractHandshakeToken(client: Socket): string | undefined {
  const auth = client.handshake.auth;
  if (typeof auth?.token === "string" && auth.token.length > 0) {
    return auth.token;
  }
  const header = client.handshake.headers.authorization;
  if (typeof header === "string") {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token) {
      return token;
    }
  }
  return undefined;
}