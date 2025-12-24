import winston, {
  LoggerOptions,
  createLogger,
  format,
  transports,
} from 'winston';
import moment from 'moment';

export type Log = {
  message: string;
  action: string;
  eventTimestamp?: number;
  error?: string;
  context?: {
    [key: string]: string | undefined | null;
  };
};

export class Logger {
  name = 'Logger';
  logger!: winston.Logger;

  public initialize = async (configId: string): Promise<void> => {
    const loggerConfig: LoggerOptions = {
      level: 'info',
      format: format.combine(
        format.label({ label: 'Logger' }),
        format.timestamp(),
        format.json()
      ),
      transports: [new transports.Console()],
    };

    this.logger = createLogger(loggerConfig);

    this.logger.info(
      `Initialized ${this.name} with configId: ${JSON.stringify(configId)}`
    );
  };

  public logEvent = async ({
    message,
    action,
    eventTimestamp = moment().unix(),
    error,
    context,
  }: Log): Promise<void> => {
    const log = {
      logEvent: {
        message,
        action,
        eventTimestamp,
      },
      error,
      context,
    };

    if (error) {
      this.logger.error(log);
    } else {
      this.logger.info(log);
    }
  };
}

