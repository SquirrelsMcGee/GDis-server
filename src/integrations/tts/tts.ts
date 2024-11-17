import say from 'say';
import { TTS_FILEPATH } from '../..';
import { Logger } from "../../helpers/logger";
import { ITextToSpeechProvider } from './tts-provider';


export class TextToSpeech implements ITextToSpeechProvider {
  private readonly logger = new Logger();
  constructor() {
    this.logger.setInfo('TextToSpeech');
    this.logger.info('Saving files to ' + TTS_FILEPATH);
  }

  public async generateSpeech(inputText: string): Promise<void> {
    this.logger.info('generating tts');
    return new Promise((resolve, reject) => {
      say.export(inputText, undefined, 1, TTS_FILEPATH, (err) => {
        if (err) return reject(err);

        this.logger.info('done');
        resolve();
      })
    })
  }
}