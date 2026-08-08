// Types shared across the app

export interface MapData {
  name: string;
  score1: string;
  score2: string;
  winner: number | null;
}

export interface PlayerStat {
  name: string;
  href: string;
  photo: string;
  agents: { name: string; icon: string }[];
  rating: string;
  acs: string;
  k: string;
  d: string;
  a: string;
  kd_diff: string;
  kast: string;
  adr: string;
  hs: string;
  fk: string;
  fd: string;
  fk_diff: string;
}

export interface MapPlayers {
  team1: PlayerStat[];
  team2: PlayerStat[];
}

export interface Match {
  _id: string;
  match_id: string;
  href: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score1: string;
  score2: string;
  tournament: string;
  series: string;
  tournament_logo?: string;
  eta?: string;
  status: string; // "Upcoming" | "Live" | "Completed"
  team1_logo?: string;
  team2_logo?: string;
  unix_timestamp?: number;
  bst_time?: string;
  maps?: MapData[];
  players?: Record<string, MapPlayers>; // "all" | "0" | "1" | ...
  last_updated?: number;
}

export interface TournamentOverview {
  tournament: string;
  tournament_logo: string;
  first_match: number;
  fully_loaded: boolean;
}

export interface IgnoreEntry {
  _id?: string;
  name: string;
  logo?: string;
}

export interface Settings {
  key?: string;
  unchecked_tournaments: string[];
  white_logo_teams: string[];
  tournament_colors: Record<string, string>;
  tournament_order: Record<string, number>;
  highlight_loaded_tournaments?: boolean;
  thr_show_all_tournaments?: boolean;
  scrape_start?: number;
  scrape_end?: number;
  per_page?: string;
  theme?: string;
}
