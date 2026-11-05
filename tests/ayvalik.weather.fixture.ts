export function weatherFixture(start = '2026-11-05', temp = 18) {
  const dates = Array.from({length:16}, (_,i) => new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
  const times = dates.flatMap(day => Array.from({length:24},(_,h)=>day+'T'+String(h).padStart(2,'0')+':00'));
  return {
    current: {time:start+'T12:00', temperature_2m:temp, apparent_temperature:17, relative_humidity_2m:72, wind_speed_10m:12, wind_direction_10m:270, wind_gusts_10m:22, weather_code:2, precipitation:0, cloud_cover:40, pressure_msl:1015},
    daily: {time:dates, weather_code:dates.map(()=>61), temperature_2m_max:dates.map(()=>20), temperature_2m_min:dates.map(()=>11), precipitation_probability_max:dates.map(()=>65), precipitation_sum:dates.map(()=>4.2), wind_speed_10m_max:dates.map(()=>25), wind_gusts_10m_max:dates.map(()=>40), uv_index_max:dates.map(()=>3), sunrise:dates.map(d=>d+'T07:40'), sunset:dates.map(d=>d+'T18:00')},
    hourly: {time:times, temperature_2m:times.map(()=>temp), apparent_temperature:times.map(()=>17), weather_code:times.map(()=>2), precipitation_probability:times.map(()=>30), precipitation:times.map(()=>0), wind_speed_10m:times.map(()=>12), relative_humidity_2m:times.map(()=>72)}
  };
}
