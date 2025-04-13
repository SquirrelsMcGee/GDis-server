import { AudioReceiveStream, EndBehaviorType, VoiceConnection } from "@discordjs/voice";
import ffmpeg from "fluent-ffmpeg";
import fs from 'fs';
import prism from 'prism-media';
import { Observable, Subject } from "rxjs";
import { Logger } from "../helpers/logger";

export class AudioRecorder {
  public readonly onComplete: Observable<string>;

  private opusStream?: AudioReceiveStream | null;
  private outputStream?: fs.WriteStream | null;
  private ffmpegProcess?: ffmpeg.FfmpegCommand | null;

  private decoder?: prism.opus.Decoder | null;

  private readonly name = 'AudioRecorder';
  private readonly logger = new Logger();

  private readonly completeSubject$: Subject<string>;

  constructor(
    private readonly connection: VoiceConnection,
    private readonly userId: string,
    private readonly audioFolder: string
  ) {
    this.logger.setInfo(this.name);

    this.completeSubject$ = new Subject<string>();
    this.onComplete = this.completeSubject$;

    if (!fs.existsSync(this.audioFolder))
      fs.mkdirSync(this.audioFolder, { recursive: true });
  }

  public startRecording() {
    this.logger.info('Started recording');

    const receiver = this.connection.receiver;

    this.opusStream = receiver.subscribe(this.userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence, duration: 2000
      }
    });

    this.decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 })

    const decoded = this.opusStream.pipe(this.decoder);

    const fileName = `${this.audioFolder}/audio_${this.userId}-${Date.now()}.wav`;

    this.ffmpegProcess = ffmpeg()
      .input(decoded)
      .inputFormat('s32le')
      .audioChannels(2)
      .audioFrequency(48000)
      .audioCodec('pcm_s32le')
      .format('wav') // Ensure the output format is WAV
      .save(fileName)
      .on('end', () => {
        this.logger.info(`Finished recording ${this.userId}`);
        this.cleanup(fileName);
      })
      .on('error', (error) => {
        this.logger.error(`Error recording ${this.userId}`, error);
        this.cleanup();
      });
  }

  private cleanup(fileName?: string) {
    this.opusStream?.destroy();
    this.decoder?.destroy();
    this.outputStream?.close();
    this.ffmpegProcess?.kill('SIGINT');
    if (fileName) {
      this.completeSubject$.next(fileName);
    }
  }
}