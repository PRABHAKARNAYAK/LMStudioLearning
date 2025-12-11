import { Socket } from "socket.io";

let _socket: Socket | undefined;

export const resetSocket = () => {
  _socket = undefined;
};

export const setSocket = (socket: Socket) => {
  _socket = socket;
};

export const getAvailableSocket = (): Socket | undefined => {
  return _socket;
};

/* 
To-Do: For future use - when multiple solutions needs to be handled.

const solutionSocketMap = new Map<string, Socket>();
export const addSocket = (solutionId: string, socket: Socket) => {
    solutionSocketMap.set(solutionId, socket);
};

export const getSocket = (solutionId: string): Socket | undefined => {
    return solutionSocketMap.get(solutionId);
};



export const removeSocket = (solutionId: string) => {
    solutionSocketMap.delete(solutionId);
};

export const getAllSockets = () => {
    return solutionSocketMap;
};

*/
