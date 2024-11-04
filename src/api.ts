import cors from 'cors';
import express, { Request, Response } from 'express';
import fileUpload, { UploadedFile } from 'express-fileupload';
import md5 from 'md5';
import { ClientManager, FileUploadData } from "./client";

type MessageResponse = {
  content: string;
  createdTimestamp: number;
  attachments: {
    id: string;
    proxyUrl: string
  }[]
}

export class ApiManager {
  private readonly app;

  private readonly map: Map<string, (req: Request, res: Response) => Promise<void>> = new Map<string, (req: Request, res: Response) => Promise<void>>([
    ['GET/', this.getRoot.bind(this)],
    ['GET/messages', this.getMessages.bind(this)],
    ['GET/history', this.getHistory.bind(this)],
    ['POST/send', this.postMessage.bind(this)]
  ]);

  constructor(
    private readonly port: number,
    private readonly clientManager: ClientManager
  ) {
    this.app = express();

    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(fileUpload());

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
      console.log(`Server is listening on port ${this.port}`);
    });
  }

  private async getRoot(req: Request, res: Response) {
    res.send('root response');
    return Promise.resolve();
  }

  private async getMessages(req: Request, res: Response) {
    const messages: MessageResponse[] = this.clientManager.getMessages().map(message => ({
      content: message.content,
      createdTimestamp: message.createdTimestamp,
      attachments: message.attachments.map(a => ({
        id: a.id,
        proxyUrl: a.proxyURL
      }))
    }));
    res.send(messages);
    await new Promise(f => setTimeout(f, 1000));


    this.clientManager.clearMessageCache();

    return Promise.resolve();
  }

  private async getHistory(req: Request, res: Response) {
    const channelId = req.query['channelId'] as string;
    const msgs = await this.clientManager.getMessageHistory(channelId);
    res.send(msgs);
    return Promise.resolve();
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

    const message = await this.clientManager.sendMessage(channelId, content, files);
    if (message) {
      res.send(message);
      return Promise.resolve();
    }

    return Promise.reject();
  }

  private stripFileExtension(filename: string) {
    var re = /(?:\.([^.]+))?$/;
    const res = re.exec(filename);
    return res?.[0] ?? '';
  }
}

