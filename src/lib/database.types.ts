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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brand_kits: {
        Row: {
          client_id: string
          colors: string[]
          edit_style: string
          fonts: string[]
          graphics: string
          logo_path: string | null
          music_mood: string | null
          style_rules: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          colors?: string[]
          edit_style?: string
          fonts?: string[]
          graphics?: string
          logo_path?: string | null
          music_mood?: string | null
          style_rules?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          colors?: string[]
          edit_style?: string
          fonts?: string[]
          graphics?: string
          logo_path?: string | null
          music_mood?: string | null
          style_rules?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_questionnaires: {
        Row: {
          answers: Json
          client_id: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          client_id: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          client_id?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_questionnaires_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_questionnaires_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_strategies: {
        Row: {
          audience: string | null
          business: string | null
          charte: Json
          client_id: string
          error: string | null
          keywords: string[]
          needs: string[]
          niche: string | null
          pillars: Json
          reference_accounts: string[]
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          audience?: string | null
          business?: string | null
          charte?: Json
          client_id: string
          error?: string | null
          keywords?: string[]
          needs?: string[]
          niche?: string | null
          pillars?: Json
          reference_accounts?: string[]
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          audience?: string | null
          business?: string | null
          charte?: Json
          client_id?: string
          error?: string | null
          keywords?: string[]
          needs?: string[]
          niche?: string | null
          pillars?: Json
          reference_accounts?: string[]
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_team: {
        Row: {
          client_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_team_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          revision_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          revision_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          revision_limit?: number
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          drawing: Json | null
          id: string
          internal: boolean
          parent_id: string | null
          resolved: boolean
          timecode_ms: number | null
          version_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          drawing?: Json | null
          id?: string
          internal?: boolean
          parent_id?: string | null
          resolved?: boolean
          timecode_ms?: number | null
          version_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          drawing?: Json | null
          id?: string
          internal?: boolean
          parent_id?: string | null
          resolved?: boolean
          timecode_ms?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_jobs: {
        Row: {
          attempts: number
          base_version_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          instructions: string | null
          progress: string | null
          requested_by: string | null
          result_version_id: string | null
          source: Database["public"]["Enums"]["edit_job_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["edit_job_status"]
          video_id: string
        }
        Insert: {
          attempts?: number
          base_version_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          instructions?: string | null
          progress?: string | null
          requested_by?: string | null
          result_version_id?: string | null
          source: Database["public"]["Enums"]["edit_job_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["edit_job_status"]
          video_id: string
        }
        Update: {
          attempts?: number
          base_version_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          instructions?: string | null
          progress?: string | null
          requested_by?: string | null
          result_version_id?: string | null
          source?: Database["public"]["Enums"]["edit_job_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["edit_job_status"]
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_jobs_base_version_id_fkey"
            columns: ["base_version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_jobs_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_jobs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      footage: {
        Row: {
          content_type: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          file_name: string
          id: string
          size_bytes: number | null
          source: Database["public"]["Enums"]["footage_source"]
          storage_path: string | null
          uploaded_by: string | null
          video_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          file_name: string
          id?: string
          size_bytes?: number | null
          source?: Database["public"]["Enums"]["footage_source"]
          storage_path?: string | null
          uploaded_by?: string | null
          video_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          file_name?: string
          id?: string
          size_bytes?: number | null
          source?: Database["public"]["Enums"]["footage_source"]
          storage_path?: string | null
          uploaded_by?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "footage_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "footage_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      motion_prompts: {
        Row: {
          created_at: string
          created_by: string | null
          creator: string | null
          id: string
          kind: string
          notes: string | null
          prompt: string
          source_url: string | null
          tags: string[]
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creator?: string | null
          id?: string
          kind?: string
          notes?: string | null
          prompt: string
          source_url?: string | null
          tags?: string[]
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creator?: string | null
          id?: string
          kind?: string
          notes?: string | null
          prompt?: string
          source_url?: string | null
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "motion_prompts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_videos: {
        Row: {
          analysis: Json | null
          attempts: number
          client_id: string
          created_at: string
          created_by: string | null
          duration: number | null
          error: string | null
          finished_at: string | null
          focus: string[]
          id: string
          note: string | null
          owner: string | null
          platform: string
          progress: string | null
          sheets: string[]
          started_at: string | null
          stats: Json | null
          status: Database["public"]["Enums"]["agent_status"]
          title: string | null
          url: string
          video_id: string | null
          watched: boolean
        }
        Insert: {
          analysis?: Json | null
          attempts?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          duration?: number | null
          error?: string | null
          finished_at?: string | null
          focus?: string[]
          id?: string
          note?: string | null
          owner?: string | null
          platform: string
          progress?: string | null
          sheets?: string[]
          started_at?: string | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["agent_status"]
          title?: string | null
          url: string
          video_id?: string | null
          watched?: boolean
        }
        Update: {
          analysis?: Json | null
          attempts?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          duration?: number | null
          error?: string | null
          finished_at?: string | null
          focus?: string[]
          id?: string
          note?: string | null
          owner?: string | null
          platform?: string
          progress?: string | null
          sheets?: string[]
          started_at?: string | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["agent_status"]
          title?: string | null
          url?: string
          video_id?: string | null
          watched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reference_videos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      script_revisions: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          edit_prompt: string | null
          id: string
          kind: Database["public"]["Enums"]["script_revision_kind"]
          reply: string | null
          request: string | null
          restored_from: string | null
          shoot_plan: Json | null
          shot_list: Json | null
          video_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          edit_prompt?: string | null
          id?: string
          kind: Database["public"]["Enums"]["script_revision_kind"]
          reply?: string | null
          request?: string | null
          restored_from?: string | null
          shoot_plan?: Json | null
          shot_list?: Json | null
          video_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          edit_prompt?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["script_revision_kind"]
          reply?: string | null
          request?: string | null
          restored_from?: string | null
          shoot_plan?: Json | null
          shot_list?: Json | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_revisions_restored_from_fkey"
            columns: ["restored_from"]
            isOneToOne: false
            referencedRelation: "script_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_revisions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          client_note: string | null
          design_brief: Json | null
          design_templates: string[]
          drafted_by_claude: boolean
          edit_prompt: string | null
          shoot_plan: Json | null
          shot_list: Json
          status: Database["public"]["Enums"]["script_status"]
          trend_report_id: string | null
          updated_at: string
          video_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          client_note?: string | null
          design_brief?: Json | null
          design_templates?: string[]
          drafted_by_claude?: boolean
          edit_prompt?: string | null
          shoot_plan?: Json | null
          shot_list?: Json
          status?: Database["public"]["Enums"]["script_status"]
          trend_report_id?: string | null
          updated_at?: string
          video_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          client_note?: string | null
          design_brief?: Json | null
          design_templates?: string[]
          drafted_by_claude?: boolean
          edit_prompt?: string | null
          shoot_plan?: Json | null
          shot_list?: Json
          status?: Database["public"]["Enums"]["script_status"]
          trend_report_id?: string | null
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_trend_report_id_fkey"
            columns: ["trend_report_id"]
            isOneToOne: false
            referencedRelation: "trend_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      shoots: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          location: string | null
          needs: string | null
          starts_at: string
          video_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          needs?: string | null
          starts_at: string
          video_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          needs?: string | null
          starts_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoots_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_files: {
        Row: {
          analysis: Json | null
          created_at: string
          drive_file_id: string
          duration: number
          folder: string
          id: string
          library_id: string
          mood: string | null
          name: string
          tags: string[]
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          drive_file_id: string
          duration?: number
          folder?: string
          id?: string
          library_id: string
          mood?: string | null
          name: string
          tags?: string[]
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          drive_file_id?: string
          duration?: number
          folder?: string
          id?: string
          library_id?: string
          mood?: string | null
          name?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "sound_files_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "sound_libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      sound_libraries: {
        Row: {
          created_at: string
          created_by: string | null
          drive_folder_id: string | null
          error: string | null
          file_count: number
          id: string
          kind: Database["public"]["Enums"]["sound_library_kind"]
          license: string
          name: string
          progress: string | null
          source: string
          status: Database["public"]["Enums"]["agent_status"]
          synced_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string | null
          error?: string | null
          file_count?: number
          id?: string
          kind: Database["public"]["Enums"]["sound_library_kind"]
          license?: string
          name: string
          progress?: string | null
          source?: string
          status?: Database["public"]["Enums"]["agent_status"]
          synced_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string | null
          error?: string | null
          file_count?: number
          id?: string
          kind?: Database["public"]["Enums"]["sound_library_kind"]
          license?: string
          name?: string
          progress?: string | null
          source?: string
          status?: Database["public"]["Enums"]["agent_status"]
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sound_libraries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_reports: {
        Row: {
          accounts: string[]
          attempts: number
          audio: Json
          client_id: string
          created_at: string
          error: string | null
          findings: Json | null
          finished_at: string | null
          hashtags: string[]
          id: string
          progress: string | null
          reels: Json
          requested_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["agent_status"]
        }
        Insert: {
          accounts?: string[]
          attempts?: number
          audio?: Json
          client_id: string
          created_at?: string
          error?: string | null
          findings?: Json | null
          finished_at?: string | null
          hashtags?: string[]
          id?: string
          progress?: string | null
          reels?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
        }
        Update: {
          accounts?: string[]
          attempts?: number
          audio?: Json
          client_id?: string
          created_at?: string
          error?: string | null
          findings?: Json | null
          finished_at?: string | null
          hashtags?: string[]
          id?: string
          progress?: string | null
          reels?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
        }
        Relationships: [
          {
            foreignKeyName: "trend_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_reports_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      versions: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          design: Json | null
          edit_plan: Json | null
          file_name: string
          id: string
          made_by: string
          notes: string | null
          number: number
          sent_at: string | null
          sound: Json | null
          status: Database["public"]["Enums"]["version_status"]
          storage_path: string
          video_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          design?: Json | null
          edit_plan?: Json | null
          file_name: string
          id?: string
          made_by?: string
          notes?: string | null
          number: number
          sent_at?: string | null
          sound?: Json | null
          status?: Database["public"]["Enums"]["version_status"]
          storage_path: string
          video_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          design?: Json | null
          edit_plan?: Json | null
          file_name?: string
          id?: string
          made_by?: string
          notes?: string | null
          number?: number
          sent_at?: string | null
          sound?: Json | null
          status?: Database["public"]["Enums"]["version_status"]
          storage_path?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          aspect: string
          brief: string | null
          client_id: string
          created_at: string
          created_by: string | null
          due_on: string | null
          editor_id: string | null
          footage_complete_at: string | null
          format: Database["public"]["Enums"]["video_format"]
          id: string
          status: Database["public"]["Enums"]["video_status"]
          title: string
          updated_at: string
          videographer_id: string | null
        }
        Insert: {
          aspect?: string
          brief?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          editor_id?: string | null
          footage_complete_at?: string | null
          format?: Database["public"]["Enums"]["video_format"]
          id?: string
          status?: Database["public"]["Enums"]["video_status"]
          title: string
          updated_at?: string
          videographer_id?: string | null
        }
        Update: {
          aspect?: string
          brief?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          editor_id?: string | null
          footage_complete_at?: string | null
          format?: Database["public"]["Enums"]["video_format"]
          id?: string
          status?: Database["public"]["Enums"]["video_status"]
          title?: string
          updated_at?: string
          videographer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_videographer_id_fkey"
            columns: ["videographer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agent_status: "queued" | "running" | "done" | "failed"
      edit_job_source: "launch" | "editor_fix" | "client_changes"
      edit_job_status: "queued" | "running" | "done" | "failed" | "cancelled"
      footage_source: "upload" | "drive"
      script_revision_kind:
        | "written"
        | "revised"
        | "edited"
        | "pasted"
        | "restored"
        | "client"
      script_status:
        | "draft"
        | "client_review"
        | "changes_requested"
        | "approved"
      sound_library_kind: "music" | "sfx"
      user_role: "admin" | "editor" | "videographer" | "client"
      version_status:
        | "draft"
        | "fixes_requested"
        | "client_review"
        | "changes_requested"
        | "approved"
      video_format: "social_short" | "ad" | "podcast_clip"
      video_status:
        | "script"
        | "shoot"
        | "footage_in"
        | "editing"
        | "editor_check"
        | "client_review"
        | "approved"
        | "delivered"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agent_status: ["queued", "running", "done", "failed"],
      edit_job_source: ["launch", "editor_fix", "client_changes"],
      edit_job_status: ["queued", "running", "done", "failed", "cancelled"],
      footage_source: ["upload", "drive"],
      script_revision_kind: [
        "written",
        "revised",
        "edited",
        "pasted",
        "restored",
        "client",
      ],
      script_status: [
        "draft",
        "client_review",
        "changes_requested",
        "approved",
      ],
      sound_library_kind: ["music", "sfx"],
      user_role: ["admin", "editor", "videographer", "client"],
      version_status: [
        "draft",
        "fixes_requested",
        "client_review",
        "changes_requested",
        "approved",
      ],
      video_format: ["social_short", "ad", "podcast_clip"],
      video_status: [
        "script",
        "shoot",
        "footage_in",
        "editing",
        "editor_check",
        "client_review",
        "approved",
        "delivered",
      ],
    },
  },
} as const
