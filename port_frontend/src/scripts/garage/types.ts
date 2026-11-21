// Shapes of the data served by /api/garage and /work/photos.json.

export type Photo = { src: string; caption?: string };
/** photos.json: build id -> photos, plus _covers: build id -> cover image (photos/<id>/cover.jpg) */
export type Photos = Record<string, Photo[]> & { _covers?: Record<string, string> };

export type LogItem = { date: string; time?: string; note: string };

export type Build = {
  id: string; tag: string; color: string; scene: string; name: string;
  chassis?: string; status?: string; power?: string; log?: LogItem[];
  year?: string; torque?: string; hp?: number; torque_nm?: number; weight_kg?: number; // real factory figures
  estimate?: boolean; // figures are estimated, not measured
  review?: { title?: string; body: string[] }; // optional write-up shown under the specs
  sold?: boolean;  // shows a SOLD banner over the photos
  short?: string;  // shorter tag for the LED board (max ~7 chars)
};

export type Track = {
  id: string; name: string; alias?: string; kind?: string; location?: string;
  length_km?: number; turns?: number; status: 'active' | 'planned'; map?: string; color: string;
  note?: string; // shown on the PB board when there's no lap time yet
};

export type Telemetry = {
  lap_length_m: number; laps: number[]; sectors: (number | null)[][]; // LapTrophy sometimes leaves a sector blank
  best_lap: number; compare_lap: number;
  top_speed: number; trace_best: number[][]; trace_compare: number[][]; map_best: number[][];
};

export type Session = {
  track: string; date: string; vehicle?: string; best: string; notes?: string;
  laps?: number[]; telemetry?: Telemetry;
  uploaded?: boolean; // came in through the Telegram bot: can't be deleted from the page
};

export type TrackDay = { tracks: Track[]; sessions: Session[]; coach?: Record<string, string> }; // coach: track id -> latest advice

export type GarageData = { builds: Build[]; trackday?: TrackDay };
