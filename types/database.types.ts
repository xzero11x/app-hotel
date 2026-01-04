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
      audit_logs: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          capacidad_max: number
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          capacidad_max: number
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          capacidad_max?: number
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      comprobante_detalles: {
        Row: {
          cantidad: number | null
          codigo_afectacion_igv: string
          comprobante_id: string | null
          descripcion: string
          id: string
          igv_linea: number | null
          precio_unitario: number
          total_linea: number | null
          valor_unitario: number
        }
        Insert: {
          cantidad?: number | null
          codigo_afectacion_igv: string
          comprobante_id?: string | null
          descripcion: string
          id?: string
          igv_linea?: number | null
          precio_unitario: number
          total_linea?: number | null
          valor_unitario: number
        }
        Update: {
          cantidad?: number | null
          codigo_afectacion_igv?: string
          comprobante_id?: string | null
          descripcion?: string
          id?: string
          igv_linea?: number | null
          precio_unitario?: number
          total_linea?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "comprobante_detalles_comprobante_id_fkey"
            columns: ["comprobante_id"]
            isOneToOne: false
            referencedRelation: "comprobantes"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobantes: {
        Row: {
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_num_doc: string
          correlativo: number
          created_by: string | null
          documento_ref_id: string | null
          enlace_pdf: string | null
          enlace_xml: string | null
          estadia_id: string | null
          fecha_emision: string | null
          id: string
          motivo_anulacion: string | null
          nubefact_error: string | null
          serie: string
          sunat_estado: Database["public"]["Enums"]["estado_sunat"] | null
          tasa_igv_aplicada: number
          tasa_rc_aplicada: number | null
          tipo: Database["public"]["Enums"]["tipo_comprobante"]
          total_exonerado: number | null
          total_gravado: number | null
          total_igv: number | null
          total_recargo_consumo: number | null
          total_venta: number
        }
        Insert: {
          cliente_direccion?: string | null
          cliente_nombre: string
          cliente_num_doc: string
          correlativo: number
          created_by?: string | null
          documento_ref_id?: string | null
          enlace_pdf?: string | null
          enlace_xml?: string | null
          estadia_id?: string | null
          fecha_emision?: string | null
          id?: string
          motivo_anulacion?: string | null
          nubefact_error?: string | null
          serie: string
          sunat_estado?: Database["public"]["Enums"]["estado_sunat"] | null
          tasa_igv_aplicada: number
          tasa_rc_aplicada?: number | null
          tipo: Database["public"]["Enums"]["tipo_comprobante"]
          total_exonerado?: number | null
          total_gravado?: number | null
          total_igv?: number | null
          total_recargo_consumo?: number | null
          total_venta: number
        }
        Update: {
          cliente_direccion?: string | null
          cliente_nombre?: string
          cliente_num_doc?: string
          correlativo?: number
          created_by?: string | null
          documento_ref_id?: string | null
          enlace_pdf?: string | null
          enlace_xml?: string | null
          estadia_id?: string | null
          fecha_emision?: string | null
          id?: string
          motivo_anulacion?: string | null
          nubefact_error?: string | null
          serie?: string
          sunat_estado?: Database["public"]["Enums"]["estado_sunat"] | null
          tasa_igv_aplicada?: number
          tasa_rc_aplicada?: number | null
          tipo?: Database["public"]["Enums"]["tipo_comprobante"]
          total_exonerado?: number | null
          total_gravado?: number | null
          total_igv?: number | null
          total_recargo_consumo?: number | null
          total_venta?: number
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_documento_ref_id_fkey"
            columns: ["documento_ref_id"]
            isOneToOne: false
            referencedRelation: "comprobantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprobantes_estadia_id_fkey"
            columns: ["estadia_id"]
            isOneToOne: false
            referencedRelation: "estadias"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_sistema: {
        Row: {
          direccion_fiscal: string
          es_regimen_amazonia: boolean | null
          id: string
          logo_url: string | null
          moneda_principal: string | null
          nombre_comercial: string
          nubefact_ruta: string | null
          nubefact_token: string | null
          razon_social: string
          ruc: string
          tasa_igv: number | null
          tasa_recargo_consumo: number | null
          ubigeo: string
          updated_at: string | null
        }
        Insert: {
          direccion_fiscal: string
          es_regimen_amazonia?: boolean | null
          id?: string
          logo_url?: string | null
          moneda_principal?: string | null
          nombre_comercial: string
          nubefact_ruta?: string | null
          nubefact_token?: string | null
          razon_social: string
          ruc: string
          tasa_igv?: number | null
          tasa_recargo_consumo?: number | null
          ubigeo: string
          updated_at?: string | null
        }
        Update: {
          direccion_fiscal?: string
          es_regimen_amazonia?: boolean | null
          id?: string
          logo_url?: string | null
          moneda_principal?: string | null
          nombre_comercial?: string
          nubefact_ruta?: string | null
          nubefact_token?: string | null
          razon_social?: string
          ruc?: string
          tasa_igv?: number | null
          tasa_recargo_consumo?: number | null
          ubigeo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      estadia_huespedes: {
        Row: {
          es_titular: boolean | null
          estadia_id: string
          huesped_id: string
        }
        Insert: {
          es_titular?: boolean | null
          estadia_id: string
          huesped_id: string
        }
        Update: {
          es_titular?: boolean | null
          estadia_id?: string
          huesped_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estadia_huespedes_estadia_id_fkey"
            columns: ["estadia_id"]
            isOneToOne: false
            referencedRelation: "estadias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estadia_huespedes_huesped_id_fkey"
            columns: ["huesped_id"]
            isOneToOne: false
            referencedRelation: "huespedes"
            referencedColumns: ["id"]
          },
        ]
      }
      estadias: {
        Row: {
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_estadia"] | null
          fecha_ingreso: string | null
          fecha_salida_prevista: string
          fecha_salida_real: string | null
          habitacion_id: string | null
          id: string
          precio_noche_final: number
          reserva_id: string | null
          ubicacion_llave: Database["public"]["Enums"]["ubicacion_llave"] | null
        }
        Insert: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_estadia"] | null
          fecha_ingreso?: string | null
          fecha_salida_prevista: string
          fecha_salida_real?: string | null
          habitacion_id?: string | null
          id?: string
          precio_noche_final: number
          reserva_id?: string | null
          ubicacion_llave?:
            | Database["public"]["Enums"]["ubicacion_llave"]
            | null
        }
        Update: {
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_estadia"] | null
          fecha_ingreso?: string | null
          fecha_salida_prevista?: string
          fecha_salida_real?: string | null
          habitacion_id?: string | null
          id?: string
          precio_noche_final?: number
          reserva_id?: string | null
          ubicacion_llave?:
            | Database["public"]["Enums"]["ubicacion_llave"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "estadias_habitacion_id_fkey"
            columns: ["habitacion_id"]
            isOneToOne: false
            referencedRelation: "habitaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estadias_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      habitaciones: {
        Row: {
          categoria_id: string | null
          estado_limpieza: Database["public"]["Enums"]["estado_limpieza"] | null
          estado_ocupacion:
            | Database["public"]["Enums"]["estado_ocupacion"]
            | null
          id: string
          notas_mantenimiento: string | null
          numero: string
          piso: number
          updated_at: string | null
        }
        Insert: {
          categoria_id?: string | null
          estado_limpieza?:
            | Database["public"]["Enums"]["estado_limpieza"]
            | null
          estado_ocupacion?:
            | Database["public"]["Enums"]["estado_ocupacion"]
            | null
          id?: string
          notas_mantenimiento?: string | null
          numero: string
          piso: number
          updated_at?: string | null
        }
        Update: {
          categoria_id?: string | null
          estado_limpieza?:
            | Database["public"]["Enums"]["estado_limpieza"]
            | null
          estado_ocupacion?:
            | Database["public"]["Enums"]["estado_ocupacion"]
            | null
          id?: string
          notas_mantenimiento?: string | null
          numero?: string
          piso?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habitaciones_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      huespedes: {
        Row: {
          apellidos: string
          ciudad_procedencia: string | null
          created_at: string | null
          email: string | null
          es_frecuente: boolean | null
          id: string
          nacionalidad: string | null
          nombres: string
          num_doc: string
          razon_social: string | null
          telefono: string | null
          tipo_doc: Database["public"]["Enums"]["tipo_doc_identidad"] | null
        }
        Insert: {
          apellidos: string
          ciudad_procedencia?: string | null
          created_at?: string | null
          email?: string | null
          es_frecuente?: boolean | null
          id?: string
          nacionalidad?: string | null
          nombres: string
          num_doc: string
          razon_social?: string | null
          telefono?: string | null
          tipo_doc?: Database["public"]["Enums"]["tipo_doc_identidad"] | null
        }
        Update: {
          apellidos?: string
          ciudad_procedencia?: string | null
          created_at?: string | null
          email?: string | null
          es_frecuente?: boolean | null
          id?: string
          nacionalidad?: string | null
          nombres?: string
          num_doc?: string
          razon_social?: string | null
          telefono?: string | null
          tipo_doc?: Database["public"]["Enums"]["tipo_doc_identidad"] | null
        }
        Relationships: []
      }
      pagos: {
        Row: {
          estadia_id: string | null
          fecha_pago: string | null
          id: string
          metodo_pago: string
          moneda: string | null
          monto: number
          notas: string | null
          nro_operacion: string | null
          tipo_cambio: number | null
          turno_id: string | null
        }
        Insert: {
          estadia_id?: string | null
          fecha_pago?: string | null
          id?: string
          metodo_pago: string
          moneda?: string | null
          monto: number
          notas?: string | null
          nro_operacion?: string | null
          tipo_cambio?: number | null
          turno_id?: string | null
        }
        Update: {
          estadia_id?: string | null
          fecha_pago?: string | null
          id?: string
          metodo_pago?: string
          moneda?: string | null
          monto?: number
          notas?: string | null
          nro_operacion?: string | null
          tipo_cambio?: number | null
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_estadia_id_fkey"
            columns: ["estadia_id"]
            isOneToOne: false
            referencedRelation: "estadias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          adelanto_pagado: number | null
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_reserva"] | null
          fecha_llegada: string
          fecha_salida: string
          habitacion_id: string | null
          huesped_titular_id: string | null
          id: string
          observaciones: string | null
          origen: string | null
          precio_pactado_total: number | null
        }
        Insert: {
          adelanto_pagado?: number | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_reserva"] | null
          fecha_llegada: string
          fecha_salida: string
          habitacion_id?: string | null
          huesped_titular_id?: string | null
          id?: string
          observaciones?: string | null
          origen?: string | null
          precio_pactado_total?: number | null
        }
        Update: {
          adelanto_pagado?: number | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_reserva"] | null
          fecha_llegada?: string
          fecha_salida?: string
          habitacion_id?: string | null
          huesped_titular_id?: string | null
          id?: string
          observaciones?: string | null
          origen?: string | null
          precio_pactado_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_habitacion_id_fkey"
            columns: ["habitacion_id"]
            isOneToOne: false
            referencedRelation: "habitaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_huesped_titular_id_fkey"
            columns: ["huesped_titular_id"]
            isOneToOne: false
            referencedRelation: "huespedes"
            referencedColumns: ["id"]
          },
        ]
      }
      series_comprobantes: {
        Row: {
          activo: boolean | null
          correlativo_actual: number | null
          id: string
          serie: string
          tipo_comprobante: Database["public"]["Enums"]["tipo_comprobante"]
        }
        Insert: {
          activo?: boolean | null
          correlativo_actual?: number | null
          id?: string
          serie: string
          tipo_comprobante: Database["public"]["Enums"]["tipo_comprobante"]
        }
        Update: {
          activo?: boolean | null
          correlativo_actual?: number | null
          id?: string
          serie?: string
          tipo_comprobante?: Database["public"]["Enums"]["tipo_comprobante"]
        }
        Relationships: []
      }
      tarifas: {
        Row: {
          activa: boolean | null
          categoria_id: string | null
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activa?: boolean | null
          categoria_id?: string | null
          id?: string
          nombre: string
          precio: number
        }
        Update: {
          activa?: boolean | null
          categoria_id?: string | null
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          estado: string | null
          fin: string | null
          id: string
          inicio: string | null
          monto_final_real: number | null
          monto_inicial: number
          usuario_id: string | null
        }
        Insert: {
          estado?: string | null
          fin?: string | null
          id?: string
          inicio?: string | null
          monto_final_real?: number | null
          monto_inicial: number
          usuario_id?: string | null
        }
        Update: {
          estado?: string | null
          fin?: string | null
          id?: string
          inicio?: string | null
          monto_final_real?: number | null
          monto_inicial?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean | null
          created_at: string | null
          email: string
          id: string
          nombre_completo: string
          rol: Database["public"]["Enums"]["rol_usuario"] | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          email: string
          id: string
          nombre_completo: string
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          nombre_completo?: string
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      obtener_siguiente_correlativo: {
        Args: { p_serie: string }
        Returns: number
      }
    }
    Enums: {
      estado_estadia: "ACTIVA" | "FINALIZADA"
      estado_limpieza: "LIMPIA" | "SUCIA"
      estado_ocupacion: "DISPONIBLE" | "OCUPADA" | "MANTENIMIENTO"
      estado_reserva: "PENDIENTE" | "CONFIRMADA" | "CANCELADA" | "NOSHOW"
      estado_sunat:
        | "PENDIENTE"
        | "ENVIADO"
        | "ACEPTADO"
        | "RECHAZADO"
        | "ANULADO"
      rol_usuario: "admin" | "recepcion" | "limpieza" | "contador"
      tipo_comprobante: "BOLETA" | "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO"
      tipo_doc_identidad: "DNI" | "RUC" | "PASAPORTE" | "CARNET_EXT" | "OTROS"
      ubicacion_llave: "RECEPCION" | "CLIENTE"
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
      estado_estadia: ["ACTIVA", "FINALIZADA"],
      estado_limpieza: ["LIMPIA", "SUCIA"],
      estado_ocupacion: ["DISPONIBLE", "OCUPADA", "MANTENIMIENTO"],
      estado_reserva: ["PENDIENTE", "CONFIRMADA", "CANCELADA", "NOSHOW"],
      estado_sunat: [
        "PENDIENTE",
        "ENVIADO",
        "ACEPTADO",
        "RECHAZADO",
        "ANULADO",
      ],
      rol_usuario: ["admin", "recepcion", "limpieza", "contador"],
      tipo_comprobante: ["BOLETA", "FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"],
      tipo_doc_identidad: ["DNI", "RUC", "PASAPORTE", "CARNET_EXT", "OTROS"],
      ubicacion_llave: ["RECEPCION", "CLIENTE"],
    },
  },
} as const
