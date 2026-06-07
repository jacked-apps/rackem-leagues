export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          level: string
          message: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          level: string
          message: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      archived_placeholders: {
        Row: {
          actor_member_id: string
          actor_role: string
          created_at: string
          expires_at: string
          id: string
          member_snapshot: Json
          organization_id: string
          placeholder_member_id: string
          target_member_id: string
          transferred_rows: Json
          undone_at: string | null
        }
        Insert: {
          actor_member_id: string
          actor_role: string
          created_at?: string
          expires_at?: string
          id?: string
          member_snapshot: Json
          organization_id: string
          placeholder_member_id: string
          target_member_id: string
          transferred_rows: Json
          undone_at?: string | null
        }
        Update: {
          actor_member_id?: string
          actor_role?: string
          created_at?: string
          expires_at?: string
          id?: string
          member_snapshot?: Json
          organization_id?: string
          placeholder_member_id?: string
          target_member_id?: string
          transferred_rows?: Json
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_placeholders_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_placeholders_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_id: string
          blocker_id: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_id: string
          blocker_id: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_id?: string
          blocker_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_date_options: {
        Row: {
          created_at: string | null
          dev_verified: boolean
          end_date: string
          id: string
          organization: string
          start_date: string
          updated_at: string | null
          vote_count: number
          year: number
        }
        Insert: {
          created_at?: string | null
          dev_verified?: boolean
          end_date: string
          id?: string
          organization: string
          start_date: string
          updated_at?: string | null
          vote_count?: number
          year: number
        }
        Update: {
          created_at?: string | null
          dev_verified?: boolean
          end_date?: string
          id?: string
          organization?: string
          start_date?: string
          updated_at?: string | null
          vote_count?: number
          year?: number
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          cannot_leave: boolean
          conversation_id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          left_at: string | null
          notification_mode: string
          notifications_enabled: boolean
          role: string
          unread_count: number
          user_id: string
        }
        Insert: {
          cannot_leave?: boolean
          conversation_id: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          notification_mode?: string
          notifications_enabled?: boolean
          role?: string
          unread_count?: number
          user_id: string
        }
        Update: {
          cannot_leave?: boolean
          conversation_id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          left_at?: string | null
          notification_mode?: string
          notifications_enabled?: boolean
          role?: string
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          auto_managed: boolean
          conversation_type: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          scope_id: string | null
          scope_type: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          auto_managed?: boolean
          conversation_type?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          scope_id?: string | null
          scope_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          auto_managed?: boolean
          conversation_type?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          scope_id?: string | null
          scope_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      game_confirmations: {
        Row: {
          action: string
          auto_confirmed: boolean
          break_and_run: boolean
          break_fouled: boolean
          confirmer_id: string
          created_at: string
          game_id: string
          game_number: number
          golden_break: boolean
          id: string
          is_initiator: boolean
          loser_value: number | null
          match_id: string
          reason: string | null
          runout: boolean
          side: string
          win_by_forfeit: boolean
          winner_player_id: string | null
          winner_team_id: string | null
          winner_value: number | null
        }
        Insert: {
          action?: string
          auto_confirmed?: boolean
          break_and_run?: boolean
          break_fouled?: boolean
          confirmer_id: string
          created_at?: string
          game_id: string
          game_number: number
          golden_break?: boolean
          id?: string
          is_initiator?: boolean
          loser_value?: number | null
          match_id: string
          reason?: string | null
          runout?: boolean
          side: string
          win_by_forfeit?: boolean
          winner_player_id?: string | null
          winner_team_id?: string | null
          winner_value?: number | null
        }
        Update: {
          action?: string
          auto_confirmed?: boolean
          break_and_run?: boolean
          break_fouled?: boolean
          confirmer_id?: string
          created_at?: string
          game_id?: string
          game_number?: number
          golden_break?: boolean
          id?: string
          is_initiator?: boolean
          loser_value?: number | null
          match_id?: string
          reason?: string | null
          runout?: boolean
          side?: string
          win_by_forfeit?: boolean
          winner_player_id?: string | null
          winner_team_id?: string | null
          winner_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_confirmations_confirmer_id_fkey"
            columns: ["confirmer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_confirmations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "match_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_confirmations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      handicap_chart_3vs3: {
        Row: {
          games_to_lose: number
          games_to_tie: number | null
          games_to_win: number
          hcp_diff: number
        }
        Insert: {
          games_to_lose: number
          games_to_tie?: number | null
          games_to_win: number
          hcp_diff: number
        }
        Update: {
          games_to_lose?: number
          games_to_tie?: number | null
          games_to_win?: number
          hcp_diff?: number
        }
        Relationships: []
      }
      house_rules: {
        Row: {
          body: string[]
          created_at: string
          effect_type: string
          game: string
          id: string
          league_id: string | null
          organization_id: string | null
          related_rule_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string[]
          created_at?: string
          effect_type: string
          game: string
          id?: string
          league_id?: string | null
          organization_id?: string | null
          related_rule_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string[]
          created_at?: string
          effect_type?: string
          game?: string
          id?: string
          league_id?: string | null
          organization_id?: string | null
          related_rule_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "house_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_playoff_config"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "house_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_preferences"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "house_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_member_id: string | null
          member_id: string | null
          status: string
          team_id: string | null
          token: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_member_id?: string | null
          member_id?: string | null
          status?: string
          team_id?: string | null
          token?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_member_id?: string | null
          member_id?: string | null
          status?: string
          team_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_invited_by_member_id_fkey"
            columns: ["invited_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_finance_settings: {
        Row: {
          created_at: string
          custom_payout_percentages: number[] | null
          green_fee_per_player_per_night: number | null
          league_id: string
          lo_cut_flat_per_week: number | null
          lo_cut_kind: string | null
          lo_cut_percent: number | null
          payout_places_paid: number | null
          payout_rounding_target: number | null
          payout_shape: string | null
          price_per_player_per_night: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_payout_percentages?: number[] | null
          green_fee_per_player_per_night?: number | null
          league_id: string
          lo_cut_flat_per_week?: number | null
          lo_cut_kind?: string | null
          lo_cut_percent?: number | null
          payout_places_paid?: number | null
          payout_rounding_target?: number | null
          payout_shape?: string | null
          price_per_player_per_night?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_payout_percentages?: number[] | null
          green_fee_per_player_per_night?: number | null
          league_id?: string
          lo_cut_flat_per_week?: number | null
          lo_cut_kind?: string | null
          lo_cut_percent?: number | null
          payout_places_paid?: number | null
          payout_rounding_target?: number | null
          payout_shape?: string | null
          price_per_player_per_night?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_finance_settings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_finance_settings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "resolved_league_playoff_config"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "league_finance_settings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: true
            referencedRelation: "resolved_league_preferences"
            referencedColumns: ["league_id"]
          },
        ]
      }
      league_venues: {
        Row: {
          added_at: string | null
          available_bar_box_tables: number | null
          available_regulation_tables: number | null
          available_table_numbers: number[] | null
          available_total_tables: number | null
          capacity: number | null
          id: string
          league_id: string
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          added_at?: string | null
          available_bar_box_tables?: number | null
          available_regulation_tables?: number | null
          available_table_numbers?: number[] | null
          available_total_tables?: number | null
          capacity?: number | null
          id?: string
          league_id: string
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          added_at?: string | null
          available_bar_box_tables?: number | null
          available_regulation_tables?: number | null
          available_table_numbers?: number[] | null
          available_total_tables?: number | null
          capacity?: number | null
          id?: string
          league_id?: string
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_venues_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_venues_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_playoff_config"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "league_venues_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_preferences"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "league_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string | null
          day_of_week: string
          division: string | null
          game_type: string
          golden_break_counts_as_win: boolean
          handicap_level: string
          handicap_variant: string
          id: string
          ignore_org_house_rules: boolean
          league_start_date: string
          organization_id: string
          status: string
          system_overrides: Json
          team_handicap_variant: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: string
          division?: string | null
          game_type: string
          golden_break_counts_as_win?: boolean
          handicap_level?: string
          handicap_variant?: string
          id?: string
          ignore_org_house_rules?: boolean
          league_start_date: string
          organization_id: string
          status?: string
          system_overrides?: Json
          team_handicap_variant?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: string
          division?: string | null
          game_type?: string
          golden_break_counts_as_win?: boolean
          handicap_level?: string
          handicap_variant?: string
          id?: string
          ignore_org_house_rules?: boolean
          league_start_date?: string
          organization_id?: string
          status?: string
          system_overrides?: Json
          team_handicap_variant?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leagues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_games: {
        Row: {
          away_action: string
          away_player_id: string | null
          away_position: number | null
          break_and_run: boolean
          break_fouled: boolean
          confirmed_at: string | null
          confirmed_by_away: string | null
          confirmed_by_home: string | null
          created_at: string
          game_number: number
          game_type: string
          golden_break: boolean
          home_action: string
          home_player_id: string | null
          home_position: number | null
          id: string
          is_tiebreaker: boolean
          loser_value: number | null
          match_id: string
          runout: boolean
          updated_at: string
          vacate_requested_by: string | null
          win_by_forfeit: boolean
          winner_player_id: string | null
          winner_team_id: string | null
          winner_value: number | null
        }
        Insert: {
          away_action: string
          away_player_id?: string | null
          away_position?: number | null
          break_and_run?: boolean
          break_fouled?: boolean
          confirmed_at?: string | null
          confirmed_by_away?: string | null
          confirmed_by_home?: string | null
          created_at?: string
          game_number: number
          game_type: string
          golden_break?: boolean
          home_action: string
          home_player_id?: string | null
          home_position?: number | null
          id?: string
          is_tiebreaker?: boolean
          loser_value?: number | null
          match_id: string
          runout?: boolean
          updated_at?: string
          vacate_requested_by?: string | null
          win_by_forfeit?: boolean
          winner_player_id?: string | null
          winner_team_id?: string | null
          winner_value?: number | null
        }
        Update: {
          away_action?: string
          away_player_id?: string | null
          away_position?: number | null
          break_and_run?: boolean
          break_fouled?: boolean
          confirmed_at?: string | null
          confirmed_by_away?: string | null
          confirmed_by_home?: string | null
          created_at?: string
          game_number?: number
          game_type?: string
          golden_break?: boolean
          home_action?: string
          home_player_id?: string | null
          home_position?: number | null
          id?: string
          is_tiebreaker?: boolean
          loser_value?: number | null
          match_id?: string
          runout?: boolean
          updated_at?: string
          vacate_requested_by?: string | null
          win_by_forfeit?: boolean
          winner_player_id?: string | null
          winner_team_id?: string | null
          winner_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_games_confirmed_by_away_member_fkey"
            columns: ["confirmed_by_away"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_confirmed_by_home_member_fkey"
            columns: ["confirmed_by_home"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          home_team_modifier: number
          id: string
          locked: boolean
          locked_at: string | null
          match_id: string
          player1_handicap: number
          player1_id: string | null
          player2_handicap: number
          player2_id: string | null
          player3_handicap: number
          player3_id: string | null
          player4_handicap: number | null
          player4_id: string | null
          player5_handicap: number | null
          player5_id: string | null
          swap_new_player_handicap: number | null
          swap_new_player_id: string | null
          swap_position: number | null
          swap_requested_at: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          home_team_modifier?: number
          id?: string
          locked?: boolean
          locked_at?: string | null
          match_id: string
          player1_handicap: number
          player1_id?: string | null
          player2_handicap: number
          player2_id?: string | null
          player3_handicap: number
          player3_id?: string | null
          player4_handicap?: number | null
          player4_id?: string | null
          player5_handicap?: number | null
          player5_id?: string | null
          swap_new_player_handicap?: number | null
          swap_new_player_id?: string | null
          swap_position?: number | null
          swap_requested_at?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          home_team_modifier?: number
          id?: string
          locked?: boolean
          locked_at?: string | null
          match_id?: string
          player1_handicap?: number
          player1_id?: string | null
          player2_handicap?: number
          player2_id?: string | null
          player3_handicap?: number
          player3_id?: string | null
          player4_handicap?: number | null
          player4_id?: string | null
          player5_handicap?: number | null
          player5_id?: string | null
          swap_new_player_handicap?: number | null
          swap_new_player_id?: string | null
          swap_position?: number | null
          swap_requested_at?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player5_id_fkey"
            columns: ["player5_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_swap_new_player_id_fkey"
            columns: ["swap_new_player_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          actual_venue_id: string | null
          assigned_table_number: number | null
          away_games_won: number
          away_lineup_id: string | null
          away_points_earned: number
          away_team_id: string | null
          away_team_verified_by: string | null
          away_tiebreaker_verified_by: string | null
          away_to_lose: number | null
          away_to_tie: number | null
          away_to_win: number | null
          completed_at: string | null
          created_at: string
          home_games_won: number
          home_lineup_id: string | null
          home_points_earned: number
          home_team_id: string | null
          home_team_verified_by: string | null
          home_tiebreaker_verified_by: string | null
          home_to_lose: number | null
          home_to_tie: number | null
          home_to_win: number | null
          id: string
          match_number: number
          match_result: string | null
          results_confirmed_by_away: boolean
          results_confirmed_by_home: boolean
          scheduled_venue_id: string | null
          season_id: string
          season_week_id: string
          started_at: string | null
          status: string
          system_snapshot: Json | null
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          actual_venue_id?: string | null
          assigned_table_number?: number | null
          away_games_won?: number
          away_lineup_id?: string | null
          away_points_earned?: number
          away_team_id?: string | null
          away_team_verified_by?: string | null
          away_tiebreaker_verified_by?: string | null
          away_to_lose?: number | null
          away_to_tie?: number | null
          away_to_win?: number | null
          completed_at?: string | null
          created_at?: string
          home_games_won?: number
          home_lineup_id?: string | null
          home_points_earned?: number
          home_team_id?: string | null
          home_team_verified_by?: string | null
          home_tiebreaker_verified_by?: string | null
          home_to_lose?: number | null
          home_to_tie?: number | null
          home_to_win?: number | null
          id?: string
          match_number: number
          match_result?: string | null
          results_confirmed_by_away?: boolean
          results_confirmed_by_home?: boolean
          scheduled_venue_id?: string | null
          season_id: string
          season_week_id: string
          started_at?: string | null
          status?: string
          system_snapshot?: Json | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          actual_venue_id?: string | null
          assigned_table_number?: number | null
          away_games_won?: number
          away_lineup_id?: string | null
          away_points_earned?: number
          away_team_id?: string | null
          away_team_verified_by?: string | null
          away_tiebreaker_verified_by?: string | null
          away_to_lose?: number | null
          away_to_tie?: number | null
          away_to_win?: number | null
          completed_at?: string | null
          created_at?: string
          home_games_won?: number
          home_lineup_id?: string | null
          home_points_earned?: number
          home_team_id?: string | null
          home_team_verified_by?: string | null
          home_tiebreaker_verified_by?: string | null
          home_to_lose?: number | null
          home_to_tie?: number | null
          home_to_win?: number | null
          id?: string
          match_number?: number
          match_result?: string | null
          results_confirmed_by_away?: boolean
          results_confirmed_by_home?: boolean
          scheduled_venue_id?: string | null
          season_id?: string
          season_week_id?: string
          started_at?: string | null
          status?: string
          system_snapshot?: Json | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_actual_venue_id_fkey"
            columns: ["actual_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_lineup_id_fkey"
            columns: ["away_lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_verified_by_fkey"
            columns: ["away_team_verified_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_tiebreaker_verified_by_fkey"
            columns: ["away_tiebreaker_verified_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_lineup_id_fkey"
            columns: ["home_lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_verified_by_fkey"
            columns: ["home_team_verified_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_tiebreaker_verified_by_fkey"
            columns: ["home_tiebreaker_verified_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_scheduled_venue_id_fkey"
            columns: ["scheduled_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_week_id_fkey"
            columns: ["season_week_id"]
            isOneToOne: false
            referencedRelation: "season_weeks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          archived_at: string | null
          bca_member_number: string | null
          city: string
          created_at: string | null
          created_by_member_id: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          fargo_rating: number | null
          first_name: string
          id: string
          last_name: string
          membership_paid_date: string | null
          nickname: string | null
          organization_id: string | null
          phone: string | null
          profanity_filter_enabled: boolean | null
          profanity_onboarding_completed_at: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          starting_handicap_3v3: number | null
          starting_handicap_5v5: number | null
          state: string
          system_player_number: number
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          bca_member_number?: string | null
          city: string
          created_at?: string | null
          created_by_member_id?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          fargo_rating?: number | null
          first_name: string
          id?: string
          last_name: string
          membership_paid_date?: string | null
          nickname?: string | null
          organization_id?: string | null
          phone?: string | null
          profanity_filter_enabled?: boolean | null
          profanity_onboarding_completed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          starting_handicap_3v3?: number | null
          starting_handicap_5v5?: number | null
          state: string
          system_player_number?: number
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          bca_member_number?: string | null
          city?: string
          created_at?: string | null
          created_by_member_id?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          fargo_rating?: number | null
          first_name?: string
          id?: string
          last_name?: string
          membership_paid_date?: string | null
          nickname?: string | null
          organization_id?: string | null
          phone?: string | null
          profanity_filter_enabled?: boolean | null
          profanity_onboarding_completed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          starting_handicap_3v3?: number | null
          starting_handicap_5v5?: number | null
          state?: string
          system_player_number?: number
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_edited: boolean
          is_system: boolean
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          is_system?: boolean
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_edited?: boolean
          is_system?: boolean
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_blackout_preferences: {
        Row: {
          auto_apply: boolean
          championship_id: string | null
          created_at: string | null
          custom_end_date: string | null
          custom_name: string | null
          custom_start_date: string | null
          holiday_name: string | null
          id: string
          organization_id: string
          preference_action: Database["public"]["Enums"]["preference_action"]
          preference_type: Database["public"]["Enums"]["preference_type"]
          updated_at: string | null
        }
        Insert: {
          auto_apply?: boolean
          championship_id?: string | null
          created_at?: string | null
          custom_end_date?: string | null
          custom_name?: string | null
          custom_start_date?: string | null
          holiday_name?: string | null
          id?: string
          organization_id: string
          preference_action: Database["public"]["Enums"]["preference_action"]
          preference_type: Database["public"]["Enums"]["preference_type"]
          updated_at?: string | null
        }
        Update: {
          auto_apply?: boolean
          championship_id?: string | null
          created_at?: string | null
          custom_end_date?: string | null
          custom_name?: string | null
          custom_start_date?: string | null
          holiday_name?: string | null
          id?: string
          organization_id?: string
          preference_action?: Database["public"]["Enums"]["preference_action"]
          preference_type?: Database["public"]["Enums"]["preference_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_blackout_preferences_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championship_date_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_blackout_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_finance_defaults: {
        Row: {
          created_at: string
          green_fee_per_player_per_night: number
          lo_cut_flat_per_week: number
          lo_cut_kind: string
          lo_cut_percent: number
          organization_id: string
          payout_places_paid: number
          payout_rounding_target: number
          payout_shape: string
          price_per_player_per_night: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          green_fee_per_player_per_night?: number
          lo_cut_flat_per_week?: number
          lo_cut_kind?: string
          lo_cut_percent?: number
          organization_id: string
          payout_places_paid?: number
          payout_rounding_target?: number
          payout_shape?: string
          price_per_player_per_night?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          green_fee_per_player_per_night?: number
          lo_cut_flat_per_week?: number
          lo_cut_kind?: string
          lo_cut_percent?: number
          organization_id?: string
          payout_places_paid?: number
          payout_rounding_target?: number
          payout_shape?: string
          price_per_player_per_night?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_finance_defaults_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_staff: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          member_id: string
          organization_id: string
          position: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          member_id: string
          organization_id: string
          position: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          member_id?: string
          organization_id?: string
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_staff_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_staff_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_zip: string
          card_brand: string
          card_last4: string
          created_at: string | null
          created_by: string
          expiry_month: number
          expiry_year: number
          id: string
          organization_address: string
          organization_city: string
          organization_email: string
          organization_email_visibility: string
          organization_name: string
          organization_phone: string
          organization_phone_visibility: string
          organization_state: string
          organization_zip_code: string
          payment_method_id: string
          payment_verified: boolean
          profanity_filter_enabled: boolean
          stripe_customer_id: string
          updated_at: string | null
        }
        Insert: {
          billing_zip: string
          card_brand: string
          card_last4: string
          created_at?: string | null
          created_by: string
          expiry_month: number
          expiry_year: number
          id?: string
          organization_address: string
          organization_city: string
          organization_email: string
          organization_email_visibility?: string
          organization_name: string
          organization_phone: string
          organization_phone_visibility?: string
          organization_state: string
          organization_zip_code: string
          payment_method_id: string
          payment_verified?: boolean
          profanity_filter_enabled?: boolean
          stripe_customer_id: string
          updated_at?: string | null
        }
        Update: {
          billing_zip?: string
          card_brand?: string
          card_last4?: string
          created_at?: string | null
          created_by?: string
          expiry_month?: number
          expiry_year?: number
          id?: string
          organization_address?: string
          organization_city?: string
          organization_email?: string
          organization_email_visibility?: string
          organization_name?: string
          organization_phone?: string
          organization_phone_visibility?: string
          organization_state?: string
          organization_zip_code?: string
          payment_method_id?: string
          payment_verified?: boolean
          profanity_filter_enabled?: boolean
          stripe_customer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      placeholder_audit_log: {
        Row: {
          action: string
          actor_member_id: string
          affected_tables: Json | null
          archive_id: string | null
          created_at: string
          id: string
          organization_id: string
          placeholder_member_id: string | null
          target_member_id: string | null
        }
        Insert: {
          action: string
          actor_member_id: string
          affected_tables?: Json | null
          archive_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          placeholder_member_id?: string | null
          target_member_id?: string | null
        }
        Update: {
          action?: string
          actor_member_id?: string
          affected_tables?: Json | null
          archive_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          placeholder_member_id?: string | null
          target_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placeholder_audit_log_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placeholder_audit_log_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "archived_placeholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placeholder_audit_log_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      playoff_configurations: {
        Row: {
          auto_generate: boolean
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          fixed_team_count: number | null
          id: string
          is_default: boolean | null
          name: string
          payment_method: string
          percentage_max: number | null
          percentage_min: number | null
          playoff_weeks: number
          qualification_type: string
          qualifying_percentage: number | null
          updated_at: string
          week_matchup_styles: string[]
          wildcard_spots: number
        }
        Insert: {
          auto_generate?: boolean
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          fixed_team_count?: number | null
          id?: string
          is_default?: boolean | null
          name: string
          payment_method?: string
          percentage_max?: number | null
          percentage_min?: number | null
          playoff_weeks?: number
          qualification_type?: string
          qualifying_percentage?: number | null
          updated_at?: string
          week_matchup_styles?: string[]
          wildcard_spots?: number
        }
        Update: {
          auto_generate?: boolean
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          fixed_team_count?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          payment_method?: string
          percentage_max?: number | null
          percentage_min?: number | null
          playoff_weeks?: number
          qualification_type?: string
          qualifying_percentage?: number | null
          updated_at?: string
          week_matchup_styles?: string[]
          wildcard_spots?: number
        }
        Relationships: []
      }
      preferences: {
        Row: {
          allow_unauthorized_players: boolean | null
          created_at: string | null
          entity_id: string
          entity_type: string
          game_generation: string | null
          game_history_limit: number | null
          golden_break_counts_as_win: boolean | null
          handicap_type: string | null
          handicap_variant: string | null
          id: string
          lineup_size: number | null
          max_roster_size: number | null
          mechanism: string | null
          pairing_format: string | null
          points_calculator: string
          points_calculator_params: Json
          points_system: string | null
          profanity_filter_enabled: boolean | null
          race_length: number | null
          standings_sort: string[] | null
          team_handicap_variant: string | null
          threshold_chart_id: string | null
          tiebreaker_format: string | null
          tiebreaker_trigger: string | null
          updated_at: string | null
          win_condition: string | null
        }
        Insert: {
          allow_unauthorized_players?: boolean | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          game_generation?: string | null
          game_history_limit?: number | null
          golden_break_counts_as_win?: boolean | null
          handicap_type?: string | null
          handicap_variant?: string | null
          id?: string
          lineup_size?: number | null
          max_roster_size?: number | null
          mechanism?: string | null
          pairing_format?: string | null
          points_calculator?: string
          points_calculator_params?: Json
          points_system?: string | null
          profanity_filter_enabled?: boolean | null
          race_length?: number | null
          standings_sort?: string[] | null
          team_handicap_variant?: string | null
          threshold_chart_id?: string | null
          tiebreaker_format?: string | null
          tiebreaker_trigger?: string | null
          updated_at?: string | null
          win_condition?: string | null
        }
        Update: {
          allow_unauthorized_players?: boolean | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          game_generation?: string | null
          game_history_limit?: number | null
          golden_break_counts_as_win?: boolean | null
          handicap_type?: string | null
          handicap_variant?: string | null
          id?: string
          lineup_size?: number | null
          max_roster_size?: number | null
          mechanism?: string | null
          pairing_format?: string | null
          points_calculator?: string
          points_calculator_params?: Json
          points_system?: string | null
          profanity_filter_enabled?: boolean | null
          race_length?: number | null
          standings_sort?: string[] | null
          team_handicap_variant?: string | null
          threshold_chart_id?: string | null
          tiebreaker_format?: string | null
          tiebreaker_trigger?: string | null
          updated_at?: string | null
          win_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preferences_threshold_chart_id_fkey"
            columns: ["threshold_chart_id"]
            isOneToOne: false
            referencedRelation: "threshold_charts"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_edit_audit_log: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          after_value: string | null
          before_value: string | null
          created_at: string
          id: string
          organization_id: string | null
          rating_system: string
          reason: string | null
          scope: string
          source: string
          target_match_lineup_id: string | null
          target_member_id: string | null
        }
        Insert: {
          actor_type?: string
          actor_user_id?: string | null
          after_value?: string | null
          before_value?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          rating_system: string
          reason?: string | null
          scope: string
          source?: string
          target_match_lineup_id?: string | null
          target_member_id?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          after_value?: string | null
          before_value?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          rating_system?: string
          reason?: string | null
          scope?: string
          source?: string
          target_match_lineup_id?: string | null
          target_member_id?: string | null
        }
        Relationships: []
      }
      report_actions: {
        Row: {
          action_notes: string
          action_type: Database["public"]["Enums"]["moderation_action"]
          actor_id: string
          actor_role: string
          created_at: string
          id: string
          report_id: string
          suspension_until: string | null
        }
        Insert: {
          action_notes: string
          action_type: Database["public"]["Enums"]["moderation_action"]
          actor_id: string
          actor_role: string
          created_at?: string
          id?: string
          report_id: string
          suspension_until?: string | null
        }
        Update: {
          action_notes?: string
          action_type?: Database["public"]["Enums"]["moderation_action"]
          actor_id?: string
          actor_role?: string
          created_at?: string
          id?: string
          report_id?: string
          suspension_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "user_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_updates: {
        Row: {
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["report_status"]
          old_status: Database["public"]["Enums"]["report_status"]
          report_id: string
          update_notes: string | null
          updater_id: string
          updater_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["report_status"]
          old_status: Database["public"]["Enums"]["report_status"]
          report_id: string
          update_notes?: string | null
          updater_id: string
          updater_role: string
        }
        Update: {
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["report_status"]
          old_status?: Database["public"]["Enums"]["report_status"]
          report_id?: string
          update_notes?: string | null
          updater_id?: string
          updater_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_updates_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "user_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_updates_updater_id_fkey"
            columns: ["updater_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      rules_page_events: {
        Row: {
          created_at: string
          event_type: string
          game: string | null
          id: string
          result_count: number | null
          rule_id: string | null
          scope_id: string | null
          scope_type: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          game?: string | null
          id?: string
          result_count?: number | null
          rule_id?: string | null
          scope_id?: string | null
          scope_type?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          game?: string | null
          id?: string
          result_count?: number | null
          rule_id?: string | null
          scope_id?: string | null
          scope_type?: string | null
        }
        Relationships: []
      }
      season_finance_entries: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          dropped_at_week: number | null
          dropped_team_id: string | null
          entry_date: string
          entry_type: string
          id: string
          lo_funded: boolean
          season_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          dropped_at_week?: number | null
          dropped_team_id?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          lo_funded?: boolean
          season_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          dropped_at_week?: number | null
          dropped_team_id?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          lo_funded?: boolean
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_finance_entries_dropped_team_id_fkey"
            columns: ["dropped_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_finance_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_locked_payouts: {
        Row: {
          app_fee: number
          final_prize_pool: number
          id: string
          individual_awards: Json
          lo_cut_amount: number
          locked_at: string
          locked_by_member_id: string | null
          season_id: string
          team_payouts: Json
          total_credits: number
          total_deductions: number
          total_income: number
        }
        Insert: {
          app_fee: number
          final_prize_pool: number
          id?: string
          individual_awards: Json
          lo_cut_amount: number
          locked_at?: string
          locked_by_member_id?: string | null
          season_id: string
          team_payouts: Json
          total_credits: number
          total_deductions: number
          total_income: number
        }
        Update: {
          app_fee?: number
          final_prize_pool?: number
          id?: string
          individual_awards?: Json
          lo_cut_amount?: number
          locked_at?: string
          locked_by_member_id?: string | null
          season_id?: string
          team_payouts?: Json
          total_credits?: number
          total_deductions?: number
          total_income?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_locked_payouts_locked_by_member_id_fkey"
            columns: ["locked_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_locked_payouts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_reup_responses: {
        Row: {
          captain_id: string
          created_at: string
          dismissed_at: string | null
          id: string
          next_captain_id: string | null
          returning_next_season: boolean | null
          season_id: string
          submitted_at: string | null
          submitted_by_captain_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          next_captain_id?: string | null
          returning_next_season?: boolean | null
          season_id: string
          submitted_at?: string | null
          submitted_by_captain_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          next_captain_id?: string | null
          returning_next_season?: boolean | null
          season_id?: string
          submitted_at?: string | null
          submitted_by_captain_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_reup_responses_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_reup_responses_next_captain_id_fkey"
            columns: ["next_captain_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_reup_responses_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_reup_responses_submitted_by_captain_id_fkey"
            columns: ["submitted_by_captain_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_reup_responses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      season_weeks: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          scheduled_date: string
          season_id: string
          updated_at: string | null
          week_completed: boolean
          week_name: string
          week_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
          season_id: string
          updated_at?: string | null
          week_completed?: boolean
          week_name: string
          week_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          season_id?: string
          updated_at?: string | null
          week_completed?: boolean
          week_name?: string
          week_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_weeks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          league_id: string
          season_completed: boolean | null
          season_length: number
          season_name: string
          start_date: string
          status: string
          threshold_chart_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          league_id: string
          season_completed?: boolean | null
          season_length: number
          season_name: string
          start_date: string
          status?: string
          threshold_chart_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          league_id?: string
          season_completed?: boolean | null
          season_length?: number
          season_name?: string
          start_date?: string
          status?: string
          threshold_chart_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_playoff_config"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_preferences"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "seasons_threshold_chart_id_fkey"
            columns: ["threshold_chart_id"]
            isOneToOne: false
            referencedRelation: "threshold_charts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          acknowledged_at: string | null
          claimed_member_id: string | null
          created_at: string
          expires_at: string
          id: string
          requested_by_user_id: string
          requested_member_id: string | null
          resolved_at: string | null
          resolved_by_member_id: string | null
          status: string
          team_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          claimed_member_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          requested_by_user_id: string
          requested_member_id?: string | null
          resolved_at?: string | null
          resolved_by_member_id?: string | null
          status?: string
          team_id: string
        }
        Update: {
          acknowledged_at?: string | null
          claimed_member_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          requested_by_user_id?: string
          requested_member_id?: string | null
          resolved_at?: string | null
          resolved_by_member_id?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_claimed_member_id_fkey"
            columns: ["claimed_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_requested_member_id_fkey"
            columns: ["requested_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_resolved_by_member_id_fkey"
            columns: ["resolved_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          id: string
          individual_losses: number | null
          individual_wins: number | null
          is_captain: boolean | null
          joined_at: string | null
          member_id: string
          season_id: string
          skill_level: number | null
          status: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          individual_losses?: number | null
          individual_wins?: number | null
          is_captain?: boolean | null
          joined_at?: string | null
          member_id: string
          season_id: string
          skill_level?: number | null
          status?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          individual_losses?: number | null
          individual_wins?: number | null
          is_captain?: boolean | null
          joined_at?: string | null
          member_id?: string
          season_id?: string
          skill_level?: number | null
          status?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_players_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_id: string | null
          created_at: string | null
          games_lost: number | null
          games_won: number | null
          home_venue_id: string | null
          id: string
          join_token: string
          league_id: string
          losses: number | null
          points: number | null
          roster_size: number
          season_id: string
          status: string | null
          team_name: string
          ties: number | null
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          captain_id?: string | null
          created_at?: string | null
          games_lost?: number | null
          games_won?: number | null
          home_venue_id?: string | null
          id?: string
          join_token?: string
          league_id: string
          losses?: number | null
          points?: number | null
          roster_size: number
          season_id: string
          status?: string | null
          team_name: string
          ties?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          captain_id?: string | null
          created_at?: string | null
          games_lost?: number | null
          games_won?: number | null
          home_venue_id?: string | null
          id?: string
          join_token?: string
          league_id?: string
          losses?: number | null
          points?: number | null
          roster_size?: number
          season_id?: string
          status?: string | null
          team_name?: string
          ties?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_playoff_config"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_preferences"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      threshold_chart_rows: {
        Row: {
          chart_id: string
          comp_1: number
          comp_2: number | null
          created_at: string
          id: string
          result_1: number
          result_2: number | null
          result_3: number
          sort_order: number
        }
        Insert: {
          chart_id: string
          comp_1: number
          comp_2?: number | null
          created_at?: string
          id?: string
          result_1: number
          result_2?: number | null
          result_3: number
          sort_order?: number
        }
        Update: {
          chart_id?: string
          comp_1?: number
          comp_2?: number | null
          created_at?: string
          id?: string
          result_1?: number
          result_2?: number | null
          result_3?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "threshold_chart_rows_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "threshold_charts"
            referencedColumns: ["id"]
          },
        ]
      }
      threshold_charts: {
        Row: {
          chart_type: string
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          is_default: boolean | null
          lookup_mode: string
          name: string
          updated_at: string
        }
        Insert: {
          chart_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_default?: boolean | null
          lookup_mode?: string
          name: string
          updated_at?: string
        }
        Update: {
          chart_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_default?: boolean | null
          lookup_mode?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          assigned_organization_id: string | null
          auto_flagged: boolean | null
          category: Database["public"]["Enums"]["report_category"]
          context_data: Json | null
          created_at: string
          description: string
          escalated_to_dev: boolean | null
          evidence_snapshot: Json | null
          id: string
          reported_user_id: string
          reporter_id: string
          resolved_at: string | null
          reviewed_at: string | null
          severity: Database["public"]["Enums"]["report_severity"] | null
          status: Database["public"]["Enums"]["report_status"] | null
        }
        Insert: {
          assigned_organization_id?: string | null
          auto_flagged?: boolean | null
          category: Database["public"]["Enums"]["report_category"]
          context_data?: Json | null
          created_at?: string
          description: string
          escalated_to_dev?: boolean | null
          evidence_snapshot?: Json | null
          id?: string
          reported_user_id: string
          reporter_id: string
          resolved_at?: string | null
          reviewed_at?: string | null
          severity?: Database["public"]["Enums"]["report_severity"] | null
          status?: Database["public"]["Enums"]["report_status"] | null
        }
        Update: {
          assigned_organization_id?: string | null
          auto_flagged?: boolean | null
          category?: Database["public"]["Enums"]["report_category"]
          context_data?: Json | null
          created_at?: string
          description?: string
          escalated_to_dev?: boolean | null
          evidence_snapshot?: Json | null
          id?: string
          reported_user_id?: string
          reporter_id?: string
          resolved_at?: string | null
          reviewed_at?: string | null
          severity?: Database["public"]["Enums"]["report_severity"] | null
          status?: Database["public"]["Enums"]["report_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_assigned_organization_id_fkey"
            columns: ["assigned_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_owners: {
        Row: {
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          business_name: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          business_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          bar_box_table_numbers: number[] | null
          bar_box_tables: number | null
          business_hours: string | null
          city: string
          created_at: string | null
          eight_foot_table_numbers: number[] | null
          id: string
          is_active: boolean
          league_contact_email: string | null
          league_contact_name: string | null
          league_contact_phone: string | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string
          proprietor_name: string | null
          proprietor_phone: string | null
          regulation_table_numbers: number[] | null
          regulation_tables: number | null
          state: string
          street_address: string
          total_tables: number | null
          updated_at: string | null
          venue_owner_id: string | null
          website: string | null
          zip_code: string
        }
        Insert: {
          bar_box_table_numbers?: number[] | null
          bar_box_tables?: number | null
          business_hours?: string | null
          city: string
          created_at?: string | null
          eight_foot_table_numbers?: number[] | null
          id?: string
          is_active?: boolean
          league_contact_email?: string | null
          league_contact_name?: string | null
          league_contact_phone?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone: string
          proprietor_name?: string | null
          proprietor_phone?: string | null
          regulation_table_numbers?: number[] | null
          regulation_tables?: number | null
          state: string
          street_address: string
          total_tables?: number | null
          updated_at?: string | null
          venue_owner_id?: string | null
          website?: string | null
          zip_code: string
        }
        Update: {
          bar_box_table_numbers?: number[] | null
          bar_box_tables?: number | null
          business_hours?: string | null
          city?: string
          created_at?: string | null
          eight_foot_table_numbers?: number[] | null
          id?: string
          is_active?: boolean
          league_contact_email?: string | null
          league_contact_name?: string | null
          league_contact_phone?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string
          proprietor_name?: string | null
          proprietor_phone?: string | null
          regulation_table_numbers?: number[] | null
          regulation_tables?: number | null
          state?: string
          street_address?: string
          total_tables?: number | null
          updated_at?: string | null
          venue_owner_id?: string | null
          website?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_venue_owner_id_fkey"
            columns: ["venue_owner_id"]
            isOneToOne: false
            referencedRelation: "venue_owners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      house_rules_with_scope_name: {
        Row: {
          body: string[] | null
          created_at: string | null
          effect_type: string | null
          game: string | null
          id: string | null
          league_id: string | null
          organization_id: string | null
          parent_org_name: string | null
          related_rule_id: string | null
          scope_name: string | null
          scope_type: string | null
          title: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "house_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_playoff_config"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "house_rules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "resolved_league_preferences"
            referencedColumns: ["league_id"]
          },
          {
            foreignKeyName: "house_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resolved_league_playoff_config: {
        Row: {
          auto_generate: boolean | null
          config_id: string | null
          config_source: string | null
          description: string | null
          fixed_team_count: number | null
          league_id: string | null
          name: string | null
          organization_id: string | null
          payment_method: string | null
          percentage_max: number | null
          percentage_min: number | null
          playoff_weeks: number | null
          qualification_type: string | null
          qualifying_percentage: number | null
          week_matchup_styles: string[] | null
          wildcard_spots: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leagues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resolved_league_preferences: {
        Row: {
          game_generation: string | null
          game_history_limit: number | null
          golden_break_counts_as_win: boolean | null
          handicap_type: string | null
          handicap_variant: string | null
          league_id: string | null
          lineup_size: number | null
          max_roster_size: number | null
          mechanism: string | null
          organization_id: string | null
          pairing_format: string | null
          points_calculator: string | null
          points_calculator_params: Json | null
          points_system: string | null
          race_length: number | null
          standings_sort: string[] | null
          team_handicap_variant: string | null
          threshold_chart_id: string | null
          tiebreaker_format: string | null
          tiebreaker_trigger: string | null
          win_condition: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leagues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acknowledge_join_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      approve_join_request: {
        Args: {
          p_action: string
          p_claimed_member_id?: string
          p_request_id: string
        }
        Returns: Json
      }
      archive_placeholder: {
        Args: {
          p_actor_member_id: string
          p_member_id: string
          p_organization_id: string
        }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      assign_tables_for_season: {
        Args: { p_season_id: string }
        Returns: undefined
      }
      assign_tables_for_week: {
        Args: { p_season_week_id: string }
        Returns: undefined
      }
      auto_create_season_conversations: {
        Args: { p_season_id: string }
        Returns: undefined
      }
      can_write_house_rule_org: {
        Args: { target_org_id: string }
        Returns: boolean
      }
      can_write_threshold_chart: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: boolean
      }
      can_write_threshold_chart_via_id: {
        Args: { p_chart_id: string }
        Returns: boolean
      }
      claim_invite_token: {
        Args: { p_token: string; p_user_id: string }
        Returns: {
          error_message: string
          member_id: string
          success: boolean
          team_id: string
        }[]
      }
      create_announcement_conversation: {
        Args: { p_member_ids: string[]; p_season_id: string; p_title: string }
        Returns: string
      }
      create_dm_conversation: {
        Args: { user1_id: string; user2_id: string }
        Returns: string
      }
      create_group_conversation: {
        Args: { creator_id: string; group_name: string; member_ids: string[] }
        Returns: string
      }
      create_organization_announcement_conversation: {
        Args: {
          p_member_ids: string[]
          p_organization_id: string
          p_title: string
        }
        Returns: string
      }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      delete_unused_placeholder: {
        Args: {
          p_actor_member_id: string
          p_member_id: string
          p_organization_id: string
        }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      get_current_member_id: { Args: never; Returns: string }
      get_invite_details: {
        Args: { p_token: string }
        Returns: {
          captain_name: string
          error_message: string
          expires_at: string
          is_valid: boolean
          member_id: string
          placeholder_first_name: string
          placeholder_last_name: string
          team_name: string
        }[]
      }
      get_join_requests_for_approver: { Args: never; Returns: Json }
      get_merges_into_member: {
        Args: { p_org_id: string; p_target_member_id: string }
        Returns: {
          actor_name: string
          actor_role: string
          archive_id: string
          created_at: string
          expires_at: string
          placeholder_first_name: string
          placeholder_last_name: string
          placeholder_member_id: string
          placeholder_nickname: string
          synopsis: Json
        }[]
      }
      get_my_approved_join_requests: { Args: never; Returns: Json }
      get_my_pending_invites: {
        Args: never
        Returns: {
          captain_name: string
          creator_name: string
          expires_at: string
          game_count: number
          invited_at: string
          is_expired: boolean
          member_id: string
          organization_name: string
          organization_owner_name: string
          placeholder_first_name: string
          placeholder_last_name: string
          placeholder_nickname: string
          starting_handicap_5v5: number
          team_name: string
          token: string
        }[]
      }
      get_operator_placeholders: { Args: { p_org_id: string }; Returns: Json }
      get_operator_player_stats: { Args: { p_org_id: string }; Returns: Json }
      get_operator_stats: { Args: { operator_id_param: string }; Returns: Json }
      get_org_placeholders_for_merge: {
        Args: { p_include_archived?: boolean; p_org_id: string }
        Returns: {
          archived_at: string
          created_at: string
          creator_name: string
          email: string
          first_name: string
          game_count: number
          has_pending_invite: boolean
          has_stats: boolean
          is_archived: boolean
          last_name: string
          member_id: string
          nickname: string
          system_player_number: number
          teams: Json
        }[]
      }
      get_org_teams_for_onboarding: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_placeholder_remove_context: {
        Args: { p_member_id: string }
        Returns: {
          first_name: string
          found: boolean
          has_bca: boolean
          has_stats: boolean
          is_archived: boolean
          is_placeholder: boolean
          nickname: string
          team_count: number
        }[]
      }
      get_team_join_view: { Args: { p_token: string }; Returns: Json }
      get_team_placeholders_for_claim: {
        Args: { p_team_id: string }
        Returns: Json
      }
      get_team_verification_options: {
        Args: { p_decoy_count?: number; p_member_id: string }
        Returns: {
          is_correct: boolean
          team_name: string
        }[]
      }
      is_conversation_participant: {
        Args: { conv_id: string; uid: string }
        Returns: boolean
      }
      league_display_name: { Args: { p_league_id: string }; Returns: string }
      lookup_placeholder_by_system_number: {
        Args: { p_system_number: number }
        Returns: {
          city: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          state: string
          system_player_number: number
        }[]
      }
      lookup_threshold: {
        Args: { p_chart_id: string; p_comp_1: number; p_comp_2?: number }
        Returns: {
          result_1: number
          result_2: number
          result_3: number
          was_swapped: boolean
        }[]
      }
      member_display_name: { Args: { p_member_id: string }; Returns: string }
      merge_placeholder_into_member: {
        Args: { p_placeholder_member_id: string; p_target_member_id: string }
        Returns: {
          error_message: string
          success: boolean
          tables_updated: number
          total_rows_updated: number
        }[]
      }
      merge_placeholder_into_member_v2: {
        Args: {
          p_actor_member_id: string
          p_actor_role: string
          p_organization_id: string
          p_placeholder_member_id: string
          p_target_member_id: string
        }
        Returns: {
          archive_id: string
          error_message: string
          success: boolean
          tables_updated: number
          total_rows_updated: number
        }[]
      }
      placeholder_has_stats: { Args: { p_member_id: string }; Returns: boolean }
      prep_match: {
        Args: { p_game_rows: Json; p_match_id: string; p_thresholds: Json }
        Returns: undefined
      }
      recompute_member_rating: {
        Args: {
          p_member_id: string
          p_new_value: number
          p_rating_system: string
          p_source?: string
        }
        Returns: string
      }
      remove_placeholder_from_team: {
        Args: { p_member_id: string; p_org_id: string; p_team_id: string }
        Returns: Json
      }
      request_team_join: {
        Args: { p_claimed_member_id?: string; p_token: string }
        Returns: Json
      }
      resolve_member_primary_org: {
        Args: { p_member_id: string }
        Returns: string
      }
      restore_placeholder: {
        Args: {
          p_actor_member_id: string
          p_member_id: string
          p_organization_id: string
        }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      rotate_team_join_token: { Args: { p_team_id: string }; Returns: Json }
      search_placeholder_matches: {
        Args: {
          p_city?: string
          p_first_name: string
          p_last_name: string
          p_limit?: number
          p_min_score?: number
          p_state?: string
        }
        Returns: {
          city: string
          city_score: number
          first_name: string
          first_name_score: number
          id: string
          last_name: string
          last_name_score: number
          nickname: string
          state: string
          state_match: boolean
          system_player_number: number
          total_score: number
        }[]
      }
      search_placeholder_matches_v2: {
        Args: {
          p_captain_first_name?: string
          p_captain_last_name?: string
          p_captain_player_number?: number
          p_city?: string
          p_has_not_played_yet?: boolean
          p_last_opponent_first_name?: string
          p_last_opponent_last_name?: string
          p_limit?: number
          p_operator_first_name?: string
          p_operator_last_name?: string
          p_operator_player_number?: number
          p_play_night?: string
          p_state?: string
          p_system_first_name?: string
          p_system_last_name?: string
          p_system_nickname?: string
          p_system_player_number?: number
          p_team_name?: string
        }
        Returns: {
          captain_name: string
          city: string
          first_name: string
          grade: string
          last_name: string
          matched_fields: string[]
          member_id: string
          nickname: string
          operator_name: string
          state: string
          system_player_number: number
          team_name: string
          total_score: number
        }[]
      }
      set_match_lineup_rating: {
        Args: {
          p_match_lineup_id: string
          p_member_id: string
          p_rating_value: number
          p_reason?: string
        }
        Returns: string
      }
      set_member_starting_handicap: {
        Args: {
          p_member_id: string
          p_new_value: number
          p_rating_system: string
          p_reason?: string
        }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soundex: { Args: { "": string }; Returns: string }
      text_soundex: { Args: { "": string }; Returns: string }
      undo_merge_placeholder: {
        Args: {
          p_actor_member_id: string
          p_archive_id: string
          p_caller_org_id: string
        }
        Returns: {
          error_message: string
          missing_rows: number
          rows_restored: number
          success: boolean
        }[]
      }
      vacate_and_rescore_audit_marker: {
        Args: { p_match_id: string; p_reason?: string }
        Returns: string
      }
    }
    Enums: {
      moderation_action:
        | "warning"
        | "temporary_suspension"
        | "permanent_ban"
        | "account_deletion"
        | "no_action"
      preference_action: "blackout" | "ignore"
      preference_type: "holiday" | "championship" | "custom"
      report_category:
        | "inappropriate_message"
        | "harassment"
        | "fake_account"
        | "cheating"
        | "poor_sportsmanship"
        | "impersonation"
        | "spam"
        | "other"
      report_severity: "low" | "medium" | "high" | "critical"
      report_status:
        | "pending"
        | "under_review"
        | "escalated"
        | "action_taken"
        | "resolved"
        | "dismissed"
      user_role: "player" | "league_operator" | "developer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      moderation_action: [
        "warning",
        "temporary_suspension",
        "permanent_ban",
        "account_deletion",
        "no_action",
      ],
      preference_action: ["blackout", "ignore"],
      preference_type: ["holiday", "championship", "custom"],
      report_category: [
        "inappropriate_message",
        "harassment",
        "fake_account",
        "cheating",
        "poor_sportsmanship",
        "impersonation",
        "spam",
        "other",
      ],
      report_severity: ["low", "medium", "high", "critical"],
      report_status: [
        "pending",
        "under_review",
        "escalated",
        "action_taken",
        "resolved",
        "dismissed",
      ],
      user_role: ["player", "league_operator", "developer"],
    },
  },
} as const

