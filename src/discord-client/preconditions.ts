import { ChannelType, Client, GuildChannel, Message } from "discord.js";
import { PermissionCheck } from "../helpers/permission-checker";
import { INamed } from "../lib/named-class";

export class ClientActionConditions implements INamed {
  public readonly name: string = 'ClientActionPreconditions';

  constructor(
    private readonly sandboxList: string[],
    private readonly client: Client
  ) {
  }

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
    const result = types.includes(message.channel.type);
    return Promise.resolve(result)
  }

  async hasGuildChannelPermissions(message: Message, flags: bigint[]): Promise<boolean> {
    const channel = message.channel as GuildChannel;
    const result = PermissionCheck.hasGuildChannelPermissions(channel, flags);
    return Promise.resolve(result);
  }

  async isThread(message: Message): Promise<boolean> {
    const result = await this.isChannelType(message, [ChannelType.PrivateThread]);
    return Promise.resolve(result);
  }

  async isMentionOrReply(message: Message): Promise<boolean> {
    const isMention = await this.isMention(message);
    const isReply = await this.isReply(message);
    const result = isMention || isReply;
    return Promise.resolve(result);
  }

  /** Internal checks */
  private async isMention(message: Message): Promise<boolean> {
    const result = message.mentions.users.map(u => u.id).includes(this.client.user?.id ?? '');
    return Promise.resolve(result);
  }

  private async isReply(message: Message): Promise<boolean> {
    if (!message.reference?.messageId)
      return Promise.resolve(false);

    try {
      // Fetch the original message being replied to
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

      // Check if the original message was sent by the bot
      if (referencedMessage.author.id === this.client.user?.id)
        return Promise.resolve(true);
    }
    finally {
      return Promise.resolve(false);
    }
  }
}
