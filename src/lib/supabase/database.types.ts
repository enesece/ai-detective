// Generated from the Supabase schema (supabase/migrations). Do not edit by hand:
// regenerate after every migration. Unused helper types were left out.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      case_reviews: {
        Row: {
          admin_notes: string | null;
          case_id: string;
          checks: Json;
          created_at: string;
          decision: string;
          id: string;
        };
        Insert: {
          admin_notes?: string | null;
          case_id: string;
          checks?: Json;
          created_at?: string;
          decision?: string;
          id?: string;
        };
        Update: {
          admin_notes?: string | null;
          case_id?: string;
          checks?: Json;
          created_at?: string;
          decision?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_reviews_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          case_number: number;
          created_at: string;
          difficulty: string;
          id: string;
          public_briefing: Json;
          secret: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          case_number: number;
          created_at?: string;
          difficulty: string;
          id?: string;
          public_briefing: Json;
          secret: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          case_number?: number;
          created_at?: string;
          difficulty?: string;
          id?: string;
          public_briefing?: Json;
          secret?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_schedule: {
        Row: {
          case_id: string;
          created_at: string;
          publish_date: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          publish_date: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          publish_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_schedule_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: true;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          accusation: Json | null;
          busy_until: string | null;
          case_id: string;
          created_at: string;
          finished_at: string | null;
          hints_used: number;
          id: string;
          player_id: string;
          questions_used: number;
          result: Json | null;
          score: number | null;
          status: string;
        };
        Insert: {
          accusation?: Json | null;
          busy_until?: string | null;
          case_id: string;
          created_at?: string;
          finished_at?: string | null;
          hints_used?: number;
          id?: string;
          player_id: string;
          questions_used?: number;
          result?: Json | null;
          score?: number | null;
          status?: string;
        };
        Update: {
          accusation?: Json | null;
          busy_until?: string | null;
          case_id?: string;
          created_at?: string;
          finished_at?: string | null;
          hints_used?: number;
          id?: string;
          player_id?: string;
          questions_used?: number;
          result?: Json | null;
          score?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          answer: string;
          created_at: string;
          game_id: string;
          id: number;
          locale: string;
          question: string;
          suspect_id: string;
        };
        Insert: {
          answer: string;
          created_at?: string;
          game_id: string;
          id?: never;
          locale: string;
          question: string;
          suspect_id: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          game_id?: string;
          id?: never;
          locale?: string;
          question?: string;
          suspect_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          case_number: number;
          pins: Json;
          player_id: string;
          text: string;
          updated_at: string;
        };
        Insert: {
          case_number: number;
          pins?: Json;
          player_id?: string;
          text?: string;
          updated_at?: string;
        };
        Update: {
          case_number?: number;
          pins?: Json;
          player_id?: string;
          text?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_case_number_fkey";
            columns: ["case_number"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["case_number"];
          },
        ];
      };
      profiles: {
        Row: {
          best_streak: number;
          created_at: string;
          id: string;
          language: string;
          last_solved_date: string | null;
          streak: number;
          username: string | null;
        };
        Insert: {
          best_streak?: number;
          created_at?: string;
          id: string;
          language?: string;
          last_solved_date?: string | null;
          streak?: number;
          username?: string | null;
        };
        Update: {
          best_streak?: number;
          created_at?: string;
          id?: string;
          language?: string;
          last_solved_date?: string | null;
          streak?: number;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_question: {
        Args: {
          p_answer: string;
          p_game_id: string;
          p_locale: string;
          p_question: string;
          p_suspect_id: string;
        };
        Returns: undefined;
      };
      finish_game: {
        Args: {
          p_accusation: Json;
          p_expected_hints: number;
          p_expected_questions: number;
          p_game_id: string;
          p_result: Json;
          p_score: number;
          p_solved: boolean;
        };
        Returns: string;
      };
      refund_question: { Args: { p_game_id: string }; Returns: undefined };
      reserve_question: {
        Args: { p_game_id: string; p_limit: number };
        Returns: {
          error: string;
          used: number;
        }[];
      };
      reveal_hint: {
        Args: { p_available: number; p_game_id: string };
        Returns: {
          error: string;
          used: number;
        }[];
      };
      start_game: {
        Args: { p_case_number: number; p_player_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
