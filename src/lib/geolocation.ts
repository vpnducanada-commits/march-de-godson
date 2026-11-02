import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export class GeolocationError extends Error {
  readonly code: 'UNSUPPORTED' | 'DENIED' | 'DISABLED' | 'TIMEOUT' | 'UNKNOWN';
  constructor(
    code: 'UNSUPPORTED' | 'DENIED' | 'DISABLED' | 'TIMEOUT' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

/**
 * Demande explicitement l'autorisation de localisation à l'utilisateur
 * (boîte de dialogue système Android via Capacitor sur APK, ou invite
 * du navigateur sur le Web) puis récupère les coordonnées GPS actuelles.
 */
export async function requestUserPosition(): Promise<UserCoordinates> {
  // 1. Plateforme native Android / iOS (APK Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      }
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        throw new GeolocationError(
          'DENIED',
          'Accès à la localisation refusé. Autorisez la position dans les paramètres Android de GODSON Marketplace.',
        );
      }

      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      } catch {
        // Second essai réseau/cellulaire si le fix GPS fin prend trop de temps en intérieur
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 120000,
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      }
    } catch (err) {
      if (err instanceof GeolocationError) throw err;
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('denied') || msg.includes('permission')) {
        throw new GeolocationError(
          'DENIED',
          'Autorisation de localisation refusée. Activez la permission Position pour GODSON Marketplace dans les paramètres du téléphone.',
        );
      }
      if (msg.includes('disabled') || msg.includes('location services')) {
        throw new GeolocationError(
          'DISABLED',
          'La localisation (GPS) est désactivée sur votre téléphone. Activez la Position dans le volet rapide Android puis réessayez.',
        );
      }
      throw new GeolocationError(
        'TIMEOUT',
        'Impossible d’obtenir votre position actuelle. Vérifiez que la Position (GPS) est activée puis réessayez.',
      );
    }
  }

  // 2. Navigateur Web / PWA
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeolocationError(
      'UNSUPPORTED',
      'La géolocalisation n’est pas prise en charge par ce navigateur.',
    );
  }

  // Vérifier l'état de la permission si l'API Permissions est disponible
  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state === 'denied') {
        throw new GeolocationError(
          'DENIED',
          'Accès à la position bloqué dans votre navigateur. Cliquez sur l’icône de cadenas près de l’adresse du site puis autorisez « Position ».',
        );
      }
    } catch (e) {
      if (e instanceof GeolocationError) throw e;
    }
  }

  const getWebPos = (highAccuracy: boolean, timeout: number) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge: 60000,
      });
    });

  try {
    const pos = await getWebPos(true, 10000).catch((err: GeolocationPositionError) => {
      if (err && err.code === 1) throw err; // PERMISSION_DENIED : ne pas relancer
      return getWebPos(false, 10000);
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (err) {
    const geoErr = err as GeolocationPositionError | undefined;
    if (geoErr?.code === 1) {
      throw new GeolocationError(
        'DENIED',
        'Vous avez refusé l’accès à la localisation. Autorisez « Position » dans les paramètres du navigateur pour utiliser cette fonction.',
      );
    }
    if (geoErr?.code === 2) {
      throw new GeolocationError(
        'DISABLED',
        'Position indisponible. Activez le GPS / la localisation de votre appareil puis réessayez.',
      );
    }
    if (geoErr?.code === 3) {
      throw new GeolocationError(
        'TIMEOUT',
        'Délai dépassé lors de la détection GPS. Vérifiez que la localisation est activée puis réessayez.',
      );
    }
    throw new GeolocationError('UNKNOWN', 'Impossible de récupérer votre position actuelle.');
  }
}
