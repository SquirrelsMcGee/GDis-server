import { ChannelType, Client, GuildChannel, Message } from "discord.js";
import { Logger } from "../helpers/logger";
import { PermissionCheck } from "../helpers/permission-checker";
import { INamed } from "../lib/named-class";

export type Precondition = (...args: unknown[]) => Promise<boolean>;

/**
 * TODO: ideally each condition is actually it's own class that can spit out it's own name
 */
export type PreconditionInfo = {
  name: string;
  execute: Precondition;
};

export class ClientActionPreconditions implements INamed {
  public readonly name: string = 'ClientActionPreconditions';

  constructor(
    private readonly sandboxList: string[],
    private readonly client: Client
  ) { }

  // Precondition method to check if a message is not a system message
  async isNotSystemMessage(message: Message): Promise<boolean> {
    return Promise.resolve(!(!message.thread && message.system));
  }

  // Precondition method to check if the author of the message is the bot itself
  async authorIsMe(message: Message): Promise<boolean> {
    return Promise.resolve<boolean>(message.author.id === this.client.user?.id);
  }

  // Precondition to check if the message is in a thread or direct message channel
  async isThreadOrDirect(message: Message): Promise<boolean> {
    const isThread = await this.isThread(message);
    if (isThread)
      return Promise.resolve(isThread);

    const isMentionOrReply = await this.isMentionOrReply(message);
    return Promise.resolve(isMentionOrReply);
  }

  // Precondition to check if the message is in the specified guilds
  async isSandboxed(message: Message): Promise<boolean> {
    return Promise.resolve(this.sandboxList.includes(message.guild?.id ?? ''));
  }

  async isChannelType(message: Message, types: ChannelType[]): Promise<boolean> {
    return Promise.resolve(types.includes(message.channel.type))
  }

  async hasGuildChannelPermissions<T extends GuildChannel>(channel: T, flags: bigint[]): Promise<boolean> {
    return Promise.resolve(PermissionCheck.hasGuildChannelPermissions(channel, flags));
  }

  async isThread(message: Message): Promise<boolean> {
    const isValid = await this.isChannelType(message, [ChannelType.PrivateThread]);
    return Promise.resolve(isValid);
  }


  /** Internal checks */
  private async isMentionOrReply(message: Message): Promise<boolean> {
    const isMention = await this.isMention(message);
    const isReply = await this.isReply(message);
    return Promise.resolve(isMention || isReply);
  }

  private async isMention(message: Message): Promise<boolean> {
    const isMention = message.mentions.users.map(u => u.id).includes(this.client.user?.id ?? '');
    return Promise.resolve(isMention);
  }

  private async isReply(message: Message): Promise<boolean> {
    // Check if the message is a reply to another message
    if (message.reference?.messageId) {
      try {
        // Fetch the original message being replied to
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

        // Check if the original message was sent by the bot
        if (referencedMessage.author.id === this.client.user?.id)
          return Promise.resolve(true);
      }
      catch (error) {
        Logger.error(this.name, 'fn isReply', error);
      }
      finally {
        return Promise.resolve(false);
      }
    }

    return Promise.resolve(false);
  }
}
