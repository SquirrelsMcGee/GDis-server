import cors from 'cors';
import { ChannelType, PermissionsBitField } from 'discord.js';
import express, { Request, Response } from 'express';
import fileUpload, { UploadedFile } from 'express-fileupload';
import md5 from 'md5';
import fs from 'node:fs/promises';

import { ENV_CONFIG } from './config';
import { ClientManager, FileUploadData } from './discord-client/client-manager';
import { Logger } from './helpers/logger';
import { PermissionCheck } from './helpers/permission-checker';
import { PromiseFactory } from './helpers/promise-factory';
import { IMessageResponse } from './lib/interfaces/message-response';
import { INamed } from './lib/named-class';

export class ApiManager implements INamed {
  public readonly name: string = 'ApiManager';

  private readonly app;
  private readonly map: Map<string, (req: Request, res: Response) => Promise<void>>;
  private readonly guildsApi: GuildsApi;

  private readonly logger = new Logger();

  constructor(
    private readonly port: number,
    private readonly clientManager: ClientManager
  ) {
    this.logger.setInfo(this.name);

    this.guildsApi = new GuildsApi(this.clientManager);
    this.app = express();

    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(fileUpload());

    this.map = new Map<string, (req: Request, res: Response) => Promise<void>>([
      ['GET/', this.getRoot.bind(this)],

      // Guilds
      ['GET/guilds', this.guildsApi.getGuilds.bind(this.guildsApi)],
      ['GET/guildMembers', this.guildsApi.getMembers.bind(this.guildsApi)],
      ['GET/guildChannels', this.guildsApi.getChannels.bind(this.guildsApi)],

      // Users

      ['GET/messages', this.getMessages.bind(this)],
      ['GET/history', this.getHistory.bind(this)],
      ['POST/send', this.postMessage.bind(this)],

      // Settings
      ['POST/settings', this.updateSettings.bind(this)],
      ['GET/settings', this.getSettings.bind(this)]
    ])

    this.map.forEach((method, key) => {
      const requestMethod = key.split('/')[0];
      if (requestMethod === 'GET')
        this.app.get(key.slice(3), async (req: Request, res: Response) => await method(req, res));

      if (requestMethod === 'POST')
        this.app.post(key.slice(4), async (req: Request, res: Response) => await method(req, res));
    });
  }

  public listen(): void {
    this.app.listen(this.port, () => {
      this.logger.info('REST API is listening on port', this.port);
    });
  }

  private async getRoot(req: Request, res: Response) {
    res.send('root response');
    return Promise.resolve();
  }

  private async getMessages(req: Request, res: Response) {
    try {
      const messages: IMessageResponse[] = this.clientManager.getMessages().map(message => ({
        user: message.author.username,
        content: message.content,
        createdTimestamp: message.createdTimestamp,
        attachments: message.attachments.map(a => ({
          id: a.id,
          proxyUrl: a.proxyURL
        }))
      }));
      res.send(messages);
      await new Promise(f => setTimeout(f, 1));
      this.clientManager.clearMessageCache();

      return Promise.resolve();
    }
    catch {
      res.send([]);
      return Promise.reject('Failed getMessages');
    }
  }

  private async getHistory(req: Request, res: Response) {
    const channelId = req.query['channelId'] as string;
    try {
      const msgs = await this.clientManager.getMessageHistory(channelId);
      if (!msgs)
        return Promise.reject('Failed to getHistory, no msgs');

      const response: IMessageResponse[] = msgs.map(message => ({
        user: message.author.username,
        content: message.content,
        createdTimestamp: message.createdTimestamp,
        attachments: message.attachments.map(a => ({
          id: a.id,
          proxyUrl: a.proxyURL
        }))
      }));

      res.send(response);
      return Promise.resolve();
    }
    catch (err) {
      res.send([]);
      return Promise.reject('Failed to getHistory, ' + err);
    }
  }

