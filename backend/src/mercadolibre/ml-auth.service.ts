import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
}

/**
 * Token de aplicacion (grant client_credentials). Sirve para todos los recursos
 * publicos de catalogo: sitios, categorias, atributos, productos, highlights.
 * Los recursos de vendedor necesitan un token de usuario (authorization_code).
 */
@Injectable()
export class MlAuthService {
  private readonly logger = new Logger(MlAuthService.name);
  private token: string | null = null;
  private expiresAt = 0;
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getAppToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    // Una sola renovacion concurrente: el resto espera la misma promesa.
    this.inFlight ??= this.requestToken().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Fuerza la proxima llamada a pedir un token nuevo (usado ante un 401). */
  invalidate(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  private async requestToken(): Promise<string> {
    const apiUrl = this.config.get<string>('mercadolibre.apiUrl')!;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.get<string>('mercadolibre.clientId')!,
      client_secret: this.config.get<string>('mercadolibre.clientSecret')!,
    });

    try {
      const { data } = await firstValueFrom(
        this.http.post<TokenResponse>(
          `${apiUrl}/oauth/token`,
          body.toString(),
          {
            headers: {
              accept: 'application/json',
              'content-type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      this.token = data.access_token;
      // Margen de 60s para no usar un token que expira en pleno vuelo.
      this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
      this.logger.log(`Token de app renovado (expira en ${data.expires_in}s)`);
      return this.token;
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo obtener el token de aplicacion de Mercado Libre',
      );
    }
  }
}
