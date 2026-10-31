import {dustDistrict} from "./dustDistrict";
import type { MapDefinition, MapId } from "./types";
import { townMap } from "./townMaps";

/** Stable IDs preserve existing KapsApp room URLs while each district has its own topology. */
export const MAPS: Record<MapId, MapDefinition> = {
  district:dustDistrict(),
  warehouse: townMap("warehouse"),
  dust: townMap("dust"),
  neon: townMap("neon"),
};
