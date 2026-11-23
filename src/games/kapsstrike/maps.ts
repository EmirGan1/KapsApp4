import { bolluca } from "./bolluca";
import { bollucaV2 } from "./bollucaV2";
import { dust2V2 } from "./dust2v2";
import {dustDistrict} from "./dustDistrict";
import type { MapDefinition, MapId } from "./types";
import { townMap } from "./townMaps";

/** Stable IDs preserve existing KapsApp room URLs while each district has its own topology. */
export const MAPS: Record<MapId, MapDefinition> = {
  district:dustDistrict(),
  dust2v2: dust2V2(),
  bolluca: bolluca(),
  bollucav2: bollucaV2(),
  warehouse: townMap("warehouse"),
  dust: townMap("dust"),
  neon: townMap("neon"),
};

export const BOMB_MAPS = [MAPS.district, MAPS.dust2v2, MAPS.bolluca, MAPS.bollucav2] as const;
