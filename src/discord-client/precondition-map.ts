import { Client, Message } from "discord.js";
import { NonFatalException } from "../lib/custom-error";
import { ClientActionConditions } from "./preconditions";

// This has been changed to always assume a message as the first input, makes things easier
export type MessageConditon = (message: Message, ...args: any[]) => Promise<boolean>;

export enum PreconditionType {
  authorIsMe = 'authorIsMe',
  isNotSystemMessage = 'isNotSystemMessage',
  isThread = 'isThread',
  isThreadOrDirect = 'isThreadOrDirect',
  sandboxed = 'sandboxed',
  isMentionOrReply = 'isMentionOrReply',
  isChannelType = 'isChannelType',
  hasGuildChannelPermissions = 'hasGuildChannelPermissions',
}

export class ClientActionConditionMap {
  private readonly conditions: ClientActionConditions;
  private readonly preconditionMap: Map<PreconditionType, MessageConditon>;

  constructor(
    sandboxList: string[],
    client: Client
  ) {
    this.conditions = new ClientActionConditions(sandboxList, client);

    this.preconditionMap = new Map<PreconditionType, MessageConditon>();

    const set = (type: PreconditionType, condition: MessageConditon) => {
      this.preconditionMap.set(type, condition);
    }

    set(PreconditionType.authorIsMe, this.conditions.authorIsMe);
    set(PreconditionType.isNotSystemMessage, this.conditions.isNotSystemMessage);
    set(PreconditionType.isThread, this.conditions.isThread);
    set(PreconditionType.isThreadOrDirect, this.conditions.isThreadOrDirect);
    set(PreconditionType.sandboxed, this.conditions.isSandboxed);
    set(PreconditionType.isMentionOrReply, this.conditions.isMentionOrReply);
    set(PreconditionType.isChannelType, this.conditions.isChannelType);
    set(PreconditionType.hasGuildChannelPermissions, this.conditions.hasGuildChannelPermissions);
  }

  public async assert(type: PreconditionType, message: Message, ...args: any[]): Promise<boolean> {
    const result = await this.test(type, message, args);

    if (!result)
      throw new NonFatalException(`Failed condition ${type}, returned ${result}`);

    return Promise.resolve(result);
  }

  public async test(type: PreconditionType, message: Message, ...args: any[]): Promise<boolean> {
    return this.preconditionMap.get(type)?.call(this.conditions, message, ...args)
      ?? Promise.resolve(true);
  }
}