  private async postMessage(req: Request, res: Response) {
    const channelId = req.query['channelId'] as string;
    const content = req.query['message'] as string;
    const attachment = req.files?.['file0'] as UploadedFile;

    let uploadPath: string = '';
    let tempFilename: string = '';
    if (attachment) {
      tempFilename = `${md5(attachment.name)}${this.stripFileExtension(attachment.name)}`;
      uploadPath = __dirname + '/tmp/' + tempFilename;
      await attachment.mv(uploadPath)
    }

    let files: FileUploadData[] = [];
    if (uploadPath !== '')
      files.push({
        attachment: uploadPath,
        name: tempFilename,
        description: ''
      });

    try {
      const message = await this.clientManager.sendMessage(channelId, content, files);
      // Send the message back to the client
      res.send(message);

      // Delete any files
      if (uploadPath) void fs.unlink(uploadPath);

      // Return
      return Promise.resolve();
    }
    catch (error) {
      this.logger.error('Failed to post Message', error);
      return PromiseFactory.reject(this.name, ['fn postMessage', 'Failed to postMessage', error]);
    }
  }

  private updateSettings(req: Request, res: Response) {
    const settingKey = req.query['settingKey'];

    if (settingKey === 'ENABLE_TTS')
      ENV_CONFIG.ENABLE_TTS = !ENV_CONFIG.ENABLE_TTS;

    if (settingKey === 'ENABLE_CHAT_HISTORY_SUMMARY')
      ENV_CONFIG.ENABLE_CHAT_HISTORY_SUMMARY = !ENV_CONFIG.ENABLE_CHAT_HISTORY_SUMMARY;

    if (settingKey === 'ENABLE_WEB_SEARCH')
      ENV_CONFIG.ENABLE_WEB_SEARCH = !ENV_CONFIG.ENABLE_WEB_SEARCH;

    res.send({
      ENABLE_TTS: ENV_CONFIG.ENABLE_TTS,
      ENABLE_CHAT_HISTORY_SUMMARY: ENV_CONFIG.ENABLE_CHAT_HISTORY_SUMMARY,
      ENABLE_WEB_SEARCH: ENV_CONFIG.ENABLE_WEB_SEARCH,
    });
    return Promise.resolve();
  }

  private getSettings(req: Request, res: Response) {
    res.send({
      ENABLE_TTS: ENV_CONFIG.ENABLE_TTS,
      ENABLE_CHAT_HISTORY_SUMMARY: ENV_CONFIG.ENABLE_CHAT_HISTORY_SUMMARY,
      ENABLE_WEB_SEARCH: ENV_CONFIG.ENABLE_WEB_SEARCH,
    });
    return Promise.resolve();
  }

  private stripFileExtension(filename: string) {
    var re = /(?:\.([^.]+))?$/;
    const res = re.exec(filename);
    return res?.[0] ?? '';
  }
}


class GuildsApi {
  constructor(private readonly clientManager: ClientManager) {
  }

  public async getGuilds(req: Request, res: Response) {
    const guilds = await this.loadGuilds();

    res.send(guilds.map(guild => ({
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL()
    })));

    return Promise.resolve();
  }


  public async getMembers(req: Request, res: Response) {
    const guildId = req.query['guildId'] as string;

    const guild = await this.clientManager.client.guilds.fetch({ guild: guildId });
    const members = await guild.members.fetch();

    res.send(members.map(m => ({
      id: m.id,
      displayName: m.displayName,
      nickname: m.nickname,
      avatar: m.avatarURL(),
      color: m.displayHexColor
    })));

    return Promise.resolve();
  }

  public async getChannels(req: Request, res: Response) {
    const guildId = req.query['guildId'] as string;

    const guild = await this.clientManager.client.guilds.fetch({ guild: guildId });
    const channels = await guild.channels.fetch();

    const response = channels.filter(c => c !== null)
      .filter(c => c.type !== ChannelType.GuildCategory && c.type !== ChannelType.GuildVoice)
      .filter(c => {
        return PermissionCheck.hasGuildChannelPermissions(c, [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory
        ]);
      }).map(m => ({
        id: m.id,
        name: m.name,
        category: m.parent?.name,
        type: m.type
      }))

    res.send(response);

    return Promise.resolve();
  }


  private async loadGuilds() {
    const guilds = await this.clientManager.client.guilds.fetch();
    return guilds;
  }

}
