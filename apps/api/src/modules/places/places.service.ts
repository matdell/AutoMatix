import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PlacesService {
  constructor(private config: ConfigService) {}

  async lookupPlace(placeId: string) {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return null;
    }
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,address_component&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const location = payload?.result?.geometry?.location;
    return {
      formattedAddress: payload?.result?.formatted_address ?? null,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
    };
  }
}
