import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { ETIQUETA_ESTADO_PARADA, ETIQUETA_ESTADO_RUTA, formatoMoneda, horarioRecepcion, importeLineas } from "@abuelito/shared";
import { supabase } from "../lib/supabase";
import { useSesion } from "../lib/sesion";
import { nuevoId, useRuta } from "../lib/ruta";
import { descartar } from "../lib/cola";
import { Boton, Campo, Etiqueta, Tarjeta, colorEstado, colores, estilos } from "../componentes/ui";

export default function MiRuta() {
  const { cargando: cargandoSesion, sesion, perfil } = useSesion();
  const { ruta, cola, cargando, enLinea, actualizadoEn, refrescar, registrar } = useRuta();
  const [refrescando, setRefrescando] = useState(false);
  const [temperatura, setTemperatura] = useState("");

  if (cargandoSesion) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!sesion) return <Redirect href="/entrar" />;

  async function salir() {
    const pendientes = cola.filter((o) => !o.error).length;
    Alert.alert(
      "Cerrar sesión",
      pendientes > 0 ? `Hay ${pendientes} registro(s) sin enviar. Si sales ahora se enviarán al volver a entrar.` : "¿Seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", style: "destructive", onPress: () => supabase.auth.signOut() },
      ],
    );
  }

  if (!perfil || !perfil.activo || perfil.rol !== "chofer") {
    return (
      <View style={[estilos.pantalla, estilos.contenido]}>
        <Text style={estilos.texto}>Esta cuenta no es de chofer o está dada de baja. Pide acceso en la oficina.</Text>
        <Boton titulo="Salir" tipo="secundario" onPress={() => supabase.auth.signOut()} />
      </View>
    );
  }

  const tempValida = temperatura.trim() !== "" && !Number.isNaN(Number(temperatura.replace(",", ".")));
  const valorTemp = Number(temperatura.replace(",", "."));
  const pendientesEnvio = cola.filter((o) => !o.error);
  const conError = cola.filter((o) => o.error);

  const paradas = ruta?.paradas ?? [];
  const hechas = paradas.filter((p) => p.estado !== "pendiente").length;
  const pagos = paradas.flatMap((p) => p.pagos);
  const efectivo = pagos.filter((p) => p.metodo === "efectivo").reduce((t, p) => t + Number(p.monto), 0);
  const transferencias = pagos.filter((p) => p.metodo === "transferencia").reduce((t, p) => t + Number(p.monto), 0);

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={async () => {
            setRefrescando(true);
            await refrescar();
            setRefrescando(false);
          }}
        />
      }
    >
      {!enLinea && (
        <View style={estilos.aviso}>
          <Text style={estilos.texto}>Sin señal. Puedes seguir trabajando; todo se enviará al recuperar conexión.</Text>
        </View>
      )}
      {pendientesEnvio.length > 0 && (
        <Text style={estilos.suave}>{pendientesEnvio.length} registro(s) por enviar…</Text>
      )}
      {conError.map((op) => (
        <View key={op.id} style={[estilos.aviso, { borderColor: colores.error }]}>
          <Text style={[estilos.texto, { color: colores.error }]}>La oficina rechazó un registro: {op.error}</Text>
          <Pressable onPress={() => descartar(op.id).then(refrescar)}>
            <Text style={{ color: colores.primario, marginTop: 6 }}>Descartar y volver a capturar</Text>
          </Pressable>
        </View>
      ))}

      {cargando ? (
        <ActivityIndicator />
      ) : !ruta ? (
        <Tarjeta>
          <Text style={estilos.subtitulo}>Hola, {perfil.nombre}</Text>
          <Text style={estilos.texto}>No tienes ruta asignada hoy. Desliza hacia abajo para actualizar.</Text>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta>
            <View style={estilos.fila}>
              <Text style={estilos.titulo}>{ruta.nombre}</Text>
              <Etiqueta texto={ETIQUETA_ESTADO_RUTA[ruta.estado]} color={colores.primario} />
            </View>
            <Text style={estilos.texto}>
              {ruta.camionetas ? `${ruta.camionetas.nombre}${ruta.camionetas.placas ? ` · ${ruta.camionetas.placas}` : ""}` : "Sin camioneta"}
            </Text>
            <Text style={estilos.texto}>{hechas} de {paradas.length} paradas</Text>
            {actualizadoEn && <Text style={estilos.suave}>Actualizado {new Date(actualizadoEn).toLocaleTimeString("es-MX")}</Text>}
          </Tarjeta>

          {ruta.estado === "publicada" && (
            <Tarjeta>
              <Text style={estilos.subtitulo}>Antes de salir</Text>
              <Text style={estilos.texto}>Revisa que llevas todo y anota la temperatura de la caja.</Text>
              <Campo etiqueta="Temperatura de la caja (°C)" value={temperatura} onChangeText={setTemperatura} keyboardType="numbers-and-punctuation" placeholder="Ej. 3" />
              <Boton
                titulo="Iniciar ruta"
                deshabilitado={!tempValida}
                onPress={async () => {
                  await registrar({ id: nuevoId(), tipo: "iniciar", ruta_id: ruta.id, temperatura: valorTemp });
                  setTemperatura("");
                }}
              />
            </Tarjeta>
          )}

          {ruta.estado === "en_curso" && hechas === paradas.length && (
            <Tarjeta>
              <Text style={estilos.subtitulo}>Terminaste todas las paradas</Text>
              <Campo etiqueta="Temperatura al regresar (°C)" value={temperatura} onChangeText={setTemperatura} keyboardType="numbers-and-punctuation" />
              <Boton
                titulo="Terminar ruta"
                tipo="exito"
                onPress={async () => {
                  await registrar({ id: nuevoId(), tipo: "terminar", ruta_id: ruta.id, temperatura: tempValida ? valorTemp : null });
                  setTemperatura("");
                }}
              />
            </Tarjeta>
          )}

          {(ruta.estado === "terminada" || ruta.estado === "cerrada") && (
            <Tarjeta borde={colores.exito}>
              <Text style={estilos.subtitulo}>Cierre del día</Text>
              <Text style={estilos.texto}>Entregadas: {paradas.filter((p) => p.estado === "entregada" || p.estado === "parcial").length}</Text>
              <Text style={estilos.texto}>No entregadas: {paradas.filter((p) => p.estado === "no_entregada").length}</Text>
              <Text style={estilos.texto}>Transferencias: {formatoMoneda(transferencias)}</Text>
              <Text style={[estilos.titulo, { fontSize: 20 }]}>Efectivo a entregar: {formatoMoneda(efectivo)}</Text>
              {ruta.estado === "cerrada" && <Text style={estilos.suave}>La oficina ya cerró esta ruta.</Text>}
            </Tarjeta>
          )}

          {paradas.map((p) => {
            const c = p.ordenes.clientes;
            return (
              <Pressable key={p.id} onPress={() => router.push(`/parada/${p.id}`)}>
                <Tarjeta borde={colorEstado[p.estado]}>
                  <View style={estilos.fila}>
                    <Text style={[estilos.subtitulo, { flex: 1 }]}>{p.secuencia}. {c.nombre}</Text>
                    <Etiqueta texto={ETIQUETA_ESTADO_PARADA[p.estado]} color={colorEstado[p.estado]!} />
                  </View>
                  <Text style={estilos.texto}>{c.direccion}</Text>
                  <Text style={estilos.suave}>
                    Recibe {horarioRecepcion(c.horario_desde, c.horario_hasta)} · {formatoMoneda(importeLineas(p.ordenes.orden_lineas))}
                    {c.condicion_pago === "credito" ? " · Crédito" : " · Contado"}
                  </Text>
                </Tarjeta>
              </Pressable>
            );
          })}
        </>
      )}

      <Boton titulo="Cerrar sesión" tipo="secundario" onPress={salir} />
    </ScrollView>
  );
}
