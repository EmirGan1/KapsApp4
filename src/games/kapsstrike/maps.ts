import { bolluca } from "./bolluca";
import {dustDistrict} from "./dustDistrict";
import type { MapDefinition, MapId } from "./types";
import { townMap } from "./townMaps";

/** Stable IDs preserve existing KapsApp room URLs while each district has its own topology. */
export const MAPS: Record<MapId, MapDefinition> = {
  district:dustDistrict(),
  bolluca: bolluca(),
  warehouse: townMap("warehouse"),
  dust: townMap("dust"),
  neon: townMap("neon"),
};

export const BOMB_MAPS = [MAPS.district, MAPS.bolluca] as const;
