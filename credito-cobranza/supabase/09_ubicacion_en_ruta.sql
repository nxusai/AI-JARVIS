-- Sistema de crédito y cobranza · guardar la ubicación del cliente desde la ruta (NXUS AI)
--
-- Se corre DESPUÉS de 08_mesa_y_campo.sql. Se puede volver a correr sin perder nada.
--
-- El asesor, estando con el cliente, toca «Guardar ubicación aquí» en su tarjeta de
-- cobro y queda el punto del GPS como dirección de cobro o del negocio. Sirve sobre
-- todo para los clientes que llegan de Listo sin ubicación.
-- Sólo puede hacerlo quien registra pagos y sólo con clientes de sus rutas.

create or replace function public.guardar_ubicacion(p_cliente integer, p_tipo text, p_lat numeric, p_lng numeric, p_direccion text default null)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.tiene_permiso('registrar_pagos') then
    raise exception 'Tu cargo no puede guardar ubicaciones.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ruta_id in (select public.mis_rutas())) then
    raise exception 'Ese cliente no está en tu ruta.';
  end if;
  if p_tipo not in ('cobro', 'negocio') then raise exception 'Tipo de ubicación no válido.'; end if;
  -- México cabe de sobra en este rango; evita coordenadas en cero o equivocadas
  if p_lat is null or p_lng is null or p_lat not between 14 and 33 or p_lng not between -119 and -86 then
    raise exception 'La ubicación no parece estar en México. Intenta de nuevo.';
  end if;
  if p_tipo = 'cobro' then
    update public.clientes set lat = round(p_lat, 6), lng = round(p_lng, 6),
           direccion = coalesce(nullif(trim(direccion), ''), nullif(trim(p_direccion), ''))
     where id = p_cliente;
  else
    update public.clientes set lat_negocio = round(p_lat, 6), lng_negocio = round(p_lng, 6),
           direccion_negocio = coalesce(nullif(trim(direccion_negocio), ''), nullif(trim(p_direccion), ''))
     where id = p_cliente;
  end if;
  return p_tipo;
end $$;
revoke all on function public.guardar_ubicacion(integer, text, numeric, numeric, text) from public, anon;
grant execute on function public.guardar_ubicacion(integer, text, numeric, numeric, text) to authenticated;
