import { Server } from "http";
import { Socket } from "socket.io"; // Import the Socket type from socket.io

class SocketManager {
  private mySocket: Socket | null = null; // Specify the type here

  emitter(emitType: string, message: any) {
    if (emitType === "email-buffer" || emitType === "upload-file") {
      if (this.mySocket) {
        this.mySocket.emit(emitType, message);
      }
    }
  }

  async socketListener(listenType: string, received: any) {
    if (received) {
      this.mySocket?.on(listenType, received);
      if (listenType === "upload-file") {
      }
    }
    if (!received) {
      this.mySocket?.on(listenType, () => {
        this.mySocket?.disconnect();
      });
    }
  }

  initialize(server: Server) {
    const io = require("socket.io")(server, {
      cors: {
        origin: "*",
        methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
        credentials: true,
        enabledPorts: ["ws", "wss"],
      },
    });

    io.on("connection", (socket: Socket) => {
      socket.once("test-connect", (received: any) => {
        console.log(received);
      });
      this.mySocket = socket;
    });
  }
}

export default SocketManager;
