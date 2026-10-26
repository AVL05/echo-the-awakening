import { executeCommand, type Command, type CommandResponse, type Progress } from './progress';

// A worker or Transformers.js adapter can implement this contract without touching gameplay.
export interface EchoCommandPort {
  send(command: Command, context: Readonly<Progress>, signal?: AbortSignal): Promise<CommandResponse>;
}

export const echoCommands: EchoCommandPort = {
  async send(command, context, signal) {
    signal?.throwIfAborted();
    return executeCommand(command, { ...context });
  },
};
