import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import {
  ETIQUETA_ESTADO_PARADA,
  MOTIVOS_NO_ENTREGA,
  formatoMoneda,
  horarioRecepcion,
  importeLineas,
  temperaturaFueraDeRango,
  type EstadoParada,
} from "@abuelito/shared";
import { nuevoId, useRuta } from "../../lib/ruta";
import { llamar, navegarA } from "../../lib/navegar";
import { ubicacionActual } from "../../lib/ubicacion";
import { Firma } from "../../componentes/Firma";
import { Boton, Campo, Etiqueta, Opciones, Tarjeta, colorEstado, colores, estilos } from "../../componentes/ui";

type Resultado = Exclude<EstadoParada, "pendiente">;

const numero = (texto: string) => Number(texto.replace(",", "."));
const esNumero = (texto: string) => texto.trim() !== "" && !Number.isNaN(numero(texto));

/** Copia la foto a Documentos: la caché del sistema se puede borrar antes de que haya señal para subirla. */
async function guardarFoto(uri: string): Promise<string> {
  const carpeta = new Directory(Paths.document, "fotos");
  if (!carpeta.exists) carpeta.create();
  const destino = new File(carpeta, `${nuevoId()}.jpg`);
  await new File(uri).copy(destino);
  return destino.uri;
}

