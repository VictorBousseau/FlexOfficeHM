// Types partages — alignes sur le schema Supabase (supabase/migrations/0001_init.sql)

export type DeskKind = 'individual' | 'openspace' | 'meeting_room';

export type Slot = 'morning' | 'afternoon';

export interface Desk {
  id: string;
  label: string;
  bureau_group: string;
  kind: DeskKind;
  display_order: number;
}

export interface Booking {
  id: string;
  desk_id: string;
  /** Date metier au format ISO court `yyyy-MM-dd`. */
  date: string;
  slot: Slot;
  user_name: string;
  created_at: string;
}

/** Payload d'insertion d'une reservation (id + created_at generes par Postgres). */
export type BookingInsert = Omit<Booking, 'id' | 'created_at'>;

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
