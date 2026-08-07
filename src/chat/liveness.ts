import type { WebSocket } from "ws";

type Socket = Pick<WebSocket, "on" | "ping" | "terminate">;

export class Liveness {
  private readonly sockets = new Map<Socket, boolean>();

  track(socket: Socket): void {
    this.sockets.set(socket, true);
    socket.on("pong", () => this.sockets.set(socket, true));
    socket.on("close", () => this.sockets.delete(socket));
  }

  check(): number {
    let terminated = 0;
    for (const [socket, alive] of this.sockets) {
      if (!alive) {
        this.sockets.delete(socket);
        socket.terminate();
        terminated++;
        continue;
      }
      this.sockets.set(socket, false);
      socket.ping();
    }
    return terminated;
  }
}
