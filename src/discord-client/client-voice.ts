import { Guild, VoiceBasedChannel } from "discord.js";
import { Logger } from "../helpers/logger";
import { INamed } from "../lib/named-class";

import { Observable, Subject } from "rxjs";
import { TTS_FILEPATH } from "..";
import { ITextToSpeechProvider } from "../integrations/tts/tts-provider";
import { NonFatalException } from "../lib/custom-error";
import { DiscordAudioPlayer } from "./audio-player";

export type AsyncTextLoader = () => Promise<string>;

export class AudioInteraction {
  constructor(
    public readonly guild: Guild,
    public readonly channel: VoiceBasedChannel,
    public readonly metadata: AudioSavedMetadata
  ) { }
}

export class AudioSavedMetadata {
  constructor(
    public readonly userId: string,
    public readonly transcript: string
  ) { }
}


export class ClientVoiceController implements INamed {
  public readonly name: string = 'ClientVoice';

  public readonly OnAudioInteraction: Observable<AudioInteraction>;

  private readonly logger = new Logger();

  private readonly playerMap: Map<string, DiscordAudioPlayer> = new Map<string, DiscordAudioPlayer>();
  private readonly audioInteractionSubject$: Subject<AudioInteraction>;

  constructor(private readonly textToSpeech: ITextToSpeechProvider) {
    this.logger.setInfo(this.name);

    this.audioInteractionSubject$ = new Subject<AudioInteraction>();
    this.OnAudioInteraction = this.audioInteractionSubject$;
  }

  public async doVoiceInteraction(guild: Guild, channel: VoiceBasedChannel, loader: AsyncTextLoader) {
    try {
      if (!guild || !channel)
        throw new NonFatalException('Cannot do Voice Interaction, Guild or Channel was null');

      let player = this.playerMap.get(guild.id);

      if (!player) {
        const newPlayer = new DiscordAudioPlayer(`AudioPlayer #${guild.id}`, guild, channel);
        player = newPlayer;
        this.playerMap.set(guild.id, newPlayer);

        player.onAudioSaved.subscribe(data => {
          this.audioInteractionSubject$.next(new AudioInteraction(guild, channel, data));
        });
      }

      await this.textToSpeech.generateSpeech(await loader());

      player.enqueue(TTS_FILEPATH);

    } catch (error) {
      this.logger.error('doVoiceInteraction', error);
    }
  }
}
