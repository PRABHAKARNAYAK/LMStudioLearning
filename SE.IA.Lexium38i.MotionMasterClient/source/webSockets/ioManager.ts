import { Server as SocketIoServer } from "socket.io";
import { resetSocket } from "./socketManager";
import { MotionMasterClientFunctions } from "../controllers/MotionMasterClientFunctions";

let socketIoServer: SocketIoServer | null = null;

export const setIO = (ioInstance: SocketIoServer) => {
  socketIoServer = ioInstance;
  susbscribeToSocketIoServerEvents();
};

export const getIO = (): SocketIoServer => {
  if (!socketIoServer) {
    throw new Error("Socket.IO instance not initialized");
  }
  return socketIoServer;
};

function susbscribeToSocketIoServerEvents(): void {
  if (!socketIoServer) {
    throw new Error("Socket.IO server is not initialized");
  }

  socketIoServer.on("connection", (socket) => {
    console.log("Client connected");
    socket.emit("connection", {
      message: "Connection to server is successful!",
    });

    // To-Do - For future use when handling multiple solutions/mfes to publish data independently.
    // const registerHandler = (solutionId: string) => {
    //     socket.data.solutionId = solutionId;
    //     addSocket(solutionId, socket);
    //     console.log(`Registered socket for solutionId: ${solutionId}`);
    // };
    // socket.on('register', registerHandler);

    socket.on("disconnect", () => {
      MotionMasterClientFunctions.getMotionMasterClientFunctionsInstance().disconnectClient();
      resetSocket();
      // To-Do - For future use when handling multiple solutions/mfes to publish data independently.
      //const solutionId = socket.data.solutionId;
      // Unsubscribe from events
      //socket.off('register', registerHandler);
      // if (solutionId) {
      //     removeSocket(solutionId);
      //     console.log(`Solution with id ${solutionId} disconnected`);
      // } else {
      //     console.log(`Socket ${socket.id} disconnected`);
      // }
    });
  });
}