export default function ParadaPantalla() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ruta, registrar } = useRuta();
  const parada = ruta?.paradas.find((p) => p.id === id);

  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [entregadas, setEntregadas] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<string | null>(null);
  const [temperatura, setTemperatura] = useState("");
  const [recibio, setRecibio] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [efectivo, setEfectivo] = useState("");
  const [transferencia, setTransferencia] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);

  const lineas = parada?.ordenes.orden_lineas ?? [];

  // Importe de lo que realmente se entrega según el resultado elegido.
  const importe =
    resultado === "no_entregada"
      ? 0
      : resultado === "parcial"
        ? lineas.reduce((t, l) => t + (esNumero(entregadas[l.id] ?? "") ? numero(entregadas[l.id]!) : 0) * Number(l.precio_unitario), 0)
        : importeLineas(lineas);

  if (!ruta || !parada) {
    return (
      <View style={[estilos.pantalla, estilos.contenido]}>
        <Text style={estilos.texto}>Esta parada ya no está en tu ruta. La oficina pudo haberla movido.</Text>
        <Boton titulo="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const cliente = parada.ordenes.clientes;
  const credito = cliente.condicion_pago === "credito";
  const productosTemp = lineas.map((l) => l.productos);
  const tempFuera = esNumero(temperatura) && temperaturaFueraDeRango(numero(temperatura), productosTemp);
  const puedeRegistrar = ruta.estado === "en_curso" && parada.estado === "pendiente";
  const cobrado = (esNumero(efectivo) ? numero(efectivo) : 0) + (esNumero(transferencia) ? numero(transferencia) : 0);
  const saldoDespues = Number(cliente.saldo) + importe - cobrado;

  function elegirResultado(r: Resultado) {
    setResultado(r);
    if (r === "parcial" && Object.keys(entregadas).length === 0) {
      setEntregadas(Object.fromEntries(lineas.map((l) => [l.id, String(l.cantidad)])));
    }
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Sin permiso de cámara", "Actívalo en Ajustes para tomar la foto de entrega.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5 });
    if (!r.canceled && r.assets[0]) setFoto(await guardarFoto(r.assets[0].uri));
  }

  function validar(): string | null {
    if (!resultado) return "Elige cómo fue la entrega.";
    if (resultado === "no_entregada" && !motivo) return "Elige el motivo de no entrega.";
    if (resultado === "parcial") {
      if (lineas.some((l) => !esNumero(entregadas[l.id] ?? ""))) return "Captura la cantidad entregada de cada producto.";
      if (lineas.some((l) => numero(entregadas[l.id]!) > Number(l.cantidad))) return "No puedes entregar más de lo pedido.";
    }
    if (resultado !== "no_entregada" && !esNumero(temperatura)) return "Anota la temperatura del producto.";
    if (!credito && resultado !== "no_entregada" && cobrado < importe) {
      return `Cliente de contado: falta cobrar ${formatoMoneda(importe - cobrado)}.`;
    }
    if (esNumero(transferencia) && numero(transferencia) > 0 && !referencia.trim()) return "Anota la referencia de la transferencia.";
    return null;
  }

  async function guardar() {
    const problema = validar();
    if (problema) {
      Alert.alert("Falta información", problema);
      return;
    }
    const confirmar = async () => {
      setGuardando(true);
      const punto = await ubicacionActual();
      const pagos = [
        { metodo: "efectivo" as const, monto: esNumero(efectivo) ? numero(efectivo) : 0 },
        { metodo: "transferencia" as const, monto: esNumero(transferencia) ? numero(transferencia) : 0, referencia: referencia.trim() || undefined },
      ].filter((p) => p.monto > 0);
      await registrar({
        id: nuevoId(),
        tipo: "entrega",
        ruta_id: ruta!.id,
        empresa_id: parada!.empresa_id,
        foto: foto ?? undefined,
        firma: resultado !== "no_entregada" ? (firma ?? undefined) : undefined,
        registro: {
          p_op_id: nuevoId(),
          p_parada_id: parada!.id,
          p_estado: resultado!,
          p_lineas: resultado === "parcial" ? lineas.map((l) => ({ linea_id: l.id, cantidad_entregada: numero(entregadas[l.id]!) })) : [],
          p_pagos: pagos,
          p_temperatura: esNumero(temperatura) ? numero(temperatura) : null,
          p_motivo: resultado === "no_entregada" ? motivo : null,
          p_recibio_nombre: recibio.trim() || null,
          p_lat: punto?.lat ?? null,
          p_lng: punto?.lng ?? null,
        },
      });
      setGuardando(false);
      router.back();
    };
    if (tempFuera) {
      Alert.alert("Temperatura fuera de rango", "La lectura no cumple el rango de los productos. ¿Registrar de todos modos?", [
        { text: "Revisar", style: "cancel" },
        { text: "Registrar", onPress: confirmar },
      ]);
    } else {
      await confirmar();
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={estilos.pantalla} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: `Parada ${parada.secuencia}` }} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Tarjeta borde={colorEstado[parada.estado]}>
          <View style={estilos.fila}>
            <Text style={[estilos.titulo, { flex: 1 }]}>{cliente.nombre}</Text>
            <Etiqueta texto={ETIQUETA_ESTADO_PARADA[parada.estado]} color={colorEstado[parada.estado]!} />
          </View>
          <Text style={estilos.texto}>{cliente.direccion}</Text>
          <Text style={estilos.texto}>Recibe: {horarioRecepcion(cliente.horario_desde, cliente.horario_hasta)}</Text>
          {cliente.contacto && <Text style={estilos.texto}>Contacto: {cliente.contacto}</Text>}
          <Text style={estilos.texto}>
            {credito ? `Crédito · saldo actual ${formatoMoneda(cliente.saldo)}` : "Contado"}
          </Text>
          {cliente.notas && (
            <View style={estilos.aviso}>
              <Text style={estilos.texto}>{cliente.notas}</Text>
            </View>
          )}
          {parada.ordenes.notas && <Text style={estilos.suave}>Nota de la orden: {parada.ordenes.notas}</Text>}
          {parada.motivo && <Text style={{ color: colores.error }}>Motivo: {parada.motivo}</Text>}
        </Tarjeta>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Boton titulo="Navegar" onPress={() => navegarA(cliente)} />
          </View>
          {cliente.telefono && (
            <View style={{ flex: 1 }}>
              <Boton titulo="Llamar" tipo="secundario" onPress={() => llamar(cliente.telefono!)} />
            </View>
          )}
        </View>

        <Tarjeta>
          <Text style={estilos.subtitulo}>Pedido #{parada.ordenes.folio}</Text>
          {lineas.map((l) => (
            <View key={l.id} style={[estilos.fila, { paddingVertical: 4 }]}>
              <Text style={[estilos.texto, { flex: 1 }]}>{l.productos.nombre}</Text>
              <Text style={estilos.texto}>
                {l.cantidad} {l.productos.unidad}
                {l.cantidad_entregada != null && Number(l.cantidad_entregada) !== Number(l.cantidad) ? ` (entregó ${l.cantidad_entregada})` : ""}
              </Text>
            </View>
          ))}
          <Text style={[estilos.subtitulo, { textAlign: "right" }]}>Total {formatoMoneda(importeLineas(lineas))}</Text>
        </Tarjeta>

        {ruta.estado === "publicada" && (
          <Text style={estilos.suave}>Inicia la ruta en la pantalla anterior para registrar entregas.</Text>
        )}

        {puedeRegistrar && (
          <>
            <Text style={estilos.subtitulo}>¿Cómo fue la entrega?</Text>
            <Opciones<Resultado>
              valor={resultado}
              onCambio={elegirResultado}
              opciones={[
                { valor: "entregada", etiqueta: "Completa", color: colores.exito },
                { valor: "parcial", etiqueta: "Parcial", color: colores.aviso },
                { valor: "no_entregada", etiqueta: "No entregada", color: colores.error },
              ]}
            />

            {resultado === "parcial" && (
              <Tarjeta>
                <Text style={estilos.subtitulo}>Cantidades entregadas</Text>
                {lineas.map((l) => (
                  <Campo
                    key={l.id}
                    etiqueta={`${l.productos.nombre} (pidió ${l.cantidad})`}
                    value={entregadas[l.id] ?? ""}
                    onChangeText={(v) => setEntregadas({ ...entregadas, [l.id]: v })}
                    keyboardType="decimal-pad"
                  />
                ))}
              </Tarjeta>
            )}

            {resultado === "no_entregada" && (
              <Tarjeta>
                <Text style={estilos.subtitulo}>Motivo</Text>
                <Opciones
                  valor={motivo}
                  onCambio={setMotivo}
                  opciones={MOTIVOS_NO_ENTREGA.map((m) => ({ valor: m, etiqueta: m, color: colores.error }))}
                />
              </Tarjeta>
            )}

            {resultado && (
              <Tarjeta>
                <Campo
                  etiqueta="Temperatura del producto (°C)"
                  value={temperatura}
                  onChangeText={setTemperatura}
                  keyboardType="numbers-and-punctuation"
                  placeholder={resultado === "no_entregada" ? "Opcional" : "Ej. 3"}
                />
                {tempFuera && <Text style={{ color: colores.error }}>Fuera del rango de los productos</Text>}
                {resultado !== "no_entregada" && (
                  <Campo etiqueta="Nombre de quien recibe" value={recibio} onChangeText={setRecibio} />
                )}
                <Pressable onPress={tomarFoto} style={{ gap: 8 }}>
                  <Text style={{ color: colores.primario, fontSize: 17, fontWeight: "600" }}>
                    {foto ? "Repetir foto" : resultado === "no_entregada" ? "Tomar foto (fachada o evidencia)" : "Tomar foto de la entrega"}
                  </Text>
                  {foto && <Image source={{ uri: foto }} style={{ height: 180, borderRadius: 10 }} />}
                </Pressable>
              </Tarjeta>
            )}

            {resultado && resultado !== "no_entregada" && (
              <Tarjeta>
                <Text style={estilos.subtitulo}>Firma del cliente</Text>
                <Firma onCambio={setFirma} />
              </Tarjeta>
            )}

            {resultado && (
              <Tarjeta>
                <Text style={estilos.subtitulo}>Cobro</Text>
                <Text style={estilos.texto}>Importe entregado: {formatoMoneda(importe)}</Text>
                {credito && <Text style={estilos.suave}>Saldo anterior: {formatoMoneda(cliente.saldo)}</Text>}
                <Campo etiqueta="Efectivo recibido" value={efectivo} onChangeText={setEfectivo} keyboardType="decimal-pad" placeholder="0" />
                {!credito && importe > 0 && efectivo === "" && (
                  <Pressable onPress={() => setEfectivo(importe.toFixed(2))}>
                    <Text style={{ color: colores.primario, fontSize: 16 }}>Cobrar {formatoMoneda(importe)} en efectivo</Text>
                  </Pressable>
                )}
                <Campo etiqueta="Transferencia" value={transferencia} onChangeText={setTransferencia} keyboardType="decimal-pad" placeholder="0" />
                {esNumero(transferencia) && numero(transferencia) > 0 && (
                  <Campo etiqueta="Referencia de la transferencia" value={referencia} onChangeText={setReferencia} />
                )}
                {credito && <Text style={estilos.texto}>Saldo después de esta visita: {formatoMoneda(saldoDespues)}</Text>}
              </Tarjeta>
            )}

            {resultado && <Boton titulo="Guardar entrega" tipo="exito" onPress={guardar} cargando={guardando} />}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
