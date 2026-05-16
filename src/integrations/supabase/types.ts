export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          timezone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          timezone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          timezone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string
          created_at: string
          description: string | null
          gif_url: string | null
          id: string
          is_timed: boolean
          lp_reward: number
          name: string
          skill_endurance: number
          skill_mobility: number
          skill_strength: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          gif_url?: string | null
          id?: string
          is_timed?: boolean
          lp_reward?: number
          name: string
          skill_endurance?: number
          skill_mobility?: number
          skill_strength?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          gif_url?: string | null
          id?: string
          is_timed?: boolean
          lp_reward?: number
          name?: string
          skill_endurance?: number
          skill_mobility?: number
          skill_strength?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string
          created_at: string
          current_streak: number
          daily_lp: number
          email: string | null
          endurance: number
          first_session_at: string | null
          id: string
          last_count_reset: string | null
          last_lp_reset: string | null
          last_training_date: string | null
          longest_streak: number
          lp: number
          mobility: number
          nickname: string
          no_proof_count: number
          preferred_location: string | null
          strength: number
          timezone: string | null
          total_exercises_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string
          created_at?: string
          current_streak?: number
          daily_lp?: number
          email?: string | null
          endurance?: number
          first_session_at?: string | null
          id: string
          last_count_reset?: string | null
          last_lp_reset?: string | null
          last_training_date?: string | null
          longest_streak?: number
          lp?: number
          mobility?: number
          nickname: string
          no_proof_count?: number
          preferred_location?: string | null
          strength?: number
          timezone?: string | null
          total_exercises_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string
          created_at?: string
          current_streak?: number
          daily_lp?: number
          email?: string | null
          endurance?: number
          first_session_at?: string | null
          id?: string
          last_count_reset?: string | null
          last_lp_reset?: string | null
          last_training_date?: string | null
          longest_streak?: number
          lp?: number
          mobility?: number
          nickname?: string
          no_proof_count?: number
          preferred_location?: string | null
          strength?: number
          timezone?: string | null
          total_exercises_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      share_events: {
        Row: {
          id: string
          platform: string | null
          share_type: string
          shared_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string | null
          share_type: string
          shared_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string | null
          share_type?: string
          shared_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shop_visits: {
        Row: {
          id: string
          made_purchase: boolean
          purchase_amount: number | null
          source: string | null
          user_id: string
          visited_at: string
        }
        Insert: {
          id?: string
          made_purchase?: boolean
          purchase_amount?: number | null
          source?: string | null
          user_id: string
          visited_at?: string
        }
        Update: {
          id?: string
          made_purchase?: boolean
          purchase_amount?: number | null
          source?: string | null
          user_id?: string
          visited_at?: string
        }
        Relationships: []
      }
      suspicion_flags: {
        Row: {
          average_tempo: number | null
          axis_distribution: Json | null
          created_at: string | null
          exercise_name: string | null
          id: string
          micro_movements: boolean | null
          no_orientation_change: boolean | null
          orientation_change: number | null
          session_id: string | null
          single_axis_motion: boolean | null
          suspicion_score: number | null
          total_reps: number | null
          unrealistic_speed: boolean | null
          user_id: string
          volume_spike: boolean | null
        }
        Insert: {
          average_tempo?: number | null
          axis_distribution?: Json | null
          created_at?: string | null
          exercise_name?: string | null
          id?: string
          micro_movements?: boolean | null
          no_orientation_change?: boolean | null
          orientation_change?: number | null
          session_id?: string | null
          single_axis_motion?: boolean | null
          suspicion_score?: number | null
          total_reps?: number | null
          unrealistic_speed?: boolean | null
          user_id: string
          volume_spike?: boolean | null
        }
        Update: {
          average_tempo?: number | null
          axis_distribution?: Json | null
          created_at?: string | null
          exercise_name?: string | null
          id?: string
          micro_movements?: boolean | null
          no_orientation_change?: boolean | null
          orientation_change?: number | null
          session_id?: string | null
          single_axis_motion?: boolean | null
          suspicion_score?: number | null
          total_reps?: number | null
          unrealistic_speed?: boolean | null
          user_id?: string
          volume_spike?: boolean | null
        }
        Relationships: []
      }
      training_logs: {
        Row: {
          completed_at: string
          exercise_id: string
          id: string
          lp_earned: number
          proof_type: string | null
          proof_url: string | null
          reps_completed: number | null
          session_duration_seconds: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          exercise_id: string
          id?: string
          lp_earned: number
          proof_type?: string | null
          proof_url?: string | null
          reps_completed?: number | null
          session_duration_seconds?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string
          exercise_id?: string
          id?: string
          lp_earned?: number
          proof_type?: string | null
          proof_url?: string | null
          reps_completed?: number | null
          session_duration_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          completed_at: string | null
          exercise_name: string
          id: string
          location: string | null
          lp_earned: number | null
          reps_achieved: number | null
          session_duration_seconds: number | null
          started_at: string
          timezone: string | null
          user_id: string
          was_completed: boolean
        }
        Insert: {
          completed_at?: string | null
          exercise_name: string
          id?: string
          location?: string | null
          lp_earned?: number | null
          reps_achieved?: number | null
          session_duration_seconds?: number | null
          started_at?: string
          timezone?: string | null
          user_id: string
          was_completed?: boolean
        }
        Update: {
          completed_at?: string | null
          exercise_name?: string
          id?: string
          location?: string | null
          lp_earned?: number | null
          reps_achieved?: number | null
          session_duration_seconds?: number | null
          started_at?: string
          timezone?: string | null
          user_id?: string
          was_completed?: boolean
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          device_type: string | null
          id: string
          screen_name: string | null
          screen_resolution: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          device_type?: string | null
          id?: string
          screen_name?: string | null
          screen_resolution?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          device_type?: string | null
          id?: string
          screen_name?: string | null
          screen_resolution?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          current_streak: number | null
          daily_lp: number | null
          endurance: number | null
          id: string | null
          longest_streak: number | null
          lp: number | null
          mobility: number | null
          nickname: string | null
          preferred_location: string | null
          strength: number | null
          timezone: string | null
          total_exercises_count: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          current_streak?: number | null
          daily_lp?: number | null
          endurance?: number | null
          id?: string | null
          longest_streak?: number | null
          lp?: number | null
          mobility?: number | null
          nickname?: string | null
          preferred_location?: string | null
          strength?: number | null
          timezone?: string | null
          total_exercises_count?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          current_streak?: number | null
          daily_lp?: number | null
          endurance?: number | null
          id?: string | null
          longest_streak?: number | null
          lp?: number | null
          mobility?: number | null
          nickname?: string | null
          preferred_location?: string | null
          strength?: number | null
          timezone?: string | null
          total_exercises_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
