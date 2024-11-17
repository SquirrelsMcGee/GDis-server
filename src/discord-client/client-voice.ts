import { AudioPlayer, AudioPlayerError, AudioPlayerStatus, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, joinVoiceChannel, VoiceConnection } from "@discordjs/voice";
import { Message, VoiceBasedChannel } from "discord.js";
import { TTS_FILEPATH } from "..";
import { Logger } from "../helpers/logger";
import { INamed } from "../lib/named-class";

import { ITextToSpeechProvider } from "../integrations/tts/tts-provider";
import { NonFatalException } from "../lib/custom-error";

export type AsyncTextLoader = () => Promise<string>;

export class ClientVCManager implements INamed {
  public readonly name: string = 'ClientVoice';

  private readonly logger = new Logger();

  private readonly playerMap: Map<string, DiscordAudioPlayer> = new Map<string, DiscordAudioPlayer>();

  constructor(private readonly textToSpeech: ITextToSpeechProvider) {
    this.logger.setInfo(this.name);
  }

  public async doVoiceInteraction(replyingToMessage: Message, loader: AsyncTextLoader) {
    try {
      const guild = replyingToMessage.guild;
      const channel = replyingToMessage.member?.voice.channel as VoiceBasedChannel;

      if (!guild || !channel)
        throw new NonFatalException('Cannot do Voice Interaction, Guild or Channel was null');

      let player = this.playerMap.get(replyingToMessage.guild.id);

      if (!player) {
        const newPlayer = new DiscordAudioPlayer(`AudioPlayer #${guild.id}`, TTS_FILEPATH);
        player = newPlayer;
        this.playerMap.set(replyingToMessage.guild.id, newPlayer);
      }

      await this.textToSpeech.generateSpeech(await loader());

      player.play(replyingToMessage);

    } catch (error) {
      this.logger.error('doVoiceInteraction', error);
    }
  }

}

class DiscordAudioPlayer {
  private connection?: VoiceConnection;
  private player?: AudioPlayer;

  private readonly logger = new Logger();

  constructor(private readonly name: string, private readonly filePath: string) {
    this.logger.setInfo(this.name);
  }

  public play(message: Message) {
    this.logger.info('Started playing audio');

    this.player = this.player ?? createAudioPlayer();
    this.connection = this.connection ?? this.connectToVoiceChannel(message);

    const audio = createAudioResource(this.filePath);
    this.player.play(audio);
    this.connection.subscribe(this.player);

    this.player.on('error', this.handleError.bind(this));
    this.player.on(AudioPlayerStatus.Idle, this.onIdle.bind(this));
  }

  private handleError(error: AudioPlayerError) {
    this.logger.error('Error in voice player', error);
    this.connection?.destroy();
    //fs.unlinkSync(this.filePath);
  }

  private onIdle() {
    this.logger.info('Finished playing audio');
    //fs.unlinkSync(this.filePath);
  }

  private connectToVoiceChannel(message: Message) {
    const guild = message.guild;
    const channel = message.member?.voice.channel as VoiceBasedChannel;

    if (!guild || !channel)
      throw new NonFatalException('Cannot connect to voice channel, Guild or Channel was null');

    return joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
    });
  }

}