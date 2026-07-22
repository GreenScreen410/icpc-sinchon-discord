declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: 'production' | 'development';
    DISCORD_TOKEN: string;
    GUILD_ID: string;
    SPREADSHEET_ID: string;
    NOVICE_CHANNEL_ID: string;
    NOVICE_VOICE_CHANNEL_ID: string;
    ADVANCED_CHANNEL_ID: string;
    ADVANCED_VOICE_CHANNEL_ID: string;
    NOVICE_ROLE_ID: string;
    ADVANCED_ROLE_ID: string;
    FORM_INTERNAL_ID: string;
    FORM_EXTERNAL_ID: string;
  }
}
