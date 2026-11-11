
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "cards": {
                  Row: {
                    "advance_fee": number,"advance_rate_ea": number,"amortization_method": Database["public"]['Enums']["amortization_method"],"archived_at": string | null,"bank": string,"color": string,"created_at": string,"credit_limit": number,"cutoff_day": number,"handling_fee": number,"id": string,"last4": string,"name": string,"network": string,"payment_day": number,"purchase_rate_ea": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "advance_fee"?: number,"advance_rate_ea"?: number,"amortization_method"?: Database["public"]['Enums']["amortization_method"],"archived_at"?: string | null,"bank": string,"color"?: string,"created_at"?: string,"credit_limit": number,"cutoff_day": number,"handling_fee"?: number,"id"?: string,"last4": string,"name": string,"network": string,"payment_day": number,"purchase_rate_ea"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "advance_fee"?: number,"advance_rate_ea"?: number,"amortization_method"?: Database["public"]['Enums']["amortization_method"],"archived_at"?: string | null,"bank"?: string,"color"?: string,"created_at"?: string,"credit_limit"?: number,"cutoff_day"?: number,"handling_fee"?: number,"id"?: string,"last4"?: string,"name"?: string,"network"?: string,"payment_day"?: number,"purchase_rate_ea"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"color": string | null,"created_at": string,"icon": string,"id": string,"monthly_budget": number | null,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"icon": string,"id"?: string,"monthly_budget"?: number | null,"name": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string | null,"created_at"?: string,"icon"?: string,"id"?: string,"monthly_budget"?: number | null,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fx_rates": {
                  Row: {
                    "date": string,"usd_cop": number
                  }
                  ComputedFields: never
                  Insert: {
                    "date": string,"usd_cop": number
                  }
                  Update: {
                    "date"?: string,"usd_cop"?: number
                  }
                  Relationships: [
                    
                  ]
                },"installments": {
                  Row: {
                    "balance_after": number,"created_at": string,"id": string,"interest": number,"interest_cop": number,"number": number,"principal": number,"principal_cop": number,"statement_id": string,"total": number,"total_cop": number,"transaction_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance_after": number,"created_at"?: string,"id"?: string,"interest": number,"interest_cop": number,"number": number,"principal": number,"principal_cop": number,"statement_id": string,"total": number,"total_cop": number,"transaction_id": string,"user_id"?: string
                  }
                  Update: {
                    "balance_after"?: number,"created_at"?: string,"id"?: string,"interest"?: number,"interest_cop"?: number,"number"?: number,"principal"?: number,"principal_cop"?: number,"statement_id"?: string,"total"?: number,"total_cop"?: number,"transaction_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installments_owner_statement_fk"
      columns: ["user_id","statement_id"]
isOneToOne: false
      referencedRelation: "statement_totals"
      referencedColumns: ["user_id","statement_id"]
    },{
      foreignKeyName: "installments_owner_statement_fk"
      columns: ["user_id","statement_id"]
isOneToOne: false
      referencedRelation: "statements"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "installments_owner_transaction_fk"
      columns: ["user_id","transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "installments_statement_id_fkey"
      columns: ["statement_id"]
isOneToOne: false
      referencedRelation: "statement_totals"
      referencedColumns: ["statement_id"]
    },{
      foreignKeyName: "installments_statement_id_fkey"
      columns: ["statement_id"]
isOneToOne: false
      referencedRelation: "statements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "installments_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_log": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"ref_id": string,"scheduled_for": string,"sent_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"ref_id": string,"scheduled_for": string,"sent_at"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"ref_id"?: string,"scheduled_for"?: string,"sent_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"statements": {
                  Row: {
                    "card_id": string,"created_at": string,"cutoff_date": string,"due_date": string,"id": string,"paid_at": string | null,"period_start": string,"real_total": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"created_at"?: string,"cutoff_date": string,"due_date": string,"id"?: string,"paid_at"?: string | null,"period_start": string,"real_total"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "card_id"?: string,"created_at"?: string,"cutoff_date"?: string,"due_date"?: string,"id"?: string,"paid_at"?: string | null,"period_start"?: string,"real_total"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "statements_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["card_id"]
    },{
      foreignKeyName: "statements_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statements_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["user_id","card_id"]
    },{
      foreignKeyName: "statements_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "amount": number,"billing_day": number,"card_id": string,"category_id": string | null,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"frequency": Database["public"]['Enums']["subscription_frequency"],"id": string,"last_charged_amount": number | null,"name": string,"start_date": string,"status": Database["public"]['Enums']["subscription_status"],"trial_ends_at": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"billing_day": number,"card_id": string,"category_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"frequency": Database["public"]['Enums']["subscription_frequency"],"id"?: string,"last_charged_amount"?: number | null,"name": string,"start_date": string,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number,"billing_day"?: number,"card_id"?: string,"category_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"frequency"?: Database["public"]['Enums']["subscription_frequency"],"id"?: string,"last_charged_amount"?: number | null,"name"?: string,"start_date"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"trial_ends_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["card_id"]
    },{
      foreignKeyName: "subscriptions_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["user_id","card_id"]
    },{
      foreignKeyName: "subscriptions_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "subscriptions_owner_category_fk"
      columns: ["user_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "amount": number,"amount_cop": number,"card_id": string,"category_id": string | null,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"date": string,"fx_rate": number | null,"id": string,"installments_count": number,"interest_free": boolean,"merchant": string | null,"note": string | null,"parent_id": string | null,"rate_ea_applied": number | null,"source": Database["public"]['Enums']["transaction_source"],"statement_id": string,"subscription_id": string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"user_id": string,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_cop": number,"card_id": string,"category_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"date": string,"fx_rate"?: number | null,"id"?: string,"installments_count"?: number,"interest_free"?: boolean,"merchant"?: string | null,"note"?: string | null,"parent_id"?: string | null,"rate_ea_applied"?: number | null,"source"?: Database["public"]['Enums']["transaction_source"],"statement_id": string,"subscription_id"?: string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string,"verified"?: boolean
                  }
                  Update: {
                    "amount"?: number,"amount_cop"?: number,"card_id"?: string,"category_id"?: string | null,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"date"?: string,"fx_rate"?: number | null,"id"?: string,"installments_count"?: number,"interest_free"?: boolean,"merchant"?: string | null,"note"?: string | null,"parent_id"?: string | null,"rate_ea_applied"?: number | null,"source"?: Database["public"]['Enums']["transaction_source"],"statement_id"?: string,"subscription_id"?: string | null,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"user_id"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["card_id"]
    },{
      foreignKeyName: "transactions_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["user_id","card_id"]
    },{
      foreignKeyName: "transactions_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "transactions_owner_category_fk"
      columns: ["user_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "transactions_owner_parent_fk"
      columns: ["user_id","parent_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "transactions_owner_statement_fk"
      columns: ["user_id","card_id","statement_id"]
isOneToOne: false
      referencedRelation: "statement_totals"
      referencedColumns: ["user_id","card_id","statement_id"]
    },{
      foreignKeyName: "transactions_owner_statement_fk"
      columns: ["user_id","card_id","statement_id"]
isOneToOne: false
      referencedRelation: "statements"
      referencedColumns: ["user_id","card_id","id"]
    },{
      foreignKeyName: "transactions_owner_subscription_fk"
      columns: ["user_id","subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "transactions_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_statement_id_fkey"
      columns: ["statement_id"]
isOneToOne: false
      referencedRelation: "statement_totals"
      referencedColumns: ["statement_id"]
    },{
      foreignKeyName: "transactions_statement_id_fkey"
      columns: ["statement_id"]
isOneToOne: false
      referencedRelation: "statements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "card_balances": {
                  Row: {
                    "available": number | null,"card_id": string,"credit_limit": number,"used": number | null,"user_id": string,"utilization": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"statement_totals": {
                  Row: {
                    "adjustments": number | null,"card_id": string,"cash_advances": number | null,"handling_fees": number | null,"installments": number | null,"insurance": number | null,"interest": number | null,"payments": number | null,"refunds": number | null,"single_purchases": number | null,"statement_id": string,"subscriptions": number | null,"total_calculated": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "statements_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["card_id"]
    },{
      foreignKeyName: "statements_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "statements_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "card_balances"
      referencedColumns: ["user_id","card_id"]
    },{
      foreignKeyName: "statements_owner_card_fk"
      columns: ["user_id","card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["user_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "create_default_categories":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"create_transaction_with_installments":
{ Args: { "p_payload": Json }; Returns: string
                           },
"cutoff_date_for_month":
{ Args: { "cutoff_day": number,"m": number,"y": number }; Returns: string
                           },
"ensure_statement":
{ Args: { "p_card_id": string,"p_cutoff_date": string }; Returns: string
                           },
"statement_cutoff_for":
{ Args: { "cutoff_day": number,"d": string }; Returns: string
                           },
"statement_due_date":
{ Args: { "cutoff_date": string,"payment_day": number }; Returns: string
                           },
"statement_period_start":
{ Args: { "cutoff_date": string,"cutoff_day": number }; Returns: string
                           },
"update_transaction_with_installments":
{ Args: { "p_id": string,"p_payload": Json }; Returns: string
                           }
          }
          Enums: {
            "amortization_method": "fixed_principal"|"french","currency_code": "COP"|"USD","subscription_frequency": "monthly"|"yearly","subscription_status": "active"|"paused"|"cancelled","transaction_source": "manual"|"subscription"|"import"|"email"|"system","transaction_type": "purchase"|"cash_advance"|"advance_fee"|"payment"|"handling_fee"|"interest"|"insurance"|"refund"|"adjustment"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "amortization_method": ["fixed_principal", "french"],"currency_code": ["COP", "USD"],"subscription_frequency": ["monthly", "yearly"],"subscription_status": ["active", "paused", "cancelled"],"transaction_source": ["manual", "subscription", "import", "email", "system"],"transaction_type": ["purchase", "cash_advance", "advance_fee", "payment", "handling_fee", "interest", "insurance", "refund", "adjustment"]
          }
        }
} as const
