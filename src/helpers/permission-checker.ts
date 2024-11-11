import { GuildChannel } from "discord.js";

export class PermissionCheck {
  constructor() { }

  public static hasGuildChannelPermissions(channel: GuildChannel, flags: bigint[]): boolean {
    // Get me
    const me = channel.guild.members.me;
    if (!me)
      return false;

    // Get the permissions for me
    const perms = channel.permissionsFor(me);

    // Return true iff all permissions are available
    return flags.every(flag => perms.has(flag))
  }
}