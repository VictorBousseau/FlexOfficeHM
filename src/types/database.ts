// Types partages — alignes sur le schema Supabase (supabase/migrations/*.sql)

export type DeskKind = 'individual' | 'openspace' | 'meeting_room';

export type Slot = 'morning' | 'afternoon';

export interface Desk {
  id: string;
  label: string;
  bureau_group: string;
  kind: DeskKind;
  display_order: number;
  /** Poste equipe d'un double ecran (0003_dual_screen.sql). */
  has_dual_screen: boolean;
}

export interface Booking {
  id: string;
  desk_id: string;
  /** Date metier au format ISO court `yyyy-MM-dd`. */
  date: string;
  slot: Slot;
  user_name: string;
  created_at: string;
  /**
   * Identifiant du lot quand la reservation fait partie d'une privatisation
   * de salle (toutes les places de la salle, meme creneau, meme lot).
   * `null` pour une reservation de place classique.
   */
  room_booking_id: string | null;
  /** Equipe / motif saisi lors d'une privatisation de salle. */
  team_label: string | null;
}

/**
 * Payload d'insertion d'une reservation (id + created_at generes par Postgres).
 * Les champs de privatisation de salle sont optionnels : une reservation de
 * place classique ne les renseigne pas.
 */
export type BookingInsert = Omit<
  Booking,
  'id' | 'created_at' | 'room_booking_id' | 'team_label'
> & {
  room_booking_id?: string | null;
  team_label?: string | null;
};

export type BookingEventType = 'booked' | 'cancelled';

/** Evenement journalise par le trigger Postgres sur `bookings`. */
export interface BookingEvent {
  id: string;
  event_type: BookingEventType;
  desk_id: string;
  date: string;
  slot: Slot;
  user_name: string;
  event_at: string;
  team_label: string | null;
}

/**
 * Evenement d'equipe rattache a une journee (anniversaire, competition de
 * cookie...). Purement informatif : ne bloque aucune place.
 */
export interface DayEvent {
  id: string;
  /** Date metier au format ISO court `yyyy-MM-dd`. */
  date: string;
  /** `null` = journee entiere. */
  slot: Slot | null;
  emoji: string | null;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export type DayEventInsert = Omit<DayEvent, 'id' | 'created_at'>;

export type DayEventLogType = 'event_created' | 'event_deleted';

/** Trace journalisee par le trigger Postgres sur `day_events`. */
export interface DayEventLog {
  id: string;
  log_type: DayEventLogType;
  day_event_id: string;
  date: string;
  slot: Slot | null;
  title: string;
  user_name: string;
  event_at: string;
}

/** Type Database au format attendu par `createClient<Database>()`. */
export interface Database {
  public: {
    Tables: {
      desks: {
        Row: Desk;
        Insert: Desk;
        Update: Partial<Desk>;
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert & { id?: string; created_at?: string };
        Update: Partial<Booking>;
        Relationships: [];
      };
      booking_events: {
        Row: BookingEvent;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      day_events: {
        Row: DayEvent;
        Insert: DayEventInsert & { id?: string; created_at?: string };
        Update: Partial<DayEvent>;
        Relationships: [];
      };
      day_event_logs: {
        Row: DayEventLog;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
