import { bolluca } from "./bolluca";
import { bolluca2 } from "./bolluca2";
import { dust2Pdf } from "./dust2Pdf";
import {dustDistrict} from "./dustDistrict";
import type { MapDefinition, MapId } from "./types";
import { townMap } from "./townMaps";

/** Stable IDs preserve existing KapsApp room URLs while each district has its own topology. */
export const MAPS: Record<MapId, MapDefinition> = {
  district:dustDistrict(),
  bolluca: bolluca(),
  district2: dust2Pdf(),
  bolluca2: bolluca2(),
  warehouse: townMap("warehouse"),
  dust: townMap("dust"),
  neon: townMap("neon"),
};

export const BOMB_MAPS = [MAPS.district, MAPS.bolluca, MAPS.district2, MAPS.bolluca2] as const;
